-- Portal AW-RiseCR · 0006 · Cobros y mensualidades, Fondo AW y bienvenida automática
-- Fechas en hora de Costa Rica. Todo lo que escribe datos exige admin con dos pasos (privado.es_admin()).

create or replace function privado.hoy()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'America/Costa_Rica')::date; $$;
grant execute on function privado.hoy() to authenticated;

-- Las vistas usan la fecha de Costa Rica (antes usaban la de UTC y un cobro salía atrasado desde las 6 p. m.)
create or replace view public.cobros_estado with (security_invoker = true) as
  select c.*,
    case
      when c.anulado then 'anulado'
      when c.pagado_en is not null then 'cobrado'
      when c.vence < privado.hoy() then 'atrasado'
      when c.vence <= privado.hoy() + 7 then 'por_vencer'
      else 'programado'
    end as estado
  from public.cobros c;

create or replace view public.fondo_saldos with (security_invoker = true) as
  select m.negocio_id,
    sum(m.monto) as saldo,
    min(m.vence) filter (where m.monto > 0 and m.vence >= privado.hoy()) as proximo_vencimiento,
    count(*) filter (where m.tipo = 'referido') as referidos
  from public.fondo_movimientos m
  group by m.negocio_id;

-- ---------- Mensualidades ----------
-- Un cobro por servicio y fecha: las mensualidades nunca se duplican, y una anulada no se vuelve a crear
create unique index cobros_servicio_vence on public.cobros (servicio_id, vence) where servicio_id is not null;

-- Crea el cobro del mes de cada servicio activo, desde 25 días antes de su fecha de cobro
create or replace function privado.generar_mensualidades()
returns int language plpgsql security definer set search_path = ''
as $$
declare
  meses text[] := array['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
  v_hoy date := privado.hoy();
  s record; m date; v date; k int; n int := 0;
begin
  for s in select * from public.servicios where estado = 'activo' and monto_mensual > 0 and dia_cobro is not null loop
    foreach m in array array[date_trunc('month', v_hoy)::date, (date_trunc('month', v_hoy) + interval '1 month')::date] loop
      v := m + (s.dia_cobro - 1);
      continue when v < coalesce(s.inicio, s.creado_en::date) or v > v_hoy + 25;
      insert into public.cobros (negocio_id, proyecto_id, servicio_id, concepto, monto, vence)
      values (s.negocio_id, s.proyecto_id, s.id,
              'Mensualidad ' || coalesce(nullif(trim(s.plan), ''),
                case s.tipo when 'web' then 'web' when 'mantenimiento' then 'mantenimiento' when 'seo' then 'SEO'
                            when 'redes' then 'redes sociales' when 'fidelizacion' then 'fidelización' else 'del servicio' end)
                || ' · ' || meses[extract(month from v)::int] || ' ' || extract(year from v),
              s.monto_mensual, v)
      on conflict (servicio_id, vence) where servicio_id is not null do nothing;
      get diagnostics k = row_count;
      n := n + k;
    end loop;
  end loop;
  return n;
end;
$$;

-- Al cambiar un servicio: los cobros pendientes que aún no vencen se ajustan (pausa o cancelación los anula)
create or replace function privado.servicio_cambio()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.estado <> 'activo' and old.estado = 'activo' then
      update public.cobros set anulado = true, nota = 'Servicio ' || new.estado
       where servicio_id = new.id and pagado_en is null and not anulado and vence >= privado.hoy();
    elsif new.estado = 'activo' then
      update public.cobros
         set monto = new.monto_mensual,
             vence = case when new.dia_cobro is distinct from old.dia_cobro
                          then date_trunc('month', vence)::date + (new.dia_cobro - 1) else vence end
       where servicio_id = new.id and pagado_en is null and not anulado and vence >= privado.hoy()
         and (new.monto_mensual is distinct from old.monto_mensual or new.dia_cobro is distinct from old.dia_cobro);
    end if;
  end if;
  perform privado.generar_mensualidades();
  return new;
end;
$$;

create trigger servicio_cambio
  after insert or update on public.servicios
  for each row execute function privado.servicio_cambio();

-- ---------- Fondo AW ----------
-- Vencimiento: el crédito se usa del más viejo al más nuevo; lo que venció sin usarse se descuenta una sola vez
create or replace function privado.vencer_fondos()
returns int language plpgsql security definer set search_path = ''
as $$
declare r record; n int := 0;
begin
  for r in
    select m.negocio_id,
           coalesce(sum(m.monto) filter (where m.monto > 0 and m.vence < privado.hoy()), 0) as vencido,
           coalesce(-sum(m.monto) filter (where m.monto < 0), 0) as consumido
      from public.fondo_movimientos m group by m.negocio_id
  loop
    if r.vencido > r.consumido then
      insert into public.fondo_movimientos (negocio_id, tipo, monto, descripcion)
      values (r.negocio_id, 'vencimiento', -(r.vencido - r.consumido), 'Crédito vencido sin usar');
      n := n + 1;
    end if;
  end loop;
  return n;
end;
$$;

-- Una recomendación se carga una sola vez, aunque el recomendado tenga varios proyectos
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
  if exists (select 1 from public.fondo_movimientos m where m.tipo = 'referido' and m.referido_negocio_id = v_negocio) then
    raise exception 'Esta recomendación ya se cargó';
  end if;
  if v_total <= 0 then raise exception 'El proyecto no tiene monto'; end if;
  select coalesce(sum(c.monto), 0) into v_pagado from public.cobros c
    where c.proyecto_id = p_proyecto and c.pagado_en is not null and not c.anulado;
  if v_pagado < v_total then raise exception 'El proyecto aún no está pagado al 100 %%'; end if;
  if v_entregado is null or v_entregado > privado.hoy() - 15 then
    raise exception 'Deben pasar 15 días desde la entrega';
  end if;
  select count(*) into v_previas from public.fondo_movimientos m where m.negocio_id = v_ref and m.tipo = 'referido';
  v_monto := least(150, round(v_total * case when v_previas >= 2 then 0.20 else 0.15 end, 2));
  insert into public.fondo_movimientos (negocio_id, tipo, monto, referido_negocio_id, proyecto_id, descripcion, vence)
  values (v_ref, 'referido', v_monto, v_negocio, p_proyecto, 'Recomendación pagada', privado.hoy() + interval '12 months');
  return v_monto;
end;
$$;

-- Pagar un cobro de proyecto (total o en parte) con el Fondo AW: hasta el 50 % del proyecto y sin pasar el saldo
create or replace function public.pagar_con_fondo(p_cobro uuid, p_monto numeric)
returns void language plpgsql security definer set search_path = ''
as $$
declare c public.cobros; v_total numeric; v_usado numeric; v_saldo numeric;
begin
  if not privado.es_admin() then raise exception 'Sin permiso'; end if;
  perform privado.vencer_fondos();
  select * into c from public.cobros where id = p_cobro for update;
  if c.id is null or c.anulado or c.pagado_en is not null then raise exception 'El cobro no está pendiente'; end if;
  if c.proyecto_id is null or c.servicio_id is not null then raise exception 'El Fondo AW solo se usa en proyectos de desarrollo'; end if;
  if p_monto is null or p_monto <= 0 or p_monto > c.monto then raise exception 'Monto inválido'; end if;
  select coalesce(sum(m.monto), 0) into v_saldo from public.fondo_movimientos m where m.negocio_id = c.negocio_id;
  if p_monto > v_saldo then raise exception 'El saldo del Fondo AW no alcanza'; end if;
  select p.monto_total into v_total from public.proyectos p where p.id = c.proyecto_id;
  select coalesce(-sum(m.monto), 0) into v_usado from public.fondo_movimientos m
    where m.proyecto_id = c.proyecto_id and m.negocio_id = c.negocio_id and m.tipo = 'uso';
  if v_usado + p_monto > v_total * 0.5 then raise exception 'El Fondo AW cubre hasta el 50 %% del proyecto'; end if;

  insert into public.fondo_movimientos (negocio_id, tipo, monto, proyecto_id, descripcion)
  values (c.negocio_id, 'uso', -p_monto, c.proyecto_id, 'Usado en: ' || c.concepto);
  if p_monto = c.monto then
    update public.cobros set pagado_en = privado.hoy(), metodo = 'Fondo AW' where id = c.id;
  else
    update public.cobros set monto = monto - p_monto where id = c.id;
    insert into public.cobros (negocio_id, proyecto_id, concepto, monto, vence, pagado_en, metodo)
    values (c.negocio_id, c.proyecto_id, c.concepto || ' · Fondo AW', p_monto, privado.hoy(), privado.hoy(), 'Fondo AW');
  end if;
end;
$$;

-- Recomendaciones que faltan por cargar (solo el admin las ve)
create view public.referidos_pendientes with (security_invoker = true) as
  select p.id as proyecto_id, p.nombre as proyecto, n.id as negocio_id, n.nombre as negocio,
         r.id as referidor_id, r.nombre as referidor, p.monto_total, p.etapa, p.entregado_en,
         coalesce((select sum(c.monto) from public.cobros c
                    where c.proyecto_id = p.id and c.pagado_en is not null and not c.anulado), 0) as pagado,
         (select count(*) from public.fondo_movimientos m where m.negocio_id = r.id and m.tipo = 'referido') as previas
    from public.proyectos p
    join public.negocios n on n.id = p.negocio_id
    join public.negocios r on r.id = n.referido_por
   where (select privado.es_admin())
     and not exists (select 1 from public.fondo_movimientos m where m.tipo = 'referido' and m.referido_negocio_id = n.id);

-- ---------- Proyecto nuevo: bitácora, bienvenida y cobros 50 / 50 en un solo paso ----------
create or replace function privado.al_crear_proyecto()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.bitacora (proyecto_id, negocio_id, tipo, titulo, nota)
  values (new.id, new.negocio_id, 'inicio', '¡Arrancamos! ' || new.nombre,
          'Aquí vas a ver cada avance de tu proyecto, del más reciente al primero. Tu documento de bienvenida está en Documentos.');
  insert into public.documentos (negocio_id, proyecto_id, tipo, titulo, contenido)
  values (new.negocio_id, new.id, 'bienvenida', 'Bienvenida · ' || new.nombre, jsonb_build_object('plantilla', 'bienvenida', 'version', 1));
  return new;
end;
$$;

create trigger al_crear_proyecto
  after insert on public.proyectos
  for each row execute function privado.al_crear_proyecto();

create or replace function public.crear_proyecto(p_negocio uuid, p_nombre text, p_monto numeric, p_inicio date, p_entrega date, p_cobros boolean)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid; v_inicio date := coalesce(p_inicio, privado.hoy()); v_mitad numeric;
begin
  if not privado.es_admin() then raise exception 'Sin permiso'; end if;
  insert into public.proyectos (negocio_id, nombre, monto_total, inicio, entrega_estimada)
  values (p_negocio, trim(p_nombre), coalesce(p_monto, 0), v_inicio, p_entrega)
  returning id into v_id;
  if p_cobros and coalesce(p_monto, 0) > 0 then
    v_mitad := round(p_monto / 2, 2);
    insert into public.cobros (negocio_id, proyecto_id, concepto, monto, vence) values
      (p_negocio, v_id, 'Anticipo 50 % · ' || trim(p_nombre), v_mitad, v_inicio),
      (p_negocio, v_id, 'Saldo 50 % al publicar · ' || trim(p_nombre), p_monto - v_mitad, coalesce(p_entrega, v_inicio + 30));
  end if;
  return v_id;
end;
$$;

-- ---------- Permisos ----------
revoke all on function privado.generar_mensualidades(), privado.vencer_fondos(), privado.servicio_cambio(),
  privado.al_crear_proyecto() from public, anon, authenticated;
revoke all on function public.pagar_con_fondo(uuid, numeric), public.crear_proyecto(uuid, text, numeric, date, date, boolean),
  public.cargar_referido(uuid) from public, anon;
grant execute on function public.pagar_con_fondo(uuid, numeric), public.crear_proyecto(uuid, text, numeric, date, date, boolean),
  public.cargar_referido(uuid) to authenticated;
revoke all on public.referidos_pendientes from anon;

-- ---------- Tarea diaria (6:00 a. m. de Costa Rica): mensualidades del mes y créditos vencidos ----------
create extension if not exists pg_cron;
select cron.schedule('portal-diario', '0 12 * * *', $$ select privado.generar_mensualidades(); select privado.vencer_fondos(); $$);
