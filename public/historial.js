"use strict";
// Historial del usuario: sus evaluaciones anteriores, el nivel de cada una y su avance por módulo.
// Usa lo que definen app.js y aprendizaje.js: $, api, aviso, mostrar, lecturas, porcentaje,
// leerUsuario, olvidarUsuario, guardarId, borrarId, pintar, reiniciar, guardarClave, borrarClave, abrirCamino.

const ESTADO_MODULO = { superado: "Superado", en_curso: "En curso", pendiente: "Pendiente" };
const formatoFecha = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit" });

let ultimoHistorial = null;

Object.assign(lecturas, {
  "usuario-conocido": () => [texto("texto-usuario-conocido"), "Puedes ver tus evaluaciones o empezar una nueva."],
  historial: () => {
    const h = ultimoHistorial;
    if (!h) return [];
    const partes = [`Historial de ${h.alias}.`];
    for (const p of h.progreso) partes.push(`Módulo ${p.modulo}, ${p.nombre}: ${ESTADO_MODULO[p.estado].toLowerCase()}.`);
    partes.push(h.evaluaciones.length === 1 ? "Tienes una evaluación." : `Tienes ${h.evaluaciones.length} evaluaciones.`);
    const ultima = h.evaluaciones.find((e) => e.estado === "completada" && e.nivel);
    if (ultima) partes.push(`En la última evaluación terminada tu nivel fue ${ultima.nivel.nombre}.`);
    return partes;
  },
});

async function abrirHistorial() {
  const usuario = leerUsuario();
  if (!usuario) {
    aviso("Primero haz una evaluación para tener historial.");
    return;
  }
  try {
    const h = await api(`/api/usuarios/${encodeURIComponent(usuario.clave)}/historial`);
    pintarHistorial(h);
  } catch (e) {
    if (e.estado === 404) {
      olvidarUsuario();
      pintarUsuarioConocido();
    }
    aviso(e.message);
  }
}

function pintarHistorial(h) {
  ultimoHistorial = h;
  $("titulo-historial").textContent = `Mis evaluaciones, ${h.alias}`;

  const modulos = $("historial-modulos");
  modulos.replaceChildren();
  for (const p of h.progreso) {
    const li = document.createElement("li");
    li.className = `modulo-estado ${p.estado}`;
    const nombre = document.createElement("span");
    nombre.textContent = `${p.modulo} · ${p.nombre}`;
    const estado = document.createElement("span");
    estado.className = "estado-chip";
    estado.textContent = ESTADO_MODULO[p.estado];
    li.append(nombre, estado);
    modulos.appendChild(li);
  }

  const lista = $("historial-lista");
  lista.replaceChildren();
  $("historial-vacio").hidden = h.evaluaciones.length > 0;
  for (const e of h.evaluaciones) {
    const li = document.createElement("li");
    li.className = "evaluacion-item";

    const fecha = document.createElement("p");
    fecha.className = "nota";
    fecha.textContent = formatoFecha.format(new Date(e.fechaInicio));

    const nivel = document.createElement("p");
    nivel.className = "titulo";
    if (e.estado === "completada" && e.nivel) {
      nivel.textContent = `${e.nivel.codigo} · ${e.nivel.nombre} (${porcentaje(e.nivel.probabilidad)})`;
    } else if (e.nivel) {
      nivel.textContent = `Sin terminar. Por ahora va en ${e.nivel.codigo} · ${e.nivel.nombre}`;
    } else {
      nivel.textContent = "Sin terminar. Todavía no hay respuestas";
    }

    const detalle = document.createElement("p");
    detalle.className = "nota";
    const preguntas = e.preguntasRespondidas === 1 ? "1 pregunta" : `${e.preguntasRespondidas} preguntas`;
    detalle.textContent = e.ruta
      ? `${preguntas}. Camino de aprendizaje: ${e.ruta.superadas} de ${e.ruta.total} lecciones superadas.`
      : `${preguntas}.`;

    const acciones = document.createElement("div");
    acciones.className = "acciones-fila";
    if (e.estado === "en_curso") {
      acciones.appendChild(botonHistorial("Continuar", () => continuarDesdeHistorial(e.evaluacionId)));
    } else {
      acciones.appendChild(botonHistorial("Ver resultado", () => verResultado(e.evaluacionId), true));
    }
    if (e.ruta) acciones.appendChild(botonHistorial("Abrir mi camino", () => abrirCaminoDe(e.ruta.clave)));

    li.append(fecha, nivel, detalle, acciones);
    lista.appendChild(li);
  }
  mostrar("historial", $("titulo-historial"));
}

function botonHistorial(textoBoton, accion, secundario) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "boton chico" + (secundario ? " secundario" : "");
  b.textContent = textoBoton;
  b.addEventListener("click", accion);
  return b;
}

async function verResultado(evaluacionId) {
  try {
    pintar(await api(`/api/evaluaciones/${evaluacionId}`), null);
  } catch (e) {
    aviso(e.message);
  }
}

async function continuarDesdeHistorial(evaluacionId) {
  guardarId(evaluacionId);
  await verResultado(evaluacionId); // si sigue en curso, pinta la pregunta pendiente
}

async function abrirCaminoDe(clave) {
  guardarClave(clave);
  $("ruta-guardada").hidden = false;
  await abrirCamino();
}

function empezarComoOtraPersona() {
  olvidarUsuario();
  borrarId();
  borrarClave();
  $("ruta-guardada").hidden = true;
  reiniciar();
  $("alias").focus();
}

function iniciarHistorial() {
  document.querySelectorAll(".ver-historial").forEach((b) => b.addEventListener("click", abrirHistorial));
  $("otra-persona").addEventListener("click", empezarComoOtraPersona);
  $("historial-nueva").addEventListener("click", () => {
    reiniciar();
    $("alias").focus();
  });
  $("historial-volver").addEventListener("click", reiniciar);
}

iniciarHistorial();
