-- Portal AW-RiseCR · 0013 · Recorrido de bienvenida
-- La primera vez que un cliente entra, el portal le muestra un recorrido corto. Se guarda cuándo lo vio
-- (en la base de datos, no en el navegador): así no se repite aunque entre desde otro celular o computadora.
alter table public.perfiles add column tour_visto_en timestamptz;

-- Cada persona solo puede marcar su propio recorrido (los clientes no pueden editar su perfil directamente)
create or replace function public.marcar_tour_visto()
returns void language sql security definer set search_path = ''
as $$
  update public.perfiles set tour_visto_en = now()
   where id = (select auth.uid()) and tour_visto_en is null;
$$;
revoke all on function public.marcar_tour_visto() from public, anon;
grant execute on function public.marcar_tour_visto() to authenticated;
