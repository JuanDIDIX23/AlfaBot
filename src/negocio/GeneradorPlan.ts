import { Granulo } from "./modelos/Conocimiento";
import { ItemPlan } from "./modelos/Resultados";

/**
 * Construye el plan de actividades a partir de los gránulos de conocimiento que el usuario
 * activó con sus respuestas. Cada actividad queda ligada a la regla que la justifica
 * (explicabilidad).
 */
export class GeneradorPlan {
  /**
   * Selecciona las actividades de refuerzo que corresponden al diagnóstico: las de falla
   * ubicadas en el módulo en curso o en módulos ya superados (orden <= nivel de la hipótesis
   * ganadora). Las de módulos posteriores se dejan para cuando el usuario llegue a ellos.
   */
  seleccionar(granulosActivados: Granulo[], nivelDiagnosticado: number): Granulo[] {
    return granulosActivados
      .filter((g) => g.rama.tipo === "remedial" && g.moduloOrden <= nivelDiagnosticado)
      .sort((a, b) => a.moduloOrden - b.moduloOrden || a.rama.codigo.localeCompare(b.rama.codigo));
  }

  generar(granulosSeleccionados: Granulo[]): ItemPlan[] {
    return granulosSeleccionados.map((g) => ({
      moduloCodigo: g.moduloCodigo,
      reglaCodigo: g.reglaCodigo,
      ramaCodigo: g.rama.codigo,
      condicion: g.rama.condicion,
      accion: g.accion,
    }));
  }
}
