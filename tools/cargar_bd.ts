import * as fs from "fs";
import * as path from "path";
import { Conexion } from "../src/datos/Conexion";

/**
 * Carga la base de conocimiento de AlfaBot (y el sistema transaccional) en un PostgreSQL, local o
 * en la nube (Amazon RDS, Azure Database for PostgreSQL). Usa las mismas variables de entorno que la aplicación:
 *
 *   PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE   (y PGSSL=true en la nube)
 *
 * Uso:
 *   npm run cargar-bd                 crea las tablas y carga las reglas; falla si ya existen
 *   npm run cargar-bd -- --reiniciar  borra las tablas de AlfaBot y vuelve a cargar todo
 *
 * Si se define ALFABOT_APP_PASSWORD, además crea el rol de aplicación `alfabot_app` (permisos mínimos).
 */
const TABLAS = [
  "diagnosticos", "inferencias", "respuestas", "progreso", "evaluaciones", "usuarios",
  "verosimilitudes", "hipotesis", "reglas", "ramas", "nodos", "modulos",
];
const RAIZ = path.join(__dirname, "..");
const leer = (archivo: string) => fs.readFileSync(path.join(RAIZ, "sql", archivo), "utf8");

async function main(): Promise<void> {
  const reiniciar = process.argv.includes("--reiniciar");
  const clave = process.env.ALFABOT_APP_PASSWORD;
  if (clave !== undefined && clave.length < 12) throw new Error("ALFABOT_APP_PASSWORD debe tener al menos 12 caracteres");

  const db = Conexion.obtener();
  const cliente = await db.connect();
  try {
    const existe = await cliente.query(`SELECT to_regclass('public.hipotesis') IS NOT NULL AS existe`);
    if (existe.rows[0].existe && !reiniciar) {
      throw new Error("Las tablas de AlfaBot ya existen. Usa --reiniciar si quieres borrarlas y cargar de nuevo.");
    }

    await cliente.query("BEGIN");
    if (reiniciar) await cliente.query(`DROP TABLE IF EXISTS ${TABLAS.join(", ")} CASCADE`);
    await cliente.query(leer("01_conocimiento_y_transaccional.sql"));
    await cliente.query(leer("02_inferencia.sql"));

    if (clave !== undefined) {
      const rol = await cliente.query(`SELECT 1 FROM pg_roles WHERE rolname = 'alfabot_app'`);
      const verbo = rol.rowCount === 0 ? "CREATE" : "ALTER";
      const ddl = await cliente.query(`SELECT format('${verbo} ROLE alfabot_app LOGIN PASSWORD %L', $1::text) AS ddl`, [clave]);
      await cliente.query(ddl.rows[0].ddl);
      await cliente.query(leer("03_rol_aplicacion.sql"));
    }
    await cliente.query("COMMIT");

    const c = await cliente.query(`
      SELECT (SELECT count(*) FROM modulos)::int AS modulos, (SELECT count(*) FROM nodos)::int AS nodos,
             (SELECT count(*) FROM ramas)::int AS ramas, (SELECT count(*) FROM reglas)::int AS reglas,
             (SELECT count(*) FROM hipotesis)::int AS hipotesis, (SELECT count(*) FROM verosimilitudes)::int AS verosimilitudes`);
    const f = c.rows[0];
    console.log("Base de conocimiento cargada:");
    console.log(`  ${f.modulos} módulos, ${f.nodos} nodos (preguntas), ${f.ramas} ramas (respuestas), ${f.reglas} reglas SI-ENTONCES`);
    console.log(`  ${f.hipotesis} hipótesis, ${f.verosimilitudes} verosimilitudes`);
    if (clave !== undefined) console.log("  Rol de aplicación alfabot_app creado con permisos mínimos");
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    cliente.release();
    await Conexion.cerrar();
  }
}

main().catch((e) => {
  console.error("Error:", e instanceof Error ? e.message : e);
  process.exit(1);
});
