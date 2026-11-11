import { Creencia } from "../negocio/modelos/Hipotesis";
import { PasoInferencia, Pregunta, ResultadoDiagnostico } from "../negocio/modelos/Resultados";
import { IVista } from "../presentacion/IVista";

/** Vista silenciosa para pruebas: responde con una función en lugar de leer del teclado. */
export class VistaGuionada implements IVista {
  resultado: ResultadoDiagnostico | null = null;

  constructor(
    private readonly alias: string,
    private readonly responder: (pregunta: Pregunta, numero: number) => number,
  ) {}

  async pedirAlias(): Promise<string> {
    return this.alias;
  }
  mostrarBienvenida(_creencias: Creencia[]): void {}
  async preguntar(pregunta: Pregunta, numero: number): Promise<number> {
    return this.responder(pregunta, numero);
  }
  mostrarPaso(_paso: PasoInferencia): void {}
  mostrarResultado(resultado: ResultadoDiagnostico): void {
    this.resultado = resultado;
  }
}
