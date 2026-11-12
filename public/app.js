"use strict";

const $ = (id) => document.getElementById(id);
const CLAVE = "alfabot.evaluacion";
const pantallas = ["acceso", "inicio", "pregunta", "resultado", "historial", "camino", "leccion", "ejercicio", "fin-ronda"];
const CLAVE_SESION = "alfabot.sesion";

/** La cuenta con sesión iniciada: { usuario, nombre } o null. */
let cuenta = null;

// ---------------------------------------------------------------- utilidades

function guardarId(id) {
  try { localStorage.setItem(CLAVE, String(id)); } catch (_) { /* el navegador puede bloquear el almacenamiento */ }
}
function leerId() {
  try { return localStorage.getItem(CLAVE); } catch (_) { return null; }
}
function borrarId() {
  try { localStorage.removeItem(CLAVE); } catch (_) { /* sin almacenamiento: no pasa nada */ }
}

/** Token de la sesión iniciada en este navegador (lo entrega el servidor al entrar). */
function leerToken() {
  try { return localStorage.getItem(CLAVE_SESION); } catch (_) { return null; }
}
function guardarToken(token) {
  try { localStorage.setItem(CLAVE_SESION, token); } catch (_) { /* sin almacenamiento: la sesión dura hasta recargar */ }
  tokenEnMemoria = token;
}
let tokenEnMemoria = null;
/** Al salir se borra todo lo que este navegador recordaba de la persona. */
function olvidarSesion() {
  tokenEnMemoria = null;
  cuenta = null;
  try {
    for (const k of [CLAVE_SESION, CLAVE, "alfabot.ruta", "alfabot.usuario"]) localStorage.removeItem(k);
  } catch (_) { /* sin almacenamiento */ }
}

function aviso(texto) {
  const caja = $("aviso");
  caja.textContent = texto || "";
  caja.hidden = !texto;
}

function mostrar(nombre, foco) {
  callar(); // al cambiar de pantalla se detiene lo que se estaba leyendo
  for (const p of pantallas) $(p).hidden = p !== nombre;
  aviso("");
  if (foco) foco.focus();
}

async function api(ruta, opciones = {}) {
  let respuesta;
  const headers = {};
  if (opciones.body) headers["Content-Type"] = "application/json";
  const token = leerToken() || tokenEnMemoria;
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    respuesta = await fetch(ruta, { ...opciones, headers });
  } catch (_) {
    throw new Error("No pude conectarme con el servicio. Revisa tu internet e intenta otra vez.");
  }
  let cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (_) { /* respuesta sin cuerpo JSON */ }
  if (respuesta.status === 401 && cuerpo && cuerpo.motivo === "sin_sesion") {
    // La sesión venció o se cerró en otro lado: se vuelve a la pantalla de entrar.
    olvidarSesion();
    mostrarAcceso("Tu sesión terminó. Entra otra vez con tu usuario y tu PIN.");
  }
  if (!respuesta.ok) {
    const error = new Error((cuerpo && cuerpo.error) || "El servicio no pudo responder.");
    error.estado = respuesta.status;
    throw error;
  }
  return cuerpo;
}

// ---------------------------------------------------------------- lectura en voz alta
// Usa la voz que trae el navegador (Web Speech API): no necesita servidor ni claves.

const voz = {
  disponible: "speechSynthesis" in window && "SpeechSynthesisUtterance" in window,
  elegida: null,
  boton: null, // el botón 🔊 que está sonando ahora
};

function elegirVoz() {
  const voces = speechSynthesis.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith("es"));
  // Preferimos voces de Latinoamérica, luego España, luego cualquier voz en español.
  const orden = ["es-co", "es-419", "es-mx", "es-us", "es-es"];
  voces.sort((a, b) => {
    const ia = orden.indexOf(a.lang.toLowerCase()), ib = orden.indexOf(b.lang.toLowerCase());
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || Number(b.localService) - Number(a.localService);
  });
  voz.elegida = voces[0] || null;
}

function marcarBoton(boton, sonando) {
  if (!boton) return;
  boton.classList.toggle("sonando", sonando);
  boton.setAttribute("aria-pressed", String(sonando));
  boton.textContent = sonando ? "⏹" : "🔊";
}

function callar() {
  if (!voz.disponible) return;
  speechSynthesis.cancel();
  marcarBoton(voz.boton, false);
  voz.boton = null;
}

/**
 * Lee en voz alta una lista de textos. Si ya estaba sonando ese mismo botón, lo detiene.
 * Sin botón (lectura automática) siempre interrumpe lo anterior y empieza de nuevo.
 */
function leer(textos, boton) {
  if (!voz.disponible) return;
  const repetir = Boolean(boton) && voz.boton === boton && speechSynthesis.speaking;
  callar();
  if (repetir) return;

  // Se lee frase por frase: algunos navegadores cortan los textos largos a mitad.
  const frases = textos
    .filter(Boolean)
    .flatMap((t) => String(t).match(/[^.!?¿¡]+[.!?]*|[¿¡][^?!]*[?!]/g) || [])
    .map((f) => f.trim())
    .filter(Boolean);
  if (!frases.length) return;

  voz.boton = boton;
  marcarBoton(boton, true);
  frases.forEach((frase, i) => {
    const u = new SpeechSynthesisUtterance(frase);
    u.lang = voz.elegida ? voz.elegida.lang : "es-ES";
    if (voz.elegida) u.voice = voz.elegida;
    u.rate = 0.9; // un poco más lento que lo normal, para seguir el texto con calma
    if (i === frases.length - 1) {
      u.onend = u.onerror = () => {
        if (voz.boton === boton) { marcarBoton(boton, false); voz.boton = null; }
      };
    }
    speechSynthesis.speak(u);
  });
}

function crearBotonVoz(etiqueta, obtenerTextos) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "voz";
  boton.textContent = "🔊";
  boton.setAttribute("aria-label", etiqueta);
  boton.hidden = !voz.disponible;
  boton.addEventListener("click", () => leer(obtenerTextos(), boton));
  return boton;
}

const texto = (id) => $(id).textContent.trim();

// Qué se lee con cada botón 🔊 que ya está escrito en el HTML (atributo data-leer).
const lecturas = {
  inicio: () => [texto("titulo-inicio"), texto("intro-inicio"), "Toca Hacer una evaluación nueva para empezar."],
  pendiente: () => [texto("texto-pendiente"), "Toca Continuar donde iba para seguir."],
  acceso: () => [texto("titulo-acceso"), texto("intro-acceso"), "Si ya tienes cuenta, escribe tu usuario y tu PIN. Si eres nuevo, toca Soy nuevo."],
  "entrar-usuario": () => ["Escribe tu usuario: el nombre que elegiste para entrar."],
  "entrar-pin": () => ["Escribe tu PIN: los 4 números que elegiste. Luego toca Entrar."],
  "crear-nombre": () => ["¿Cómo te llamas? Escribe tu nombre."],
  "crear-usuario": () => ["Elige un usuario para entrar. Puede ser tu nombre y tu apellido unidos con un punto, sin espacios."],
  "crear-pin": () => ["Elige un PIN de 4 números. Que no sean todos iguales ni 1, 2, 3, 4. Apúntalo para no olvidarlo. Después escríbelo otra vez abajo."],
  pregunta: () => [
    texto("enunciado"),
    ...[...document.querySelectorAll("#opciones .opcion")].map((b, i) => `Opción ${i + 1}: ${b.textContent.trim()}.`),
  ],
  resultado: () => [`Tu resultado: ${texto("titulo-resultado")}.`, texto("descripcion"), texto("confianza")],
  plan: () => {
    const items = [...document.querySelectorAll("#plan .actividad")].map((d, i) => `Actividad ${i + 1}: ${d.textContent.trim()}.`);
    return items.length ? ["Tu plan de actividades.", ...items] : [texto("sin-plan")];
  },
};

function prepararVoz() {
  if (!voz.disponible) return;
  elegirVoz();
  speechSynthesis.addEventListener?.("voiceschanged", elegirVoz); // Chrome carga las voces tarde
  for (const boton of document.querySelectorAll("button.voz[data-leer]")) {
    boton.hidden = false;
    // Se busca al tocar: otros archivos (aprendizaje.js) agregan sus propias lecturas.
    boton.addEventListener("click", () => leer(lecturas[boton.dataset.leer](), boton));
  }
  window.addEventListener("pagehide", callar);
}

function porcentaje(p) {
  return `${(p * 100).toFixed(1).replace(".", ",")} %`;
}

function dibujarBarras(contenedor, creencias) {
  contenedor.replaceChildren();
  const lider = Math.max(...creencias.map((c) => c.probabilidad));
  for (const c of creencias) {
    const fila = document.createElement("div");
    fila.className = "barra" + (c.probabilidad === lider ? " lider" : "");

    const etiqueta = document.createElement("span");
    etiqueta.className = "etiqueta";
    etiqueta.textContent = `${c.codigo} · ${c.nombre}`;

    const pista = document.createElement("div");
    pista.className = "pista";
    const relleno = document.createElement("div");
    relleno.className = "relleno";
    relleno.style.width = `${Math.max(c.probabilidad * 100, 0.5)}%`;
    pista.appendChild(relleno);

    const valor = document.createElement("span");
    valor.className = "valor";
    valor.textContent = porcentaje(c.probabilidad);

    fila.append(etiqueta, pista, valor);
    contenedor.appendChild(fila);
  }
}

// ---------------------------------------------------------------- pantallas

function pintarPregunta(estado, regla) {
  const q = estado.pregunta;
  $("contador").textContent = `Pregunta ${q.numero}`;
  $("enunciado").textContent = q.texto;

  const cajaRegla = $("regla");
  cajaRegla.hidden = !regla;
  if (regla) cajaRegla.textContent = `Regla aplicada con tu respuesta anterior: ${regla.codigo} — ${regla.condicion}`;

  const opciones = $("opciones");
  opciones.replaceChildren();
  q.opciones.forEach((o, i) => {
    const fila = document.createElement("div");
    fila.className = "fila-opcion";
    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "opcion";
    boton.textContent = o.texto;
    boton.addEventListener("click", () => responder(estado.evaluacionId, o.ramaId));
    fila.append(boton, crearBotonVoz(`Escuchar la opción ${i + 1}`, () => [o.texto]));
    opciones.appendChild(fila);
  });
  dibujarBarras($("barras-pregunta"), estado.creencias);
  mostrar("pregunta", $("enunciado"));
}

function pintarResultado(estado) {
  const r = estado.resultado;
  borrarId(); // la evaluación terminó: ya no hay nada que reanudar
  $("aprender").dataset.evaluacion = String(estado.evaluacionId);
  $("titulo-resultado").textContent = `${r.ganadora.codigo} · ${r.ganadora.nombre}`;
  $("descripcion").textContent = r.ganadora.descripcion;
  $("confianza").textContent = r.confianzaAlcanzada
    ? `Estoy bastante seguro (${porcentaje(r.ganadora.probabilidad)}), con ${r.preguntasRespondidas} preguntas.`
    : `No estoy del todo seguro (${porcentaje(r.ganadora.probabilidad)}). Ya no quedan preguntas que aclaren más; revisa también el nivel cercano.`;
  dibujarBarras($("barras-resultado"), r.creencias);

  const lista = $("plan");
  lista.replaceChildren();
  for (const a of r.plan) {
    const item = document.createElement("li");
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = `Módulo ${a.modulo} · Regla ${a.regla}`;
    const cabeza = document.createElement("div");
    cabeza.className = "con-voz";
    const actividad = document.createElement("div");
    actividad.className = "actividad";
    actividad.textContent = `${a.condicion}: ${a.accion}`;
    cabeza.append(chip, crearBotonVoz(`Escuchar la actividad ${lista.children.length + 1}`, () => [actividad.textContent]));
    item.append(cabeza, actividad);
    lista.appendChild(item);
  }
  $("sin-plan").hidden = r.plan.length > 0;
  mostrar("resultado", $("titulo-resultado"));
}

function pintar(estado, regla) {
  if (estado.estado === "completada") pintarResultado(estado);
  else pintarPregunta(estado, regla);
}

// ---------------------------------------------------------------- acciones

async function comenzar() {
  const boton = $("comenzar");
  boton.disabled = true;
  try {
    const estado = await api("/api/evaluaciones", { method: "POST" });
    guardarId(estado.evaluacionId);
    pintar(estado, null);
  } catch (e) {
    aviso(e.message);
  } finally {
    boton.disabled = false;
  }
}

async function responder(id, ramaId) {
  const botones = document.querySelectorAll(".opcion");
  botones.forEach((b) => (b.disabled = true));
  try {
    const estado = await api(`/api/evaluaciones/${id}/respuestas`, { method: "POST", body: JSON.stringify({ ramaId }) });
    pintar(estado, estado.regla);
  } catch (e) {
    aviso(e.message);
    botones.forEach((b) => (b.disabled = false));
  }
}

async function continuarEvaluacion() {
  const id = leerId();
  try {
    const estado = await api(`/api/evaluaciones/${encodeURIComponent(id)}`);
    pintar(estado, null);
  } catch (e) {
    if (e.estado === 404) borrarId();
    aviso(e.message);
    $("pendiente").hidden = true;
  }
}

/** Vuelve al inicio de la cuenta, con los avisos al día (evaluación a medias, camino en marcha). */
function reiniciar() {
  return cargarInicio();
}

/**
 * Inicio de la cuenta: lo que hay pendiente se lee del historial guardado en el servidor, así que
 * es lo mismo en cualquier dispositivo donde la persona entre.
 */
async function cargarInicio() {
  if (!cuenta) return mostrarAcceso();
  $("titulo-inicio").textContent = `Hola, ${cuenta.nombre}`;
  let h = null;
  try {
    h = await api("/api/historial");
  } catch (e) {
    if (!cuenta) return; // la sesión venció: ya se mostró la pantalla de entrar
    aviso(e.message);
  }
  const pendiente = h && h.evaluaciones.find((e) => e.estado === "en_curso" && e.preguntasRespondidas > 0);
  const conRuta = h && h.evaluaciones.find((e) => e.ruta);
  if (pendiente) guardarId(pendiente.evaluacionId);
  else borrarId();
  if (conRuta) guardarClave(conRuta.ruta.clave);
  else borrarClave();
  $("pendiente").hidden = !pendiente;
  $("ruta-guardada").hidden = !conRuta;
  if (conRuta) {
    $("texto-ruta-guardada").textContent =
      `Tienes un plan de aprendizaje en marcha: ${conRuta.ruta.superadas} de ${conRuta.ruta.total} ${conRuta.ruta.total === 1 ? "lección superada" : "lecciones superadas"}.`;
  }
  mostrar("inicio", $("titulo-inicio"));
}

// ---------------------------------------------------------------- cuenta y sesión

function mostrarAcceso(mensaje) {
  elegirPestana("entrar");
  mostrar("acceso", $("titulo-acceso"));
  if (mensaje) aviso(mensaje);
}

function elegirPestana(cual) {
  const entrar = cual === "entrar";
  $("tab-entrar").setAttribute("aria-selected", String(entrar));
  $("tab-crear").setAttribute("aria-selected", String(!entrar));
  $("form-entrar").hidden = !entrar;
  $("form-crear").hidden = entrar;
  aviso("");
}

const soloNumeros = (input) => input.addEventListener("input", () => {
  input.value = input.value.replace(/\D/g, "").slice(0, 4);
});

async function sesionIniciada(r) {
  guardarToken(r.token);
  cuenta = r.cuenta;
  for (const id of ["entrar-pin", "crear-pin", "crear-pin2"]) $(id).value = "";
  await cargarInicio();
}

async function entrar(evento) {
  evento.preventDefault();
  const usuario = $("entrar-usuario").value.trim();
  const pin = $("entrar-pin").value;
  if (!usuario) return avisarCampo("Escribe tu usuario.", "entrar-usuario");
  if (!/^\d{4}$/.test(pin)) return avisarCampo("El PIN tiene 4 números.", "entrar-pin");
  const boton = $("boton-entrar");
  boton.disabled = true;
  try {
    await sesionIniciada(await api("/api/sesiones", { method: "POST", body: JSON.stringify({ usuario, pin }) }));
  } catch (e) {
    $("entrar-pin").value = "";
    avisarCampo(e.message, "entrar-pin");
  } finally {
    boton.disabled = false;
  }
}

async function crearCuenta(evento) {
  evento.preventDefault();
  const nombre = $("crear-nombre").value.trim();
  const usuario = $("crear-usuario").value.trim();
  const pin = $("crear-pin").value;
  if (!nombre) return avisarCampo("Escribe tu nombre.", "crear-nombre");
  if (!/^[A-Za-z0-9ñÑáéíóúÁÉÍÓÚüÜ._-]{3,30}$/.test(usuario)) {
    return avisarCampo("El usuario debe tener entre 3 y 30 letras o números, sin espacios.", "crear-usuario");
  }
  if (!/^\d{4}$/.test(pin)) return avisarCampo("El PIN debe tener 4 números.", "crear-pin");
  if (pin !== $("crear-pin2").value) {
    $("crear-pin2").value = "";
    return avisarCampo("Los dos PIN no son iguales. Escríbelo otra vez.", "crear-pin2");
  }
  const boton = $("boton-crear");
  boton.disabled = true;
  try {
    await sesionIniciada(await api("/api/cuentas", { method: "POST", body: JSON.stringify({ nombre, usuario, pin }) }));
  } catch (e) {
    avisarCampo(e.message, /usuario/i.test(e.message) ? "crear-usuario" : "crear-pin");
  } finally {
    boton.disabled = false;
  }
}

function avisarCampo(mensaje, id) {
  aviso(mensaje);
  decir(mensaje);
  $(id).focus();
}

async function cerrarSesion() {
  try { await api("/api/sesiones", { method: "DELETE" }); } catch (_) { /* aunque falle, se olvida aquí */ }
  olvidarSesion();
  $("entrar-usuario").value = "";
  mostrarAcceso();
}

/** Al abrir la página: si este navegador tiene una sesión vigente, entra directo. */
async function retomarSesion() {
  if (!leerToken()) return mostrarAcceso();
  try {
    cuenta = (await api("/api/sesiones")).cuenta;
    await cargarInicio();
  } catch (_) {
    if (!$("acceso").hidden) return; // ya se mostró por sesión vencida
    mostrarAcceso();
  }
}

async function revisarServicio() {
  const caja = $("estado-servicio");
  try {
    const s = await api("/api/salud");
    caja.textContent = `Servicio en la nube conectado a la base de conocimiento (${s.hipotesis} hipótesis)`;
    caja.className = "estado ok";
  } catch (_) {
    caja.textContent = "Servicio no disponible por ahora";
    caja.className = "estado mal";
  }
}

async function iniciar() {
  $("comenzar").addEventListener("click", comenzar);
  $("continuar").addEventListener("click", continuarEvaluacion);
  $("reiniciar").addEventListener("click", reiniciar);
  $("form-entrar").addEventListener("submit", entrar);
  $("form-crear").addEventListener("submit", crearCuenta);
  $("tab-entrar").addEventListener("click", () => elegirPestana("entrar"));
  $("tab-crear").addEventListener("click", () => elegirPestana("crear"));
  $("cerrar-sesion").addEventListener("click", cerrarSesion);
  ["entrar-pin", "crear-pin", "crear-pin2"].forEach((id) => soloNumeros($(id)));
  prepararVoz();
  revisarServicio();
  // Se espera a que carguen aprendizaje.js e historial.js, que agregan funciones al inicio.
  window.addEventListener("load", retomarSesion);
}

iniciar();
