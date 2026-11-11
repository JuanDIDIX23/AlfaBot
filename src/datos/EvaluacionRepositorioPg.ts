import { Pool } from "pg";
import { IEvaluacionRepositorio } from "../negocio/Repositorios";
import { Creencia } from "../negocio/modelos/Hipotesis";
import { Granulo } from "../negocio/modelos/Conocimiento";
import { EstadoEvaluacion, HistorialUsuario } from "../negocio/modelos/Resultados";

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_HISTORIAL = 50;

/** Escritura en el sistema transaccional (usuarios, evaluaciones, respuestas, inferencias, diagnósticos, progreso). */
export class EvaluacionRepositorioPg implements IEvaluacionRepositorio {
  constructor(private readonly db: Pool) {}

  async crearUsuario(alias: string, clave: string): Promise<number> {
    const r = await this.db.query(`INSERT INTO usuarios (alias, clave) VALUES ($1, $2) RETURNING id`, [alias, clave]);
    return r.rows[0].id;
  }

  async usuarioPorClave(clave: string): Promise<{ id: number; alias: string } | null> {
    if (!FORMATO_UUID.test(clave)) return null;
    const r = await this.db.query(`SELECT id, alias FROM usuarios WHERE clave = $1`, [clave]);
    return r.rowCount === 0 ? null : { id: r.rows[0].id, alias: r.rows[0].alias };
  }

  async actualizarAlias(usuarioId: number, alias: string): Promise<void> {
    await this.db.query(`UPDATE usuarios SET alias = $2 WHERE id = $1`, [usuarioId, alias]);
  }

  async historialDeUsuario(usuarioId: number): Promise<HistorialUsuario> {
    const u = await this.db.query(`SELECT alias FROM usuarios WHERE id = $1`, [usuarioId]);
    // Nivel más probable en el último paso guardado de cada evaluación (el empate lo gana el
    // nivel más bajo, igual que en el motor).
    const ev = await this.db.query(
      `SELECT e.id, e.fecha_inicio, e.fecha_fin, e.estado,
              (SELECT count(*)::int FROM respuestas r WHERE r.evaluacion_id = e.id) AS preguntas,
              g.codigo, g.nombre, g.probabilidad
         FROM evaluaciones e
         LEFT JOIN LATERAL (
              SELECT h.codigo, h.nombre, i.probabilidad::float8 AS probabilidad
                FROM inferencias i JOIN hipotesis h ON h.id = i.hipotesis_id
               WHERE i.evaluacion_id = e.id
                 AND i.paso = (SELECT max(paso) FROM inferencias WHERE evaluacion_id = e.id)
               ORDER BY i.probabilidad DESC, h.nivel
               LIMIT 1) g ON true
        WHERE e.usuario_id = $1
        ORDER BY e.fecha_inicio DESC, e.id DESC
        LIMIT $2`,
      [usuarioId, LIMITE_HISTORIAL],
    );
    const pr = await this.db.query(
      `SELECT m.codigo, m.nombre, p.estado
         FROM progreso p JOIN modulos m ON m.id = p.modulo_id
        WHERE p.usuario_id = $1
        ORDER BY m.orden`,
      [usuarioId],
    );
    return {
      alias: u.rows[0]?.alias ?? "",
      evaluaciones: ev.rows.map((f) => ({
        evaluacionId: f.id,
        fechaInicio: f.fecha_inicio,
        fechaFin: f.fecha_fin,
        estado: f.estado,
        preguntasRespondidas: f.preguntas,
        ganadora: f.codigo === null ? null : { codigo: f.codigo, nombre: f.nombre, probabilidad: f.probabilidad },
      })),
      progreso: pr.rows.map((f) => ({ moduloCodigo: f.codigo, moduloNombre: f.nombre, estado: f.estado })),
    };
  }

  async crearEvaluacion(usuarioId: number): Promise<number> {
    const r = await this.db.query(`INSERT INTO evaluaciones (usuario_id) VALUES ($1) RETURNING id`, [usuarioId]);
    return r.rows[0].id;
  }

  async guardarPrior(evaluacionId: number, creencias: Creencia[]): Promise<void> {
    for (const c of creencias) {
      await this.db.query(
        `INSERT INTO inferencias (evaluacion_id, paso, hipotesis_id, rama_id, probabilidad)
         VALUES ($1, 0, $2, NULL, $3)`,
        [evaluacionId, c.hipotesis.id, c.probabilidad],
      );
    }
  }

  async registrarPaso(
    evaluacionId: number,
    nodoId: number,
    ramaId: number,
    paso: number,
    creencias: Creencia[],
  ): Promise<void> {
    const cliente = await this.db.connect();
    try {
      await cliente.query("BEGIN");
      await cliente.query(
        `INSERT INTO respuestas (evaluacion_id, nodo_id, rama_id) VALUES ($1, $2, $3)`,
        [evaluacionId, nodoId, ramaId],
      );
      for (const c of creencias) {
        await cliente.query(
          `INSERT INTO inferencias (evaluacion_id, paso, hipotesis_id, rama_id, probabilidad)
           VALUES ($1, $2, $3, $4, $5)`,
          [evaluacionId, paso, c.hipotesis.id, ramaId, c.probabilidad],
        );
      }
      await cliente.query("COMMIT");
    } catch (e) {
      await cliente.query("ROLLBACK");
      throw e;
    } finally {
      cliente.release();
    }
  }

  async guardarPlan(evaluacionId: number, granulos: Granulo[]): Promise<void> {
    for (const g of granulos) {
      await this.db.query(
        `INSERT INTO diagnosticos (evaluacion_id, modulo_id, regla_id) VALUES ($1, $2, $3)`,
        [evaluacionId, g.moduloId, g.reglaId],
      );
    }
  }

  async actualizarProgreso(usuarioId: number, nivelHipotesis: number): Promise<void> {
    // Un módulo está superado si su orden es menor al nivel de la hipótesis ganadora,
    // en curso si es igual y pendiente si es mayor.
    await this.db.query(
      `INSERT INTO progreso (usuario_id, modulo_id, estado)
       SELECT $1, m.id,
              CASE WHEN m.orden < $2 THEN 'superado'
                   WHEN m.orden = $2 THEN 'en_curso'
                   ELSE 'pendiente' END
         FROM modulos m
       ON CONFLICT (usuario_id, modulo_id)
       DO UPDATE SET estado = EXCLUDED.estado, fecha_actualizacion = now()`,
      [usuarioId, nivelHipotesis],
    );
  }

  async cerrarEvaluacion(evaluacionId: number): Promise<void> {
    await this.db.query(
      `UPDATE evaluaciones SET estado = 'completada', fecha_fin = now() WHERE id = $1`,
      [evaluacionId],
    );
  }

  async estadoEvaluacion(evaluacionId: number): Promise<EstadoEvaluacion | null> {
    const ev = await this.db.query(`SELECT usuario_id, estado FROM evaluaciones WHERE id = $1`, [evaluacionId]);
    if (ev.rowCount === 0) return null;

    const resp = await this.db.query(
      `SELECT nodo_id, rama_id FROM respuestas WHERE evaluacion_id = $1 ORDER BY id`,
      [evaluacionId],
    );
    const inf = await this.db.query(
      `SELECT hipotesis_id, probabilidad::float8 AS p
         FROM inferencias
        WHERE evaluacion_id = $1
          AND paso = (SELECT max(paso) FROM inferencias WHERE evaluacion_id = $1)
        ORDER BY hipotesis_id`,
      [evaluacionId],
    );
    return {
      usuarioId: ev.rows[0].usuario_id,
      estado: ev.rows[0].estado,
      respuestas: resp.rows.map((f) => ({ nodoId: f.nodo_id, ramaId: f.rama_id })),
      creencias: inf.rows.map((f) => ({ hipotesisId: f.hipotesis_id, probabilidad: f.p })),
    };
  }
}
