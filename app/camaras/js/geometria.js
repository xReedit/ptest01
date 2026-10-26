// Geometria de las mesas marcadas sobre la foto. Sin DOM: se prueba en Node.
// Todo punto va normalizado [x, y] en 0..1 sobre la foto (0,0 arriba a la izquierda), igual que lo guarda el
// servidor y lo usa el motor: asi la mesa queda en su sitio con cualquier tamaño de pantalla o de foto.

const MIN_PUNTOS = 3;
const MAX_PUNTOS = 30;
const BORDE = 1e-9;   // tolerancia para "esta sobre la linea" (en unidades 0..1)

const redondear = v => Math.round(v * 1e4) / 1e4;   // 4 decimales: menos de un pixel en una foto de 1920
const recortar = v => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Pixeles del lienzo → [nx, ny] en 0..1 (recortado: un clic en el borde o fuera queda en 0 o 1). */
export function normalizar([x, y], ancho, alto) {
	const n = (v, total) => (total > 0 ? redondear(recortar(v / total)) : 0);
	return [n(x, ancho), n(y, alto)];
}

const esPunto = p => Array.isArray(p) && p.length === 2 && p.every(v => typeof v === 'number' && v >= 0 && v <= 1);

/** Lo que acepta el servidor: de 3 a 30 puntos [x, y], cada coordenada un numero en 0..1. */
export function poligonoValido(poligono) {
	return Array.isArray(poligono) && poligono.length >= MIN_PUNTOS && poligono.length <= MAX_PUNTOS && poligono.every(esPunto);
}

/** true si p esta sobre el segmento a-b (con una tolerancia minima). */
function enSegmento([px, py], [ax, ay], [bx, by]) {
	const cruz = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
	if (Math.abs(cruz) > BORDE) { return false; }
	return px >= Math.min(ax, bx) - BORDE && px <= Math.max(ax, bx) + BORDE
		&& py >= Math.min(ay, by) - BORDE && py <= Math.max(ay, by) + BORDE;
}

/**
 * true si el punto cae dentro de la mesa. En el borde o en una esquina cuenta como dentro (un clic justo en la
 * linea elige la mesa). Sirve para poligonos concavos (rayo horizontal). Con menos de 3 puntos, nunca.
 */
export function puntoEnPoligono(p, poligono) {
	if (!Array.isArray(poligono) || poligono.length < MIN_PUNTOS) { return false; }
	const [x, y] = p;
	let dentro = false;
	for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
		const a = poligono[i];
		const b = poligono[j];
		if (enSegmento(p, a, b)) { return true; }
		if ((a[1] > y) !== (b[1] > y) && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]) { dentro = !dentro; }
	}
	return dentro;
}

/** Promedio de las esquinas: donde se escribe el numero de la mesa. [0, 0] si no hay puntos. */
export function centro(poligono) {
	if (!Array.isArray(poligono) || !poligono.length) { return [0, 0]; }
	const suma = poligono.reduce((s, [x, y]) => [s[0] + x, s[1] + y], [0, 0]);
	return [redondear(suma[0] / poligono.length), redondear(suma[1] / poligono.length)];
}
