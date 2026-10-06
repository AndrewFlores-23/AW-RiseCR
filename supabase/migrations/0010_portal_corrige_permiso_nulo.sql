-- Portal AW-RiseCR · 0010 · Corrige el permiso de ver_contacto y accesos_de cuando mi_negocio() es nulo
-- Antes: "not (es_admin() or p_negocio = mi_negocio())". Si el usuario no tiene negocio activo
-- (admin sin dos pasos, cliente desactivado o sin negocio), la comparación da NULL, "not NULL" también da NULL
-- y el IF no lanzaba el error: se podían descifrar teléfono, correo y cédula de cualquier negocio.
-- Ahora lo desconocido cuenta como "sin permiso". Lo encontró la prueba de seguridad del 2026-10-05.

create or replace function privado.puede_ver(p_negocio uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(privado.es_admin() or (p_negocio is not null and p_negocio = privado.mi_negocio()), false);
$$;
revoke all on function privado.puede_ver(uuid) from public, anon;
grant execute on function privado.puede_ver(uuid) to authenticated;

create or replace function public.ver_contacto(p_negocio uuid)
returns table (telefono text, correo text, cedula text, notas_privadas text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not privado.puede_ver(p_negocio) then raise exception 'Sin permiso'; end if;
  return query
    select privado.descifrar(c.telefono), privado.descifrar(c.correo), privado.descifrar(c.cedula),
           case when privado.es_admin() then privado.descifrar(c.notas_privadas) end
    from public.contactos c where c.negocio_id = p_negocio;
end;
$$;

create or replace function public.accesos_de(p_negocio uuid)
returns table (id uuid, proyecto_id uuid, servicio text, proveedor text, titular text, usuario text, vence date, estado text, enlace_bitwarden text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not privado.puede_ver(p_negocio) then raise exception 'Sin permiso'; end if;
  return query
    select a.id, a.proyecto_id, a.servicio, a.proveedor, a.titular, privado.descifrar(a.usuario), a.vence, a.estado, a.enlace_bitwarden
    from public.accesos a where a.negocio_id = p_negocio order by a.servicio;
end;
$$;

revoke all on function public.ver_contacto(uuid), public.accesos_de(uuid) from public, anon;
grant execute on function public.ver_contacto(uuid), public.accesos_de(uuid) to authenticated;
