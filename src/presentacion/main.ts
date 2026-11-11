import { Conexion } from "../datos/Conexion";
import { ConocimientoRepositorioPg } from "../datos/ConocimientoRepositorioPg";
import { EvaluacionRepositorioPg } from "../datos/EvaluacionRepositorioPg";
import { ServicioDiagnostico } from "../negocio/ServicioDiagnostico";
import { ControladorDiagnostico } from "./ControladorDiagnostico";
import { VistaConsola } from "./VistaConsola";

/** Raíz de composición: aquí (y solo aquí) se conectan las tres capas. */
async function main(): Promise<void> {
  const db = Conexion.obtener();
  const servicio = new ServicioDiagnostico(new ConocimientoRepositorioPg(db), new EvaluacionRepositorioPg(db));
  const controlador = new ControladorDiagnostico(servicio, new VistaConsola());
  try {
    await controlador.ejecutar();
  } finally {
    await Conexion.cerrar();
  }
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
