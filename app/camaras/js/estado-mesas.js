// Estado en vivo de las mesas en palabras simples (GET /api/v1/mesas/estado y GET /api/v1/estado del servidor de
// cámaras). Puro: sin DOM, sin red y nada se ejecuta al importar. Lo usan En vivo (vistas/en-vivo.js), Probar
// (vistas/probar.js), el inicio (capacidad de la PC) y, con import(), las páginas clásicas del POS (T21).
// Las horas (desde) son del servidor; ahoraMs es el reloj de esta PC corregido con la hora del servidor
// (desfaseReloj, F2-R45: ahoraMs = Date.now() + desfase). Los minutos nunca bajan de 0.
// La mesa se compara siempre con claveMesa: "05" y "5" son la misma.
import { claveMesa } from './mesas-sede.js?v=20261020i';

const LIBRE = 'vm-libre';
const OCUPADA = 'vm-ocupada';
const ALERTA = 'vm-alerta';
const SIN_INFO = 'vm-sininfo';
const CON_PEDIDO = 'vm-conpedido';
const SIN_PEDIDO = 'vm-sinpedido';   // resaltado: ocupada sin pedido, o libre con la cuenta abierta

const orden = new Intl.Collator('es', { numeric: true });   // "2" antes que "10", "T2" antes que "T10"

/** Minutos enteros (Math.floor) de la hora iso a ahoraMs; null si iso no es una fecha. Nunca negativos. */
function minutos(iso, ahoraMs) {
	const t = typeof iso === 'string' ? Date.parse(iso) : NaN;
	return Number.isFinite(t) ? Math.max(0, Math.floor((ahoraMs - t) / 60000)) : null;
}

const hace = n => (n < 1 ? 'menos de 1 min' : `${n} min`);

/**
 * Cuánto va el reloj del servidor delante (+) o detrás (−) del de esta PC, en ms (F2-R45): ahora (data.ahora de
 * GET mesas/estado, RFC3339) − ahoraPcMs (Date.now() al recibir la respuesta). Sin ahora o ilegible (servidor
 * viejo): 0. Los minutos se calculan con ahoraMs = Date.now() + desfase: el reloj de la PC del POS suele estar mal.
 */
export function desfaseReloj(ahora, ahoraPcMs) {
	const t = typeof ahora === 'string' && ahora ? Date.parse(ahora) : NaN;
	return Number.isFinite(t) && Number.isFinite(ahoraPcMs) ? t - ahoraPcMs : 0;
}

/** "Ocupada · 12 min"; sin una hora que sirva, solo "Ocupada". */
function conMinutos(texto, iso, ahoraMs) {
	const n = minutos(iso, ahoraMs);
	return n === null ? texto : `${texto} · ${hace(n)}`;
}

const claveDe = m => claveMesa(m.mesa_clave || m.mesa);

/**
 * Lo que dice la tarjeta de la mesa m (de GET mesas/estado) y su clase. Una alerta a la vista manda sobre el
 * estado (aunque la cámara se haya caído: hay que poder cerrarla): "Sin atención · 6 min" (desde el inicio de la
 * sesión, m.desde, como el texto de la alerta) o "Cuenta abierta". Si no: "Libre", "Ocupada · 12 min" (m.desde: con
 * sesión abierta, su inicio) o "Sin información". por_limpiar y limpiando no salen en F2 (F3).
 * @returns {{texto: string, clase: 'vm-libre' | 'vm-ocupada' | 'vm-alerta' | 'vm-sininfo'}}
 */
export function etiqueta(m, ahoraMs) {
	const tipo = m && m.alerta ? m.alerta.tipo : '';
	if (tipo === 'sin_atencion') { return { texto: conMinutos('Sin atención', m.desde, ahoraMs), clase: ALERTA }; }
	if (tipo === 'cuenta_abierta') { return { texto: 'Cuenta abierta', clase: ALERTA }; }
	if (tipo === 'por_limpiar') { return { texto: 'Por limpiar', clase: ALERTA }; }
	switch (m && m.estado) {
		case 'libre': return { texto: 'Libre', clase: LIBRE };
		case 'ocupada': return { texto: conMinutos('Ocupada', m.desde, ahoraMs), clase: OCUPADA };
		case 'por_limpiar': return { texto: 'Por limpiar', clase: OCUPADA };
		case 'limpiando': return { texto: 'Limpiando', clase: OCUPADA };
		default: return { texto: 'Sin información', clase: SIN_INFO };
	}
}

/**
 * El pedido de la mesa en el POS (F2-R43), la segunda línea de la tarjeta, o null si no hay nada que decir.
 * conPedidos es con_pedidos de GET mesas/estado: false (sin puente) → null siempre, nunca "Sin pedido" a ciegas.
 * Ocupada: "S/ 75.00 · pedido hace 23 min" (desde la cuenta más vieja) o "Sin pedido" (resaltado). Libre (o
 * cualquier otro estado sin gente): "S/ 40.00 · cuenta abierta" (resaltado) o null. Sin información: null.
 * Una mesa sin el campo cuenta, o con una cuenta sin total numérico, tampoco dice nada.
 * @returns {{texto: string, clase: 'vm-conpedido' | 'vm-sinpedido'} | null}
 */
export function textoCuenta(m, conPedidos, ahoraMs) {
	if (conPedidos !== true || !m || m.estado === 'sin_info' || m.cuenta === undefined) { return null; }
	const c = m.cuenta;
	if (c !== null && (typeof c !== 'object' || typeof c.total !== 'number' || !Number.isFinite(c.total))) { return null; }
	if (m.estado === 'ocupada') {
		if (!c) { return { texto: 'Sin pedido', clase: SIN_PEDIDO }; }
		const n = minutos(c.desde, ahoraMs);
		const monto = `S/ ${c.total.toFixed(2)}`;
		return { texto: n === null ? monto : `${monto} · pedido hace ${hace(n)}`, clase: CON_PEDIDO };
	}
	return c ? { texto: `S/ ${c.total.toFixed(2)} · cuenta abierta`, clase: SIN_PEDIDO } : null;
}

/**
 * true si "Silenciar esta mesa" (POST sesiones/{id}/silenciar) sirve: la alerta que se ve es de la sesión abierta
 * (sin_atencion) y no está silenciada. Una cuenta_abierta siempre es de una sesión ya cerrada (el servidor la crea
 * al cerrarse: 409 sesion_cerrada); si otra gente ya se sentó, silenciar la sesión nueva no la cerraría.
 */
export const puedeSilenciar = m => !!m && m.sesion_id != null && !m.silenciada && !!m.alerta && m.alerta.tipo === 'sin_atencion';

/**
 * Las mesas agrupadas por área: [{area, mesas}]. Las mesas, por claveMesa (2 antes que 10); cada área en el orden
 * de su primera mesa (como las numera el POS) y las sin área ('') al final. No cambia la lista que recibe.
 */
export function porArea(mesas) {
	const lista = (Array.isArray(mesas) ? mesas : []).filter(m => m && typeof m === 'object');
	const ordenadas = [...lista].sort((a, b) => orden.compare(claveDe(a), claveDe(b)));
	const grupos = new Map();
	for (const m of ordenadas) {
		const area = m.area || '';
		if (!grupos.has(area)) { grupos.set(area, []); }
		grupos.get(area).push(m);
	}
	const todos = [...grupos].map(([area, ms]) => ({ area, mesas: ms }));
	return [...todos.filter(g => g.area), ...todos.filter(g => !g.area)];
}

/* ---------- T21: las tarjetas de Control de pedidos y Anfitrión (app/shared/vision.mesas.js) ---------- */

/**
 * La alerta que se ve en la mesa m, venga de GET mesas/estado (alerta: {id, tipo, creada}) o del socket
 * vision-mesas-estado (alerta_id, alerta_tipo, Global Constraints); null si ninguna.
 */
function alertaDe(m) {
	if (m.alerta && typeof m.alerta === 'object') { return m.alerta.id != null ? m.alerta : null; }
	return m.alerta_id != null ? { id: m.alerta_id, tipo: m.alerta_tipo } : null;
}

const mesasDe = estado => (estado && Array.isArray(estado.mesas) ? estado.mesas.filter(m => m && typeof m === 'object') : []);

/**
 * Lo que se pinta en cada tarjeta del POS: estado es la data de GET mesas/estado o del socket vision-mesas-estado;
 * claves, la lista de códigos tal como los lee la página de sus tarjetas ("05", "PISO1-05"). Se cruzan con
 * claveMesa ("05" y "5" son la misma) y la llave del Map es el código de la tarjeta tal cual. Una tarjeta sin
 * mesa en el estado (sin cámara) no sale; una mesa sin tarjeta, tampoco. El texto es el de etiqueta (F2-R43: el
 * pedido no, la tarjeta ya lo muestra). ahoraMs: Date.now() + desfaseReloj.
 * @returns {Map<string, {texto: string, clase: string, alertaId: number|null, alertaTipo: string|null}>}
 */
export function marcas(estado, claves, ahoraMs = Date.now()) {
	const ahora = Number.isFinite(ahoraMs) ? ahoraMs : Date.now();
	const porClave = new Map();
	for (const m of mesasDe(estado)) {
		const k = claveDe(m);
		if (k && !porClave.has(k)) { porClave.set(k, m); }
	}
	const r = new Map();
	for (const codigo of Array.isArray(claves) ? claves : []) {
		if (codigo === null || codigo === undefined || codigo === '' || r.has(codigo)) { continue; }
		const m = porClave.get(claveMesa(codigo));
		if (!m) { continue; }
		const a = alertaDe(m);
		const { texto, clase } = etiqueta({ ...m, alerta: a }, ahora);
		r.set(codigo, { texto, clase, alertaId: a ? a.id : null, alertaTipo: a ? a.tipo || null : null });
	}
	return r;
}

/**
 * vision-alerta (el cuerpo de la alerta, Global Constraints): un estado nuevo con esa alerta en su mesa (por
 * claveMesa de mesa_clave). Si la mesa ya muestra una alerta, manda esa (el próximo vision-mesas-estado decide
 * con la prioridad del servidor); sin la mesa o con datos malos, el mismo estado. No cambia el que recibe.
 */
export function conAlerta(estado, alerta) {
	if (!alerta || typeof alerta !== 'object' || alerta.alerta_id == null || !estado || !Array.isArray(estado.mesas)) { return estado; }
	const k = claveMesa(alerta.mesa_clave || alerta.mesa);
	const i = estado.mesas.findIndex(m => m && typeof m === 'object' && claveDe(m) === k);
	if (i < 0 || alertaDe(estado.mesas[i])) { return estado; }
	const a = { id: alerta.alerta_id, tipo: alerta.tipo };
	const mesas = estado.mesas.map((m, j) => (j === i ? { ...m, alerta: a, alerta_id: a.id, alerta_tipo: a.tipo } : m));
	return { ...estado, mesas };
}

/** vision-alerta-resuelta o "Ya lo vi": un estado nuevo sin la alerta alertaId (número o texto). No cambia el que recibe. */
export function sinAlerta(estado, alertaId) {
	if (!estado || !Array.isArray(estado.mesas) || alertaId === null || alertaId === undefined) { return estado; }
	const id = String(alertaId);
	const mesas = estado.mesas.map(m => {
		const a = m && typeof m === 'object' ? alertaDe(m) : null;
		return a && String(a.id) === id ? { ...m, alerta: null, alerta_id: null, alerta_tipo: null } : m;
	});
	return { ...estado, mesas };
}

/** La frase de una PC (motor de GET estado) o '' si todavía no midió o no hay nada que decir. */
function fraseCapacidad(m) {
	const cap = m && m.medicion ? m.medicion.capacidad : null;
	if (!Number.isInteger(cap) || cap < 0) { return ''; }
	if (cap === 0) { return 'Esta PC es muy lenta para vigilar cámaras. Instala el programa en otra PC.'; }
	const tiene = Number.isInteger(m.camaras_mesas) && m.camaras_mesas > 0 ? m.camaras_mesas : 0;
	if (!tiene) { return ''; }   // todavía ninguna cámara mira mesas: el inicio ya dice el paso siguiente
	if (cap < tiene) {
		return `Esta PC puede vigilar ${cap} de tus ${tiene} cámaras que miran mesas. Elige cuáles en Cámaras o instala el programa en otra PC.`;
	}
	return tiene === 1 ? 'Esta PC puede vigilar tu cámara que mira mesas.' : `Esta PC puede vigilar tus ${tiene} cámaras que miran mesas.`;
}

/**
 * Cuántas cámaras puede vigilar la PC del local (motores[].medicion.capacidad, la calcula el servidor) frente a las
 * que miran mesas (camaras_mesas). Sin medición, ''. El inicio la llama con [motor] en la fila de cada PC; con
 * varias PC en la lista, una frase por PC que midió, separadas por un espacio.
 */
export function textoCapacidad(motores) {
	return (Array.isArray(motores) ? motores : []).map(fraseCapacidad).filter(Boolean).join(' ');
}
