import { Creencia } from "./modelos/Hipotesis";
import { Granulo, MatrizNodo } from "./modelos/Conocimiento";
import { PasoInferencia, Pregunta, ResultadoDiagnostico } from "./modelos/Resultados";
import { IConocimientoRepositorio, IEvaluacionRepositorio } from "./Repositorios";
import { MotorBayes } from "./MotorBayes";
import { SelectorPregunta } from "./SelectorPregunta";
import { CriterioParada } from "./CriterioParada";
import { GeneradorPlan } from "./GeneradorPlan";

export interface DependenciasSesion {
  conocimiento: IConocimientoRepositorio;
  evaluaciones: IEvaluacionRepositorio;
  motor: MotorBayes;
  selector: SelectorPregunta;
  criterio: CriterioParada;
  generador: GeneradorPlan;
}

/**
 * Una evaluación en curso. Mantiene el estado probabilístico y, en cada ciclo, hace
 * consultas sucesivas y granulares a la base de conocimiento:
 *
 *   siguientePregunta():  nodos pendientes  ->  matriz de verosimilitudes de cada uno
 *   responder():          gránulo de la respuesta elegida  ->  actualización bayesiana
 *   finalizar():          plan de actividades a partir de los gránulos activados
 */
export class SesionDiagnostico {
  private creencias: Creencia[];
  private readonly nodosRespondidos: number[] = [];
  private readonly granulos: Granulo[] = [];
  private readonly historial: PasoInferencia[];
  private paso = 0;
  private preguntaActual: Pregunta | null = null;

  constructor(
    /** Dueño de la evaluación: la API solo deja verla y responderla a este usuario. */
    public readonly usuarioId: number,
    public readonly evaluacionId: number,
    creencias: Creencia[],
    private readonly dep: DependenciasSesion,
    /** Estado ya guardado, cuando la sesión se reanuda en otra petición. */
    restaurado?: { nodosRespondidos: number[]; granulos: Granulo[] },
  ) {
    this.creencias = creencias;
    if (restaurado) {
      this.nodosRespondidos.push(...restaurado.nodosRespondidos);
      this.granulos.push(...restaurado.granulos);
      this.paso = restaurado.nodosRespondidos.length;
    }
    // En una sesión reanudada el historial arranca en el paso actual: los pasos anteriores están en la tabla inferencias.
    this.historial = [{ paso: this.paso, creencias }];
  }

  get creenciasActuales(): Creencia[] {
    return this.creencias;
  }

  get preguntasRespondidas(): number {
    return this.nodosRespondidos.length;
  }

  /** Devuelve la siguiente pregunta, o null si ya hay confianza suficiente o no queda nada útil por preguntar. */
  async siguientePregunta(): Promise<Pregunta | null> {
    const { conocimiento, selector, criterio } = this.dep;

    if (criterio.alcanzoConfianza(this.creencias, this.nodosRespondidos.length)) return null;

    const pendientes = await conocimiento.nodosPendientes(this.nodosRespondidos);
    if (pendientes.length === 0) return null;

    const matrices: MatrizNodo[] = [];
    for (const nodo of pendientes) {
      matrices.push(await conocimiento.matrizDeNodo(nodo.id));
    }

    const mejor = selector.elegir(this.creencias, matrices);
    if (mejor === null || !criterio.gananciaSuficiente(mejor.ganancia)) return null;

    this.preguntaActual = {
      nodo: mejor.matriz.nodo,
      ganancia: mejor.ganancia,
      opciones: mejor.matriz.ramas.map((r) => ({
        ramaId: r.id,
        codigo: r.codigo,
        condicion: r.condicion,
        tipo: r.tipo,
      })),
    };
    return this.preguntaActual;
  }

  /** Registra la respuesta del usuario y actualiza el peso de las cinco hipótesis. */
  async responder(ramaId: number): Promise<PasoInferencia> {
    const pregunta = this.preguntaActual;
    if (pregunta === null) throw new Error("No hay una pregunta pendiente de respuesta");
    if (!pregunta.opciones.some((o) => o.ramaId === ramaId)) {
      throw new Error("La respuesta no pertenece a la pregunta actual");
    }

    const granulo = await this.dep.conocimiento.granuloDeRama(ramaId);
    this.creencias = this.dep.motor.actualizar(this.creencias, granulo.verosimilitudes);
    this.paso += 1;
    this.nodosRespondidos.push(pregunta.nodo.id);
    this.granulos.push(granulo);

    await this.dep.evaluaciones.registrarPaso(
      this.evaluacionId,
      pregunta.nodo.id,
      ramaId,
      this.paso,
      this.creencias,
    );

    const registro: PasoInferencia = {
      paso: this.paso,
      nodo: pregunta.nodo,
      rama: granulo.rama,
      reglaCodigo: granulo.reglaCodigo,
      creencias: this.creencias,
    };
    this.historial.push(registro);
    this.preguntaActual = null;
    return registro;
  }

  /** Cierra la evaluación: diagnóstico, plan de actividades y progreso del usuario. */
  async finalizar(): Promise<ResultadoDiagnostico> {
    const { ganadora, activados } = this.seleccionarPlan();
    const { evaluaciones } = this.dep;

    await evaluaciones.guardarPlan(this.evaluacionId, activados);
    await evaluaciones.actualizarProgreso(this.usuarioId, ganadora.hipotesis.nivel);
    await evaluaciones.cerrarEvaluacion(this.evaluacionId);

    return this.calcularResultado();
  }

  /** Calcula el diagnóstico con el estado actual, sin escribir nada (sirve para consultar una evaluación ya cerrada). */
  calcularResultado(): ResultadoDiagnostico {
    const { ganadora, activados } = this.seleccionarPlan();
    return {
      evaluacionId: this.evaluacionId,
      ganadora,
      creencias: [...this.creencias].sort((a, b) => b.probabilidad - a.probabilidad),
      preguntasRespondidas: this.nodosRespondidos.length,
      confianzaAlcanzada: ganadora.probabilidad >= this.dep.criterio.umbralConfianza,
      plan: this.dep.generador.generar(activados),
      historial: this.historial,
    };
  }

  private seleccionarPlan(): { ganadora: Creencia; activados: Granulo[] } {
    const { motor, generador } = this.dep;
    const ganadora = motor.masProbable(this.creencias);
    return { ganadora, activados: generador.seleccionar(this.granulos, ganadora.hipotesis.nivel) };
  }
}
