// Geometria de la maqueta 3D (spec docs/superpowers/specs/2026-10-31-maqueta-salon-3d-design.md §5.4), portada del
// prototipo aprobado (docs/superpowers/specs/2026-10-31-maqueta-salon-3d-prototipo.html): materiales, local, piezas,
// los 4 modelos de silla, personas y lo que hay sobre las mesas. Sin renderer ni DOM: escena.js junta lo que sale de
// aqui por material y lo dibuja.
// Coordenadas del plano en unidades del mundo (1 cuadro = 10): x a lo ancho, y hacia la camara, alto hacia arriba.
import * as THREE from '../vendor/three-0.170.0/build/three.module.js';
import { RoundedBoxGeometry } from '../vendor/three-0.170.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from '../vendor/three-0.170.0/examples/jsm/utils/BufferGeometryUtils.js';
import { huellaDe, claveMesa } from './plano.js?v=20261102m';

export const CUADRO = 10;
const TH = 25;                                  // alto de la mesa (y de los platos)
export const ALTO_MESA = TH;
const WH = 34, WT = 10, WH_FRENTE = 14;         // paredes del local: alto, grosor y alto de la delantera (cortada)
const ALTO_PARED = 24, ALTO_COLUMNA = 34;       // piezas pared y columna
const SEP_SILLA = 11;                           // del borde de la mesa al centro de la silla
const SILLA_ANCHO = 14;                         // lo que ocupa una silla a lo largo del lado de la mesa
const ASIENTO_ALTO = 26.7, ARO_ALTO = 14;       // banqueta de mesa alta (la de barra: 22.5 y 8)

/**
 * Mesas por forma, en unidades del mundo y sin girar: tamaño del tablero (o radio), sillas por defecto, como se
 * reparten (grupos de lados por turno: el primer grupo se llena antes que el siguiente), a que distancia de la
 * silla queda el plato hacia la mesa y cuanto se corre el vaso a un costado.
 */
const FORMA3D = {
	cuadrada: { ancho: 30, fondo: 30, sillas: 4, grupos: [['-y', '+y', '-x', '+x']], hacia: 14.3, lateral: 6.5, alto: TH },
	cuadrada2: { ancho: 26, fondo: 26, sillas: 2, grupos: [['-x', '+x', '-y', '+y']], hacia: 14.3, lateral: 6.5, alto: TH },
	larga: { ancho: 80, fondo: 30, sillas: 6, grupos: [['-y', '+y'], ['-x', '+x']], hacia: 14.3, lateral: 6.5, alto: TH },
	redonda: { radio: 18, sep: SEP_SILLA, sillas: 4, hacia: 16, lateral: 6.5, alto: TH },
	alta: { radio: 9, sep: 9, sillas: 2, hacia: 12.6, lateral: 4, alto: 38 },
};
// Lados de una mesa rectangular en orden alrededor (atras, derecha, adelante, izquierda): hacia afuera de cada uno.
const LADOS = { '-y': [0, -1], '+x': [1, 0], '+y': [0, 1], '-x': [-1, 0] };
const VUELTA = ['-y', '+x', '+y', '-x'];

// ---------------------------------------------------------------- materiales

const std = (color, roughness = 0.85, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
/** Material de una alfombra ('alfombra:#rrggbb'): el color que eligio el dueño, sin desaturar. null si no es eso. */
export function materialAlfombra(llave) {
	const m = /^alfombra:(#[0-9a-f]{6})$/.exec(llave);
	return m ? std(m[1], 1) : null;
}

/** Llave de Ajustes → material que tiñe. */
export const MATERIAL_DE_AJUSTE = Object.freeze({ piso: 'floor', mesas: 'wood', sillas: 'chair', cojin: 'cushion', patas: 'leg', paredes: 'wall' });

/**
 * Un material por cosa (los del prototipo). Los decorativos van desaturados: la escena es gris y el color queda para
 * lo que pide accion. Los que el dueño elige (Ajustes) y la pantalla de la caja quedan como vienen.
 * @param {THREE.Texture} baldosas textura del piso
 */
export function crearMateriales(baldosas) {
	const MAT = {
		floor: std('#bababa', 0.95, { map: baldosas }),
		wall: std('#fbfbfc', 0.9),
		bar: std('#eadfce', 0.6),
		wood: std('#fbfaf8', 0.6),
		chair: std('#f3f1ed', 0.85),
		cushion: std('#e9e6e0', 0.95),
		leg: std('#d9d5ce', 0.5),
		metal: std('#c4c8ce', 0.35, { metalness: 0.6 }),
		dark: std('#4b4f56', 0.6),
		linea: std('#8a8d95', 0.9),
		screen: std('#20242b', 0.3, { emissive: '#1d3550', emissiveIntensity: 0.6 }),
		plate: std('#ffffff', 0.35),
		f0: std('#d9a066', 0.8), f1: std('#8db76a', 0.85), f2: std('#9b5a3c', 0.7), f3: std('#f3ead7', 0.9), f4: std('#e2553f', 0.7),
		glass: std('#dcebf0', 0.1, { transparent: true, opacity: 0.55 }),
		wine: std('#7d2335', 0.4), juice: std('#eba23a', 0.4), soda: std('#3a2a22', 0.4),
		bottleG: std('#3f6b4f', 0.25), bottleA: std('#8a5a2b', 0.25),
		candle: std('#fff4dc', 0.6, { emissive: '#ffd89a', emissiveIntensity: 0.25 }),
		pot: std('#e8e3da', 0.9), soil: std('#6b5443', 1), trunk: std('#8a6a4c', 0.9),
		leaf: std('#73ad6f', 0.8), leaf2: std('#5e9a64', 0.8),
		skin: std('#d9b195', 0.8), skin1: std('#b98868', 0.8), skin2: std('#8a5e45', 0.8),
		hair: std('#3a312c', 0.9), hair1: std('#6b4a33', 0.9), hair2: std('#c9a77c', 0.9),
		shoe: std('#3b3d42', 0.7),
		c0: std('#3d4f6b', 0.9), c1: std('#9fb4c7', 0.9), c2: std('#a7adb8', 0.9), c3: std('#f2f0ec', 0.9), c4: std('#6c7a5f', 0.9), c5: std('#c9a0a6', 0.9),
		pants: std('#4a4f5a', 0.9), pants1: std('#d6cdbd', 0.9),
	};
	const sinDesaturar = [...Object.values(MATERIAL_DE_AJUSTE), 'screen', 'linea'];
	for (const [k, m] of Object.entries(MAT)) {
		if (sinDesaturar.includes(k)) { continue; }
		const hsl = {};
		m.color.getHSL(hsl);
		m.color.setHSL(hsl.h, hsl.s * 0.35, hsl.l);
	}
	return MAT;
}

// ---------------------------------------------------------------- armador

/**
 * Junta geometria por material. `put` y `limb` reciben coordenadas del plano (o locales dentro de `en`); `en` arma
 * algo en su propio marco (centro, giro y alto), asi cada pieza y cada silla se dibuja una vez sin girar.
 * @param {number} anchoMundo, fondoMundo tamaño del salon: el centro del salon queda en el origen del mundo
 */
export function crearArmador(anchoMundo = 0, fondoMundo = 0) {
	const tmp = new THREE.Object3D();
	const ARRIBA = new THREE.Vector3(0, 1, 0);
	let base = new THREE.Matrix4().makeTranslation(-anchoMundo / 2, 0, -fondoMundo / 2);
	let cubo = {};
	const guardar = (mat, geo) => (cubo[mat] ||= []).push(geo);
	const matrizDe = () => { tmp.scale.set(1, 1, 1); tmp.updateMatrix(); return tmp.matrix.premultiply(base); };

	function put(geo, mat, x, y, z, ry = 0, rx = 0, rz = 0) {
		tmp.position.set(x, z, y);
		tmp.rotation.set(rx, ry, rz);
		guardar(mat, geo.clone().applyMatrix4(matrizDe()));
	}
	// Capsula entre dos puntos [x, y, alto]; fina = varilla (patas y parantes), con menos caras.
	function limb(a, b, r, mat, fina = false) {
		const A = new THREE.Vector3(a[0], a[2], a[1]), B = new THREE.Vector3(b[0], b[2], b[1]);
		const v = B.clone().sub(A), largo = v.length();
		// menos caras que el prototipo: con 50 mesas hay ~150 personas y ~200 sillas
		const g = fina ? new THREE.CapsuleGeometry(r, Math.max(0.1, largo), 1, 5) : new THREE.CapsuleGeometry(r, Math.max(0.1, largo), 2, 7);
		tmp.position.copy(A.add(B).multiplyScalar(0.5));
		tmp.quaternion.setFromUnitVectors(ARRIBA, largo > 1e-6 ? v.normalize() : ARRIBA);
		guardar(mat, g.applyMatrix4(matrizDe()));
	}
	function en(x, y, giroY, alto, armar) {
		const previa = base;
		base = previa.clone().multiply(new THREE.Matrix4().makeTranslation(x, alto, y)).multiply(new THREE.Matrix4().makeRotationY(giroY));
		try { armar(); } finally { base = previa; }
	}
	// Copia un modelo ya armado (en su origen) al lugar actual.
	function copiar(modelo) {
		for (const [mat, lista] of Object.entries(modelo)) {
			for (const g of lista) { guardar(mat, g.clone().applyMatrix4(base)); }
		}
	}
	function tomar() { const c = cubo; cubo = {}; return c; }
	return { put, limb, en, copiar, tomar };
}

const rbox = (w, h, d, r = 1, seg = 2) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2));
const cyl = (r, h, s = 20, r2 = r) => new THREE.CylinderGeometry(r, r2, h, Math.max(6, Math.round(s * 0.6)));
const lathe = (pts, s = 32) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), Math.max(8, Math.round(s * 0.6)));
const pick = (lista, rnd) => lista[Math.floor(rnd() * lista.length)];
const ESQUINAS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

/** Numero estable de un texto (FNV-1a de 32 bits). */
export function hashTexto(t) {
	let h = 0x811c9dc5;
	for (let i = 0; i < t.length; i++) { h = Math.imul(h ^ t.charCodeAt(i), 0x01000193); }
	return h >>> 0;
}
/** Aleatorio con semilla (el del prototipo): la misma mesa sale siempre igual. */
function aleatorio(semilla) {
	let s = semilla % 233280;
	return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

// Geometrias que se copian muchas veces: se crean una vez, al primer uso.
let plantillasCache = null;
const pedestal = (alto, r) => lathe([[0, 0], [r, 0], [r, 0.8], [r * 0.7, 1.6], [2.2, 2.6], [1.5, 4], [1.5, alto - 5], [3, alto - 3.2], [0, alto - 3.2]], 32);
function plantillas() {
	return (plantillasCache ||= {
		SEAT: lathe([[0, 0], [6.4, 0], [6.7, 1.2], [6.6, 2.6], [6.2, 3.2], [0, 3.2]], 28),
		CUSH: lathe([[0, 0], [5.6, 0], [5.9, 0.5], [5.7, 1.3], [4.8, 1.7], [0, 1.8]], 28),
		LEG: cyl(0.45, 12, 8, 0.75),
		PED: pedestal(TH, 8.5),
		PED_ALTA: pedestal(FORMA3D.alta.alto, 6.5),
		TLEG: cyl(0.8, TH - 3, 10, 1.15),
		PLATE: lathe([[0, 0], [3, 0], [4.6, 0.6], [4.9, 0.9], [4.6, 0.95], [3, 0.45], [0, 0.45]], 24),
		GLASS: lathe([[0, 0], [1.2, 0], [1.4, 5], [1.25, 5], [1.05, 0.4], [0, 0.4]], 16),
		BOTTLE: lathe([[0, 0], [1.6, 0], [1.6, 6], [0.6, 8], [0.55, 10], [0, 10]], 16),
		POT: lathe([[0, 0], [5.2, 0], [6.6, 10.5], [7.3, 11], [7.3, 12.2], [6.5, 12.2], [6.2, 11], [0, 11]], 28),
		COJIN_BANQUETA: lathe([[0, 0], [5.8, 0], [6.2, 1.4], [5.6, 2.6], [0, 2.8]], 24),
		TRAZO_X: rbox(4, 0.4, 1.2, 0.2, 1),
		TRAZO_Y: rbox(1.2, 0.4, 4, 0.2, 1),
	});
}

// ---------------------------------------------------------------- sillas (en su origen, respaldo hacia +x)

// Sillon: asiento redondo con cojin y respaldo curvo que envuelve.
function sillon(a) {
	const g = plantillas();
	const sh = new THREE.Shape();
	sh.absarc(0, 0, 7.2, -1.75, 1.75, false);
	sh.absarc(0, 0, 4.9, 1.75, -1.75, true);
	const respaldo = new THREE.ExtrudeGeometry(sh, { depth: 8, bevelEnabled: true, bevelThickness: 1.4, bevelSize: 1.1, bevelSegments: 2, curveSegments: 10 });
	respaldo.rotateX(-Math.PI / 2);
	a.put(g.SEAT, 'chair', 0, 0, 11.8);
	a.put(g.CUSH, 'cushion', 0, 0, 15);
	a.put(respaldo, 'chair', 0, 0, 15.4);
	for (const [dx, dy] of ESQUINAS) { a.put(g.LEG, 'leg', dx * 4, dy * 4, 6); }
}
function clasica(a) {
	// cantos poco redondeados: con un segmento basta (son ~200 sillas)
	a.put(rbox(11, 2, 11, 0.8, 1), 'chair', 0, 0, 14);
	a.put(rbox(10, 1.2, 9.6, 0.6, 1), 'cushion', -0.5, 0, 15.5);
	a.put(rbox(1.5, 12, 10.6, 0.7, 1), 'chair', 4.9, 0, 21.5);
	a.put(rbox(2.2, 2.2, 11.6, 1, 1), 'chair', 4.9, 0, 28.4);
	for (const [dx, dy] of ESQUINAS) { a.put(cyl(0.5, 13, 8, 0.65), 'leg', dx * 4.4, dy * 4.4, 6.5); }
}
function bistro(a) {
	a.put(cyl(5.6, 1.4, 28), 'chair', 0, 0, 14.3);
	a.put(cyl(5, 0.8, 28), 'cushion', 0, 0, 15.3);
	for (const [dx, dy] of ESQUINAS) { a.limb([dx * 3.4 * 1.18, dy * 3.4 * 1.18, 0.3], [dx * 3.4, dy * 3.4, 13.6], 0.38, 'leg', true); }
	// Respaldo: un aro curvo sostenido por tres parantes.
	const at = (t, R, z) => new THREE.Vector3(Math.cos(t) * R, z, Math.sin(t) * R);
	const arco = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => at(-1.25 + (2.5 * i) / 8, 5.3, 25)));
	a.put(new THREE.TubeGeometry(arco, 12, 0.55, 5), 'leg', 0, 0, 0);
	for (const t of [-0.9, 0, 0.9]) {
		const p = at(t, 5.1, 15), q = at(t, 5.3, 25);
		a.limb([p.x, p.z, 15], [q.x, q.z, 25], t ? 0.42 : 0.32, 'leg', true);
	}
}
function tapizada(a) {
	a.put(rbox(12.6, 6, 12.6, 2.2), 'chair', 0, 0, 11);
	for (const [dx, dy] of ESQUINAS) { a.put(cyl(0.6, 8, 8, 0.45), 'leg', dx * 4.8, dy * 4.8, 4); }
	a.put(rbox(11.4, 2.4, 11.4, 1.1), 'cushion', -0.6, 0, 15.2);
	a.put(rbox(3.6, 18, 12.6, 1.7), 'chair', 4.7, 0, 21.5, 0, 0, -0.12);
}
// Banqueta de barra o de mesa alta: base, parante, aro para los pies y cojin.
function banqueta(a, asiento, aro) {
	a.put(cyl(5, 0.8, 24), 'metal', 0, 0, 0.4);
	a.put(cyl(0.9, asiento - 0.5, 10), 'metal', 0, 0, asiento / 2 + 0.25);
	a.put(new THREE.TorusGeometry(3.6, 0.35, 8, 24), 'metal', 0, 0, aro, 0, Math.PI / 2);
	a.put(plantillas().COJIN_BANQUETA, 'cushion', 0, 0, asiento);
}
const SILLAS = { sillon, clasica, bistro, tapizada };

// Cada modelo se arma una vez en su origen y luego se copia a cada puesto.
const modelos = new Map();
function modeloDe(clave, armar) {
	if (!modelos.has(clave)) {
		const a = crearArmador();
		armar(a);
		modelos.set(clave, a.tomar());
	}
	return modelos.get(clave);
}

// ---------------------------------------------------------------- puestos

/** Cuantas sillas van en cada lado: por turnos dentro de cada grupo hasta llenar el lado; si sobran, en todos. */
function repartir(grupos, capacidad, n) {
	const cuenta = Object.fromEntries(VUELTA.map(l => [l, 0]));
	let quedan = n;
	for (const grupo of grupos) {
		let puso = true;
		while (quedan > 0 && puso) {
			puso = false;
			for (const lado of grupo) {
				if (quedan > 0 && cuenta[lado] < capacidad[lado]) { cuenta[lado]++; quedan--; puso = true; }
			}
		}
	}
	const todos = grupos.flat();
	for (let i = 0; quedan > 0; i++, quedan--) { cuenta[todos[i % todos.length]]++; }
	return cuenta;
}

/** Puestos de una mesa rectangular sin girar, centrada en el origen, en orden alrededor. */
function enRectangulo(f, n) {
	const largoDe = l => (l === '-y' || l === '+y' ? f.ancho : f.fondo);
	const capacidad = Object.fromEntries(VUELTA.map(l => [l, Math.max(1, Math.floor(largoDe(l) / SILLA_ANCHO))]));
	const cuenta = repartir(f.grupos, capacidad, n);
	const puestos = [];
	for (const lado of VUELTA) {
		const [ox, oy] = LADOS[lado], largo = largoDe(lado);
		const dist = (ox ? f.ancho : f.fondo) / 2 + SEP_SILLA;
		for (let k = 0; k < cuenta[lado]; k++) {
			const t = ((k + 0.5) * largo) / cuenta[lado] - largo / 2;
			// a lo largo del lado, en el sentido de la vuelta
			const [x, y] = { '-y': [t, -dist], '+x': [dist, t], '+y': [-t, dist], '-x': [-dist, -t] }[lado];
			puestos.push({ x, y, ox, oy });
		}
	}
	return puestos;
}

function enCirculo(radio, n) {
	return Array.from({ length: n }, (_, i) => {
		const fi = -Math.PI / 2 + (i * 2 * Math.PI) / n;
		return { x: radio * Math.cos(fi), y: radio * Math.sin(fi), ox: Math.cos(fi), oy: Math.sin(fi) };
	});
}

/**
 * Donde va cada silla de una mesa: centro de la silla y hacia afuera (donde va el respaldo), ya girada y en el
 * centro (cx, cy) de la mesa. ang = giro del mundo que lleva el +x local de una silla hacia afuera.
 * @returns {{x: number, y: number, ox: number, oy: number, ang: number}[]} en orden alrededor de la mesa
 */
export function puestosDe(forma, n, giroGrados = 0, cx = 0, cy = 0) {
	const f = FORMA3D[forma];
	const locales = f.radio ? enCirculo(f.radio + f.sep, n) : enRectangulo(f, n);
	const g = (giroGrados * Math.PI) / 180, c = Math.cos(g), s = Math.sin(g);
	return locales.map(({ x, y, ox, oy }) => {
		const rox = ox * c - oy * s, roy = ox * s + oy * c;
		return { x: cx + x * c - y * s, y: cy + x * s + y * c, ox: rox, oy: roy, ang: Math.atan2(-roy, rox) };
	});
}

/** Centro de una pieza en el mundo y su tamaño sin girar (ancho a lo largo de su x local). */
function marcoDe(pz) {
	const h = huellaDe(pz), sinGiro = huellaDe({ ...pz, giro: 0 });
	return {
		cx: (pz.x + h.ancho / 2) * CUADRO, cy: (pz.y + h.fondo / 2) * CUADRO,
		w: h.ancho * CUADRO, d: h.fondo * CUADRO, wLocal: sinGiro.ancho * CUADRO, dLocal: sinGiro.fondo * CUADRO,
	};
}

/**
 * Lo que la escena necesita de cada mesa del plano: centro, huella (girada), alto del tablero, sus sillas (puestos)
 * y donde irian los platos si la mesa no tiene sillas (lugares).
 */
export function mesaDePieza(pz) {
	const f = FORMA3D[pz.forma], { cx, cy, w, d } = marcoDe(pz);
	const sillas = pz.sillas ?? f.sillas;
	return {
		codigo: pz.codigo, clave: claveMesa(pz.codigo), forma: pz.forma, cx, cy, w, d, alto: f.alto,
		hacia: f.hacia, lateral: f.lateral, sinUbicar: false,
		puestos: puestosDe(pz.forma, sillas, pz.giro, cx, cy),
		lugares: sillas ? [] : puestosDe(pz.forma, f.sillas, pz.giro, cx, cy),
	};
}

/** Mesa "sin ubicar" (§6.3): solo su contorno, del tamaño de una cuadrada, en x, y cuadros. */
export function mesaSinUbicar(codigo, x, y) {
	const m = mesaDePieza({ t: 'mesa', forma: 'cuadrada', codigo, x, y, giro: 0, sillas: 0 });
	return { ...m, sinUbicar: true, lugares: [] };
}

// ---------------------------------------------------------------- local y piezas

/** Tramos de pared entre desde y hasta que no caen en un hueco de entrada. */
function tramos(desde, hasta, huecos) {
	const r = [];
	let x = desde;
	for (const [h0, h1] of [...huecos].sort((p, q) => p[0] - q[0])) {
		if (h0 > x) { r.push([x, h0]); }
		x = Math.max(x, h1);
	}
	if (x < hasta) { r.push([x, hasta]); }
	return r.filter(([p, q]) => q - p > 0.5);
}

// Paredes del local: fondo y costados altos, la delantera baja (vista de maqueta). Una entrada pegada a un borde
// abre su hueco en esa pared.
function paredesDelLocal(a, plano) {
	const PW = plano.ancho * CUADRO, PD = plano.fondo * CUADRO;
	const huecos = { atras: [], frente: [], izq: [], der: [] };
	for (const pz of plano.piezas.filter(p => p.t === 'entrada')) {
		const h = huellaDe(pz);
		const enX = [pz.x * CUADRO, (pz.x + h.ancho) * CUADRO], enY = [pz.y * CUADRO, (pz.y + h.fondo) * CUADRO];
		if (pz.y <= 1) { huecos.atras.push(enX); }
		if (pz.y + h.fondo >= plano.fondo - 1) { huecos.frente.push(enX); }
		if (pz.x <= 1) { huecos.izq.push(enY); }
		if (pz.x + h.ancho >= plano.ancho - 1) { huecos.der.push(enY); }
	}
	const pared = (w, h, d) => rbox(w, h, d, 2.5);
	for (const [p, q] of tramos(-WT, PW + WT, huecos.atras)) { a.put(pared(q - p, WH, WT), 'wall', (p + q) / 2, -WT / 2, WH / 2); }
	for (const [p, q] of tramos(-WT, PW + WT, huecos.frente)) { a.put(pared(q - p, WH_FRENTE, WT), 'wall', (p + q) / 2, PD + WT / 2, WH_FRENTE / 2); }
	for (const [p, q] of tramos(0, PD, huecos.izq)) { a.put(pared(WT, WH, q - p), 'wall', -WT / 2, (p + q) / 2, WH / 2); }
	for (const [p, q] of tramos(0, PD, huecos.der)) { a.put(pared(WT, WH, q - p), 'wall', PW + WT / 2, (p + q) / 2, WH / 2); }
}

// Cada pieza se arma centrada en su origen, sin girar: w a lo largo de su x local, d de su y local.
function mesa(a, w, d, pz) {
	const g = plantillas();
	if (pz.forma === 'redonda') {
		a.put(cyl(18, 2.6, 56, 17.6), 'wood', 0, 0, TH - 1.3);
		a.put(g.PED, 'leg', 0, 0, 0);
		return;
	}
	if (pz.forma === 'alta') {
		const alto = FORMA3D.alta.alto;
		a.put(cyl(9, 2.4, 40, 8.7), 'wood', 0, 0, alto - 1.2);
		a.put(g.PED_ALTA, 'leg', 0, 0, 0);
		return;
	}
	const f = FORMA3D[pz.forma];
	a.put(rbox(f.ancho, 2.6, f.fondo, 1.2), 'wood', 0, 0, TH - 1.3);
	a.put(rbox(f.ancho - 4, 2.4, f.fondo - 4, 0.4), 'wood', 0, 0, TH - 3.6);   // faldon
	for (const [dx, dy] of ESQUINAS) { a.put(g.TLEG, 'leg', dx * (f.ancho / 2 - 3), dy * (f.fondo / 2 - 3), (TH - 3) / 2); }
}

// Barra, toda dentro de su huella (d = 90) y sin salirse por las puntas. De atras (-y) hacia adelante: repisa de
// botellas, pasillo del barman, mueble con mostrador y banquetas; las separaciones son las del prototipo.
function barra(a, w, d, pz, rnd) {
	const g = plantillas(), x0 = -w / 2;
	const yRepisa = -d / 2 + 8, yMostrador = yRepisa + 39, yBanqueta = yMostrador + 34;
	a.put(rbox(w - 8, 34, 22, 2), 'wall', 0, yMostrador + 1, 17);
	a.put(rbox(w, 3, 30, 1.4), 'bar', 0, yMostrador, 35.5);
	a.put(cyl(0.7, w - 8, 10), 'metal', 0, yMostrador + 16, 6, 0, 0, Math.PI / 2);   // reposapies
	a.put(rbox(w, 30, 14, 1), 'wall', 0, yRepisa, 15);
	for (let x = x0 + 15; x < -x0 - 15; x += 22) { a.put(g.BOTTLE, pick(['bottleG', 'bottleA', 'bottleA'], rnd), x, yRepisa, 30); }
	if (w >= 60) {   // maquina de cafe
		a.put(rbox(16, 12, 10, 1.5), 'metal', x0 + 40, yMostrador - 2, 43);
		a.put(rbox(4, 1, 4, 0.4), 'dark', x0 + 36, yMostrador + 2, 37.5);
	}
	for (let x = x0 + 40; x <= -x0 - 40; x += 60) {   // lamparas colgantes
		a.put(cyl(0.15, 22, 6), 'dark', x, yMostrador, 68);
		a.put(lathe([[0, 0], [4.5, 0], [3.2, 2.4], [0.8, 4.6], [0, 4.6]], 24), 'dark', x, yMostrador, 54.5);
		a.put(new THREE.SphereGeometry(1.2, 6, 5), 'candle', x, yMostrador, 54.3);
	}
	// banquetas cada 30, centradas; cada una mide ~12.4 de ancho
	const taburete = modeloDe('banqueta-barra', m => banqueta(m, 22.5, 8));
	const n = w >= 13 ? Math.floor((w - 13) / 30) + 1 : 0;
	for (let i = 0; i < n; i++) { a.en((i - (n - 1) / 2) * 30, yBanqueta, 0, 0, () => a.copiar(taburete)); }
}

// Caja con monitor (mirando a +x) e impresora.
function caja(a) {
	a.put(rbox(28, 32, 58, 2), 'wall', 0, 0, 16);
	a.put(rbox(30, 1.6, 60, 0.6), 'bar', 0, 0, 32.8);
	a.put(cyl(2.4, 0.6, 16), 'dark', 0, 4, 33.9);
	a.put(cyl(0.6, 6, 8), 'dark', 0, 4, 37);
	a.put(rbox(1.2, 11, 16, 0.6), 'dark', 1.5, 4, 43, 0, 0, -0.25);
	a.put(new THREE.BoxGeometry(0.2, 9.6, 14.6), 'screen', 2.2, 4, 43, 0, 0, -0.25);
	a.put(rbox(7, 4.5, 7, 1), 'dark', -2, -14, 36);
}

function planta(a, w, d, pz) {
	const g = plantillas();
	a.put(g.POT, 'pot', 0, 0, 0);
	if (pz.talla === 'alta') {   // ficus
		a.limb([0, 0, 11], [1, 0, 40], 0.9, 'trunk');
		a.limb([0.5, 0, 30], [-5, 2, 38], 0.6, 'trunk');
		for (const [dx, dy, z, r] of [[1, 0, 50, 8], [-5, 2, 44, 6.5], [5, -3, 45, 6.5], [0, 5, 46, 6], [-2, -5, 49, 6], [3, 3, 55, 5.5]]) {
			a.put(new THREE.IcosahedronGeometry(r, 2), r > 7 ? 'leaf2' : 'leaf', dx, dy, z);
		}
		return;
	}
	a.put(cyl(6.2, 0.5, 20), 'soil', 0, 0, 11);
	for (const [dx, dy, z, r, mat] of [[0, 0, 24, 7, 'leaf'], [-5, 3, 19, 5.5, 'leaf2'], [5, -2, 20, 6, 'leaf'], [2, 5, 27, 5, 'leaf2'], [-3, -4, 27, 5.5, 'leaf'], [4, 4, 17, 4.5, 'leaf2'], [-5, -3, 16, 4.5, 'leaf'], [0, 0, 31, 4.5, 'leaf2']]) {
		a.put(new THREE.IcosahedronGeometry(r, 2), mat, dx, dy, z);
	}
}

// Jardinera divisoria: cajon oscuro con piedritas y hojas largas en punta (sansevieria) en dos filas a lo largo.
function jardinera(a, w, d, pz, rnd) {
	const alto = 16, cw = w - 2, cd = Math.max(6, d - 4);
	a.put(rbox(cw, alto, cd, 1.2), 'dark', 0, 0, alto / 2);
	a.put(rbox(cw - 2, 0.6, cd - 2, 0.3), 'pot', 0, 0, alto + 0.1);   // piedritas
	const hojas = [18, 23, 28, 32].map(h => new THREE.ConeGeometry(2, h, 4));
	for (let x = -cw / 2 + 2.5; x <= cw / 2 - 2.5; x += 3.2) {
		for (const fila of [-1, 1]) {
			const hoja = hojas[Math.floor(rnd() * hojas.length)];
			a.put(hoja, rnd() < 0.5 ? 'leaf' : 'leaf2', x + (rnd() - 0.5) * 1.6, fila * cd * 0.2 + (rnd() - 0.5) * 1.5,
				alto + hoja.parameters.height / 2, rnd() * Math.PI, (rnd() - 0.5) * 0.3, (rnd() - 0.5) * 0.3);
		}
	}
}

// Sofa: base sobre patitas, cojines, respaldo detras (-y) y brazos.
function sofa(a, w, d) {
	a.put(rbox(w, 7, d, 2.5), 'chair', 0, 0, 7.5);
	for (const [dx, dy] of ESQUINAS) { a.put(cyl(0.8, 4, 8), 'leg', dx * (w / 2 - 3), dy * (d / 2 - 3), 2); }
	const n = Math.max(1, Math.round((w - 8) / 20)), ancho = (w - 8) / n;
	for (let i = 0; i < n; i++) { a.put(rbox(ancho - 1, 3, d - 6, 1.4), 'cushion', -w / 2 + 4 + ancho * (i + 0.5), 1.5, 12.5); }
	a.put(rbox(w, 12, 5, 2), 'chair', 0, -d / 2 + 2.5, 17);
	for (const s of [-1, 1]) { a.put(rbox(4, 9, d, 1.6), 'chair', s * (w / 2 - 2), 0, 14); }
}

const PIEZAS = {
	mesa,
	barra,
	caja,
	planta,
	sofa,
	jardinera,
	alfombra: (a, w, d, pz) => a.put(rbox(w, 0.6, d, 0.3), `alfombra:${pz.color || '#8b8580'}`, 0, 0, 0.3),
	biombo: (a, w) => a.put(rbox(w, 44, 4, 1.6), 'wood', 0, 0, 22),
	pared: (a, w) => a.put(rbox(w, ALTO_PARED, 8, 2.5), 'wall', 0, 0, ALTO_PARED / 2),
	columna: (a, w, d) => a.put(rbox(w - 4, ALTO_COLUMNA, d - 4, 2.5), 'wall', 0, 0, ALTO_COLUMNA / 2),
	entrada: (a, w, d) => a.put(rbox(w - 6, 0.8, d - 2, 0.4), 'dark', 0, 0, 0.4),   // felpudo
};

/**
 * Todo lo fijo del salon: piso, paredes, piezas del plano (mesas sin sillas) y las banquetas de las mesas altas.
 * @param {object[]} mesas mesaDePieza de cada mesa del plano
 */
export function armarSala(a, plano, mesas) {
	const PW = plano.ancho * CUADRO, PD = plano.fondo * CUADRO;
	const rnd = aleatorio(7);
	a.put(new THREE.BoxGeometry(PW, 6, PD), 'floor', PW / 2, PD / 2, -3);
	paredesDelLocal(a, plano);
	for (const pz of plano.piezas) {
		const { cx, cy, wLocal, dLocal } = marcoDe(pz);
		a.en(cx, cy, (-pz.giro * Math.PI) / 180, 0, () => PIEZAS[pz.t](a, wLocal, dLocal, pz, rnd));
	}
	const taburete = modeloDe('banqueta-alta', m => banqueta(m, ASIENTO_ALTO, ARO_ALTO));
	for (const m of mesas.filter(x => x.forma === 'alta')) {
		for (const s of m.puestos) { a.en(s.x, s.y, s.ang, 0, () => a.copiar(taburete)); }
	}
}

/** Sillas del modelo elegido en todos los puestos (las mesas altas llevan banquetas, que van con la sala). */
export function armarSillas(a, mesas, modelo) {
	const nombre = SILLAS[modelo] ? modelo : 'sillon';
	const silla = modeloDe(nombre, SILLAS[nombre]);
	for (const m of mesas.filter(x => x.forma !== 'alta')) {
		for (const s of m.puestos) { a.en(s.x, s.y, s.ang, 0, () => a.copiar(silla)); }
	}
}

// ---------------------------------------------------------------- personas y lo que hay sobre la mesa

/** Ropa y piel de la persona i (la misma en la persona fija y en la animada de actores3d.js). */
export function ropaDe(i) {
	return { tela: 'c' + (i % 6), piel: ['skin', 'skin1', 'skin2'][i % 3] };
}

// Persona sentada en su origen mirando hacia -x (la mesa); i elige ropa, piel, pelo y peinado. sinBrazo: sin el
// brazo del lado s = 1 (actores3d.js lo arma aparte para moverlo).
export function persona(a, i, sinBrazo = false) {
	const [fx, fy] = [-1, 0], [sx, sy] = [0, -1];   // hacia la mesa y costado
	const { tela, piel } = ropaDe(i), pelo = ['hair', 'hair1', 'hair2', 'hair'][(i * 7) % 4];
	const pantalon = i % 3 ? 'pants' : 'pants1';
	const p = (f, s, z) => [fx * f + sx * s, fy * f + sy * s, z];
	a.limb(p(-1.5, 0, 18.5), p(0.6, 0, 29.5), 4.3, tela);   // torso apenas inclinado hacia la mesa
	for (const s of [-1, 1]) { a.put(new THREE.SphereGeometry(2.1, 8, 6), tela, ...p(0.4, s * 4.2, 30.6)); }   // hombros
	a.limb(p(0.7, 0, 32), p(0.9, 0, 34.5), 1.5, piel);   // cuello
	a.put(new THREE.SphereGeometry(3.3, 12, 9), piel, ...p(1.2, 0, 37.4));
	a.put(new THREE.SphereGeometry(3.5, 12, 9, 0, Math.PI * 2, 0, Math.PI * 0.52), pelo, ...p(0.8, 0, 37.8));
	const peinado = i % 4;
	if (peinado === 1) { a.limb(p(-1.6, 0, 37.5), p(-1.9, 0, 31.5), 2.8, pelo); }   // pelo largo
	if (peinado === 2) { a.put(new THREE.SphereGeometry(1.8, 7, 6), pelo, ...p(-1.8, 0, 40)); }   // moño
	for (const s of [-1, 1]) {
		if (!(sinBrazo && s === 1)) {
			a.limb(p(0.6, s * 4.8, 30), p(4.5, s * 5.6, 23.5), 1.5, tela);   // brazo
			a.limb(p(4.5, s * 5.6, 23.5), p(11.5, s * 3.4, TH + 1.4), 1.3, tela);   // antebrazo sobre la mesa
			a.put(new THREE.SphereGeometry(1.3, 7, 5), piel, ...p(12.3, s * 3.2, TH + 1.4));
		}
		a.limb(p(-0.5, s * 2.4, 16.8), p(8.5, s * 2.6, 16.8), 2.2, pantalon);   // muslo
		a.limb(p(8.5, s * 2.6, 16.8), p(9.5, s * 2.6, 2.4), 1.8, pantalon);   // pierna
		a.put(rbox(3.2, 2, 5.2, 0.9, 1), 'shoe', ...p(10.6, s * 2.6, 1), Math.atan2(fx, fy));
	}
}

// Plato servido: varia el plato segun el puesto.
function plato(a, px, py, h, rnd) {
	a.put(plantillas().PLATE, 'plate', px, py, h);
	const k = Math.floor(rnd() * 4);
	if (k === 0) { a.put(new THREE.SphereGeometry(2.4, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 'f0', px, py, h + 0.4); }
	if (k === 1) {
		for (const [dx, dy, mat] of [[-1, -0.6, 'f1'], [1, -0.4, 'f1'], [0.2, 1, 'f4'], [-0.6, 0.9, 'f1']]) {
			a.put(new THREE.IcosahedronGeometry(1.3, 1), mat, px + dx, py + dy, h + 1);
		}
	}
	if (k === 2) {
		a.put(rbox(4, 1.2, 2.6, 0.5), 'f2', px - 0.6, py, h + 1);
		a.put(new THREE.SphereGeometry(1.6, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), 'f3', px + 1.6, py + 1, h + 0.4);
	}
	if (k === 3) {
		a.put(new THREE.SphereGeometry(2.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), 'f3', px, py, h + 0.4);
		a.put(new THREE.IcosahedronGeometry(1, 1), 'f1', px + 1.2, py - 1, h + 1.6);
	}
}
function vaso(a, gx, gy, h, rnd) {
	a.put(plantillas().GLASS, 'glass', gx, gy, h);
	a.put(cyl(1.05, 3.2, 14, 0.95), pick(['wine', 'juice', 'soda', 'juice'], rnd), gx, gy, h + 2);
}

// Contorno punteado en el piso (mesa sin ubicar).
function contorno(a, cx, cy, w, d) {
	const g = plantillas(), W = w + 4, D = d + 4;
	// trazos centrados en cada lado, uno cada ~7, sin tocar las esquinas
	const marcas = L => { const n = Math.max(1, Math.floor(L / 7)); return Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * (L / n)); };
	for (const t of marcas(W)) {
		for (const s of [-1, 1]) { a.put(g.TRAZO_X, 'linea', cx + t, cy + (s * D) / 2, 0.2); }
	}
	for (const t of marcas(D)) {
		for (const s of [-1, 1]) { a.put(g.TRAZO_Y, 'linea', cx + (s * W) / 2, cy + t, 0.2); }
	}
}

/** Indices de n puestos de S repartidos alrededor de la mesa (2 de 4 quedan enfrentados). */
const repartidos = (S, n) => Array.from({ length: Math.min(n, S) }, (_, i) => Math.floor((i * S) / Math.min(n, S)));

/**
 * Lo que cambia por estado en una mesa: personas, platos y vasos, botella, portacuenta, cartelito de reserva y
 * contorno de sin ubicar (dibujoDe de escena.js). La persona y el plato de un mismo puesto van juntos.
 */
export function armarOcupantes(a, mesa, dibujo) {
	const sem = hashTexto(mesa.clave), rnd = aleatorio(sem);
	const { cx, cy, alto } = mesa;
	if (dibujo.contorno) { contorno(a, cx, cy, mesa.w, mesa.d); }
	for (const i of repartidos(mesa.puestos.length, dibujo.gente)) {
		if (dibujo.actor && i === 0) { continue; }   // el puesto 0 lo ocupa la persona animada (actores3d.js)
		const s = mesa.puestos[i];
		a.en(s.x, s.y, s.ang, alto - TH, () => persona(a, sem + i));
	}
	const lugares = mesa.puestos.length ? mesa.puestos : mesa.lugares;
	for (const i of repartidos(lugares.length, dibujo.platos)) {
		const s = lugares[i];
		const px = s.x - s.ox * mesa.hacia, py = s.y - s.oy * mesa.hacia;
		plato(a, px, py, alto, rnd);
		vaso(a, px - s.oy * mesa.lateral + s.ox * 1.3, py + s.ox * mesa.lateral + s.oy * 1.3, alto, rnd);
	}
	if (dibujo.botella) { a.put(plantillas().BOTTLE, pick(['bottleG', 'bottleA'], rnd), cx + 3, cy - 3, alto); }
	if (dibujo.cuenta) { a.put(rbox(4, 0.8, 6.5, 0.3), 'dark', cx - 3, cy + 3, alto + 0.4); }   // portacuenta
	if (dibujo.cartel) {   // cartelito de reserva: dos tapas que se apoyan
		a.put(new THREE.BoxGeometry(5, 3.6, 0.3), 'plate', cx - 4, cy - 4, alto + 1.6, 0, 0.35);
		a.put(new THREE.BoxGeometry(5, 3.6, 0.3), 'plate', cx - 4, cy - 5.2, alto + 1.6, 0, -0.35);
	}
}

// ---------------------------------------------------------------- juntar

// Todo sin indice y con los mismos atributos: mergeGeometries exige que coincidan.
function limpia(g) {
	const n = g.index ? g.toNonIndexed() : g;
	for (const k of Object.keys(n.attributes)) {
		if (!['position', 'normal', 'uv'].includes(k)) { n.deleteAttribute(k); }
	}
	return n;
}
function unir(lista) {
	const geo = mergeGeometries(lista);
	if (!geo) { throw new Error('maqueta: no se pudo juntar la geometria'); }
	return geo;
}

/** Una geometria por material: pocas llamadas de dibujo. */
export function juntarPorMaterial(cubo) {
	return Object.entries(cubo).map(([mat, lista]) => ({ mat, geo: unir(lista.map(limpia)) }));
}

// Lo de las mesas cambia por mesa: en vez de una malla por material (decenas por mesa), el color va en cada vertice
// y se junta en tres clases segun el brillo; la escena las dibuja con un material blanco de esa clase.
const CLASE = { glass: 'vidrio', plate: 'brillo', wine: 'brillo', juice: 'brillo', soda: 'brillo', bottleG: 'brillo', bottleA: 'brillo' };

/** Una geometria por clase (mate, brillo, vidrio) con el color de cada material en sus vertices. */
export function juntarPorClase(cubo, MAT) {
	const porClase = {};
	for (const [mat, lista] of Object.entries(cubo)) {
		const { r, g, b } = MAT[mat].color;
		for (const geo of lista) {
			const n = limpia(geo), cuantos = n.attributes.position.count, color = new Float32Array(cuantos * 3);
			for (let i = 0; i < cuantos; i++) { color[i * 3] = r; color[i * 3 + 1] = g; color[i * 3 + 2] = b; }
			n.setAttribute('color', new THREE.BufferAttribute(color, 3));
			(porClase[CLASE[mat] || 'mate'] ||= []).push(n);
		}
	}
	return Object.entries(porClase).map(([clase, lista]) => ({ clase, geo: unir(lista) }));
}
