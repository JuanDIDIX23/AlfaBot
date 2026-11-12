# Cambios para el manual técnico

Lista de lo que hay que corregir o agregar en `AlfaBot_Manual_Tecnico_Final.pdf` para que coincida con el código actual. Está ordenada por sección del manual. El texto entre comillas se puede copiar tal cual.

## Resumen

| Tema | Antes (manual) | Ahora (código) |
|---|---|---|
| Identificar al usuario | Nombre único que acumula historial | Cuenta con usuario y PIN de 4 números; sesión con token |
| Historial (P8, caso de uso 5, RF-05, RF-08) | Descrito, no programado | `GET /api/historial` (con sesión) y pantalla "Mis evaluaciones" |
| Privacidad | No se trataba | Cada persona solo ve y responde sus propias evaluaciones y caminos |
| Tablas | 12 | 18 (5 del módulo de aprendizaje y `sesiones`) |
| Módulo de aprendizaje y voz | No aparecen | 25 lecciones, 13 tipos de ejercicio, lectura en voz alta |
| Archivos SQL entregables | Citados, no existían | `entregables/alfabot_base_de_datos.sql` y `entregables/alfabot_schema_export.sql` |
| RNF-03 (rendimiento) | Cifras sin evidencia | `npm run pruebas:api` mide y muestra mediana, p95 y máximo |
| RNF-07 (motor sin base) | Cierto en la arquitectura | Además existe `npm run pruebas:motor`, que corre sin base de datos |

## 1. Listado de procesos (tabla 2)

- **P1**, entradas: "Usuario y PIN (o, si es nuevo, nombre, usuario y PIN)." Salidas: "Sesión iniciada y evaluación abierta para esa cuenta."
- **P8**, entradas: "Sesión iniciada." (no "Nombre del usuario").
- Agregar estos procesos:

| Código | Proceso | Entradas | Salidas |
|---|---|---|---|
| P0 | Crear cuenta e iniciar sesión | Nombre, usuario y PIN | Cuenta con el PIN cifrado y un token de sesión que dura 30 días |
| P11 | Crear la ruta de aprendizaje | Evaluación terminada (reglas remediales activadas, respuestas de dominio, módulos pendientes) | Ruta de lecciones ordenada, cada una con la regla que la justifica |
| P12 | Generar una ronda de ejercicios | Lección disponible y últimos 40 intentos | 10 ejercicios, con más peso para lo que se falló |
| P13 | Calificar la ronda | Resultado de cada ejercicio | Lección superada con 8 de 10 o más, siguiente lección desbloqueada, progreso por módulo actualizado |

## 2. Requerimientos funcionales (tabla 3)

- **RF-03**, agregar al final: "…y convertirlas en un camino de lecciones con ejercicios para practicar en la página."
- **RF-05**, reemplazar por: "El sistema debe registrar los usuarios, las evaluaciones, las respuestas y el progreso por módulo en la cuenta de cada persona, y permitir consultarlos en cualquier dispositivo después de iniciar sesión."
- **RF-06**, agregar: "La evaluación sin terminar se ofrece al entrar, en cualquier dispositivo."
- **RF-08**, cambiar "consultar resultados e historial" por "iniciar sesión, consultar resultados e historial".
- Agregar:
  - **RF-09:** "El sistema debe permitir crear una cuenta con un nombre de usuario único y un PIN de 4 números, iniciar y cerrar sesión, y bloquear la cuenta 15 minutos después de 5 PIN equivocados."
  - **RF-10:** "El sistema debe generar, para cada lección del camino, rondas de ejercicios distintas cada vez, adaptadas a los errores recientes de la persona, y dar por superada la lección con al menos 8 aciertos de 10."
  - **RF-11:** "El sistema debe poder leer en voz alta los textos, las preguntas, las opciones y la corrección de cada ejercicio."

## 3. Requerimientos no funcionales (tabla 4)

- **RNF-03:** reemplazar la frase de las 77 peticiones por: "Lo mide `npm run pruebas:api`, que cronometra cada petición de la prueba. En la última corrida local: 67 peticiones, mediana de 63 ms, p95 de 153 ms y máximo de 244 ms (ver `evidencias/pruebas_locales.txt`; crear cuenta y entrar tardan más a propósito, porque calcular la huella del PIN es lento)." Antes de entregar, actualizar las cifras con una corrida contra la base de la nube.
- **RNF-04**, agregar: "En el módulo de aprendizaje, una lección nueva que use un tipo de ejercicio existente también se agrega con filas; un tipo de ejercicio nuevo requiere programar su generador."
- **RNF-06**, agregar:
  - "El PIN se guarda como huella scrypt con sal, nunca en claro."
  - "Tras 5 intentos fallidos la cuenta se bloquea 15 minutos."
  - "El token de sesión es aleatorio (256 bits) y en la base solo se guarda su huella SHA-256."
  - "Cada persona solo puede ver y responder sus propias evaluaciones y caminos; si pide las de otra, el sistema responde como si no existieran."
  - Si la aplicación se publica con HTTPS, decirlo; hoy responde solo por HTTP, y sin HTTPS el PIN viaja sin cifrar.
- **RNF-07:** agregar "`npm run pruebas:motor` ejecuta las pruebas del motor sin base de datos."

## 6. Base de datos

- Cambiar "doce tablas en dos grupos: seis… y seis…" por "dieciocho tablas: ocho de la base de conocimiento y diez del sistema transaccional".
- **Tabla 9**, agregar estas filas:

| Tabla | Filas | Contenido |
|---|---|---|
| lecciones | 25 | Lecciones por módulo, con su explicación, el tipo de ejercicio y sus parámetros |
| lecciones_reglas | 31 | Qué regla remedial atiende cada lección |

- **Tabla 10**:
  - **usuarios:** reemplazar por "Cada persona que usa el sistema: su nombre, su usuario para entrar (único, en minúsculas), la huella de su PIN y el control de intentos fallidos y bloqueo."
  - Agregar estas filas:

| Tabla | Contenido |
|---|---|
| sesiones | Sesiones iniciadas: huella del token, fecha de vencimiento (30 días) y si se cerró |
| rutas | Un camino de aprendizaje por evaluación terminada |
| ruta_lecciones | Las lecciones del camino, su orden, estado (bloqueada, disponible, superada), la regla que la justifica y sus aciertos |
| intentos_ejercicio | Cada ejercicio resuelto: qué se practicó y si acertó |

- **Figura 5:** regenerar el modelo relacional con las 18 tablas.
- **Sección 6.3:** los archivos citados ya existen. Generar el script completo con `npm run exportar-sql`. El esquema se exporta con `pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL" > entregables/alfabot_schema_export.sql`.
- La columna `usuarios.clave` (sql/05) quedó de una versión intermedia y ya no se usa.

## 7. Carga del conocimiento

Agregar: "`npm run cargar-bd` también carga las 25 lecciones (sql/04) y las cuentas y sesiones (sql/05 y sql/06). Sobre una base que ya existe, agrega solo lo que falta, sin borrar datos."

## 8. Diagramas de flujo de datos

- Nivel 0: el usuario envía "usuario, PIN y respuestas", no "alias y respuestas".
- Nivel 1:
  - Agregar P0 (crear cuenta e iniciar sesión), que escribe en D2 los usuarios y las sesiones.
  - P8 recibe la sesión, no el nombre.
  - Agregar P11 a P13, que leen las lecciones de D1 y escriben en D2 las rutas, los intentos y el progreso.

## 10. Casos de uso (figura 8 y tabla 16)

- Agregar:
  - **Caso 0, "Crear cuenta / iniciar sesión":** el usuario crea su cuenta con nombre, usuario y PIN, o entra con su usuario y PIN (P0).
  - **Caso 7, "Practicar el camino de aprendizaje":** el usuario abre su camino, practica rondas de 10 ejercicios y desbloquea lecciones (P11 a P13).
  - **Caso 8, "Escuchar los textos":** el usuario toca 🔊 en cualquier bloque de texto.
  - **Caso 9, "Cerrar sesión".**
- **Caso 1:** "Con la sesión iniciada, el usuario toca 'Hacer una evaluación nueva' (P1, P2)."
- **Caso 5:** "El usuario abre 'Mis evaluaciones' y ve sus evaluaciones con fecha, nivel, preguntas respondidas y avance del camino, y el estado de cada módulo. Desde ahí puede continuar una evaluación, ver un resultado o abrir su camino (P8)."

## 11. Diagrama de clases DAO (figura 9 y tabla 17)

Agregar las clases de cuentas:

| Clase o interfaz | Tipo | Responsabilidad |
|---|---|---|
| ICuentaRepositorio | Interfaz | Crear cuenta, buscar por usuario, intentos fallidos y bloqueo, crear, consultar y cerrar sesiones |
| CuentaRepositorioPg | DAO | Implementa la interfaz; los tiempos de bloqueo y vencimiento los calcula la base |
| ServicioCuentas | Fachada | Registro, inicio de sesión, huella del PIN (scrypt), bloqueo y token de sesión |

Corregir según el código:

- `IEvaluacionRepositorio`:
  - `historialDeUsuario(usuarioId): HistorialUsuario`;
  - quitar `historialDeUsuario(alias)` y el "busca o crea" por nombre.
- `ServicioDiagnostico`:
  - `abrirEvaluacion(usuario)`;
  - `reanudarSesion(evaluacionId)`;
  - `historial(usuarioId)`.
- `SesionDiagnostico.usuarioId` es público: la API lo usa para que nadie vea una evaluación ajena.
- Agregar las clases del módulo de aprendizaje:

| Clase o interfaz | Tipo | Responsabilidad |
|---|---|---|
| IAprendizajeRepositorio | Interfaz | Lecciones, rutas, intentos y avance por evaluación |
| AprendizajeRepositorioPg | DAO | Implementa la interfaz; guarda cada ronda en una transacción |
| ServicioAprendizaje | Fachada | Crear el camino, generar y calificar rondas, solo para el dueño |
| ConstructorRuta | Negocio | Arma el camino a partir del diagnóstico |
| GeneradorEjercicios | Negocio | 13 generadores y la ronda adaptativa |

- Cambiar "12 tablas" por "18 tablas".

## 12. Aplicación web

- Agregar las rutas de la API:

| Ruta | Sesión | Para qué |
|---|---|---|
| `POST /api/cuentas` | no | Crear cuenta (nombre, usuario, PIN); devuelve el token |
| `POST /api/sesiones` | no | Entrar con usuario y PIN; devuelve el token |
| `GET /api/sesiones` | sí | La cuenta de la sesión actual |
| `DELETE /api/sesiones` | sí | Cerrar sesión |
| `POST /api/evaluaciones`, `GET /api/evaluaciones/:id`, `POST /api/evaluaciones/:id/respuestas` | sí | Solo para evaluaciones propias |
| `GET /api/historial` | sí | Historial de la cuenta |
| `POST /api/evaluaciones/:id/ruta`, `GET /api/rutas/:clave`, `POST /api/rutas/:clave/lecciones/:id/rondas`, `POST /api/rutas/:clave/lecciones/:id/resultados` | sí | Camino de aprendizaje propio |

- El token se envía en la cabecera `Authorization: Bearer <token>`.
- Agregar capturas de la pantalla de entrar o crear cuenta, de "Mis evaluaciones", del camino y de un ejercicio.

## Pendiente fuera del manual

- **Preguntas para un observador.** Las preguntas del diagnóstico están redactadas así ("¿Reconoce las vocales?"), mientras que la formulación exige que no haya docente. Conviene explicar en el manual quién responde, o convertirlas en pruebas directas en una versión futura.
- **HTTPS.** Activarlo en Elastic Beanstalk: con cuentas y PIN ya no es opcional.
- **Actualizar la nube.** Ejecutar `npm run cargar-bd` contra la base de la nube (agrega cuentas y sesiones sin borrar datos) y publicar el paquete de `despliegue/`.
