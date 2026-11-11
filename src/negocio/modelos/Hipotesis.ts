/**
 * Una hipótesis diagnóstica: el nivel de lectoescritura del usuario.
 * El conocimiento (nombre, descripción, nivel, probabilidad a priori) viene de la base de conocimiento.
 */
export class Hipotesis {
  constructor(
    public readonly id: number,
    public readonly codigo: string,
    public readonly nombre: string,
    public readonly descripcion: string,
    public readonly nivel: number,
    public readonly prior: number,
  ) {}
}

/** Peso probabilístico de una hipótesis en un momento dado de la evaluación. */
export class Creencia {
  constructor(
    public readonly hipotesis: Hipotesis,
    public readonly probabilidad: number,
  ) {}
}
