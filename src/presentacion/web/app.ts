import express, { NextFunction, Request, Response } from "express";
import * as path from "path";
import { ControladorApi, ErrorHttp, RespuestaHttp } from "./ControladorApi";
import { ControladorAprendizaje } from "./ControladorAprendizaje";
import { Cuenta, ErrorCuenta, ServicioCuentas } from "../../negocio/ServicioCuentas";

/** Código de PostgreSQL para "violación de restricción única" (dos peticiones registrando el mismo paso). */
const PG_VIOLACION_UNICA = "23505";

const ESTADO_ERROR_CUENTA: Record<ErrorCuenta["motivo"], number> = {
  invalido: 400,
  duplicado: 409,
  credenciales: 401,
  bloqueado: 429,
  sin_sesion: 401,
};

export interface PiezasApp {
  api: ControladorApi;
  cuentas: ServicioCuentas;
  aprendizaje?: ControladorAprendizaje;
}

/** Token de sesión enviado en la cabecera "Authorization: Bearer <token>". */
function tokenDe(req: Request): string | undefined {
  const cabecera = req.get("authorization") ?? "";
  return cabecera.startsWith("Bearer ") ? cabecera.slice(7).trim() : undefined;
}

/**
 * Construye la aplicación HTTP: sirve la interfaz web (carpeta public) y expone la API REST del
 * sistema experto. Es la única pieza que conoce Express; la lógica vive en los controladores.
 *
 *   POST   /api/cuentas      crea una cuenta (usuario, PIN y nombre) e inicia sesión
 *   POST   /api/sesiones     inicia sesión con usuario y PIN; devuelve el token
 *   GET    /api/sesiones     la cuenta de la sesión actual
 *   DELETE /api/sesiones     cierra la sesión
 * Las rutas de evaluaciones, historial y caminos exigen sesión iniciada.
 */
export function crearApp({ api, cuentas, aprendizaje }: PiezasApp): express.Express {
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
  /** Igual que `ruta`, pero exige sesión iniciada y entrega la cuenta al controlador. */
  const conSesion = (fn: (req: Request, cuenta: Cuenta) => Promise<RespuestaHttp>) =>
    ruta(async (req) => fn(req, await cuentas.cuentaDeToken(tokenDe(req))));
  const p = (req: Request, nombre: string) => String(req.params[nombre]);
  const cuerpo = (req: Request): Record<string, unknown> =>
    typeof req.body === "object" && req.body !== null ? req.body : {};
  const datosCuenta = (c: Cuenta) => ({ usuario: c.usuario, nombre: c.nombre });

  app.get("/api/salud", ruta(() => api.salud()));
  app.get("/api/hipotesis", ruta(() => api.hipotesis()));

  // Cuentas y sesiones
  app.post("/api/cuentas", ruta(async (req) => {
    const b = cuerpo(req);
    const { token, cuenta } = await cuentas.registrar(b.usuario, b.pin, b.nombre);
    return { estado: 201, cuerpo: { token, cuenta: datosCuenta(cuenta) } };
  }));
  app.post("/api/sesiones", ruta(async (req) => {
    const b = cuerpo(req);
    const { token, cuenta } = await cuentas.entrar(b.usuario, b.pin);
    return { estado: 200, cuerpo: { token, cuenta: datosCuenta(cuenta) } };
  }));
  app.get("/api/sesiones", conSesion(async (_req, cuenta) => ({ estado: 200, cuerpo: { cuenta: datosCuenta(cuenta) } })));
  app.delete("/api/sesiones", ruta(async (req) => {
    await cuentas.salir(tokenDe(req));
    return { estado: 200, cuerpo: { ok: true } };
  }));

  // Diagnóstico
  app.post("/api/evaluaciones", conSesion((_req, cuenta) => api.iniciar(cuenta)));
  app.get("/api/evaluaciones/:id", conSesion((req, cuenta) => api.consultar(cuenta, p(req, "id"))));
  app.post("/api/evaluaciones/:id/respuestas", conSesion((req, cuenta) => api.responder(cuenta, p(req, "id"), req.body)));
  app.get("/api/historial", conSesion((_req, cuenta) => api.historial(cuenta)));

  // Aprendizaje
  if (aprendizaje) {
    app.post("/api/evaluaciones/:id/ruta", conSesion((req, cuenta) => aprendizaje.crearRuta(cuenta, p(req, "id"))));
    app.get("/api/rutas/:clave", conSesion((req, cuenta) => aprendizaje.consultarRuta(cuenta, p(req, "clave"))));
    app.post(
      "/api/rutas/:clave/lecciones/:leccion/rondas",
      conSesion((req, cuenta) => aprendizaje.nuevaRonda(cuenta, p(req, "clave"), p(req, "leccion"))),
    );
    app.post(
      "/api/rutas/:clave/lecciones/:leccion/resultados",
      conSesion((req, cuenta) => aprendizaje.terminarRonda(cuenta, p(req, "clave"), p(req, "leccion"), req.body)),
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
  if (e instanceof ErrorCuenta) {
    res.status(ESTADO_ERROR_CUENTA[e.motivo]).json({ error: e.message, motivo: e.motivo });
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
