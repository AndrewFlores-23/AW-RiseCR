-- Portal AW-RiseCR · reportes mensuales de rendimiento
-- Cada mes Andrew publica el reporte (PDF de herramientas/reportes) de los clientes que pagan un servicio mensual:
-- mantenimiento web, SEO, redes sociales o fidelización. El cliente los ve mes a mes en la sección Reportes.
--   · Solo se publica un reporte nuevo si el cliente tiene activo alguno de los servicios que cubre.
--   · Si el cliente deja de pagar, conserva los reportes que ya recibió (no se borran ni se ocultan).
--   · resumen: reservado para datos del reporte (hoy el portal solo publica el PDF y queda vacío).

create table public.reportes (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  tipos text[] not null check (cardinality(tipos) > 0 and tipos <@ array['mantenimiento', 'seo', 'redes', 'fidelizacion']),
  periodo date not null,           -- mes del reporte (día 1)
  desde date,                      -- fechas exactas que cubre (p. ej. 6 sep – 6 oct)
  hasta date,
  titulo text not null check (length(titulo) between 1 and 160),
  resumen jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  avisado_en timestamptz,
  avisados int,
  check (desde is null or hasta is null or desde <= hasta)
);
create index reportes_negocio_periodo on public.reportes (negocio_id, periodo);

-- El PDF del reporte (y si hace falta, imágenes) va en adjuntos, como los de la bitácora y los documentos
alter table public.adjuntos add column reporte_id uuid references public.reportes(id) on delete cascade;
create index adjuntos_reporte on public.adjuntos (reporte_id) where reporte_id is not null;
alter table public.adjuntos drop constraint adjuntos_check;
alter table public.adjuntos add constraint adjuntos_check check (bitacora_id is not null or documento_id is not null or reporte_id is not null);

-- Un reporte nuevo necesita un servicio activo de alguno de sus tipos
create or replace function privado.reporte_con_servicio() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.servicios s where s.negocio_id = new.negocio_id and s.estado = 'activo' and s.tipo = any(new.tipos)) then
    raise exception 'El cliente no tiene activo ninguno de esos servicios: no se puede publicar un reporte nuevo';
  end if;
  return new;
end;
$$;
create trigger reporte_con_servicio before insert on public.reportes for each row execute function privado.reporte_con_servicio();
create trigger registrar_actividad after insert or update or delete on public.reportes for each row execute function privado.registrar_actividad();

alter table public.reportes enable row level security;
create policy "ver sus reportes o admin" on public.reportes for select to authenticated
  using ((select privado.es_admin()) or negocio_id = (select privado.mi_negocio()));
create policy "admin inserta" on public.reportes for insert to authenticated with check ((select privado.es_admin()));
create policy "admin actualiza" on public.reportes for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "admin borra" on public.reportes for delete to authenticated using ((select privado.es_admin()));
revoke all on public.reportes from anon;

-- Recuperar respaldos: los reportes van después de servicios y antes de adjuntos
create or replace function public.restaurar_respaldo(p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tablas text[] := array['negocios', 'perfiles', 'contactos', 'proyectos', 'servicios', 'reportes', 'bitacora', 'documentos',
                           'adjuntos', 'cobros', 'fondo_movimientos', 'accesos', 'ajustes', 'actividad'];
  v_tabla text;
  v_cambios text;
  v_antes bigint;
  v_despues bigint;
  v_resultado jsonb := '{}';
begin
  foreach v_tabla in array v_tablas loop
    execute format('alter table public.%I disable trigger user', v_tabla);
  end loop;

  foreach v_tabla in array v_tablas loop
    continue when jsonb_typeof(p_datos -> v_tabla) is distinct from 'array';
    execute format('select count(*) from public.%I', v_tabla) into v_antes;
    if v_tabla = 'perfiles' then
      select string_agg(format('%I = excluded.%I', a.attname, a.attname), ', ') into v_cambios
        from pg_attribute a where a.attrelid = 'public.perfiles'::regclass and a.attnum > 0 and not a.attisdropped and a.attname <> 'id';
      execute format('insert into public.perfiles select * from jsonb_populate_recordset(null::public.perfiles, $1) on conflict (id) do update set %s', v_cambios)
        using p_datos -> 'perfiles';
    elsif v_tabla = 'actividad' then
      insert into public.actividad overriding system value
        select * from jsonb_populate_recordset(null::public.actividad, p_datos -> 'actividad') on conflict do nothing;
    else
      execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I, $1) on conflict do nothing', v_tabla, v_tabla)
        using p_datos -> v_tabla;
    end if;
    execute format('select count(*) from public.%I', v_tabla) into v_despues;
    v_resultado := v_resultado || jsonb_build_object(v_tabla, v_despues - v_antes);
  end loop;

  foreach v_tabla in array v_tablas loop
    execute format('alter table public.%I enable trigger user', v_tabla);
  end loop;
  perform setval(pg_get_serial_sequence('public.actividad', 'id'), greatest((select max(id) from public.actividad), 1));
  return v_resultado;
end;
$$;
revoke all on function public.restaurar_respaldo(jsonb) from public, anon, authenticated;
grant execute on function public.restaurar_respaldo(jsonb) to service_role;
