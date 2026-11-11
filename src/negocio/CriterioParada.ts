import { Creencia } from "./modelos/Hipotesis";

/** Decide cuándo el sistema ya tiene suficiente confianza para dar el diagnóstico. */
export class CriterioParada {
  constructor(
    /** Probabilidad que debe alcanzar la hipótesis líder. */
    public readonly umbralConfianza: number = 0.9,
    /** Mínimo de preguntas antes de permitir parar: evita que un solo desliz del usuario decida el diagnóstico. */
    public readonly minimoPreguntas: number = 5,
    /** Ganancia (bits) por debajo de la cual preguntar más ya no aporta. */
    public readonly gananciaMinima: number = 0.001,
  ) {}

  alcanzoConfianza(creencias: Creencia[], preguntasRespondidas: number): boolean {
    if (preguntasRespondidas < this.minimoPreguntas) return false;
    const lider = Math.max(...creencias.map((c) => c.probabilidad));
    return lider >= this.umbralConfianza;
  }

  gananciaSuficiente(ganancia: number): boolean {
    return ganancia >= this.gananciaMinima;
  }
}
