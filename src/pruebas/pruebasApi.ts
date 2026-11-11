import { AddressInfo } from "net";
import { Conexion } from "../datos/Conexion";
import { ConocimientoRepositorioPg } from "../datos/ConocimientoRepositorioPg";
import { EvaluacionRepositorioPg } from "../datos/EvaluacionRepositorioPg";
import { ServicioDiagnostico } from "../negocio/ServicioDiagnostico";
import { ControladorDiagnostico } from "../presentacion/ControladorDiagnostico";
import { crearApp } from "../presentacion/web/app";
import { ControladorApi } from "../presentacion/web/ControladorApi";
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
  const servidor = crearApp(new ControladorApi(servicio, conocimiento)).listen(0);
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

  const http = async (metodo: string, ruta: string, cuerpo?: unknown, crudo?: string) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: cuerpo !== undefined || crudo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: crudo ?? (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined),
    });
    let json: Json = null;
    try { json = await r.json(); } catch { /* sin cuerpo */ }
    return { estado: r.status, json, cabeceras: r.headers };
  };

  /** Recorre una evaluación completa por HTTP eligiendo siempre la opción `posicion` ("primera" o "ultima"). */
  const recorrer = async (alias: string, posicion: "primera" | "ultima") => {
    const inicio = await http("POST", "/api/evaluaciones", { alias: PREFIJO + alias });
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

  try {
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

    const pausa = await http("POST", "/api/evaluaciones", { alias: PREFIJO + "pausa" });
    const reanudada = await http("GET", `/api/evaluaciones/${pausa.json.evaluacionId}`);
    verificar("Una evaluación a medias se reanuda con la misma pregunta", reanudada.json.estado === "en_curso" && reanudada.json.pregunta.nodoCodigo === pausa.json.pregunta.nodoCodigo);

    console.log("\n== Entradas inválidas ==");
    const casos: [string, Awaited<ReturnType<typeof http>>, number][] = [
      ["Alias vacío → 400", await http("POST", "/api/evaluaciones", { alias: "   " }), 400],
      ["Sin alias → 400", await http("POST", "/api/evaluaciones", {}), 400],
      ["Alias demasiado largo → 400", await http("POST", "/api/evaluaciones", { alias: "x".repeat(61) }), 400],
      ["Alias que no es texto → 400", await http("POST", "/api/evaluaciones", { alias: 123 }), 400],
      ["JSON mal formado → 400", await http("POST", "/api/evaluaciones", undefined, "{no es json"), 400],
      ["Cuerpo demasiado grande → 413", await http("POST", "/api/evaluaciones", { alias: "a", relleno: "z".repeat(5000) }), 413],
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

    const mismaRama = pausa.json.pregunta.opciones[0].ramaId;
    const doble = await Promise.all([
      http("POST", `/api/evaluaciones/${pausa.json.evaluacionId}/respuestas`, { ramaId: mismaRama }),
      http("POST", `/api/evaluaciones/${pausa.json.evaluacionId}/respuestas`, { ramaId: mismaRama }),
    ]);
    const estados = doble.map((r) => r.estado).sort();
    verificar("Dos respuestas simultáneas a la misma pregunta: una pasa y la otra se rechaza", estados[0] === 200 && (estados[1] === 409 || estados[1] === 400), `estados ${estados.join(" y ")}`);

    const raiz = await fetch(base + "/");
    const html = await raiz.text();
    verificar("La interfaz web se sirve en /", raiz.status === 200 && html.includes("AlfaBot"));
  } finally {
    servidor.close();
    try {
      const dep = ["diagnosticos", "inferencias", "respuestas"];
      for (const t of dep) {
        await db.query(`DELETE FROM ${t} WHERE evaluacion_id IN (SELECT e.id FROM evaluaciones e JOIN usuarios u ON u.id = e.usuario_id WHERE u.alias LIKE $1)`, [PREFIJO + "%"]);
      }
      await db.query(`DELETE FROM evaluaciones WHERE usuario_id IN (SELECT id FROM usuarios WHERE alias LIKE $1)`, [PREFIJO + "%"]);
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
