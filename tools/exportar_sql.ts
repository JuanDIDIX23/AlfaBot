import * as fs from "fs";
import * as path from "path";

/**
 * Arma los archivos SQL que se entregan con el manual técnico (carpeta entregables/):
 *
 *   alfabot_base_de_datos.sql    script completo de creación y carga, en el orden correcto:
 *                                esquema, 40 reglas, 5 hipótesis, 200 verosimilitudes, 25 lecciones
 *                                e historial. Es la unión de sql/01, 02, 04 y 05.
 *   alfabot_schema_export.sql    solo el esquema, exportado con la herramienta del gestor:
 *                                  pg_dump --schema-only --no-owner --no-privileges "$DATABASE_URL"
 *                                    > entregables/alfabot_schema_export.sql
 *                                (este script no lo regenera: hace falta pg_dump instalado).
 *
 * Uso:  npm run exportar-sql
 * El rol de aplicación (sql/03) no se incluye: necesita una clave y lo crea `npm run cargar-bd`.
 */
const RAIZ = path.join(__dirname, "..");
const PARTES = ["01_conocimiento_y_transaccional.sql", "02_inferencia.sql", "04_aprendizaje.sql", "05_historial.sql"];

const encabezado = `-- ============================================================
-- AlfaBot — script completo de creación y carga (PostgreSQL)
-- Generado con \`npm run exportar-sql\` a partir de: ${PARTES.map((p) => `sql/${p}`).join(", ")}
-- Ejecutar sobre una base vacía, por ejemplo:  psql "$DATABASE_URL" -f alfabot_base_de_datos.sql
-- ============================================================

BEGIN;
`;
const cuerpo = PARTES.map((p) => `\n-- >>>>>>>>>> sql/${p}\n\n${fs.readFileSync(path.join(RAIZ, "sql", p), "utf8").trim()}\n`).join("");
const destino = path.join(RAIZ, "entregables");
fs.mkdirSync(destino, { recursive: true });
fs.writeFileSync(path.join(destino, "alfabot_base_de_datos.sql"), `${encabezado}${cuerpo}\nCOMMIT;\n`);
console.log("Listo: entregables/alfabot_base_de_datos.sql");
if (!fs.existsSync(path.join(destino, "alfabot_schema_export.sql"))) {
  console.log("Falta entregables/alfabot_schema_export.sql: genéralo con pg_dump (ver el comentario de este script).");
}
