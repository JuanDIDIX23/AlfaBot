"use strict";

const $ = (id) => document.getElementById(id);
const CLAVE = "alfabot.evaluacion";
const pantallas = ["inicio", "pregunta", "resultado"];

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
  try {
    respuesta = await fetch(ruta, {
      ...opciones,
      headers: opciones.body ? { "Content-Type": "application/json" } : undefined,
    });
  } catch (_) {
    throw new Error("No pude conectarme con el servicio. Revisa tu internet e intenta otra vez.");
  }
  let cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch (_) { /* respuesta sin cuerpo JSON */ }
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

/** Lee en voz alta una lista de textos. Si ya estaba sonando ese mismo botón, lo detiene. */
function leer(textos, boton) {
  if (!voz.disponible) return;
  const repetir = voz.boton === boton && speechSynthesis.speaking;
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
  inicio: () => [texto("titulo-inicio"), texto("intro-inicio")],
  pendiente: () => [texto("texto-pendiente"), "Puedes continuar donde ibas, o empezar de nuevo."],
  alias: () => ["¿Cómo te llamas? Escribe tu nombre y luego toca el botón Comenzar."],
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
    const leerQue = lecturas[boton.dataset.leer];
    boton.hidden = false;
    boton.addEventListener("click", () => leer(leerQue(), boton));
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

async function comenzar(evento) {
  evento.preventDefault();
  const alias = $("alias").value.trim();
  if (!alias) {
    aviso("Escribe tu nombre para empezar.");
    $("alias").focus();
    return;
  }
  const boton = $("comenzar");
  boton.disabled = true;
  try {
    const estado = await api("/api/evaluaciones", { method: "POST", body: JSON.stringify({ alias }) });
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

function reiniciar() {
  borrarId();
  $("pendiente").hidden = true;
  $("alias").value = "";
  mostrar("inicio", $("titulo-inicio"));
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
  $("formulario").addEventListener("submit", comenzar);
  $("continuar").addEventListener("click", continuarEvaluacion);
  $("descartar").addEventListener("click", reiniciar);
  $("reiniciar").addEventListener("click", reiniciar);
  if (leerId()) $("pendiente").hidden = false;
  prepararVoz();
  revisarServicio();
}

iniciar();
