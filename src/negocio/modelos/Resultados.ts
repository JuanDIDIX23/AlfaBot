import { Creencia } from "./Hipotesis";
import { Nodo, Rama } from "./Conocimiento";

/** Una opción que el usuario puede elegir al responder una pregunta. */
export interface OpcionRespuesta {
  ramaId: number;
  codigo: string;
  condicion: string;
  tipo: string;
}

/** Pregunta que el sistema le presenta al usuario. */
export interface Pregunta {
  nodo: Nodo;
  opciones: OpcionRespuesta[];
  /** Ganancia de información esperada (en bits) que justificó elegir esta pregunta. */
  ganancia: number;
}

/** Foto del estado de las creencias después de procesar una respuesta (paso 0 = a priori). */
export interface PasoInferencia {
  paso: number;
  nodo?: Nodo;
  rama?: Rama;
  reglaCodigo?: string;
  creencias: Creencia[];
}

/** Actividad recomendada, trazable hasta la regla que la originó. */
export interface ItemPlan {
  moduloCodigo: string;
  reglaCodigo: string;
  ramaCodigo: string;
  condicion: string;
  accion: string;
}

export interface ResultadoDiagnostico {
  evaluacionId: number;
  ganadora: Creencia;
  /** Las 5 hipótesis ordenadas de mayor a menor probabilidad. */
  creencias: Creencia[];
  preguntasRespondidas: number;
  confianzaAlcanzada: boolean;
  plan: ItemPlan[];
  historial: PasoInferencia[];
}

/**
 * Estado de una evaluación tal como quedó guardado en el sistema transaccional.
 * Permite reanudarla en otra petición (un servicio web en la nube no conserva memoria entre llamadas).
 */
export interface EstadoEvaluacion {
  usuarioId: number;
  estado: "en_curso" | "completada";
  /** Respuestas dadas, en el orden en que se registraron. */
  respuestas: { nodoId: number; ramaId: number }[];
  /** Probabilidades del último paso registrado. */
  creencias: { hipotesisId: number; probabilidad: number }[];
}

/** Usuario reconocido: la clave aleatoria es lo que el navegador guarda para volver a identificarlo. */
export interface UsuarioIdentificado {
  id: number;
  alias: string;
  clave: string;
  /** true si se creó en esta petición; false si ya existía (misma clave). */
  nuevo: boolean;
}

/** Una evaluación tal como aparece en el historial del usuario. */
export interface EvaluacionHistorial {
  evaluacionId: number;
  fechaInicio: Date;
  fechaFin: Date | null;
  estado: "en_curso" | "completada";
  preguntasRespondidas: number;
  /** Nivel más probable en el último paso guardado (el diagnóstico, si la evaluación terminó). */
  ganadora: { codigo: string; nombre: string; probabilidad: number } | null;
}

export interface HistorialUsuario {
  alias: string;
  /** De la más reciente a la más antigua. */
  evaluaciones: EvaluacionHistorial[];
  /** Estado más reciente en cada módulo. */
  progreso: { moduloCodigo: string; moduloNombre: string; estado: "pendiente" | "en_curso" | "superado" }[];
}
