import express, { NextFunction, Request, Response } from "express";
import * as path from "path";
import { ControladorApi, ErrorHttp, RespuestaHttp } from "./ControladorApi";
import { ControladorAprendizaje } from "./ControladorAprendizaje";

/** Código de PostgreSQL para "violación de restricción única" (dos peticiones registrando el mismo paso). */
const PG_VIOLACION_UNICA = "23505";

/**
 * Construye la aplicación HTTP: sirve la interfaz web (carpeta public) y expone la API REST del
 * sistema experto. Es la única pieza que conoce Express; la lógica vive en ControladorApi.
 */
export function crearApp(controlador: ControladorApi, aprendizaje?: ControladorAprendizaje): express.Express {
  const app = express();
  app.disable("x-powered-by");

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'",
    );
    next();
  });

  app.use("/api", (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use("/api", express.json({ limit: "2kb" }));

  const ruta = (fn: (req: Request) => Promise<RespuestaHttp>) => async (req: Request, res: Response) => {
    try {
      const r = await fn(req);
      res.status(r.estado).json(r.cuerpo);
    } catch (e) {
      responderError(e, res);
    }
  };

  app.get("/api/salud", ruta(() => controlador.salud()));
  app.get("/api/hipotesis", ruta(() => controlador.hipotesis()));
  app.post("/api/evaluaciones", ruta((req) => controlador.iniciar(req.body)));
  app.get("/api/evaluaciones/:id", ruta((req) => controlador.consultar(String(req.params.id))));
  app.post("/api/evaluaciones/:id/respuestas", ruta((req) => controlador.responder(String(req.params.id), req.body)));
  app.get("/api/usuarios/:clave/historial", ruta((req) => controlador.historial(String(req.params.clave))));

  if (aprendizaje) {
    const p = (req: Request, nombre: string) => String(req.params[nombre]);
    app.post("/api/evaluaciones/:id/ruta", ruta((req) => aprendizaje.crearRuta(p(req, "id"))));
    app.get("/api/rutas/:clave", ruta((req) => aprendizaje.consultarRuta(p(req, "clave"))));
    app.post("/api/rutas/:clave/lecciones/:leccion/rondas", ruta((req) => aprendizaje.nuevaRonda(p(req, "clave"), p(req, "leccion"))));
    app.post(
      "/api/rutas/:clave/lecciones/:leccion/resultados",
      ruta((req) => aprendizaje.terminarRonda(p(req, "clave"), p(req, "leccion"), req.body)),
    );
  }

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "No existe esa ruta" });
  });

  app.use(express.static(path.join(__dirname, "..", "..", "..", "public")));

  // JSON mal formado o demasiado grande
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const estado = (err as { status?: number }).status;
    if (estado === 400 || estado === 413) {
      res.status(estado).json({ error: "La petición no es válida" });
      return;
    }
    responderError(err, res);
  });

  return app;
}

function responderError(e: unknown, res: Response): void {
  if (e instanceof ErrorHttp) {
    res.status(e.estado).json({ error: e.message });
    return;
  }
  if ((e as { code?: string }).code === PG_VIOLACION_UNICA) {
    res.status(409).json({ error: "Esa respuesta ya se había registrado" });
    return;
  }
  // El detalle se queda en el registro del servidor; al usuario no se le filtra información interna.
  console.error("Error no controlado:", e instanceof Error ? e.stack : e);
  res.status(500).json({ error: "El servicio tuvo un problema. Intenta de nuevo en un momento." });
}
