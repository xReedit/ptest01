// Bandeja central (F3), en dos pasos simples:
//  1) Lista de pedidos de las sedes (uno por fila, con un resumen en palabras).
//  2) Al hacer clic: el detalle de ESE pedido (sede, fecha y nota una sola vez; una fila por producto) con la
//     propuesta de donde sale cada cosa: almacen central, traslado desde una sede con stock parado, o comprar.
// La propuesta la calcula el servidor para TODOS los pedidos juntos (el stock del central se reparte por orden de llegada).
import { cargarHistorias } from '../historia.js?v=20261015i';
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver, confirmar, nuevoToken, fecha } from '../ui.js?v=20261015i';
import { vigente, recargar, turnoActual } from '../router.js?v=20261015i';

const MODOS = [
	['auto', 'Lo que propone el sistema'],
	['central', 'Todo del almacén central'],
	['compra', 'Todo comprar'],
	['produccion', 'Todo producir'],
	['rechazo', 'No atender'],
];

let estado = { pedidos: [], abierto: null, modos: {} };
const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
/** Cuanto lleva esperando el pedido: normal < 2 h, ambar hasta 24 h, rojo mas de un dia. */
function espera(min) {
	const m = Math.max(0, Number(min) || 0);
	const txt = m < 1 ? 'recién' : m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`
		: `${Math.floor(m / 1440)} día${m >= 2880 ? 's' : ''}${Math.floor((m % 1440) / 60) ? ' ' + Math.floor((m % 1440) / 60) + ' h' : ''}`;
	const cls = m >= 1440 ? 'anulado' : m >= 120 ? 'borrador' : 'cerrado';
	return `<span class="inv-estado ${cls}"><i class="fa fa-clock-o"></i>${txt}</span>`;
}

/** De la respuesta agrupada por producto arma la lista de pedidos, cada uno con sus lineas y el dato del producto. */
function porPedido(productos) {
	const m = new Map();
	productos.forEach(p => p.lineas.forEach(l => {
		if (!m.has(l.idsol)) { m.set(l.idsol, { idsol: l.idsol, sede: l.sede, fecha: l.fecha, nota: l.nota, usuario: l.usuario, minutos: Number(l.minutos), lineas: [] }); }
		m.get(l.idsol).lineas.push({ ...l, prod: p });
	}));
	return [...m.values()].sort((a, b) => a.idsol - b.idsol);
}

export async function render(cont, sesion, t) {
	const datos = await api('bandeja.php?op=abrir', {});
	if (!vigente(t)) { return; }
	estado = { pedidos: porPedido(datos.productos), abierto: null, modos: {}, central: datos.idsede_central, planta: datos.planta };
	pintarLista(cont);
	if (datos.automaticos) { aviso(`Se armaron ${datos.automaticos} pedido(s) automáticos: sedes que quedaron en su stock mínimo.`); }
}

const partesDe = l => {
	const m = estado.modos[l.iddet] || 'auto';
	if (m === 'auto') { return l.partes; }
	return [m === 'produccion' && estado.planta ? { decision: m, cantidad: l.cant, sede_origen: estado.planta.nombre } : { decision: m, cantidad: l.cant }];
};

/** "2 salen del central · 1 se traslada · 3 hay que comprar" */
function resumenPedido(p) {
	const c = { central: 0, traslado: 0, compra: 0, produccion: 0 };
	p.lineas.forEach(l => partesDe(l).forEach(x => { if (c[x.decision] !== undefined) { c[x.decision]++; } }));
	return [c.central && `${c.central} sale(n) del central`, c.traslado && `${c.traslado} se traslada(n) de otra sede`,
		c.produccion && `${c.produccion} se produce(n) en ${estado.planta ? estado.planta.nombre : 'la planta'}`,
		c.compra && `${c.compra} hay que comprar`].filter(Boolean).join(' · ');
}

function pintarLista(cont) {
	const peds = estado.pedidos;
	cont.innerHTML = tarjeta({
		titulo: 'Bandeja central',
		ayuda: 'Pedidos que las sedes enviaron a la central. Abre uno para ver de dónde sale cada producto y aceptarlo.',
		acciones: volver(),
		cuerpo: peds.length ? `
			<div class="inv-kpis">
				<div class="inv-kpi inv-kpi-azul"><span>PEDIDOS POR ATENDER</span><b>${peds.length}</b></div>
				<div class="inv-kpi inv-kpi-celeste"><span>SEDES QUE PIDIERON</span><b>${new Set(peds.map(p => p.sede)).size}</b></div>
			</div>
			<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>N°</th><th>Sede</th><th>Pidió</th><th>Fecha y hora</th><th>Esperando</th><th>Productos</th><th>Qué propone el sistema</th><th></th></tr></thead>
				<tbody>${peds.map(p => `
					<tr style="cursor:pointer" data-abrir="${p.idsol}">
						<td><b>${p.idsol}</b></td>
						<td>${esc(p.sede)}${p.nota ? `<span class="inv-sub">${esc(p.nota)}</span>` : ''}</td>
						<td>${esc(p.usuario || 'Automático')}</td>
						<td>${esc(fecha(p.fecha))}</td>
						<td>${espera(p.minutos)}</td>
						<td>${p.lineas.length}</td>
						<td class="inv-ayuda">${esc(resumenPedido(p))}</td>
						<td class="inv-acciones"><span class="inv-link"><i class="fa fa-folder-open-o"></i>Abrir</span></td>
					</tr>`).join('')}
				</tbody>
			</table></div>`
			: '<p class="inv-empty"><i class="fa fa-check-circle"></i>No hay pedidos de las sedes por atender.</p>',
	});
	cont.querySelector('.xContentCard').addEventListener('click', e => {
		const tr = e.target.closest('[data-abrir]');
		if (tr) { estado = { ...estado, abierto: Number(tr.dataset.abrir) }; pintarPedido(cont); cont.scrollIntoView({ block: 'start' }); }
	});
}

function chip(x, prod) {
	if (x.decision === 'central') {
		// forzado a central sin stock: se acepta, pero no se podra enviar hasta que llegue lo que falta
		const falta = x.cantidad - Math.max(0, prod.libre_central);
		return `<span class="inv-estado cerrado"><i class="fa fa-home"></i>Del central: ${num(x.cantidad)}</span>`
			+ (falta > 0.0001 ? `<span class="inv-estado lg-sube" title="No se crea compra. El envío queda esperando hasta que entre stock al central.">`
				+ `<i class="fa fa-exclamation-triangle"></i>Faltan ${num(falta)}: no se podrá enviar</span>` : '');
	}
	if (x.decision === 'produccion') {
		return `<span class="inv-estado aprobado"><i class="fa fa-flask"></i>Producir: ${num(x.cantidad)} en ${esc(x.sede_origen || (estado.planta ? estado.planta.nombre : 'la planta'))}</span>`;
	}
	if (x.decision === 'traslado') {
		return `<span class="inv-estado aprobado" title="${x.dias_stock ? `Allá le alcanza para ${x.dias_stock} días` : 'Allá no se vende'}">`
			+ `<i class="fa fa-exchange"></i>Traer ${num(x.cantidad)} de ${esc(x.sede_origen || '')}</span>`;
	}
	if (x.decision === 'compra') {
		let pres = '';
		if (prod.presentacion) { const [n, f] = prod.presentacion.split('|'); pres = ` (≈ ${num(Math.ceil(x.cantidad / Number(f) * 10) / 10)} ${n})`; }
		return `<span class="inv-estado borrador"><i class="fa fa-shopping-cart"></i>Comprar: ${num(x.cantidad)}${esc(pres)}</span>`;
	}
	return '<span class="inv-estado anulado"><i class="fa fa-ban"></i>No se atiende</span>';
}

// Esta en otro almacen de la central (ej. PRODUCCION): se pasa al principal y la propuesta se recalcula (sale del central)
async function pasarAlPrincipal(cont, btn, idsol) {
	const q = Number(btn.dataset.q);
	const ok = await confirmar({
		titulo: `¿Pasar ${num(q)} de ${btn.dataset.nombre} al almacén principal?`, peligro: false, boton: 'Sí, pasar',
		textoHtml: `<p style="margin:0">Salen de <b>${esc(btn.dataset.almacen)}</b> y entran al almacén principal de la central. Así este pedido sale de ahí y no se compra.</p>`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	if (!btn.dataset.tk) { btn.dataset.tk = nuevoToken('bp'); }   // mismo token en el reintento: no se mueve dos veces
	const t = turnoActual();
	try {
		// si ya se movio en un intento anterior (fallo solo la recarga), no se vuelve a mover
		if (!btn.dataset.movido) {
			await api('traslados.php?op=mover_almacen', { idsede: estado.central, idproducto_central: Number(btn.dataset.pasar), desde: Number(btn.dataset.desde),
				cantidad: q, token: btn.dataset.tk });
			btn.dataset.movido = '1';
			aviso(`Listo: ${num(q)} ya están en el almacén principal.`);
		}
		const d = await api('bandeja.php?op=abrir', {});
		if (!vigente(t) || estado.abierto !== idsol) { return; }   // el usuario ya esta en otra pantalla u otro pedido
		estado = { ...estado, pedidos: porPedido(d.productos), abierto: idsol };
		pintarPedido(cont);
	} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
}

const ESTADO_OC = {
	por_aprobar: 'está <b>esperando aprobación</b>',
	aprobada: 'está aprobada pero <b>aún no se envía al proveedor</b>',
	enviada: 'ya se pidió al proveedor y <b>aún no entrega</b>',
	parcial: 'el proveedor <b>entregó una parte</b> y falta el resto',
};

/** Debajo de la tabla: para cada producto forzado al central sin stock, que pasa con las compras de ese producto. */
function notasFaltan(p) {
	const notas = p.lineas.map(l => {
		const falta = estado.modos[l.iddet] === 'central' ? l.cant - Math.max(0, l.prod.libre_central) : 0;
		if (falta <= 0.0001) { return ''; }
		const ocs = l.prod.compras || [];
		const nombre = `<b>${esc(l.prod.descripcion)}</b>: faltan ${num(falta)}.`;
		if (!ocs.length) {
			return `<li>${nombre} <b>No hay ninguna orden de compra</b> para este producto. Mejor elige <b>Lo que propone el sistema</b> para que se compre.</li>`;
		}
		const viene = ocs.reduce((s, o) => s + o.falta, 0);
		return `<li>${nombre} ${ocs.map(o => `La orden N° ${o.idorden}${o.proveedor ? ` (${esc(o.proveedor)})` : ''} por ${num(o.falta)} ${ESTADO_OC[o.estado] || ''}${o.estado === 'enviada' || o.estado === 'parcial' ? ` (pedida el ${esc(o.fecha)})` : ''}.`).join(' ')}`
			+ (viene + 0.0001 < falta ? ` <b>No alcanza:</b> aún faltarían ${num(falta - viene)}.` : ' El pedido saldrá cuando llegue.') + '</li>';
	}).filter(Boolean);
	if (!notas.length) { return ''; }
	return `<div class="lg-mover" style="margin-top:12px"><p style="margin:0 0 6px"><i class="fa fa-exclamation-triangle"></i>
		<b>Todo del almacén central</b> conviene solo si ya hay una compra en camino. Lo que falta no se compra solo: el envío espera hasta que entre stock al central.</p>
		<ul style="margin:0;padding-left:18px">${notas.join('')}</ul></div>`;
}

function pintarPedido(cont) {
	const p = estado.pedidos.find(x => x.idsol === estado.abierto);
	if (!p) { pintarLista(cont); return; }
	cont.innerHTML = tarjeta({
		titulo: `Pedido N° ${p.idsol} · ${p.sede}`,
		ayuda: `Pidió <b>${esc(p.usuario || 'el sistema (automático)')}</b> el ${esc(fecha(p.fecha))} · esperando ${espera(p.minutos)}${p.nota ? ` · Nota: <b>${esc(p.nota)}</b>` : ''}. `
			+ 'El sistema propone de dónde sale cada producto. Si quieres, cámbialo y presiona <b>Aceptar pedido</b>.',
		acciones: `<button class="btn btn-sm btn-light" id="bj_volver"><i class="fa fa-arrow-left"></i>Todos los pedidos</button>
			<button class="btn btn-sm btn-success" id="bj_aceptar"><i class="fa fa-check"></i>Aceptar pedido N° ${p.idsol}</button>`,
		cuerpo: `
			<p class="inv-ayuda" style="margin:0 0 10px"><i class="fa fa-info-circle"></i> ${esc(resumenPedido(p))}</p>
			<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Producto</th><th style="text-align:right">Pidió</th><th style="text-align:right" class="lg-oc">Hay en el central</th>
					<th>De dónde sale</th><th class="lg-oc">Cambiar</th></tr></thead>
				<tbody>${p.lineas.map(l => `
					<tr>
						<td>${esc(l.prod.descripcion)}<span class="inv-sub">${esc(l.prod.familia)}${l.prod.proveedor ? ' · proveedor ' + esc(l.prod.proveedor) : ''}</span></td>
						<td style="text-align:right"><b>${num(l.cant)}</b> <span class="inv-muted">${esc(l.prod.unidad || 'und')}</span></td>
						<td style="text-align:right" class="lg-oc">${num(l.prod.stock_central)}${(l.prod.otros || []).map(o => {
							const q = Math.min(Math.max(0, l.cant - l.prod.stock_central), o.stock);
							return q > 0 ? `<div class="lg-mover" style="text-align:left"><i class="fa fa-lightbulb-o"></i> Hay ${num(o.stock)} en <b>${esc(o.almacen)}</b>.
								<button class="btn btn-sm btn-success" data-pasar="${l.prod.idproducto_central}" data-desde="${o.idalmacen}" data-almacen="${esc(o.almacen)}"
									data-q="${q}" data-nombre="${esc(l.prod.descripcion)}"><i class="fa fa-arrow-right"></i>Pasar ${num(q)} al principal</button></div>` : '';
						}).join('')}</td>
						<td><div style="display:flex;flex-wrap:wrap;gap:4px">${partesDe(l).map(x => chip(x, l.prod)).join('')}</div></td>
						<td class="lg-oc"><select class="inv-select bj-modo" data-id="${l.iddet}" style="width:210px">
							${MODOS.filter(([v]) => v !== 'produccion' || l.prod.produce).map(([v, txt]) => `<option value="${v}" ${(estado.modos[l.iddet] || 'auto') === v ? 'selected' : ''}>${txt}</option>`).join('')}
						</select></td>
					</tr>`).join('')}
				</tbody>
			</table></div>${notasFaltan(p)}<div data-historia="pedido:${p.idsol}"></div>`,
	});
	cargarHistorias(cont);
	cont.querySelector('#bj_volver').addEventListener('click', () => { estado = { ...estado, abierto: null }; pintarLista(cont); });
	cont.querySelectorAll('[data-pasar]').forEach(b => b.addEventListener('click', () => pasarAlPrincipal(cont, b, p.idsol)));
	cont.querySelector('#bj_aceptar').addEventListener('click', e => aceptar(p, e.currentTarget));
	cont.querySelector('.xContentCard').addEventListener('change', e => {
		const sel = e.target.closest('.bj-modo');
		if (sel) { estado = { ...estado, modos: { ...estado.modos, [sel.dataset.id]: sel.value } }; pintarPedido(cont); }
	});
}

async function aceptar(p, btn) {
	const lineas = p.lineas.map(l => ({ iddet: l.iddet, partes: partesDe(l).map(x => ({ decision: x.decision, cantidad: x.cantidad, idsede_origen: x.idsede_origen })) }));
	const ok = await confirmar({
		titulo: `¿Aceptar el pedido N° ${p.idsol} de ${p.sede}?`,
		peligro: false,
		boton: 'Sí, aceptar',
		textoHtml: `<p style="margin:0 0 8px">${esc(resumenPedido(p))}.</p>
			<p class="inv-ayuda" style="margin:0">Lo que hay que comprar pasa a <b>Órdenes de compra</b>. ${esc(p.sede)} verá su pedido como <b>Preparando</b>.</p>`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	try {
		await api('bandeja.php?op=aceptar', { lineas });
		aviso(`Pedido N° ${p.idsol} aceptado.`);
		recargar();   // vuelve a la lista: el stock del central se recalcula para los pedidos que quedan
	} catch (err) {
		aviso(err.message, 'error');
		btn.disabled = false;
	}
}
