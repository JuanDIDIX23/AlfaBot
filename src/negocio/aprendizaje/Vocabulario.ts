/**
 * Banco de contenido con el que los generadores arman los ejercicios: palabras cotidianas que se
 * pueden dibujar con un emoji, oraciones, textos cortos y plantillas. Ningún ejercicio está
 * escrito de antemano: se combinan estas piezas al azar en cada ronda.
 */

export interface Palabra {
  texto: string;
  silabas: string[];
  emoji: string;
}

const p = (separada: string, emoji: string): Palabra => {
  const silabas = separada.split("-");
  return { texto: silabas.join(""), silabas, emoji };
};

export const PALABRAS: Palabra[] = [
  p("ca-sa", "🏠"), p("ga-to", "🐱"), p("pe-rro", "🐶"), p("si-lla", "🪑"), p("sol", "☀️"),
  p("lu-na", "🌙"), p("pa-to", "🦆"), p("va-ca", "🐄"), p("ma-no", "✋"), p("pe-lo-ta", "⚽"),
  p("de-do", "☝️"), p("bo-ca", "👄"), p("da-do", "🎲"), p("o-jo", "👁️"), p("o-so", "🐻"),
  p("u-va", "🍇"), p("ár-bol", "🌳"), p("is-la", "🏝️"), p("e-le-fan-te", "🐘"), p("pan", "🍞"),
  p("pez", "🐟"), p("ma-pa", "🗺️"), p("li-bro", "📖"), p("le-che", "🥛"), p("ta-za", "☕"),
  p("to-ma-te", "🍅"), p("pa-pa", "🥔"), p("pe-ra", "🍐"), p("man-za-na", "🍎"), p("plá-ta-no", "🍌"),
  p("za-pa-to", "👞"), p("ca-mi-sa", "👕"), p("ma-ri-po-sa", "🦋"), p("te-lé-fo-no", "📱"),
  p("bi-ci-cle-ta", "🚲"), p("com-pu-ta-do-ra", "💻"), p("tor-tu-ga", "🐢"), p("co-ne-jo", "🐰"),
  p("ca-ba-llo", "🐴"), p("ga-lli-na", "🐔"), p("ra-tón", "🐭"), p("re-loj", "⌚"), p("flor", "🌸"),
  p("tren", "🚆"), p("glo-bo", "🎈"), p("fre-sa", "🍓"), p("nu-be", "☁️"), p("es-tre-lla", "⭐"),
  p("a-vión", "✈️"), p("bar-co", "⛵"), p("di-ne-ro", "💵"), p("ca-rro", "🚗"), p("que-so", "🧀"),
  p("po-llo", "🍗"), p("hue-vo", "🥚"), p("es-cue-la", "🏫"), p("hos-pi-tal", "🏥"), p("me-di-ci-na", "💊"),
  p("ma-le-ta", "🧳"), p("ven-ta-na", "🪟"), p("puer-ta", "🚪"), p("ni-ño", "👦"), p("be-bé", "👶"),
  p("dien-tes", "🦷"), p("pie", "🦶"), p("na-riz", "👃"), p("o-re-ja", "👂"), p("mo-to", "🏍️"),
  p("lá-piz", "✏️"), p("so-pa", "🍲"), p("a-rroz", "🍚"), p("li-món", "🍋"), p("pi-ña", "🍍"),
  p("u-ña", "💅"), p("i-gle-sia", "⛪"), p("i-mán", "🧲"), p("bo-te-lla", "🍾"), p("bu-rro", "🫏"), p("doc-tor", "🧑‍⚕️"), p("mo-ne-da", "🪙"),
  p("ti-je-ras", "✂️"), p("lla-ve", "🔑"), p("ce-bo-lla", "🧅"), p("cam-pa-na", "🔔"), p("cor-ba-ta", "👔"),
  p("ca-ma", "🛏️"), p("fue-go", "🔥"), p("ra-na", "🐸"), p("ser-pien-te", "🐍"), p("lá-piz", "✏️"),
  p("na-ran-ja", "🍊"), p("mi-cro-bús", "🚌"), p("pla-to", "🍽️"), p("bra-zo", "💪"), p("bru-ja", "🧙"),
  p("cla-vo", "🔩"), p("cra-yón", "🖍️"), p("dra-gón", "🐉"), p("gri-llo", "🦗"), p("pre-mio", "🏆"),
  p("tri-go", "🌾"), p("blu-sa", "👚"), p("flau-ta", "🪈"), p("plu-ma", "🪶"),
].filter((x, i, todas) => todas.findIndex((y) => y.texto === x.texto) === i);

/** Cómo se nombra cada letra al decirla en voz alta (la voz del navegador lee mal una letra suelta). */
export const NOMBRE_LETRA: Record<string, string> = {
  a: "a", b: "be", c: "ce", d: "de", e: "e", f: "efe", g: "ge", h: "hache", i: "i", j: "jota",
  k: "ka", l: "ele", m: "eme", n: "ene", ñ: "eñe", o: "o", p: "pe", q: "cu", r: "erre", s: "ese",
  t: "te", u: "u", v: "uve", w: "doble uve", x: "equis", y: "ye", z: "zeta",
};

export const VOCALES = ["a", "e", "i", "o", "u"];

/** Oraciones cortas con un dibujo que las representa. */
export const ORACIONES: { texto: string; emoji: string }[] = [
  { texto: "El gato duerme.", emoji: "🐱💤" },
  { texto: "El perro come.", emoji: "🐶🍖" },
  { texto: "La niña lee un libro.", emoji: "👧📖" },
  { texto: "Hoy llueve mucho.", emoji: "🌧️☔" },
  { texto: "El bebé llora.", emoji: "👶😢" },
  { texto: "Mamá cocina sopa.", emoji: "👩‍🍳🍲" },
  { texto: "El carro es rojo.", emoji: "🚗" },
  { texto: "El pez nada en el agua.", emoji: "🐟🌊" },
  { texto: "Tomo café en la mañana.", emoji: "☕🌅" },
  { texto: "El avión vuela alto.", emoji: "✈️☁️" },
  { texto: "Me lavo las manos.", emoji: "🧼🙌" },
  { texto: "El tren llega a la estación.", emoji: "🚆" },
  { texto: "Compro pan en la tienda.", emoji: "🍞🛒" },
  { texto: "El niño juega con la pelota.", emoji: "👦⚽" },
  { texto: "Papá maneja la moto.", emoji: "👨🏍️" },
  { texto: "La gallina pone un huevo.", emoji: "🐔🥚" },
  { texto: "El doctor me cura.", emoji: "🧑‍⚕️🩹" },
  { texto: "Riego las flores.", emoji: "🚿🌸" },
  { texto: "Pago con monedas.", emoji: "🪙💰" },
  { texto: "Duermo en mi cama.", emoji: "😴🛏️" },
];

/** Plantilla de comprensión literal: quién fue a dónde, cuándo y qué compró. */
export const COMPRENSION = {
  personas: ["Ana", "Luis", "María", "Pedro", "Rosa", "Juan", "Carmen", "José"],
  momentos: ["en la mañana", "en la tarde", "en la noche"],
  lugares: [
    { lugar: "la tienda", cosas: ["leche", "arroz", "huevos", "azúcar"] },
    { lugar: "el mercado", cosas: ["tomates", "papas", "plátanos", "cebollas"] },
    { lugar: "la panadería", cosas: ["pan", "galletas", "un pastel"] },
    { lugar: "la farmacia", cosas: ["medicina", "vendas", "alcohol"] },
  ],
  acompanantes: ["su hija", "su hermano", "su vecina", "su esposo", "su amigo"],
};

/** Textos para inferir: la respuesta no está escrita, hay que deducirla. {n} es un nombre. */
export const INFERENCIAS: { id: string; texto: string; pregunta: string; correcta: string; otras: string[] }[] = [
  {
    id: "lluvia", texto: "{n} mira por la ventana. El cielo está gris y cae agua. {n} saca su paraguas.",
    pregunta: "¿Cómo está el tiempo?", correcta: "Está lloviendo", otras: ["Hace mucho sol", "Está nevando"],
  },
  {
    id: "hambre", texto: "{n} no desayunó. Ya es mediodía y le suena el estómago.",
    pregunta: "¿Qué siente {n}?", correcta: "Tiene hambre", otras: ["Tiene sueño", "Tiene frío"],
  },
  {
    id: "cumple", texto: "Hoy hay pastel con velas en la casa de {n}. Llegan sus amigos con regalos.",
    pregunta: "¿Qué celebran?", correcta: "Un cumpleaños", otras: ["Una boda", "Un examen"],
  },
  {
    id: "frio", texto: "{n} se pone un abrigo, una bufanda y guantes antes de salir.",
    pregunta: "¿Cómo está afuera?", correcta: "Hace frío", otras: ["Hace calor", "Es de noche"],
  },
  {
    id: "noche", texto: "Las estrellas brillan. {n} apaga la luz y se acuesta en la cama.",
    pregunta: "¿Qué hora del día es?", correcta: "Es de noche", otras: ["Es de mañana", "Es mediodía"],
  },
  {
    id: "enfermo", texto: "{n} tiene fiebre y le duele la garganta. Hoy no fue a trabajar.",
    pregunta: "¿Por qué no fue a trabajar?", correcta: "Se enfermó", otras: ["Se fue de vacaciones", "Ganó un premio"],
  },
  {
    id: "bus", texto: "{n} corre a la parada, pero el bus ya se fue. Mira su reloj.",
    pregunta: "¿Qué le pasó a {n}?", correcta: "Perdió el bus", otras: ["Llegó temprano", "Compró un reloj"],
  },
  {
    id: "flores", texto: "{n} riega las plantas todos los días. Ahora el jardín está lleno de colores.",
    pregunta: "¿Qué tiene el jardín?", correcta: "Muchas flores", otras: ["Mucha basura", "Mucha nieve"],
  },
  {
    id: "mercado", texto: "{n} lleva una bolsa vacía al mercado. Vuelve con la bolsa llena de frutas.",
    pregunta: "¿Qué hizo {n} en el mercado?", correcta: "Compró frutas", otras: ["Vendió su bolsa", "Se perdió"],
  },
  {
    id: "perro", texto: "El perro de {n} mueve la cola y salta cuando {n} llega a casa.",
    pregunta: "¿Cómo se siente el perro?", correcta: "Está feliz", otras: ["Está enojado", "Está dormido"],
  },
];

/** Concordancia sujeto-verbo: misma oración en singular y plural. */
export const CONCORDANCIA = {
  sujetos: [
    { texto: "El perro", plural: false }, { texto: "Los perros", plural: true },
    { texto: "La niña", plural: false }, { texto: "Las niñas", plural: true },
    { texto: "Mi mamá", plural: false }, { texto: "Mis hermanos", plural: true },
    { texto: "El señor", plural: false }, { texto: "Los vecinos", plural: true },
  ],
  verbos: [
    { singular: "come", plural: "comen", resto: "pan." },
    { singular: "corre", plural: "corren", resto: "en el parque." },
    { singular: "duerme", plural: "duermen", resto: "en la tarde." },
    { singular: "juega", plural: "juegan", resto: "con la pelota." },
    { singular: "camina", plural: "caminan", resto: "a la tienda." },
    { singular: "canta", plural: "cantan", resto: "muy bonito." },
  ],
};
