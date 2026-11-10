// Logica pura del plano de un area (spec docs/superpowers/specs/2026-10-31-maqueta-salon-3d-design.md §6-§7). Sin DOM:
// la usan el editor (app/maqueta/) y la vista en vivo de Control de pedidos, y se prueba en Node.
// Unidades: cuadros (1 cuadro = 10 unidades del mundo del prototipo); x, y de una pieza = su esquina superior
// izquierda. La fila delantera del salon es la de y mayor (la que queda cerca de la camara).

const MAX_PIEZAS = 500;
const TIPOS = ['mesa', 'barra', 'planta', 'biombo', 'pared', 'columna', 'entrada', 'caja', 'sofa', 'jardinera', 'alfombra'];
const FORMAS = ['cuadrada', 'cuadrada2', 'redonda', 'larga', 'alta'];
const GIROS = [0, 90, 180, 270];
const TALLAS = ['normal', 'alta'];
const CON_LARGO = ['barra', 'biombo', 'pared', 'sofa', 'jardinera', 'alfombra'];
const MODELOS = ['sillon', 'clasica', 'bistro', 'tapizada'];
const COLORES = ['piso', 'mesas', 'sillas', 'cojin', 'patas', 'paredes'];
const RANGOS = { sombraNitida: [0, 100], sombraLargo: [0, 100], muchoTiempoMin: [15, 600] };
const AJUSTES_DEFAULT = Object.freeze({
	piso: '#bababa', mesas: '#fbfaf8', sillas: '#f3f1ed', cojin: '#e9e6e0', patas: '#d9d5ce', paredes: '#fbfbfc',
	modelo: 'sillon', sombraNitida: 62, sombraLargo: 35, muchoTiempoMin: 90,
});
// Los mismos patrones que log_maqueta.php. El prefijo del area es texto libre (x-areas-mesas-alfanumericas.html):
// el codigo admite espacios, Ñ, tildes, "_" o "." ("TERRAZA ALTA-05"), hasta 30 letras. Fuera: caracteres de
// control (C0, DEL, C1), < > " ' & \ ` y lo que no esta en el plano basico de Unicode (emojis); los sustitutos
// sueltos (texto UTF-16 roto) tampoco, como el /u de PHP con UTF-8 invalido. El area (titulo sin espacios): lo
// mismo sin espacios, hasta 40.
const AREA = /^[^\x00-\x20\x7f-\x9f<>"'&\\`\u{10000}-\u{10FFFF}\uD800-\uDFFF]{0,40}$/u;
const CODIGO = /^[^\x00-\x1f\x7f-\x9f<>"'&\\`\u{10000}-\u{10FFFF}\uD800-\uDFFF]{1,30}$/u;
const COLOR = /^#[0-9a-f]{6}$/;

/**
 * Lo que ocupa cada pieza en el piso, en cuadros, sin girar (ancho a lo largo de x, fondo a lo largo de y), segun
 * los tamaños del prototipo: mesa cuadrada 30 → 3×3, redonda Ø36 → 4×4, barra → 9 de fondo (repisa de botellas,
 * pasillo, mostrador y banquetas: todo dentro de la huella), biombo de listones de 4 → 1, caja con mostrador
 * 28×58 → 3×6, maceta Ø15 → 2×2. En barra, biombo, pared y sofa el ancho es su largo; el de aqui vale si la pieza
 * no lo trae. Todo calculo de solapes usa esta tabla (via huellaDe).
 */
export const HUELLA = Object.freeze({
	mesa: Object.freeze({
		cuadrada: Object.freeze({ ancho: 3, fondo: 3 }),
		cuadrada2: Object.freeze({ ancho: 3, fondo: 3 }),
		redonda: Object.freeze({ ancho: 4, fondo: 4 }),
		larga: Object.freeze({ ancho: 8, fondo: 3 }),
		alta: Object.freeze({ ancho: 2, fondo: 2 }),
	}),
	barra: Object.freeze({ ancho: 38, fondo: 9 }),
	biombo: Object.freeze({ ancho: 12, fondo: 1 }),
	pared: Object.freeze({ ancho: 10, fondo: 1 }),
	sofa: Object.freeze({ ancho: 4, fondo: 2 }),
	planta: Object.freeze({ ancho: 2, fondo: 2 }),
	columna: Object.freeze({ ancho: 2, fondo: 2 }),
	entrada: Object.freeze({ ancho: 4, fondo: 1 }),
	caja: Object.freeze({ ancho: 3, fondo: 6 }),
	jardinera: Object.freeze({ ancho: 8, fondo: 2 }),   // divisor: cajon de 60 de fondo con plantas, se alarga
	alfombra: Object.freeze({ ancho: 8, fondo: 6 }),    // alfombra o cesped: su largo y su fondo se cambian
});

// "Armar con mis mesas": esquina de la primera mesa y distancia entre esquinas (mesa de 3 + sillas + pasillo).
const MARGEN_ARMAR = 6;
const PASO_ARMAR = 9;
// "Sin ubicar": se dibuja como mesa cuadrada y pide 2 cuadros de aire alrededor (las sillas y el paso).
const HUELLA_SIN_UBICAR = HUELLA.mesa.cuadrada;
const AIRE = 2;

/**
 * Lo que ocupa una pieza ya validada, con su giro: a 90° y 270° se cambian ancho y fondo.
 * @returns {{ancho: number, fondo: number}}
 */
export function huellaDe(pieza) {
	const base = pieza.t === 'mesa' ? HUELLA.mesa[pieza.forma] : HUELLA[pieza.t];
	const ancho = CON_LARGO.includes(pieza.t) && pieza.largo != null ? pieza.largo : base.ancho;
	const fondo = pieza.t === 'alfombra' && pieza.fondo != null ? pieza.fondo : base.fondo;
	return pieza.giro === 90 || pieza.giro === 270 ? { ancho: fondo, fondo: ancho } : { ancho, fondo };
}

/**
 * Clave de la mesa: mayusculas, sin espacios y sin ceros a la izquierda en la ultima corrida de digitos
 * ("05" → "5", "piso1-05" → "PISO1-5", "00" → "0"). Dos codigos con la misma clave son la misma mesa; el prefijo
 * se conserva, asi "PISO1-05" ≠ "PISO2-05". (La de app/camaras/js/mesas-sede.js solo quita ceros a los codigos
 * que son puro numero: alli "PISO1-05" ≠ "PISO1-5", aqui son la misma.)
 * Espacios, mayusculas y digitos solo ASCII, para dar lo mismo que maqClaveMesa de log_maqueta.php ("ñ" ≠ "Ñ").
 */
export function claveMesa(codigo) {
	const c = String(codigo ?? '').replace(/[\t-\r ]+/g, '').replace(/[a-z]+/g, letras => letras.toUpperCase());
	return c.replace(/[0-9]+(?=[^0-9]*$)/, digitos => digitos.replace(/^0+(?=[0-9])/, ''));
}

/** xCeroIzq(n, 2) de js/mifuncion_web.js: a 2 digitos ("5" → "05"; "12" y "100" quedan igual). */
const dos = n => String(n).padStart(2, '0');

/**
 * Codigos de las mesas de un area tal como los pinta x-control-mesas.html (xPintarMesas): desde..hasta a 2
 * digitos, con el prefijo del area delante si la sede usa mesas alfanumericas y el area lo tiene.
 * @param {{desde: number|string, hasta: number|string, prefijo?: string}} area
 * @returns {string[]}
 */
export function mesasDelArea(area, alfanumerica) {
	const prefijo = alfanumerica && area.prefijo ? area.prefijo : '';
	const codigos = [];
	for (let i = parseInt(area.desde, 10); i <= parseInt(area.hasta, 10); i++) { codigos.push(prefijo + dos(i)); }
	return codigos;
}

/** Entero JSON (no "5" ni 5.5) entre min y max (maqEntero). */
const entero = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
const esObjeto = v => typeof v === 'object' && v !== null;
// isset() de PHP: falta o es null
const viene = v => v !== undefined && v !== null;

/** Campos propios de una mesa (forma y codigo obligatorios; sillas 0..12). null si algo no vale. */
function camposMesa(pz) {
	if (!FORMAS.includes(pz.forma) || typeof pz.codigo !== 'string' || !CODIGO.test(pz.codigo)) { return null; }
	const r = { forma: pz.forma, codigo: pz.codigo };
	if (viene(pz.sillas)) {
		if (!entero(pz.sillas, 0, 12)) { return null; }
		r.sillas = pz.sillas;
	}
	return r;
}

/**
 * Una pieza normalizada (maqValidarPieza): solo los campos de su tipo (lo demas se descarta), giro 0 si no viene,
 * x, y dentro del area. null si algo no vale.
 */
function validarPieza(pz, ancho, fondo) {
	if (!esObjeto(pz) || !TIPOS.includes(pz.t)) { return null; }
	const giro = viene(pz.giro) ? pz.giro : 0;
	if (!entero(pz.x, 0, ancho - 1) || !entero(pz.y, 0, fondo - 1) || !GIROS.includes(giro)) { return null; }
	let r = { t: pz.t, x: pz.x, y: pz.y, giro };
	if (pz.t === 'mesa') {
		const mesa = camposMesa(pz);
		if (mesa === null) { return null; }
		r = { ...r, ...mesa };
	}
	if (CON_LARGO.includes(pz.t) && viene(pz.largo)) {
		if (!entero(pz.largo, 1, 60)) { return null; }
		r.largo = pz.largo;
	}
	if (pz.t === 'planta' && viene(pz.talla)) {
		if (!TALLAS.includes(pz.talla)) { return null; }
		r.talla = pz.talla;
	}
	if (pz.t === 'alfombra') {
		if (viene(pz.fondo)) {
			if (!entero(pz.fondo, 1, 60)) { return null; }
			r.fondo = pz.fondo;
		}
		if (viene(pz.color)) {
			if (typeof pz.color !== 'string' || !COLOR.test(pz.color)) { return null; }
			r.color = pz.color;
		}
	}
	return r;
}

/** true si el valor sirve para esa llave de ajustes (color #rrggbb en minusculas, modelo conocido o rango). */
function ajusteValido(llave, v) {
	if (COLORES.includes(llave)) { return typeof v === 'string' && COLOR.test(v); }
	if (llave === 'modelo') { return MODELOS.includes(v); }
	return entero(v, RANGOS[llave][0], RANGOS[llave][1]);
}

/** Ajustes normalizados (maqValidarAjustes): solo las llaves conocidas que vengan. null si alguna no vale. */
function validarAjustes(a) {
	if (!esObjeto(a)) { return null; }
	const r = {};
	for (const llave of Object.keys(AJUSTES_DEFAULT)) {
		if (!viene(a[llave])) { continue; }
		if (!ajusteValido(llave, a[llave])) { return null; }
		r[llave] = a[llave];
	}
	return r;
}

/** true si dos mesas tienen la misma clave ("5" y "05"): una tarjeta no sabria cual de las dos es. */
function hayCodigoRepetido(piezas) {
	const claves = piezas.filter(pz => pz.t === 'mesa').map(pz => claveMesa(pz.codigo));
	return new Set(claves).size !== claves.length;
}

/** Piezas normalizadas o el codigo de error. */
function validarPiezas(lista, ancho, fondo) {
	if (!Array.isArray(lista)) { return { error: 'piezas_invalidas' }; }
	if (lista.length > MAX_PIEZAS) { return { error: 'demasiadas_piezas' }; }
	const piezas = lista.map(pz => validarPieza(pz, ancho, fondo));
	if (piezas.includes(null)) { return { error: 'pieza_invalida' }; }
	return hayCodigoRepetido(piezas) ? { error: 'codigo_repetido' } : { piezas };
}

/**
 * Las mismas reglas que maqValidarPlano de bdphp/log_maqueta.php (el servidor las vuelve a aplicar al guardar),
 * mas una: dos mesas con la misma claveMesa no valen.
 * @returns {{ok: true, plano: object} | {ok: false, error: string}} plano normalizado {area, ancho, fondo, piezas,
 *   ajustes, version}; error: plano_invalido, piezas_invalidas, demasiadas_piezas, pieza_invalida, codigo_repetido
 *   o ajustes_invalidos
 */
export function validarPlano(p) {
	if (!esObjeto(p) || typeof p.area !== 'string' || !AREA.test(p.area) || !entero(p.ancho, 20, 200)
		|| !entero(p.fondo, 20, 200) || !entero(p.version, 0, Number.MAX_SAFE_INTEGER)) {
		return { ok: false, error: 'plano_invalido' };
	}
	const { piezas, error } = validarPiezas(p.piezas, p.ancho, p.fondo);
	if (error) { return { ok: false, error }; }
	const ajustes = validarAjustes(viene(p.ajustes) ? p.ajustes : {});
	if (ajustes === null) { return { ok: false, error: 'ajustes_invalidos' }; }
	return { ok: true, plano: { area: p.area, ancho: p.ancho, fondo: p.fondo, piezas, ajustes, version: p.version } };
}

/**
 * Ajustes completos para dibujar: cada llave valida que traiga a; las que falten o no valgan, las por defecto
 * (las mismas de log_maqueta.php). Las llaves ajenas se descartan.
 */
export function ajustesConDefaults(a) {
	const r = { ...AJUSTES_DEFAULT };
	if (!esObjeto(a)) { return r; }
	for (const llave of Object.keys(AJUSTES_DEFAULT)) {
		if (ajusteValido(llave, a[llave])) { r[llave] = a[llave]; }
	}
	return r;
}

/**
 * "Armar con mis mesas": una mesa cuadrada de 4 sillas por codigo, en filas de izquierda a derecha con paso 9 y
 * margen 6, tantas por fila como quepan en el ancho (al menos una).
 * @returns {object[]} piezas mesa
 */
export function armarConMisMesas(codigos, ancho) {
	const libre = ancho - MARGEN_ARMAR * 2 - HUELLA.mesa.cuadrada.ancho;
	const porFila = Math.max(1, Math.floor(libre / PASO_ARMAR) + 1);
	return codigos.map((codigo, i) => ({
		t: 'mesa', forma: 'cuadrada', codigo, sillas: 4, giro: 0,
		x: MARGEN_ARMAR + (i % porFila) * PASO_ARMAR,
		y: MARGEN_ARMAR + Math.floor(i / porFila) * PASO_ARMAR,
	}));
}

/** Rectangulo {x, y, ancho, fondo} que ocupa una pieza. */
const rectDe = pz => ({ x: pz.x, y: pz.y, ...huellaDe(pz) });
const seSolapan = (a, b) => a.x < b.x + b.ancho && b.x < a.x + a.ancho && a.y < b.y + b.fondo && b.y < a.y + a.fondo;

/** true si una mesa sin ubicar en (x, y), con su aire alrededor, no pisa nada de lo ocupado. */
function huecoLibre(x, y, ocupados) {
	const conAire = {
		x: x - AIRE, y: y - AIRE, ancho: HUELLA_SIN_UBICAR.ancho + AIRE * 2, fondo: HUELLA_SIN_UBICAR.fondo + AIRE * 2,
	};
	return !ocupados.some(r => seSolapan(conAire, r));
}

/** Primer hueco al lado de la anterior: su fila desde su x hacia la derecha, luego las filas de abajo. */
function huecoJuntoA(anterior, ocupados, xMax, yMax) {
	for (let y = Math.min(anterior.y, yMax); y <= yMax; y++) {
		for (let x = Math.min(anterior.x, xMax); x <= xMax; x++) {
			if (huecoLibre(x, y, ocupados)) { return { x, y }; }
		}
	}
	return null;
}

/** Primer hueco desde la fila delantera, de izquierda a derecha, y hacia atras. Si el area esta llena, su esquina delantera. */
function huecoDelantero(ocupados, xMax, yMax) {
	for (let y = yMax; y >= 0; y--) {
		for (let x = 0; x <= xMax; x++) {
			if (huecoLibre(x, y, ocupados)) { return { x, y }; }
		}
	}
	return { x: 0, y: Math.max(0, yMax) };
}

/**
 * Lugar en la vista de cada mesa del area que no tiene pieza en el plano (no se guarda): el primer hueco libre a la
 * derecha y luego abajo de la mesa anterior en la lista de codigos que ya tenga lugar (en el plano o puesta en esta
 * misma vuelta: la 17 y la 18 nuevas quedan juntas); si ninguna anterior lo tiene, desde la fila delantera.
 * @param {object} plano validado
 * @param {string[]} codigos del area en su orden (mesasDelArea)
 * @returns {Array<{codigo: string, x: number, y: number}>}
 */
export function ubicarSinUbicar(plano, codigos) {
	const xMax = plano.ancho - HUELLA_SIN_UBICAR.ancho;
	const yMax = plano.fondo - HUELLA_SIN_UBICAR.fondo;
	const ocupados = plano.piezas.filter(pz => pz.t !== 'alfombra').map(rectDe);   // sobre la alfombra si se pone una mesa
	const lugar = new Map(plano.piezas.filter(pz => pz.t === 'mesa').map(pz => [claveMesa(pz.codigo), rectDe(pz)]));
	const resultado = [];
	let anterior = null;
	for (const codigo of codigos) {
		const clave = claveMesa(codigo);
		if (!lugar.has(clave)) {
			const hueco = (anterior && huecoJuntoA(anterior, ocupados, xMax, yMax)) || huecoDelantero(ocupados, xMax, yMax);
			const rect = { ...hueco, ...HUELLA_SIN_UBICAR };
			ocupados.push(rect);
			lugar.set(clave, rect);
			resultado.push({ codigo, x: hueco.x, y: hueco.y });
		}
		anterior = lugar.get(clave);
	}
	return resultado;
}

/** Mesas del plano cuyo codigo ya no esta en el area (se achico el rango): el editor las marca en rojo. */
export function mesasQueNoExisten(plano, codigos) {
	const claves = new Set(codigos.map(claveMesa));
	return plano.piezas.filter(pz => pz.t === 'mesa' && !claves.has(claveMesa(pz.codigo)));
}
