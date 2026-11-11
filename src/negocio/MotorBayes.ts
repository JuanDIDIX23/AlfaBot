import { Creencia } from "./modelos/Hipotesis";

/**
 * Motor de inferencia bayesiano.
 *
 * No contiene reglas del dominio: solo la matemática de actualizar creencias. Todo el
 * conocimiento (qué respuesta apunta a qué hipótesis y con cuánto peso) llega desde la
 * base de conocimiento como verosimilitudes P(respuesta | hipótesis).
 *
 *   P(H | e)  =  P(e | H) · P(H)  /  Σ_k P(e | H_k) · P(H_k)
 */
export class MotorBayes {
  /** Teorema de Bayes: devuelve las nuevas creencias normalizadas tras observar una respuesta. */
  actualizar(creencias: Creencia[], verosimilitudes: Map<number, number>): Creencia[] {
    const pesos = creencias.map((c) => {
      const lik = verosimilitudes.get(c.hipotesis.id);
      if (lik === undefined) {
        throw new Error(`El gránulo no define verosimilitud para la hipótesis ${c.hipotesis.codigo}`);
      }
      return c.probabilidad * lik;
    });
    const evidencia = pesos.reduce((a, b) => a + b, 0);
    if (evidencia <= 0) {
      throw new Error("La evidencia total es cero: las verosimilitudes deben ser positivas");
    }
    return creencias.map((c, i) => new Creencia(c.hipotesis, pesos[i] / evidencia));
  }

  /** Entropía de Shannon, en bits, de una distribución de probabilidad. */
  entropia(probabilidades: number[]): number {
    return probabilidades.reduce((h, p) => (p > 0 ? h - p * Math.log2(p) : h), 0);
  }

  /** Hipótesis con mayor probabilidad. */
  masProbable(creencias: Creencia[]): Creencia {
    return creencias.reduce((mejor, c) => (c.probabilidad > mejor.probabilidad ? c : mejor));
  }
}
