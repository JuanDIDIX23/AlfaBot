# Cambios para el manual técnico

Lista de lo que hay que corregir o agregar en `AlfaBot_Manual_Tecnico_Final.pdf` para que coincida con el código actual. Está ordenada por sección del manual. El texto entre comillas se puede copiar tal cual.

## Resumen

| Tema | Antes (manual) | Ahora (código) |
|---|---|---|
| Historial (P8, caso de uso 5, RF-05, RF-08) | Descrito, no programado | Programado: `GET /api/usuarios/:clave/historial` y pantalla "Mis evaluaciones" |
| Identificar al usuario | Por nombre único | Por una clave aleatoria guardada en el navegador; el nombre no identifica |
| Tablas | 12 | 17 (5 del módulo de aprendizaje) |
| Módulo de aprendizaje y voz | No aparecen | 25 lecciones, 13 tipos de ejercicio, lectura en voz alta |
| Archivos SQL entregables | Citados, no existían | `entregables/alfabot_base_de_datos.sql` y `entregables/alfabot_schema_export.sql` |
| RNF-03 (rendimiento) | Cifras sin evidencia | `npm run pruebas:api` mide y muestra mediana, p95 y máximo |
| RNF-07 (motor sin base) | Cierto en la arquitectura | Además existe `npm run pruebas:motor`, que corre sin base de datos |

## 1. Listado de procesos (tabla 2)

- **P1**, salidas: "Usuario reconocido por la clave guardada en su navegador, o uno nuevo con su clave aleatoria; evaluación abierta."
- **P8**, entradas: "Clave del usuario." (no "Nombre del usuario").
- Agregar estos procesos:

| Código | Proceso | Entradas | Salidas |
|---|---|---|---|
| P11 | Crear la ruta de aprendizaje | Evaluación terminada (reglas remediales activadas, respuestas de dominio, módulos pendientes) | Ruta de lecciones ordenada, cada una con la regla que la justifica, y su clave |
| P12 | Generar una ronda de ejercicios | Lección disponible y últimos 40 intentos | 10 ejercicios, con más peso para lo que se falló |
| P13 | Calificar la ronda | Resultado de cada ejercicio | Lección superada con 8 de 10 o más, siguiente lección desbloqueada, progreso por módulo actualizado |

## 2. Requerimientos funcionales (tabla 3)

- **RF-03**, agregar al final: "…y convertirlas en un camino de lecciones con ejercicios para practicar en la página."
- **RF-05**, reemplazar "permitir consultarlos entre sesiones" por: "permitir consultarlos entre sesiones mediante el historial del usuario."
- Agregar:
  - **RF-09:** "El sistema debe generar, para cada lección del camino, rondas de ejercicios distintas cada vez, adaptadas a los errores recientes de la persona, y dar por superada la lección con al menos 8 aciertos de 10."
  - **RF-10:** "El sistema debe poder leer en voz alta los textos, las preguntas, las opciones y la corrección de cada ejercicio."

## 3. Requerimientos no funcionales (tabla 4)

- **RNF-03:** reemplazar la frase de las 77 peticiones por: "Lo mide `npm run pruebas:api`, que cronometra cada petición de la prueba. En la última corrida local: 51 peticiones, mediana de 39 ms, p95 de 94 ms y máximo de 109 ms (ver `evidencias/pruebas_locales.txt`)." Antes de entregar, actualizar las cifras con una corrida contra la base de la nube.
- **RNF-04**, agregar: "En el módulo de aprendizaje, una lección nueva que use un tipo de ejercicio existente también se agrega con filas; un tipo de ejercicio nuevo requiere programar su generador."
- **RNF-06:** agregar "El historial y el camino de aprendizaje se consultan con claves aleatorias (UUID), no con el nombre ni con identificadores consecutivos." Si la aplicación se publica con HTTPS, decirlo; hoy responde solo por HTTP.
- **RNF-07:** agregar "`npm run pruebas:motor` ejecuta las pruebas del motor sin base de datos."

## 6. Base de datos

- Cambiar "doce tablas en dos grupos: seis… y seis…" por "diecisiete tablas: ocho de la base de conocimiento y nueve del sistema transaccional".
- **Tabla 9**, agregar estas filas:

| Tabla | Filas | Contenido |
|---|---|---|
| lecciones | 25 | Lecciones por módulo, con su explicación, el tipo de ejercicio y sus parámetros |
| lecciones_reglas | 31 | Qué regla remedial atiende cada lección |

- **Tabla 10**:
  - **usuarios:** reemplazar por "Cada persona que usa el sistema, con una clave aleatoria (UUID) que su navegador guarda para reconocerla y acumular su historial. El nombre no es único: dos personas pueden llamarse igual."
  - Agregar estas filas:

| Tabla | Contenido |
|---|---|
| rutas | Un camino de aprendizaje por evaluación terminada, con su clave de acceso |
| ruta_lecciones | Las lecciones del camino, su orden, estado (bloqueada, disponible, superada), la regla que la justifica y sus aciertos |
| intentos_ejercicio | Cada ejercicio resuelto: qué se practicó y si acertó |

- **Figura 5:** regenerar el modelo relacional con las 17 tablas.
- **Sección 6.3:** los archivos citados ya existen. Generar el script completo con `npm run exportar-sql`. El esquema se exporta con `pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > entregables/alfabot_schema_export.sql`.

## 7. Carga del conocimiento

Agregar: "`npm run cargar-bd` también carga las 25 lecciones (sql/04) y la clave de usuario (sql/05). Sobre una base que ya existe, agrega solo lo que falta, sin borrar datos."

## 8. Diagramas de flujo de datos

- Nivel 1:
  - P8 recibe la clave del usuario, no el nombre.
  - Agregar P11 a P13, que leen las lecciones de D1 y escriben en D2 las rutas, los intentos y el progreso.

## 10. Casos de uso (figura 8 y tabla 16)

- **Caso 1:** "El usuario escribe su nombre; si su navegador ya tiene su clave, el sistema lo reconoce y agrega la evaluación a su historial (P1, P2)."
- **Caso 5:** "El usuario abre 'Mis evaluaciones' y ve sus evaluaciones con fecha, nivel, preguntas respondidas y avance del camino, y el estado de cada módulo. Desde ahí puede continuar una evaluación, ver un resultado o abrir su camino (P8)."
- Agregar:
  - **Caso 7, "Practicar el camino de aprendizaje":** el usuario abre su camino, practica rondas de 10 ejercicios y desbloquea lecciones (P11 a P13).
  - **Caso 8, "Escuchar los textos":** el usuario toca 🔊 en cualquier bloque de texto.

## 11. Diagrama de clases DAO (figura 9 y tabla 17)

Corregir según el código:

- `IEvaluacionRepositorio`:
  - `crearUsuario(alias, clave)`;
  - `usuarioPorClave(clave)`;
  - `actualizarAlias(usuarioId, alias)`;
  - `historialDeUsuario(usuarioId): HistorialUsuario`.
- `ServicioDiagnostico`:
  - `identificarUsuario(alias, clave?)`;
  - `abrirEvaluacion(usuario)`;
  - `iniciarSesion(alias, clave?)`;
  - `reanudarSesion(evaluacionId)`;
  - `historial(clave)`.
- `EvaluacionRepositorioPg` ya no "busca o crea" por nombre: crea con clave y busca por clave.
- Modelos: agregar `UsuarioIdentificado`, `EvaluacionHistorial` y `HistorialUsuario`.
- Agregar las clases del módulo de aprendizaje:

| Clase o interfaz | Tipo | Responsabilidad |
|---|---|---|
| IAprendizajeRepositorio | Interfaz | Lecciones, rutas, intentos y avance por evaluación |
| AprendizajeRepositorioPg | DAO | Implementa la interfaz; guarda cada ronda en una transacción |
| ServicioAprendizaje | Fachada | Crear el camino, generar y calificar rondas |
| ConstructorRuta | Negocio | Arma el camino a partir del diagnóstico |
| GeneradorEjercicios | Negocio | 13 generadores y la ronda adaptativa |

- Cambiar "12 tablas" por "17 tablas".

## 12. Aplicación web

- Agregar las rutas de la API:
  - `GET /api/usuarios/:clave/historial`
  - `POST /api/evaluaciones/:id/ruta`
  - `GET /api/rutas/:clave`
  - `POST /api/rutas/:clave/lecciones/:id/rondas`
  - `POST /api/rutas/:clave/lecciones/:id/resultados`
- `POST /api/evaluaciones` ahora acepta `clave` (opcional) y devuelve `usuario: { clave, alias, nuevo }`.
- Agregar capturas de "Mis evaluaciones", del camino y de un ejercicio.

## Pendiente fuera del manual

- **Preguntas para un observador.** Las preguntas del diagnóstico están redactadas así ("¿Reconoce las vocales?"), mientras que la formulación exige que no haya docente. Conviene explicar en el manual quién responde, o convertirlas en pruebas directas en una versión futura.
- **Actualizar la base de la nube.** Hay que ejecutar `npm run cargar-bd` contra la base de la nube, que agrega la columna `clave` sin borrar datos, y volver a publicar el paquete de `despliegue/`.
