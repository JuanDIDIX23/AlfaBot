-- ============================================================
-- AlfaBot — rol de la aplicación con permisos mínimos
-- La aplicación web NO debe conectarse con el usuario administrador del servidor.
-- Este rol puede leer la base de conocimiento y escribir solo en el sistema transaccional;
-- no puede borrar datos ni modificar el conocimiento. (El rol y su clave los crea tools/cargar_bd.ts.)
-- ============================================================

-- Base de conocimiento: solo lectura
GRANT SELECT ON modulos, nodos, ramas, reglas, hipotesis, verosimilitudes TO alfabot_app;

-- Sistema transaccional: leer, insertar y actualizar (sin DELETE)
GRANT SELECT, INSERT, UPDATE ON usuarios, evaluaciones, respuestas, inferencias, diagnosticos, progreso TO alfabot_app;

-- Las columnas SERIAL usan secuencias
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO alfabot_app;

-- Módulo de aprendizaje (04_aprendizaje.sql)
GRANT SELECT ON lecciones, lecciones_reglas TO alfabot_app;
GRANT SELECT, INSERT, UPDATE ON rutas, ruta_lecciones, intentos_ejercicio TO alfabot_app;
