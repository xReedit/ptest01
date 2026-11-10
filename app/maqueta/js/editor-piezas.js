// Reglas puras del editor "Armar salon" (spec docs/superpowers/specs/2026-10-31-maqueta-salon-3d-design.md §6.2):
// la bandeja de piezas, donde cabe una pieza, girar/copiar/sillas/largo, el tamaño del area y "Armar con mis mesas",
// y la cuenta de las manijas (girar y estirar con el mouse: angulo → giro recto, puntero → largo).
// Sin DOM. Todo devuelve objetos nuevos: el plano del editor no se cambia en el lugar (el historial guarda copias).
import { HUELLA, huellaDe, claveMesa, armarConMisMesas } from './plano.js?v=20261102m';

// Las sillas quedan FUERA de la huella de la mesa: una mesa pide AIRE cuadros libres alrededor (como ubicarSinUbicar).
export const AIRE = 2;
export const AREA_MIN = 20, AREA_MAX = 200, PASO_AREA = 5;
export const SILLAS_MAX = 12;
const PASO_LARGO = 2;
// Largo (cuadros) que admite cada pieza alargable: la barra necesita espacio para una banqueta.
const LARGO = { barra: [10, 60], biombo: [2, 60], pared: [2, 60], sofa: [3, 12], jardinera: [3, 60], alfombra: [2, 60] };
const FONDO_ALFOMBRA = [2, 60];   // la alfombra tambien se estira hacia los costados
// "Armar con mis mesas" deja el mismo margen de 6 que plano.js en el fondo.
const MARGEN_ARMAR = 6;
// Piezas que se ven igual giradas: no muestran "Girar".
const SIMETRICAS = ['planta', 'columna', 'alfombra'];   // la alfombra se estira en vez de girar
const FORMAS_REDONDAS = ['redonda', 'alta'];

/**
 * Bandeja de piezas (§6.2), en el orden en que se muestran. pieza = lo que se agrega (sin x, y; la mesa recibe su
 * codigo al soltarla).
 */
export const BANDEJA = Object.freeze([
	{ id: 'cuadrada', grupo: 'Mesas', nombre: 'Mesa cuadrada (4)', pieza: { t: 'mesa', forma: 'cuadrada', sillas: 4 } },
	{ id: 'cuadrada2', grupo: 'Mesas', nombre: 'Mesa para 2', pieza: { t: 'mesa', forma: 'cuadrada2', sillas: 2 } },
	{ id: 'redonda', grupo: 'Mesas', nombre: 'Mesa redonda (4)', pieza: { t: 'mesa', forma: 'redonda', sillas: 4 } },
	{ id: 'larga', grupo: 'Mesas', nombre: 'Mesa larga (6)', pieza: { t: 'mesa', forma: 'larga', sillas: 6 } },
	{ id: 'alta', grupo: 'Mesas', nombre: 'Mesa alta', pieza: { t: 'mesa', forma: 'alta', sillas: 2 } },
	{ id: 'barra', grupo: 'Adornos', nombre: 'Barra con banquetas', pieza: { t: 'barra', largo: HUELLA.barra.ancho } },
	{ id: 'planta', grupo: 'Adornos', nombre: 'Planta', pieza: { t: 'planta', talla: 'normal' } },
	{ id: 'planta-alta', grupo: 'Adornos', nombre: 'Planta alta', pieza: { t: 'planta', talla: 'alta' } },
	{ id: 'alfombra', grupo: 'Adornos', nombre: 'Alfombra', pieza: { t: 'alfombra', largo: 8, fondo: 6, color: '#8b8580' } },
	{ id: 'cesped', grupo: 'Adornos', nombre: 'Césped sintético', pieza: { t: 'alfombra', largo: 10, fondo: 8, color: '#7f8c78' } },
	{ id: 'jardinera', grupo: 'Adornos', nombre: 'Jardinera divisoria', pieza: { t: 'jardinera', largo: HUELLA.jardinera.ancho } },
	{ id: 'biombo', grupo: 'Adornos', nombre: 'Biombo', pieza: { t: 'biombo', largo: HUELLA.biombo.ancho } },
	{ id: 'pared', grupo: 'Adornos', nombre: 'Pared', pieza: { t: 'pared', largo: HUELLA.pared.ancho } },
	{ id: 'columna', grupo: 'Adornos', nombre: 'Columna', pieza: { t: 'columna' } },
	{ id: 'entrada', grupo: 'Adornos', nombre: 'Entrada', pieza: { t: 'entrada' } },
	{ id: 'caja', grupo: 'Adornos', nombre: 'Caja', pieza: { t: 'caja' } },
	{ id: 'sofa', grupo: 'Adornos', nombre: 'Sofá', pieza: { t: 'sofa', largo: HUELLA.sofa.ancho } },
].map(Object.freeze));

/** Pieza nueva de la bandeja en (x, y), con su codigo si es mesa. */
export function piezaDeBandeja(id, x, y, codigo) {
	const item = BANDEJA.find(b => b.id === id);
	if (!item) { throw new RangeError(`maqueta: pieza de bandeja desconocida (${id})`); }
	const pz = { ...item.pieza, x, y, giro: 0 };
	return pz.t === 'mesa' ? { ...pz, codigo } : pz;
}

/** Mesa de la lista "Mesas por colocar": cuadrada de 4, como las de "Armar con mis mesas". */
export const mesaPorColocar = (codigo, x, y) => ({ t: 'mesa', forma: 'cuadrada', codigo, sillas: 4, giro: 0, x, y });

const margenDe = pz => (pz.t === 'mesa' ? AIRE : 0);

/** Lo que una pieza necesita libre: su huella y, si es mesa, el aire de las sillas alrededor. */
export function espacioDe(pz) {
	const h = huellaDe(pz), m = margenDe(pz);
	return { x: pz.x - m, y: pz.y - m, ancho: h.ancho + m * 2, fondo: h.fondo + m * 2 };
}

const seSolapan = (a, b) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.fondo && b.y < a.y + a.fondo;

/**
 * Por que la pieza no puede ir donde esta: 'fuera' (se sale del area), 'choca' (pisa otra pieza) o null si cabe.
 * ignorar = indice de la pieza que se esta moviendo (no choca consigo misma), o un Set de indices (las que se mueven
 * juntas no chocan entre si). La alfombra no choca con nada: va en el piso, debajo de las mesas.
 */
export function problemaEn(plano, pz, ignorar = -1) {
	const e = espacioDe(pz);
	if (e.x < 0 || e.y < 0 || e.x + e.ancho > plano.ancho || e.y + e.fondo > plano.fondo) { return 'fuera'; }
	if (pz.t === 'alfombra') { return null; }
	const fuera = ignorar instanceof Set ? i => ignorar.has(i) : i => i === ignorar;
	const choca = plano.piezas.some((otra, i) => !fuera(i) && otra.t !== 'alfombra' && seSolapan(e, espacioDe(otra)));
	return choca ? 'choca' : null;
}

/**
 * Corrimiento (dx, dy) recortado para que todas las piezas de indices (Set) sigan dentro del area. Sirve con
 * decimales (lo que se ve mientras se arrastra) y con enteros (donde quedan).
 */
export function corrimientoDentro(plano, indices, dx, dy) {
	const es = [...indices].map(i => espacioDe(plano.piezas[i]));
	const x0 = -Math.min(...es.map(e => e.x)), x1 = plano.ancho - Math.max(...es.map(e => e.x + e.ancho));
	const y0 = -Math.min(...es.map(e => e.y)), y1 = plano.fondo - Math.max(...es.map(e => e.y + e.fondo));
	return { dx: Math.max(x0, Math.min(dx, x1)) + 0, dy: Math.max(y0, Math.min(dy, y1)) + 0 };
}

/**
 * Las piezas de indices (Set) corridas (dx, dy) cuadros enteros, juntas. {piezas, problema}: problema es el de la
 * primera que no cabe ('fuera'|'choca') o null.
 */
export function grupoCorrido(plano, indices, dx, dy) {
	const piezas = plano.piezas.map((pz, i) => (indices.has(i) ? { ...pz, x: pz.x + dx, y: pz.y + dy } : pz));
	let problema = null;
	for (const i of indices) { problema = problema || problemaEn(plano, piezas[i], indices); }
	return { piezas, problema };
}

/** Indices de las piezas cuya huella toca el rectangulo r {x, y, ancho, fondo} (en cuadros). */
export function piezasEnMarco(plano, r) {
	return plano.piezas.flatMap((pz, i) => (seSolapan(r, { x: pz.x, y: pz.y, ...huellaDe(pz) }) ? [i] : []));
}

/** La pieza en (x, y) corrida lo justo para quedar dentro del area (si es mas grande que el area, pegada arriba a la izquierda). */
export function dentroDelArea(plano, pz, x, y) {
	const h = huellaDe(pz), m = margenDe(pz);
	const xMax = plano.ancho - h.ancho - m, yMax = plano.fondo - h.fondo - m;
	return { ...pz, x: Math.max(m, Math.min(x, xMax)), y: Math.max(m, Math.min(y, yMax)) };
}

/**
 * Primer lugar libre para la pieza: desde (cerca.x, cerca.y) hacia la derecha y las filas de abajo; si no hay,
 * desde la esquina de arriba a la izquierda. null si el area esta llena.
 */
export function lugarLibre(plano, pz, cerca = { x: 0, y: 0 }) {
	const h = huellaDe(pz);
	const libre = (x, y) => problemaEn(plano, { ...pz, x, y }) === null;
	for (const desde of [cerca, { x: 0, y: 0 }]) {
		for (let y = Math.max(0, desde.y); y + h.fondo <= plano.fondo; y++) {
			for (let x = y === desde.y ? Math.max(0, desde.x) : 0; x + h.ancho <= plano.ancho; x++) {
				if (libre(x, y)) { return { ...pz, x, y }; }
			}
		}
	}
	return null;
}

/** true si girar cambia algo que se vea (no en mesas redondas, plantas ni columnas). */
export const sePuedeGirar = pz => !SIMETRICAS.includes(pz.t) && !(pz.t === 'mesa' && FORMAS_REDONDAS.includes(pz.forma));

/**
 * La pieza girada 90° sobre su centro (la huella se acomoda a cuadros enteros). Medio cuadro se redondea hacia el
 * centro de la vuelta (trunc): cuatro giros la dejan donde estaba.
 */
export function girada(pz) {
	const h = huellaDe(pz);
	const nueva = { ...pz, giro: (pz.giro + 90) % 360 };
	const n = huellaDe(nueva);
	return { ...nueva, x: pz.x + Math.trunc((h.ancho - n.ancho) / 2), y: pz.y + Math.trunc((h.fondo - n.fondo) / 2) };
}

/** Mesa con una silla mas (+1) o menos (-1), entre 0 y SILLAS_MAX. */
export function conSillas(pz, delta) {
	return { ...pz, sillas: Math.max(0, Math.min(SILLAS_MAX, (pz.sillas ?? 0) + delta)) };
}

/** true si la pieza tiene largo que se pueda cambiar (barra, biombo, pared, sofa). */
export const tieneLargo = pz => Object.prototype.hasOwnProperty.call(LARGO, pz.t);

/** Largo actual: el suyo o el de la tabla de huellas. */
export const largoDe = pz => pz.largo ?? HUELLA[pz.t].ancho;

/** Pieza alargada (+1) o acortada (-1) en PASO_LARGO, dentro de su rango. */
export function conLargo(pz, delta) {
	const [min, max] = LARGO[pz.t];
	return { ...pz, largo: Math.max(min, Math.min(max, largoDe(pz) + delta * PASO_LARGO)) };
}

// ---------------------------------------------------------------- girar y estirar con el mouse (manijas de la vista)

// Grados alrededor de un giro recto en los que la pieza se queda quieta en ese giro mientras se arrastra (imán).
export const IMAN_GIRO = 8;

/** a − b en grados, llevado a (−180, 180]: lo que giro el puntero entre dos lecturas de atan2. */
export function difAngulo(a, b) {
	const d = (((a - b) % 360) + 360) % 360;
	return d > 180 ? d - 360 : d;
}

/** El angulo que se dibuja mientras se gira: pegado al multiplo de 90 si esta a menos de umbral grados. */
export function anguloConIman(delta, umbral = IMAN_GIRO) {
	const recto = Math.round(delta / 90) * 90;
	return Math.abs(delta - recto) <= umbral ? recto + 0 : delta;
}

/** Giro del plano (0, 90, 180 o 270) mas cercano a la pieza con giro `giro` girada `delta` grados mas (a la derecha). */
export function giroCercano(giro, delta) {
	return (((giro + Math.round(delta / 90) * 90) % 360) + 360) % 360;
}

/** La pieza con ese giro, girada de a 90° sobre su centro como girada (asi el centro casi no se mueve). */
export function conGiro(pz, giro) {
	let r = pz;
	for (let k = 0; k < 4 && r.giro !== giro; k++) { r = girada(r); }
	if (r.giro !== giro) { throw new RangeError(`maqueta: giro invalido (${giro})`); }
	return r;
}

/** Hacia donde corre el largo con su giro: 'x' a 0° y 180°, 'y' a 90° y 270°. */
export const ejeDelLargo = pz => (pz.giro === 90 || pz.giro === 270 ? 'y' : 'x');

// Manijas para estirar: 'ini'/'fin' cambian el largo; 'ini2'/'fin2' (solo la alfombra) el fondo, en el otro eje.
const campoDe = extremo => (extremo.endsWith('2') ? 'fondo' : 'largo');
const esFin = extremo => extremo.startsWith('fin');

/** Las manijas de estirar que lleva la pieza. */
export const extremosDe = pz => (!tieneLargo(pz) ? [] : pz.t === 'alfombra' ? ['ini', 'fin', 'ini2', 'fin2'] : ['ini', 'fin']);

/** Eje ('x'|'y') sobre el que se mueve esa manija. */
export const ejeDe = (pz, extremo) => {
	const e = ejeDelLargo(pz);
	return campoDe(extremo) === 'largo' ? e : e === 'x' ? 'y' : 'x';
};

/** Lo que mide la pieza en el sentido de esa manija (su largo o su fondo). */
export const medidaDe = (pz, extremo) => (campoDe(extremo) === 'largo' ? largoDe(pz) : pz.fondo ?? HUELLA[pz.t].fondo);

/** La pieza con esa medida en el sentido de la manija (sin mover nada). */
export const conMedida = (pz, extremo, v) => ({ ...pz, [campoDe(extremo)]: v });

/**
 * La pieza con un extremo llevado a pos (cuadros sobre su eje, puede tener decimales) y el otro quieto, con la medida
 * dentro de su rango. extremo 'ini' = el de x (o y) menor: al moverlo cambia x (o y); 'fin' = el otro (y 'ini2'/'fin2'
 * los del fondo de la alfombra). Sin redondear: mientras se arrastra se dibuja asi; con pos entero queda en cuadros.
 */
export function estiradaHasta(pz, extremo, pos) {
	const [min, max] = campoDe(extremo) === 'largo' ? LARGO[pz.t] : FONDO_ALFOMBRA;
	const eje = ejeDe(pz, extremo), ini = pz[eje], fin = ini + medidaDe(pz, extremo);
	const v = Math.max(min, Math.min(max, esFin(extremo) ? pos - ini : fin - pos));
	const r = conMedida(pz, extremo, v);
	return esFin(extremo) ? r : { ...r, [eje]: fin - v };
}

/**
 * Lo que queda al soltar la manija del largo: la pieza con el extremo en el cuadro entero mas cercano a pos; si asi
 * choca o se sale del area, la mas larga que cabe entre esa y la original (se frena contra lo que tiene delante).
 * null si ni la original cabe. ignorar = su indice en el plano.
 */
export function estiradaQueCabe(plano, pz, ignorar, extremo, pos) {
	const eje = ejeDe(pz, extremo), ini = pz[eje], fin = ini + medidaDe(pz, extremo);
	const original = medidaDe(pz, extremo), pedido = medidaDe(estiradaHasta(pz, extremo, Math.round(pos)), extremo);
	const paso = Math.sign(original - pedido);
	for (let largo = pedido; ; largo += paso) {
		const c = estiradaHasta(pz, extremo, esFin(extremo) ? ini + largo : fin - largo);
		if (problemaEn(plano, c, ignorar) === null) { return c; }
		if (largo === original) { return null; }
	}
}

const MARCO_SEL = 0.3;   // cuadros entre la huella y el marco de la pieza elegida (editor-svg)

/**
 * Donde va la manija de girar para que se vea entera y se pueda agarrar: debajo de la pieza (y del aire de sus
 * sillas); si ahi se sale de lo visible, encima; si no, a la derecha, a la izquierda, y si nada entra, en el centro.
 * Todo en cuadros. visible = lo que se ve del escenario {x, y, ancho, fondo}; distancia = del borde a la manija;
 * radio = lo que mide la manija desde su centro.
 * @returns {{lado: 'abajo'|'arriba'|'derecha'|'izquierda'|'dentro', x: number, y: number, tallo: {x: number, y: number}|null}}
 *   x, y = centro de la manija; tallo = donde empieza el palito (en el marco de la pieza), null si va dentro
 */
export function lugarManijaGiro(pz, visible, distancia, radio) {
	const h = huellaDe(pz), e = espacioDe(pz);
	const cx = pz.x + h.ancho / 2, cy = pz.y + h.fondo / 2;
	const izq = pz.x - MARCO_SEL, der = pz.x + h.ancho + MARCO_SEL, arr = pz.y - MARCO_SEL, aba = pz.y + h.fondo + MARCO_SEL;
	const cabe = (x, y) => x - radio >= visible.x && x + radio <= visible.x + visible.ancho
		&& y - radio >= visible.y && y + radio <= visible.y + visible.fondo;
	const lados = [
		['abajo', cx, Math.max(aba, e.y + e.fondo) + distancia, cx, aba],
		['arriba', cx, Math.min(arr, e.y) - distancia, cx, arr],
		['derecha', Math.max(der, e.x + e.ancho) + distancia, cy, der, cy],
		['izquierda', Math.min(izq, e.x) - distancia, cy, izq, cy],
	];
	for (const [lado, x, y, tx, ty] of lados) {
		if (cabe(x, y)) { return { lado, x, y, tallo: { x: tx, y: ty } }; }
	}
	return { lado: 'dentro', x: cx, y: cy, tallo: null };
}

/**
 * Cuantos px correr hacia afuera cada manija del largo (centrada en su extremo) para que entre las dos no tapen mas
 * de los dos tercios de la pieza: el tercio del medio queda libre para arrastrarla. largoPx = largo en la pantalla;
 * zonaPx = lo que mide la zona de agarre de la manija a lo largo. Como mucho media zona (queda toda afuera).
 */
export function empujeManijaLargo(largoPx, zonaPx) {
	return Math.min(zonaPx / 2, Math.max(0, zonaPx / 2 - Math.max(0, largoPx) / 3));
}

/** Codigos del area que aun no tienen mesa en el plano, en su orden. */
export function codigosPorColocar(plano, codigos) {
	const puestas = new Set(plano.piezas.filter(pz => pz.t === 'mesa').map(pz => claveMesa(pz.codigo)));
	return codigos.filter(c => !puestas.has(claveMesa(c)));
}

/**
 * La mesa i pasa a tener el numero codigo. Si otra mesa del plano ya lo tenia, se cambian los numeros; si no, el
 * numero que tenia la i queda libre (vuelve a "Mesas por colocar"). {plano, otra}: otra = indice de la que se cambio o -1.
 */
export function conCodigo(plano, i, codigo) {
	const antes = plano.piezas[i].codigo, clave = claveMesa(codigo);
	const otra = plano.piezas.findIndex((pz, k) => k !== i && pz.t === 'mesa' && claveMesa(pz.codigo) === clave);
	const piezas = plano.piezas.map((pz, k) => (k === i ? { ...pz, codigo } : k === otra ? { ...pz, codigo: antes } : pz));
	return { plano: { ...plano, piezas }, otra };
}

/**
 * Donde empezar a buscar lugar para la mesa de ese codigo: a la derecha de la mesa con el correlativo anterior que
 * ya este en el plano (la 17 junto a la 16, como "sin ubicar" en vivo); si no hay, arriba a la izquierda.
 */
export function cercaDeAnterior(plano, codigos, codigo) {
	const lugar = new Map(plano.piezas.filter(pz => pz.t === 'mesa').map(pz => [claveMesa(pz.codigo), pz]));
	const i = codigos.findIndex(c => claveMesa(c) === claveMesa(codigo));
	for (let k = i - 1; k >= 0; k--) {
		const pz = lugar.get(claveMesa(codigos[k]));
		if (pz) { return { x: pz.x + huellaDe(pz).ancho, y: pz.y }; }
	}
	return { x: 0, y: 0 };
}

/**
 * Area mas ancha (+1) o angosta (-1) (lado 'ancho') o con mas o menos fondo (lado 'fondo'), en PASO_AREA y sin pasar
 * de AREA_MIN..AREA_MAX (de 42 se baja a 40, de 22 a 20).
 * @returns {{plano: object} | {error: 'limite'|'piezas'}} limite: ya esta en AREA_MIN/AREA_MAX; piezas: al achicar
 *   alguna quedaria afuera (primero hay que moverla)
 */
export function conTamano(plano, lado, delta) {
	const valor = Math.max(AREA_MIN, Math.min(AREA_MAX, plano[lado] + delta * PASO_AREA));
	if (valor === plano[lado]) { return { error: 'limite' }; }
	const nuevo = { ...plano, [lado]: valor };
	const afuera = delta < 0 && plano.piezas.some(pz => {
		const e = espacioDe(pz);
		return e.x + e.ancho > nuevo.ancho || e.y + e.fondo > nuevo.fondo;
	});
	return afuera ? { error: 'piezas' } : { plano: nuevo };
}

/**
 * El tamaño (ancho, fondo) mas cercano al pedido que el area puede tener: entero, entre AREA_MIN y AREA_MAX y sin
 * dejar ninguna pieza afuera (con el aire de las sillas). Para estirar el salon con el mouse.
 */
export function tamanoQueCabe(plano, ancho, fondo) {
	const es = plano.piezas.map(espacioDe);
	const minA = Math.max(AREA_MIN, ...es.map(e => e.x + e.ancho)), minF = Math.max(AREA_MIN, ...es.map(e => e.y + e.fondo));
	const en = (v, min) => Math.max(min, Math.min(AREA_MAX, Math.round(v)));
	return { ancho: en(ancho, minA), fondo: en(fondo, minF) };
}

// Casillas de "Armar con mis mesas": las de armarConMisMesas (paso 9, margen 6), tantas como entran en 200×200.
const CASILLAS_MAX = 21 * 21;

/** Casillas de la grilla fija para ese ancho, fila por fila desde arriba a la izquierda, hasta el fondo maximo. */
function casillas(ancho) {
	return armarConMisMesas(new Array(CASILLAS_MAX).fill(''), ancho)
		.filter(m => m.y + huellaDe(m).fondo + MARGEN_ARMAR <= AREA_MAX);
}

/** Casillas agrupadas por fila (misma y), en orden. */
function porFilas(lista) {
	const filas = new Map();
	for (const c of lista) { filas.set(c.y, [...(filas.get(c.y) || []), c]); }
	return [...filas.values()];
}

/**
 * Los codigos en orden, uno por casilla libre: la casilla donde la mesa con sus sillas pisaria un adorno se salta (no
 * se corre nada), asi las filas quedan alineadas y los numeros se leen de izquierda a derecha y de arriba abajo. Una
 * fila con menos de la mitad de sus casillas libres se salta entera (Ruling 12: ninguna mesa suelta al lado de la barra).
 * null si no entran todos ni con el fondo maximo.
 */
function enCasillas(adornos, codigos, ancho) {
	const salon = { ancho, fondo: AREA_MAX, piezas: adornos };
	const mesas = [];
	for (const fila of porFilas(casillas(ancho))) {
		const libres = fila.filter(c => problemaEn(salon, c) === null);
		if (libres.length * 2 < fila.length) { continue; }
		for (const casilla of libres.slice(0, codigos.length - mesas.length)) {
			mesas.push({ ...casilla, codigo: codigos[mesas.length] });
		}
		if (mesas.length === codigos.length) { return mesas; }
	}
	return null;
}

/**
 * "Armar con mis mesas": las mesas del area en la grilla fija de armarConMisMesas en lugar de las que habia; los
 * adornos se quedan y las casillas que pisan se saltan, o la fila entera si le queda menos de la mitad (enCasillas).
 * Si faltan casillas se agregan filas (crece el fondo); si ni con 200 de fondo entran, crece el ancho.
 * @returns {{plano: object} | {error: 'sin_lugar'}} sin_lugar: ni con 200×200 entran (los adornos ocupan todo)
 */
export function armarSalon(plano, codigos) {
	const adornos = plano.piezas.filter(pz => pz.t !== 'mesa');
	for (let ancho = plano.ancho; ; ancho = Math.min(AREA_MAX, ancho + PASO_AREA)) {
		const mesas = enCasillas(adornos, codigos, ancho);
		if (mesas) {
			const fondo = mesas.reduce((f, pz) => Math.max(f, pz.y + huellaDe(pz).fondo + MARGEN_ARMAR), plano.fondo);
			return { plano: { ...plano, ancho, fondo: Math.min(AREA_MAX, fondo), piezas: [...adornos, ...mesas] } };
		}
		if (ancho >= AREA_MAX) { return { error: 'sin_lugar' }; }
	}
}
