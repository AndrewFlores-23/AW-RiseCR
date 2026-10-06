-- Portal AW-RiseCR · 0011 · guardar_usuario_acceso quedó reemplazada por guardar_acceso (0009).
-- Se quita el permiso de ejecutarla: menos puertas abiertas en la API.
revoke execute on function public.guardar_usuario_acceso(uuid, text) from authenticated;
