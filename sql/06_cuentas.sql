-- ============================================================
-- AlfaBot — Cuentas e inicio de sesión
-- Cada persona crea una cuenta con un nombre de usuario y un PIN de 4 números. El PIN nunca se
-- guarda: se guarda su huella (scrypt con sal). Tras 5 intentos fallidos la cuenta se bloquea
-- 15 minutos, para que nadie lo adivine probando.
-- Al entrar, el sistema entrega un token de sesión aleatorio; en la base solo queda su huella
-- (SHA-256), de modo que quien lea la tabla no puede usar las sesiones.
-- Se puede ejecutar sobre una base que ya tenga 01, 02, 04 y 05 cargados; no borra datos.
-- Las personas que usaron AlfaBot antes de las cuentas quedan como usuarios sin cuenta.
-- ============================================================

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS usuario VARCHAR(30) UNIQUE;          -- nombre para entrar, en minúsculas
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(200);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS intentos_fallidos INTEGER NOT NULL DEFAULT 0;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS bloqueado_hasta TIMESTAMP;

CREATE TABLE IF NOT EXISTS sesiones (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER     NOT NULL REFERENCES usuarios(id),
    token_hash      CHAR(64)    NOT NULL UNIQUE,
    fecha_creacion  TIMESTAMP   NOT NULL DEFAULT now(),
    expira          TIMESTAMP   NOT NULL,
    cerrada         BOOLEAN     NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_sesiones_usuario ON sesiones(usuario_id);

-- Si la base ya tiene el rol de la aplicación, se le dan los permisos de una vez (sin cambiar su clave).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'alfabot_app') THEN
        GRANT SELECT, INSERT, UPDATE ON sesiones TO alfabot_app;
        GRANT USAGE, SELECT ON SEQUENCE sesiones_id_seq TO alfabot_app;
    END IF;
END
$$;
