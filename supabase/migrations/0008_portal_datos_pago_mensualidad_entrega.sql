-- Portal AW-RiseCR · 0008 · Datos de pago en la base de datos y mensualidad que empieza con la entrega
-- Los datos de pago (SINPE, cuenta, IBAN) no van en el código: el repositorio es público.
-- Solo los leen usuarios con sesión y solo los cambia el admin con dos pasos.

-- ---------- Ajustes del portal ----------
create table public.ajustes (
  clave text primary key check (clave in ('pago')),
  valor jsonb not null default '{}',
  actualizado_en timestamptz not null default now()
);
alter table public.ajustes enable row level security;
create policy "con sesión leen los ajustes" on public.ajustes for select to authenticated using (true);
create policy "admin crea ajustes" on public.ajustes for insert to authenticated with check ((select privado.es_admin()));
create policy "admin cambia ajustes" on public.ajustes for update to authenticated
  using ((select privado.es_admin())) with check ((select privado.es_admin()));
revoke all on public.ajustes from anon;
insert into public.ajustes (clave, valor) values ('pago', '{}') on conflict do nothing;
create trigger registrar_actividad after insert or update or delete on public.ajustes
  for each row execute function privado.registrar_actividad();

-- ---------- Mensualidades ----------
-- Ligada a un proyecto: empieza un mes después de la entrega, el mismo día del mes
-- (entregado el 1 de enero → primer cobro el 1 de febrero; el 31 cae el último día en meses cortos).
-- Sin proyecto: desde "inicio", el día de cobro elegido.
create or replace function privado.generar_mensualidades()
returns int language plpgsql security definer set search_path = ''
as $$
declare
  meses text[] := array['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
  v_hoy date := privado.hoy();
  s record; m date; v date; v_desde date; v_dia int; k int; n int := 0;
begin
  for s in
    select sv.*, p.entregado_en, p.nombre as proyecto
      from public.servicios sv left join public.proyectos p on p.id = sv.proyecto_id
     where sv.estado = 'activo' and sv.monto_mensual > 0
  loop
    if s.proyecto_id is not null then
      continue when s.entregado_en is null;
      v_desde := (s.entregado_en + interval '1 month')::date;
      v_dia := extract(day from s.entregado_en)::int;
    else
      continue when s.dia_cobro is null;
      v_desde := coalesce(s.inicio, s.creado_en::date);
      v_dia := s.dia_cobro;
    end if;
    foreach m in array array[date_trunc('month', v_hoy)::date, (date_trunc('month', v_hoy) + interval '1 month')::date] loop
      v := m + (least(v_dia, extract(day from (m + interval '1 month' - interval '1 day'))::int) - 1);
      continue when v < v_desde or v > v_hoy + 25;
      insert into public.cobros (negocio_id, proyecto_id, servicio_id, concepto, monto, vence)
      values (s.negocio_id, s.proyecto_id, s.id,
              'Mensualidad ' || coalesce(nullif(trim(s.plan), ''),
                case s.tipo when 'web' then 'web' when 'mantenimiento' then 'mantenimiento' when 'seo' then 'SEO'
                            when 'redes' then 'redes sociales' when 'fidelizacion' then 'fidelización' else 'del servicio' end)
                || coalesce(' · ' || s.proyecto, '') || ' · ' || meses[extract(month from v)::int] || ' ' || extract(year from v),
              s.monto_mensual, v)
      on conflict (servicio_id, vence) where servicio_id is not null do nothing;
      get diagnostics k = row_count;
      n := n + k;
    end loop;
  end loop;
  return n;
end;
$$;

-- Si cambia la fecha de entrega (o se quita), las mensualidades sin pagar del proyecto se recalculan
create or replace function privado.proyecto_entregado()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.entregado_en is distinct from old.entregado_en then
    delete from public.cobros c using public.servicios s
     where c.servicio_id = s.id and s.proyecto_id = new.id and c.pagado_en is null and not c.anulado;
    perform privado.generar_mensualidades();
  end if;
  return new;
end;
$$;

create trigger proyecto_entregado
  after update of entregado_en on public.proyectos
  for each row execute function privado.proyecto_entregado();

-- ---------- Proyecto nuevo con su mensualidad de mantenimiento ----------
drop function public.crear_proyecto(uuid, text, numeric, date, date, boolean);
create function public.crear_proyecto(p_negocio uuid, p_nombre text, p_monto numeric, p_inicio date, p_entrega date,
                                      p_cobros boolean, p_mensualidad numeric default 0)
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
  if coalesce(p_mensualidad, 0) > 0 then
    insert into public.servicios (negocio_id, proyecto_id, tipo, plan, monto_mensual)
    values (p_negocio, v_id, 'mantenimiento', 'Mantenimiento web', p_mensualidad);
  end if;
  return v_id;
end;
$$;

revoke all on function privado.proyecto_entregado() from public, anon, authenticated;
revoke all on function public.crear_proyecto(uuid, text, numeric, date, date, boolean, numeric) from public, anon;
grant execute on function public.crear_proyecto(uuid, text, numeric, date, date, boolean, numeric) to authenticated;
