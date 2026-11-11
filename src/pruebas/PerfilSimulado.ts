import { Pregunta } from "../negocio/modelos/Resultados";

/**
 * Usuario simulado con un nivel de lectoescritura conocido (1..5).
 *
 *  - En los módulos que ya superó responde con la rama de avance.
 *  - En su módulo en curso avanza hasta antes de `puntoQuiebre` y falla desde ahí.
 *  - En los módulos que no alcanzó responde con una rama de falla.
 *  - `deslices` son números de pregunta en los que responde lo contrario de lo esperado
 *    (un error aislado del usuario).
 */
export interface DefinicionPerfil {
  nombre: string;
  nivel: number;
  puntoQuiebre?: number;
  falla?: number;
  deslices?: number[];
}

export class PerfilSimulado {
  constructor(public readonly def: DefinicionPerfil) {}

  responder = (pregunta: Pregunta, numero: number): number => {
    const { nivel, puntoQuiebre = 1, falla = 0, deslices = [] } = this.def;
    const nodo = pregunta.nodo;
    const avance = pregunta.opciones.find((o) => o.tipo !== "remedial");
    const fallas = pregunta.opciones.filter((o) => o.tipo === "remedial");
    if (!avance || fallas.length === 0) throw new Error(`El nodo ${nodo.codigo} no tiene avance y fallas`);

    let avanza: boolean;
    if (nodo.moduloOrden < nivel) avanza = true;
    else if (nodo.moduloOrden > nivel) avanza = false;
    else avanza = nodo.posicionEnModulo < puntoQuiebre;

    if (deslices.includes(numero)) avanza = !avanza;

    return avanza ? avance.ramaId : fallas[Math.min(falla, fallas.length - 1)].ramaId;
  };
}
