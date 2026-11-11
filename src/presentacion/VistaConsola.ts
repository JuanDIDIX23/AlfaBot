import * as readline from "readline";
import { Creencia } from "../negocio/modelos/Hipotesis";
import { PasoInferencia, Pregunta, ResultadoDiagnostico } from "../negocio/modelos/Resultados";
import { IVista } from "./IVista";

/** Vista de terminal: muestra las preguntas, las opciones y el peso de las cinco hipótesis. */
export class VistaConsola implements IVista {
  private readonly rl = readline.createInterface({ input: process.stdin });
  // Iterador con búfer: sirve tanto para escritura interactiva como para entrada por tubería.
  private readonly lineas = this.rl[Symbol.asyncIterator]();

  private async preguntarTexto(texto: string): Promise<string> {
    process.stdout.write(texto);
    const siguiente = await this.lineas.next();
    if (siguiente.done) throw new Error("La entrada terminó antes de completar la evaluación");
    if (!process.stdin.isTTY) process.stdout.write(`${siguiente.value}\n`);
    return siguiente.value;
  }

  async pedirAlias(): Promise<string> {
    const alias = (await this.preguntarTexto("¿Cómo te llamas? ")).trim();
    return alias.length > 0 ? alias : "Usuario";
  }

  mostrarBienvenida(creencias: Creencia[]): void {
    console.log("\n=== AlfaBot: diagnóstico de lectoescritura ===");
    console.log("Responde cada pregunta con el número de la opción que mejor te describa.\n");
    this.mostrarBarras("Probabilidades iniciales", creencias);
  }

  async preguntar(pregunta: Pregunta, numero: number): Promise<number> {
    console.log(`\nPregunta ${numero} (módulo ${pregunta.nodo.moduloCodigo}): ${pregunta.nodo.pregunta}`);
    pregunta.opciones.forEach((o, i) => console.log(`  ${i + 1}. ${o.condicion}`));
    for (;;) {
      const entrada = await this.preguntarTexto("Tu respuesta: ");
      const indice = Number.parseInt(entrada, 10) - 1;
      if (indice >= 0 && indice < pregunta.opciones.length) return pregunta.opciones[indice].ramaId;
      console.log("Opción no válida, intenta de nuevo.");
    }
  }

  mostrarPaso(paso: PasoInferencia): void {
    this.mostrarBarras(`Probabilidades tras la respuesta ${paso.paso} (regla ${paso.reglaCodigo})`, paso.creencias);
  }

  mostrarResultado(r: ResultadoDiagnostico): void {
    console.log("\n=== Resultado ===");
    this.mostrarBarras("Probabilidad final de cada hipótesis", r.creencias);
    const g = r.ganadora;
    console.log(
      `\nDiagnóstico: ${g.hipotesis.codigo} - ${g.hipotesis.nombre} (${(g.probabilidad * 100).toFixed(1)} %)`,
    );
    console.log(g.hipotesis.descripcion);
    console.log(
      r.confianzaAlcanzada
        ? `Confianza alcanzada con ${r.preguntasRespondidas} preguntas.`
        : `Se agotaron las preguntas útiles (${r.preguntasRespondidas}); la confianza es moderada.`,
    );
    if (r.plan.length > 0) {
      console.log("\nPlan de actividades recomendado:");
      r.plan.forEach((p, i) =>
        console.log(`  ${i + 1}. [${p.reglaCodigo}] ${p.condicion}: ${p.accion}`),
      );
    } else {
      console.log("\nNo se detectaron dificultades que requieran actividades de refuerzo.");
    }
    this.rl.close();
  }

  private mostrarBarras(titulo: string, creencias: Creencia[]): void {
    console.log(`${titulo}:`);
    for (const c of creencias) {
      const largo = Math.round(c.probabilidad * 30);
      const barra = "█".repeat(largo) + "░".repeat(30 - largo);
      const nombre = `${c.hipotesis.codigo} ${c.hipotesis.nombre}`.padEnd(40);
      console.log(`  ${nombre} ${barra} ${(c.probabilidad * 100).toFixed(1).padStart(5)} %`);
    }
  }
}
