import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback) as (pin: string, sal: Buffer, largo: number) => Promise<Buffer>;

/** Reglas de las cuentas. */
export const MAX_INTENTOS = 5;
export const MINUTOS_BLOQUEO = 15;
export const DIAS_SESION = 30;
const FORMATO_USUARIO = /^[a-z0-9ñáéíóúü._-]{3,30}$/;
const FORMATO_PIN = /^\d{4}$/;
const FORMATO_TOKEN = /^[A-Za-z0-9_-]{43}$/;
const NOMBRE_MAXIMO = 60;

export interface Cuenta {
  id: number;
  usuario: string;
  nombre: string;
}

/** Contrato que el servicio de cuentas exige a la capa de datos. */
export interface ICuentaRepositorio {
  /** Crea la cuenta; devuelve null si ese nombre de usuario ya existe. */
  crearCuenta(usuario: string, nombre: string, pinHash: string): Promise<number | null>;
  cuentaPorUsuario(usuario: string): Promise<{
    id: number;
    nombre: string;
    pinHash: string;
    /** Minutos que faltan para que se desbloquee; 0 si no está bloqueada. */
    minutosBloqueo: number;
  } | null>;
  /** Suma un intento fallido; al llegar a `maximo` bloquea la cuenta `minutos` y reinicia la cuenta de intentos. */
  registrarIntentoFallido(usuarioId: number, maximo: number, minutos: number): Promise<void>;
  reiniciarIntentos(usuarioId: number): Promise<void>;
  crearSesion(usuarioId: number, tokenHash: string, dias: number): Promise<void>;
  /** La cuenta de una sesión abierta y vigente, o null. */
  cuentaDeSesion(tokenHash: string): Promise<Cuenta | null>;
  cerrarSesion(tokenHash: string): Promise<void>;
}

/** Error de uso de las cuentas: su mensaje se le puede mostrar a la persona. */
export class ErrorCuenta extends Error {
  constructor(
    public readonly motivo: "invalido" | "duplicado" | "credenciales" | "bloqueado" | "sin_sesion",
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/**
 * Cuentas e inicio de sesión. La persona entra con un nombre de usuario y un PIN de 4 números,
 * pensado para quien todavía está aprendiendo a leer y escribir:
 *  - el PIN se guarda como huella scrypt con sal, nunca en claro;
 *  - tras 5 intentos fallidos la cuenta se bloquea 15 minutos (con 10 000 PIN posibles, eso
 *    impide adivinarlo probando);
 *  - al entrar se entrega un token aleatorio de 256 bits que dura 30 días; en la base solo se
 *    guarda su huella SHA-256.
 */
export class ServicioCuentas {
  constructor(private readonly repo: ICuentaRepositorio) {}

  async registrar(usuarioTexto: unknown, pinTexto: unknown, nombreTexto: unknown): Promise<{ token: string; cuenta: Cuenta }> {
    const usuario = this.validarUsuario(usuarioTexto);
    const pin = this.validarPin(pinTexto);
    if (/^(\d)\1{3}$/.test(pin) || pin === "1234" || pin === "4321") {
      throw new ErrorCuenta("invalido", "Ese PIN es muy fácil de adivinar. Elige 4 números que no sean todos iguales ni 1234.");
    }
    const nombre = this.validarNombre(nombreTexto);
    const id = await this.repo.crearCuenta(usuario, nombre, await huellaPin(pin));
    if (id === null) throw new ErrorCuenta("duplicado", "Ese nombre de usuario ya existe. Elige otro.");
    const cuenta = { id, usuario, nombre };
    return { token: await this.abrirSesion(id), cuenta };
  }

  async entrar(usuarioTexto: unknown, pinTexto: unknown): Promise<{ token: string; cuenta: Cuenta }> {
    const incorrecto = new ErrorCuenta("credenciales", "El usuario o el PIN no son correctos.");
    const usuario = typeof usuarioTexto === "string" ? normalizarUsuario(usuarioTexto) : "";
    const pin = typeof pinTexto === "string" ? pinTexto.trim() : "";
    if (!FORMATO_USUARIO.test(usuario) || !FORMATO_PIN.test(pin)) throw incorrecto;

    const cuenta = await this.repo.cuentaPorUsuario(usuario);
    if (cuenta === null) {
      await huellaPin(pin); // mismo tiempo de respuesta exista o no el usuario
      throw incorrecto;
    }
    if (cuenta.minutosBloqueo > 0) {
      throw new ErrorCuenta(
        "bloqueado",
        `Hubo muchos intentos con un PIN equivocado. Espera ${cuenta.minutosBloqueo} ${cuenta.minutosBloqueo === 1 ? "minuto" : "minutos"} e intenta otra vez.`,
      );
    }
    if (!(await pinCoincide(pin, cuenta.pinHash))) {
      await this.repo.registrarIntentoFallido(cuenta.id, MAX_INTENTOS, MINUTOS_BLOQUEO);
      throw incorrecto;
    }
    await this.repo.reiniciarIntentos(cuenta.id);
    return { token: await this.abrirSesion(cuenta.id), cuenta: { id: cuenta.id, usuario, nombre: cuenta.nombre } };
  }

  /** La cuenta dueña de un token, o un error "sin_sesion" si no hay sesión vigente. */
  async cuentaDeToken(token: string | undefined): Promise<Cuenta> {
    const cuenta = token && FORMATO_TOKEN.test(token) ? await this.repo.cuentaDeSesion(huellaToken(token)) : null;
    if (cuenta === null) throw new ErrorCuenta("sin_sesion", "Inicia sesión para continuar.");
    return cuenta;
  }

  async salir(token: string | undefined): Promise<void> {
    if (token && FORMATO_TOKEN.test(token)) await this.repo.cerrarSesion(huellaToken(token));
  }

  private async abrirSesion(usuarioId: number): Promise<string> {
    const token = randomBytes(32).toString("base64url");
    await this.repo.crearSesion(usuarioId, huellaToken(token), DIAS_SESION);
    return token;
  }

  // ---------------------------------------------------------------- validación

  private validarUsuario(valor: unknown): string {
    const usuario = typeof valor === "string" ? normalizarUsuario(valor) : "";
    if (!FORMATO_USUARIO.test(usuario)) {
      throw new ErrorCuenta("invalido", "El usuario debe tener entre 3 y 30 letras o números, sin espacios.");
    }
    return usuario;
  }

  private validarPin(valor: unknown): string {
    const pin = typeof valor === "string" ? valor.trim() : "";
    if (!FORMATO_PIN.test(pin)) throw new ErrorCuenta("invalido", "El PIN debe tener exactamente 4 números.");
    return pin;
  }

  private validarNombre(valor: unknown): string {
    // eslint-disable-next-line no-control-regex
    const nombre = typeof valor === "string" ? valor.replace(/[\u0000-\u001f\u007f]/g, "").trim() : "";
    if (nombre.length === 0) throw new ErrorCuenta("invalido", "Escribe tu nombre.");
    if (nombre.length > NOMBRE_MAXIMO) throw new ErrorCuenta("invalido", `El nombre no puede pasar de ${NOMBRE_MAXIMO} letras.`);
    return nombre;
  }
}

function normalizarUsuario(texto: string): string {
  return texto.trim().toLowerCase().normalize("NFC");
}

const LARGO_HUELLA = 32;

/** Huella del PIN: scrypt con sal aleatoria, en el formato "scrypt$sal$huella" (base64). */
export async function huellaPin(pin: string): Promise<string> {
  const sal = randomBytes(16);
  const huella = await scrypt(pin, sal, LARGO_HUELLA);
  return `scrypt$${sal.toString("base64")}$${huella.toString("base64")}`;
}

export async function pinCoincide(pin: string, guardada: string): Promise<boolean> {
  const [algoritmo, sal, huella] = guardada.split("$");
  if (algoritmo !== "scrypt" || !sal || !huella) return false;
  const esperada = Buffer.from(huella, "base64");
  const calculada = await scrypt(pin, Buffer.from(sal, "base64"), esperada.length);
  return calculada.length === esperada.length && timingSafeEqual(calculada, esperada);
}

function huellaToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
