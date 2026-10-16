// Stock parado en las sedes (central): productos que se venden (gaseosas, cervezas, snacks...) y que en una sede no
// salen. Solo cuenta lo que se descuenta con ventas: los abarrotes sin receta no aparecen (su stock nunca baja).
// Cada fila sugiere la sede que mas lo vende y con un clic queda para despachar en Envios a las sedes.
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver, confirmar, nuevoToken } from '../ui.js?v=20261015i';
import { vigente, recargar } from '../router.js?v=20261015i';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const soles = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let filtroSede = 0;

function porQue(p) {
	if (p.dias_sin_venta === null) { return '<span class="inv-neg">nunca se vendió aquí</span>'; }
	if (p.dias_sin_venta >= 15) { return `<span class="inv-neg">${p.dias_sin_venta} días sin venderse</span>`; }
	return `vende ${num(p.por_dia)} al día · le alcanza para <b>${p.alcanza_dias} días</b>`;
}

export async function render(cont, sesion, t) {
	const d = await api('parado.php?op=lista' + (filtroSede ? '&idsede=' + filtroSede : ''));
	if (t !== undefined && !vigente(t)) { return; }
	const total = d.productos.reduce((s, p) => s + p.valor, 0);
	const porSede = new Map();
	d.productos.forEach(p => { if (!porSede.has(p.sede)) { porSede.set(p.sede, []); } porSede.get(p.sede).push(p); });
	const ocultos = d.excepciones.filter(e => e.modo === 'no');
	cont.innerHTML = '<div id="pa_raiz">' + tarjeta({
		titulo: 'Stock parado en las sedes',
		ayuda: `Lo que se vende (gaseosas, cervezas, snacks…) pero en una sede no sale: ${d.reglas.dias_sin_venta} días sin venderse o que alcanza para más de ${d.reglas.dias_parado} días.
			Llévalo a la sede que sí lo vende en vez de comprar. Los abarrotes que no se descuentan con ventas no aparecen.`,
		acciones: volver(),
		cuerpo: `<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Sede</span><select class="inv-select" id="pa_sede">
					<option value="0">Todas las sedes</option>${d.sedes.map(s => `<option value="${s.idsede}" ${Number(s.idsede) === filtroSede ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}</select></div>
				<span class="inv-sep"></span>
				<span class="lg-valor">Plata detenida: <b>${soles(total)}</b> · ${d.productos.length} producto(s)</span>
			</div>
			${d.productos.length ? [...porSede.entries()].map(([sede, ps]) => `
				<p class="inv-titulo-sec" style="margin-top:14px"><i class="fa fa-map-marker"></i> ${esc(sede)} <span class="inv-muted">· ${soles(ps.reduce((s, p) => s + p.valor, 0))}</span></p>
				<div class="inv-table-wrap"><table class="inv-table">
					<thead><tr><th>Producto</th><th style="text-align:right">Le sobra</th><th>Por qué</th><th style="text-align:right">Valor</th><th>Mejor llevarlo a</th></tr></thead>
					<tbody>${ps.map(p => `<tr>
						<td><b>${esc(p.descripcion)}</b><span class="inv-sub">tiene ${num(p.stock)}${p.porcion ? ` (en porciones de ${esc(p.porcion)})` : ""}${p.comprometido > 0 ? ` · ${num(p.comprometido)} ya en Envíos` : ''}
							· <span class="inv-link" data-ocultar="${p.idproducto_central}" data-nombre="${esc(p.descripcion)}" style="font-size:11px">no vigilar</span></span></td>
						<td style="text-align:right"><b>${num(p.sobra)}</b> <span class="inv-muted">${esc(p.unidad || 'und')}</span></td>
						<td>${porQue(p)}</td>
						<td style="text-align:right">${p.costo > 0 ? soles(p.valor) : '<span class="inv-muted">sin costo</span>'}</td>
						<td>${p.destino ? `<button class="btn btn-sm btn-success" data-llevar="${p.idproducto_central}" data-origen="${p.idsede}" data-destino="${p.destino.idsede}"
								data-q="${p.sobra}" data-nombre="${esc(p.descripcion)}" data-osede="${esc(p.sede)}" data-dsede="${esc(p.destino.sede)}">
								<i class="fa fa-truck"></i>Llevar a ${esc(p.destino.sede)}</button><span class="inv-sub">vende ${num(p.destino.por_dia)} al día</span>`
							: '<span class="inv-muted">ninguna sede lo vende ahora</span>'}</td>
					</tr>`).join('')}</tbody></table></div>`).join('')
			: '<p class="inv-empty"><i class="fa fa-check-circle"></i>No hay stock parado: lo que se vende está saliendo en todas las sedes.</p>'}
			${ocultos.length ? `<p class="inv-sub" style="margin-top:14px">No se vigilan (marcados a mano): ${ocultos.map(o => `${esc(o.descripcion)} <span class="inv-link" data-auto="${o.idproducto_central}">volver a vigilar</span>`).join(' · ')}</p>` : ''}`,
	}) + '</div>';

	cont.querySelector('#pa_sede').addEventListener('change', e => { filtroSede = Number(e.target.value); recargar(); });
	cont.querySelector('#pa_raiz').addEventListener('click', async e => {
		const b = e.target.closest('[data-llevar]');
		if (b) { llevar(b); return; }
		const o = e.target.closest('[data-ocultar]');
		if (o) {
			const ok = await confirmar({ titulo: `¿No vigilar ${o.dataset.nombre}?`, boton: 'Sí, no vigilar', peligro: false,
				textoHtml: '<p style="margin:0">Úsalo si este producto <b>no se descuenta solo al vender</b> (por ejemplo, un insumo de cocina). Deja de aparecer aquí y en las sugerencias de traslado. Puedes volver a vigilarlo abajo.</p>' });
			if (ok) { try { await api('parado.php?op=vigilar', { idproducto_central: Number(o.dataset.ocultar), modo: 'no' }); recargar(); } catch (err) { aviso(err.message, 'error'); } }
			return;
		}
		const a = e.target.closest('[data-auto]');
		if (a) { try { await api('parado.php?op=vigilar', { idproducto_central: Number(a.dataset.auto), modo: 'auto' }); recargar(); } catch (err) { aviso(err.message, 'error'); } }
	});
}

async function llevar(b) {
	const q = Number(b.dataset.q);
	const ok = await confirmar({
		titulo: `¿Llevar ${num(q)} de ${b.dataset.nombre} a ${b.dataset.dsede}?`, peligro: false, boton: 'Sí, llevar',
		textoHtml: `<p style="margin:0">Sale de <b>${esc(b.dataset.osede)}</b> y va a <b>${esc(b.dataset.dsede)}</b>, que sí lo vende.
			Aparece en <b>Envíos a las sedes</b> para despacharlo con la próxima ruta.</p>`,
	});
	if (!ok) { return; }
	b.disabled = true;
	if (!b.dataset.tk) { b.dataset.tk = nuevoToken('pa'); }   // mismo token en el reintento: no se traslada dos veces
	try {
		await api('parado.php?op=trasladar', { idproducto_central: Number(b.dataset.llevar), idsede_origen: Number(b.dataset.origen),
			idsede_destino: Number(b.dataset.destino), cantidad: q, token: b.dataset.tk });
		delete b.dataset.tk;
		aviso(`Listo: ${num(q)} de ${b.dataset.nombre} quedan para enviar a ${b.dataset.dsede}. Despáchalo en Envíos a las sedes.`);
		recargar();
	} catch (err) { aviso(err.message, 'error'); b.disabled = false; }
}
