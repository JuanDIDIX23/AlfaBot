import { ServicioDiagnostico } from "../negocio/ServicioDiagnostico";
import { ResultadoDiagnostico } from "../negocio/modelos/Resultados";
import { IVista } from "./IVista";

/**
 * Controlador: conduce el caso de uso "realizar evaluación diagnóstica".
 * Pide datos a la vista, delega la inferencia en la capa de negocio y devuelve el resultado.
 */
export class ControladorDiagnostico {
  constructor(
    private readonly servicio: ServicioDiagnostico,
    private readonly vista: IVista,
  ) {}

  async ejecutar(): Promise<ResultadoDiagnostico> {
    const alias = await this.vista.pedirAlias();
    const sesion = await this.servicio.iniciarSesion(alias);
    this.vista.mostrarBienvenida(sesion.creenciasActuales);

    for (;;) {
      const pregunta = await sesion.siguientePregunta();
      if (pregunta === null) break;

      const ramaId = await this.vista.preguntar(pregunta, sesion.preguntasRespondidas + 1);
      const paso = await sesion.responder(ramaId);
      this.vista.mostrarPaso(paso);
    }

    const resultado = await sesion.finalizar();
    this.vista.mostrarResultado(resultado);
    return resultado;
  }
}
