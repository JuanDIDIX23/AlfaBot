"use strict";
// Módulo de aprendizaje: el camino de lecciones y los ejercicios.
// Usa lo que define app.js: $, api, aviso, mostrar, leer, callar, voz, lecturas, porcentaje.

const CLAVE_RUTA = "alfabot.ruta";

function guardarClave(clave) {
  try { localStorage.setItem(CLAVE_RUTA, clave); } catch (_) { /* sin almacenamiento */ }
}
function leerClave() {
  try { return localStorage.getItem(CLAVE_RUTA); } catch (_) { return null; }
}
function borrarClave() {
  try { localStorage.removeItem(CLAVE_RUTA); } catch (_) { /* sin almacenamiento */ }
}

const aprendizaje = {
  clave: null,
  ruta: null,
  // ronda en curso
  leccion: null,
  ejercicios: [],
  indice: 0,
  resultados: [],
  ultimoResumen: null,
};

/** Habla sin esperar a que el usuario toque 🔊 (después de un toque suyo, el navegador lo permite). */
function decir(textos, boton) {
  callar();
  leer(Array.isArray(textos) ? textos : [textos], boton || null);
}

// ---------------------------------------------------------------- lecturas de los botones 🔊 fijos

Object.assign(lecturas, {
  aprender: () => [texto("texto-aprender")],
  "ruta-guardada": () => [texto("texto-ruta-guardada"), "Toca Seguir aprendiendo para continuar."],
  camino: () => {
    const r = aprendizaje.ruta;
    if (!r) return [];
    const siguiente = r.lecciones.find((l) => l.estado === "disponible");
    return [
      texto("titulo-camino"),
      texto("avance-texto"),
      siguiente ? `Te toca la lección: ${siguiente.titulo}. Toca Practicar ahora.` : texto("camino-terminado"),
    ];
  },
  leccion: () => [texto("titulo-leccion"), texto("leccion-explicacion")],
  fin: () => [texto("titulo-fin"), texto("fin-aciertos"), texto("fin-mensaje"), $("fin-dificultades").hidden ? "" : texto("fin-dificultades")],
});

// ---------------------------------------------------------------- crear y abrir el camino

async function empezarAprender() {
  const boton = $("aprender");
  const id = boton.dataset.evaluacion;
  boton.disabled = true;
  try {
    const r = await api(`/api/evaluaciones/${encodeURIComponent(id)}/ruta`, { method: "POST" });
    guardarClave(r.clave);
    aprendizaje.clave = r.clave;
    pintarCamino(r.ruta);
  } catch (e) {
    // Esa evaluación ya tenía camino (por ejemplo, se recargó la página): se abre el guardado.
    if (e.estado === 409 && leerClave()) await abrirCamino();
    else aviso(e.message);
  } finally {
    boton.disabled = false;
  }
}

async function abrirCamino() {
  const clave = leerClave();
  if (!clave) return mostrar("inicio", $("titulo-inicio"));
  try {
    const ruta = await api(`/api/rutas/${encodeURIComponent(clave)}`);
    aprendizaje.clave = clave;
    pintarCamino(ruta);
  } catch (e) {
    if (e.estado === 404) {
      borrarClave();
      $("ruta-guardada").hidden = true;
    }
    mostrar("inicio", $("titulo-inicio"));
    aviso(e.message);
  }
}

const ICONO = { superada: "✓", disponible: "▶", bloqueada: "🔒" };

function motivoLeccion(l) {
  if (l.origen === "refuerzo" && l.regla) return `Para reforzar: ${l.regla.condicion.toLowerCase()} (regla ${l.regla.codigo}).`;
  if (l.origen === "diagnostico") return "Tu evaluación muestra que ya lo dominas. Puedes repasarla si quieres.";
  if (l.origen === "repaso") return "Repaso libre.";
  return "Siguiente paso del módulo.";
}

function pintarCamino(ruta) {
  aprendizaje.ruta = ruta;
  $("titulo-camino").textContent = `Tu camino, ${ruta.alias}`;
  $("avance-texto").textContent = `Llevas ${ruta.superadas} de ${ruta.total} lecciones superadas.`;
  $("avance-barra").style.width = `${ruta.total ? Math.max((ruta.superadas / ruta.total) * 100, 2) : 0}%`;

  const siguiente = ruta.lecciones.find((l) => l.estado === "disponible");
  $("siguiente-leccion").hidden = !siguiente;
  $("camino-terminado").hidden = Boolean(siguiente);
  if (siguiente) {
    $("siguiente-titulo").textContent = siguiente.titulo;
    $("siguiente-motivo").textContent = motivoLeccion(siguiente);
    $("practicar-siguiente").onclick = () => abrirLeccion(siguiente.id);
  }

  // Lecciones agrupadas por módulo
  const lista = $("lista-camino");
  lista.replaceChildren();
  let moduloActual = null;
  let ol = null;
  for (const l of ruta.lecciones) {
    if (l.modulo.codigo !== moduloActual) {
      moduloActual = l.modulo.codigo;
      const h = document.createElement("h2");
      h.textContent = `Módulo ${l.modulo.codigo} · ${l.modulo.nombre}`;
      ol = document.createElement("ol");
      ol.className = "lecciones";
      lista.append(h, ol);
    }
    const li = document.createElement("li");
    li.className = `leccion-item ${l.estado}`;

    const icono = document.createElement("span");
    icono.className = "icono";
    icono.setAttribute("aria-hidden", "true");
    icono.textContent = ICONO[l.estado];

    const cuerpo = document.createElement("div");
    cuerpo.className = "cuerpo";
    const titulo = document.createElement("p");
    titulo.className = "titulo";
    titulo.textContent = l.titulo;
    const detalle = document.createElement("p");
    detalle.className = "nota";
    const estadoTexto = { superada: "Superada", disponible: "Disponible", bloqueada: "Bloqueada" }[l.estado];
    detalle.textContent = `${estadoTexto}. ${motivoLeccion(l)}${l.precision !== null ? ` Aciertos: ${porcentaje(l.precision)}.` : ""}`;
    cuerpo.append(titulo, detalle);

    li.append(icono, cuerpo);
    if (l.estado !== "bloqueada") {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "boton chico" + (l.estado === "superada" ? " secundario" : "");
      b.textContent = l.estado === "superada" ? "Repasar" : "Practicar";
      b.setAttribute("aria-label", `${b.textContent}: ${l.titulo}`);
      b.addEventListener("click", () => abrirLeccion(l.id));
      li.appendChild(b);
    }
    ol.appendChild(li);
  }
  mostrar("camino", $("titulo-camino"));
}

// ---------------------------------------------------------------- lección y ronda

async function abrirLeccion(rutaLeccionId) {
  try {
    const r = await api(
      `/api/rutas/${encodeURIComponent(aprendizaje.clave)}/lecciones/${rutaLeccionId}/rondas`,
      { method: "POST" },
    );
    aprendizaje.leccion = r.leccion;
    aprendizaje.ejercicios = r.ejercicios;
    aprendizaje.indice = 0;
    aprendizaje.resultados = [];

    $("leccion-modulo").textContent = `Módulo ${r.leccion.modulo.codigo} · ${r.leccion.modulo.nombre}`;
    $("titulo-leccion").textContent = r.leccion.titulo;
    $("leccion-explicacion").textContent = r.leccion.explicacion;
    mostrar("leccion", $("titulo-leccion"));
    decir([r.leccion.titulo, r.leccion.explicacion]);
  } catch (e) {
    aviso(e.message);
  }
}

function empezarRonda() {
  aprendizaje.indice = 0;
  aprendizaje.resultados = [];
  mostrar("ejercicio");
  pintarEjercicio();
}

function ejercicioActual() {
  return aprendizaje.ejercicios[aprendizaje.indice];
}

function textoParaVoz(e) {
  const partes = [e.decir];
  if (e.tipo === "elegir" && e.leerOpciones) {
    e.opciones.forEach((o, i) => partes.push(`Opción ${i + 1}: ${o.decir || o.texto}.`));
  }
  return partes;
}

function pintarEjercicio() {
  const e = ejercicioActual();
  const total = aprendizaje.ejercicios.length;
  $("ej-contador").textContent = `Ejercicio ${aprendizaje.indice + 1} de ${total}`;
  $("ej-progreso").style.width = `${(aprendizaje.indice / total) * 100}%`;
  $("ej-consigna").textContent = e.consigna;
  $("ej-correccion").hidden = true;

  // Lo que se muestra en grande
  const caja = $("ej-mostrar");
  caja.replaceChildren();
  caja.className = "mostrar";
  if (e.mostrar) {
    if (e.mostrar.emoji) {
      const em = document.createElement("span");
      em.className = "emoji";
      em.setAttribute("aria-hidden", "true");
      em.textContent = e.mostrar.emoji;
      caja.appendChild(em);
    }
    if (e.mostrar.texto) {
      const t = document.createElement("p");
      t.className = `muestra ${e.mostrar.estilo || "palabra"}`;
      t.textContent = e.mostrar.texto;
      caja.appendChild(t);
    }
  }
  caja.hidden = !e.mostrar;

  const zona = $("ej-zona");
  zona.replaceChildren();
  if (e.tipo === "elegir") pintarElegir(e, zona);
  else if (e.tipo === "ordenar") pintarOrdenar(e, zona);
  else pintarEscribir(e, zona);

  const escuchar = $("ej-escuchar");
  escuchar.hidden = !voz.disponible;
  escuchar.onclick = () => leer(textoParaVoz(e), escuchar);
  $("ej-consigna").focus();
  decir(textoParaVoz(e), escuchar);
}

// --- elegir

function pintarElegir(e, zona) {
  const grilla = document.createElement("div");
  const soloCortas = e.opciones.every((o) => o.emoji || (o.texto && o.texto.length <= 4));
  grilla.className = "alternativas" + (soloCortas ? " cortas" : "");
  for (const o of e.opciones) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "alternativa" + (o.emoji ? " con-emoji" : "") + (o.texto && o.texto.length <= 4 ? " letra" : "");
    b.dataset.id = o.id;
    b.textContent = o.emoji || o.texto;
    if (o.emoji) b.setAttribute("aria-label", o.decir || o.id);
    b.addEventListener("click", () => {
      grilla.querySelectorAll("button").forEach((x) => {
        x.disabled = true;
        if (x.dataset.id === e.correcta) x.classList.add("bien");
      });
      const correcto = o.id === e.correcta;
      if (!correcto) b.classList.add("mal");
      corregir(e, correcto);
    });
    grilla.appendChild(b);
  }
  zona.appendChild(grilla);
}

// --- ordenar

function pintarOrdenar(e, zona) {
  const armado = document.createElement("div");
  armado.className = "armado";
  armado.setAttribute("aria-label", "Tu respuesta");
  const piezas = document.createElement("div");
  piezas.className = "piezas";
  const comprobar = document.createElement("button");
  comprobar.type = "button";
  comprobar.className = "boton";
  comprobar.textContent = "Comprobar";
  comprobar.disabled = true;

  const elegidas = []; // botones de piezas usadas, en orden
  const actualizar = () => {
    armado.replaceChildren();
    if (elegidas.length === 0) {
      const v = document.createElement("span");
      v.className = "vacio";
      v.textContent = "Toca las piezas en orden";
      armado.appendChild(v);
    }
    elegidas.forEach((boton, i) => {
      const quitar = document.createElement("button");
      quitar.type = "button";
      quitar.className = "pieza puesta";
      quitar.textContent = boton.textContent;
      quitar.setAttribute("aria-label", `Quitar ${boton.textContent}`);
      quitar.addEventListener("click", () => {
        elegidas.splice(i, 1);
        boton.hidden = false;
        actualizar();
      });
      armado.appendChild(quitar);
    });
    comprobar.disabled = elegidas.length !== e.solucion.length;
  };

  e.piezas.forEach((texto) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "pieza";
    b.textContent = texto;
    b.addEventListener("click", () => {
      if (elegidas.length >= e.solucion.length) return;
      elegidas.push(b);
      b.hidden = true;
      decir(texto);
      actualizar();
    });
    piezas.appendChild(b);
  });

  comprobar.addEventListener("click", () => {
    const respuesta = elegidas.map((b) => b.textContent);
    const correcto = respuesta.join("|") === e.solucion.join("|");
    zona.querySelectorAll("button").forEach((x) => (x.disabled = true));
    armado.classList.add(correcto ? "bien" : "mal");
    corregir(e, correcto);
  });

  actualizar();
  zona.append(armado, piezas, comprobar);
}

// --- escribir

const sinTildes = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const limpiar = (s) => s.trim().toLowerCase().replace(/\s+/g, " ");

function pintarEscribir(e, zona) {
  const form = document.createElement("form");
  form.className = "escribir";
  form.noValidate = true;
  const etiqueta = document.createElement("label");
  etiqueta.htmlFor = "ej-respuesta";
  etiqueta.textContent = "Escribe aquí:";
  const input = document.createElement("input");
  input.id = "ej-respuesta";
  input.type = "text";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("autocorrect", "off");
  input.maxLength = 40;
  const comprobar = document.createElement("button");
  comprobar.type = "submit";
  comprobar.className = "boton";
  comprobar.textContent = "Comprobar";
  form.append(etiqueta, input, comprobar);

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    const escrito = limpiar(input.value);
    if (!escrito) {
      input.focus();
      return;
    }
    const solucion = limpiar(e.solucion);
    const exacto = escrito === solucion;
    const casi = !exacto && sinTildes(escrito) === sinTildes(solucion);
    input.disabled = true;
    comprobar.disabled = true;
    input.classList.add(exacto || casi ? "bien" : "mal");
    // Olvidar una tilde cuenta como acierto, pero se avisa cómo se escribe.
    corregir(e, exacto || casi, casi ? `Muy bien. Ojo con la tilde: se escribe ${e.solucion}.` : null);
  });
  zona.appendChild(form);
}

// --- corrección

const FELICITACIONES = ["¡Muy bien!", "¡Excelente!", "¡Correcto!", "¡Así se hace!", "¡Bien hecho!"];

function corregir(e, correcto, mensajeEspecial) {
  aprendizaje.resultados.push({ objetivo: e.objetivo, correcto });
  const mensaje = mensajeEspecial
    || (correcto ? FELICITACIONES[Math.floor(Math.random() * FELICITACIONES.length)] : `Casi. ${e.respuesta}`);
  const caja = $("ej-correccion");
  caja.className = "correccion " + (correcto ? "bien" : "mal");
  $("ej-mensaje").textContent = mensaje;
  caja.hidden = false;
  const ultimo = aprendizaje.indice === aprendizaje.ejercicios.length - 1;
  $("ej-siguiente").textContent = ultimo ? "Ver cómo me fue" : "Siguiente";
  $("ej-siguiente").focus();
  decir(mensaje);
}

async function siguienteEjercicio() {
  if (aprendizaje.indice < aprendizaje.ejercicios.length - 1) {
    aprendizaje.indice += 1;
    pintarEjercicio();
    return;
  }
  const boton = $("ej-siguiente");
  boton.disabled = true;
  try {
    const r = await api(
      `/api/rutas/${encodeURIComponent(aprendizaje.clave)}/lecciones/${aprendizaje.leccion.id}/resultados`,
      { method: "POST", body: JSON.stringify({ resultados: aprendizaje.resultados }) },
    );
    aprendizaje.ruta = r.ruta;
    pintarFinRonda(r);
  } catch (e) {
    aviso(e.message);
  } finally {
    boton.disabled = false;
  }
}

function pintarFinRonda(r) {
  aprendizaje.ultimoResumen = r;
  $("titulo-fin").textContent = r.rutaTerminada
    ? "¡Terminaste todo tu camino!"
    : r.superada ? "¡Lección superada!" : "¡Sigue practicando!";
  $("fin-aciertos").textContent = `Acertaste ${r.aciertos} de ${r.total}.`;
  $("fin-mensaje").textContent = r.superada
    ? (r.siguiente ? `Se abrió una lección nueva: ${r.siguiente.titulo}.` : "Lo hiciste muy bien.")
    : "Te faltó poco. Para pasar necesitas 8 de 10. Cada vez que practicas, AlfaBot repite más lo que te cuesta.";

  const dif = $("fin-dificultades");
  dif.hidden = r.dificultades.length === 0;
  const lista = r.dificultades.join(", ");
  dif.textContent = !lista ? "" : r.superada ? `Te costó un poco: ${lista}. Saldrá más seguido cuando repases.` : `Vamos a repasar: ${lista}.`;

  const principal = $("fin-principal");
  if (r.superada && r.siguiente) {
    principal.textContent = "Ir a la lección nueva";
    principal.onclick = () => abrirLeccion(r.siguiente.id);
  } else {
    principal.textContent = "Practicar otra vez";
    principal.onclick = () => abrirLeccion(aprendizaje.leccion.id);
  }
  mostrar("fin-ronda", $("titulo-fin"));
  decir(lecturas.fin());
}

// ---------------------------------------------------------------- arranque

function iniciarAprendizaje() {
  $("aprender").addEventListener("click", empezarAprender);
  $("seguir-aprendiendo").addEventListener("click", abrirCamino);
  $("empezar-ronda").addEventListener("click", empezarRonda);
  $("ej-siguiente").addEventListener("click", siguienteEjercicio);
  $("nueva-evaluacion").addEventListener("click", reiniciar);
  document.querySelectorAll(".volver-camino").forEach((b) => b.addEventListener("click", () => {
    if (aprendizaje.ruta) pintarCamino(aprendizaje.ruta);
    else abrirCamino();
  }));
  if (leerClave()) $("ruta-guardada").hidden = false;
}

iniciarAprendizaje();
