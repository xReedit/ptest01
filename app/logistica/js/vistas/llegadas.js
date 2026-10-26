// Lo que llego al almacen de la central (central): lista de llegadas (con o sin orden de compra) -> detalle con
// que llego, cuanto se pidio, precio, lote/vencimiento, quien lo recibio y a que almacen entro.
import { cargarHistorias } from '../historia.js?v=20261026a';
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, paginador, fecha } from '../ui.js?v=20261026a';
import { vigente, turnoActual } from '../router.js?v=20261026a';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
/** Resumen de lo que anoto el recepcionista: completa, falto, cambio, observaciones. */
function chips(f) {
	if (!f.idorden) { return '<span class="inv-muted">—</span>'; }
	const c = [];
	if (Number(f.faltan)) { c.push(`<span class="inv-estado borrador"><i class="fa fa-exclamation-triangle"></i>Faltan ${f.faltan}</span>`); }
	if (Number(f.cambios)) { c.push(`<span class="inv-estado anulado"><i class="fa fa-exchange"></i>${f.cambios} cambiado(s)</span>`); }
	if (Number(f.notas)) { c.push(`<span class="inv-estado cerrado"><i class="fa fa-comment-o"></i>${f.notas} nota(s)</span>`); }
	return c.length ? c.join(' ') : '<span class="inv-estado aprobado"><i class="fa fa-check"></i>Completa</span>';
}
const soles = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Cuentas por pagar del POS (ahi se registran los pagos). Desde app/logistica/js/vistas -> app/page/m_panel.html
const CUENTAS = new URL('../../../page/m_panel.html#/cuentas_p_c', import.meta.url).href;
const PERIODOS = [['hoy', 'Hoy'], ['7', 'Últimos 7 días'], ['15', 'Últimos 15 días'], ['semana', 'Esta semana'], ['mes', 'Este mes'], ['mes_pasado', 'Mes pasado'], ['todo', 'Todas las fechas']];
const PAGOS = [['todas', 'Pagadas y por pagar'], ['por_pagar', 'Solo por pagar'], ['pagadas', 'Solo pagadas']];
let filtro = { periodo: 'mes', pago: 'todas' };
let pedido = 0;   // lista y detalle: solo vale la ultima peticion (una respuesta lenta no pisa a la nueva)

/** Pago de una compra, como en Cuentas por pagar: a credito y sin pagar = debe. */
function pago(f) {
	return Number(f.debe)
		? `<span class="inv-estado borrador"><i class="fa fa-clock-o"></i>Por pagar ${soles(f.pendiente)}</span>${f.f_pago ? `<span class="inv-sub">vence ${esc(fecha(f.f_pago))}</span>` : ''}`
		: '<span class="inv-estado aprobado"><i class="fa fa-check"></i>Pagada</span>';
}

export async function render(cont, sesion, t) {
	// desde el diagrama: "Debes a proveedores" -> por pagar de todas las fechas; "Compraste" -> ese periodo
	let f = null;
	try { f = sessionStorage.getItem('lg_llegadas_filtro'); sessionStorage.removeItem('lg_llegadas_filtro'); } catch (e) { /* sin filtro */ }
	if (f === 'por_pagar') { filtro = { periodo: 'todo', pago: 'por_pagar' }; }
	else if (f && PERIODOS.some(p => p[0] === f)) { filtro = { periodo: f, pago: 'todas' }; }
	await lista(cont, 1, t);
}

async function lista(cont, pagina, t) {
	const mio = ++pedido;
	const d = await api(`recepcion_oc.php?op=llegadas&pagina=${pagina}&periodo=${filtro.periodo}&pago=${filtro.pago}`);
	if (mio !== pedido || (t !== undefined && !vigente(t))) { return; }
	const r = d.resumen;
	const nombrePer = (PERIODOS.find(p => p[0] === d.periodo) || [, ''])[1].toLowerCase();
	cont.innerHTML = tarjeta({
		titulo: 'Lo que llegó al almacén',
		ayuda: 'Cada compra que entró a la central (con orden de compra o compra directa). Clic en una para ver qué llegó, quién lo recibió y a qué almacén entró.',
		acciones: `${volver()}<a class="btn btn-sm btn-success" href="#" data-ir="recepcion"><i class="fa fa-download"></i>Recibir mercadería</a>`,
		cuerpo: `<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Fechas</span><select class="inv-select" id="ll_per">
					${PERIODOS.map(([v, x]) => `<option value="${v}" ${v === d.periodo ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
				<div class="inv-field"><span class="inv-label">Pago</span><select class="inv-select" id="ll_pago">
					${PAGOS.map(([v, x]) => `<option value="${v}" ${v === d.pago ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
			</div>
			<div class="lg-ficha" style="margin-bottom:10px">
				<div><span class="inv-label">Comprado (${esc(nombrePer)})</span><b style="font-size:18px">${soles(r.comprado)}</b><span class="inv-sub">${d.meta.total} compra(s)</span></div>
				<div><span class="inv-label">Ya pagado</span><b style="font-size:18px">${soles(r.pagado)}</b></div>
				<div><span class="inv-label">Por pagar (${esc(nombrePer)})</span><b style="font-size:18px" class="${r.por_pagar > 0 ? 'inv-neg' : ''}">${soles(r.por_pagar)}</b><span class="inv-sub">${r.n_por_pagar} compra(s) a crédito</span></div>
				<div><span class="inv-label">Debes en total a proveedores</span><b style="font-size:18px" class="${r.deuda_total > 0 ? 'inv-neg' : ''}">${soles(r.deuda_total)}</b><span class="inv-sub">todas las fechas</span></div>
			</div>
			<p class="lg-alerta" style="margin:0 0 10px"><i class="fa fa-info-circle"></i> Las compras <b>a crédito</b> quedan <b>por pagar</b>. Cuando le pagues al proveedor,
				regístralo en <a href="${CUENTAS}" target="_top"><b>Cuentas por pagar</b></a> y aquí aparecerá como <b>Pagada</b>.</p>
			${d.filas.length ? `<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>Llegó</th><th>Proveedor</th><th>Orden</th><th>Comprobante</th><th>Recibió</th><th>Almacén</th>
				<th style="text-align:right">Total</th><th>Pago</th><th>Cómo llegó</th><th></th></tr></thead>
			<tbody>${d.filas.map(f => `<tr style="cursor:pointer" data-llegada="${f.idcompra}">
				<td>${esc(f.registrado)}</td><td><b>${esc(f.proveedor)}</b><span class="inv-sub">${f.productos} producto(s)</span></td>
				<td>${f.idorden ? 'OC N° ' + f.idorden : '<span class="inv-muted">compra directa</span>'}</td>
				<td>${esc(f.comprobante) || '<span class="inv-muted">—</span>'}</td><td>${esc(f.recibio)}</td><td>${esc(f.almacen)}</td>
				<td style="text-align:right">${soles(f.total)}</td><td>${pago(f)}</td><td>${chips(f)}</td>
				<td class="inv-acciones"><span class="inv-link"><i class="fa fa-folder-open-o"></i>Ver</span></td></tr>`).join('')}
			</tbody></table></div>${paginador(d.meta)}`
			: `<p class="inv-empty">No hay compras ${esc(nombrePer)}${d.pago === 'por_pagar' ? ' por pagar' : d.pago === 'pagadas' ? ' pagadas' : ''}.</p>`}`,
	});
	const card = cont.querySelector('.xContentCard') || cont;
	const cambiar = () => {
		filtro = { periodo: cont.querySelector('#ll_per').value, pago: cont.querySelector('#ll_pago').value };
		lista(cont, 1, turnoActual()).catch(err => aviso(err.message, 'error'));
	};
	cont.querySelector('#ll_per').addEventListener('change', cambiar);
	cont.querySelector('#ll_pago').addEventListener('change', cambiar);
	card.addEventListener('click', e => {
		const pg = e.target.closest('[data-pag]');
		if (pg) { lista(cont, Number(pg.dataset.pag), turnoActual()).catch(err => aviso(err.message, 'error')); return; }
		const tr = e.target.closest('[data-llegada]');
		if (tr) { detalle(cont, Number(tr.dataset.llegada), pagina); }
	});
}

async function detalle(cont, id, pagina) {
	const t = turnoActual(), mio = ++pedido;
	const sigue = () => mio === pedido && vigente(t);
	let d;
	try { d = await api('recepcion_oc.php?op=llegada&id=' + id); } catch (err) { if (sigue()) { aviso(err.message, 'error'); } return; }
	if (!sigue()) { return; }   // el usuario ya abrio otra cosa
	const c = d.cabecera;
	const items = d.items.map(i => ({ ...i, cantidad: Number(i.cantidad), pedido: i.pedido === null ? null : Number(i.pedido),
		recibido_total: i.recibido_total === null ? null : Number(i.recibido_total), punitario: Number(i.punitario), ptotal: Number(i.ptotal) }));
	// estado de cada fila, en palabras simples
	const estado = i => {
		if (i.origen === 'no_llego') { return `<span class="inv-estado borrador"><i class="fa fa-times"></i>No llegó</span>`; }
		if (i.origen === 'reemplazo') { return `<span class="inv-estado anulado"><i class="fa fa-exchange"></i>Cambiado</span>`; }
		if (!i.cantidad) { return `<span class="inv-estado borrador"><i class="fa fa-times"></i>No llegó</span>`; }
		if (i.pedido !== null && i.recibido_total < i.pedido) { return `<span class="inv-estado borrador"><i class="fa fa-exclamation-triangle"></i>Faltan ${num(i.pedido - i.recibido_total)}</span>`; }
		return c.idorden ? '<span class="inv-estado aprobado"><i class="fa fa-check"></i>Completo</span>' : '';
	};
	const problemas = items.filter(i => i.origen !== 'pedido' || !i.cantidad || (i.pedido !== null && i.recibido_total < i.pedido));
	cont.innerHTML = tarjeta({
		titulo: `Llegada de ${c.proveedor}`,   // tarjeta() ya escapa el titulo
		ayuda: `${c.idorden ? `Orden de compra N° ${c.idorden}` : 'Compra directa (sin orden)'} · registrada el ${esc(c.registrado)}`,
		acciones: `<button class="btn btn-sm btn-light" id="ll_volver"><i class="fa fa-arrow-left"></i>Todas las llegadas</button>`,
		cuerpo: `<div class="lg-ficha">
				<div><span class="inv-label">Recibió</span><b>${esc(c.recibio)}</b></div>
				<div><span class="inv-label">Entró al almacén</span><b>${esc(c.almacen) || '—'}</b></div>
				<div><span class="inv-label">Fecha de la compra</span><b>${esc(c.f_compra) || '—'}</b></div>
				<div><span class="inv-label">Comprobante</span><b>${esc(c.comprobante) || '—'}</b></div>
				<div><span class="inv-label">Total</span><b>${soles(c.total)}</b></div>
				<div><span class="inv-label">Pago</span>${Number(c.debe) ? `<b class="inv-neg">Por pagar ${soles(c.pendiente)}</b>${c.f_pago ? `<span class="inv-sub">vence ${esc(fecha(c.f_pago))}</span>` : ''}
					<span class="inv-sub"><a href="${CUENTAS}" target="_top">Registrar el pago en Cuentas por pagar</a></span>` : '<b class="inv-pos">Pagada</b>'}</div>
			</div>
			${c.observacion ? `<p class="lg-alerta"><i class="fa fa-comment-o"></i> <b>Observación de la recepción:</b> ${esc(c.observacion)}</p>` : ''}
			${c.idorden ? `<details class="lg-tl-det"><summary><i class="fa fa-history"></i>Ver historia de la orden N° ${c.idorden}</summary><div data-historia="oc:${c.idorden}"></div></details>` : ''}
			${c.idorden ? (problemas.length
				? `<p class="lg-alerta"><i class="fa fa-exclamation-triangle"></i> ${problemas.length} producto(s) no llegaron como se pidieron. Míralos abajo.</p>`
				: '<p class="inv-ayuda" style="margin:8px 0 0"><i class="fa fa-check-circle inv-pos"></i> Llegó todo lo que se pidió.</p>') : ''}
			<div class="inv-table-wrap" style="margin-top:10px"><table class="inv-table">
				<thead><tr><th>Producto</th>${c.idorden ? '<th style="text-align:right">Se pidió</th>' : ''}<th style="text-align:right">Llegó</th>
					${c.idorden ? '<th>Cómo llegó</th>' : ''}<th style="text-align:right">Precio</th><th style="text-align:right">Total</th><th>Lote · vence</th></tr></thead>
				<tbody>${items.map(i => `<tr>
					<td><b>${esc(i.descripcion)}</b>${i.en_lugar_de ? `<span class="inv-sub inv-neg">en lugar de ${esc(i.en_lugar_de)}</span>` : ''}
						${i.nota ? `<span class="inv-sub"><i class="fa fa-comment-o"></i> ${esc(i.nota)}</span>` : ''}</td>
					${c.idorden ? `<td style="text-align:right">${i.pedido === null ? '<span class="inv-muted">—</span>' : num(i.pedido)}</td>` : ''}
					<td style="text-align:right">${i.cantidad ? `<b>${num(i.cantidad)}</b>` : '<span class="inv-neg">0</span>'} <span class="inv-muted">${esc(i.unidad || 'und')}</span></td>
					${c.idorden ? `<td>${estado(i)}</td>` : ''}
					<td style="text-align:right">${i.cantidad ? soles(i.punitario) : ''}</td><td style="text-align:right">${i.cantidad ? soles(i.ptotal) : ''}</td>
					<td>${i.lotes.length ? i.lotes.map(l => `${esc(l.lote || 's/l')}${l.vence ? ' · ' + esc(fecha(l.vence)) : ''} <span class="inv-muted">(${num(l.cantidad)})</span>`).join('<br>') : '<span class="inv-muted">—</span>'}</td>
				</tr>`).join('')}</tbody></table></div>`,
	});
	cont.querySelector('#ll_volver').addEventListener('click', () => lista(cont, pagina, turnoActual()).catch(err => aviso(err.message, 'error')));
}
