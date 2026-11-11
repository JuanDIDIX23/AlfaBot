import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import AdmZip from "adm-zip";

/**
 * Prepara el paquete que se sube a la nube (Azure App Service, AWS Elastic Beanstalk u otra):
 * el servicio ya compilado (JavaScript), la interfaz web y un package.json solo con las
 * dependencias de producción.
 *
 *   npm run empaquetar
 *     -> carpeta  despliegue/      (Azure: az webapp up, desde esa carpeta)
 *     -> archivo  despliegue.zip   (AWS Elastic Beanstalk: se sube en la consola)
 *
 * El zip se genera aquí, con rutas con "/" y package.json en la raíz, para no depender del
 * compresor de Windows (que a veces arma zips que Linux no entiende).
 */
const raiz = path.join(__dirname, "..");
const destino = path.join(raiz, "despliegue");
const origen = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));

fs.rmSync(destino, { recursive: true, force: true });
fs.mkdirSync(destino, { recursive: true });

execSync(`npx tsc -p tsconfig.build.json --outDir "${path.join(destino, "dist")}"`, { cwd: raiz, stdio: "inherit" });
fs.cpSync(path.join(raiz, "public"), path.join(destino, "public"), { recursive: true });

const paquete = {
  name: origen.name,
  version: origen.version,
  private: true,
  description: origen.description,
  scripts: { start: "node dist/presentacion/web/servidor.js" },
  engines: { node: ">=20" },
  dependencies: origen.dependencies,
};
fs.writeFileSync(path.join(destino, "package.json"), JSON.stringify(paquete, null, 2) + "\n");
// El lock fija las versiones exactas que se probaron.
execSync("npm install --package-lock-only --omit=dev --ignore-scripts --silent", { cwd: destino, stdio: "inherit" });

const zip = new AdmZip();
zip.addLocalFolder(destino); // package.json, package-lock.json, dist/ y public/ quedan en la raíz del zip
const rutaZip = path.join(raiz, "despliegue.zip");
fs.rmSync(rutaZip, { force: true });
zip.writeZip(rutaZip);

console.log("Carpeta lista: despliegue/ (dist, public, package.json, package-lock.json)");
console.log(`Zip listo: despliegue.zip (${(fs.statSync(rutaZip).size / 1024).toFixed(0)} KB)`);
