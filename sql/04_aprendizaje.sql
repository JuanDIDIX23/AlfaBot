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
