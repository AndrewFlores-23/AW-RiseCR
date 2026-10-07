-- Portal AW-RiseCR · recuperar datos desde un respaldo (respaldar.py recuperar)
-- Recibe las filas del respaldo ya descifrado ({ tabla: [filas] }) y las vuelve a cargar con sus mismos ids.
--   · Solo agrega lo que falta: si una fila ya existe, no la toca (excepto perfiles, ver abajo).
--   · Mientras carga, apaga los disparadores del portal: así no se crean de nuevo la bienvenida, los cobros 50/50,
--     el crédito de bienvenida del Fondo AW ni registros de actividad. Las llaves foráneas sí se revisan.
--   · Perfiles: el programa solo manda los de usuarios recién recreados o desligados de su negocio; su perfil
--     (que se crea solo al crear el usuario) se reemplaza con el del respaldo (nombre, rol, negocio, activo…).
-- Solo la puede usar la llave de servicio (el programa de respaldos); nunca el navegador.

create or replace function public.restaurar_respaldo(p_datos jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  -- En orden de dependencias: cada tabla después de las tablas a las que apunta
  v_tablas text[] := array['negocios', 'perfiles', 'contactos', 'proyectos', 'servicios', 'bitacora', 'documentos',
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
    elsif v_tabla = 'actividad' then -- su id es de identidad: se conserva el del respaldo
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
  -- La numeración de la actividad sigue después de lo recuperado
  perform setval(pg_get_serial_sequence('public.actividad', 'id'), greatest((select max(id) from public.actividad), 1));
  return v_resultado;
end;
$$;
revoke all on function public.restaurar_respaldo(jsonb) from public, anon, authenticated;
grant execute on function public.restaurar_respaldo(jsonb) to service_role;
