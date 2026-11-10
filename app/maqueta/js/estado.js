// Logica pura de la vista en vivo (spec docs/superpowers/specs/2026-10-31-maqueta-salon-3d-design.md §5.2-§5.4).
// La tarjeta .xMiCardPedido de x-control-mesas.html es la fuente de verdad: aqui solo se lee (getAttribute,
// classList, querySelector, textContent) y se decide que pide accion. Sin pintar nada: se prueba en Node.
import { claveMesa } from './plano.js?v=20261102m';

const OCULTO = 'xInvisible';
const SIN_MOZO = ['', '-', '.'];               // lo que la tarjeta muestra sin mozo (nueva: "-", liberada: ".")
const HORA = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;   // data-hora del pedido: HH:MM:SS (o HH:MM)
const ALERTAS_CAMARA = ['sin_atencion', 'cuenta_abierta'];
const ADELANTO_MAX = 60 * 60000;               // ms que la hora del pedido puede ir por delante del reloj de la PC

const texto = (el, sel) => { const e = el.querySelector(sel); return e ? e.textContent.trim() : ''; };
const visible = (el, sel) => { const e = el.querySelector(sel); return !!e && !e.classList.contains(OCULTO); };

/** "S/. 1,250.40" → 1250.4; "-", "." o vacio → null. */
export function leerImporte(t) {
	const limpio = t.replace(/S\/\.?/, '').replace(/,/g, '').trim();
	const n = limpio === '' ? NaN : Number(limpio);
	return Number.isFinite(n) ? n : null;
}

/**
 * Minutos desde la hora del pedido (de hoy, con el reloj de la PC como xTiempoTranscurridos_2). La hora la pone
 * el servidor y el reloj de la caja suele ir atrasado: hasta ADELANTO_MAX de adelanto es un pedido recien hecho
 * (0 min); mas que eso, el pedido es de ayer (paso la medianoche). null si la hora no es valida.
 */
export function minutosDesde(hora, ahoraMs) {
	const p = HORA.exec(String(hora ?? '').trim());
	if (!p) { return null; }
	const [h, m, s] = [p[1], p[2], p[3] || '0'].map(Number);
	if (h > 23 || m > 59 || s > 59) { return null; }
	const desde = new Date(ahoraMs);
	desde.setHours(h, m, s, 0);
	if (desde.getTime() - ahoraMs > ADELANTO_MAX) { desde.setDate(desde.getDate() - 1); }
	return Math.max(0, Math.floor((ahoraMs - desde.getTime()) / 60000));
}

/** Referencias del pedido: la pagina pone un p.show-referencia-pedido por cada una (separadas por coma). */
function leerReferencia(el) {
	const caja = el.querySelector('.referencia-pedido');
	if (!caja || caja.classList.contains(OCULTO)) { return ''; }
	return Array.from(caja.querySelectorAll('.show-referencia-pedido'), p => p.textContent.trim()).filter(Boolean).join(', ');
}

/**
 * EstadoMesa de una tarjeta (tabla §5.2). Los datos del pedido (mozo, leds, referencia, minutos) solo valen con la
 * mesa ocupada: al liberarla, xResetMesaDefault deja el mozo, el led de impreso y la referencia de antes. El
 * importe y la cinta de pedido por confirmar se leen siempre (en una mesa libre con pedido QR, el importe es el
 * total por confirmar que pone pedido.por.confirmar.js).
 * @returns {EstadoMesa}
 */
export function leerTarjeta(el, ahoraMs) {
	const codigo = (el.getAttribute('data-codigo-mesa') || texto(el, '.numero')).trim();
	const ocupada = el.getAttribute('data-estado') === 'a';
	const mozo = texto(el, '#nommozo');
	return {
		codigo,
		clave: claveMesa(codigo),
		area: el.getAttribute('data-area') || '',
		ocupada,
		importe: leerImporte(texto(el, '.importe')),
		minutos: ocupada ? minutosDesde(el.getAttribute('data-hora'), ahoraMs) : null,
		mozo: ocupada && !SIN_MOZO.includes(mozo) ? mozo : '',
		impreso: ocupada && visible(el, '.show-led-print'),
		precuenta: ocupada && visible(el, '.show-led-precuenta'),
		reserva: ocupada && visible(el, '.show-led-reserva'),
		porConfirmar: !!el.querySelector('.ppc-cinta'),
		referencia: ocupada ? leerReferencia(el) : '',
		idpedido: ocupada ? parseInt(el.getAttribute('data-p'), 10) || null : null,   // xPintarMesas pone data-p
	};
}

const PARTE_DEL_MAS_CARO = 0.6;

/**
 * Cuantas personas hay en la mesa segun lo que pidieron (cuando no se sabe de otra forma): los platos de fondo son
 * los mas caros y suele ir uno por persona; bebidas, entradas y postres cuestan menos. Cuenta las unidades con precio
 * desde el 60% del mas caro. null si no hay nada con precio.
 * @param {Array<[number, number]>} items [cantidad, precio unitario] de cada linea del pedido
 * @returns {number|null}
 */
export function personasPorPlatos(items) {
	const lineas = items.map(([c, p]) => [Number(c), Number(p)]).filter(([c, p]) => c > 0 && p > 0);
	if (!lineas.length) { return null; }
	const caro = Math.max(...lineas.map(([, p]) => p));
	const n = lineas.filter(([, p]) => p >= caro * PARTE_DEL_MAS_CARO).reduce((a, [c]) => a + c, 0);
	return Math.max(1, Math.round(n));
}

/** "47 min" bajo la hora; "1 h 05" desde la hora. */
export function formatoMin(n) {
	return n < 60 ? `${n} min` : `${Math.floor(n / 60)} h ${String(n % 60).padStart(2, '0')}`;
}

const soles = importe => `S/ ${Math.round(importe)}`;
const porLimpiar = c => !!c && (c.alerta === 'por_limpiar' || c.estado === 'por_limpiar');

/**
 * Lo que pide accion, del mas urgente al menos (§5.4); null = mesa tranquila. Mucho tiempo: solo un pedido en
 * curso, nunca una reserva: el data-hora de su pedido es cuando se registro la reserva, no cuando llego la gente.
 * @returns {Urgencia|null}
 */
export function urgencia(m, c, umbralMin) {
	if (c && c.alerta === 'sin_atencion') {
		return { p: 0, k: 'al', motivo: 'Sin atención', dato: c.minutos == null ? '' : formatoMin(c.minutos), icono: 'cam' };
	}
	if (c && c.alerta === 'cuenta_abierta') {
		return { p: 1, k: 'al', motivo: 'Se fueron', dato: m.importe == null ? 'cuenta abierta' : soles(m.importe), icono: 'cam' };
	}
	if (m.porConfirmar) { return { p: 2, k: 'v', motivo: 'Por confirmar', dato: 'pedido QR', icono: 'qr' }; }
	if (m.precuenta) { return { p: 3, k: 'o', motivo: 'Precuenta', dato: m.importe == null ? '' : soles(m.importe), icono: 'pre' }; }
	if (m.ocupada && !m.reserva && m.minutos != null && m.minutos >= umbralMin) {
		return { p: 4, k: 'late', motivo: 'Mucho tiempo', dato: formatoMin(m.minutos), icono: 'clock' };
	}
	if (porLimpiar(c)) { return { p: 5, k: 'limpiar', motivo: 'Por limpiar', dato: 'quedaron platos', icono: 'cam' }; }
	return null;
}

/** Sin tildes, en minusculas y sin espacios a los lados (para buscar "perez" y hallar "Juan Pérez"). */
export function normalizar(t) {
	return String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** La busqueda: la referencia contiene lo escrito, o es el numero de la mesa ("05" encuentra la 5). */
export function coincide(m, q) {
	const buscado = normalizar(q);
	if (!buscado) { return false; }
	return normalizar(m.referencia).includes(buscado) || claveMesa(m.codigo) === claveMesa(q);
}

/**
 * Si la mesa entra en el filtro de arriba. Alertas = toda urgencia menos la precuenta; Por cobrar = precuenta o
 * se fueron con la cuenta abierta. Un tipo desconocido no oculta nada (como "todo").
 */
export function enFiltro(m, c, filtro, umbralMin) {
	switch (filtro && filtro.tipo) {
		case 'alertas': { const u = urgencia(m, c, umbralMin); return !!u && u.p !== 3; }
		case 'cobrar': return m.precuenta || (!!c && c.alerta === 'cuenta_abierta');
		case 'mozo': return !!filtro.mozo && m.mozo === filtro.mozo;   // sin mozo elegido no entra ninguna (ni las libres)
		case 'buscar': return coincide(m, filtro.q);
		default: return true;
	}
}

/** Mesa con gente: pedido abierto (no reserva) cuya gente no se fue, o gente que ve la camara. */
const conGente = ({ m, c }) => (m.ocupada && !m.reserva && !(c && c.alerta === 'cuenta_abierta')) || (!!c && c.estado === 'ocupada');

/**
 * El indicador de la barra de pestañas: "90% ocupación · 45/50 mesas · 135 personas · 5 precuentas · 3 alertas".
 * personas = suma de lo que cuentan las camaras; null si ninguna mesa trae personas (la vista lo omite). alertas =
 * las rojas de camara (sin atencion, se fueron con cuenta abierta).
 * @param {{m: EstadoMesa, c: Camara|null}[]} mesas
 */
export function ocupacion(mesas) {
	const total = mesas.length;
	const ocupadas = mesas.filter(conGente).length;
	const conteos = mesas.map(({ c }) => c && c.personas).filter(p => p != null);
	return {
		pct: total ? Math.round((ocupadas / total) * 100) : 0,
		ocupadas,
		total,
		personas: conteos.length ? conteos.reduce((a, p) => a + p, 0) : null,
		precuentas: mesas.filter(({ m }) => m.precuenta).length,
		alertas: mesas.filter(({ c }) => !!c && ALERTAS_CAMARA.includes(c.alerta)).length,
	};
}
