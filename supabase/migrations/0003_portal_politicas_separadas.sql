-- Portal AW-RiseCR · 0003 · Separa las políticas de escritura del admin (insert/update/delete)
-- para que la lectura se evalúe con una sola política por tabla.

do $$
declare t text;
begin
  foreach t in array array['servicios', 'proyectos', 'bitacora', 'documentos', 'adjuntos', 'cobros', 'fondo_movimientos', 'accesos'] loop
    execute format('drop policy "admin escribe" on public.%I', t);
    execute format('create policy "admin inserta" on public.%I for insert to authenticated with check ((select privado.es_admin()))', t);
    execute format('create policy "admin actualiza" on public.%I for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()))', t);
    execute format('create policy "admin borra" on public.%I for delete to authenticated using ((select privado.es_admin()))', t);
  end loop;
end $$;

drop policy "admin escribe negocios" on public.negocios;
create policy "admin inserta negocios" on public.negocios for insert to authenticated with check ((select privado.es_admin()));
create policy "admin actualiza negocios" on public.negocios for update to authenticated using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "admin borra negocios" on public.negocios for delete to authenticated using ((select privado.es_admin()));

-- contactos: sin políticas a propósito; solo se accede por ver_contacto y guardar_contacto
comment on table public.contactos is 'Datos de contacto cifrados. Sin políticas RLS a propósito: acceso solo por las funciones ver_contacto y guardar_contacto.';
