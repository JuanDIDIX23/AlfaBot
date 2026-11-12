import { Pool } from "pg";
import { Cuenta, ICuentaRepositorio } from "../negocio/ServicioCuentas";

/** Código de PostgreSQL para "violación de restricción única". */
const PG_VIOLACION_UNICA = "23505";

/** Cuentas y sesiones (sistema transaccional). Los tiempos se calculan con el reloj de la base. */
export class CuentaRepositorioPg implements ICuentaRepositorio {
  constructor(private readonly db: Pool) {}

  async crearCuenta(usuario: string, nombre: string, pinHash: string): Promise<number | null> {
    try {
      const r = await this.db.query(
        `INSERT INTO usuarios (alias, usuario, pin_hash) VALUES ($1, $2, $3) RETURNING id`,
        [nombre, usuario, pinHash],
      );
      return r.rows[0].id;
    } catch (e) {
      if ((e as { code?: string }).code === PG_VIOLACION_UNICA) return null;
      throw e;
    }
  }

  async cuentaPorUsuario(usuario: string) {
    const r = await this.db.query(
      `SELECT id, alias, pin_hash,
              CASE WHEN bloqueado_hasta > now()
                   THEN ceil(extract(epoch FROM bloqueado_hasta - now()) / 60)::int ELSE 0 END AS minutos
         FROM usuarios
        WHERE usuario = $1 AND pin_hash IS NOT NULL`,
      [usuario],
    );
    if (r.rowCount === 0) return null;
    const f = r.rows[0];
    return { id: f.id, nombre: f.alias, pinHash: f.pin_hash, minutosBloqueo: f.minutos };
  }

  async registrarIntentoFallido(usuarioId: number, maximo: number, minutos: number): Promise<void> {
    await this.db.query(
      `UPDATE usuarios
          SET bloqueado_hasta = CASE WHEN intentos_fallidos + 1 >= $2
                                     THEN now() + make_interval(mins => $3) ELSE bloqueado_hasta END,
              intentos_fallidos = CASE WHEN intentos_fallidos + 1 >= $2 THEN 0 ELSE intentos_fallidos + 1 END
        WHERE id = $1`,
      [usuarioId, maximo, minutos],
    );
  }

  async reiniciarIntentos(usuarioId: number): Promise<void> {
    await this.db.query(`UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = $1`, [usuarioId]);
  }

  async crearSesion(usuarioId: number, tokenHash: string, dias: number): Promise<void> {
    await this.db.query(
      `INSERT INTO sesiones (usuario_id, token_hash, expira) VALUES ($1, $2, now() + make_interval(days => $3))`,
      [usuarioId, tokenHash, dias],
    );
  }

  async cuentaDeSesion(tokenHash: string): Promise<Cuenta | null> {
    const r = await this.db.query(
      `SELECT u.id, u.usuario, u.alias
         FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
        WHERE s.token_hash = $1 AND NOT s.cerrada AND s.expira > now()`,
      [tokenHash],
    );
    return r.rowCount === 0 ? null : { id: r.rows[0].id, usuario: r.rows[0].usuario, nombre: r.rows[0].alias };
  }

  async cerrarSesion(tokenHash: string): Promise<void> {
    await this.db.query(`UPDATE sesiones SET cerrada = TRUE WHERE token_hash = $1`, [tokenHash]);
  }
}
