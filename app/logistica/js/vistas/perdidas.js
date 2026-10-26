// Mermas y perdidas (central): S/ perdidos por sede y por motivo, mas lo que falto en los conteos rapidos.
// Clic en una sede: el detalle (que, cuanto, quien, por que).
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, fecha } from '../ui.js?v=20261026a';
import { vigente, turnoActual } from '../router.js?v=20261026a';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const soles = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const PERIODOS = [['mes', 'Este mes'], ['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['mes_ant', 'Mes pasado']];
let periodo = 'mes';
let pedidoDet = 0;   // solo vale la ultima sede clicada (una respuesta lenta no pisa a la nueva)

export async function render(cont, sesion, t) {
	const d = await api('mermas.php?op=reporte&periodo=' + periodo);
	if (t !== undefined && !vigente(t)) { return; }
	const cols = Object.keys(d.motivos);
	const celda = v => v ? soles(v) : '<span class="inv-muted">—</span>';
	cont.innerHTML = tarjeta({
		titulo: 'Mermas y pérdidas',
		ayuda: 'Cuánto se pierde en cada local y por qué. Suma las mermas, las salidas por deterioro de la pantalla de almacén y lo que faltó en los conteos.',
		acciones: `<a class="btn btn-sm btn-success" href="#" data-ir="mermas"><i class="fa fa-plus"></i>Registrar merma de la central</a> ${volver()}`,
		cuerpo: `<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Periodo</span><select class="inv-select" id="pd_per">
					${PERIODOS.map(([v, x]) => `<option value="${v}" ${v === periodo ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
				<span class="inv-sep"></span>
				<span class="lg-valor">Total perdido: <b class="inv-neg">${soles(d.total)}</b></span>
			</div>
			${d.sedes.length ? `<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Sede</th>${cols.map(k => `<th style="text-align:right">${esc(d.motivos[k])}</th>`).join('')}<th style="text-align:right">Total</th></tr></thead>
				<tbody>${d.sedes.map(s => `<tr style="cursor:pointer" data-sede="${s.idsede}">
					<td><b>${esc(s.sede)}</b> <span class="inv-link" style="font-size:12px"><i class="fa fa-list"></i>ver</span></td>
					${cols.map(k => `<td style="text-align:right">${celda(s.motivos[k])}</td>`).join('')}
					<td style="text-align:right"><b class="inv-neg">${soles(s.total)}</b></td></tr>`).join('')}</tbody></table></div>`
			: '<p class="inv-empty"><i class="fa fa-check-circle"></i>No hay pérdidas registradas en este periodo.</p>'}
			<div id="pd_det"></div>`,
	});
	cont.querySelector('#pd_per').addEventListener('change', e => { periodo = e.target.value; render(cont, sesion, turnoActual()).catch(err => aviso(err.message, 'error')); });
	cont.querySelector('.xContentCard').addEventListener('click', async e => {
		const tr = e.target.closest('[data-sede]');
		if (!tr) { return; }
		const caja = cont.querySelector('#pd_det'), t = turnoActual(), mio = ++pedidoDet;
		const sigue = () => mio === pedidoDet && vigente(t) && caja.isConnected;
		let r;
		try { r = await api(`mermas.php?op=detalle&idsede=${tr.dataset.sede}&periodo=${periodo}`); } catch (err) { if (sigue()) { aviso(err.message, 'error'); } return; }
		if (!sigue()) { return; }
		caja.innerHTML = `<p class="inv-titulo-sec" style="margin-top:16px">${esc(tr.querySelector('b').textContent)}: detalle</p>
			${r.filas.length ? `<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Cuándo</th><th>Producto</th><th style="text-align:right">Cantidad</th><th>Motivo</th><th>Quién</th><th style="text-align:right">Valor</th></tr></thead>
				<tbody>${r.filas.map(f => `<tr><td>${esc(fecha(f.fecha))}</td><td>${esc(f.producto)}</td><td style="text-align:right">${num(f.cantidad)} ${esc(f.unidad)}</td>
					<td>${esc(d.motivos[f.motivo] || f.motivo)}${f.origen === 'almacen' ? ' <span class="inv-tag">almacén</span>' : ''}${f.nota ? `<span class="inv-sub">${esc(f.nota)}</span>` : ''}</td><td>${esc(f.usuario || '')}</td>
					<td style="text-align:right">${soles(f.valor)}</td></tr>`).join('')}</tbody></table></div>`
			: '<p class="inv-empty">Sin detalle.</p>'}`;
		caja.scrollIntoView({ behavior: 'smooth', block: 'start' });
	});
}
