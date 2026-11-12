import { ServicioDiagnostico } from "../../negocio/ServicioDiagnostico";
import { SesionDiagnostico } from "../../negocio/SesionDiagnostico";
import { IConocimientoRepositorio } from "../../negocio/Repositorios";
import { Creencia } from "../../negocio/modelos/Hipotesis";
import { Pregunta, ResultadoDiagnostico } from "../../negocio/modelos/Resultados";
import { ServicioAprendizaje } from "../../negocio/aprendizaje/ServicioAprendizaje";
import { Cuenta } from "../../negocio/ServicioCuentas";

/** Respuesta HTTP independiente del framework: así el controlador se prueba sin levantar un servidor. */
export interface RespuestaHttp {
  estado: number;
  cuerpo: unknown;
}

/** Error con código HTTP; su mensaje es seguro para mostrarlo al usuario. */
export class ErrorHttp extends Error {
  constructor(
    public readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

const ID_MAXIMO = 2_147_483_647;

/**
 * Controlador de la API REST del sistema experto. Traduce peticiones JSON a llamadas de la capa de
 * negocio y devuelve DTOs: no contiene lógica de inferencia. Todo lo que es de una persona exige
 * sesión iniciada (lo resuelve app.ts) y solo se le muestra a su dueño.
 *
 *   POST /api/evaluaciones                    abre una evaluación y devuelve la primera pregunta
 *   POST /api/evaluaciones/:id/respuestas     registra una respuesta y devuelve el nuevo estado
 *   GET  /api/evaluaciones/:id                consulta el estado (pregunta pendiente o resultado)
 *   GET  /api/historial                       evaluaciones anteriores, su nivel y el progreso por módulo
 *   GET  /api/hipotesis                       las cinco hipótesis de la base de conocimiento
 *   GET  /api/salud                           verifica que el servicio llega a la base de conocimiento
 */
export class ControladorApi {
  constructor(
    private readonly servicio: ServicioDiagnostico,
    private readonly conocimiento: IConocimientoRepositorio,
    /** Opcional: si está, el historial muestra también el avance del camino de aprendizaje. */
    private readonly aprendizaje?: ServicioAprendizaje,
  ) {}

  async salud(): Promise<RespuestaHttp> {
    const hipotesis = await this.conocimiento.hipotesis();
    return { estado: 200, cuerpo: { estado: "ok", hipotesis: hipotesis.length } };
  }

  async hipotesis(): Promise<RespuestaHttp> {
    const lista = await this.conocimiento.hipotesis();
    return {
      estado: 200,
      cuerpo: lista.map((h) => ({ codigo: h.codigo, nombre: h.nombre, descripcion: h.descripcion, nivel: h.nivel })),
    };
  }

  async iniciar(cuenta: Cuenta): Promise<RespuestaHttp> {
    const sesion = await this.servicio.abrirEvaluacion({ id: cuenta.id });
    return { estado: 201, cuerpo: await this.estadoDe(sesion, false) };
  }

  async historial(cuenta: Cuenta): Promise<RespuestaHttp> {
    const h = await this.servicio.historial(cuenta.id);
    const rutas = this.aprendizaje
      ? await this.aprendizaje.rutasDeEvaluaciones(h.evaluaciones.map((e) => e.evaluacionId))
      : new Map();
    return {
      estado: 200,
      cuerpo: {
        nombre: cuenta.nombre,
        usuario: cuenta.usuario,
        evaluaciones: h.evaluaciones.map((e) => {
          const ruta = rutas.get(e.evaluacionId);
          return {
            evaluacionId: e.evaluacionId,
            fechaInicio: e.fechaInicio,
            fechaFin: e.fechaFin,
            estado: e.estado,
            preguntasRespondidas: e.preguntasRespondidas,
            // Sin respuestas todavía, el "nivel" sería solo la probabilidad a priori: no se muestra.
            nivel: e.preguntasRespondidas > 0 ? e.ganadora : null,
            ruta: ruta ? { clave: ruta.clave, superadas: ruta.superadas, total: ruta.total } : null,
          };
        }),
        progreso: h.progreso.map((p) => ({ modulo: p.moduloCodigo, nombre: p.moduloNombre, estado: p.estado })),
      },
    };
  }

  async responder(cuenta: Cuenta, idTexto: string, cuerpo: unknown): Promise<RespuestaHttp> {
    const id = this.validarId(idTexto);
    const ramaId = this.validarRama(cuerpo);

    const { sesion, completada } = await this.reanudarPropia(cuenta, id);
    if (completada) throw new ErrorHttp(409, "Esa evaluación ya terminó");

    const pregunta = await sesion.siguientePregunta();
    if (pregunta === null) {
      await sesion.finalizar(); // evaluación que quedó sin cerrar: se cierra y se informa
      throw new ErrorHttp(409, "Esa evaluación ya terminó");
    }
    if (!pregunta.opciones.some((o) => o.ramaId === ramaId)) {
      throw new ErrorHttp(400, "Esa respuesta no corresponde a la pregunta actual");
    }

    const paso = await sesion.responder(ramaId);
    const estado = await this.estadoDe(sesion, false);
    return {
      estado: 200,
      cuerpo: {
        ...estado,
        regla: paso.rama && paso.reglaCodigo ? { codigo: paso.reglaCodigo, condicion: paso.rama.condicion } : null,
      },
    };
  }

  async consultar(cuenta: Cuenta, idTexto: string): Promise<RespuestaHttp> {
    const id = this.validarId(idTexto);
    const { sesion, completada } = await this.reanudarPropia(cuenta, id);
    return { estado: 200, cuerpo: await this.estadoDe(sesion, completada) };
  }

  /** Reanuda una evaluación solo si es de esta cuenta; si es de otra persona, responde como si no existiera. */
  private async reanudarPropia(cuenta: Cuenta, id: number) {
    const reanudada = await this.servicio.reanudarSesion(id);
    if (reanudada === null || reanudada.sesion.usuarioId !== cuenta.id) throw new ErrorHttp(404, "No existe esa evaluación");
    return reanudada;
  }

  // ---------------------------------------------------------------- construcción de la respuesta

  /** Estado actual: la siguiente pregunta o, si ya no hay confianza que ganar, el diagnóstico. */
  private async estadoDe(sesion: SesionDiagnostico, completada: boolean) {
    if (completada) {
      return this.estado(sesion, "completada", null, sesion.calcularResultado());
    }
    const pregunta = await sesion.siguientePregunta();
    if (pregunta !== null) return this.estado(sesion, "en_curso", pregunta, null);
    return this.estado(sesion, "completada", null, await sesion.finalizar());
  }

  private estado(
    sesion: SesionDiagnostico,
    estado: "en_curso" | "completada",
    pregunta: Pregunta | null,
    resultado: ResultadoDiagnostico | null,
  ) {
    return {
      evaluacionId: sesion.evaluacionId,
      estado,
      creencias: this.creencias(sesion.creenciasActuales),
      pregunta: pregunta && {
        nodoCodigo: pregunta.nodo.codigo,
        modulo: pregunta.nodo.moduloCodigo,
        texto: pregunta.nodo.pregunta,
        numero: sesion.preguntasRespondidas + 1,
        ganancia: pregunta.ganancia,
        opciones: pregunta.opciones.map((o) => ({ ramaId: o.ramaId, texto: o.condicion })),
      },
      resultado: resultado && {
        ganadora: {
          codigo: resultado.ganadora.hipotesis.codigo,
          nombre: resultado.ganadora.hipotesis.nombre,
          descripcion: resultado.ganadora.hipotesis.descripcion,
          probabilidad: resultado.ganadora.probabilidad,
        },
        creencias: this.creencias(resultado.creencias),
        preguntasRespondidas: resultado.preguntasRespondidas,
        confianzaAlcanzada: resultado.confianzaAlcanzada,
        plan: resultado.plan.map((p) => ({
          modulo: p.moduloCodigo,
          regla: p.reglaCodigo,
          condicion: p.condicion,
          accion: p.accion,
        })),
      },
    };
  }

  private creencias(lista: Creencia[]) {
    return lista.map((c) => ({ codigo: c.hipotesis.codigo, nombre: c.hipotesis.nombre, probabilidad: c.probabilidad }));
  }

  // ---------------------------------------------------------------- validación de entrada



  private validarRama(cuerpo: unknown): number {
    const rama = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { ramaId?: unknown }).ramaId : undefined;
    if (typeof rama !== "number" || !Number.isInteger(rama) || rama < 1 || rama > ID_MAXIMO) {
      throw new ErrorHttp(400, "La respuesta no es válida");
    }
    return rama;
  }

  private validarId(texto: string): number {
    if (!/^\d{1,10}$/.test(texto) || Number(texto) < 1 || Number(texto) > ID_MAXIMO) {
      throw new ErrorHttp(404, "No existe esa evaluación");
    }
    return Number(texto);
  }
}
