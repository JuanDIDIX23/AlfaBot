import { ErrorAprendizaje, ServicioAprendizaje } from "../../negocio/aprendizaje/ServicioAprendizaje";
import { LeccionEnRuta, ResultadoEjercicio, Ruta } from "../../negocio/aprendizaje/Modelos";
import { EJERCICIOS_POR_RONDA } from "../../negocio/aprendizaje/GeneradorEjercicios";
import { ErrorHttp, RespuestaHttp } from "./ControladorApi";
import { Cuenta } from "../../negocio/ServicioCuentas";

const ID_MAXIMO = 2_147_483_647;
const OBJETIVO_MAXIMO = 40;

/**
 * API del módulo de aprendizaje (todas las rutas exigen sesión; cada persona solo ve sus caminos):
 *
 *   POST /api/evaluaciones/:id/ruta                        crea el plan de aprendizaje de una evaluación terminada
 *   GET  /api/rutas/:clave                                 consulta el plan y el avance
 *   POST /api/rutas/:clave/lecciones/:leccion/rondas       arma una ronda nueva de ejercicios
 *   POST /api/rutas/:clave/lecciones/:leccion/resultados   califica la ronda y desbloquea la siguiente lección
 */
export class ControladorAprendizaje {
  constructor(private readonly servicio: ServicioAprendizaje) {}

  async crearRuta(cuenta: Cuenta, idTexto: string): Promise<RespuestaHttp> {
    const id = this.validarId(idTexto, "No existe esa evaluación");
    const { clave, ruta } = await this.traducir(() => this.servicio.crearRuta(id, cuenta.id));
    return { estado: 201, cuerpo: { clave, ruta: this.ruta(ruta) } };
  }

  async consultarRuta(cuenta: Cuenta, clave: string): Promise<RespuestaHttp> {
    const ruta = await this.traducir(() => this.servicio.ruta(clave, cuenta.id));
    return { estado: 200, cuerpo: this.ruta(ruta) };
  }

  async nuevaRonda(cuenta: Cuenta, clave: string, leccionTexto: string): Promise<RespuestaHttp> {
    const id = this.validarId(leccionTexto, "Esa lección no está en tu plan");
    const { leccion, ejercicios } = await this.traducir(() => this.servicio.nuevaRonda(clave, cuenta.id, id));
    return {
      estado: 200,
      cuerpo: {
        leccion: { ...this.leccion(leccion), explicacion: leccion.leccion.explicacion },
        ejercicios,
      },
    };
  }

  async terminarRonda(cuenta: Cuenta, clave: string, leccionTexto: string, cuerpo: unknown): Promise<RespuestaHttp> {
    const id = this.validarId(leccionTexto, "Esa lección no está en tu plan");
    const resultados = this.validarResultados(cuerpo);
    const resumen = await this.traducir(() => this.servicio.terminarRonda(clave, cuenta.id, id, resultados));
    const ruta = await this.traducir(() => this.servicio.ruta(clave, cuenta.id));
    return {
      estado: 200,
      cuerpo: {
        aciertos: resumen.aciertos,
        total: resumen.total,
        superada: resumen.superada,
        dificultades: resumen.dificultades,
        siguiente: resumen.siguiente && this.leccion(resumen.siguiente),
        rutaTerminada: resumen.rutaTerminada,
        ruta: this.ruta(ruta),
      },
    };
  }

  // ---------------------------------------------------------------- DTOs

  private ruta(ruta: Ruta) {
    const lecciones = ruta.lecciones.map((l) => this.leccion(l));
    return {
      alias: ruta.alias,
      lecciones,
      superadas: lecciones.filter((l) => l.estado === "superada").length,
      total: lecciones.length,
    };
  }

  private leccion(l: LeccionEnRuta) {
    return {
      id: l.id,
      codigo: l.leccion.codigo,
      titulo: l.leccion.titulo,
      modulo: { codigo: l.leccion.moduloCodigo, nombre: l.leccion.moduloNombre },
      estado: l.estado,
      origen: l.origen,
      regla: l.regla && { codigo: l.regla.codigo, condicion: l.regla.condicion },
      rondas: l.rondas,
      precision: l.intentos > 0 ? l.aciertos / l.intentos : null,
    };
  }

  // ---------------------------------------------------------------- errores y validación

  private async traducir<T>(trabajo: () => Promise<T>): Promise<T> {
    try {
      return await trabajo();
    } catch (e) {
      if (e instanceof ErrorAprendizaje) {
        const estado = { no_existe: 404, no_terminada: 409, ya_existe: 409, bloqueada: 409, invalido: 400 }[e.motivo];
        throw new ErrorHttp(estado, e.message);
      }
      throw e;
    }
  }

  private validarId(texto: string, mensaje: string): number {
    if (!/^\d{1,10}$/.test(texto) || Number(texto) < 1 || Number(texto) > ID_MAXIMO) throw new ErrorHttp(404, mensaje);
    return Number(texto);
  }

  private validarResultados(cuerpo: unknown): ResultadoEjercicio[] {
    const lista = typeof cuerpo === "object" && cuerpo !== null ? (cuerpo as { resultados?: unknown }).resultados : undefined;
    if (!Array.isArray(lista) || lista.length === 0 || lista.length > EJERCICIOS_POR_RONDA) {
      throw new ErrorHttp(400, "Los resultados de la ronda no son válidos");
    }
    return lista.map((r) => {
      const { objetivo, correcto } = (typeof r === "object" && r !== null ? r : {}) as { objetivo?: unknown; correcto?: unknown };
      if (typeof objetivo !== "string" || objetivo.length === 0 || objetivo.length > OBJETIVO_MAXIMO || typeof correcto !== "boolean") {
        throw new ErrorHttp(400, "Los resultados de la ronda no son válidos");
      }
      return { objetivo, correcto };
    });
  }
}
