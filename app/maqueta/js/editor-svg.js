// Vista desde arriba del editor "Armar salon" (spec §6.2): el area en SVG con su cuadricula, las piezas con sus
// sillas, y todo lo que se hace con el mouse (o el dedo: pointer events): arrastrar con imán, girar con la manija
// redonda y estirar con las manijas de los extremos. Varias a la vez: encerrarlas con un marco desde el piso libre o
// Shift/Ctrl+clic, y arrastrar cualquiera de ellas mueve todas juntas. El salon se agranda o achica con las manijas
// de su borde derecho, el de abajo y la esquina. Mientras se arrastra la pieza sigue al puntero sin saltos (con
// decimales) y se marca el cuadro donde va a quedar; al soltar se acomoda a ese cuadro con una animacion corta, o
// vuelve a donde estaba si ahi no cabe. Las unidades del SVG son cuadros (viewBox), asi el navegador escala todo; los
// px de pantalla se pasan a cuadros con la escala. La vista no cambia el plano: avisa lo que el usuario hizo (alTocar,
// alMover, alSoltarNueva…) y el editor decide.
import { huellaDe } from './plano.js?v=20261102m';
import { puestosDe } from './piezas3d.js?v=20261102m';
import {
	problemaEn, dentroDelArea, espacioDe, largoDe, sePuedeGirar, tieneLargo, estiradaHasta, estiradaQueCabe,
	difAngulo, anguloConIman, giroCercano, conGiro, lugarManijaGiro, empujeManijaLargo, corrimientoDentro, grupoCorrido,
	piezasEnMarco, tamanoQueCabe, extremosDe, ejeDe, medidaDe, conMedida,
} from './editor-piezas.js?v=20261102m';

const NS = 'http://www.w3.org/2000/svg';
const UMBRAL_PX = 5;            // menos que esto entre apretar y soltar = toque, no arrastre
const BORDE = 1;                // cuadros alrededor del area para que se vea la pared
const MUNDO = 10;               // unidades del mundo por cuadro (puestosDe trabaja en mundo)
const GRIS = '#8a8a90', ROJO = '#d64545', ROJO_SUAVE = '#fdecec', TEXTO = '#2b2f36';
const DUR_ASENTAR = 150;        // ms: al soltar, la pieza llega a su cuadro
const DUR_VOLVER = 240;         // ms: vuelve a donde estaba porque ahi no cabia
const DUR_TECLA = 200;          // ms: giro de 90° con la tecla R
const MANIJA_GIRO_PX = 26;      // px entre la pieza (con sus sillas) y la manija de girar
const RADIO_GIRO_PX = 15;       // px: zona de agarre de la manija de girar
const ZONA_LARGO_PX = 20;       // px: zona de agarre de una manija del largo, a lo largo de la pieza
const MARGEN_VISIBLE_PX = 4;    // px que la manija deja libres hasta el borde del escenario

/**
 * Cuadros enteros que corresponden a px de pantalla con escala px por cuadro, al cuadro mas cercano (el imán).
 * @param {number} px
 * @param {number} escala px por cuadro (> 0)
 * @returns {number} entero (nunca -0)
 */
export function aCuadro(px, escala) {
	if (!(escala > 0) || !Number.isFinite(escala)) { throw new RangeError('maqueta: escala invalida'); }
	return Math.round(px / escala) + 0;
}

function el(tag, attrs = {}, padre = null) {
	const e = document.createElementNS(NS, tag);
	for (const [k, v] of Object.entries(attrs)) { e.setAttribute(k, String(v)); }
	if (padre) { padre.appendChild(e); }
	return e;
}

/** Texto oscuro sobre colores claros y blanco sobre oscuros. */
function tintaPara(hex) {
	const n = parseInt(hex.slice(1), 16);
	const luz = 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
	return luz > 140 ? TEXTO : '#ffffff';
}

// ---------------------------------------------------------------- dibujo de cada pieza (centrada en su origen, sin girar)

function tablero(g, pz, c) {
	if (pz.forma === 'redonda' || pz.forma === 'alta') {
		el('circle', { r: pz.forma === 'alta' ? 0.9 : 1.8, fill: c.mesa, stroke: c.linea, 'stroke-width': c.ancho }, g);
		return;
	}
	const { ancho, fondo } = huellaDe({ ...pz, giro: 0 });
	const dentro = pz.forma === 'cuadrada2' ? 0.2 : 0;   // la de 2 mide 26 de 30
	el('rect', {
		x: -ancho / 2 + dentro, y: -fondo / 2 + dentro, width: ancho - dentro * 2, height: fondo - dentro * 2,
		rx: 0.35, fill: c.mesa, stroke: c.linea, 'stroke-width': c.ancho,
	}, g);
}

function sillasDe(g, pz, c) {
	for (const s of puestosDe(pz.forma, pz.sillas ?? 0, pz.giro)) {
		const ang = (Math.atan2(s.oy, s.ox) * 180) / Math.PI;
		const silla = el('g', { transform: `translate(${s.x / MUNDO} ${s.y / MUNDO}) rotate(${ang})` }, g);
		el('rect', { x: -0.6, y: -0.6, width: 1.2, height: 1.2, rx: 0.3, fill: c.silla, stroke: c.linea, 'stroke-width': 0.08 }, silla);
		el('rect', { x: 0.35, y: -0.6, width: 0.3, height: 1.2, rx: 0.12, fill: c.linea }, silla);   // respaldo
	}
}

function rotulo(g, texto, tamano, tinta, halo) {
	const t = el('text', {
		'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': tamano, 'font-weight': 700, fill: tinta,
		stroke: halo, 'stroke-width': tamano * 0.28, 'paint-order': 'stroke', 'stroke-linejoin': 'round',
	}, g);
	t.textContent = texto;   // codigos y nombres siempre como texto
	return t;
}

// Barra de atras hacia adelante, como piezas3d: repisa, mostrador y banquetas, todo dentro de su huella.
function barra(g, w, d, c) {
	el('rect', { x: -w / 2, y: -d / 2 + 0.1, width: w, height: 1.4, rx: 0.2, fill: c.pared, stroke: c.linea, 'stroke-width': 0.08 }, g);
	el('rect', { x: -w / 2, y: -1.3, width: w, height: 3, rx: 0.3, fill: '#8d8f94', stroke: c.linea, 'stroke-width': 0.08 }, g);
	const n = w >= 1.3 ? Math.floor((w * MUNDO - 13) / 30) + 1 : 0;
	for (let i = 0; i < n; i++) {
		el('circle', { cx: ((i - (n - 1) / 2) * 30) / MUNDO, cy: 3.6, r: 0.6, fill: c.silla, stroke: c.linea, 'stroke-width': 0.08 }, g);
	}
}

// Jardinera vista desde arriba: cajon oscuro con matas de hojas en punta (estrellas de 3 hojas) a lo largo.
function jardinera(g, w, d, c) {
	el('rect', { x: -w / 2 + 0.1, y: -d / 2 + 0.15, width: w - 0.2, height: d - 0.3, rx: 0.25, fill: '#5b5f66', stroke: c.linea, 'stroke-width': 0.08 }, g);
	const n = Math.max(1, Math.round(w / 0.9));
	for (let i = 0; i < n; i++) {
		const mata = el('g', { transform: `translate(${-w / 2 + ((i + 0.5) * w) / n} ${(i % 2 ? 0.2 : -0.2) * (d - 0.6)}) rotate(${i * 37})` }, g);
		for (const ang of [0, 60, 120]) {
			el('path', { d: 'M0 -0.55L0.16 0L0 0.55L-0.16 0Z', transform: `rotate(${ang})`, fill: i % 3 ? '#8fae84' : '#a9c29b' }, mata);
		}
	}
}

export const ALFOMBRA_COLOR = '#8b8580';

const ADORNOS = {
	barra,
	jardinera,
	alfombra(g, w, d, c, pz) {
		el('rect', { x: -w / 2, y: -d / 2, width: w, height: d, rx: 0.3, fill: pz.color || ALFOMBRA_COLOR, 'fill-opacity': 0.9 }, g);
		el('rect', {
			x: -w / 2 + 0.4, y: -d / 2 + 0.4, width: Math.max(0, w - 0.8), height: Math.max(0, d - 0.8), rx: 0.2, fill: 'none',
			stroke: '#ffffff', 'stroke-opacity': 0.35, 'stroke-width': 0.12,
		}, g);
	},
	planta(g, w, d, c, pz) {
		const r = pz.talla === 'alta' ? 0.95 : 0.8;
		el('circle', { r, fill: '#a9b8a0', stroke: '#7d8f74', 'stroke-width': 0.1 }, g);
		if (pz.talla === 'alta') { el('circle', { r: 0.4, fill: '#8fa386' }, g); }
	},
	biombo: (g, w, d, c) => el('rect', { x: -w / 2, y: -d / 2 + 0.3, width: w, height: d - 0.6, rx: 0.15, fill: '#c9c4bb', stroke: c.linea, 'stroke-width': 0.08 }, g),
	pared: (g, w, d, c) => el('rect', { x: -w / 2, y: -d / 2, width: w, height: d, rx: 0.15, fill: c.pared, stroke: c.linea, 'stroke-width': 0.1 }, g),
	columna: (g, w, d, c) => el('rect', { x: -w / 2 + 0.2, y: -d / 2 + 0.2, width: w - 0.4, height: d - 0.4, rx: 0.2, fill: c.pared, stroke: c.linea, 'stroke-width': 0.1 }, g),
	entrada(g, w, d) {
		el('rect', { x: -w / 2 + 0.3, y: -d / 2 + 0.1, width: w - 0.6, height: d - 0.2, rx: 0.1, fill: '#55555c' }, g);
	},
	caja(g, w, d, c) {
		el('rect', { x: -w / 2 + 0.1, y: -d / 2 + 0.1, width: w - 0.2, height: d - 0.2, rx: 0.2, fill: c.pared, stroke: c.linea, 'stroke-width': 0.1 }, g);
		el('rect', { x: 0, y: 1, width: 0.3, height: 1.6, fill: '#3b3b40' }, g);   // monitor mirando a +x, bajo el rotulo
	},
	sofa(g, w, d, c) {
		el('rect', { x: -w / 2, y: -d / 2, width: w, height: d, rx: 0.3, fill: c.silla, stroke: c.linea, 'stroke-width': 0.1 }, g);
		el('rect', { x: -w / 2, y: -d / 2, width: w, height: 0.5, rx: 0.2, fill: c.linea }, g);   // respaldo atras
	},
};
const NOMBRE_EN_PISO = { caja: 'Caja', entrada: 'Entrada' };

/** Centro de la huella de la pieza, en cuadros (puede tener decimales). */
function centroDe(pz) {
	const h = huellaDe(pz);
	return { x: pz.x + h.ancho / 2, y: pz.y + h.fondo / 2 };
}

/**
 * Grupo SVG de una pieza: centrado en el centro de su huella; el cuerpo gira, el rotulo no (siempre se lee derecho).
 * noExiste: mesa de un codigo que el area ya no tiene (en rojo).
 */
function dibujarPieza(pz, ajustes, noExiste = false) {
	const c0 = centroDe(pz);
	const g = el('g', { transform: `translate(${c0.x} ${c0.y})`, class: 'mqe-pz' });
	const c = {
		mesa: noExiste ? ROJO_SUAVE : ajustes.mesas, silla: noExiste ? ROJO_SUAVE : ajustes.sillas, pared: ajustes.paredes,
		linea: noExiste ? ROJO : GRIS, ancho: noExiste ? 0.2 : 0.12,
	};
	if (pz.t === 'mesa') {
		sillasDe(g, pz, c);
		tablero(el('g', { transform: `rotate(${pz.giro})` }, g), pz, c);
		rotulo(g, pz.codigo, 1.25, noExiste ? ROJO : tintaPara(c.mesa), c.mesa);
		return g;
	}
	const sinGiro = huellaDe({ ...pz, giro: 0 });
	const w = pz.largo != null ? largoDe(pz) : sinGiro.ancho;
	ADORNOS[pz.t](el('g', { transform: `rotate(${pz.giro})` }, g), w, sinGiro.fondo, c, pz);
	if (NOMBRE_EN_PISO[pz.t]) { rotulo(g, NOMBRE_EN_PISO[pz.t], 0.7, pz.t === 'entrada' ? '#ffffff' : TEXTO, 'none'); }
	return g;
}

// ---------------------------------------------------------------- marco y manijas de la pieza elegida
// Las manijas se dibujan en px (scale 1/escala): miden lo mismo en la pantalla con cualquier tamaño de salon.

/**
 * Manija redonda de girar con su palito: debajo de la pieza (la barrita va arriba) o donde se vea entera
 * (lugarManijaGiro). visible = lo que se ve del escenario, en cuadros.
 */
function manijaGiro(capa, pz, px, visible) {
	const lugar = lugarManijaGiro(pz, visible, MANIJA_GIRO_PX * px, (RADIO_GIRO_PX + 2) * px);
	if (lugar.tallo) {
		el('line', {
			x1: lugar.tallo.x, y1: lugar.tallo.y, x2: lugar.x, y2: lugar.y, class: 'mqe-tallo', 'vector-effect': 'non-scaling-stroke',
		}, capa);
	}
	const g = el('g', { transform: `translate(${lugar.x} ${lugar.y}) scale(${px})`, class: 'mqe-manija mqe-manija-giro', 'data-control': 'girar' }, capa);
	el('title', {}, g).textContent = 'Arrastra para girar (tecla R: un cuarto de vuelta)';
	el('circle', { r: RADIO_GIRO_PX, class: 'mqe-manija-zona' }, g);
	el('circle', { r: 9.5, class: 'mqe-manija-cuerpo' }, g);
	el('path', { d: 'M0 -4.5A4.5 4.5 0 1 1 -4.5 0M-7 0.8L-4.5 -2.4L-2 0.8', class: 'mqe-manija-icono' }, g);
}

/**
 * Manija de un extremo del largo ('ini' o 'fin'), en la mitad del borde corto. En piezas cortas en la pantalla se
 * corre hacia afuera (empujeManijaLargo) para que el medio de la pieza siga libre para arrastrarla.
 */
function manijaLargo(capa, pz, px, extremo) {
	const h = huellaDe(pz), eje = ejeDe(pz, extremo), fin = extremo.startsWith('fin');
	const afuera = empujeManijaLargo(medidaDe(pz, extremo) / px, ZONA_LARGO_PX) * px * (fin ? 1 : -1);
	const x = eje === 'x' ? pz.x + (fin ? h.ancho : 0) + afuera : pz.x + h.ancho / 2;
	const y = eje === 'y' ? pz.y + (fin ? h.fondo : 0) + afuera : pz.y + h.fondo / 2;
	const g = el('g', {
		transform: `translate(${x} ${y}) scale(${px})`, class: `mqe-manija mqe-manija-${eje}`,
		'data-control': 'estirar', 'data-extremo': extremo,
	}, capa);
	el('title', {}, g).textContent = 'Arrastra para alargar o acortar';
	const [w, l] = eje === 'x' ? [1, 0] : [0, 1];   // la manija es larga en el sentido del borde
	const z = ZONA_LARGO_PX / 2;
	el('rect', { x: -z * w - 15 * l, y: -15 * w - z * l, width: 2 * z * w + 30 * l, height: 30 * w + 2 * z * l, class: 'mqe-manija-zona' }, g);
	el('rect', { x: -4.5 * w - 10 * l, y: -10 * w - 4.5 * l, width: 9 * w + 20 * l, height: 20 * w + 9 * l, rx: 4.5, class: 'mqe-manija-cuerpo' }, g);
}

/** Marco de la pieza elegida y, si se puede cambiar, sus manijas. escala = px por cuadro; visible en cuadros. */
function marcoSel(capa, pz) {
	const h = huellaDe(pz);
	el('rect', {
		x: pz.x - 0.3, y: pz.y - 0.3, width: h.ancho + 0.6, height: h.fondo + 0.6, rx: 0.4, class: 'mqe-sel',
		'vector-effect': 'non-scaling-stroke',
	}, capa);
}

function dibujarManijas(capa, pz, escala, visible, editable) {
	const px = 1 / escala;
	marcoSel(capa, pz);
	if (!editable) { return; }
	if (sePuedeGirar(pz)) { manijaGiro(capa, pz, px, visible); }
	for (const extremo of extremosDe(pz)) { manijaLargo(capa, pz, px, extremo); }
}

/** Dibujo chico de la pieza vista desde arriba, con sus sillas (la bandeja). Las largas, mas cortas: se reconocen igual. */
export function miniatura(pz, ajustes) {
	const p = { codigo: '', giro: 0, x: 0, y: 0, ...pz, ...(pz.largo != null ? { largo: Math.min(pz.largo, 12) } : {}) };
	const e = espacioDe(p);
	const svg = el('svg', { class: 'mqe-mini', viewBox: `${e.x - 0.3} ${e.y - 0.3} ${e.ancho + 0.6} ${e.fondo + 0.6}`, 'aria-hidden': 'true' });
	svg.appendChild(dibujarPieza(p, ajustes));
	return svg;
}

// ---------------------------------------------------------------- piso del salon y sus manijas

/** Pared, piso y cuadricula de un salon de ancho×fondo cuadros. */
function dibujarPiso(capa, ancho, fondo, a) {
	capa.replaceChildren();
	el('rect', { x: -0.5, y: -0.5, width: ancho + 1, height: fondo + 1, rx: 0.4, fill: a.paredes, stroke: GRIS, 'stroke-width': 0.1 }, capa);
	el('rect', { x: 0, y: 0, width: ancho, height: fondo, fill: a.piso }, capa);
	cuadricula(capa, ancho, fondo);
}

/** Manijas para estirar el salon: en el borde derecho, en el de abajo y en la esquina (en px: scale px). */
function manijasLienzo(capa, ancho, fondo, px) {
	capa.replaceChildren();
	for (const [lado, eje, w, h] of [['ancho', 'x', 9, 26], ['fondo', 'y', 26, 9], ['ambos', 'xy', 13, 13]]) {
		const x = lado === 'fondo' ? ancho / 2 : ancho + 0.5, y = lado === 'ancho' ? fondo / 2 : fondo + 0.5;
		const g = el('g', {
			transform: `translate(${x} ${y}) scale(${px})`, class: `mqe-manija mqe-manija-${eje}`, 'data-control': 'lienzo', 'data-lado': lado,
		}, capa);
		el('title', {}, g).textContent = 'Arrastra para agrandar o achicar el salón';
		el('rect', { x: -w / 2 - 6, y: -h / 2 - 6, width: w + 12, height: h + 12, class: 'mqe-manija-zona' }, g);
		el('rect', { x: -w / 2, y: -h / 2, width: w, height: h, rx: 4.5, class: 'mqe-manija-cuerpo' }, g);
	}
}

const vistaDe = (ancho, fondo) => `${-BORDE} ${-BORDE} ${ancho + BORDE * 2} ${fondo + BORDE * 2}`;

// ---------------------------------------------------------------- vista

/** Cuadricula de 1 cuadro con una linea mas marcada cada 5 (una sola ruta: con 200×200 son 400 lineas). */
function cuadricula(svg, ancho, fondo) {
	let fina = '', gruesa = '';
	for (let x = 1; x < ancho; x++) { if (x % 5) { fina += `M${x} 0V${fondo}`; } else { gruesa += `M${x} 0V${fondo}`; } }
	for (let y = 1; y < fondo; y++) { if (y % 5) { fina += `M0 ${y}H${ancho}`; } else { gruesa += `M0 ${y}H${ancho}`; } }
	const linea = { fill: 'none', 'vector-effect': 'non-scaling-stroke', 'stroke-width': 1 };
	el('path', { ...linea, d: fina, stroke: 'rgba(255,255,255,.22)' }, svg);
	el('path', { ...linea, d: gruesa, stroke: 'rgba(255,255,255,.5)' }, svg);
}

function espacioRect(capa, pz, mal) {
	const e = espacioDe(pz);
	el('rect', {
		x: e.x, y: e.y, width: e.ancho, height: e.fondo, rx: 0.3, class: mal ? 'mqe-espacio mqe-mal' : 'mqe-espacio',
		'vector-effect': 'non-scaling-stroke',
	}, capa);
}

/** Contorno de la huella donde va a quedar la pieza (en la mesa, dentro del marco de sus sillas). */
function destinoRect(capa, pz, mal) {
	const h = huellaDe(pz);
	el('rect', {
		x: pz.x, y: pz.y, width: h.ancho, height: h.fondo, rx: 0.3, class: mal ? 'mqe-destino mqe-mal' : 'mqe-destino',
		'vector-effect': 'non-scaling-stroke',
	}, capa);
}

const suave = t => 1 - (1 - t) ** 3;   // ease-out: arranca rapido y frena al llegar
const entre = (a, b, t) => a + (b - a) * t;
const sinMovimiento = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const CURSORES = ['mqe-arrastrando', 'mqe-girando', 'mqe-estirando-x', 'mqe-estirando-y', 'mqe-estirando-xy', 'mqe-marcando'];

/**
 * Monta la vista dentro de host.
 * @param {HTMLElement} host
 * @param {{alTocar: Function, alMover: Function, alSoltarNueva: Function, alClicNueva: Function, alNoCabe: Function}} ev
 *   alTocar(indice|null, sumar) (sumar: Shift/Ctrl+clic, pone o saca de las elegidas) · alMover(indice, piezaCambiada)
 *   (movida, girada o estirada) · alSoltarNueva(pieza) · alClicNueva(pieza) (se toco sin arrastrar: el editor le busca
 *   lugar) · alNoCabe('fuera'|'choca', 'girar'?) · alElegirVarias(indices, sumar) (las del marco) ·
 *   alMoverVarias(piezas) (el plano.piezas nuevo con las elegidas corridas juntas)
 */
export function crearVista(host, ev) {
	const svg = el('svg', { class: 'mqe-svg', role: 'img', 'aria-label': 'Salón visto desde arriba' });
	host.appendChild(svg);
	// grupo: indices de las elegidas cuando son varias (entonces seleccion es -1 y no hay manijas)
	let plano = null, opciones = { seleccion: -1, grupo: new Set(), noExisten: new Set(), editable: false };
	let capaPiso = null, capaPiezas = null, capaGuia = null, capaControles = null, capaLienzo = null;
	let zoom = 0;                       // requestAnimationFrame del salon acomodandose a la vista mientras se estira
	// Lo que se esta haciendo con el puntero: {tipo: 'mover'|'nueva'|'girar'|'estirar', cx, cy, movio, …}
	let arrastre = null;
	let animacion = null;               // {id, fin}: la pieza acomodandose despues de soltarla
	let puntero = null, cuadro = 0;     // ultima posicion del puntero aun no dibujada y su requestAnimationFrame

	/** Px por cuadro y donde cae el cuadro 0 en la pantalla (el viewBox lo escala el navegador). */
	function medida() {
		const m = svg.getScreenCTM();
		return m && m.a > 0 ? { escala: m.a, ox: m.e, oy: m.f } : null;
	}

	const grupoDe = i => (capaPiezas ? capaPiezas.querySelector(`[data-i="${i}"]`) : null);
	/** La que se arrastra queda encima de las demas; una alfombra, debajo de todo (las mesas van sobre ella). */
	function alFrente(g) {
		if (plano.piezas[Number(g.dataset.i)]?.t === 'alfombra') { capaPiezas.prepend(g); } else { capaPiezas.appendChild(g); }
	}

	function agarrarCursor(clase) {
		document.body.classList.add('mqe-arrastrando');
		if (clase) { document.body.classList.add(clase); }
	}
	const soltarCursor = () => document.body.classList.remove(...CURSORES);

	// ------------------------------------------------------------ animacion al soltar

	function animar(ms, paso, fin) {
		const t0 = performance.now(), dur = sinMovimiento() ? 0 : ms;
		const a = { id: 0, fin };
		const siguiente = ahora => {
			const t = dur > 0 ? Math.min(1, Math.max(0, (ahora - t0) / dur)) : 1;
			paso(suave(t));
			if (t < 1) { a.id = requestAnimationFrame(siguiente); return; }
			animacion = null;
			fin();
		};
		animacion = a;
		a.id = requestAnimationFrame(siguiente);
	}

	/** Anima la pieza soltada y despues (ya sin el cursor de arrastre, para que el editor mida la barrita) avisa. */
	function asentar(ms, paso, fin) {
		animar(ms, paso, () => { soltarCursor(); fin(); });
	}

	/** Termina ya la animacion en curso (la pieza queda donde iba). true si habia una. */
	function apurarAnimacion() {
		if (!animacion) { return false; }
		const a = animacion;
		animacion = null;
		cancelAnimationFrame(a.id);
		a.fin();
		return true;
	}

	// ------------------------------------------------------------ dibujo

	/**
	 * Medida y lo que se ve del escenario en cuadros (el escenario recorta lo que sale de el): las manijas van ahi
	 * dentro. null si el SVG no tiene medida (oculto).
	 */
	function medidaConVisible() {
		const m = medida();
		if (!m) { return null; }
		const r = host.getBoundingClientRect(), b = MARGEN_VISIBLE_PX;
		return {
			m,
			visible: {
				x: (r.left + b - m.ox) / m.escala, y: (r.top + b - m.oy) / m.escala,
				ancho: Math.max(0, r.width - b * 2) / m.escala, fondo: Math.max(0, r.height - b * 2) / m.escala,
			},
		};
	}

	/** El marco y las manijas de la elegida (o de pz, la elegida mientras se estira; mv = medidaConVisible ya leida). */
	function controles(pz = plano && plano.piezas[opciones.seleccion], mv = null) {
		if (!capaControles) { return; }
		capaControles.replaceChildren();
		capaControles.removeAttribute('transform');
		for (const i of opciones.grupo) { marcoSel(capaControles, plano.piezas[i]); }
		if (!pz) { return; }
		mv = mv || medidaConVisible();
		dibujarManijas(capaControles, pz, mv ? mv.m.escala : 1, mv ? mv.visible : null, !!mv && opciones.editable);
	}

	/** Dibuja el plano. Lo que se estaba arrastrando o acomodando se descarta (el plano cambio por fuera). */
	function pintar(nuevo, op) {
		if (animacion) { cancelAnimationFrame(animacion.id); animacion = null; }
		if (cuadro) { cancelAnimationFrame(cuadro); cuadro = 0; }
		if (zoom) { cancelAnimationFrame(zoom); zoom = 0; }
		if (arrastre) { arrastre = null; }
		soltarCursor();
		quitarCartel();
		plano = nuevo;
		opciones = { ...opciones, ...op };
		svg.replaceChildren();
		svg.removeAttribute('preserveAspectRatio');   // estirar el salon la deja anclada arriba a la izquierda
		svg.setAttribute('viewBox', vistaDe(plano.ancho, plano.fondo));
		capaPiso = el('g', {}, svg);
		dibujarPiso(capaPiso, plano.ancho, plano.fondo, plano.ajustes);
		capaPiezas = el('g', {}, svg);
		// las alfombras primero: quedan debajo de las mesas que tienen encima
		const orden = plano.piezas.map((_, i) => i);
		for (const i of [...orden.filter(i => plano.piezas[i].t === 'alfombra'), ...orden.filter(i => plano.piezas[i].t !== 'alfombra')]) {
			capaPiezas.appendChild(grupoPara(plano.piezas[i], i));
		}
		capaGuia = el('g', { class: 'mqe-guia' }, svg);
		capaControles = el('g', { class: 'mqe-controles' }, svg);
		capaLienzo = el('g', {}, svg);
		controles();
		manijasDelLienzo();
	}

	/** Las manijas del borde del salon (solo si se puede cambiar), a su tamaño en px con la escala de ahora. */
	function manijasDelLienzo(ancho = plano.ancho, fondo = plano.fondo) {
		const m = opciones.editable ? medida() : null;
		if (m) { manijasLienzo(capaLienzo, ancho, fondo, 1 / m.escala); } else { capaLienzo.replaceChildren(); }
	}

	function grupoPara(pz, i) {
		const g = dibujarPieza(pz, plano.ajustes, opciones.noExisten.has(i));
		g.dataset.i = String(i);
		if (opciones.editable) { g.classList.add('mqe-movible'); }
		return g;
	}

	/**
	 * Marco del espacio que pide la pieza (con el aire de las sillas), rojo si ahi no cabe; con destino, tambien el
	 * contorno de la huella. Devuelve el problema (null si cabe).
	 */
	function guia(pz, ignorar, destino = false) {
		capaGuia.replaceChildren();
		const problema = problemaEn(plano, pz, ignorar);
		espacioRect(capaGuia, pz, problema !== null);
		if (destino && pz.t === 'mesa') { destinoRect(capaGuia, pz, problema !== null); }
		return problema;
	}

	/**
	 * La pieza que se mueve o gira, con su centro en c y girada ang grados de mas (el rotulo sigue derecho); el marco y
	 * las manijas la acompañan si es la elegida.
	 */
	function colocar(a, c, ang = null) {
		a.grupo.setAttribute('transform', `translate(${c.x} ${c.y})${ang === null ? '' : ` rotate(${ang})`}`);
		if (ang !== null) {
			for (const t of a.grupo.querySelectorAll(':scope > text')) { t.setAttribute('transform', `rotate(${-ang})`); }
		}
		if (a.i === opciones.seleccion) {
			const c0 = a.c0;
			capaControles.setAttribute('transform', `translate(${c.x - c0.x} ${c.y - c0.y}) rotate(${ang ?? 0} ${c0.x} ${c0.y})`);
		}
	}

	const enArea = pz => dentroDelArea(plano, pz, pz.x, pz.y);
	const enMundo = (e, m) => ({ x: (e.clientX - m.ox) / m.escala, y: (e.clientY - m.oy) / m.escala });

	// ------------------------------------------------------------ mover una pieza del salon

	function moverExistente(a, e) {
		const dx = e.clientX - a.cx, dy = e.clientY - a.cy;
		a.visto = dentroDelArea(plano, a.pz, a.pz.x + dx / a.m.escala, a.pz.y + dy / a.m.escala);
		colocar(a, centroDe(a.visto));
		const c = dentroDelArea(plano, a.pz, a.pz.x + aCuadro(dx, a.m.escala), a.pz.y + aCuadro(dy, a.m.escala));
		if (!a.candidato || c.x !== a.candidato.x || c.y !== a.candidato.y) { guia(c, a.i, true); }
		a.candidato = c;
	}

	function soltarExistente(a) {
		if (!a.movio) { ev.alTocar(a.i); return; }
		const { i, pz, candidato } = a;
		const quieta = !candidato || (candidato.x === pz.x && candidato.y === pz.y);
		const problema = quieta ? null : problemaEn(plano, candidato, i);
		const desde = centroDe(a.visto), hasta = centroDe(quieta || problema ? pz : candidato);
		asentar(problema ? DUR_VOLVER : DUR_ASENTAR, t => colocar(a, { x: entre(desde.x, hasta.x, t), y: entre(desde.y, hasta.y, t) }), () => {
			if (quieta || problema) { pintar(plano, {}); }
			if (problema) { ev.alNoCabe(problema); } else if (!quieta) { ev.alMover(i, candidato); }
		});
	}

	// ------------------------------------------------------------ pieza nueva (de la bandeja o de "Mesas por colocar")

	const enSvg = (e, r) => e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;

	function moverNueva(a, e) {
		if (!a.m || !enSvg(e, a.caja)) {
			capaGuia.replaceChildren();
			a.candidato = null;
			return;
		}
		const h = huellaDe(a.nueva), mundo = enMundo(e, a.m);
		const fx = mundo.x - h.ancho / 2, fy = mundo.y - h.fondo / 2;
		const c = dentroDelArea(plano, a.nueva, Math.round(fx), Math.round(fy));
		a.visto = dentroDelArea(plano, a.nueva, fx, fy);
		if (!a.fantasma) {
			a.fantasma = dibujarPieza(a.visto, plano.ajustes);
			a.fantasma.classList.add('mqe-fantasma');
		}
		if (!a.candidato || c.x !== a.candidato.x || c.y !== a.candidato.y) { guia(c, -1, true); }
		const v = centroDe(a.visto);
		a.fantasma.setAttribute('transform', `translate(${v.x} ${v.y})`);
		if (a.fantasma.parentNode !== capaGuia) { capaGuia.appendChild(a.fantasma); }
		a.candidato = c;
	}

	function soltarNueva(a, e) {
		const { nueva, candidato } = a;
		if (!a.movio) { capaGuia.replaceChildren(); ev.alClicNueva(nueva); return; }
		const problema = candidato && enSvg(e, a.caja) ? problemaEn(plano, candidato, -1) : 'afuera';
		if (problema) {
			capaGuia.replaceChildren();
			soltarCursor();
			if (problema !== 'afuera') { ev.alNoCabe(problema); }   // la solto fuera del salon: no pasa nada
			return;
		}
		const desde = centroDe(a.visto), hasta = centroDe(candidato);
		asentar(DUR_ASENTAR, t => a.fantasma.setAttribute('transform', `translate(${entre(desde.x, hasta.x, t)} ${entre(desde.y, hasta.y, t)})`),
			() => ev.alSoltarNueva(candidato));
	}

	// ------------------------------------------------------------ girar con la manija

	const anguloPuntero = (e, c) => (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI;

	function empezarGiro(e, i) {
		const pz = plano.piezas[i], m = medida(), grupo = grupoDe(i);
		if (!pz || !m || !grupo || !sePuedeGirar(pz)) { return; }
		const c0 = centroDe(pz);
		const centro = { x: m.ox + c0.x * m.escala, y: m.oy + c0.y * m.escala };
		arrastre = {
			tipo: 'girar', cursor: 'mqe-girando', i, pz, grupo, c0, centro, ang: anguloPuntero(e, centro),
			delta: 0, visual: 0, giro: pz.giro, candidato: null, cx: e.clientX, cy: e.clientY, movio: false,
		};
		alFrente(grupo);
	}

	function moverGiro(a, e) {
		const ang = anguloPuntero(e, a.centro);
		a.delta += difAngulo(ang, a.ang);   // acumulado: se puede dar mas de una vuelta
		a.ang = ang;
		a.visual = anguloConIman(a.delta);
		colocar(a, a.c0, a.visual);
		const giro = giroCercano(a.pz.giro, a.delta);
		if (giro === a.giro) { return; }
		a.giro = giro;
		a.candidato = giro === a.pz.giro ? null : enArea(conGiro(a.pz, giro));
		if (a.candidato) { guia(a.candidato, a.i, true); } else { capaGuia.replaceChildren(); }
	}

	/** Lleva el dibujo al giro recto mas cercano (o de vuelta, si ahi no cabe) y avisa al editor. */
	function asentarGiro(a, ms = DUR_ASENTAR) {
		const { i, candidato } = a;
		const problema = candidato ? problemaEn(plano, candidato, i) : null;
		const gira = candidato && !problema;
		const hasta = gira ? Math.round(a.delta / 90) * 90 : Math.round(a.visual / 360) * 360;
		const c1 = gira ? centroDe(candidato) : a.c0, desde = a.visual;
		// con la tecla no hubo giro que deshacer: un amago de girar dice que se intento pero no cabe
		const amago = problema && desde === hasta;
		const ang = t => (amago ? Math.sin(Math.PI * t) * 14 : entre(desde, hasta, t));
		asentar(problema ? DUR_VOLVER : ms, t => colocar(a, { x: entre(a.c0.x, c1.x, t), y: entre(a.c0.y, c1.y, t) }, ang(t)), () => {
			if (!gira) { pintar(plano, {}); }
			if (problema) { ev.alNoCabe(problema, 'girar'); } else if (gira) { ev.alMover(i, candidato); }
		});
	}

	function soltarGiro(a) {
		if (a.movio) { asentarGiro(a); }
	}

	// ------------------------------------------------------------ estirar con las manijas de los extremos

	function empezarEstirar(e, i, extremo) {
		const pz = plano.piezas[i], mv = medidaConVisible(), grupo = grupoDe(i);
		if (!pz || !mv || !grupo || !tieneLargo(pz)) { return; }
		const eje = ejeDe(pz, extremo), m = mv.m;
		arrastre = {
			tipo: 'estirar', cursor: `mqe-estirando-${eje}`, i, pz, m, mv, eje, extremo, grupo,
			p0: enMundo(e, m)[eje], pos0: extremo.startsWith('fin') ? pz[eje] + medidaDe(pz, extremo) : pz[eje],
			visto: pz, entero: null, candidato: pz, cx: e.clientX, cy: e.clientY, movio: false,
		};
		alFrente(grupo);
	}

	/** Vuelve a dibujar la pieza que se estira (con su largo con decimales) y sus manijas. */
	function redibujar(a, pz) {
		const g = grupoPara(pz, a.i);
		a.grupo.replaceWith(g);
		a.grupo = g;
		controles(pz, a.mv);   // con la medida del principio: sin leer el layout en cada cuadro
	}

	function moverEstirar(a, e) {
		const pos = a.pos0 + enMundo(e, a.m)[a.eje] - a.p0;
		a.visto = estiradaHasta(a.pz, a.extremo, pos);
		redibujar(a, a.visto);
		const entero = Math.round(pos);
		if (entero === a.entero) { return; }
		a.entero = entero;
		a.candidato = estiradaQueCabe(plano, a.pz, a.i, a.extremo, entero);
		capaGuia.replaceChildren();
		const pedida = estiradaHasta(a.pz, a.extremo, entero);
		if (medidaDe(pedida, a.extremo) === medidaDe(a.pz, a.extremo)) { return; }
		const mal = problemaEn(plano, pedida, a.i) !== null;
		espacioRect(capaGuia, pedida, mal);
		if (mal && a.candidato) { destinoRect(capaGuia, a.candidato, false); }   // hasta donde va a llegar
	}

	function soltarEstirar(a) {
		if (!a.movio) { return; }
		const { i, pz, eje, visto, candidato, extremo } = a;
		const destino = candidato || pz;
		const quieta = medidaDe(destino, extremo) === medidaDe(pz, extremo) && destino[eje] === pz[eje];
		asentar(candidato ? DUR_ASENTAR : DUR_VOLVER, t => redibujar(a, {
			...conMedida(pz, extremo, entre(medidaDe(visto, extremo), medidaDe(destino, extremo), t)), [eje]: entre(visto[eje], destino[eje], t),
		}), () => {
			if (!candidato || quieta) { pintar(plano, {}); }
			if (!candidato) { ev.alNoCabe(problemaEn(plano, pz, i) || 'choca'); } else if (!quieta) { ev.alMover(i, candidato); }
		});
	}

	// ------------------------------------------------------------ varias elegidas: moverlas juntas

	function empezarGrupo(e, i, m) {
		const miembros = [...opciones.grupo].map(k => ({ g: grupoDe(k), c0: centroDe(plano.piezas[k]) })).filter(x => x.g);
		for (const x of miembros) { alFrente(x.g); }
		arrastre = { tipo: 'grupo', i, m, miembros, visto: { dx: 0, dy: 0 }, d: null, corrido: null, cx: e.clientX, cy: e.clientY, movio: false };
	}

	/** Las elegidas y sus marcos corridos (dx, dy) cuadros desde donde estaban. */
	function correrGrupo(a, d) {
		for (const x of a.miembros) { x.g.setAttribute('transform', `translate(${x.c0.x + d.dx} ${x.c0.y + d.dy})`); }
		capaControles.setAttribute('transform', `translate(${d.dx} ${d.dy})`);
	}

	function moverGrupo(a, e) {
		const k = opciones.grupo;
		a.visto = corrimientoDentro(plano, k, (e.clientX - a.cx) / a.m.escala, (e.clientY - a.cy) / a.m.escala);
		correrGrupo(a, a.visto);
		const d = corrimientoDentro(plano, k, Math.round(a.visto.dx), Math.round(a.visto.dy));
		if (a.d && d.dx === a.d.dx && d.dy === a.d.dy) { return; }
		a.d = d;
		a.corrido = grupoCorrido(plano, k, d.dx, d.dy);
		capaGuia.replaceChildren();
		for (const i of k) { espacioRect(capaGuia, a.corrido.piezas[i], problemaEn(plano, a.corrido.piezas[i], k) !== null); }
	}

	function soltarGrupo(a) {
		if (!a.movio) { ev.alTocar(a.i); return; }   // un toque en una de las elegidas: queda solo esa
		const quieta = !a.d || (a.d.dx === 0 && a.d.dy === 0);
		const problema = quieta ? null : a.corrido.problema;
		const desde = a.visto, hasta = quieta || problema ? { dx: 0, dy: 0 } : a.d;
		capaGuia.replaceChildren();
		asentar(problema ? DUR_VOLVER : DUR_ASENTAR, t => correrGrupo(a, { dx: entre(desde.dx, hasta.dx, t), dy: entre(desde.dy, hasta.dy, t) }), () => {
			if (quieta || problema) { pintar(plano, {}); }
			if (problema) { ev.alNoCabe(problema); } else if (!quieta) { ev.alMoverVarias(a.corrido.piezas); }
		});
	}

	// ------------------------------------------------------------ marco para elegir varias (desde el piso libre)

	function moverMarco(a, e) {
		const p = enMundo(e, a.m);
		a.r = { x: Math.min(a.p0.x, p.x), y: Math.min(a.p0.y, p.y), ancho: Math.abs(p.x - a.p0.x), fondo: Math.abs(p.y - a.p0.y) };
		capaGuia.replaceChildren();
		el('rect', { x: a.r.x, y: a.r.y, width: a.r.ancho, height: a.r.fondo, class: 'mqe-marco', 'vector-effect': 'non-scaling-stroke' }, capaGuia);
	}

	function soltarMarco(a) {
		capaGuia.replaceChildren();
		soltarCursor();
		if (!a.movio) { if (!a.sumar) { ev.alTocar(null); } return; }
		ev.alElegirVarias(piezasEnMarco(plano, a.r), a.sumar);
	}

	// ------------------------------------------------------------ estirar el salon con las manijas de su borde
	// Mientras se estira, la ventana del SVG queda anclada arriba a la izquierda (xMinYMin) donde estaba: el borde sigue
	// al puntero (el tamaño sale de cuanto se movio, con la escala del principio) y solo si el salon ya no entra la vista
	// se aleja poco a poco. Al soltar, la ventana va suave hasta el salon nuevo centrado (lo que dibuja pintar).

	const ventana = v => `${v.x} ${v.y} ${v.w} ${v.h}`;

	function empezarLienzo(e, lado) {
		const m = medida(), caja = svg.getBoundingClientRect();
		if (!m || !caja.width || !caja.height) { return; }
		const s = m.escala, v0 = { x: (caja.left - m.ox) / s, y: (caja.top - m.oy) / s, w: caja.width / s, h: caja.height / s };
		svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
		svg.setAttribute('viewBox', ventana(v0));   // la misma vista de ahora: nada salta
		const eje = lado === 'ancho' ? 'x' : lado === 'fondo' ? 'y' : 'xy';
		arrastre = {
			tipo: 'lienzo', cursor: `mqe-estirando-${eje}`, lado, m, caja, v0, vista: { ...v0, meta: v0 },
			ancho: plano.ancho, fondo: plano.fondo, cx: e.clientX, cy: e.clientY, movio: false,
		};
	}

	/** Lleva la ventana un tercio del camino hacia su meta en cada cuadro de pantalla. */
	function acercarVista(v) {
		zoom = 0;
		for (const k of ['x', 'y', 'w', 'h']) { v[k] += (v.meta[k] - v[k]) / 3; }
		if (['x', 'y', 'w', 'h'].every(k => Math.abs(v.meta[k] - v[k]) < 0.02)) { Object.assign(v, v.meta); } else { zoom = requestAnimationFrame(() => acercarVista(v)); }
		svg.setAttribute('viewBox', ventana(v));
		if (arrastre && arrastre.tipo === 'lienzo') { manijasDelLienzo(arrastre.ancho, arrastre.fondo); }
	}

	function quitarCartel() {
		const c = host.querySelector('.mqe-medida');
		if (c) { c.remove(); }
	}

	/** Cartelito con la medida junto al puntero (dentro del escenario). */
	function cartel(a, e) {
		const c = host.querySelector('.mqe-medida') || host.appendChild(document.createElement('div'));
		c.className = 'mqe-medida';
		c.textContent = `Ancho ${a.ancho} · Fondo ${a.fondo}`;
		const r = host.getBoundingClientRect();
		c.style.left = `${Math.min(e.clientX - r.left + 14, r.width - c.offsetWidth - 4)}px`;
		c.style.top = `${Math.min(e.clientY - r.top + 14, r.height - c.offsetHeight - 4)}px`;
	}

	function moverLienzo(a, e) {
		const x = a.lado !== 'fondo', y = a.lado !== 'ancho', s = a.m.escala;
		const t = tamanoQueCabe(plano, plano.ancho + (x ? (e.clientX - a.cx) / s : 0), plano.fondo + (y ? (e.clientY - a.cy) / s : 0));
		const cambio = t.ancho !== a.ancho || t.fondo !== a.fondo;
		cartel(Object.assign(a, t), e);
		if (!cambio) { return; }
		dibujarPiso(capaPiso, t.ancho, t.fondo, plano.ajustes);
		manijasDelLienzo(t.ancho, t.fondo);
		// la vista solo se aleja si el salon (con su pared) ya no entra en la ventana del principio
		const { v0 } = a, z = Math.max(1, (t.ancho + BORDE - v0.x) / v0.w, (t.fondo + BORDE - v0.y) / v0.h);
		a.vista.meta = { x: v0.x, y: v0.y, w: v0.w * z, h: v0.h * z };
		if (!zoom) { zoom = requestAnimationFrame(() => acercarVista(a.vista)); }
	}

	function soltarLienzo(a) {
		quitarCartel();
		if (zoom) { cancelAnimationFrame(zoom); zoom = 0; }
		if (!a.movio || (a.ancho === plano.ancho && a.fondo === plano.fondo)) { pintar(plano, {}); return; }
		// ventana del salon nuevo centrado (como la deja pintar, xMidYMid meet): se llega a ella sin saltos
		const { width: W, height: H } = a.caja, cw = a.ancho + BORDE * 2, ch = a.fondo + BORDE * 2, s = Math.min(W / cw, H / ch);
		const fin = { x: -BORDE - (W / s - cw) / 2, y: -BORDE - (H / s - ch) / 2, w: W / s, h: H / s };
		const de = { ...a.vista };
		const { ancho, fondo } = a;
		asentar(DUR_ASENTAR, t => svg.setAttribute('viewBox', ventana({
			x: entre(de.x, fin.x, t), y: entre(de.y, fin.y, t), w: entre(de.w, fin.w, t), h: entre(de.h, fin.h, t),
		})), () => ev.alCambiarTamano(ancho, fondo));
	}

	// ------------------------------------------------------------ puntero

	const MOVER = { mover: moverExistente, nueva: moverNueva, girar: moverGiro, estirar: moverEstirar, grupo: moverGrupo, marco: moverMarco, lienzo: moverLienzo };
	const SOLTAR = { mover: soltarExistente, nueva: soltarNueva, girar: soltarGiro, estirar: soltarEstirar, grupo: soltarGrupo, marco: soltarMarco, lienzo: soltarLienzo };

	/** Una vez por cuadro de pantalla, con la ultima posicion del puntero. */
	function seguirPuntero() {
		cuadro = 0;
		const e = puntero, a = arrastre;
		puntero = null;
		if (!e || !a) { return; }
		if (!a.movio) {
			const umbral = a.tipo === 'mover' || a.tipo === 'nueva' || a.tipo === 'grupo' || a.tipo === 'marco' ? UMBRAL_PX : 1;
			if (Math.hypot(e.clientX - a.cx, e.clientY - a.cy) < umbral) { return; }
			a.movio = true;
			agarrarCursor(a.cursor);
		}
		MOVER[a.tipo](a, e);
	}

	/** El evento es del puntero que empezo el arrastre (un segundo dedo o mouse no lo toca). */
	const delArrastre = e => arrastre && e.pointerId === arrastre.id;

	function alMoverPuntero(e) {
		if (!delArrastre(e)) { return; }
		// sin botones apretados: el soltar se perdio (fuera de la ventana, un dialogo…): no se deja pegado
		if (e.buttons === 0) { alCancelar(); return; }
		puntero = { clientX: e.clientX, clientY: e.clientY };
		if (!cuadro) { cuadro = requestAnimationFrame(seguirPuntero); }
	}

	function alSoltar(e) {
		if (!delArrastre(e)) { return; }
		if (cuadro) { cancelAnimationFrame(cuadro); seguirPuntero(); }   // lo ultimo que se movio cuenta
		const a = arrastre;
		arrastre = null;
		if (!a.movio) { soltarCursor(); }
		SOLTAR[a.tipo](a, e);
	}

	/** Deja todo como estaba antes de apretar (sin avisar al editor). true si habia algo arrastrandose. */
	function alCancelar() {
		if (!arrastre) { return false; }
		arrastre = null;
		soltarCursor();
		if (plano) { pintar(plano, {}); }
		return true;
	}

	/** pointercancel, o el SVG perdio el puntero sin pointerup (otra ventana, el navegador lo tomo…). */
	function alPerderPuntero(e) {
		if (delArrastre(e)) { alCancelar(); }
	}

	/** Anota que puntero es el del arrastre y lo captura: los movimientos llegan aunque salga del SVG. */
	function capturar(e) {
		if (!arrastre) { return; }
		arrastre.id = e.pointerId;
		try { svg.setPointerCapture(e.pointerId); } catch { /* el puntero ya no esta apretado: siguen los eventos del documento */ }
	}

	function alApretar(e) {
		if (!plano || e.button !== 0 || arrastre) { return; } // un segundo dedo no roba el arrastre en curso
		// si la anterior aun se estaba acomodando, se termina ya y se mira que hay bajo el puntero en el dibujo nuevo
		const objetivo = apurarAnimacion() ? document.elementFromPoint(e.clientX, e.clientY) : e.target;
		if (!objetivo || !svg.contains(objetivo)) { return; }
		const control = opciones.editable ? objetivo.closest('[data-control]') : null;
		if (control) {
			e.preventDefault();
			const que = control.dataset.control;
			if (que === 'lienzo') { empezarLienzo(e, control.dataset.lado); } else if (que === 'girar') { empezarGiro(e, opciones.seleccion); } else { empezarEstirar(e, opciones.seleccion, control.dataset.extremo); }
			capturar(e);
			return;
		}
		const g = objetivo.closest('[data-i]');
		const sumar = e.shiftKey || e.ctrlKey || e.metaKey;
		const m = opciones.editable ? medida() : null;
		if (!g && m) {   // piso libre: marco para elegir varias (un toque sin arrastrar quita la eleccion)
			e.preventDefault();
			arrastre = { tipo: 'marco', cursor: 'mqe-marcando', m, p0: enMundo(e, m), r: null, sumar, cx: e.clientX, cy: e.clientY, movio: false };
			capturar(e);
			return;
		}
		if (!g) { ev.alTocar(null); return; }
		const i = Number(g.dataset.i);
		if (!opciones.editable) { ev.alTocar(i); return; }
		e.preventDefault();
		if (sumar) { ev.alTocar(i, true); return; }
		if (!m) { return; }
		if (opciones.grupo.has(i)) { empezarGrupo(e, i, m); capturar(e); return; }
		const pz = plano.piezas[i];
		arrastre = { tipo: 'mover', i, pz, m, c0: centroDe(pz), grupo: g, visto: pz, candidato: null, cx: e.clientX, cy: e.clientY, movio: false };
		alFrente(g);
		capturar(e);
	}

	/** Al cambiar el tamaño de la ventana cambia la escala: las manijas se vuelven a dibujar a su tamaño en px. */
	function alRedimensionar() {
		if (plano && !arrastre && !animacion) { controles(); manijasDelLienzo(); }
	}

	svg.addEventListener('pointerdown', alApretar);
	svg.addEventListener('lostpointercapture', alPerderPuntero);   // tras un pointerup normal ya no hay arrastre
	document.addEventListener('pointermove', alMoverPuntero);
	document.addEventListener('pointerup', alSoltar);
	document.addEventListener('pointercancel', alPerderPuntero);
	window.addEventListener('resize', alRedimensionar);
	window.addEventListener('blur', alCancelar);

	return Object.freeze({
		pintar,
		/** Empieza a arrastrar una pieza nueva (de la bandeja o de "Mesas por colocar") desde un pointerdown. */
		arrastrarNueva(pieza, e) {
			if (!plano || e.button !== 0) { return; }
			e.preventDefault();
			apurarAnimacion();
			arrastre = {
				tipo: 'nueva', nueva: pieza, m: medida(), caja: svg.getBoundingClientRect(), fantasma: null, visto: null,
				candidato: null, cx: e.clientX, cy: e.clientY, movio: false,
			};
			capturar(e);
		},
		/**
		 * Termina ya la animacion de lo que se acaba de soltar, asi su cambio llega al editor (y al historial) antes
		 * de deshacer, guardar, copiar… true si habia una.
		 */
		apurar: () => apurarAnimacion(),
		/** Escape: suelta lo que se esta arrastrando y lo deja como estaba. true si habia algo. */
		cancelar: () => alCancelar(),
		/** Gira la pieza 90° con animacion (tecla R). false si no se puede girar. */
		girar(i) {
			if (!plano || arrastre || !opciones.editable) { return false; }
			apurarAnimacion();
			const pz = plano.piezas[i], grupo = grupoDe(i);
			if (!pz || !grupo || !sePuedeGirar(pz)) { return false; }
			const a = { tipo: 'girar', i, pz, grupo, c0: centroDe(pz), delta: 90, visual: 0, candidato: enArea(conGiro(pz, (pz.giro + 90) % 360)) };
			alFrente(grupo);
			guia(a.candidato, i, true);
			asentarGiro(a, DUR_TECLA);
			return true;
		},
		/** Donde se ven juntas las piezas de indices en la pantalla, con sus marcos (para poner la barrita). */
		rectDeVarias(indices) {
			const rs = [...indices].map(grupoDe).filter(Boolean).map(g => g.getBoundingClientRect());
			if (capaControles && capaControles.firstChild) { rs.push(capaControles.getBoundingClientRect()); }
			if (!rs.length) { return null; }
			const left = Math.min(...rs.map(r => r.left)), top = Math.min(...rs.map(r => r.top));
			return new DOMRect(left, top, Math.max(...rs.map(r => r.right)) - left, Math.max(...rs.map(r => r.bottom)) - top);
		},
		/** Donde se ve la pieza en la pantalla, con su marco y manijas si es la elegida (para poner la barrita). */
		rectDePieza(i) {
			const g = grupoDe(i);
			if (!g) { return null; }
			const r = g.getBoundingClientRect();
			if (i !== opciones.seleccion || !capaControles || !capaControles.firstChild) { return r; }
			const k = capaControles.getBoundingClientRect();
			const left = Math.min(r.left, k.left), top = Math.min(r.top, k.top);
			return new DOMRect(left, top, Math.max(r.right, k.right) - left, Math.max(r.bottom, k.bottom) - top);
		},
		destruir() {
			document.removeEventListener('pointermove', alMoverPuntero);
			document.removeEventListener('pointerup', alSoltar);
			document.removeEventListener('pointercancel', alPerderPuntero);
			window.removeEventListener('resize', alRedimensionar);
			window.removeEventListener('blur', alCancelar);
			svg.remove();
		},
	});
}
