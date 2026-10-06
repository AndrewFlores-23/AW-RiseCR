-- Portal AW-RiseCR · 0009 · Accesos de cada cliente (sin contraseñas)
-- Las contraseñas viven en Bitwarden. Aquí solo: servicio, proveedor, titular, usuario (cifrado), vencimiento
-- y, si hace falta, un enlace de Bitwarden Send para entregar la contraseña de forma segura.

-- Solo enlaces de Bitwarden (evita que un enlace falso o "javascript:" termine en el portal del cliente)
alter table public.accesos add constraint accesos_enlace_bitwarden
  check (enlace_bitwarden is null or enlace_bitwarden ~ '^https://([a-z0-9-]+\.)*bitwarden\.(com|eu)/');

-- Crea o actualiza un acceso en un solo paso, con el usuario cifrado
create or replace function public.guardar_acceso(
  p_id uuid, p_negocio uuid, p_proyecto uuid, p_servicio text, p_proveedor text, p_titular text,
  p_usuario text, p_vence date, p_estado text, p_enlace text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid := p_id;
begin
  if not privado.es_admin() then raise exception 'Sin permiso'; end if;
  if coalesce(trim(p_servicio), '') = '' then raise exception 'Falta el servicio'; end if;
  if v_id is null then
    insert into public.accesos (negocio_id, proyecto_id, servicio, proveedor, titular, usuario, vence, estado, enlace_bitwarden)
    values (p_negocio, p_proyecto, trim(p_servicio), nullif(trim(p_proveedor), ''), nullif(trim(p_titular), ''),
            privado.cifrar(nullif(trim(p_usuario), '')), p_vence, coalesce(p_estado, 'activo'), nullif(trim(p_enlace), ''))
    returning id into v_id;
  else
    update public.accesos
       set proyecto_id = p_proyecto, servicio = trim(p_servicio), proveedor = nullif(trim(p_proveedor), ''),
           titular = nullif(trim(p_titular), ''), usuario = privado.cifrar(nullif(trim(p_usuario), '')),
           vence = p_vence, estado = coalesce(p_estado, 'activo'), enlace_bitwarden = nullif(trim(p_enlace), '')
     where id = v_id and negocio_id = p_negocio;
    if not found then raise exception 'Acceso no encontrado'; end if;
  end if;
  return v_id;
end;
$$;

revoke all on function public.guardar_acceso(uuid, uuid, uuid, text, text, text, text, date, text, text) from public, anon;
grant execute on function public.guardar_acceso(uuid, uuid, uuid, text, text, text, text, date, text, text) to authenticated;
