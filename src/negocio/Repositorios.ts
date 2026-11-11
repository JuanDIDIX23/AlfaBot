import { Creencia, Hipotesis } from "./modelos/Hipotesis";
import { Granulo, MatrizNodo, Nodo } from "./modelos/Conocimiento";
import { EstadoEvaluacion } from "./modelos/Resultados";

/**
 * Contratos que la capa de negocio exige a la capa de datos (inversión de dependencias):
 * el motor de inferencia no sabe si detrás hay PostgreSQL, Supabase u otra fuente.
 */

/** Consultas granulares a la base de conocimiento. */
export interface IConocimientoRepositorio {
  /** Consulta 1: las hipótesis y sus probabilidades a priori. */
  hipotesis(): Promise<Hipotesis[]>;
  /** Consulta 2: los nodos que aún no se han preguntado. */
  nodosPendientes(nodosRespondidos: number[]): Promise<Nodo[]>;
  /** Consulta 3: las respuestas posibles de un nodo con su verosimilitud por hipótesis. */
  matrizDeNodo(nodoId: number): Promise<MatrizNodo>;
  /** Consulta 4: el gránulo de conocimiento (regla + pesos) de la respuesta elegida. */
  granuloDeRama(ramaId: number): Promise<Granulo>;
}

/** Operaciones sobre el sistema transaccional. */
export interface IEvaluacionRepositorio {
  crearUsuario(alias: string): Promise<number>;
  crearEvaluacion(usuarioId: number): Promise<number>;
  guardarPrior(evaluacionId: number, creencias: Creencia[]): Promise<void>;
  /** Guarda la respuesta y el estado de las creencias resultante, de forma atómica. */
  registrarPaso(
    evaluacionId: number,
    nodoId: number,
    ramaId: number,
    paso: number,
    creencias: Creencia[],
  ): Promise<void>;
  guardarPlan(evaluacionId: number, granulos: Granulo[]): Promise<void>;
  actualizarProgreso(usuarioId: number, nivelHipotesis: number): Promise<void>;
  cerrarEvaluacion(evaluacionId: number): Promise<void>;
  /** Lee el estado guardado de una evaluación, o null si no existe. */
  estadoEvaluacion(evaluacionId: number): Promise<EstadoEvaluacion | null>;
}
