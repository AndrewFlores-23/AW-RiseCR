-- Portal AW-RiseCR · 0004 · Varios proyectos por cliente
-- Bitácora, cobros y adjuntos ya iban por proyecto. Ahora servicios, documentos y accesos
-- también pueden ligarse a un proyecto concreto (opcional: vacío = aplica a todo el negocio).

alter table public.servicios add column proyecto_id uuid references public.proyectos(id) on delete set null;
alter table public.documentos add column proyecto_id uuid references public.proyectos(id) on delete set null;
alter table public.accesos add column proyecto_id uuid references public.proyectos(id) on delete set null;

create index on public.servicios (proyecto_id);
create index on public.documentos (proyecto_id);
create index on public.accesos (proyecto_id);

-- Un proyecto ligado debe ser del mismo negocio
create or replace function privado.proyecto_del_mismo_negocio()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.proyecto_id is not null and not exists (
    select 1 from public.proyectos p where p.id = new.proyecto_id and p.negocio_id = new.negocio_id
  ) then
    raise exception 'El proyecto no pertenece a este negocio';
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['servicios', 'documentos', 'accesos', 'cobros', 'bitacora'] loop
    execute format('create trigger proyecto_mismo_negocio before insert or update on public.%I
                    for each row execute function privado.proyecto_del_mismo_negocio()', t);
  end loop;
end $$;

-- accesos_de ahora devuelve también el proyecto
drop function public.accesos_de(uuid);
create function public.accesos_de(p_negocio uuid)
returns table (id uuid, proyecto_id uuid, servicio text, proveedor text, titular text, usuario text, vence date, estado text, enlace_bitwarden text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not (privado.es_admin() or p_negocio = privado.mi_negocio()) then
    raise exception 'Sin permiso';
  end if;
  return query
    select a.id, a.proyecto_id, a.servicio, a.proveedor, a.titular, privado.descifrar(a.usuario), a.vence, a.estado, a.enlace_bitwarden
    from public.accesos a where a.negocio_id = p_negocio order by a.servicio;
end;
$$;
revoke all on function public.accesos_de(uuid) from public, anon;
grant execute on function public.accesos_de(uuid) to authenticated;
