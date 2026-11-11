-- ============================================================
-- AlfaBot — Usuario reconocido e historial
-- Cada usuario recibe una clave aleatoria (UUID). El navegador la guarda y la envía al empezar
-- otra evaluación: así la misma persona acumula su historial sin que nadie pueda verlo con solo
-- escribir su nombre (dos personas pueden llamarse igual).
-- Se puede ejecutar sobre una base que ya tenga 01, 02 y 04 cargados; no borra datos.
-- ============================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS clave UUID UNIQUE;

-- Consultar el historial de un usuario recorre sus evaluaciones de la más reciente a la más antigua.
CREATE INDEX IF NOT EXISTS idx_evaluaciones_usuario_fecha ON evaluaciones(usuario_id, fecha_inicio DESC);
