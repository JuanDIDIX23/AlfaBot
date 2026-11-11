import * as fs from "fs";
import * as assert from "assert";
import { Conexion } from "../datos/Conexion";
import { ConocimientoRepositorioPg } from "../datos/ConocimientoRepositorioPg";
import { EvaluacionRepositorioPg } from "../datos/EvaluacionRepositorioPg";
import { ServicioDiagnostico } from "../negocio/ServicioDiagnostico";
import { MotorBayes } from "../negocio/MotorBayes";
import { SelectorPregunta } from "../negocio/SelectorPregunta";
import { Creencia, Hipotesis } from "../negocio/modelos/Hipotesis";
import { MatrizNodo, Nodo, Rama } from "../negocio/modelos/Conocimiento";
import { ControladorDiagnostico } from "../presentacion/ControladorDiagnostico";
import { ResultadoDiagnostico } from "../negocio/modelos/Resultados";
import { DefinicionPerfil, PerfilSimulado } from "./PerfilSimulado";
import { VistaGuionada } from "./VistaGuionada";

const PREFIJO = "prueba:";

// ---------------------------------------------------------------- pruebas unitarias del motor
function pruebasMotor(): { nombre: string; ok: boolean }[] {
  const motor = new MotorBayes();
  const selector = new SelectorPregunta(motor);
  const hip = [1, 2, 3].map((i) => new Hipotesis(i, `H${i}`, `Hipótesis ${i}`, "", i, 1 / 3));
  const creencias = hip.map((h) => new Creencia(h, 1 / 3));
  const resultados: { nombre: string; ok: boolean }[] = [];
  const probar = (nombre: string, f: () => void) => {
    try {
      f();
      resultados.push({ nombre, ok: true });
    } catch {
      resultados.push({ nombre, ok: false });
    }
  };

  probar("Bayes: el posterior suma 1", () => {
    const post = motor.actualizar(creencias, new Map([[1, 0.9], [2, 0.3], [3, 0.1]]));
    assert.ok(Math.abs(post.reduce((s, c) => s + c.probabilidad, 0) - 1) < 1e-12);
  });
  probar("Bayes: la hipótesis con mayor verosimilitud sube", () => {
    const post = motor.actualizar(creencias, new Map([[1, 0.9], [2, 0.3], [3, 0.1]]));
    assert.ok(post[0].probabilidad > post[1].probabilidad && post[1].probabilidad > post[2].probabilidad);
  });
  probar("Bayes: el orden de las respuestas no altera el resultado", () => {
    const a = new Map([[1, 0.9], [2, 0.3], [3, 0.1]]);
    const b = new Map([[1, 0.2], [2, 0.7], [3, 0.5]]);
    const ab = motor.actualizar(motor.actualizar(creencias, a), b);
    const ba = motor.actualizar(motor.actualizar(creencias, b), a);
    ab.forEach((c, i) => assert.ok(Math.abs(c.probabilidad - ba[i].probabilidad) < 1e-12));
  });
  probar("Ganancia: una pregunta que no distingue hipótesis aporta 0 bits", () => {
    const nodo = new Nodo(1, "X1", "?", "A", 1, 1, 1);
    const ramas = [new Rama(1, 1, "X1.1", "a", "avance"), new Rama(2, 1, "X1.2", "b", "remedial")];
    const m = new MatrizNodo(nodo, ramas, [1, 2, 3], [[0.7, 0.7, 0.7], [0.3, 0.3, 0.3]]);
    assert.ok(Math.abs(selector.gananciaEsperada(creencias, m)) < 1e-12);
  });
  probar("Ganancia: una pregunta que separa las hipótesis aporta bits positivos", () => {
    const nodo = new Nodo(1, "X1", "?", "A", 1, 1, 1);
    const ramas = [new Rama(1, 1, "X1.1", "a", "avance"), new Rama(2, 1, "X1.2", "b", "remedial")];
    const m = new MatrizNodo(nodo, ramas, [1, 2, 3], [[0.95, 0.5, 0.05], [0.05, 0.5, 0.95]]);
    assert.ok(selector.gananciaEsperada(creencias, m) > 0.3);
  });
  return resultados;
}

// ---------------------------------------------------------------- escenarios con usuarios simulados
interface Escenario extends DefinicionPerfil {
  grupo: string;
}

const escenarios: Escenario[] = [
  // El usuario falla desde el primer nodo de su módulo en curso
  ...[1, 2, 3, 4, 5].map((n) => ({ grupo: "Falla al inicio de su módulo", nombre: `Nivel ${n}, falla al inicio`, nivel: n })),
  // El usuario avanza casi todo su módulo y falla solo en el último nodo
  ...[
    [1, 3],
    [2, 4],
    [3, 3],
    [4, 4],
  ].map(([n, q]) => ({
    grupo: "Falla solo en el último nodo de su módulo",
    nombre: `Nivel ${n}, falla en el último nodo`,
    nivel: n,
    puntoQuiebre: q,
  })),
  // El usuario comete un error aislado en la pregunta 2 o 3
  ...[2, 3, 4].flatMap((n) =>
    [2, 3].map((d) => ({
      grupo: "Un desliz aislado del usuario",
      nombre: `Nivel ${n}, desliz en la pregunta ${d}`,
      nivel: n,
      deslices: [d],
    })),
  ),
];

interface FilaResultado {
  grupo: string;
  perfil: string;
  esperada: string;
  obtenida: string;
  probabilidad: number;
  preguntas: number;
  confianza: boolean;
  correcta: boolean;
}

async function correr(servicio: ServicioDiagnostico, alias: string, perfil: PerfilSimulado) {
  const vista = new VistaGuionada(alias, perfil.responder);
  const resultado = await new ControladorDiagnostico(servicio, vista).ejecutar();
  return resultado;
}

async function limpiar(): Promise<void> {
  const db = Conexion.obtener();
  const sub = `(SELECT id FROM evaluaciones WHERE usuario_id IN (SELECT id FROM usuarios WHERE alias LIKE '${PREFIJO}%'))`;
  await db.query(`DELETE FROM inferencias WHERE evaluacion_id IN ${sub}`);
  await db.query(`DELETE FROM respuestas WHERE evaluacion_id IN ${sub}`);
  await db.query(`DELETE FROM diagnosticos WHERE evaluacion_id IN ${sub}`);
  await db.query(`DELETE FROM evaluaciones WHERE usuario_id IN (SELECT id FROM usuarios WHERE alias LIKE '${PREFIJO}%')`);
  await db.query(`DELETE FROM progreso WHERE usuario_id IN (SELECT id FROM usuarios WHERE alias LIKE '${PREFIJO}%')`);
  await db.query(`DELETE FROM usuarios WHERE alias LIKE '${PREFIJO}%'`);
}

async function main(): Promise<void> {
  const db = Conexion.obtener();
  const servicio = new ServicioDiagnostico(new ConocimientoRepositorioPg(db), new EvaluacionRepositorioPg(db));

  await limpiar();

  // 1. Motor
  const unitarias = pruebasMotor();
  console.log("\n== Pruebas del motor ==");
  unitarias.forEach((u) => console.log(`  ${u.ok ? "OK " : "FALLA"}  ${u.nombre}`));

  // 2. Escenarios
  console.log("\n== Escenarios con usuarios simulados ==");
  const filas: FilaResultado[] = [];
  let ultimoGrupo = "";
  for (const e of escenarios) {
    const r: ResultadoDiagnostico = await correr(servicio, `${PREFIJO}${e.nombre}`, new PerfilSimulado(e));
    const esperada = `H${e.nivel}`;
    const fila: FilaResultado = {
      grupo: e.grupo,
      perfil: e.nombre,
      esperada,
      obtenida: r.ganadora.hipotesis.codigo,
      probabilidad: r.ganadora.probabilidad,
      preguntas: r.preguntasRespondidas,
      confianza: r.confianzaAlcanzada,
      correcta: r.ganadora.hipotesis.codigo === esperada,
    };
    filas.push(fila);
    if (e.grupo !== ultimoGrupo) {
      console.log(`\n  ${e.grupo}`);
      ultimoGrupo = e.grupo;
    }
    console.log(
      `    ${fila.correcta ? "OK " : "FALLA"}  ${e.nombre.padEnd(34)} esperada ${esperada}  obtenida ${fila.obtenida}` +
        `  (${(fila.probabilidad * 100).toFixed(1)} %, ${fila.preguntas} preguntas${fila.confianza ? "" : ", sin alcanzar umbral"})`,
    );
  }

  // 3. Traza completa de una evaluación, para documentar el comportamiento paso a paso
  const perfilTraza = new PerfilSimulado({ nombre: "Traza", nivel: 2, puntoQuiebre: 1, falla: 1 });
  const vistaTraza = new VistaGuionada(`${PREFIJO}traza`, perfilTraza.responder);
  const rTraza = await new ControladorDiagnostico(servicio, vistaTraza).ejecutar();
  console.log("\n== Traza de una evaluación (usuario de nivel 2) ==");
  const traza = rTraza.historial.map((p) => ({
    paso: p.paso,
    nodo: p.nodo?.codigo ?? "-",
    pregunta: p.nodo?.pregunta ?? "Probabilidades a priori",
    respuesta: p.rama?.condicion ?? "-",
    regla: p.reglaCodigo ?? "-",
    probabilidades: Object.fromEntries(p.creencias.map((c) => [c.hipotesis.codigo, Number(c.probabilidad.toFixed(4))])),
  }));
  traza.forEach((t) =>
    console.log(
      `  paso ${t.paso} ${t.nodo.padEnd(3)} ${t.regla.padEnd(4)} ` +
        Object.entries(t.probabilidades).map(([h, p]) => `${h}=${(p * 100).toFixed(1)}%`).join("  "),
    ),
  );

  // 4. Verificación de persistencia
  const id = rTraza.evaluacionId;
  const cuenta = async (sql: string) => Number((await db.query(sql, [id])).rows[0].n);
  const persistencia = {
    respuestas: await cuenta("SELECT count(*)::int AS n FROM respuestas WHERE evaluacion_id = $1"),
    inferencias: await cuenta("SELECT count(*)::int AS n FROM inferencias WHERE evaluacion_id = $1"),
    diagnosticos: await cuenta("SELECT count(*)::int AS n FROM diagnosticos WHERE evaluacion_id = $1"),
    progreso: await cuenta(
      "SELECT count(*)::int AS n FROM progreso WHERE usuario_id = (SELECT usuario_id FROM evaluaciones WHERE id = $1)",
    ),
    estado: (await db.query("SELECT estado FROM evaluaciones WHERE id = $1", [id])).rows[0].estado as string,
  };
  const esperadoInferencias = (rTraza.preguntasRespondidas + 1) * 5;
  const persistenciaOk =
    persistencia.respuestas === rTraza.preguntasRespondidas &&
    persistencia.inferencias === esperadoInferencias &&
    persistencia.diagnosticos === rTraza.plan.length &&
    persistencia.progreso === 4 &&
    persistencia.estado === "completada";
  console.log("\n== Persistencia en la base transaccional ==");
  console.log(`  ${persistenciaOk ? "OK " : "FALLA"}  ${JSON.stringify(persistencia)} (inferencias esperadas: ${esperadoInferencias})`);

  const progreso = (
    await db.query(
      `SELECT m.codigo, p.estado FROM progreso p JOIN modulos m ON m.id = p.modulo_id
        WHERE p.usuario_id = (SELECT usuario_id FROM evaluaciones WHERE id = $1) ORDER BY m.orden`,
      [id],
    )
  ).rows;

  const totales = {
    unitariasOk: unitarias.filter((u) => u.ok).length,
    unitarias: unitarias.length,
    escenariosOk: filas.filter((f) => f.correcta).length,
    escenarios: filas.length,
  };
  console.log(
    `\nResumen: ${totales.unitariasOk}/${totales.unitarias} pruebas del motor, ` +
      `${totales.escenariosOk}/${totales.escenarios} escenarios con diagnóstico correcto.`,
  );

  fs.writeFileSync(
    "resultados_pruebas.json",
    JSON.stringify({ unitarias, filas, traza, planTraza: rTraza.plan, persistencia, persistenciaOk, progreso, totales }, null, 2),
  );

  await limpiar();
  await Conexion.cerrar();
}

main().catch(async (e) => {
  console.error(e);
  await Conexion.cerrar();
  process.exit(1);
});
