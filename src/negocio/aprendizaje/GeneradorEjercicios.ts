import { Ejercicio, Leccion, ParametrosLeccion, ResultadoEjercicio } from "./Modelos";
import {
  COMPRENSION, CONCORDANCIA, INFERENCIAS, NOMBRE_LETRA, ORACIONES, PALABRAS, Palabra, VOCALES,
} from "./Vocabulario";

/** Fuente de azar inyectable: en producción Math.random, en las pruebas una semilla fija. */
export type Azar = () => number;

/** Generador con semilla (mulberry32): mismo número, misma secuencia. */
export function azarConSemilla(semilla: number): Azar {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const quitarTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

function barajar<T>(lista: T[], azar: Azar): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

const unoDe = <T>(lista: T[], azar: Azar): T => lista[Math.floor(azar() * lista.length)];

/** Elige `n` elementos distintos de `lista` que no estén en `excluir`. */
function tomar<T>(lista: T[], n: number, azar: Azar, excluir: T[] = []): T[] {
  return barajar(lista.filter((x) => !excluir.includes(x)), azar).slice(0, Math.max(0, n));
}

/** Letra con la que empieza una palabra, sin tilde y tratando "ll" y "ch" como letras propias. */
function letraInicial(palabra: string): string {
  const s = quitarTildes(palabra.toLowerCase());
  if (s.startsWith("ll") || s.startsWith("ch")) return s.slice(0, 2);
  return s[0];
}

const silabasDe = (x: Palabra) => x.silabas.length;

// ---------------------------------------------------------------- sílabas

const FINALES_MIXTA = ["n", "l", "s", "r"];

/** Todas las sílabas que practica una lección de sílabas. */
export function silabasDeLeccion(par: ParametrosLeccion): string[] {
  switch (par.patron) {
    case "directa":
      return (par.consonantes ?? ["m", "p", "s", "l", "t"]).flatMap((c) => VOCALES.map((v) => c + v));
    case "inversa":
      return VOCALES.flatMap((v) => FINALES_MIXTA.map((f) => v + f));
    case "mixta":
      return (par.consonantes ?? ["p", "s", "m", "l", "t"]).flatMap((c) =>
        VOCALES.flatMap((v) => FINALES_MIXTA.map((f) => c + v + f)),
      );
    case "trabada": {
      const grupos = par.pares ? par.pares.flat() : (par.grupos ?? ["pr", "tr"]);
      return grupos.flatMap((g) => VOCALES.map((v) => g + v));
    }
    default:
      throw new Error(`Patrón de sílaba desconocido: ${String(par.patron)}`);
  }
}

/** Distractores parecidos a una sílaba: comparten consonante o vocal, o es la pareja que se confunde. */
function distractoresSilaba(objetivo: string, todas: string[], n: number, par: ParametrosLeccion, azar: Azar): string[] {
  const elegidos: string[] = [];
  if (par.pares) {
    for (const [x, y] of par.pares) {
      const g = objetivo.startsWith(x) ? x : objetivo.startsWith(y) ? y : null;
      if (g) elegidos.push((g === x ? y : x) + objetivo.slice(g.length));
    }
  }
  const vocal = objetivo.match(/[aeiou]/)?.[0];
  const parecidas = todas.filter((s) => s !== objetivo && !elegidos.includes(s) && (s[0] === objetivo[0] || s.match(/[aeiou]/)?.[0] === vocal));
  elegidos.push(...tomar(parecidas, n - elegidos.length, azar));
  if (elegidos.length < n) elegidos.push(...tomar(todas, n - elegidos.length, azar, [objetivo, ...elegidos]));
  return elegidos.slice(0, n);
}

// ---------------------------------------------------------------- generadores por tipo de lección

interface GeneradorTipo {
  /** Todo lo que la lección puede practicar. */
  objetivos(par: ParametrosLeccion): string[];
  /** Arma un ejercicio para un objetivo. `opciones` es cuántas alternativas mostrar (sube con el dominio). */
  crear(objetivo: string, par: ParametrosLeccion, opciones: number, azar: Azar): Ejercicio;
}

const elegirLetras = (correcta: string, otras: string[], azar: Azar) =>
  barajar([correcta, ...otras], azar).map((l) => ({ id: l, texto: l, decir: `la ${NOMBRE_LETRA[l] ?? l}` }));

function palabrasQueEmpiezanCon(letra: string): Palabra[] {
  return PALABRAS.filter((x) => letraInicial(x.texto) === letra);
}

function poolLetras(par: ParametrosLeccion): string[] {
  return [...new Set([...(par.letras ?? []), ...(par.distractores ?? [])])];
}

/** Completa con otras letras si la lección tiene menos letras que opciones. */
function otrasLetras(objetivo: string, par: ParametrosLeccion, n: number, azar: Azar): string[] {
  const propias = tomar(poolLetras(par), n, azar, [objetivo]);
  if (propias.length >= n) return propias;
  const resto = Object.keys(NOMBRE_LETRA).filter((l) => !["k", "w", "x", "y", "ñ"].includes(l));
  return [...propias, ...tomar(resto, n - propias.length, azar, [objetivo, ...propias])];
}

const GENERADORES: Record<string, GeneradorTipo> = {
  letra_escuchar: {
    objetivos: (par) => par.letras ?? VOCALES,
    crear(letra, par, n, azar) {
      return {
        tipo: "elegir",
        objetivo: letra,
        consigna: "Toca la letra que escuchas.",
        decir: `Toca la letra ${NOMBRE_LETRA[letra] ?? letra}.`,
        opciones: elegirLetras(letra, otrasLetras(letra, par, n - 1, azar), azar),
        correcta: letra,
        respuesta: VOCALES.includes(letra) ? `Era la ${letra}.` : `Era la letra ${letra}, que se llama ${NOMBRE_LETRA[letra] ?? letra}.`,
      };
    },
  },

  letra_inicial: {
    objetivos: (par) => (par.letras ?? VOCALES).filter((l) => palabrasQueEmpiezanCon(l).length > 0),
    crear(letra, par, n, azar) {
      const palabra = unoDe(palabrasQueEmpiezanCon(letra), azar);
      return {
        tipo: "elegir",
        objetivo: letra,
        consigna: "¿Con qué letra empieza?",
        decir: `${palabra.texto}. ¿Con qué letra empieza ${palabra.texto}?`,
        mostrar: { emoji: palabra.emoji },
        opciones: elegirLetras(letra, otrasLetras(letra, par, n - 1, azar), azar),
        correcta: letra,
        respuesta: `${capitalizar(palabra.texto)} empieza con ${letra}.`,
      };
    },
  },

  mayuscula: {
    objetivos: (par) => par.letras ?? VOCALES,
    crear(letra, par, n, azar) {
      return {
        tipo: "elegir",
        objetivo: letra,
        consigna: "Toca la letra pequeña que va con la letra grande.",
        decir: `Esta es la ${NOMBRE_LETRA[letra] ?? letra} grande. Toca la ${NOMBRE_LETRA[letra] ?? letra} pequeña.`,
        mostrar: { texto: letra.toUpperCase(), estilo: "letra" },
        opciones: elegirLetras(letra, otrasLetras(letra, par, n - 1, azar), azar),
        correcta: letra,
        respuesta: `La ${letra.toUpperCase()} grande es la ${letra} pequeña.`,
      };
    },
  },

  silaba_escuchar: {
    objetivos: (par) => silabasDeLeccion(par),
    crear(silaba, par, n, azar) {
      const otras = distractoresSilaba(silaba, silabasDeLeccion(par), n - 1, par, azar);
      return {
        tipo: "elegir",
        objetivo: silaba,
        consigna: "Toca la sílaba que escuchas.",
        decir: `Toca: ${silaba}.`,
        opciones: barajar([silaba, ...otras], azar).map((s) => ({ id: s, texto: s, decir: s })),
        correcta: silaba,
        respuesta: `Era ${silaba}.`,
      };
    },
  },

  palabra_imagen: {
    objetivos: (par) => palabrasEnRango(par).map((x) => x.texto),
    crear(texto, par, n, azar) {
      const palabra = buscarPalabra(texto);
      const otras = tomar(PALABRAS.filter((x) => x.emoji !== palabra.emoji), n - 1, azar);
      return {
        tipo: "elegir",
        objetivo: texto,
        consigna: "Lee la palabra y toca su dibujo.",
        decir: "Lee la palabra y toca su dibujo.",
        mostrar: { texto: palabra.texto, estilo: "palabra" },
        opciones: barajar([palabra, ...otras], azar).map((x) => ({ id: x.texto, emoji: x.emoji, decir: x.texto })),
        correcta: palabra.texto,
        respuesta: `Dice ${palabra.texto}: ${palabra.silabas.join(" - ")}.`,
      };
    },
  },

  ordenar_silabas: {
    objetivos: (par) => palabrasEnRango({ ...par, silabasMin: Math.max(2, par.silabasMin ?? 2) }).map((x) => x.texto),
    crear(texto, _par, n, azar) {
      const palabra = buscarPalabra(texto);
      // Con más dominio se agrega una sílaba que sobra, para que no baste con tocar todo.
      const sobra = n >= 4 ? tomar(PALABRAS.flatMap((x) => x.silabas), 1, azar, palabra.silabas) : [];
      return {
        tipo: "ordenar",
        objetivo: texto,
        consigna: "Toca las sílabas en orden para armar la palabra.",
        decir: `Arma la palabra ${palabra.texto}.`,
        mostrar: { emoji: palabra.emoji },
        piezas: desordenar([...palabra.silabas, ...sobra], palabra.silabas, azar),
        solucion: palabra.silabas,
        unir: "",
        respuesta: `${capitalizar(palabra.texto)}: ${palabra.silabas.join(" - ")}.`,
      };
    },
  },

  oracion_imagen: {
    objetivos: () => ORACIONES.map((o) => o.texto),
    crear(texto, _par, n, azar) {
      const oracion = ORACIONES.find((o) => o.texto === texto)!;
      const otras = tomar(ORACIONES.filter((o) => o !== oracion), n - 1, azar);
      return {
        tipo: "elegir",
        objetivo: texto,
        consigna: "Lee la oración y toca el dibujo que la muestra.",
        decir: "Lee la oración y toca el dibujo que la muestra.",
        mostrar: { texto: oracion.texto, estilo: "palabra" },
        opciones: barajar([oracion, ...otras], azar).map((o) => ({ id: o.texto, emoji: o.emoji, decir: o.texto })),
        correcta: oracion.texto,
        respuesta: `La oración dice: ${oracion.texto}`,
      };
    },
  },

  ordenar_palabras: {
    objetivos: () => ORACIONES.map((o) => o.texto),
    crear(texto, _par, _n, azar) {
      const oracion = ORACIONES.find((o) => o.texto === texto)!;
      const palabras = oracion.texto.replace(/\.$/, "").split(" ");
      return {
        tipo: "ordenar",
        objetivo: texto,
        consigna: "Toca las palabras en orden para armar la oración.",
        decir: oracion.texto,
        mostrar: { emoji: oracion.emoji },
        piezas: desordenar(palabras, palabras, azar),
        solucion: palabras,
        unir: " ",
        respuesta: oracion.texto,
      };
    },
  },

  comprension: {
    objetivos: () => ["quien", "donde", "que", "cuando", "con_quien"],
    crear(tipoPregunta, _par, n, azar) {
      const persona = unoDe(COMPRENSION.personas, azar);
      const sitio = unoDe(COMPRENSION.lugares, azar);
      const cosa = unoDe(sitio.cosas, azar);
      const momento = unoDe(COMPRENSION.momentos, azar);
      const con = unoDe(COMPRENSION.acompanantes, azar);
      const texto = `${persona} fue a ${sitio.lugar} ${momento} con ${con}. Allí compró ${cosa}. Después volvió a su casa.`;

      const preguntas: Record<string, { pregunta: string; correcta: string; todas: string[] }> = {
        quien: { pregunta: `¿Quién fue a ${sitio.lugar}?`, correcta: persona, todas: COMPRENSION.personas },
        donde: { pregunta: `¿A dónde fue ${persona}?`, correcta: `A ${sitio.lugar}`, todas: COMPRENSION.lugares.map((l) => `A ${l.lugar}`) },
        que: { pregunta: `¿Qué compró ${persona}?`, correcta: capitalizar(cosa), todas: COMPRENSION.lugares.flatMap((l) => l.cosas).map(capitalizar) },
        cuando: { pregunta: `¿Cuándo fue ${persona}?`, correcta: capitalizar(momento), todas: COMPRENSION.momentos.map(capitalizar) },
        con_quien: { pregunta: `¿Con quién fue ${persona}?`, correcta: `Con ${con}`, todas: COMPRENSION.acompanantes.map((a) => `Con ${a}`) },
      };
      const q = preguntas[tipoPregunta];
      return {
        tipo: "elegir",
        objetivo: tipoPregunta,
        consigna: q.pregunta,
        decir: `${texto} ${q.pregunta}`,
        mostrar: { texto, estilo: "texto" },
        opciones: opcionesTexto(q.correcta, tomar(q.todas, n - 1, azar, [q.correcta]), azar),
        leerOpciones: true,
        correcta: q.correcta,
        respuesta: `${q.correcta}. Está escrito en el texto.`,
      };
    },
  },

  inferencia: {
    objetivos: () => INFERENCIAS.map((i) => i.id),
    crear(id, _par, n, azar) {
      const inf = INFERENCIAS.find((i) => i.id === id)!;
      const nombre = unoDe(COMPRENSION.personas, azar);
      const poner = (s: string) => s.replace(/\{n\}/g, nombre);
      const texto = poner(inf.texto);
      const pregunta = poner(inf.pregunta);
      return {
        tipo: "elegir",
        objetivo: id,
        consigna: pregunta,
        decir: `${texto} ${pregunta}`,
        mostrar: { texto, estilo: "texto" },
        opciones: opcionesTexto(inf.correcta, inf.otras.slice(0, Math.max(1, n - 1)), azar),
        leerOpciones: true,
        correcta: inf.correcta,
        respuesta: `${inf.correcta}. El texto no lo dice, pero las pistas lo muestran.`,
      };
    },
  },

  copiar: {
    objetivos: (par) => palabrasEnRango(par).map((x) => x.texto),
    crear(texto) {
      const palabra = buscarPalabra(texto);
      return {
        tipo: "escribir",
        objetivo: texto,
        consigna: "Escribe la palabra igual que aquí.",
        decir: `Escribe la palabra ${palabra.texto}.`,
        mostrar: { texto: palabra.texto, emoji: palabra.emoji, estilo: "palabra" },
        solucion: palabra.texto,
        respuesta: `Se escribe ${palabra.texto}.`,
      };
    },
  },

  dictado: {
    objetivos: (par) => palabrasEnRango(par).map((x) => x.texto),
    crear(texto) {
      const palabra = buscarPalabra(texto);
      return {
        tipo: "escribir",
        objetivo: texto,
        consigna: "Escucha la palabra y escríbela.",
        decir: `Escribe: ${palabra.texto}.`,
        mostrar: { emoji: palabra.emoji },
        solucion: palabra.texto,
        respuesta: `Se escribe ${palabra.texto}: ${palabra.silabas.join(" - ")}.`,
      };
    },
  },

  concordancia: {
    objetivos: () => ["singular", "plural"],
    crear(numero, _par, _n, azar) {
      const sujeto = unoDe(CONCORDANCIA.sujetos.filter((s) => s.plural === (numero === "plural")), azar);
      const verbo = unoDe(CONCORDANCIA.verbos, azar);
      const correcta = sujeto.plural ? verbo.plural : verbo.singular;
      return {
        tipo: "elegir",
        objetivo: numero,
        consigna: "Elige la palabra que completa la oración.",
        decir: `Completa la oración: ${sujeto.texto}... ${verbo.resto}`,
        mostrar: { texto: `${sujeto.texto} ____ ${verbo.resto}`, estilo: "palabra" },
        opciones: opcionesTexto(correcta, [sujeto.plural ? verbo.singular : verbo.plural], azar),
        leerOpciones: true,
        correcta,
        respuesta: `${sujeto.texto} ${correcta} ${verbo.resto} ${sujeto.plural ? "Son varios" : "Es uno solo"}, por eso va "${correcta}".`,
      };
    },
  },
};

function opcionesTexto(correcta: string, otras: string[], azar: Azar) {
  return barajar([correcta, ...otras], azar).map((t) => ({ id: t, texto: t, decir: t }));
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function palabrasEnRango(par: ParametrosLeccion): Palabra[] {
  const min = par.silabasMin ?? 1;
  const max = par.silabasMax ?? 9;
  return PALABRAS.filter((x) => silabasDe(x) >= min && silabasDe(x) <= max);
}

function buscarPalabra(texto: string): Palabra {
  const palabra = PALABRAS.find((x) => x.texto === texto);
  if (!palabra) throw new Error(`La palabra ${texto} no está en el banco`);
  return palabra;
}

/** Baraja las piezas cuidando que no queden ya en el orden correcto. */
function desordenar(piezas: string[], solucion: string[], azar: Azar): string[] {
  let r = barajar(piezas, azar);
  for (let i = 0; i < 10 && r.slice(0, solucion.length).join("|") === solucion.join("|"); i++) r = barajar(piezas, azar);
  return r;
}

// ---------------------------------------------------------------- la ronda

export const EJERCICIOS_POR_RONDA = 10;
/** Proporción de aciertos para dar por superada una lección (8 de 10). */
export const UMBRAL_SUPERACION = 0.8;
/** Cuántos intentos recientes mira el generador para adaptar la ronda. */
export const HISTORIAL_ADAPTATIVO = 40;

export class GeneradorEjercicios {
  constructor(private readonly azar: Azar = Math.random) {}

  tiposSoportados(): string[] {
    return Object.keys(GENERADORES);
  }

  /** Todo lo que puede practicar una lección (sirve para validar los resultados que llegan). */
  objetivos(leccion: Leccion): string[] {
    return this.generador(leccion).objetivos(leccion.parametros);
  }

  /**
   * Arma una ronda nueva. Es adaptativa:
   *  - lo que la persona falló hace poco sale más seguido (peso 1 + 3 x fallos recientes);
   *  - con buen desempeño reciente (80 % o más) se muestran 4 opciones en lugar de 3.
   * El historial va del más reciente al más antiguo.
   */
  generarRonda(leccion: Leccion, historial: ResultadoEjercicio[], cantidad = EJERCICIOS_POR_RONDA): Ejercicio[] {
    const gen = this.generador(leccion);
    const objetivos = gen.objetivos(leccion.parametros);
    if (objetivos.length === 0) throw new Error(`La lección ${leccion.codigo} no tiene nada que practicar`);

    const reciente = historial.slice(0, HISTORIAL_ADAPTATIVO);
    const fallos = new Map<string, number>();
    for (const r of reciente) if (!r.correcto) fallos.set(r.objetivo, (fallos.get(r.objetivo) ?? 0) + 1);
    const precision = reciente.length >= 5 ? reciente.filter((r) => r.correcto).length / reciente.length : 0;
    const opciones = precision >= UMBRAL_SUPERACION ? 4 : 3;

    const ronda: Ejercicio[] = [];
    let anterior = "";
    for (let i = 0; i < cantidad; i++) {
      // Se evita repetir el mismo objetivo dos veces seguidas, salvo que no haya otro.
      const candidatos = objetivos.length > 1 ? objetivos.filter((o) => o !== anterior) : objetivos;
      const objetivo = this.sortearConPeso(candidatos, (o) => 1 + 3 * (fallos.get(o) ?? 0));
      ronda.push(gen.crear(objetivo, leccion.parametros, opciones, this.azar));
      anterior = objetivo;
    }
    return ronda;
  }

  private generador(leccion: Leccion): GeneradorTipo {
    const gen = GENERADORES[leccion.tipoEjercicio];
    if (!gen) throw new Error(`No hay generador para el tipo de ejercicio ${leccion.tipoEjercicio}`);
    return gen;
  }

  private sortearConPeso(lista: string[], peso: (x: string) => number): string {
    const total = lista.reduce((s, x) => s + peso(x), 0);
    let r = this.azar() * total;
    for (const x of lista) {
      r -= peso(x);
      if (r < 0) return x;
    }
    return lista[lista.length - 1];
  }
}
