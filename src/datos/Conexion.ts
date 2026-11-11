import { Pool } from "pg";

/**
 * Conexión compartida a PostgreSQL. Configurable por variables de entorno, de modo que el mismo
 * código funciona contra un PostgreSQL local o contra Supabase:
 *
 *   DATABASE_URL            cadena de conexión completa (la que entrega Supabase), o bien
 *   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
 *   PGSSL=true              activa SSL cifrado (necesario en Supabase, Azure y Amazon RDS)
 *   PGSSL=verify            además verifica el certificado del servidor (más estricto)
 */
export class Conexion {
  private static pool: Pool | null = null;

  static obtener(): Pool {
    if (Conexion.pool === null) {
      const ssl =
        process.env.PGSSL === "verify" ? true : process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined;
      // Sin tiempo límite, una petición se queda colgada si un firewall bloquea la base de datos.
      const comunes = { ssl, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000, max: 10 };
      Conexion.pool = process.env.DATABASE_URL
        ? new Pool({ connectionString: process.env.DATABASE_URL, ...comunes })
        : new Pool({
            host: process.env.PGHOST ?? "localhost",
            port: Number(process.env.PGPORT ?? 5432),
            user: process.env.PGUSER ?? "alfabot",
            password: process.env.PGPASSWORD ?? "alfabot",
            database: process.env.PGDATABASE ?? "alfabot",
            ...comunes,
          });
      // Un servidor en la nube puede cerrar conexiones inactivas; sin este manejador, ese aviso tumba el proceso.
      Conexion.pool.on("error", (e) => console.error("Conexión inactiva cerrada por la base de datos:", e.message));
    }
    return Conexion.pool;
  }

  static async cerrar(): Promise<void> {
    if (Conexion.pool !== null) {
      await Conexion.pool.end();
      Conexion.pool = null;
    }
  }
}
