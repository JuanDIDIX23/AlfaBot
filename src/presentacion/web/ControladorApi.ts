import { ServicioDiagnostico } from "../../negocio/ServicioDiagnostico";
import { SesionDiagnostico } from "../../negocio/SesionDiagnostico";
import { IConocimientoRepositorio } from "../../negocio/Repositorios";
import { Creencia } from "../../negocio/modelos/Hipotesis";
import { Pregunta, ResultadoDiagnostico } from "../../negocio/modelos/Resultados";

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

const ALIAS_MAXIMO = 60;
const ID_MAXIMO = 2_147_483_647;

/**
 * Controlador de la API REST del sistema experto. Traduce peticiones JSON a llamadas de la capa de
 * negocio y devuelve DTOs: no contiene lógica de inferencia.
 *
 *   POST /api/evaluaciones                    abre una evaluación y devuelve la primera pregunta
 *   POST /api/evaluaciones/:id/respuestas     registra una respuesta y devuelve el nuevo estado
 *   GET  /api/evaluaciones/:id                consulta el estado (pregunta pendiente o resultado)
 *   GET  /api/hipotesis                       las cinco hipótesis de la base de conocimiento
 *   GET  /api/salud                           verifica que el servicio llega a la base de conocimiento
 */
export class ControladorApi {
  constructor(
    private readonly servicio: ServicioDiagnostico,
    private readonly conocimiento: IConocimientoRepositorio,
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

  async iniciar(cuerpo: unknown): Promise<RespuestaHttp> {
    const alias = this.validarAlias(cuerpo);
    const sesion = await this.servicio.iniciarSesion(alias);
    return { estado: 201, cuerpo: await this.estadoDe(sesion, false) };
  }

  async responder(idTexto: string, cuerpo: unknown): Promise<RespuestaHttp> {
    const id = this.validarId(idTexto);
    const ramaId = this.validarRama(cuerpo);

    const reanudada = await this.servicio.reanudarSesion(id);
    if (reanudada === null) throw new ErrorHttp(404, "No existe esa evaluación");
    const { sesion, completada } = reanudada;
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

  async consultar(idTexto: string): Promise<RespuestaHttp> {
    const id = this.validarId(idTexto);
    const reanudada = await this.servicio.reanudarSesion(id);
    if (reanudada === null) throw new ErrorHttp(404, "No existe esa evaluación");
    return { estado: 200, cuerpo: await this.estadoDe(reanudada.sesion, reanudada.completada) };
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

  private validarAlias(cuerpo: unknown): string {
    const alias = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { alias?: unknown }).alias : undefined;
    if (typeof alias !== "string") throw new ErrorHttp(400, "Falta el nombre");
    // eslint-disable-next-line no-control-regex
    const limpio = alias.replace(/[\u0000-\u001f\u007f]/g, "").trim();
    if (limpio.length === 0) throw new ErrorHttp(400, "Falta el nombre");
    if (limpio.length > ALIAS_MAXIMO) throw new ErrorHttp(400, `El nombre no puede pasar de ${ALIAS_MAXIMO} letras`);
    return limpio;
  }

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
