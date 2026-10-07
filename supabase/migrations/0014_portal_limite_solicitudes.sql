-- Portal AW-RiseCR · límite de solicitudes a la base de datos (pre-request de PostgREST)
-- Cada escritura por la API (POST, PATCH, DELETE y las funciones RPC que escriben) pasa primero por limite.revisar():
--   · usuario con sesión: máximo 300 en 5 minutos (uso normal: unas pocas por minuto)
--   · sin sesión, por IP: máximo 30 en 5 minutos (el portal no escribe nada sin sesión)
-- Al pasar el tope responde 429 "Demasiadas solicitudes". Las lecturas (GET) no se pueden contar aquí porque corren en
-- transacciones de solo lectura; las protege RLS y el tiempo máximo por consulta (statement_timeout de 8 s).
-- La llave de servicio (funciones del servidor) no se limita.

create schema if not exists limite;
revoke all on schema limite from public;
grant usage on schema limite to anon, authenticated, service_role;

-- Registro corto de escrituras recientes (sin bitácora de cambios: es solo un contador, se limpia cada 10 minutos)
create unlogged table limite.solicitudes (
  clave text not null,
  en timestamptz not null default now()
);
create index solicitudes_clave_en on limite.solicitudes (clave, en desc);
alter table limite.solicitudes enable row level security; -- sin políticas: solo la función de abajo la toca
revoke all on limite.solicitudes from public, anon, authenticated;

create or replace function limite.revisar() returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_metodo text := current_setting('request.method', true);
  v_reclamos json;
  v_encabezados json;
  v_usuario text;
  v_clave text;
  v_tope int;
  v_recientes int := 0;
begin
  -- Lecturas y transacciones de solo lectura: no se cuentan
  if v_metodo is null or v_metodo in ('GET', 'HEAD', 'OPTIONS') or current_setting('transaction_read_only', true) = 'on' then
    return;
  end if;

  -- Si algo falla al contar, no se bloquea el portal
  begin
    v_reclamos := nullif(current_setting('request.jwt.claims', true), '')::json;
    if v_reclamos->>'role' = 'service_role' then return; end if; -- la llave de servicio no se limita
    v_encabezados := nullif(current_setting('request.headers', true), '')::json;
    v_usuario := v_reclamos->>'sub';
    if v_usuario is not null then
      v_clave := 'usuario:' || v_usuario; v_tope := 300;
    else
      v_clave := 'ip:' || coalesce(nullif(v_encabezados->>'cf-connecting-ip', ''), trim(split_part(v_encabezados->>'x-forwarded-for', ',', 1)), 'desconocida');
      v_tope := 30;
    end if;
    select count(*) into v_recientes from limite.solicitudes s
     where s.clave = v_clave and s.en > now() - interval '5 minutes';
    insert into limite.solicitudes (clave) values (v_clave);
  exception when others then
    return;
  end;

  if v_recientes >= v_tope then
    raise sqlstate 'PGRST' using
      message = json_build_object('code', 'limite_solicitudes', 'message', 'Demasiadas solicitudes seguidas. Espera unos minutos e inténtalo de nuevo.')::text,
      detail = json_build_object('status', 429, 'headers', json_build_object('Retry-After', '300'))::text;
  end if;
end;
$$;
revoke all on function limite.revisar() from public;
grant execute on function limite.revisar() to anon, authenticated, service_role;

alter role authenticator set pgrst.db_pre_request = 'limite.revisar';
notify pgrst, 'reload config';

-- Limpieza cada 10 minutos
select cron.schedule('portal-limpiar-limites', '*/10 * * * *', $$ delete from limite.solicitudes where en < now() - interval '10 minutes' $$);
