import * as assert from "assert";
import * as fs from "fs";
import { AddressInfo } from "net";
import { Conexion } from "../datos/Conexion";
import { ConocimientoRepositorioPg } from "../datos/ConocimientoRepositorioPg";
import { EvaluacionRepositorioPg } from "../datos/EvaluacionRepositorioPg";
import { AprendizajeRepositorioPg } from "../datos/AprendizajeRepositorioPg";
import { ServicioDiagnostico } from "../negocio/ServicioDiagnostico";
import { ServicioAprendizaje } from "../negocio/aprendizaje/ServicioAprendizaje";
import { ConstructorRuta } from "../negocio/aprendizaje/ConstructorRuta";
import { EJERCICIOS_POR_RONDA, GeneradorEjercicios, azarConSemilla } from "../negocio/aprendizaje/GeneradorEjercicios";
import { Ejercicio, Leccion } from "../negocio/aprendizaje/Modelos";
import { PALABRAS } from "../negocio/aprendizaje/Vocabulario";
import { crearApp } from "../presentacion/web/app";
import { ControladorApi } from "../presentacion/web/ControladorApi";
import { ControladorAprendizaje } from "../presentacion/web/ControladorAprendizaje";

/**
 * Pruebas del módulo de aprendizaje, contra PostgreSQL (las lecciones viven en la base de conocimiento):
 *  1. cada lección genera ejercicios bien formados, ronda tras ronda, con distintas semillas;
 *  2. la ronda se adapta: lo que se falló sale más seguido y el dominio sube la dificultad;
 *  3. la ruta se arma según las reglas del diagnóstico;
 *  4. el recorrido completo por HTTP: crear la ruta, practicar, superar y desbloquear.
 *
 *   npm run pruebas:aprendizaje
 *   npm run pruebas:aprendizaje -- --muestras archivo.json   además guarda un ejemplo de cada tipo de ejercicio
 */
const PREFIJO = "aprendizaje-prueba:";
let fallos = 0;
let total = 0;

async function probar(nombre: string, f: () => void | Promise<void>): Promise<void> {
  total += 1;
  try {
    await f();
    console.log(`  OK    ${nombre}`);
  } catch (e) {
    fallos += 1;
    console.log(`  FALLA ${nombre}\n        ${e instanceof Error ? e.message : String(e)}`);
  }
}

function validarEjercicio(e: Ejercicio, leccion: Leccion, objetivos: Set<string>): void {
  const donde = `${leccion.codigo}/${e.objetivo}`;
  assert.ok(objetivos.has(e.objetivo), `${donde}: objetivo fuera de la lección`);
  assert.ok(e.objetivo.length <= 40, `${donde}: objetivo demasiado largo para la base`);
  assert.ok(e.consigna.trim() && e.decir.trim() && e.respuesta.trim(), `${donde}: textos vacíos`);
  if (e.tipo === "elegir") {
    const ids = e.opciones.map((o) => o.id);
    assert.ok(ids.length >= 2, `${donde}: menos de 2 opciones`);
    assert.strictEqual(new Set(ids).size, ids.length, `${donde}: opciones repetidas ${ids.join(",")}`);
    assert.strictEqual(ids.filter((id) => id === e.correcta).length, 1, `${donde}: la correcta no está una sola vez`);
    const vistas = e.opciones.map((o) => o.emoji ?? o.texto);
    assert.ok(vistas.every(Boolean), `${donde}: opción sin contenido`);
    assert.strictEqual(new Set(vistas).size, vistas.length, `${donde}: dos opciones se ven iguales`);
  } else if (e.tipo === "ordenar") {
    assert.ok(e.solucion.length >= 2, `${donde}: nada que ordenar`);
    const piezas = [...e.piezas];
    for (const s of e.solucion) {
      const i = piezas.indexOf(s);
      assert.ok(i >= 0, `${donde}: falta la pieza ${s}`);
      piezas.splice(i, 1);
    }
    assert.ok(piezas.length <= 1, `${donde}: sobran demasiadas piezas`);
  } else {
    assert.ok(e.solucion.trim(), `${donde}: sin solución`);
  }
}

type Json = any; // eslint-disable-line @typescript-eslint/no-explicit-any

async function main(): Promise<void> {
  const db = Conexion.obtener();
  const repo = new AprendizajeRepositorioPg(db);
  const lecciones = await repo.lecciones();
  const tipos = new GeneradorEjercicios().tiposSoportados();

  // ------------------------------------------------------------ 1. generadores
  console.log("Generadores de ejercicios");
  await probar("hay 25 lecciones y todas usan un generador que existe", () => {
    assert.strictEqual(lecciones.length, 25);
    for (const l of lecciones) assert.ok(tipos.includes(l.tipoEjercicio), `${l.codigo}: ${l.tipoEjercicio}`);
  });
  await probar("toda regla remedial tiene al menos una lección", async () => {
    const cubiertas = new Set(lecciones.flatMap((l) => l.reglaIds));
    const ids = await db.query(`SELECT id, codigo FROM reglas WHERE tipo = 'remedial'`);
    const sin = ids.rows.filter((f) => !cubiertas.has(f.id)).map((f) => f.codigo);
    assert.ok(ids.rows.length > 0);
    assert.deepStrictEqual(sin, []);
  });
  await probar("las palabras del banco tienen emoji distinto y sílabas que forman la palabra", () => {
    assert.strictEqual(new Set(PALABRAS.map((p) => p.emoji)).size, PALABRAS.length);
    for (const p of PALABRAS) assert.strictEqual(p.silabas.join(""), p.texto);
  });
  for (const l of lecciones) {
    await probar(`${l.codigo} ${l.titulo}: 50 rondas bien formadas`, () => {
      const objetivos = new Set(new GeneradorEjercicios().objetivos(l));
      assert.ok(objetivos.size >= 2, "practica menos de 2 cosas");
      for (let semilla = 1; semilla <= 50; semilla++) {
        const historial = semilla % 2 ? [] : [...objetivos].map((o, i) => ({ objetivo: o, correcto: i % 3 !== 0 }));
        const ronda = new GeneradorEjercicios(azarConSemilla(semilla)).generarRonda(l, historial);
        assert.strictEqual(ronda.length, EJERCICIOS_POR_RONDA);
        ronda.forEach((e, i) => {
          validarEjercicio(e, l, objetivos);
          if (i > 0 && objetivos.size > 1) assert.notStrictEqual(e.objetivo, ronda[i - 1].objetivo, "objetivo repetido seguido");
        });
      }
    });
  }

  // ------------------------------------------------------------ 2. adaptación
  console.log("Adaptación");
  const vocales = lecciones.find((l) => l.codigo === "LA1")!;
  await probar("misma semilla, misma ronda (reproducible)", () => {
    const a = new GeneradorEjercicios(azarConSemilla(7)).generarRonda(vocales, []);
    const b = new GeneradorEjercicios(azarConSemilla(7)).generarRonda(vocales, []);
    assert.deepStrictEqual(a, b);
  });
  await probar("lo que se falla sale más seguido", () => {
    const historial = [1, 2, 3, 4].map(() => ({ objetivo: "o", correcto: false }));
    let conFallos = 0;
    let sinHistorial = 0;
    for (let s = 1; s <= 100; s++) {
      conFallos += new GeneradorEjercicios(azarConSemilla(s)).generarRonda(vocales, historial).filter((e) => e.objetivo === "o").length;
      sinHistorial += new GeneradorEjercicios(azarConSemilla(s)).generarRonda(vocales, []).filter((e) => e.objetivo === "o").length;
    }
    assert.ok(conFallos > sinHistorial * 2, `con fallos ${conFallos}, sin historial ${sinHistorial}`);
  });
  await probar("con dominio (80 % o más) se muestran 4 opciones en lugar de 3", () => {
    const bien = Array.from({ length: 10 }, (_, i) => ({ objetivo: "aeiou"[i % 5], correcto: true }));
    const nOpciones = (h: typeof bien) => {
      const e = new GeneradorEjercicios(azarConSemilla(3)).generarRonda(vocales, h)[0];
      return e.tipo === "elegir" ? e.opciones.length : -1;
    };
    assert.strictEqual(nOpciones([]), 3);
    assert.strictEqual(nOpciones(bien), 4);
  });

  // ------------------------------------------------------------ 3. armado de la ruta
  console.log("Armado de la ruta");
  const constructor = new ConstructorRuta();
  const porCodigo = (c: string) => lecciones.find((l) => l.codigo === c)!;
  const reglaId = async (codigo: string) => (await db.query(`SELECT id, condicion_texto FROM reglas WHERE codigo = $1`, [codigo])).rows[0];
  const r5 = await reglaId("R5");
  const r12 = await reglaId("R12");

  await probar("los refuerzos quedan ligados a su regla y en orden pedagógico", () => {
    const pasos = constructor.construir(lecciones, {
      usuarioId: 1, completada: true,
      reglasPlan: [{ id: r12.id, codigo: "R12", condicion: "" }, { id: r5.id, codigo: "R5", condicion: "" }],
      nodosDominados: [], modulosPorTrabajar: [2, 3, 4],
    });
    const codigos = pasos.map((p) => lecciones.find((l) => l.id === p.leccionId)!.codigo);
    assert.deepStrictEqual(codigos.slice(0, 3), ["LA5", "LB1", "LB2"]);
    assert.strictEqual(pasos[0].reglaId, r5.id);
    assert.strictEqual(pasos[0].origen, "refuerzo");
    assert.strictEqual(pasos[2].reglaId, r12.id);
    assert.ok(!codigos.some((c) => c.startsWith("LA") && c !== "LA5"), "incluye lecciones del módulo A que no hacen falta");
    assert.strictEqual(pasos.filter((p) => p.estado === "disponible").length, 1);
    assert.strictEqual(pasos[0].estado, "disponible");
  });
  await probar("lo que la persona ya domina se marca superado por el diagnóstico", () => {
    const pasos = constructor.construir(lecciones, {
      usuarioId: 1, completada: true, reglasPlan: [], nodosDominados: porCodigo("LB3").nodoIds, modulosPorTrabajar: [2],
    });
    const lb3 = pasos.find((p) => p.leccionId === porCodigo("LB3").id)!;
    assert.strictEqual(lb3.estado, "superada");
    assert.strictEqual(lb3.origen, "diagnostico");
    assert.strictEqual(pasos.find((p) => p.estado === "disponible")!.leccionId, porCodigo("LB1").id);
  });
  await probar("con la alfabetización lograda queda el último módulo como repaso libre", () => {
    const pasos = constructor.construir(lecciones, {
      usuarioId: 1, completada: true, reglasPlan: [], nodosDominados: [], modulosPorTrabajar: [],
    });
    assert.ok(pasos.length > 0 && pasos.every((p) => p.origen === "repaso" && p.estado === "disponible"));
  });

  // ------------------------------------------------------------ 4. recorrido por HTTP
  console.log("Recorrido por la API");
  const conocimiento = new ConocimientoRepositorioPg(db);
  const servicio = new ServicioDiagnostico(conocimiento, new EvaluacionRepositorioPg(db));
  const servidor = crearApp(
    new ControladorApi(servicio, conocimiento),
    new ControladorAprendizaje(new ServicioAprendizaje(repo)),
  ).listen(0);
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  const http = async (metodo: string, ruta: string, cuerpo?: unknown) => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: cuerpo !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
    });
    let json: Json = null;
    try { json = await r.json(); } catch { /* sin cuerpo */ }
    return { estado: r.status, json };
  };

  try {
    let e: Json = (await http("POST", "/api/evaluaciones", { alias: PREFIJO + "ruta" })).json;
    const evaluacionId = e.evaluacionId;

    await probar("no se puede crear la ruta de una evaluación sin terminar", async () => {
      assert.strictEqual((await http("POST", `/api/evaluaciones/${evaluacionId}/ruta`)).estado, 409);
    });
    for (let i = 0; e.estado === "en_curso" && i < 30; i++) {
      e = (await http("POST", `/api/evaluaciones/${evaluacionId}/respuestas`, { ramaId: e.pregunta.opciones[0].ramaId })).json;
    }

    const creada = await http("POST", `/api/evaluaciones/${evaluacionId}/ruta`);
    const clave: string = creada.json?.clave;
    const ruta: Json = creada.json?.ruta;
    await probar("crea la ruta con una clave aleatoria y una sola lección disponible", () => {
      assert.strictEqual(creada.estado, 201);
      assert.match(clave, /^[0-9a-f-]{36}$/);
      assert.ok(ruta.total > 0);
      assert.strictEqual(ruta.lecciones.filter((l: Json) => l.estado === "disponible").length, 1);
    });
    await probar("la ruta de una evaluación se crea una sola vez", async () => {
      assert.strictEqual((await http("POST", `/api/evaluaciones/${evaluacionId}/ruta`)).estado, 409);
    });
    await probar("claves inválidas o ajenas no dan acceso", async () => {
      assert.strictEqual((await http("GET", "/api/rutas/1")).estado, 404);
      assert.strictEqual((await http("GET", "/api/rutas/00000000-0000-4000-8000-000000000000")).estado, 404);
      assert.strictEqual((await http("GET", `/api/rutas/${clave}'--`)).estado, 404);
    });

    const disponible = ruta.lecciones.find((l: Json) => l.estado === "disponible");
    const bloqueada = ruta.lecciones.find((l: Json) => l.estado === "bloqueada");
    await probar("una lección bloqueada no se puede practicar", async () => {
      assert.strictEqual((await http("POST", `/api/rutas/${clave}/lecciones/${bloqueada.id}/rondas`)).estado, 409);
    });

    const ronda = (await http("POST", `/api/rutas/${clave}/lecciones/${disponible.id}/rondas`)).json;
    const url = `/api/rutas/${clave}/lecciones/${disponible.id}/resultados`;
    await probar("rechaza resultados que no corresponden a la lección", async () => {
      assert.strictEqual((await http("POST", url, { resultados: [{ objetivo: "zzz", correcto: true }] })).estado, 400);
      assert.strictEqual((await http("POST", url, { resultados: [] })).estado, 400);
      assert.strictEqual((await http("POST", url, { resultados: [{ objetivo: "a", correcto: "sí" }] })).estado, 400);
    });
    await probar("con 7 de 10 la lección no se supera", async () => {
      const r = (await http("POST", url, {
        resultados: ronda.ejercicios.map((x: Json, i: number) => ({ objetivo: x.objetivo, correcto: i >= 3 })),
      })).json;
      assert.strictEqual(r.aciertos, 7);
      assert.strictEqual(r.superada, false);
      assert.strictEqual(r.siguiente, null);
      assert.ok(r.dificultades.length > 0);
    });
    await probar("una ronda incompleta no supera la lección aunque todo esté bien", async () => {
      const r = (await http("POST", url, {
        resultados: ronda.ejercicios.slice(0, 3).map((x: Json) => ({ objetivo: x.objetivo, correcto: true })),
      })).json;
      assert.strictEqual(r.superada, false);
    });
    await probar("con 8 de 10 se supera y se abre la siguiente lección", async () => {
      const r = (await http("POST", url, {
        resultados: ronda.ejercicios.map((x: Json, i: number) => ({ objetivo: x.objetivo, correcto: i >= 2 })),
      })).json;
      assert.strictEqual(r.superada, true);
      assert.ok(r.siguiente, "no se desbloqueó nada");
      const actual = r.ruta.lecciones.find((l: Json) => l.id === disponible.id);
      assert.strictEqual(actual.estado, "superada");
      assert.strictEqual(r.ruta.lecciones.find((l: Json) => l.id === r.siguiente.id).estado, "disponible");
      assert.strictEqual(r.ruta.superadas, ruta.superadas + 1);
    });
    await probar("una lección superada se puede repasar", async () => {
      assert.strictEqual((await http("POST", `/api/rutas/${clave}/lecciones/${disponible.id}/rondas`)).estado, 200);
    });
    await probar("el progreso por módulo queda guardado", async () => {
      const p = await db.query(
        `SELECT m.codigo, p.estado FROM progreso p JOIN modulos m ON m.id = p.modulo_id
          JOIN rutas r ON r.usuario_id = p.usuario_id WHERE r.clave = $1 ORDER BY m.orden`,
        [clave],
      );
      assert.ok(p.rows.some((f) => f.estado === "en_curso"), JSON.stringify(p.rows));
    });

    const iMuestras = process.argv.indexOf("--muestras");
    if (iMuestras >= 0) {
      const muestras: Record<string, Ejercicio> = {};
      for (const l of lecciones) muestras[l.tipoEjercicio] ??= new GeneradorEjercicios(azarConSemilla(11)).generarRonda(l, [])[0];
      const destino = process.argv[iMuestras + 1] ?? "muestras_ejercicios.json";
      fs.writeFileSync(destino, JSON.stringify(muestras, null, 2));
      console.log(`Muestras guardadas en ${destino}`);
    }
  } finally {
    servidor.close();
    await Conexion.cerrar();
  }

  console.log(`\n${total - fallos} de ${total} pruebas pasaron`);
  if (fallos > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
