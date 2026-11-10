// Logica pura del panel "Llevar · Delivery" de la maqueta en pantalla completa (Control de pedidos, diseño A del
// prototipo salon-3d.html). Dos fuentes:
// - Para llevar (y los delivery abiertos): las tarjetas .xMiCardPedido de la grilla que no son mesas (op 501 de
//   bdphp/log.php, rama nummesa=0). Aqui solo se leen (getAttribute, classList, querySelector, textContent).
// - Delivery del dia: las filas de bdphp/log_009.php?op=7 (procedure_refresh_delivery, lo de Control de Delivery),
//   mapeadas como xCDCocinarDataItemPedido.
// Sin pintar nada: se prueba en Node (test/llevar.test.mjs).
import { minutosDesde, leerImporte, normalizar } from './estado.js?v=20261102m';

/** Minutos desde los que un pedido sale en naranja con ⚠. */
export const TARDE = Object.freeze({ llevar: 25, delivery: 40 });

/** Estados que se muestran: clase de color y texto (llevar: lo que dice la tarjeta; delivery: Control de Delivery). */
export const ESTADOS = Object.freeze({
	pend: 'Pendiente', coc: 'En cocina', sin: 'Sin asignar', proc: 'En proceso', cam: 'En camino', entregado: 'Entregado',
});

const OCULTO = 'xInvisible';
const RESERVA = 'tpc99';   // xPintarEstadoPedido: las reservas van con data-tpc="tpc99"
const SIN_REFERENCIA = ['', '.', '-'];
const MAX_ITEMS_TEXTO = 6;

const texto = (el, sel) => { const e = el.querySelector(sel); return e ? e.textContent.trim() : ''; };
const visible = (el, sel) => { const e = el.querySelector(sel); return !!e && !e.classList.contains(OCULTO); };
const numero = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
/** "LUIS PAREDES" → "Luis Paredes" (como toTitleCase de Control de Delivery); "1L", "B2" quedan como estan. */
const titulo = t => String(t ?? '').trim().split(/(\s+)/)
	.map(w => (/\d/.test(w) ? w : w.toLowerCase().replace(/(^|[.'-])(\S)/g, (m, a, b) => a + b.toUpperCase()))).join('');

/** Correlativo del dia como lo muestra la tarjeta (xCeroIzq(correlativo_dia, 4)): "14" → "0014". */
export function numeroPedido(correlativo, idpedido) {
	const c = String(correlativo ?? '').trim();
	if (/^\d+$/.test(c)) { return c.padStart(4, '0'); }
	return c || String(idpedido ?? '');
}

/** "S/ 45.00" */
export const soles = n => `S/ ${(Number(n) || 0).toFixed(2)}`;

/** "hace 12 min", "hace 1 h 05"; sin hora valida, ''. */
export function haceMin(min) {
	if (min == null) { return ''; }
	return min < 60 ? `hace ${min} min` : `hace ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

/** La fecha de hoy como la pide op=7 (xDevolverFecha): dd/mm/yyyy. */
export function fechaHoy(ahoraMs) {
	const d = new Date(ahoraMs);
	return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Ya esta tarde: desde TARDE minutos. Un delivery ya entregado no se marca. */
export function esTarde(p) {
	if (!p || p.min == null || p.est === 'entregado') { return false; }
	return p.min >= (TARDE[p.t] ?? Infinity);
}

/**
 * Tipo de consumo → 'llevar' | 'delivery' (de xm_log_get('estructura_pedido'): {idtipo_consumo, descripcion}).
 * @returns {Map<string, 'llevar'|'delivery'>}
 */
export function tiposDeConsumo(estructura) {
	const tipos = new Map();
	for (const e of Array.isArray(estructura) ? estructura : []) {
		if (!e || e.idtipo_consumo == null) { continue; }
		const des = normalizar(`${e.descripcion ?? ''} ${e.titulo ?? ''}`);
		const t = des.includes('delivery') ? 'delivery' : (des.includes('llevar') ? 'llevar' : null);
		if (t) { tipos.set(String(e.idtipo_consumo), t); }
	}
	return tipos;
}

/**
 * Si la tarjeta es un pedido para llevar, delivery o una reserva (no mesa). Sin tipos de consumo leidos, por el
 * icono que pone xPintarEstadoPedido (moto = delivery; bolsa = otro pedido sin mesa). La reserva va aunque tenga
 * mesa: en la maqueta no tiene otra tarjeta donde verse.
 * @returns {'llevar'|'delivery'|'reserva'|null}
 */
export function tipoDeTarjeta(el, tipos) {
	const tpc = el.getAttribute('data-tpc') || '';
	if (!tpc || el.getAttribute('data-codigo-mesa') != null) { return null; }
	if (tpc === RESERVA) { return 'reserva'; }
	if (String(el.getAttribute('data-nummesa') ?? '0').trim() !== '0') { return null; }
	if (tipos && tipos.size) { return tipos.get(tpc.replace(/^tpc/, '')) || null; }
	if (el.querySelector('.fa-motorcycle')) { return 'delivery'; }
	return el.querySelector('.fa-shopping-bag') ? 'llevar' : null;
}

/**
 * Pedido de una tarjeta abierta de la grilla. Todas estan por cobrar (al cobrar salen de la grilla).
 * Estado: comanda impresa (led de impreso) = En cocina; si no, Pendiente.
 */
export function pedidoDeTarjeta(el, t, ahoraMs) {
	const id = String(el.getAttribute('data-p') || el.getAttribute('id') || '').trim();
	const ref = texto(el, '.refTitulo');
	return {
		t, id, tarjeta: true,
		n: numeroPedido(el.getAttribute('data-correlativo'), id),
		quien: SIN_REFERENCIA.includes(ref) ? 'Mostrador' : ref,
		min: minutosDesde(el.getAttribute('data-hora'), ahoraMs),
		imp: leerImporte(texto(el, '.importe')) ?? 0,
		est: t === 'delivery' ? 'proc' : (visible(el, '.show-led-print') ? 'coc' : 'pend'),
		pag: false, tel: '', dir: '', rep: '', items: '', comprobante: '', json: null,
		mesa: t === 'reserva' ? String(el.getAttribute('data-nummesa') ?? '').trim().replace(/^0+$/, '') : '',
	};
}

/** Las tarjetas de llevar y delivery de la grilla, en su orden. */
export function pedidosDeGrilla(tarjetas, tipos, ahoraMs) {
	const r = [];
	for (const el of tarjetas) {
		const t = tipoDeTarjeta(el, tipos);
		if (t) { r.push(pedidoDeTarjeta(el, t, ahoraMs)); }
	}
	return r;
}

/** json_datos_delivery como objeto (llega como texto, a veces con saltos de linea); null si no hay o no se entiende. */
export function leerJsonDelivery(j) {
	if (j && typeof j === 'object') { return j; }
	const s = String(j ?? '').trim();
	if (!s || s === '{}' || s === '[]') { return null; }
	try { return JSON.parse(s); } catch (e) { /* sigue */ }
	try { return JSON.parse(s.replace(/(\r\n|\n|\r)/g, '')); } catch (e) { return null; }
}

/** "2 Lomo saltado · 1 Inca Kola 1L" desde p_body (tipoconsumo > secciones > items). */
export function textoItems(pBody) {
	const items = [];
	for (const tc of (pBody && Array.isArray(pBody.tipoconsumo) ? pBody.tipoconsumo : [])) {
		for (const s of (tc && Array.isArray(tc.secciones) ? tc.secciones : [])) {
			for (const i of (s && Array.isArray(s.items) ? s.items : [])) {
				if (!i || !i.des) { continue; }
				const c = numero(i.cantidad_seleccionada ?? i.cantidad);
				items.push(`${c == null ? '' : `${c} `}${titulo(i.des)}`);
			}
		}
	}
	const resto = items.length - MAX_ITEMS_TEXTO;
	return items.slice(0, MAX_ITEMS_TEXTO).join(' · ') + (resto > 0 ? ` · +${resto} más` : '');
}

/**
 * Subtotales del delivery de una sede que no hace su propio reparto: lo mismo que darFormatoSubTotalesDelivery
 * (item_pedido_subtotales.js) pero sin tocar la global xLocal_xDtSubTotales, que usa el cobro abierto: quita el
 * servicio de delivery (id -2) y la propina (id -3) y la ultima fila (TOTAL) pasa a ser la suma del resto.
 * Trabaja sobre una copia.
 */
export function subtotalesSinReparto(arr) {
	if (!Array.isArray(arr) || !arr.length) { return Array.isArray(arr) ? [] : arr; }
	const copia = JSON.parse(JSON.stringify(arr));
	const fila = copia[copia.length - 1];
	if (fila && typeof fila === 'object') {
		fila.importe = copia.filter(x => x && x.id !== -2 && x.id !== -3 && String(x.descripcion || '').toUpperCase() !== 'TOTAL')
			.map(x => parseFloat(x.importe)).reduce((s, n) => s + n, 0);
	}
	return copia.filter(x => !(x && (x.id === -2 || x.id === -3)));
}

/** Importe de la fila TOTAL de los subtotales; null si no esta. */
export function totalDeSubtotales(subtotales) {
	if (!Array.isArray(subtotales)) { return null; }
	const fila = subtotales.find(s => s && String(s.descripcion || '').toUpperCase() === 'TOTAL');
	return fila ? numero(fila.importe) : null;
}

/**
 * Una fila de op=7 → pedido delivery (como xCDCocinarDataItemPedido). null si esta anulado (estado 3).
 * @param {object} fila de procedure_refresh_delivery
 * @param {number} ahoraMs
 * @param {(subtotales: object[]) => object[]} [subtotales] formato de subtotales de la sede (darFormatoSubTotalesDelivery
 *   si no es reparto propio); por defecto los del pedido tal cual
 */
export function pedidoDeOp7(fila, ahoraMs, subtotales = s => s) {
	if (!fila || fila.idpedido == null || String(fila.estado) === '3') { return null; }
	const json = leerJsonDelivery(fila.json_datos_delivery);
	const header = json && json.p_header ? json.p_header : {};
	const datos = header.arrDatosDelivery && typeof header.arrDatosDelivery === 'object' ? header.arrDatosDelivery : {};
	const subs = json && Array.isArray(json.p_subtotales) ? subtotales(JSON.parse(JSON.stringify(json.p_subtotales))) : null;
	const total = totalDeSubtotales(subs);
	const pwa = String(fila.pwa_estado || '').toUpperCase();
	const rep = fila.nom_repartidor ? titulo(fila.nom_repartidor) : '';
	const est = pwa === 'R' ? 'cam' : (pwa === 'E' ? 'entregado' : (rep ? 'proc' : 'sin'));
	return {
		t: 'delivery', id: String(fila.idpedido), tarjeta: false,
		n: numeroPedido(fila.correlativo_dia, fila.idpedido),
		quien: titulo(datos.nombre || datos.nombres || header.nombres || fila.nom_cliente || '') || 'Cliente',
		hora: String(fila.hora || ''), min: minutosDesde(fila.hora, ahoraMs),
		imp: total ?? numero(fila.total) ?? 0,
		est, pag: String(fila.estado) === '2',
		tel: String(datos.telefono || fila.tel_cliente || '').trim(),
		dir: titulo(datos.direccion || ''),
		rep,
		items: json ? textoItems(json.p_body) : '',
		comprobante: String(header.num_comprobante || '').trim(),
		json: json && json.p_body && subs ? { p_body: json.p_body, p_subtotales: subs } : null,
	};
}

/** Los minutos al dia de pedidos leidos antes (op=7 se pide cada minuto; el panel se repinta mas seguido). */
export function conMinutos(lista, ahoraMs) {
	return lista.map(p => (p.hora ? { ...p, min: minutosDesde(p.hora, ahoraMs) } : p));
}

/** Las filas de op=7 (respuesta {datos: [...]}) como pedidos delivery, sin anulados ni repetidos. */
export function deliveryDeOp7(respuesta, ahoraMs, subtotales) {
	const filas = respuesta && Array.isArray(respuesta.datos) ? respuesta.datos : [];
	const vistos = new Set();
	const r = [];
	for (const f of filas) {
		const p = pedidoDeOp7(f, ahoraMs, subtotales);
		if (p && !vistos.has(p.id)) { vistos.add(p.id); r.push(p); }
	}
	return r;
}

/**
 * Delivery del panel: los de op=7 (null = aun no se pidio) y los abiertos de la grilla que op=7 no trae (de otro
 * dia, o antes de la primera respuesta). Con tarjeta en la grilla = se puede abrir y cobrar.
 */
export function unirDelivery(deOp7, deGrilla) {
	const cartas = new Map(deGrilla.filter(p => p.t === 'delivery').map(p => [p.id, p]));
	const lista = (deOp7 || []).map(p => (cartas.has(p.id) && !p.pag ? { ...p, tarjeta: true } : p));
	const ids = new Set(lista.map(p => p.id));
	return [...lista, ...[...cartas.values()].filter(p => !ids.has(p.id))];
}

/** Primero los que faltan cobrar; dentro de cada grupo, el mas reciente arriba (sin hora, al final). */
export function ordenar(lista) {
	const min = p => (p.min == null ? Infinity : p.min);
	return [...lista].sort((a, b) => (Number(a.pag) - Number(b.pag)) || (min(a) - min(b)));
}

/** Buscar: cliente, #pedido (con o sin ceros / el id), telefono, direccion, repartidor, platos o comprobante. */
export function coincide(p, q) {
	const buscado = normalizar(q).replace(/^#/, '');
	if (!buscado) { return true; }
	if (/^\d+$/.test(buscado) && (Number(buscado) === Number(p.n) || buscado === p.id)) { return true; }
	const telefono = String(p.tel || '').replace(/\D/g, '');
	if (/^\d{3,}$/.test(buscado.replace(/\s/g, '')) && telefono.includes(buscado.replace(/\s/g, ''))) { return true; }
	return [p.n, p.quien, p.tel, p.dir, p.rep, p.items, p.comprobante].some(v => v && normalizar(v).includes(buscado));
}

/** Suma de importes. */
export const total = lista => lista.reduce((a, p) => a + (Number(p.imp) || 0), 0);

/** Lo de una pestaña ya filtrado y ordenado, en sus dos grupos con cantidad y total. */
export function grupos(lista, q) {
	const l = ordenar(lista.filter(p => coincide(p, q)));
	const porCobrar = l.filter(p => !p.pag), pagados = l.filter(p => p.pag);
	return {
		lista: l,
		porCobrar: { pedidos: porCobrar, total: total(porCobrar) },
		pagados: { pedidos: pagados, total: total(pagados) },
	};
}

/** "3 pedidos · S/ 120.50" */
export function pie(lista) {
	return `${lista.length} pedido${lista.length === 1 ? '' : 's'} · ${soles(total(lista))}`;
}

/** Numeros del boton: cuantos de cada uno y si alguno esta tarde (una reserva no se marca tarde). */
export function conteos(llevar, delivery, reservas = []) {
	return {
		llevar: { n: llevar.length, tarde: llevar.some(esTarde) },
		delivery: { n: delivery.length, tarde: delivery.some(esTarde) },
		reserva: { n: reservas.length, tarde: false },
	};
}

/** Numero de comprobante como lo guarda Control de Delivery: B001-123 (primera letra del tipo, serie, correlativo). */
export function numeroComprobante(comprobante, correlativo) {
	const des = String(comprobante && comprobante.descripcion || '');
	return `${des.substr(0, 1).toUpperCase()}${comprobante && comprobante.serie != null ? comprobante.serie : ''}-${correlativo}`;
}
