import { DiagnosticoParaRuta, EstadoLeccion, Leccion, OrigenLeccion } from "./Modelos";

/** Lección propuesta para la ruta, antes de guardarse. */
export interface PasoRuta {
  leccionId: number;
  orden: number;
  reglaId: number | null;
  estado: EstadoLeccion;
  origen: OrigenLeccion;
}

/**
 * Convierte el diagnóstico en una ruta de lecciones (reglas de armado, explicables una por una):
 *
 *  1. Las lecciones de refuerzo: las que atienden cada regla remedial del plan. Quedan ligadas
 *     a la regla que las justifica.
 *  2. El resto de las lecciones de los módulos que siguen pendientes o en curso.
 *  3. Si una lección de esos módulos corresponde a una pregunta que la persona respondió con
 *     dominio (rama de avance) y no la pide ninguna regla, se marca como superada en el
 *     diagnóstico: no se obliga a practicarla, pero se puede repasar.
 *  4. Si no queda nada por aprender (alfabetización básica lograda), se ofrece el último módulo
 *     como repaso libre.
 *  5. Todo se ordena por módulo y por el orden de la lección dentro del módulo.
 *  6. La primera lección no superada queda disponible; las demás, bloqueadas hasta superar la anterior.
 */
export class ConstructorRuta {
  construir(lecciones: Leccion[], diagnostico: DiagnosticoParaRuta): PasoRuta[] {
    const ordenadas = [...lecciones].sort((a, b) => a.moduloOrden - b.moduloOrden || a.orden - b.orden);
    const pasos: Omit<PasoRuta, "orden">[] = [];
    const incluidas = new Set<number>();
    const reglasPlan = new Set(diagnostico.reglasPlan.map((r) => r.id));

    // 1. Refuerzo
    for (const regla of diagnostico.reglasPlan) {
      for (const l of ordenadas) {
        if (l.reglaIds.includes(regla.id) && !incluidas.has(l.id)) {
          pasos.push({ leccionId: l.id, reglaId: regla.id, estado: "bloqueada", origen: "refuerzo" });
          incluidas.add(l.id);
        }
      }
    }

    // 2 y 3. Módulos por trabajar
    const modulos = new Set(diagnostico.modulosPorTrabajar);
    const dominados = new Set(diagnostico.nodosDominados);
    for (const l of ordenadas) {
      if (!modulos.has(l.moduloOrden) || incluidas.has(l.id)) continue;
      const pedidaPorRegla = l.reglaIds.some((r) => reglasPlan.has(r));
      const yaDomina = !pedidaPorRegla && l.nodoIds.length > 0 && l.nodoIds.every((n) => dominados.has(n));
      pasos.push({
        leccionId: l.id,
        reglaId: null,
        estado: yaDomina ? "superada" : "bloqueada",
        origen: yaDomina ? "diagnostico" : "modulo",
      });
      incluidas.add(l.id);
    }

    // 4. Repaso libre
    if (pasos.length === 0 && ordenadas.length > 0) {
      const ultimo = ordenadas[ordenadas.length - 1].moduloOrden;
      for (const l of ordenadas.filter((x) => x.moduloOrden === ultimo)) {
        pasos.push({ leccionId: l.id, reglaId: null, estado: "disponible", origen: "repaso" });
      }
    }

    // 5. Orden pedagógico: módulo y orden de la lección. Los refuerzos de módulos anteriores
    //    quedan primero; dentro de un módulo se respeta la secuencia (ma, pe, si antes que fa, re, go).
    const posicion = new Map(ordenadas.map((l, i) => [l.id, i]));
    pasos.sort((a, b) => posicion.get(a.leccionId)! - posicion.get(b.leccionId)!);

    // 6. Desbloqueo de la primera
    const primera = pasos.find((p) => p.estado === "bloqueada");
    if (primera) primera.estado = "disponible";

    return pasos.map((p, i) => ({ ...p, orden: i + 1 }));
  }
}
