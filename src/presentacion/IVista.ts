import { Creencia } from "../negocio/modelos/Hipotesis";
import { PasoInferencia, Pregunta, ResultadoDiagnostico } from "../negocio/modelos/Resultados";

/**
 * Contrato de la capa de presentación. El controlador solo conoce esta interfaz, así que la
 * misma lógica sirve para la consola, una interfaz web (React) o las pruebas automáticas.
 */
export interface IVista {
  pedirAlias(): Promise<string>;
  mostrarBienvenida(creencias: Creencia[]): void;
  /** Muestra la pregunta y devuelve el ramaId de la opción elegida. */
  preguntar(pregunta: Pregunta, numero: number): Promise<number>;
  mostrarPaso(paso: PasoInferencia): void;
  mostrarResultado(resultado: ResultadoDiagnostico): void;
}
