-- Portal AW-RiseCR · 0002 · Cifrado de datos sensibles, vistas, Fondo AW, actividad y archivos
--
-- Cifrado: pgcrypto (pgp_sym_encrypt) con una llave aleatoria guardada en Supabase Vault
-- ("portal_llave"). En la tabla solo queda texto ilegible. Copia de la llave: Bitwarden
-- (sin ella un respaldo no se puede descifrar al restaurarlo en otro proyecto).

-- ---------- Llave de cifrado ----------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'portal_llave') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'base64'), 'portal_llave',
      'Llave de cifrado de datos sensibles del portal. Copia en Bitwarden.');
  end if;
end $$;

create or replace function privado.llave()
returns text language sql stable security definer set search_path = ''
as $$ select decrypted_secret from vault.decrypted_secrets where name = 'portal_llave' limit 1; $$;

create or replace function privado.cifrar(texto text)
returns bytea language sql stable security definer set search_path = ''
as $$ select case when texto is null or texto = '' then null
                  else extensions.pgp_sym_encrypt(texto, privado.llave()) end; $$;

create or replace function privado.descifrar(dato bytea)
returns text language sql stable security definer set search_path = ''
as $$ select case when dato is null then null
                  else extensions.pgp_sym_decrypt(dato, privado.llave()) end; $$;

revoke all on function privado.llave(), privado.cifrar(text), privado.descifrar(bytea) from public, anon, authenticated;

-- ---------- Contacto de cada negocio (cifrado) ----------
create table public.contactos (
  negocio_id uuid primary key references public.negocios(id) on delete cascade,
  telefono bytea,
  correo bytea,
  cedula bytea,
  notas_privadas bytea,
  actualizado_en timestamptz not null default now()
);
alter table public.contactos enable row level security;
-- Sin políticas: nadie la lee directo; solo por las funciones de abajo
revoke all on public.contactos from anon, authenticated;

create or replace function public.ver_contacto(p_negocio uuid)
returns table (telefono text, correo text, cedula text, notas_privadas text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (privado.es_admin() or p_negocio = privado.mi_negocio()) then
    raise exception 'Sin permiso';
  end if;
  return query
    select privado.descifrar(c.telefono), privado.descifrar(c.correo), privado.descifrar(c.cedula),
           case when privado.es_admin() then privado.descifrar(c.notas_privadas) end
    from public.contactos c where c.negocio_id = p_negocio;
end;
$$;

create or replace function public.guardar_contacto(p_negocio uuid, p_telefono text, p_correo text, p_cedula text, p_notas text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not privado.es_admin() then raise exception 'Sin permiso'; end if;
  insert into public.contactos (negocio_id, telefono, correo, cedula, notas_privadas, actualizado_en)
  values (p_negocio, privado.cifrar(p_telefono), privado.cifrar(p_correo), privado.cifrar(p_cedula), privado.cifrar(p_notas), now())
  on conflict (negocio_id) do update set
    telefono = excluded.telefono, correo = excluded.correo, cedula = excluded.cedula,
    notas_privadas = excluded.notas_privadas, actualizado_en = now();
end;
$$;

-- Usuario o correo de cada acceso, cifrado (las contraseñas siguen en Bitwarden)
alter table public.accesos add column usuario bytea;

create or replace function public.accesos_de(p_negocio uuid)
returns table (id uuid, servicio text, proveedor text, titular text, usuario text, vence date, estado text, enlace_bitwarden text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (privado.es_admin() or p_negocio = privado.mi_negocio()) then
    raise exception 'Sin permiso';
  end if;
  return query
    select a.id, a.servicio, a.proveedor, a.titular, privado.descifrar(a.usuario), a.vence, a.estado, a.enlace_bitwarden
    from public.accesos a where a.negocio_id = p_negocio order by a.servicio;
end;
$$;

create or replace function public.guardar_usuario_acceso(p_acceso uuid, p_usuario text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not privado.es_admin() then raise exception 'Sin permiso'; end if;
  update public.accesos set usuario = privado.cifrar(p_usuario) where id = p_acceso;
end;
$$;

-- ---------- Vistas (respetan RLS de quien consulta) ----------
create view public.cobros_estado with (security_invoker = true) as
  select c.*,
    case
      when c.anulado then 'anulado'
      when c.pagado_en is not null then 'cobrado'
      when c.vence < current_date then 'atrasado'
      when c.vence <= current_date + 7 then 'por_vencer'
      else 'programado'
    end as estado
  from public.cobros c;

create view public.fondo_saldos with (security_invoker = true) as
  select m.negocio_id,
    sum(m.monto) as saldo,
    min(m.vence) filter (where m.monto > 0 and m.vence >= current_date) as proximo_vencimiento,
    count(*) filter (where m.tipo = 'referido') as referidos
  from public.fondo_movimientos m
  group by m.negocio_id;

-- ---------- Fondo AW ----------
-- Bienvenida de USD 25 cuando se registra un negocio que vino recomendado
create or replace function privado.bienvenida_fondo()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.referido_por is not null then
    insert into public.fondo_movimientos (negocio_id, tipo, monto, referido_negocio_id, descripcion, vence)
    values (new.id, 'bienvenida', 25, new.referido_por, 'Bienvenida por venir recomendado', current_date + interval '12 months');
  end if;
  return new;
end;
$$;

create trigger bienvenida_al_registrar
  after insert on public.negocios
  for each row execute function privado.bienvenida_fondo();

-- Carga para quien recomendó: 15 % (20 % desde su 3.ª), tope USD 150,
-- solo con el proyecto pagado al 100 % y 15 días después de la entrega.
-- monto_total del proyecto debe registrarse sin IVA ni costos de terceros.
create or replace function public.cargar_referido(p_proyecto uuid)
returns numeric language plpgsql security definer set search_path = ''
as $$
declare
  v_negocio uuid; v_total numeric; v_entregado date; v_ref uuid;
  v_pagado numeric; v_previas int; v_monto numeric;
begin
  if not privado.es_admin() then raise exception 'Sin permiso'; end if;
  select p.negocio_id, p.monto_total, p.entregado_en into v_negocio, v_total, v_entregado
    from public.proyectos p where p.id = p_proyecto;
  if v_negocio is null then raise exception 'Proyecto no encontrado'; end if;
  select n.referido_por into v_ref from public.negocios n where n.id = v_negocio;
  if v_ref is null then raise exception 'Este negocio no vino recomendado'; end if;
  select coalesce(sum(c.monto), 0) into v_pagado from public.cobros c
    where c.proyecto_id = p_proyecto and c.pagado_en is not null and not c.anulado;
  if v_pagado < v_total then raise exception 'El proyecto aún no está pagado al 100 %%'; end if;
  if v_entregado is null or v_entregado > current_date - 15 then
    raise exception 'Deben pasar 15 días desde la entrega';
  end if;
  select count(*) into v_previas from public.fondo_movimientos m where m.negocio_id = v_ref and m.tipo = 'referido';
  v_monto := least(150, round(v_total * case when v_previas >= 2 then 0.20 else 0.15 end, 2));
  insert into public.fondo_movimientos (negocio_id, tipo, monto, referido_negocio_id, proyecto_id, descripcion, vence)
  values (v_ref, 'referido', v_monto, v_negocio, p_proyecto, 'Recomendación pagada', current_date + interval '12 months');
  return v_monto;
end;
$$;

-- ---------- Aprobación de entradas de la bitácora por el cliente ----------
create or replace function public.aprobar_entrada(p_entrada uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.bitacora b
     set aprobado_en = now(), aprobado_por = auth.uid()
   where b.id = p_entrada and b.requiere_aprobacion and b.aprobado_en is null
     and (privado.es_admin() or b.negocio_id = privado.mi_negocio());
  if not found then raise exception 'No se pudo aprobar'; end if;
end;
$$;

-- ---------- Registro de actividad ----------
create table public.actividad (
  id bigint generated always as identity primary key,
  usuario uuid default auth.uid(),
  accion text not null,
  tabla text not null,
  registro text,
  creado_en timestamptz not null default now()
);
alter table public.actividad enable row level security;
create policy "solo admin ve la actividad" on public.actividad for select to authenticated
  using ((select privado.es_admin()));
create index on public.actividad (creado_en desc);

create or replace function privado.registrar_actividad()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_id text;
begin
  v_id := coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id', to_jsonb(new)->>'negocio_id', to_jsonb(old)->>'negocio_id');
  insert into public.actividad (usuario, accion, tabla, registro) values (auth.uid(), lower(tg_op), tg_table_name, v_id);
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['negocios', 'perfiles', 'servicios', 'proyectos', 'bitacora', 'documentos', 'adjuntos', 'cobros', 'fondo_movimientos', 'accesos', 'contactos'] loop
    execute format('create trigger registrar_actividad after insert or update or delete on public.%I
                    for each row execute function privado.registrar_actividad()', t);
  end loop;
end $$;

-- ---------- Permisos de las funciones públicas ----------
revoke all on function public.ver_contacto(uuid), public.guardar_contacto(uuid, text, text, text, text),
  public.accesos_de(uuid), public.guardar_usuario_acceso(uuid, text), public.cargar_referido(uuid),
  public.aprobar_entrada(uuid) from public, anon;
grant execute on function public.ver_contacto(uuid), public.guardar_contacto(uuid, text, text, text, text),
  public.accesos_de(uuid), public.guardar_usuario_acceso(uuid, text), public.cargar_referido(uuid),
  public.aprobar_entrada(uuid) to authenticated;
revoke all on public.cobros_estado, public.fondo_saldos, public.actividad from anon;

-- ---------- Archivos: bucket privado, carpeta por negocio ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal', 'portal', false, 20971520,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf', 'application/zip', 'text/plain'])
on conflict (id) do nothing;

create policy "portal: ver archivos de su negocio o admin" on storage.objects for select to authenticated
  using (bucket_id = 'portal' and ((select privado.es_admin()) or (storage.foldername(name))[1] = (select privado.mi_negocio())::text));
create policy "portal: admin sube archivos" on storage.objects for insert to authenticated
  with check (bucket_id = 'portal' and (select privado.es_admin()));
create policy "portal: admin modifica archivos" on storage.objects for update to authenticated
  using (bucket_id = 'portal' and (select privado.es_admin()));
create policy "portal: admin borra archivos" on storage.objects for delete to authenticated
  using (bucket_id = 'portal' and (select privado.es_admin()));
