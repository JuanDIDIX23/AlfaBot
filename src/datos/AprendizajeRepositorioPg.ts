import { Pool, PoolClient } from "pg";
import { PasoRuta } from "../negocio/aprendizaje/ConstructorRuta";
import { IAprendizajeRepositorio } from "../negocio/aprendizaje/ServicioAprendizaje";
import {
  DiagnosticoParaRuta, Leccion, LeccionEnRuta, ResultadoEjercicio, Ruta,
} from "../negocio/aprendizaje/Modelos";

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Lecciones (conocimiento) y rutas, intentos y progreso (transaccional) del módulo de aprendizaje. */
export class AprendizajeRepositorioPg implements IAprendizajeRepositorio {
  constructor(private readonly db: Pool) {}

  async lecciones(): Promise<Leccion[]> {
    const r = await this.db.query(
      `SELECT l.id, l.codigo, l.titulo, l.explicacion, l.tipo_ejercicio, l.parametros, l.orden,
              m.id AS modulo_id, m.codigo AS modulo_codigo, m.nombre AS modulo_nombre, m.orden AS modulo_orden,
              coalesce(array_agg(DISTINCT lr.regla_id) FILTER (WHERE lr.regla_id IS NOT NULL), '{}') AS regla_ids,
              coalesce(array_agg(DISTINCT ra.nodo_id) FILTER (WHERE ra.nodo_id IS NOT NULL), '{}') AS nodo_ids
         FROM lecciones l
         JOIN modulos m ON m.id = l.modulo_id
         LEFT JOIN lecciones_reglas lr ON lr.leccion_id = l.id
         LEFT JOIN reglas rg ON rg.id = lr.regla_id
         LEFT JOIN ramas ra ON ra.id = rg.rama_id
        GROUP BY l.id, m.id
        ORDER BY m.orden, l.orden`,
    );
    return r.rows.map((f) => ({
      id: f.id,
      codigo: f.codigo,
      moduloId: f.modulo_id,
      moduloCodigo: f.modulo_codigo,
      moduloNombre: f.modulo_nombre,
      moduloOrden: f.modulo_orden,
      titulo: f.titulo,
      explicacion: f.explicacion,
      tipoEjercicio: f.tipo_ejercicio,
      parametros: typeof f.parametros === "string" ? JSON.parse(f.parametros) : f.parametros,
      orden: f.orden,
      reglaIds: (f.regla_ids as number[]).map(Number),
      nodoIds: (f.nodo_ids as number[]).map(Number),
    }));
  }

  async diagnosticoParaRuta(evaluacionId: number): Promise<DiagnosticoParaRuta | null> {
    const ev = await this.db.query(`SELECT usuario_id, estado FROM evaluaciones WHERE id = $1`, [evaluacionId]);
    if (ev.rowCount === 0) return null;
    const usuarioId: number = ev.rows[0].usuario_id;

    const plan = await this.db.query(
      `SELECT r.id, r.codigo, r.condicion_texto
         FROM diagnosticos d JOIN reglas r ON r.id = d.regla_id
        WHERE d.evaluacion_id = $1 AND r.tipo = 'remedial'
        ORDER BY d.id`,
      [evaluacionId],
    );
    const dominados = await this.db.query(
      `SELECT DISTINCT res.nodo_id
         FROM respuestas res JOIN reglas r ON r.rama_id = res.rama_id
        WHERE res.evaluacion_id = $1 AND r.tipo IN ('avance', 'fin')`,
      [evaluacionId],
    );
    const modulos = await this.db.query(
      `SELECT m.orden FROM progreso p JOIN modulos m ON m.id = p.modulo_id
        WHERE p.usuario_id = $1 AND p.estado <> 'superado'
        ORDER BY m.orden`,
      [usuarioId],
    );
    return {
      usuarioId,
      completada: ev.rows[0].estado === "completada",
      reglasPlan: plan.rows.map((f) => ({ id: f.id, codigo: f.codigo, condicion: f.condicion_texto })),
      nodosDominados: dominados.rows.map((f) => f.nodo_id),
      modulosPorTrabajar: modulos.rows.map((f) => f.orden),
    };
  }

  async crearRuta(usuarioId: number, evaluacionId: number, clave: string, pasos: PasoRuta[]): Promise<boolean> {
    return this.enTransaccion(async (c) => {
      const r = await c.query(
        `INSERT INTO rutas (usuario_id, evaluacion_id, clave) VALUES ($1, $2, $3)
         ON CONFLICT (evaluacion_id) DO NOTHING RETURNING id`,
        [usuarioId, evaluacionId, clave],
      );
      if (r.rowCount === 0) return false;
      const rutaId: number = r.rows[0].id;
      for (const p of pasos) {
        await c.query(
          `INSERT INTO ruta_lecciones (ruta_id, leccion_id, orden, regla_id, estado, origen)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [rutaId, p.leccionId, p.orden, p.reglaId, p.estado, p.origen],
        );
      }
      await this.actualizarProgreso(c, rutaId, usuarioId);
      return true;
    });
  }

  async rutaPorClave(clave: string): Promise<Ruta | null> {
    if (!FORMATO_UUID.test(clave)) return null;
    const r = await this.db.query(
      `SELECT ru.id, ru.usuario_id, ru.evaluacion_id, u.alias
         FROM rutas ru JOIN usuarios u ON u.id = ru.usuario_id
        WHERE ru.clave = $1`,
      [clave],
    );
    if (r.rowCount === 0) return null;
    const f = r.rows[0];

    const catalogo = new Map((await this.lecciones()).map((l) => [l.id, l]));
    const filas = await this.db.query(
      `SELECT rl.id, rl.leccion_id, rl.orden, rl.estado, rl.origen, rl.rondas, rl.aciertos, rl.intentos,
              rg.id AS regla_id, rg.codigo AS regla_codigo, rg.condicion_texto
         FROM ruta_lecciones rl LEFT JOIN reglas rg ON rg.id = rl.regla_id
        WHERE rl.ruta_id = $1
        ORDER BY rl.orden`,
      [f.id],
    );
    const lecciones: LeccionEnRuta[] = filas.rows.map((x) => {
      const leccion = catalogo.get(x.leccion_id);
      if (!leccion) throw new Error(`La ruta ${f.id} apunta a una lección que no existe (${x.leccion_id})`);
      return {
        id: x.id,
        leccion,
        orden: x.orden,
        regla: x.regla_id === null ? null : { id: x.regla_id, codigo: x.regla_codigo, condicion: x.condicion_texto },
        estado: x.estado,
        origen: x.origen,
        rondas: x.rondas,
        aciertos: x.aciertos,
        intentos: x.intentos,
      };
    });
    return { id: f.id, usuarioId: f.usuario_id, alias: f.alias, evaluacionId: f.evaluacion_id, lecciones };
  }

  async intentosRecientes(rutaLeccionId: number, limite: number): Promise<ResultadoEjercicio[]> {
    const r = await this.db.query(
      `SELECT objetivo, correcto FROM intentos_ejercicio
        WHERE ruta_leccion_id = $1 ORDER BY id DESC LIMIT $2`,
      [rutaLeccionId, limite],
    );
    return r.rows.map((f) => ({ objetivo: f.objetivo, correcto: f.correcto }));
  }

  async registrarRonda(ruta: Ruta, leccion: LeccionEnRuta, resultados: ResultadoEjercicio[], superada: boolean): Promise<void> {
    await this.enTransaccion(async (c) => {
      for (const r of resultados) {
        await c.query(
          `INSERT INTO intentos_ejercicio (ruta_leccion_id, objetivo, correcto) VALUES ($1, $2, $3)`,
          [leccion.id, r.objetivo, r.correcto],
        );
      }
      await c.query(
        `UPDATE ruta_lecciones
            SET rondas = rondas + 1,
                aciertos = aciertos + $2,
                intentos = intentos + $3,
                estado = CASE WHEN $4 THEN 'superada' ELSE estado END,
                fecha_actualizacion = now()
          WHERE id = $1`,
        [leccion.id, resultados.filter((r) => r.correcto).length, resultados.length, superada],
      );
      // Siempre debe quedar una lección por practicar: si ya no hay ninguna disponible, se abre
      // la siguiente bloqueada en el orden de la ruta.
      await c.query(
        `UPDATE ruta_lecciones SET estado = 'disponible', fecha_actualizacion = now()
          WHERE id = (SELECT id FROM ruta_lecciones
                       WHERE ruta_id = $1 AND estado = 'bloqueada'
                         AND NOT EXISTS (SELECT 1 FROM ruta_lecciones WHERE ruta_id = $1 AND estado = 'disponible')
                       ORDER BY orden LIMIT 1)`,
        [ruta.id],
      );
      await this.actualizarProgreso(c, ruta.id, ruta.usuarioId);
    });
  }

  /**
   * Refleja la ruta en la tabla progreso (por módulo): superado si todas sus lecciones están
   * superadas, en curso si ya empezó, pendiente si no. El repaso libre no cambia el progreso.
   */
  private async actualizarProgreso(c: PoolClient, rutaId: number, usuarioId: number): Promise<void> {
    await c.query(
      `INSERT INTO progreso (usuario_id, modulo_id, estado)
       SELECT $2, l.modulo_id,
              CASE WHEN bool_and(rl.estado = 'superada') THEN 'superado'
                   WHEN bool_or(rl.estado = 'disponible' OR rl.estado = 'superada') THEN 'en_curso'
                   ELSE 'pendiente' END
         FROM ruta_lecciones rl JOIN lecciones l ON l.id = rl.leccion_id
        WHERE rl.ruta_id = $1 AND rl.origen <> 'repaso'
        GROUP BY l.modulo_id
       ON CONFLICT (usuario_id, modulo_id)
       DO UPDATE SET estado = EXCLUDED.estado, fecha_actualizacion = now()`,
      [rutaId, usuarioId],
    );
  }

  private async enTransaccion<T>(trabajo: (c: PoolClient) => Promise<T>): Promise<T> {
    const c = await this.db.connect();
    try {
      await c.query("BEGIN");
      const r = await trabajo(c);
      await c.query("COMMIT");
      return r;
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
}
