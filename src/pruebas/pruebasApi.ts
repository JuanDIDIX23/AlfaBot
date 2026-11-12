import { AddressInfo } from "net";
import { Conexion } from "../datos/Conexion";
import { ConocimientoRepositorioPg } from "../datos/ConocimientoRepositorioPg";
import { EvaluacionRepositorioPg } from "../datos/EvaluacionRepositorioPg";
import { ServicioDiagnostico } from "../negocio/ServicioDiagnostico";
import { ControladorDiagnostico } from "../presentacion/ControladorDiagnostico";
import { crearApp } from "../presentacion/web/app";
import { ControladorApi } from "../presentacion/web/ControladorApi";
import { CuentaRepositorioPg } from "../datos/CuentaRepositorioPg";
import { MAX_INTENTOS, ServicioCuentas } from "../negocio/ServicioCuentas";
import { VistaGuionada } from "./VistaGuionada";

/**
 * Pruebas del servicio web: levanta la API real contra PostgreSQL y la usa por HTTP, como lo hará
 * la interfaz en la nube. Compara además el resultado con el del motor en memoria para comprobar
 * que reconstruir la sesión en cada petición no cambia el diagnóstico.
 */
const PREFIJO = "api-prueba:";
let fallos = 0;
let total = 0;

function verificar(nombre: string, ok: boolean, detalle = ""): void {
  total += 1;
  if (!ok) fallos += 1;
  console.log(`  ${ok ? "OK   " : "FALLA"} ${nombre}${detalle ? `  (${detalle})` : ""}`);
}

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function main(): Promise<void> {
  const db = Conexion.obtener();
  const conocimiento = new ConocimientoRepositorioPg(db);
  const evaluaciones = new EvaluacionRepositorioPg(db);
  const servicio = new ServicioDiagnostico(conocimiento, evaluaciones);
  const servidor = crearApp({
    api: new ControladorApi(servicio, conocimiento),
    cuentas: new ServicioCuentas(new CuentaRepositorioPg(db)),
  }).listen(0);
  const sufijo = Date.now().toString(36); // nombres de usuario únicos en cada corrida
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

  const tiempos: number[] = []; // duración de cada petición a la API, para el requisito RNF-03
  let tokenActual: string | undefined; // sesión con que se hacen las peticiones (se puede cambiar)
  const http = async (metodo: string, ruta: string, cuerpo?: unknown, crudo?: string, token = tokenActual) => {
    const t0 = performance.now();
    const headers: Record<string, string> = {};
    if (cuerpo !== undefined || crudo !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;
    const r = await fetch(base + ruta, {
      method: metodo,
      headers,
      body: crudo ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
    });
    let json: Json = null;
    try { json = await r.json(); } catch { /* sin cuerpo */ }
    tiempos.push(performance.now() - t0);
    return { estado: r.status, json, cabeceras: r.headers };
  };

  /** Recorre una evaluación completa por HTTP eligiendo siempre la opción `posicion` ("primera" o "ultima"). */
  const recorrer = async (_nombre: string, posicion: "primera" | "ultima") => {
    const inicio = await http("POST", "/api/evaluaciones");
    let estado: Json = inicio.json;
    const id = estado.evaluacionId;
    let peticiones = 1;
    while (estado.estado === "en_curso") {
      const ops = estado.pregunta.opciones;
      const elegida = posicion === "primera" ? ops[0] : ops[ops.length - 1];
      const r = await http("POST", `/api/evaluaciones/${id}/respuestas`, { ramaId: elegida.ramaId });
      if (r.estado !== 200) throw new Error(`Respuesta inesperada ${r.estado}`);
      estado = r.json;
      peticiones += 1;
      if (peticiones > 50) throw new Error("La evaluación no termina");
    }
    return { id, estado, inicio };
  };

  /** El mismo recorrido con el motor en memoria (sin HTTP ni reconstrucción de sesión). */
  const enMemoria = async (alias: string, posicion: "primera" | "ultima") => {
    const vista = new VistaGuionada(PREFIJO + alias, (p) =>
      (posicion === "primera" ? p.opciones[0] : p.opciones[p.opciones.length - 1]).ramaId,
    );
    return new ControladorDiagnostico(servicio, vista).ejecutar();
  };

  /** Crea una cuenta de prueba y devuelve su token. */
  const nuevaCuenta = async (nombre: string, pin = "2580") => {
    const r = await http("POST", "/api/cuentas", { usuario: `prueba-${nombre}-${sufijo}`, pin, nombre: PREFIJO + nombre }, undefined, "");
    return { estado: r.estado, token: r.json?.token as string, usuario: `prueba-${nombre}-${sufijo}` };
  };

  try {
    console.log("\n== Cuentas e inicio de sesión ==");
    const principal = await nuevaCuenta("principal");
    verificar("Crear una cuenta entrega un token de sesión", principal.estado === 201 && /^[A-Za-z0-9_-]{43}$/.test(principal.token ?? ""));
    tokenActual = principal.token;
    const yo = await http("GET", "/api/sesiones");
    verificar("Con el token, el servidor reconoce la cuenta", yo.estado === 200 && yo.json.cuenta.usuario === principal.usuario);
    const repetida = await http("POST", "/api/cuentas", { usuario: principal.usuario.toUpperCase(), pin: "5813", nombre: "otra" }, undefined, "");
    verificar("Un usuario ya usado (sin importar mayúsculas) → 409", repetida.estado === 409, `recibió ${repetida.estado}`);
    for (const [nombre, datos] of [
      ["PIN con letras → 400", { usuario: `prueba-x-${sufijo}`, pin: "12a4", nombre: "x" }],
      ["PIN de 3 números → 400", { usuario: `prueba-x-${sufijo}`, pin: "123", nombre: "x" }],
      ["PIN muy fácil (1111) → 400", { usuario: `prueba-x-${sufijo}`, pin: "1111", nombre: "x" }],
      ["Usuario con espacios → 400", { usuario: "mi usuario", pin: "2580", nombre: "x" }],
      ["Sin nombre → 400", { usuario: `prueba-x-${sufijo}`, pin: "2580", nombre: "  " }],
    ] as const) {
      const r = await http("POST", "/api/cuentas", datos, undefined, "");
      verificar(nombre, r.estado === 400, `recibió ${r.estado}`);
    }
    const entra = await http("POST", "/api/sesiones", { usuario: principal.usuario, pin: "2580" }, undefined, "");
    verificar("Entrar con usuario y PIN correctos → 200 y token nuevo", entra.estado === 200 && entra.json.token !== principal.token);
    const mal = await http("POST", "/api/sesiones", { usuario: principal.usuario, pin: "0000" }, undefined, "");
    const noExiste = await http("POST", "/api/sesiones", { usuario: `nadie-${sufijo}`, pin: "2580" }, undefined, "");
    verificar(
      "PIN equivocado o usuario inexistente → 401 con el mismo mensaje",
      mal.estado === 401 && noExiste.estado === 401 && mal.json.error === noExiste.json.error,
    );

    const victima = await nuevaCuenta("bloqueo");
    for (let i = 0; i < MAX_INTENTOS; i++) await http("POST", "/api/sesiones", { usuario: victima.usuario, pin: "0000" }, undefined, "");
    const bloqueada = await http("POST", "/api/sesiones", { usuario: victima.usuario, pin: "2580" }, undefined, "");
    verificar(`Tras ${MAX_INTENTOS} PIN equivocados la cuenta se bloquea, aunque luego el PIN sea correcto → 429`, bloqueada.estado === 429, `recibió ${bloqueada.estado}`);

    verificar("Sin sesión no se puede evaluar → 401", (await http("POST", "/api/evaluaciones", undefined, undefined, "")).estado === 401);
    verificar("Con un token inventado → 401", (await http("GET", "/api/historial", undefined, undefined, "x".repeat(43))).estado === 401);

    const salida = await nuevaCuenta("salida");
    await http("DELETE", "/api/sesiones", undefined, undefined, salida.token);
    verificar("Al cerrar sesión el token deja de servir", (await http("GET", "/api/sesiones", undefined, undefined, salida.token)).estado === 401);

    console.log("\n== Servicio ==");
    const salud = await http("GET", "/api/salud");
    verificar("GET /api/salud llega a la base de conocimiento", salud.estado === 200 && salud.json.hipotesis === 5);
    const hip = await http("GET", "/api/hipotesis");
    verificar("GET /api/hipotesis devuelve las 5 hipótesis", hip.estado === 200 && hip.json.length === 5);
    verificar("Cabeceras de seguridad presentes", salud.cabeceras.get("x-content-type-options") === "nosniff" && !salud.cabeceras.get("x-powered-by"));

    console.log("\n== Evaluación completa por HTTP ==");
    const a = await recorrer("primera", "primera");
    const resA = a.estado.resultado;
    verificar("Primera pregunta con 5 creencias a priori de 0,20", a.inicio.json.creencias.length === 5 && a.inicio.json.creencias.every((c: Json) => Math.abs(c.probabilidad - 0.2) < 1e-9));
    verificar("Opciones siempre elegidas al inicio llevan a H1", resA.ganadora.codigo === "H1", `${resA.ganadora.codigo} ${(resA.ganadora.probabilidad * 100).toFixed(1)} %`);
    verificar("El plan lista actividades con su regla", resA.plan.length > 0 && resA.plan.every((p: Json) => /^R\d+$/.test(p.regla)));

    const b = await recorrer("ultima", "ultima");
    verificar("Opciones de mayor avance llevan a H5", b.estado.resultado.ganadora.codigo === "H5", `${b.estado.resultado.ganadora.codigo} ${(b.estado.resultado.ganadora.probabilidad * 100).toFixed(1)} %`);

    console.log("\n== Equivalencia con el motor en memoria ==");
    for (const [alias, pos] of [["primera", "primera"], ["ultima", "ultima"]] as const) {
      const web = (await recorrer(`eq-${alias}`, pos)).estado.resultado;
      const mem = await enMemoria(`eq-mem-${alias}`, pos);
      const dif = Math.max(...mem.creencias.map((c) => {
        const w = web.creencias.find((x: Json) => x.codigo === c.hipotesis.codigo);
        return Math.abs(w.probabilidad - c.probabilidad);
      }));
      verificar(
        `Opción ${pos}: mismo diagnóstico, mismas preguntas y probabilidades`,
        web.ganadora.codigo === mem.ganadora.hipotesis.codigo && web.preguntasRespondidas === mem.preguntasRespondidas && dif < 1e-4,
        `${web.ganadora.codigo}, ${web.preguntasRespondidas} preguntas, diferencia máxima ${dif.toExponential(1)}`,
      );
    }

    console.log("\n== Consulta y estado ==");
    const consulta = await http("GET", `/api/evaluaciones/${a.id}`);
    verificar("GET de una evaluación terminada devuelve el mismo resultado", consulta.estado === 200 && consulta.json.estado === "completada" && consulta.json.resultado.ganadora.codigo === resA.ganadora.codigo && consulta.json.resultado.plan.length === resA.plan.length);
    const filas = await db.query(`SELECT count(*)::int AS n FROM diagnosticos WHERE evaluacion_id = $1`, [a.id]);
    verificar("Consultar no duplica el plan guardado", filas.rows[0].n === resA.plan.length, `${filas.rows[0].n} filas`);

    const pausa = await http("POST", "/api/evaluaciones");
    const reanudada = await http("GET", `/api/evaluaciones/${pausa.json.evaluacionId}`);
    verificar("Una evaluación a medias se reanuda con la misma pregunta", reanudada.json.estado === "en_curso" && reanudada.json.pregunta.nodoCodigo === pausa.json.pregunta.nodoCodigo);

    console.log("\n== Historial y privacidad ==");
    const hist = await http("GET", "/api/historial");
    const ids = hist.json.evaluaciones.map((e: Json) => e.evaluacionId);
    verificar(
      "El historial lista las evaluaciones de la cuenta, la más reciente primero",
      hist.estado === 200 && ids[0] === pausa.json.evaluacionId && ids.includes(a.id) && ids.includes(b.id),
      `${ids.length} evaluaciones`,
    );
    const terminada = hist.json.evaluaciones.find((e: Json) => e.evaluacionId === a.id);
    verificar("Una evaluación terminada muestra su nivel y el progreso por módulo queda guardado",
      terminada?.nivel?.codigo === resA.ganadora.codigo && hist.json.progreso.length === 4);
    verificar("Una evaluación sin respuestas no muestra nivel", hist.json.evaluaciones[0].nivel === null);

    const otra = await nuevaCuenta("otra");
    const ajena = await http("GET", `/api/evaluaciones/${a.id}`, undefined, undefined, otra.token);
    const responderAjena = await http("POST", `/api/evaluaciones/${pausa.json.evaluacionId}/respuestas`, { ramaId: pausa.json.pregunta.opciones[0].ramaId }, undefined, otra.token);
    verificar("Otra cuenta no puede ver ni responder evaluaciones ajenas → 404", ajena.estado === 404 && responderAjena.estado === 404);
    const histOtra = await http("GET", "/api/historial", undefined, undefined, otra.token);
    verificar("El historial de otra cuenta no incluye evaluaciones ajenas", histOtra.json.evaluaciones.length === 0);

    console.log("\n== Entradas inválidas ==");
    const casos: [string, Awaited<ReturnType<typeof http>>, number][] = [
      ["JSON mal formado → 400", await http("POST", "/api/sesiones", undefined, "{no es json"), 400],
      ["Cuerpo demasiado grande → 413", await http("POST", "/api/sesiones", { usuario: "a", relleno: "z".repeat(5000) }), 413],
      ["Evaluación inexistente → 404", await http("GET", "/api/evaluaciones/999999999"), 404],
      ["Id que no es número → 404", await http("GET", "/api/evaluaciones/abc"), 404],
      ["Id con inyección SQL → 404", await http("GET", "/api/evaluaciones/1;DROP%20TABLE%20ramas"), 404],
      ["Responder en evaluación inexistente → 404", await http("POST", "/api/evaluaciones/999999999/respuestas", { ramaId: 1 }), 404],
      ["ramaId que no es número → 400", await http("POST", `/api/evaluaciones/${pausa.json.evaluacionId}/respuestas`, { ramaId: "1" }), 400],
      ["ramaId de otra pregunta → 400", await http("POST", `/api/evaluaciones/${pausa.json.evaluacionId}/respuestas`, { ramaId: 40 }), 400],
      ["Responder una evaluación terminada → 409", await http("POST", `/api/evaluaciones/${a.id}/respuestas`, { ramaId: 1 }), 409],
      ["Ruta inexistente de la API → 404", await http("GET", "/api/nada"), 404],
    ];
    for (const [nombre, r, esperado] of casos) verificar(nombre, r.estado === esperado, `recibió ${r.estado}`);

    // Una base embebida de una sola conexión (como PGlite) se bloquea con transacciones simultáneas:
    // ahí se puede omitir esta prueba con --omitir-concurrencia. En PostgreSQL real debe correr.
    if (process.argv.includes("--omitir-concurrencia")) {
      console.log("  (omitida) Dos respuestas simultáneas a la misma pregunta");
    } else {
      const mismaRama = pausa.json.pregunta.opciones[0].ramaId;
      const doble = await Promise.all([
        http("POST", `/api/evaluaciones/${pausa.json.evaluacionId}/respuestas`, { ramaId: mismaRama }),
        http("POST", `/api/evaluaciones/${pausa.json.evaluacionId}/respuestas`, { ramaId: mismaRama }),
      ]);
      const estados = doble.map((r) => r.estado).sort();
      verificar("Dos respuestas simultáneas a la misma pregunta: una pasa y la otra se rechaza", estados[0] === 200 && (estados[1] === 409 || estados[1] === 400), `estados ${estados.join(" y ")}`);
    }

    const raiz = await fetch(base + "/");
    const html = await raiz.text();
    verificar("La interfaz web se sirve en /", raiz.status === 200 && html.includes("AlfaBot"));

    // RNF-03: cada respuesta del servicio en menos de 2 segundos
    const orden = [...tiempos].sort((x, y) => x - y);
    const mediana = orden[Math.floor(orden.length / 2)];
    const p95 = orden[Math.min(orden.length - 1, Math.floor(orden.length * 0.95))];
    const maximo = orden[orden.length - 1];
    console.log("\n== Rendimiento (RNF-03) ==");
    verificar(
      "Todas las respuestas de la API en menos de 2 segundos",
      maximo < 2000,
      `${orden.length} peticiones: mediana ${mediana.toFixed(0)} ms, p95 ${p95.toFixed(0)} ms, máximo ${maximo.toFixed(0)} ms`,
    );
  } finally {
    servidor.close();
    try {
      const dep = ["diagnosticos", "inferencias", "respuestas"];
      for (const t of dep) {
        await db.query(`DELETE FROM ${t} WHERE evaluacion_id IN (SELECT e.id FROM evaluaciones e JOIN usuarios u ON u.id = e.usuario_id WHERE u.alias LIKE $1)`, [PREFIJO + "%"]);
      }
      await db.query(`DELETE FROM evaluaciones WHERE usuario_id IN (SELECT id FROM usuarios WHERE alias LIKE $1)`, [PREFIJO + "%"]);
      await db.query(`DELETE FROM sesiones WHERE usuario_id IN (SELECT id FROM usuarios WHERE alias LIKE $1)`, [PREFIJO + "%"]);
      await db.query(`DELETE FROM progreso WHERE usuario_id IN (SELECT id FROM usuarios WHERE alias LIKE $1)`, [PREFIJO + "%"]);
      await db.query(`DELETE FROM usuarios WHERE alias LIKE $1`, [PREFIJO + "%"]);
    } catch (e) {
      // El rol de la aplicación no puede borrar (a propósito); los datos de prueba quedan marcados con el prefijo "api-prueba:".
      console.log(`\n  (Limpieza omitida: ${e instanceof Error ? e.message : e}. Se borra con un usuario administrador.)`);
    }
    await Conexion.cerrar();
  }
  console.log(`\nResumen: ${total - fallos}/${total} verificaciones correctas`);
  process.exit(fallos === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
