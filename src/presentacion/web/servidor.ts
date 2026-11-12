import { Conexion } from "../../datos/Conexion";
import { ConocimientoRepositorioPg } from "../../datos/ConocimientoRepositorioPg";
import { EvaluacionRepositorioPg } from "../../datos/EvaluacionRepositorioPg";
import { AprendizajeRepositorioPg } from "../../datos/AprendizajeRepositorioPg";
import { ServicioAprendizaje } from "../../negocio/aprendizaje/ServicioAprendizaje";
import { CuentaRepositorioPg } from "../../datos/CuentaRepositorioPg";
import { ServicioCuentas } from "../../negocio/ServicioCuentas";
import { ServicioDiagnostico } from "../../negocio/ServicioDiagnostico";
import { crearApp } from "./app";
import { ControladorApi } from "./ControladorApi";
import { ControladorAprendizaje } from "./ControladorAprendizaje";

/** Raíz de composición del servicio web: conecta las tres capas y arranca el servidor HTTP. */
const db = Conexion.obtener();
const conocimiento = new ConocimientoRepositorioPg(db);
const servicio = new ServicioDiagnostico(conocimiento, new EvaluacionRepositorioPg(db));
const aprendizaje = new ServicioAprendizaje(new AprendizajeRepositorioPg(db));
const app = crearApp({
  api: new ControladorApi(servicio, conocimiento, aprendizaje),
  cuentas: new ServicioCuentas(new CuentaRepositorioPg(db)),
  aprendizaje: new ControladorAprendizaje(aprendizaje),
});

const puerto = Number(process.env.PORT ?? 3000);
const servidor = app.listen(puerto, () => console.log(`AlfaBot escuchando en el puerto ${puerto}`));

const apagar = () => {
  servidor.close(() => void Conexion.cerrar().then(() => process.exit(0)));
};
process.on("SIGTERM", apagar);
process.on("SIGINT", apagar);
