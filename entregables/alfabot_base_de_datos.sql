-- ============================================================
-- AlfaBot — script completo de creación y carga (PostgreSQL)
-- Generado con `npm run exportar-sql` a partir de: sql/01_conocimiento_y_transaccional.sql, sql/02_inferencia.sql, sql/04_aprendizaje.sql, sql/05_historial.sql, sql/06_cuentas.sql
-- Ejecutar sobre una base vacía, por ejemplo:  psql "$DATABASE_URL" -f alfabot_base_de_datos.sql
-- ============================================================

BEGIN;

-- >>>>>>>>>> sql/01_conocimiento_y_transaccional.sql

-- ============================================================
-- AlfaBot — Base de datos de conocimiento y sistema transaccional
-- SGBD: PostgreSQL (Supabase)
-- ============================================================

-- ============================================================
-- 1. ESQUEMA: BASE DE CONOCIMIENTO
-- ============================================================

CREATE TABLE modulos (
    id          SERIAL PRIMARY KEY,
    codigo      VARCHAR(2) NOT NULL UNIQUE,
    nombre      VARCHAR(100) NOT NULL,
    orden       INTEGER NOT NULL
);

CREATE TABLE nodos (
    id          SERIAL PRIMARY KEY,
    modulo_id   INTEGER NOT NULL REFERENCES modulos(id),
    codigo      VARCHAR(5) NOT NULL UNIQUE,
    pregunta    TEXT NOT NULL,
    orden       INTEGER NOT NULL
);

CREATE TABLE ramas (
    id                  SERIAL PRIMARY KEY,
    nodo_id             INTEGER NOT NULL REFERENCES nodos(id),
    codigo              VARCHAR(10) NOT NULL UNIQUE,
    condicion           TEXT NOT NULL,
    es_avance           BOOLEAN NOT NULL DEFAULT FALSE,
    siguiente_nodo_id   INTEGER REFERENCES nodos(id)
);

CREATE TABLE reglas (
    id              SERIAL PRIMARY KEY,
    rama_id         INTEGER NOT NULL UNIQUE REFERENCES ramas(id),
    codigo          VARCHAR(6) NOT NULL UNIQUE,
    condicion_texto TEXT NOT NULL,
    accion_texto    TEXT NOT NULL,
    tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('avance', 'remedial', 'fin'))
);

CREATE INDEX idx_nodos_modulo ON nodos(modulo_id);
CREATE INDEX idx_ramas_nodo ON ramas(nodo_id);
CREATE INDEX idx_reglas_tipo ON reglas(tipo);

-- ============================================================
-- 2. ESQUEMA: SISTEMA TRANSACCIONAL
-- ============================================================

CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    alias           VARCHAR(50) NOT NULL,
    fecha_registro  TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE evaluaciones (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id),
    fecha_inicio    TIMESTAMP NOT NULL DEFAULT now(),
    fecha_fin       TIMESTAMP,
    estado          VARCHAR(20) NOT NULL DEFAULT 'en_curso'
                        CHECK (estado IN ('en_curso', 'completada'))
);

CREATE TABLE respuestas (
    id              SERIAL PRIMARY KEY,
    evaluacion_id   INTEGER NOT NULL REFERENCES evaluaciones(id),
    nodo_id         INTEGER NOT NULL REFERENCES nodos(id),
    rama_id         INTEGER NOT NULL REFERENCES ramas(id),
    fecha           TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE diagnosticos (
    id              SERIAL PRIMARY KEY,
    evaluacion_id   INTEGER NOT NULL REFERENCES evaluaciones(id),
    modulo_id       INTEGER NOT NULL REFERENCES modulos(id),
    regla_id        INTEGER NOT NULL REFERENCES reglas(id),
    fecha           TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE progreso (
    id                      SERIAL PRIMARY KEY,
    usuario_id              INTEGER NOT NULL REFERENCES usuarios(id),
    modulo_id               INTEGER NOT NULL REFERENCES modulos(id),
    estado                  VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                                CHECK (estado IN ('pendiente', 'en_curso', 'superado')),
    fecha_actualizacion     TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, modulo_id)
);

CREATE INDEX idx_evaluaciones_usuario ON evaluaciones(usuario_id);
CREATE INDEX idx_respuestas_evaluacion ON respuestas(evaluacion_id);
CREATE INDEX idx_diagnosticos_evaluacion ON diagnosticos(evaluacion_id);
CREATE INDEX idx_progreso_usuario ON progreso(usuario_id);

-- ============================================================
-- 3. CARGA DEL CONOCIMIENTO DEL EXPERTO HUMANO
--    (resultado del levantamiento de información)
-- ============================================================

-- 3.1 Módulos
INSERT INTO modulos (id, codigo, nombre, orden) VALUES
    (1, 'A', 'Reconocimiento de letras', 1),
    (2, 'B', 'Conciencia silábica', 2),
    (3, 'C', 'Lectura de palabras y oraciones', 3),
    (4, 'D', 'Comprensión y escritura', 4);

-- 3.2 Nodos (preguntas de diagnóstico)
INSERT INTO nodos (id, modulo_id, codigo, pregunta, orden) VALUES
    (1, 1, 'A1', '¿Reconoce las vocales (a, e, i, o, u)?', 1),
    (2, 1, 'A2', '¿Reconoce consonantes de alta frecuencia (m, p, s, l, t)?', 2),
    (3, 1, 'A3', '¿Diferencia mayúsculas de minúsculas?', 3),
    (4, 2, 'B1', '¿Reconoce sílabas directas (consonante+vocal: ma, pe, si)?', 1),
    (5, 2, 'B2', '¿Reconoce sílabas inversas (vocal+consonante: al, es, un)?', 2),
    (6, 2, 'B3', '¿Reconoce sílabas mixtas (consonante-vocal-consonante: pan, sol)?', 3),
    (7, 2, 'B4', '¿Reconoce sílabas trabadas (bl, br, cl, pr, tr)?', 4),
    (8, 3, 'C1', '¿Lee palabras cortas (2-3 sílabas) con fluidez?', 1),
    (9, 3, 'C2', '¿Lee palabras largas (4 o más sílabas)?', 2),
    (10, 3, 'C3', '¿Lee oraciones simples?', 3),
    (11, 4, 'D1', '¿Comprende lo que lee (comprensión literal)?', 1),
    (12, 4, 'D2', '¿Realiza inferencias simples sobre el texto?', 2),
    (13, 4, 'D3', '¿Escribe letras y palabras de forma legible?', 3),
    (14, 4, 'D4', '¿Escribe oraciones completas con sentido?', 4);

-- 3.3 Ramas (condiciones de respuesta)
INSERT INTO ramas (id, nodo_id, codigo, condicion, es_avance, siguiente_nodo_id) VALUES
    (1, 1, 'A1.1', 'No reconoce ninguna vocal', FALSE, NULL),
    (2, 1, 'A1.2', 'Reconoce entre 1 y 3 vocales', FALSE, NULL),
    (3, 1, 'A1.3', 'Reconoce las 5 vocales', TRUE, 2),
    (4, 2, 'A2.1', 'No reconoce ninguna consonante frecuente', FALSE, NULL),
    (5, 2, 'A2.2', 'Confunde b con d', FALSE, NULL),
    (6, 2, 'A2.3', 'Confunde p con q', FALSE, NULL),
    (7, 2, 'A2.4', 'Confunde m con n', FALSE, NULL),
    (8, 2, 'A2.5', 'Reconoce correctamente las consonantes frecuentes', TRUE, 3),
    (9, 3, 'A3.1', 'No diferencia mayúsculas de minúsculas', FALSE, NULL),
    (10, 3, 'A3.2', 'Diferencia mayúsculas de minúsculas', TRUE, 4),
    (11, 4, 'B1.1', 'No reconoce sílabas directas', FALSE, NULL),
    (12, 4, 'B1.2', 'Reconoce solo sílabas con consonantes muy frecuentes', FALSE, NULL),
    (13, 4, 'B1.3', 'Reconoce sílabas directas en general', TRUE, 5),
    (14, 5, 'B2.1', 'No reconoce sílabas inversas', FALSE, NULL),
    (15, 5, 'B2.2', 'Reconoce sílabas inversas', TRUE, 6),
    (16, 6, 'B3.1', 'No reconoce sílabas mixtas', FALSE, NULL),
    (17, 6, 'B3.2', 'Reconoce sílabas mixtas', TRUE, 7),
    (18, 7, 'B4.1', 'No reconoce sílabas trabadas', FALSE, NULL),
    (19, 7, 'B4.2', 'Confunde trabadas similares (bl/br)', FALSE, NULL),
    (20, 7, 'B4.3', 'Reconoce sílabas trabadas', TRUE, 8),
    (21, 8, 'C1.1', 'Decodifica letra por letra sin unir la palabra', FALSE, NULL),
    (22, 8, 'C1.2', 'Lee lento y sin fluidez', FALSE, NULL),
    (23, 8, 'C1.3', 'Lee palabras cortas con fluidez', TRUE, 9),
    (24, 9, 'C2.1', 'No logra leer palabras largas', FALSE, NULL),
    (25, 9, 'C2.2', 'Lee palabras largas con dificultad', FALSE, NULL),
    (26, 9, 'C2.3', 'Lee palabras largas correctamente', TRUE, 10),
    (27, 10, 'C3.1', 'No logra unir palabras en una oración', FALSE, NULL),
    (28, 10, 'C3.2', 'Lee oraciones con pausas excesivas', FALSE, NULL),
    (29, 10, 'C3.3', 'Lee oraciones con fluidez', TRUE, 11),
    (30, 11, 'D1.1', 'No comprende aunque decodifica correctamente', FALSE, NULL),
    (31, 11, 'D1.2', 'Comprende parcialmente el texto', FALSE, NULL),
    (32, 11, 'D1.3', 'Comprende el texto correctamente', TRUE, 12),
    (33, 12, 'D2.1', 'No realiza inferencias', FALSE, NULL),
    (34, 12, 'D2.2', 'Realiza inferencias simples', TRUE, 13),
    (35, 13, 'D3.1', 'Escritura no legible', FALSE, NULL),
    (36, 13, 'D3.2', 'Escribe con errores ortográficos frecuentes', FALSE, NULL),
    (37, 13, 'D3.3', 'Escribe letras y palabras de forma legible', TRUE, 14),
    (38, 14, 'D4.1', 'No logra estructurar una oración', FALSE, NULL),
    (39, 14, 'D4.2', 'Escribe oraciones con errores de concordancia', FALSE, NULL),
    (40, 14, 'D4.3', 'Escribe oraciones correctamente', FALSE, NULL);

-- 3.4 Reglas (gránulos de conocimiento: SI condición ENTONCES acción)
INSERT INTO reglas (id, rama_id, codigo, condicion_texto, accion_texto, tipo) VALUES
    (1, 1, 'R1', 'No reconoce ninguna vocal', 'iniciar con actividades de asociación imagen-vocal (reconocimiento visual)', 'remedial'),
    (2, 2, 'R2', 'Reconoce entre 1 y 3 vocales', 'reforzar las vocales faltantes mediante repetición y trazo guiado', 'remedial'),
    (3, 3, 'R3', 'Reconoce las 5 vocales', 'avanzar a la evaluación de consonantes de alta frecuencia', 'avance'),
    (4, 4, 'R4', 'No reconoce ninguna consonante frecuente', 'iniciar reconocimiento de consonantes de alta frecuencia con apoyo visual (tarjetas ilustradas)', 'remedial'),
    (5, 5, 'R5', 'Confunde b con d', 'aplicar ejercicios de discriminación visual orientados a la orientación espacial de las letras', 'remedial'),
    (6, 6, 'R6', 'Confunde p con q', 'aplicar ejercicios de discriminación visual p/q con apoyo de trazo direccional', 'remedial'),
    (7, 7, 'R7', 'Confunde m con n', 'aplicar ejercicios de discriminación auditiva y conteo de trazos', 'remedial'),
    (8, 8, 'R8', 'Reconoce correctamente las consonantes frecuentes', 'avanzar al módulo de conciencia silábica', 'avance'),
    (9, 9, 'R9', 'No diferencia mayúsculas de minúsculas', 'aplicar actividades de emparejamiento mayúscula-minúscula', 'remedial'),
    (10, 10, 'R10', 'Diferencia mayúsculas de minúsculas', 'continuar con el proceso normal de evaluación', 'avance'),
    (11, 11, 'R11', 'No reconoce sílabas directas', 'iniciar formación de sílabas directas mediante el método silábico clásico', 'remedial'),
    (12, 12, 'R12', 'Reconoce solo sílabas con consonantes muy frecuentes', 'reforzar sílabas con consonantes de menor frecuencia (f, r, g, j)', 'remedial'),
    (13, 13, 'R13', 'Reconoce sílabas directas en general', 'avanzar a sílabas inversas', 'avance'),
    (14, 14, 'R14', 'No reconoce sílabas inversas', 'practicar sílabas inversas usando palabras familiares del entorno del usuario', 'remedial'),
    (15, 15, 'R15', 'Reconoce sílabas inversas', 'avanzar a sílabas mixtas', 'avance'),
    (16, 16, 'R16', 'No reconoce sílabas mixtas', 'practicar sílabas mixtas con apoyo de imágenes y palabras cotidianas', 'remedial'),
    (17, 17, 'R17', 'Reconoce sílabas mixtas', 'avanzar a sílabas trabadas', 'avance'),
    (18, 18, 'R18', 'No reconoce sílabas trabadas', 'aplicar ejercicios progresivos comenzando por las trabadas más frecuentes (''pr'', ''tr'')', 'remedial'),
    (19, 19, 'R19', 'Confunde trabadas similares (bl/br)', 'aplicar ejercicios de discriminación auditiva específicos', 'remedial'),
    (20, 20, 'R20', 'Reconoce sílabas trabadas', 'avanzar al módulo de lectura de palabras y oraciones', 'avance'),
    (21, 21, 'R21', 'Decodifica letra por letra sin unir la palabra', 'aplicar el método de palabra generadora, iniciando con palabras significativas y cortas', 'remedial'),
    (22, 22, 'R22', 'Lee lento y sin fluidez', 'aplicar ejercicios de lectura repetida cronometrada', 'remedial'),
    (23, 23, 'R23', 'Lee palabras cortas con fluidez', 'avanzar a palabras largas', 'avance'),
    (24, 24, 'R24', 'No logra leer palabras largas', 'descomponer la palabra en sílabas antes de solicitar la unión completa', 'remedial'),
    (25, 25, 'R25', 'Lee palabras largas con dificultad', 'practicar segmentación silábica progresiva de palabras largas', 'remedial'),
    (26, 26, 'R26', 'Lee palabras largas correctamente', 'avanzar a lectura de oraciones', 'avance'),
    (27, 27, 'R27', 'No logra unir palabras en una oración', 'practicar lectura de oraciones cortas con apoyo de tarjetas visuales', 'remedial'),
    (28, 28, 'R28', 'Lee oraciones con pausas excesivas', 'aplicar ejercicios de fluidez y entonación', 'remedial'),
    (29, 29, 'R29', 'Lee oraciones con fluidez', 'avanzar al módulo de comprensión y escritura', 'avance'),
    (30, 30, 'R30', 'No comprende aunque decodifica correctamente', 'enfocar el trabajo en comprensión mediante preguntas literales sobre el texto leído', 'remedial'),
    (31, 31, 'R31', 'Comprende parcialmente el texto', 'reforzar vocabulario y aplicar relectura guiada', 'remedial'),
    (32, 32, 'R32', 'Comprende el texto correctamente', 'avanzar a inferencia de texto', 'avance'),
    (33, 33, 'R33', 'No realiza inferencias', 'aplicar ejercicios de predicción e inferencia con preguntas guía', 'remedial'),
    (34, 34, 'R34', 'Realiza inferencias simples', 'avanzar a la evaluación de escritura', 'avance'),
    (35, 35, 'R35', 'Escritura no legible', 'aplicar ejercicios de trazo y grafomotricidad', 'remedial'),
    (36, 36, 'R36', 'Escribe con errores ortográficos frecuentes', 'aplicar ejercicios de dictado y autocorrección', 'remedial'),
    (37, 37, 'R37', 'Escribe letras y palabras de forma legible', 'avanzar a escritura de oraciones', 'avance'),
    (38, 38, 'R38', 'No logra estructurar una oración', 'aplicar ejercicios de construcción de oraciones con tarjetas de palabras móviles', 'remedial'),
    (39, 39, 'R39', 'Escribe oraciones con errores de concordancia', 'aplicar ejercicios específicos de concordancia gramatical', 'remedial'),
    (40, 40, 'R40', 'Escribe oraciones correctamente', 'finalizar el proceso de alfabetización básica y recomendar continuidad hacia comprensión avanzada (el propio sistema presenta el plan consolidado, sin intervención externa)', 'fin');

-- ============================================================
-- 4. CONSULTAS DE GRÁNULOS DE CONOCIMIENTO POR HIPÓTESIS
-- ============================================================

-- 4.1 Hipótesis: "el usuario confunde letras visualmente similares"
-- Recupera los gránulos de conocimiento (reglas) cuya condición
-- corresponde a esa hipótesis diagnóstica.
SELECT r.codigo, r.condicion_texto, r.accion_texto
FROM reglas r
WHERE r.condicion_texto ILIKE '%confunde%';

-- 4.2 Hipótesis: "el usuario está en el nivel de sílabas trabadas"
-- Recupera todas las reglas (gránulos) asociadas al nodo correspondiente.
SELECT ra.codigo AS rama, r.codigo AS regla, r.condicion_texto, r.accion_texto
FROM reglas r
JOIN ramas ra ON ra.id = r.rama_id
JOIN nodos n ON n.id = ra.nodo_id
WHERE n.codigo = 'B4';

-- 4.3 Hipótesis: "el usuario completó el módulo de comprensión y escritura"
-- Recupera la regla terminal (tipo = 'fin') que cierra el proceso.
SELECT r.codigo, r.condicion_texto, r.accion_texto
FROM reglas r
WHERE r.tipo = 'fin';

-- 4.4 Gránulos de conocimiento de tipo remedial por módulo
-- (apoya la hipótesis "¿qué intervenciones existen en el módulo X?")
SELECT m.codigo AS modulo, COUNT(*) AS reglas_remediales
FROM reglas r
JOIN ramas ra ON ra.id = r.rama_id
JOIN nodos n ON n.id = ra.nodo_id
JOIN modulos m ON m.id = n.modulo_id
WHERE r.tipo = 'remedial'
GROUP BY m.codigo
ORDER BY m.codigo;

-- 4.5 Ruta de inferencia completa: dada una rama específica (hipótesis puntual),
-- obtener el nodo, el módulo y la regla activada (trazabilidad de la inferencia).
SELECT mo.nombre AS modulo, n.pregunta, ra.condicion, r.accion_texto
FROM ramas ra
JOIN nodos n ON n.id = ra.nodo_id
JOIN modulos mo ON mo.id = n.modulo_id
JOIN reglas r ON r.rama_id = ra.id
WHERE ra.codigo = 'A2.2';

-- ============================================================
-- 5. CONSULTAS TRANSACCIONALES DE EJEMPLO
-- ============================================================

-- 5.1 Historial de progreso de un usuario (todos los módulos)
SELECT m.nombre AS modulo, p.estado, p.fecha_actualizacion
FROM progreso p
JOIN modulos m ON m.id = p.modulo_id
WHERE p.usuario_id = 1
ORDER BY m.orden;

-- 5.2 Diagnóstico consolidado de la última evaluación completada de un usuario
SELECT mo.nombre AS modulo, r.codigo AS regla, r.accion_texto AS recomendacion
FROM diagnosticos d
JOIN evaluaciones e ON e.id = d.evaluacion_id
JOIN modulos mo ON mo.id = d.modulo_id
JOIN reglas r ON r.id = d.regla_id
WHERE e.usuario_id = 1 AND e.estado = 'completada'
ORDER BY e.fecha_fin DESC, mo.orden
LIMIT 4;

-- >>>>>>>>>> sql/02_inferencia.sql

-- ============================================================
-- AlfaBot — Sistema de inferencia bayesiano
-- Tablas nuevas, las 5 hipótesis y las verosimilitudes P(rama | hipótesis)
-- (generado por tools/gen_verosimilitudes.py)
-- ============================================================

-- Base de conocimiento -----------------------------------------
CREATE TABLE hipotesis (
    id           SERIAL PRIMARY KEY,
    codigo       VARCHAR(3)   NOT NULL UNIQUE,
    nombre       VARCHAR(80)  NOT NULL,
    descripcion  TEXT         NOT NULL,
    nivel        INTEGER      NOT NULL UNIQUE,   -- se compara contra modulos.orden
    prior        NUMERIC(5,4) NOT NULL CHECK (prior > 0 AND prior < 1)
);

CREATE TABLE verosimilitudes (
    rama_id       INTEGER      NOT NULL REFERENCES ramas(id),
    hipotesis_id  INTEGER      NOT NULL REFERENCES hipotesis(id),
    probabilidad  NUMERIC(5,4) NOT NULL CHECK (probabilidad > 0 AND probabilidad <= 1),
    PRIMARY KEY (rama_id, hipotesis_id)
);
CREATE INDEX idx_verosimilitudes_hipotesis ON verosimilitudes(hipotesis_id);

-- Sistema transaccional ----------------------------------------
CREATE TABLE inferencias (
    id             SERIAL PRIMARY KEY,
    evaluacion_id  INTEGER       NOT NULL REFERENCES evaluaciones(id),
    paso           INTEGER       NOT NULL,           -- 0 = probabilidades a priori
    hipotesis_id   INTEGER       NOT NULL REFERENCES hipotesis(id),
    rama_id        INTEGER       REFERENCES ramas(id), -- respuesta que originó el paso
    probabilidad   NUMERIC(7,6)  NOT NULL,
    UNIQUE (evaluacion_id, paso, hipotesis_id)
);
CREATE INDEX idx_inferencias_evaluacion ON inferencias(evaluacion_id);

INSERT INTO hipotesis (id, codigo, nombre, descripcion, nivel, prior) VALUES
    (1, 'H1', 'Reconocimiento de letras', 'El usuario aún no domina las letras: vocales, consonantes frecuentes o la diferencia entre mayúsculas y minúsculas.', 1, 0.2),
    (2, 'H2', 'Conciencia silábica', 'El usuario reconoce las letras pero todavía no forma sílabas directas, inversas, mixtas o trabadas.', 2, 0.2),
    (3, 'H3', 'Lectura de palabras y oraciones', 'El usuario forma sílabas pero todavía no lee palabras y oraciones con fluidez.', 3, 0.2),
    (4, 'H4', 'Comprensión y escritura', 'El usuario lee con fluidez pero aún no comprende, infiere o escribe oraciones correctamente.', 4, 0.2),
    (5, 'H5', 'Alfabetización básica lograda', 'El usuario supera todos los módulos de diagnóstico.', 5, 0.2);

-- Verosimilitudes: 200 filas (40 ramas x 5 hipótesis)
INSERT INTO verosimilitudes (rama_id, hipotesis_id, probabilidad) VALUES
    (1, 1, 0.3250),
    (1, 2, 0.0400),
    (1, 3, 0.0400),
    (1, 4, 0.0400),
    (1, 5, 0.0400),
    (2, 1, 0.3250),
    (2, 2, 0.0400),
    (2, 3, 0.0400),
    (2, 4, 0.0400),
    (2, 5, 0.0400),
    (3, 1, 0.3500),
    (3, 2, 0.9200),
    (3, 3, 0.9200),
    (3, 4, 0.9200),
    (3, 5, 0.9200),
    (4, 1, 0.1938),
    (4, 2, 0.0200),
    (4, 3, 0.0200),
    (4, 4, 0.0200),
    (4, 5, 0.0200),
    (5, 1, 0.1938),
    (5, 2, 0.0200),
    (5, 3, 0.0200),
    (5, 4, 0.0200),
    (5, 5, 0.0200),
    (6, 1, 0.1938),
    (6, 2, 0.0200),
    (6, 3, 0.0200),
    (6, 4, 0.0200),
    (6, 5, 0.0200),
    (7, 1, 0.1938),
    (7, 2, 0.0200),
    (7, 3, 0.0200),
    (7, 4, 0.0200),
    (7, 5, 0.0200),
    (8, 1, 0.2248),
    (8, 2, 0.9200),
    (8, 3, 0.9200),
    (8, 4, 0.9200),
    (8, 5, 0.9200),
    (9, 1, 0.9000),
    (9, 2, 0.0800),
    (9, 3, 0.0800),
    (9, 4, 0.0800),
    (9, 5, 0.0800),
    (10, 1, 0.1000),
    (10, 2, 0.9200),
    (10, 3, 0.9200),
    (10, 4, 0.9200),
    (10, 5, 0.9200),
    (11, 1, 0.7200),
    (11, 2, 0.3250),
    (11, 3, 0.0400),
    (11, 4, 0.0400),
    (11, 5, 0.0400),
    (12, 1, 0.2400),
    (12, 2, 0.3250),
    (12, 3, 0.0400),
    (12, 4, 0.0400),
    (12, 5, 0.0400),
    (13, 1, 0.0400),
    (13, 2, 0.3500),
    (13, 3, 0.9200),
    (13, 4, 0.9200),
    (13, 5, 0.9200),
    (14, 1, 0.9600),
    (14, 2, 0.7333),
    (14, 3, 0.0800),
    (14, 4, 0.0800),
    (14, 5, 0.0800),
    (15, 1, 0.0400),
    (15, 2, 0.2667),
    (15, 3, 0.9200),
    (15, 4, 0.9200),
    (15, 5, 0.9200),
    (16, 1, 0.9600),
    (16, 2, 0.8167),
    (16, 3, 0.0800),
    (16, 4, 0.0800),
    (16, 5, 0.0800),
    (17, 1, 0.0400),
    (17, 2, 0.1833),
    (17, 3, 0.9200),
    (17, 4, 0.9200),
    (17, 5, 0.9200),
    (18, 1, 0.7200),
    (18, 2, 0.4500),
    (18, 3, 0.0400),
    (18, 4, 0.0400),
    (18, 5, 0.0400),
    (19, 1, 0.2400),
    (19, 2, 0.4500),
    (19, 3, 0.0400),
    (19, 4, 0.0400),
    (19, 5, 0.0400),
    (20, 1, 0.0400),
    (20, 2, 0.1000),
    (20, 3, 0.9200),
    (20, 4, 0.9200),
    (20, 5, 0.9200),
    (21, 1, 0.7200),
    (21, 2, 0.7200),
    (21, 3, 0.3250),
    (21, 4, 0.0400),
    (21, 5, 0.0400),
    (22, 1, 0.2400),
    (22, 2, 0.2400),
    (22, 3, 0.3250),
    (22, 4, 0.0400),
    (22, 5, 0.0400),
    (23, 1, 0.0400),
    (23, 2, 0.0400),
    (23, 3, 0.3500),
    (23, 4, 0.9200),
    (23, 5, 0.9200),
    (24, 1, 0.7200),
    (24, 2, 0.7200),
    (24, 3, 0.3875),
    (24, 4, 0.0400),
    (24, 5, 0.0400),
    (25, 1, 0.2400),
    (25, 2, 0.2400),
    (25, 3, 0.3875),
    (25, 4, 0.0400),
    (25, 5, 0.0400),
    (26, 1, 0.0400),
    (26, 2, 0.0400),
    (26, 3, 0.2250),
    (26, 4, 0.9200),
    (26, 5, 0.9200),
    (27, 1, 0.7200),
    (27, 2, 0.7200),
    (27, 3, 0.4500),
    (27, 4, 0.0400),
    (27, 5, 0.0400),
    (28, 1, 0.2400),
    (28, 2, 0.2400),
    (28, 3, 0.4500),
    (28, 4, 0.0400),
    (28, 5, 0.0400),
    (29, 1, 0.0400),
    (29, 2, 0.0400),
    (29, 3, 0.1000),
    (29, 4, 0.9200),
    (29, 5, 0.9200),
    (30, 1, 0.7200),
    (30, 2, 0.7200),
    (30, 3, 0.7200),
    (30, 4, 0.3250),
    (30, 5, 0.0400),
    (31, 1, 0.2400),
    (31, 2, 0.2400),
    (31, 3, 0.2400),
    (31, 4, 0.3250),
    (31, 5, 0.0400),
    (32, 1, 0.0400),
    (32, 2, 0.0400),
    (32, 3, 0.0400),
    (32, 4, 0.3500),
    (32, 5, 0.9200),
    (33, 1, 0.9600),
    (33, 2, 0.9600),
    (33, 3, 0.9600),
    (33, 4, 0.7333),
    (33, 5, 0.0800),
    (34, 1, 0.0400),
    (34, 2, 0.0400),
    (34, 3, 0.0400),
    (34, 4, 0.2667),
    (34, 5, 0.9200),
    (35, 1, 0.7200),
    (35, 2, 0.7200),
    (35, 3, 0.7200),
    (35, 4, 0.4084),
    (35, 5, 0.0400),
    (36, 1, 0.2400),
    (36, 2, 0.2400),
    (36, 3, 0.2400),
    (36, 4, 0.4083),
    (36, 5, 0.0400),
    (37, 1, 0.0400),
    (37, 2, 0.0400),
    (37, 3, 0.0400),
    (37, 4, 0.1833),
    (37, 5, 0.9200),
    (38, 1, 0.7200),
    (38, 2, 0.7200),
    (38, 3, 0.7200),
    (38, 4, 0.4500),
    (38, 5, 0.0400),
    (39, 1, 0.2400),
    (39, 2, 0.2400),
    (39, 3, 0.2400),
    (39, 4, 0.4500),
    (39, 5, 0.0400),
    (40, 1, 0.0400),
    (40, 2, 0.0400),
    (40, 3, 0.0400),
    (40, 4, 0.1000),
    (40, 5, 0.9200);

-- Verificación: para cada nodo e hipótesis, las probabilidades de sus ramas deben sumar 1
-- (esta consulta debe devolver 0 filas)
-- SELECT ra.nodo_id, v.hipotesis_id, SUM(v.probabilidad)
-- FROM verosimilitudes v JOIN ramas ra ON ra.id = v.rama_id
-- GROUP BY ra.nodo_id, v.hipotesis_id
-- HAVING ABS(SUM(v.probabilidad) - 1) > 0.0001;

-- >>>>>>>>>> sql/04_aprendizaje.sql

-- ============================================================
-- AlfaBot — Módulo de aprendizaje
-- Convierte el diagnóstico en una ruta de lecciones con ejercicios que la persona practica en la
-- página. Las lecciones son conocimiento del experto (qué se enseña para cada regla remedial);
-- los ejercicios concretos los arma la capa de negocio en cada ronda (src/negocio/aprendizaje).
-- Se puede ejecutar sobre una base que ya tenga 01 y 02 cargados.
-- ============================================================

-- Base de conocimiento -----------------------------------------
CREATE TABLE lecciones (
    id              SERIAL PRIMARY KEY,
    modulo_id       INTEGER      NOT NULL REFERENCES modulos(id),
    codigo          VARCHAR(5)   NOT NULL UNIQUE,
    titulo          VARCHAR(80)  NOT NULL,
    explicacion     TEXT         NOT NULL,          -- se muestra y se lee en voz alta antes de practicar
    tipo_ejercicio  VARCHAR(30)  NOT NULL,          -- generador que arma los ejercicios
    parametros      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    orden           INTEGER      NOT NULL,
    UNIQUE (modulo_id, orden)
);

-- Qué lección atiende cada regla remedial (gránulo SI condición ENTONCES practicar lección)
CREATE TABLE lecciones_reglas (
    leccion_id  INTEGER NOT NULL REFERENCES lecciones(id),
    regla_id    INTEGER NOT NULL REFERENCES reglas(id),
    PRIMARY KEY (leccion_id, regla_id)
);
CREATE INDEX idx_lecciones_reglas_regla ON lecciones_reglas(regla_id);

-- Sistema transaccional ----------------------------------------
-- Una ruta por evaluación terminada. La clave es aleatoria: es lo que el navegador guarda para
-- volver a la ruta sin exponer los identificadores consecutivos.
CREATE TABLE rutas (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER     NOT NULL REFERENCES usuarios(id),
    evaluacion_id   INTEGER     NOT NULL UNIQUE REFERENCES evaluaciones(id),
    clave           UUID        NOT NULL UNIQUE,
    fecha_creacion  TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE TABLE ruta_lecciones (
    id              SERIAL PRIMARY KEY,
    ruta_id         INTEGER     NOT NULL REFERENCES rutas(id),
    leccion_id      INTEGER     NOT NULL REFERENCES lecciones(id),
    orden           INTEGER     NOT NULL,
    regla_id        INTEGER     REFERENCES reglas(id),   -- regla remedial que la puso en la ruta (NULL = siguiente paso del módulo)
    estado          VARCHAR(12) NOT NULL DEFAULT 'bloqueada'
                        CHECK (estado IN ('bloqueada', 'disponible', 'superada')),
    origen          VARCHAR(12) NOT NULL DEFAULT 'modulo'
                        CHECK (origen IN ('refuerzo', 'modulo', 'diagnostico', 'repaso')),
    rondas          INTEGER     NOT NULL DEFAULT 0,
    aciertos        INTEGER     NOT NULL DEFAULT 0,
    intentos        INTEGER     NOT NULL DEFAULT 0,
    fecha_actualizacion TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE (ruta_id, leccion_id),
    UNIQUE (ruta_id, orden)
);
CREATE INDEX idx_ruta_lecciones_ruta ON ruta_lecciones(ruta_id);

-- Cada ejercicio resuelto: qué se practicó (objetivo: una letra, sílaba, palabra...) y si acertó.
-- Con esto el generador repite más lo que a la persona le cuesta.
CREATE TABLE intentos_ejercicio (
    id                 SERIAL PRIMARY KEY,
    ruta_leccion_id    INTEGER     NOT NULL REFERENCES ruta_lecciones(id),
    objetivo           VARCHAR(40) NOT NULL,
    correcto           BOOLEAN     NOT NULL,
    fecha              TIMESTAMP   NOT NULL DEFAULT now()
);
CREATE INDEX idx_intentos_ruta_leccion ON intentos_ejercicio(ruta_leccion_id, id DESC);

-- ============================================================
-- Lecciones (conocimiento del experto)
-- tipo_ejercicio y parametros los interpreta src/negocio/aprendizaje/GeneradorEjercicios.ts
-- ============================================================
INSERT INTO lecciones (id, modulo_id, codigo, titulo, explicacion, tipo_ejercicio, parametros, orden) VALUES
-- Módulo A: Reconocimiento de letras
    (1, 1, 'LA1', 'Las vocales',
     'Las vocales son cinco: a, e, i, o, u. Están en casi todas las palabras. Escucha cada una y toca la que oíste.',
     'letra_escuchar', '{"letras": ["a","e","i","o","u"]}', 1),
    (2, 1, 'LA2', 'Vocales al inicio de las palabras',
     'Muchas palabras empiezan con una vocal: oso empieza con o, uva empieza con u. Mira el dibujo, escucha la palabra y toca la vocal con que empieza.',
     'letra_inicial', '{"letras": ["a","e","i","o","u"]}', 2),
    (3, 1, 'LA3', 'Consonantes que más se usan',
     'Las letras m, p, s, l y t aparecen en muchísimas palabras: mamá, papá, sol, luna, taza. Escucha y toca la letra.',
     'letra_escuchar', '{"letras": ["m","p","s","l","t"]}', 3),
    (4, 1, 'LA4', 'Palabras con m, p, s, l y t',
     'Ahora busca esas letras al inicio de palabras que usas todos los días. Mira el dibujo y toca la letra con que empieza.',
     'letra_inicial', '{"letras": ["m","p","s","l","t"]}', 4),
    (5, 1, 'LA5', 'No confundir b y d',
     'La b y la d se parecen, pero miran a lados distintos. La b tiene la panza a la derecha, como en boca. La d tiene la panza a la izquierda, como en dedo.',
     'letra_inicial', '{"letras": ["b","d"], "distractores": ["p","q"]}', 5),
    (6, 1, 'LA6', 'No confundir p y q',
     'La p y la q tienen el palito hacia abajo. La p tiene la panza a la derecha, como en pato. La q tiene la panza a la izquierda y casi siempre va con u, como en queso.',
     'letra_escuchar', '{"letras": ["p","q"], "distractores": ["b","d"]}', 6),
    (7, 1, 'LA7', 'No confundir m y n',
     'La m tiene dos montañitas y suena mmm, como en mano. La n tiene una sola montañita y suena nnn, como en nube. Cuenta las montañitas.',
     'letra_inicial', '{"letras": ["m","n"], "distractores": ["u","h"]}', 7),
    (8, 1, 'LA8', 'Mayúsculas y minúsculas',
     'Cada letra tiene dos formas: grande, que se llama mayúscula, y pequeña, que se llama minúscula. La mayúscula se usa al empezar una oración y en los nombres. Toca la letra pequeña que corresponde a la grande.',
     'mayuscula', '{"letras": ["a","b","d","e","g","l","m","n","p","r","s","t"]}', 8),
-- Módulo B: Conciencia silábica
    (9, 2, 'LB1', 'Sílabas directas: ma, pe, si',
     'Una consonante y una vocal juntas forman una sílaba: m con a dice ma, p con e dice pe. Escucha la sílaba y tócala.',
     'silaba_escuchar', '{"patron": "directa", "consonantes": ["m","p","s","l","t"]}', 1),
    (10, 2, 'LB2', 'Más sílabas directas: fa, re, go, ju',
     'Practica sílabas con otras consonantes: f, r, g, j, n, d. Escucha con atención: ga, go y gu suenan distinto a ge y gi.',
     'silaba_escuchar', '{"patron": "directa", "consonantes": ["f","r","n","d","j","b","c"]}', 2),
    (11, 2, 'LB3', 'Sílabas inversas: al, es, un',
     'En las sílabas inversas la vocal va primero: a con l dice al, e con s dice es. Las usamos en palabras como árbol, esposa o un.',
     'silaba_escuchar', '{"patron": "inversa"}', 3),
    (12, 2, 'LB4', 'Sílabas mixtas: pan, sol, mar',
     'Algunas sílabas tienen consonante, vocal y otra consonante: pan, sol, mar. Escucha la sílaba completa y tócala.',
     'silaba_escuchar', '{"patron": "mixta", "consonantes": ["p","s","m","l","t","c","f"]}', 4),
    (13, 2, 'LB5', 'Sílabas trabadas: pra, tre, bla',
     'En las sílabas trabadas dos consonantes van juntas antes de la vocal: p y r con a dice pra, como en prado. Empezamos con pr y tr, que son las más comunes.',
     'silaba_escuchar', '{"patron": "trabada", "grupos": ["pr","tr","br","cr","gr","pl","bl","cl","fl"]}', 5),
    (14, 2, 'LB6', 'No confundir bla y bra',
     'Bla y bra suenan parecido. Con l la lengua sube suave; con r la lengua vibra. Escucha muy bien y elige la que oíste.',
     'silaba_escuchar', '{"patron": "trabada", "pares": [["bl","br"],["cl","cr"],["pl","pr"],["fl","fr"],["gl","gr"]]}', 6),
-- Módulo C: Lectura de palabras y oraciones
    (15, 3, 'LC1', 'Leer palabras cortas',
     'Lee la palabra despacio, sílaba por sílaba, y después de corrido. Luego toca el dibujo que corresponde.',
     'palabra_imagen', '{"silabasMin": 1, "silabasMax": 2}', 1),
    (16, 3, 'LC2', 'Armar palabras con sílabas',
     'Las palabras se forman uniendo sílabas: ca y sa forman casa. Escucha la palabra y toca las sílabas en orden.',
     'ordenar_silabas', '{"silabasMin": 2, "silabasMax": 3}', 2),
    (17, 3, 'LC3', 'Palabras largas',
     'Las palabras largas se leen por partes: ma, ri, po, sa. Mariposa. Arma la palabra uniendo sus sílabas en orden.',
     'ordenar_silabas', '{"silabasMin": 3, "silabasMax": 5}', 3),
    (18, 3, 'LC4', 'Leer palabras largas',
     'Lee la palabra larga por partes y luego completa. Después toca el dibujo que corresponde.',
     'palabra_imagen', '{"silabasMin": 3, "silabasMax": 5}', 4),
    (19, 3, 'LC5', 'Leer oraciones',
     'Una oración junta varias palabras para decir algo completo. Empieza con mayúscula y termina con punto. Lee la oración y toca el dibujo que la representa.',
     'oracion_imagen', '{}', 5),
-- Módulo D: Comprensión y escritura
    (20, 4, 'LD1', 'Entender lo que lees',
     'Leer es entender. Lee el texto corto con calma; si quieres, escúchalo. Luego responde la pregunta: la respuesta está escrita en el texto.',
     'comprension', '{}', 1),
    (21, 4, 'LD2', 'Pensar más allá del texto',
     'A veces el texto no lo dice todo y hay que pensar. Si alguien saca su paraguas, seguro está lloviendo. Lee y elige la respuesta que tiene más sentido.',
     'inferencia', '{}', 2),
    (22, 4, 'LD3', 'Copiar palabras',
     'Mira la palabra y escríbela igual, letra por letra. No hay prisa.',
     'copiar', '{"silabasMin": 1, "silabasMax": 3}', 3),
    (23, 4, 'LD4', 'Dictado',
     'Escucha la palabra y escríbela. Piensa en sus sílabas: ca, sa, casa. Puedes escucharla las veces que quieras.',
     'dictado', '{"silabasMin": 2, "silabasMax": 4}', 4),
    (24, 4, 'LD5', 'Armar oraciones',
     'Una oración tiene orden: primero quién, después qué hace. Escucha la oración y toca las palabras en orden.',
     'ordenar_palabras', '{}', 5),
    (25, 4, 'LD6', 'Palabras que concuerdan',
     'Las palabras de una oración tienen que concordar: el perro come, los perros comen. Elige la palabra que completa bien la oración.',
     'concordancia', '{}', 6);

SELECT setval(pg_get_serial_sequence('lecciones', 'id'), (SELECT max(id) FROM lecciones));

-- Qué regla remedial atiende cada lección
INSERT INTO lecciones_reglas (leccion_id, regla_id)
SELECT l.id, r.id
  FROM (VALUES
        ('LA1','R1'), ('LA2','R1'), ('LA1','R2'), ('LA2','R2'),
        ('LA3','R4'), ('LA4','R4'), ('LA5','R5'), ('LA6','R6'), ('LA7','R7'), ('LA8','R9'),
        ('LB1','R11'), ('LB2','R12'), ('LB3','R14'), ('LB4','R16'), ('LB5','R18'), ('LB6','R19'),
        ('LC1','R21'), ('LC2','R21'), ('LC1','R22'), ('LC3','R24'), ('LC3','R25'), ('LC4','R25'),
        ('LC5','R27'), ('LC5','R28'),
        ('LD1','R30'), ('LD1','R31'), ('LD2','R33'), ('LD3','R35'), ('LD4','R36'), ('LD5','R38'), ('LD6','R39')
       ) AS x(leccion, regla)
  JOIN lecciones l ON l.codigo = x.leccion
  JOIN reglas r ON r.codigo = x.regla;

-- >>>>>>>>>> sql/05_historial.sql

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

-- >>>>>>>>>> sql/06_cuentas.sql

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

COMMIT;
