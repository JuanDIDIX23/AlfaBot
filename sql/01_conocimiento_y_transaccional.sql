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
