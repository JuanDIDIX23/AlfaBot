import { randomUUID } from "crypto";
import { ConstructorRuta, PasoRuta } from "./ConstructorRuta";
import { EJERCICIOS_POR_RONDA, GeneradorEjercicios, HISTORIAL_ADAPTATIVO, UMBRAL_SUPERACION } from "./GeneradorEjercicios";
import {
  DiagnosticoParaRuta, Ejercicio, Leccion, LeccionEnRuta, ResultadoEjercicio, ResumenRonda, Ruta,
} from "./Modelos";

/** Contrato que el módulo de aprendizaje exige a la capa de datos. */
export interface IAprendizajeRepositorio {
  /** Las lecciones de la base de conocimiento con sus reglas y nodos. */
  lecciones(): Promise<Leccion[]>;
  /** Lo que dejó guardado una evaluación, o null si no existe. */
  diagnosticoParaRuta(evaluacionId: number): Promise<DiagnosticoParaRuta | null>;
  /** Crea la ruta; devuelve false si esa evaluación ya tenía una. */
  crearRuta(usuarioId: number, evaluacionId: number, clave: string, pasos: PasoRuta[]): Promise<boolean>;
  rutaPorClave(clave: string): Promise<Ruta | null>;
  /** Intentos de una lección de la ruta, del más reciente al más antiguo. */
  intentosRecientes(rutaLeccionId: number, limite: number): Promise<ResultadoEjercicio[]>;
  /**
   * Guarda la ronda de forma atómica: los intentos, los contadores, el nuevo estado de la lección,
   * el desbloqueo de la siguiente y el progreso por módulo.
   */
  registrarRonda(ruta: Ruta, leccion: LeccionEnRuta, resultados: ResultadoEjercicio[], superada: boolean): Promise<void>;
}

/** Error de uso del módulo (no de programación): el mensaje se le puede mostrar a la persona. */
export class ErrorAprendizaje extends Error {
  constructor(
    public readonly motivo: "no_existe" | "no_terminada" | "ya_existe" | "bloqueada" | "invalido",
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/**
 * Fachada del módulo de aprendizaje: arma la ruta a partir del diagnóstico, genera las rondas de
 * ejercicios y califica lo practicado.
 */
export class ServicioAprendizaje {
  private readonly constructorRuta = new ConstructorRuta();
  private catalogo: Promise<Leccion[]> | null = null;

  constructor(
    private readonly repo: IAprendizajeRepositorio,
    private readonly generador: GeneradorEjercicios = new GeneradorEjercicios(),
    private readonly crearClave: () => string = randomUUID,
  ) {}

  /** Las lecciones no cambian mientras el servicio está arriba: se leen una vez. */
  private lecciones(): Promise<Leccion[]> {
    if (this.catalogo === null) {
      this.catalogo = this.repo.lecciones().catch((e) => {
        this.catalogo = null;
        throw e;
      });
    }
    return this.catalogo;
  }

  /** Crea la ruta de una evaluación terminada. La clave que devuelve es la única forma de volver a ella. */
  async crearRuta(evaluacionId: number): Promise<{ clave: string; ruta: Ruta }> {
    const diagnostico = await this.repo.diagnosticoParaRuta(evaluacionId);
    if (diagnostico === null) throw new ErrorAprendizaje("no_existe", "No existe esa evaluación");
    if (!diagnostico.completada) throw new ErrorAprendizaje("no_terminada", "Primero termina la evaluación");

    const pasos = this.constructorRuta.construir(await this.lecciones(), diagnostico);
    const clave = this.crearClave();
    const creada = await this.repo.crearRuta(diagnostico.usuarioId, evaluacionId, clave, pasos);
    if (!creada) throw new ErrorAprendizaje("ya_existe", "Esa evaluación ya tiene su plan de aprendizaje");

    const ruta = await this.repo.rutaPorClave(clave);
    if (ruta === null) throw new Error("La ruta recién creada no se pudo leer");
    return { clave, ruta };
  }

  async ruta(clave: string): Promise<Ruta> {
    const ruta = await this.repo.rutaPorClave(clave);
    if (ruta === null) throw new ErrorAprendizaje("no_existe", "No encontré tu plan de aprendizaje");
    return ruta;
  }

  /** Arma una ronda nueva de ejercicios para una lección disponible o ya superada (repaso). */
  async nuevaRonda(clave: string, rutaLeccionId: number): Promise<{ leccion: LeccionEnRuta; ejercicios: Ejercicio[] }> {
    const { leccion } = await this.leccionDeRuta(clave, rutaLeccionId);
    const historial = await this.repo.intentosRecientes(leccion.id, HISTORIAL_ADAPTATIVO);
    return { leccion, ejercicios: this.generador.generarRonda(leccion.leccion, historial) };
  }

  /** Califica una ronda: con 80 % de aciertos o más la lección queda superada y se abre la siguiente. */
  async terminarRonda(clave: string, rutaLeccionId: number, resultados: ResultadoEjercicio[]): Promise<ResumenRonda> {
    const { ruta, leccion } = await this.leccionDeRuta(clave, rutaLeccionId);
    if (resultados.length === 0 || resultados.length > EJERCICIOS_POR_RONDA) {
      throw new ErrorAprendizaje("invalido", "Los resultados de la ronda no son válidos");
    }
    const validos = new Set(this.generador.objetivos(leccion.leccion));
    if (resultados.some((r) => !validos.has(r.objetivo))) {
      throw new ErrorAprendizaje("invalido", "Los resultados no corresponden a esta lección");
    }

    const aciertos = resultados.filter((r) => r.correcto).length;
    // Para superar la lección hace falta una ronda completa: no vale cortar después de 2 aciertos.
    const superada = resultados.length === EJERCICIOS_POR_RONDA && aciertos / resultados.length >= UMBRAL_SUPERACION;
    await this.repo.registrarRonda(ruta, leccion, resultados, superada);

    const despues = await this.ruta(clave);
    const antes = new Map(ruta.lecciones.map((l) => [l.id, l.estado]));
    const siguiente = despues.lecciones.find((l) => l.estado === "disponible" && antes.get(l.id) === "bloqueada") ?? null;
    return {
      aciertos,
      total: resultados.length,
      superada,
      dificultades: [...new Set(resultados.filter((r) => !r.correcto).map((r) => r.objetivo))],
      siguiente,
      rutaTerminada: despues.lecciones.every((l) => l.estado === "superada"),
    };
  }

  private async leccionDeRuta(clave: string, rutaLeccionId: number): Promise<{ ruta: Ruta; leccion: LeccionEnRuta }> {
    const ruta = await this.ruta(clave);
    const leccion = ruta.lecciones.find((l) => l.id === rutaLeccionId);
    if (!leccion) throw new ErrorAprendizaje("no_existe", "Esa lección no está en tu plan");
    if (leccion.estado === "bloqueada") {
      throw new ErrorAprendizaje("bloqueada", "Esa lección todavía está bloqueada: primero supera la anterior");
    }
    return { ruta, leccion };
  }
}
