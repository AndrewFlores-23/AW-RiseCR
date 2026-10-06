-- Portal AW-RiseCR · 0001 · Tablas base, funciones de permisos y RLS
-- Cada cliente solo ve lo de su negocio; solo el administrador escribe.

create extension if not exists pgcrypto with schema extensions;

-- Esquema interno: no se expone por la API
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

-- ---------- Negocios y perfiles ----------
create table public.negocios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(trim(nombre)) > 0),
  nicho text,
  ciudad text,
  referido_por uuid references public.negocios(id) on delete set null,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo')),
  creado_en timestamptz not null default now()
);

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  negocio_id uuid references public.negocios(id) on delete set null,
  rol text not null default 'cliente' check (rol in ('admin', 'cliente')),
  nombre text not null default '',
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- Funciones de permisos (security definer para no depender de RLS al consultarse)
create or replace function privado.es_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.rol = 'admin' and p.activo
  );
$$;

create or replace function privado.mi_negocio()
returns uuid language sql stable security definer set search_path = ''
as $$
  select p.negocio_id from public.perfiles p
  where p.id = (select auth.uid()) and p.activo;
$$;

grant usage on schema privado to authenticated;
grant execute on function privado.es_admin(), privado.mi_negocio() to authenticated;

-- Al crear un usuario en Auth se crea su perfil como cliente (nunca admin)
create or replace function privado.crear_perfil()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.perfiles (id, nombre)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', ''));
  return new;
end;
$$;

create trigger al_crear_usuario
  after insert on auth.users
  for each row execute function privado.crear_perfil();

-- ---------- Servicios, proyectos y bitácora ----------
create table public.servicios (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  tipo text not null check (tipo in ('web', 'mantenimiento', 'seo', 'redes', 'fidelizacion', 'otro')),
  plan text,
  monto_mensual numeric(10, 2) check (monto_mensual >= 0),
  dia_cobro int check (dia_cobro between 1 and 28),
  estado text not null default 'activo' check (estado in ('activo', 'pausado', 'cancelado')),
  inicio date,
  creado_en timestamptz not null default now()
);

create table public.proyectos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  nombre text not null,
  monto_total numeric(10, 2) not null default 0 check (monto_total >= 0),
  etapa text not null default 'anticipo' check (etapa in ('anticipo', 'diseno', 'desarrollo', 'revision', 'publicada')),
  inicio date default current_date,
  entrega_estimada date,
  entregado_en date,
  creado_en timestamptz not null default now()
);

create table public.bitacora (
  id uuid primary key default gen_random_uuid(),
  proyecto_id uuid not null references public.proyectos(id) on delete cascade,
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  tipo text not null check (tipo in ('inicio', 'avance', 'captura', 'entregable', 'aprobacion', 'nota')),
  titulo text not null check (length(trim(titulo)) > 0),
  nota text,
  requiere_aprobacion boolean not null default false,
  aprobado_en timestamptz,
  aprobado_por uuid references auth.users(id) on delete set null,
  autor uuid default auth.uid() references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  tipo text not null check (tipo in ('bienvenida', 'propuesta', 'acuerdo', 'comprobante', 'otro')),
  titulo text not null,
  contenido jsonb,
  creado_en timestamptz not null default now()
);

create table public.adjuntos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  bitacora_id uuid references public.bitacora(id) on delete cascade,
  documento_id uuid references public.documentos(id) on delete cascade,
  ruta text not null unique,
  nombre text not null,
  tamano bigint,
  tipo_mime text,
  creado_en timestamptz not null default now(),
  check (bitacora_id is not null or documento_id is not null)
);

-- ---------- Cobros ----------
create table public.cobros (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  servicio_id uuid references public.servicios(id) on delete set null,
  concepto text not null,
  monto numeric(10, 2) not null check (monto > 0),
  vence date not null,
  pagado_en date,
  metodo text,
  anulado boolean not null default false,
  nota text,
  creado_en timestamptz not null default now()
);

-- ---------- Fondo AW ----------
create table public.fondo_movimientos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  tipo text not null check (tipo in ('bienvenida', 'referido', 'uso', 'vencimiento', 'ajuste')),
  monto numeric(10, 2) not null check (monto <> 0),
  referido_negocio_id uuid references public.negocios(id) on delete set null,
  proyecto_id uuid references public.proyectos(id) on delete set null,
  descripcion text,
  fecha date not null default current_date,
  vence date,
  creado_por uuid default auth.uid() references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
-- Una sola carga de referido por proyecto
create unique index fondo_un_referido_por_proyecto on public.fondo_movimientos (proyecto_id) where tipo = 'referido';

-- ---------- Accesos (sin contraseñas: esas van en Bitwarden) ----------
create table public.accesos (
  id uuid primary key default gen_random_uuid(),
  negocio_id uuid not null references public.negocios(id) on delete cascade,
  servicio text not null,
  proveedor text,
  titular text,
  vence date,
  estado text not null default 'activo' check (estado in ('activo', 'pendiente', 'vencido', 'inactivo')),
  enlace_bitwarden text,
  creado_en timestamptz not null default now()
);

-- ---------- Índices para las claves foráneas ----------
create index on public.perfiles (negocio_id);
create index on public.negocios (referido_por);
create index on public.servicios (negocio_id);
create index on public.proyectos (negocio_id);
create index on public.bitacora (proyecto_id, creado_en desc);
create index on public.bitacora (negocio_id);
create index on public.bitacora (aprobado_por);
create index on public.bitacora (autor);
create index on public.documentos (negocio_id);
create index on public.adjuntos (negocio_id);
create index on public.adjuntos (bitacora_id);
create index on public.adjuntos (documento_id);
create index on public.cobros (negocio_id, vence);
create index on public.cobros (proyecto_id);
create index on public.cobros (servicio_id);
create index on public.fondo_movimientos (negocio_id);
create index on public.fondo_movimientos (referido_negocio_id);
create index on public.fondo_movimientos (creado_por);
create index on public.accesos (negocio_id);

-- ---------- RLS ----------
alter table public.negocios enable row level security;
alter table public.perfiles enable row level security;
alter table public.servicios enable row level security;
alter table public.proyectos enable row level security;
alter table public.bitacora enable row level security;
alter table public.documentos enable row level security;
alter table public.adjuntos enable row level security;
alter table public.cobros enable row level security;
alter table public.fondo_movimientos enable row level security;
alter table public.accesos enable row level security;

-- Negocios: el cliente ve el suyo; el admin todo
create policy "ver negocio propio o admin" on public.negocios for select to authenticated
  using ((select privado.es_admin()) or id = (select privado.mi_negocio()));
create policy "admin escribe negocios" on public.negocios for all to authenticated
  using ((select privado.es_admin())) with check ((select privado.es_admin()));

-- Perfiles: cada quien ve el suyo; el admin todo; solo el admin los modifica
create policy "ver perfil propio o admin" on public.perfiles for select to authenticated
  using ((select privado.es_admin()) or id = (select auth.uid()));
create policy "admin modifica perfiles" on public.perfiles for update to authenticated
  using ((select privado.es_admin())) with check ((select privado.es_admin()));
create policy "admin borra perfiles" on public.perfiles for delete to authenticated
  using ((select privado.es_admin()));

-- Tablas por negocio: lectura del propio negocio, escritura solo admin
do $$
declare t text;
begin
  foreach t in array array['servicios', 'proyectos', 'bitacora', 'documentos', 'adjuntos', 'cobros', 'fondo_movimientos', 'accesos'] loop
    execute format(
      'create policy "ver lo de su negocio o admin" on public.%I for select to authenticated
         using ((select privado.es_admin()) or negocio_id = (select privado.mi_negocio()))', t);
    execute format(
      'create policy "admin escribe" on public.%I for all to authenticated
         using ((select privado.es_admin())) with check ((select privado.es_admin()))', t);
  end loop;
end $$;

-- Nadie anónimo toca nada
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;
