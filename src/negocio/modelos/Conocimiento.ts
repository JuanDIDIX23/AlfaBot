/** Tipos de regla definidos en la base de conocimiento. */
export type TipoRegla = "avance" | "remedial" | "fin";

/** Pregunta de diagnóstico (nodo del árbol de decisión). */
export class Nodo {
  constructor(
    public readonly id: number,
    public readonly codigo: string,
    public readonly pregunta: string,
    public readonly moduloCodigo: string,
    public readonly moduloOrden: number,
    public readonly posicionEnModulo: number,
    public readonly totalEnModulo: number,
  ) {}
}

/** Respuesta posible a una pregunta (rama del árbol de decisión). */
export class Rama {
  constructor(
    public readonly id: number,
    public readonly nodoId: number,
    public readonly codigo: string,
    public readonly condicion: string,
    public readonly tipo: TipoRegla,
  ) {}
}

/**
 * Verosimilitudes de todas las respuestas posibles de un nodo:
 * verosimilitud[i][j] = P(ramas[i] | hipótesis con id hipotesisIds[j]).
 */
export class MatrizNodo {
  constructor(
    public readonly nodo: Nodo,
    public readonly ramas: Rama[],
    public readonly hipotesisIds: number[],
    public readonly verosimilitud: number[][],
  ) {}
}

/**
 * Gránulo de conocimiento: la unidad mínima que el motor consulta tras cada respuesta.
 * Une la rama elegida, su regla SI-ENTONCES y el peso que esa rama le da a cada hipótesis.
 */
export class Granulo {
  constructor(
    public readonly rama: Rama,
    public readonly reglaId: number,
    public readonly reglaCodigo: string,
    public readonly accion: string,
    public readonly moduloId: number,
    public readonly moduloCodigo: string,
    public readonly moduloOrden: number,
    /** hipotesis.id -> P(rama | hipótesis) */
    public readonly verosimilitudes: Map<number, number>,
  ) {}
}
