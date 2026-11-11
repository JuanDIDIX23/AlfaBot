import { Creencia } from "./modelos/Hipotesis";
import { IConocimientoRepositorio, IEvaluacionRepositorio } from "./Repositorios";
import { MotorBayes } from "./MotorBayes";
import { SelectorPregunta } from "./SelectorPregunta";
import { CriterioParada } from "./CriterioParada";
import { GeneradorPlan } from "./GeneradorPlan";
import { SesionDiagnostico } from "./SesionDiagnostico";

/**
 * Fachada de la capa de negocio: único punto de entrada para la capa de presentación.
 * Ensambla el motor, el selector de preguntas y los repositorios, y abre las sesiones.
 */
export class ServicioDiagnostico {
  private readonly motor = new MotorBayes();
  private readonly selector = new SelectorPregunta(this.motor);
  private readonly generador = new GeneradorPlan();

  constructor(
    private readonly conocimiento: IConocimientoRepositorio,
    private readonly evaluaciones: IEvaluacionRepositorio,
    private readonly criterio: CriterioParada = new CriterioParada(),
  ) {}

  async iniciarSesion(alias: string): Promise<SesionDiagnostico> {
    const usuarioId = await this.evaluaciones.crearUsuario(alias);
    const evaluacionId = await this.evaluaciones.crearEvaluacion(usuarioId);

    const hipotesis = await this.conocimiento.hipotesis();
    const sumaPriors = hipotesis.reduce((s, h) => s + h.prior, 0);
    const creencias = hipotesis.map((h) => new Creencia(h, h.prior / sumaPriors));
    await this.evaluaciones.guardarPrior(evaluacionId, creencias);

    return new SesionDiagnostico(usuarioId, evaluacionId, creencias, {
      conocimiento: this.conocimiento,
      evaluaciones: this.evaluaciones,
      motor: this.motor,
      selector: this.selector,
      criterio: this.criterio,
      generador: this.generador,
    });
  }

  /**
   * Reanuda una evaluación guardada: reconstruye el estado probabilístico y los gránulos de las
   * respuestas ya dadas. Es lo que permite que el motor funcione como servicio sin memoria entre
   * peticiones. Devuelve null si la evaluación no existe.
   */
  async reanudarSesion(evaluacionId: number): Promise<{ sesion: SesionDiagnostico; completada: boolean } | null> {
    const estado = await this.evaluaciones.estadoEvaluacion(evaluacionId);
    if (estado === null) return null;

    const hipotesis = await this.conocimiento.hipotesis();
    if (estado.creencias.length !== hipotesis.length) {
      throw new Error(`La evaluación ${evaluacionId} no tiene un estado probabilístico completo`);
    }
    const probabilidades = new Map(estado.creencias.map((c) => [c.hipotesisId, c.probabilidad]));
    const creencias = hipotesis.map((h) => {
      const p = probabilidades.get(h.id);
      if (p === undefined) throw new Error(`Falta la probabilidad de la hipótesis ${h.codigo}`);
      return new Creencia(h, p);
    });

    const granulos = [];
    for (const r of estado.respuestas) granulos.push(await this.conocimiento.granuloDeRama(r.ramaId));

    const sesion = new SesionDiagnostico(
      estado.usuarioId,
      evaluacionId,
      creencias,
      {
        conocimiento: this.conocimiento,
        evaluaciones: this.evaluaciones,
        motor: this.motor,
        selector: this.selector,
        criterio: this.criterio,
        generador: this.generador,
      },
      { nodosRespondidos: estado.respuestas.map((r) => r.nodoId), granulos },
    );
    return { sesion, completada: estado.estado === "completada" };
  }
}
