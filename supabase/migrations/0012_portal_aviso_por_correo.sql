-- Portal AW-RiseCR · 0012 · Registro del aviso por correo de cada avance
-- La función avisar-avance marca cuándo se avisó y a cuántas personas (así no se avisa dos veces sin querer).
alter table public.bitacora add column avisado_en timestamptz;
alter table public.bitacora add column avisados int not null default 0;
