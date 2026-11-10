// Persona animada de una mesa con aviso de la carta virtual (avisos-mesa.js → escena.setActores): ocupa el puesto 0
// (la persona fija de ese puesto no se dibuja, piezas3d.js armarOcupantes con dibujo.actor) y mueve el brazo derecho:
//   llamado   → levanta la mano y la agita (saluda / llama la atencion)
//   pedido    → acerca y aleja el celular del QR de la mesa (tambien 'confirmar': pidio por QR y espera)
//   pago      → muestra la tarjeta o los billetes en alto
// El cuerpo va junto (pocas mallas); el brazo es una cadena hombro → codo → mano que se gira en cada cuadro.
// Coordenadas del armador (piezas3d.js): [adelante/costado del plano, ..., alto]; en Three: x, alto, y.
import * as THREE from '../vendor/three-0.170.0/build/three.module.js';
import { crearArmador, juntarPorClase, persona, ropaDe, hashTexto, ALTO_MESA } from './piezas3d.js?v=20261102m';

export const TIPOS_ACTOR = ['llamado', 'pedido', 'confirmar', 'pago'];
const RAD = Math.PI / 180;
// Hombro del lado s = 1 de persona() (p(0.6, 4.8, 30) → Three: x = -0.6, alto 30, z = -4.8). Largo de brazo y antebrazo.
const HOMBRO = [-0.6, 30, -4.8], BRAZO = 7.6, ANTEBRAZO = 7.4;
const PROP = 1.6;   // celular, tarjeta y billetes mas grandes que en la realidad: la camara los ve de lejos
const COLOR = { celular: '#1f2933', pantalla: '#8ec5ff', tarjeta: '#1d4ed8', chip: '#d4a72c', billete: '#3f9d5a', qr: '#ffffff', qrBase: '#2b2b30' };

// ---------------------------------------------------------------- poses (puras: angulos en grados segun el tiempo)

/**
 * Giro del hombro (x: hacia el costado, z: hacia adelante) y del codo para el tipo en el segundo t. Puro.
 * Brazo colgando = 0; z negativo lo lleva hacia la mesa; x positivo lo levanta por el costado.
 */
export function pose(tipo, t) {
	const onda = f => Math.sin(t * 2 * Math.PI * f);
	if (tipo === 'llamado') { return { hx: 150 + 6 * onda(0.8), hz: -10, cx: 18 + 32 * onda(1.6), cz: 0 }; }
	// pago: brazo adelante y arriba, la tarjeta o los billetes se agitan de lado a lado (se ve desde arriba)
	if (tipo === 'pago') { return { hx: 22 * onda(1.2), hz: -120 + 8 * onda(2.4), cx: 0, cz: -15 }; }
	// pedido / confirmar: el celular va de la cara al QR y vuelve
	return { hx: 0, hz: -58 + 24 * onda(0.6), cx: 0, cz: -48 + 28 * onda(0.6) };
}

// ---------------------------------------------------------------- piezas

function mallaDe(armar, R) {
	const a = crearArmador(0, 0);
	armar(a);
	const g = new THREE.Group();
	for (const { clase, geo } of juntarPorClase(a.tomar(), R.MAT)) {
		const m = new THREE.Mesh(geo, R.OCUP[clase]);
		m.castShadow = true;
		m.receiveShadow = true;
		g.add(m);
	}
	return g;
}
const caja = (w, h, d, color, mats) => {
	const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
	mats.push(mat);
	return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
};

/** Textura de un QR de mentira (cuadros fijos por semilla): blanco con modulos negros y los 3 ojos. */
function texturaQr(semilla) {
	if (typeof document === 'undefined') { return null; }   // sin DOM (pruebas): cartel blanco
	const n = 21, px = 6, c = document.createElement('canvas');
	c.width = c.height = n * px;
	const g = c.getContext('2d');
	g.fillStyle = '#fff';
	g.fillRect(0, 0, c.width, c.height);
	g.fillStyle = '#111';
	let r = semilla || 1;
	const azar = () => { r = (Math.imul(r, 1103515245) + 12345) >>> 0; return (r >>> 16) / 65536; };
	const ojo = (x, y) => { g.fillRect(x * px, y * px, 7 * px, 7 * px); g.fillStyle = '#fff'; g.fillRect((x + 1) * px, (y + 1) * px, 5 * px, 5 * px); g.fillStyle = '#111'; g.fillRect((x + 2) * px, (y + 2) * px, 3 * px, 3 * px); };
	for (let y = 0; y < n; y++) {
		for (let x = 0; x < n; x++) {
			const enOjo = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
			if (!enOjo && azar() < 0.5) { g.fillRect(x * px, y * px, px, px); }
		}
	}
	ojo(0, 0); ojo(n - 7, 0); ojo(0, n - 7);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	t.magFilter = THREE.NearestFilter;
	return t;
}

/** Cartelito con QR sobre la mesa, frente a la persona (marco local del puesto: -x = hacia la mesa). */
function cartelQr(mesa, semilla, mats, texturas) {
	const tex = texturaQr(semilla);
	if (tex) { texturas.push(tex); }
	const g = new THREE.Group();
	const base = caja(4.6, 0.6, 2.4, COLOR.qrBase, mats);
	const frente = new THREE.MeshStandardMaterial({ map: tex, color: tex ? '#ffffff' : COLOR.qr, roughness: 0.6 });
	mats.push(frente);
	// caras de BoxGeometry: +x, -x, +y, -y, +z, -z; la +x mira a la persona (la mesa queda hacia -x)
	const placa = new THREE.Mesh(new THREE.BoxGeometry(0.35, 4.6, 4.2), [frente, ...Array(5).fill(base.material)]);
	placa.position.set(0, 2.6, 0);
	placa.rotation.z = 10 * RAD;   // apoyada hacia atras: el QR queda mirando a la persona
	base.position.set(0, 0.3, 0);
	g.add(base, placa);
	g.position.set(-(mesa.hacia + 4), ALTO_MESA, HOMBRO[2]);   // frente al brazo que se mueve
	return g;
}

function celular(mats) {
	const g = new THREE.Group();
	const cuerpo = caja(0.5, 4.4, 2.3, COLOR.celular, mats);
	const pantalla = caja(0.08, 3.8, 2, COLOR.pantalla, mats);
	pantalla.material.emissive = new THREE.Color(COLOR.pantalla);
	pantalla.material.emissiveIntensity = 0.9;
	pantalla.position.set(-0.3, 0, 0);   // la pantalla mira hacia el QR (adelante)
	g.add(cuerpo, pantalla);
	g.position.set(0, -2, 0);
	return g;
}
function tarjeta(mats) {
	const g = new THREE.Group();
	const plastico = caja(0.15, 3.6, 2.3, COLOR.tarjeta, mats);
	const chip = caja(0.05, 0.7, 0.55, COLOR.chip, mats);
	chip.position.set(-0.1, 0.6, -0.5);
	g.add(plastico, chip);
	g.position.set(0, -2, 0);
	return g;
}
function billetes(mats) {
	const g = new THREE.Group();
	[-14, 0, 14].forEach((giro, k) => {
		const b = caja(0.08, 4.2, 2.1, COLOR.billete, mats);
		b.rotation.x = giro * RAD;
		b.position.set(k * 0.06, -2.1, 0);
		g.add(b);
	});
	return g;
}

/**
 * Arma la persona animada del puesto 0 de la mesa. null si la mesa no tiene sillas (no hay donde sentarla).
 * @param {object} mesa la de mesaDePieza (puestos, alto, hacia, clave)
 * @param {'llamado'|'pedido'|'confirmar'|'pago'} tipo
 * @param {{MAT: object, OCUP: object}} R materiales de la escena
 * @param {(x: number, y: number) => [number, number]} W plano → mundo
 * @returns {{grupo: THREE.Group, tipo: string, animar: (t: number) => void, liberar: () => void}|null}
 */
export function crearActor(mesa, tipo, R, W) {
	const s = mesa.puestos[0];
	if (!s || !TIPOS_ACTOR.includes(tipo)) { return null; }
	const i = hashTexto(mesa.clave), mats = [], texturas = [];
	const { tela, piel } = ropaDe(i);
	const grupo = new THREE.Group();
	const [wx, wz] = W(s.x, s.y);
	grupo.position.set(wx, mesa.alto - ALTO_MESA, wz);
	grupo.rotation.y = s.ang;
	grupo.add(mallaDe(a => persona(a, i, true), R));

	const hombro = new THREE.Group(), codo = new THREE.Group(), mano = new THREE.Group();
	hombro.position.set(...HOMBRO);
	hombro.rotation.order = 'ZXY';
	hombro.add(mallaDe(a => a.limb([0, 0, 0], [0, 0, -BRAZO], 1.5, tela), R));
	codo.position.set(0, -BRAZO, 0);
	codo.rotation.order = 'ZXY';
	codo.add(mallaDe(a => { a.limb([0, 0, 0], [0, 0, -ANTEBRAZO], 1.3, tela); a.put(new THREE.SphereGeometry(1.35, 8, 6), piel, 0, 0, -ANTEBRAZO - 0.9); }, R));
	mano.position.set(0, -ANTEBRAZO - 1.2, 0);
	if (tipo === 'pago') { mano.add(i % 2 ? tarjeta(mats) : billetes(mats)); }
	if (tipo === 'pedido' || tipo === 'confirmar') { mano.add(celular(mats)); grupo.add(cartelQr(mesa, i, mats, texturas)); }
	mano.scale.setScalar(PROP);
	codo.add(mano);
	hombro.add(codo);
	grupo.add(hombro);
	// el brazo se mueve: su sombra quedaria quieta (las sombras se calculan a pedido)
	hombro.traverse(o => { if (o.isMesh) { o.castShadow = false; } });

	function animar(t) {
		const p = pose(tipo, t);
		hombro.rotation.set(p.hx * RAD, 0, p.hz * RAD);
		codo.rotation.set(p.cx * RAD, 0, p.cz * RAD);
		if (tipo === 'pago') { mano.rotation.y = 18 * RAD * Math.sin(t * 2 * Math.PI * 0.9); }
	}
	animar(0);
	return {
		grupo, tipo, animar,
		liberar() {
			grupo.traverse(o => { if (o.isMesh) { o.geometry.dispose(); } });
			for (const m of mats) { m.dispose(); }
			for (const t of texturas) { t.dispose(); }
			grupo.removeFromParent();
		},
	};
}
