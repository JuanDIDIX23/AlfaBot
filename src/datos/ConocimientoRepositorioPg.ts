import { Pool } from "pg";
import { IConocimientoRepositorio } from "../negocio/Repositorios";
import { Hipotesis } from "../negocio/modelos/Hipotesis";
import { Granulo, MatrizNodo, Nodo, Rama, TipoRegla } from "../negocio/modelos/Conocimiento";

/**
 * Acceso de solo lectura a la base de conocimiento (hipotesis, modulos, nodos, ramas,
 * reglas, verosimilitudes). Cada método es una consulta puntual: el motor las encadena.
 */
export class ConocimientoRepositorioPg implements IConocimientoRepositorio {
  constructor(private readonly db: Pool) {}

  async hipotesis(): Promise<Hipotesis[]> {
    const r = await this.db.query(
      `SELECT id, codigo, nombre, descripcion, nivel, prior::float8 AS prior
         FROM hipotesis
        ORDER BY id`,
    );
    return r.rows.map((f) => new Hipotesis(f.id, f.codigo, f.nombre, f.descripcion, f.nivel, f.prior));
  }

  async nodosPendientes(nodosRespondidos: number[]): Promise<Nodo[]> {
    const r = await this.db.query(
      `SELECT n.id, n.codigo, n.pregunta, m.codigo AS modulo, m.orden AS modulo_orden,
              n.orden AS posicion,
              (SELECT count(*) FROM nodos x WHERE x.modulo_id = n.modulo_id)::int AS total
         FROM nodos n
         JOIN modulos m ON m.id = n.modulo_id
        WHERE n.id <> ALL($1::int[])
        ORDER BY n.id`,
      [nodosRespondidos],
    );
    return r.rows.map(
      (f) => new Nodo(f.id, f.codigo, f.pregunta, f.modulo, f.modulo_orden, f.posicion, f.total),
    );
  }

  async matrizDeNodo(nodoId: number): Promise<MatrizNodo> {
    const nodoRes = await this.db.query(
      `SELECT n.id, n.codigo, n.pregunta, m.codigo AS modulo, m.orden AS modulo_orden,
              n.orden AS posicion,
              (SELECT count(*) FROM nodos x WHERE x.modulo_id = n.modulo_id)::int AS total
         FROM nodos n
         JOIN modulos m ON m.id = n.modulo_id
        WHERE n.id = $1`,
      [nodoId],
    );
    if (nodoRes.rowCount === 0) throw new Error(`No existe el nodo ${nodoId}`);
    const n = nodoRes.rows[0];
    const nodo = new Nodo(n.id, n.codigo, n.pregunta, n.modulo, n.modulo_orden, n.posicion, n.total);

    const r = await this.db.query(
      `SELECT ra.id AS rama_id, ra.codigo, ra.condicion, rg.tipo,
              v.hipotesis_id, v.probabilidad::float8 AS p
         FROM ramas ra
         JOIN reglas rg ON rg.rama_id = ra.id
         JOIN verosimilitudes v ON v.rama_id = ra.id
        WHERE ra.nodo_id = $1
        ORDER BY ra.id, v.hipotesis_id`,
      [nodoId],
    );

    const ramas: Rama[] = [];
    const verosimilitud: number[][] = [];
    const hipotesisIds: number[] = [];
    let ultimaRama = -1;
    for (const f of r.rows) {
      if (f.rama_id !== ultimaRama) {
        ramas.push(new Rama(f.rama_id, nodoId, f.codigo, f.condicion, f.tipo as TipoRegla));
        verosimilitud.push([]);
        ultimaRama = f.rama_id;
      }
      verosimilitud[verosimilitud.length - 1].push(f.p);
      if (ramas.length === 1) hipotesisIds.push(f.hipotesis_id);
    }
    return new MatrizNodo(nodo, ramas, hipotesisIds, verosimilitud);
  }

  async granuloDeRama(ramaId: number): Promise<Granulo> {
    const g = await this.db.query(
      `SELECT ra.id AS rama_id, ra.nodo_id, ra.codigo, ra.condicion,
              rg.id AS regla_id, rg.codigo AS regla_codigo, rg.accion_texto, rg.tipo,
              m.id AS modulo_id, m.codigo AS modulo, m.orden AS modulo_orden
         FROM ramas ra
         JOIN reglas rg ON rg.rama_id = ra.id
         JOIN nodos n ON n.id = ra.nodo_id
         JOIN modulos m ON m.id = n.modulo_id
        WHERE ra.id = $1`,
      [ramaId],
    );
    if (g.rowCount === 0) throw new Error(`No existe la rama ${ramaId}`);
    const f = g.rows[0];

    const v = await this.db.query(
      `SELECT hipotesis_id, probabilidad::float8 AS p
         FROM verosimilitudes
        WHERE rama_id = $1`,
      [ramaId],
    );
    const pesos = new Map<number, number>(v.rows.map((x) => [x.hipotesis_id as number, x.p as number]));

    const rama = new Rama(f.rama_id, f.nodo_id, f.codigo, f.condicion, f.tipo as TipoRegla);
    return new Granulo(rama, f.regla_id, f.regla_codigo, f.accion_texto, f.modulo_id, f.modulo, f.modulo_orden, pesos);
  }
}
