// Proveedores (central): como cumple cada uno (a tiempo, completo, precio; ultimos 90 dias) y, debajo, que subio de
// precio en la ultima compra, cuanto, y quien lo vende mas barato. Clic en un producto: su historial de compras.
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver, fecha } from '../ui.js?v=20261015i';
import { vigente, turnoActual } from '../router.js?v=20261015i';

const soles = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FILTROS = [['subieron', 'Lo que subió de precio'], ['mas_barato', 'Lo que otro vende más barato'], ['todos', 'Todos los productos comprados']];
let filtro = 'subieron';
let pedidoHist = 0;   // solo vale el ultimo producto clicado

function cambio(p, alerta) {
	if (p.cambio_pct === null) { return '<span class="inv-muted">primera compra</span>'; }
	if (p.cambio_pct === 0) { return '<span class="inv-muted">igual</span>'; }
	const sube = p.cambio_pct > 0;
	return `<span class="inv-estado ${sube ? (p.cambio_pct >= alerta ? 'lg-sube' : 'borrador') : 'aprobado'}">${sube ? '▲' : '▼'} ${Math.abs(p.cambio_pct)}%</span>
		<span class="inv-sub">antes ${soles(p.anterior.precio)} (${esc(fecha(p.anterior.fecha))})</span>`;
}

const pct = (a, b) => b ? Math.round(a / b * 100) + '%' : '';

function calificacion(d) {
	const fila = p => {
		const cls = p.estrellas === null ? '' : p.estrellas >= 4 ? 'aprobado' : p.estrellas >= 3 ? 'borrador' : 'lg-sube';
		const med = p.a_tiempo + p.tarde;
		return `<tr>
		<td><b>${esc(p.proveedor)}</b><span class="inv-sub">${p.ordenes} orden(es)</span>
			${p.problemas.length ? `<details><summary class="inv-link" style="cursor:pointer">Ver ${p.problemas.length} problema(s)</summary><ul style="margin:6px 0 0;padding-left:18px">
				${p.problemas.map(x => `<li>Orden N° ${x.idorden} (${esc(fecha(x.fecha))}): ${esc(x.texto)}</li>`).join('')}</ul></details>` : ''}</td>
		<td>${p.estrellas === null ? '<span class="inv-muted">Sin datos aún</span>' : `<span class="inv-estado ${cls}">★ ${String(p.estrellas).replace('.', ',')} ${esc(p.etiqueta)}</span>`}</td>
		<td>${med ? `<b>${pct(p.a_tiempo, med)}</b><span class="inv-sub">${p.a_tiempo} de ${med}${p.tarde ? ` · ${Math.round(p.dias_tarde / p.tarde * 10) / 10} día(s) tarde en promedio` : ''}</span>` : '<span class="inv-muted">—</span>'}</td>
		<td>${p.items ? `<b>${pct(p.completos, p.items)}</b><span class="inv-sub">${p.completos} de ${p.items} producto(s)</span>` : '<span class="inv-muted">—</span>'}</td>
		<td>${p.productos ? `<b class="${p.subieron ? 'inv-neg' : ''}">${p.subieron} de ${p.productos}</b><span class="inv-sub">subieron ${d.alerta_pct}% o más</span>` : '<span class="inv-muted">—</span>'}</td>
		<td style="text-align:right">${soles(p.comprado)}</td></tr>`;
	};
	return tarjeta({
		titulo: 'Cómo cumplen tus proveedores',
		ayuda: `Últimos ${d.dias} días. <b>A tiempo</b>: llegó hasta la fecha que pusiste en la orden. <b>Completo</b>: llegó todo lo pedido.
			<b>Precio</b>: productos que subieron ${d.alerta_pct}% o más frente a su compra anterior. Los que fallan salen primero.`,
		acciones: volver(),
		cuerpo: d.proveedores.length ? `<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>Proveedor</th><th>Nota</th><th>A tiempo</th><th>Llegó completo</th><th>Precio</th><th style="text-align:right">Comprado</th></tr></thead>
			<tbody>${d.proveedores.map(fila).join('')}</tbody></table></div>`
			: `<p class="inv-empty">Aún no hay órdenes de compra en los últimos ${d.dias} días.</p>`,
	});
}

export async function render(cont, sesion, t) {
	cont.innerHTML = '<div id="pr_cal"></div><div id="pr_precios"></div>';
	const [cal] = await Promise.all([api('precios.php?op=proveedores'), lista(cont.querySelector('#pr_precios'), t)]);
	if (!vigente(t)) { return; }
	cont.querySelector('#pr_cal').innerHTML = calificacion(cal);
}

async function lista(cont, t) {
	const d = await api('precios.php?op=lista&filtro=' + filtro);
	if (t !== undefined && !vigente(t)) { return; }
	cont.innerHTML = tarjeta({
		titulo: 'Precios de proveedores',
		ayuda: `Compara cada compra con la anterior del mismo proveedor. Subidas de ${d.alerta_pct}% o más salen en rojo. Clic en un producto para ver su historial.`,
		cuerpo: `<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Mostrar</span><select class="inv-select" id="pr_filtro">
					${FILTROS.map(([v, x]) => `<option value="${v}" ${v === filtro ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
				<span class="inv-sep"></span>
				${d.subieron ? `<span class="lg-valor"><b class="inv-neg">${d.subieron}</b> producto(s) subieron ${d.alerta_pct}% o más</span>` : ''}
			</div>
			${d.productos.length ? `<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Producto</th><th style="text-align:right">Última compra</th><th>Cambio</th><th>Más barato en otro proveedor</th><th></th></tr></thead>
				<tbody>${d.productos.map(p => `<tr style="cursor:pointer" data-hist="${p.idproducto}">
					<td><b>${esc(p.descripcion)}</b><span class="inv-sub">${p.proveedores} proveedor(es)</span></td>
					<td style="text-align:right"><b>${soles(p.ultimo.precio)}</b><span class="inv-sub">${esc(p.ultimo.proveedor)} · ${esc(fecha(p.ultimo.fecha))}</span></td>
					<td>${cambio(p, d.alerta_pct)}</td>
					<td>${p.mejor_otro ? `<b class="inv-pos">${soles(p.mejor_otro.precio)}</b> <span class="inv-sub">${esc(p.mejor_otro.proveedor)} · ${esc(fecha(p.mejor_otro.fecha))}</span>` : '<span class="inv-muted">—</span>'}</td>
					<td class="inv-acciones"><span class="inv-link"><i class="fa fa-line-chart"></i>Historial</span></td></tr>`).join('')}
				</tbody></table></div>`
			: `<p class="inv-empty"><i class="fa fa-check-circle"></i>${filtro === 'subieron' ? 'Nada subió de precio en la última compra.' : filtro === 'mas_barato' ? 'Nadie lo vende más barato que tu proveedor actual.' : 'Aún no hay compras registradas.'}</p>`}
			<div id="pr_hist"></div>`,
	});
	cont.querySelector('#pr_filtro').addEventListener('change', e => { filtro = e.target.value; lista(cont, turnoActual()).catch(err => aviso(err.message, 'error')); });
	cont.querySelector('.xContentCard').addEventListener('click', e => { const r = e.target.closest('[data-hist]'); if (r) { historial(cont, Number(r.dataset.hist)); } });
}

async function historial(cont, id) {
	const caja = cont.querySelector('#pr_hist'), t = turnoActual(), mio = ++pedidoHist;
	const sigue = () => mio === pedidoHist && vigente(t) && caja.isConnected;
	let d;
	try { d = await api('precios.php?op=historial&id=' + id); } catch (err) { if (sigue()) { aviso(err.message, 'error'); } return; }
	if (!sigue()) { return; }
	const max = Math.max(...d.compras.map(c => c.precio), 0.01);
	caja.innerHTML = `<div class="inv-toolbar" style="display:block;margin-top:14px">
		<p class="inv-titulo-sec" style="margin:0 0 8px"><i class="fa fa-line-chart"></i> ${esc(d.producto.descripcion)}: últimas compras</p>
		${d.compras.map(c => `<div class="lg-barra"><span>${esc(fecha(c.fecha))}</span><span>${esc(c.proveedor)}</span>
			<i style="width:${Math.max(4, c.precio / max * 100)}%"></i><b>${soles(c.precio)}</b></div>`).join('')}</div>`;
	caja.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
