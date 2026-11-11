import { Creencia } from "./modelos/Hipotesis";
import { MatrizNodo } from "./modelos/Conocimiento";
import { MotorBayes } from "./MotorBayes";

export interface CandidataPregunta {
  matriz: MatrizNodo;
  /** Reducción esperada de incertidumbre, en bits. */
  ganancia: number;
}

/**
 * Elige la siguiente pregunta de forma adaptativa, sin recorrer el árbol en un orden fijo.
 *
 * Para cada nodo pendiente calcula la ganancia de información esperada:
 *
 *   G(nodo) = H(creencias actuales) − Σ_r P(r) · H(creencias tras observar r)
 *
 * y elige el nodo con mayor ganancia: la pregunta que mejor separa las hipótesis que
 * todavía compiten. Las verosimilitudes P(r | H) se leen de la base de conocimiento.
 */
export class SelectorPregunta {
  constructor(private readonly motor: MotorBayes) {}

  gananciaEsperada(creencias: Creencia[], matriz: MatrizNodo): number {
    const priors = matriz.hipotesisIds.map((id) => {
      const c = creencias.find((x) => x.hipotesis.id === id);
      if (!c) throw new Error(`Falta la creencia de la hipótesis ${id}`);
      return c.probabilidad;
    });
    const hActual = this.motor.entropia(priors);

    let hEsperada = 0;
    for (const fila of matriz.verosimilitud) {
      const conjunta = fila.map((lik, j) => lik * priors[j]);
      const pRespuesta = conjunta.reduce((a, b) => a + b, 0);
      if (pRespuesta <= 0) continue;
      const posterior = conjunta.map((v) => v / pRespuesta);
      hEsperada += pRespuesta * this.motor.entropia(posterior);
    }
    return hActual - hEsperada;
  }

  elegir(creencias: Creencia[], matrices: MatrizNodo[]): CandidataPregunta | null {
    let mejor: CandidataPregunta | null = null;
    for (const matriz of matrices) {
      const ganancia = this.gananciaEsperada(creencias, matriz);
      if (mejor === null || ganancia > mejor.ganancia) {
        mejor = { matriz, ganancia };
      }
    }
    return mejor;
  }
}
