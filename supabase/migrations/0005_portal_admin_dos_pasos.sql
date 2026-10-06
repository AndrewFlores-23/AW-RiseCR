-- Portal AW-RiseCR · 0005 · El administrador solo tiene permisos con verificación en dos pasos (aal2)
-- Si alguien obtiene la contraseña del admin pero no su celular, no puede leer ni escribir nada de los clientes.

create or replace function privado.es_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (
       select 1 from public.perfiles p
       where p.id = (select auth.uid()) and p.rol = 'admin' and p.activo
     );
$$;
