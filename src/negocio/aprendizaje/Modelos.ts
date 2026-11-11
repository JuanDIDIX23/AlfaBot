/** Lección de la base de conocimiento: qué se enseña y con qué generador de ejercicios. */
export interface Leccion {
  id: number;
  codigo: string;
  moduloId: number;
  moduloCodigo: string;
  moduloNombre: string;
  moduloOrden: number;
  titulo: string;
  explicacion: string;
  tipoEjercicio: string;
  parametros: ParametrosLeccion;
  orden: number;
  /** Reglas remediales que atiende (por id). */
  reglaIds: number[];
  /** Preguntas de diagnóstico (nodos) a las que corresponden esas reglas. */
  nodoIds: number[];
}

export interface ParametrosLeccion {
  letras?: string[];
  distractores?: string[];
  patron?: "directa" | "inversa" | "mixta" | "trabada";
  consonantes?: string[];
  grupos?: string[];
  pares?: [string, string][];
  silabasMin?: number;
  silabasMax?: number;
}

export type EstadoLeccion = "bloqueada" | "disponible" | "superada";
export type OrigenLeccion = "refuerzo" | "modulo" | "diagnostico" | "repaso";

/** Una lección dentro de la ruta de una persona. */
export interface LeccionEnRuta {
  id: number;
  leccion: Leccion;
  orden: number;
  /** Regla remedial que la puso en la ruta (explicabilidad), si la hay. */
  regla: { id: number; codigo: string; condicion: string } | null;
  estado: EstadoLeccion;
  origen: OrigenLeccion;
  rondas: number;
  aciertos: number;
  intentos: number;
}

export interface Ruta {
  id: number;
  usuarioId: number;
  alias: string;
  evaluacionId: number;
  lecciones: LeccionEnRuta[];
}

/** Lo que el diagnóstico dejó guardado y hace falta para armar la ruta. */
export interface DiagnosticoParaRuta {
  usuarioId: number;
  completada: boolean;
  /** Reglas remediales del plan (tabla diagnosticos), en orden. */
  reglasPlan: { id: number; codigo: string; condicion: string }[];
  /** Nodos que la persona respondió con una rama de avance (ya domina esa habilidad). */
  nodosDominados: number[];
  /** Orden de los módulos que siguen pendientes o en curso según el diagnóstico. */
  modulosPorTrabajar: number[];
}

/** Un ejercicio ya armado, listo para mostrarse. */
export type Ejercicio = EjercicioElegir | EjercicioOrdenar | EjercicioEscribir;

interface EjercicioBase {
  /** Qué se practica (letra, sílaba, palabra...): permite repetir más lo que cuesta. */
  objetivo: string;
  /** Instrucción escrita. */
  consigna: string;
  /** Lo que la voz dice al mostrar el ejercicio. */
  decir: string;
  /** Qué se muestra en grande (una letra, una palabra, un dibujo, un texto). */
  mostrar?: { texto?: string; emoji?: string; estilo?: "letra" | "palabra" | "texto" };
  /** Frase que explica la respuesta correcta (se muestra y se lee al corregir). */
  respuesta: string;
}

export interface EjercicioElegir extends EjercicioBase {
  tipo: "elegir";
  opciones: { id: string; texto?: string; emoji?: string; decir?: string }[];
  correcta: string;
  /** Si la voz debe leer también las opciones (respuestas largas, como en comprensión). */
  leerOpciones?: boolean;
}

export interface EjercicioOrdenar extends EjercicioBase {
  tipo: "ordenar";
  /** Piezas desordenadas (puede incluir una pieza que sobra). */
  piezas: string[];
  solucion: string[];
  /** Con qué se unen las piezas al mostrarlas ("" para sílabas, " " para palabras). */
  unir: string;
}

export interface EjercicioEscribir extends EjercicioBase {
  tipo: "escribir";
  solucion: string;
}

export interface ResultadoEjercicio {
  objetivo: string;
  correcto: boolean;
}

/** Resultado de una ronda de práctica: lo que se le dice a la persona al terminar. */
export interface ResumenRonda {
  aciertos: number;
  total: number;
  superada: boolean;
  /** Objetivos en que se equivocó en esta ronda. */
  dificultades: string[];
  /** Lección que se desbloqueó al superar esta, si la hay. */
  siguiente: LeccionEnRuta | null;
  rutaTerminada: boolean;
}
