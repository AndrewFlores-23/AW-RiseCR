-- Portal AW-RiseCR · 0007 · El movimiento del Fondo AW dice a quién recomendó el cliente
-- (el cliente no puede leer el negocio recomendado por RLS, así que el nombre queda en la descripción)

create or replace function public.cargar_referido(p_proyecto uuid)
returns numeric language plpgsql security definer set search_path = ''
as $$
declare
  v_negocio uuid; v_nombre text; v_total numeric; v_entregado date; v_ref uuid;
  v_pagado numeric; v_previas int; v_monto numeric;
begin
  if not privado.es_admin() then raise exception 'Sin permiso'; end if;
  select p.negocio_id, p.monto_total, p.entregado_en into v_negocio, v_total, v_entregado
    from public.proyectos p where p.id = p_proyecto;
  if v_negocio is null then raise exception 'Proyecto no encontrado'; end if;
  select n.referido_por, n.nombre into v_ref, v_nombre from public.negocios n where n.id = v_negocio;
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
  values (v_ref, 'referido', v_monto, v_negocio, p_proyecto, 'Recomendaste a ' || v_nombre, privado.hoy() + interval '12 months');
  return v_monto;
end;
$$;
