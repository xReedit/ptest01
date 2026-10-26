// Conteo rapido de hoy (sede o central, solo si se activo en Configurar): unos pocos productos al dia, sin ver
// lo que dice el sistema (asi el conteo es real). Al terminar se ve que cuadro y que no; la central lo revisa.
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, leerNum } from '../ui.js?v=20261026a';
import { vigente } from '../router.js?v=20261026a';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const soles = n => (n < 0 ? '-' : '') + 'S/ ' + Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function render(cont, sesion, t) {
	const d = await api('conteo.php?op=hoy');
	if (!vigente(t)) { return; }
	pintar(cont, d.conteo, d.cantidad);
}

function pintar(cont, c, cantidad) {
	const tit = 'Conteo rápido de hoy';
	if (!c) {
		cont.innerHTML = tarjeta({
			titulo: tit, acciones: volver(),
			ayuda: 'Cada día te tocan unos pocos productos distintos. Contarlos toma 2 minutos y así el stock siempre está bien.',
			cuerpo: `<div class="lg-conteo-ini">
				<p>Hoy te tocan <b>${cantidad} productos</b> de tu almacén principal.</p>
				<p class="inv-sub">No te mostramos lo que dice el sistema: cuenta lo que ves en el estante.</p>
				<button class="btn btn-success" id="ct_empezar"><i class="fa fa-play"></i>Empezar a contar</button></div>`,
		});
		cont.querySelector('#ct_empezar').addEventListener('click', async e => {
			e.currentTarget.disabled = true;
			try { pintar(cont, await api('conteo.php?op=empezar', {}), cantidad); } catch (err) { aviso(err.message, 'error'); e.currentTarget.disabled = false; }
		});
		return;
	}
	if (c.estado === 'borrador') {
		cont.innerHTML = tarjeta({
			titulo: tit, acciones: volver(),
			ayuda: 'Ve al almacén, cuenta cada producto y escribe cuánto hay. Si no hay ninguno, escribe 0.',
			cuerpo: `<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Producto</th><th>¿Cuántos hay?</th></tr></thead>
				<tbody>${c.items.map(i => `<tr data-det="${i.iddet}">
					<td><b>${esc(i.descripcion)}</b><span class="inv-sub">${esc(i.familia)}</span></td>
					<td><input class="inv-input ct-cant" type="number" min="0" step="any" inputmode="decimal" style="width:110px"> <span class="inv-sub" style="display:inline">${esc(i.unidad)}</span></td>
				</tr>`).join('')}</tbody></table></div>
				<div style="margin-top:12px;text-align:right"><button class="btn btn-success" id="ct_fin"><i class="fa fa-check"></i>Terminar conteo</button></div>`,
		});
		const primero = cont.querySelector('.ct-cant');
		if (primero) { primero.focus(); }
		cont.querySelector('#ct_fin').addEventListener('click', async e => {
			const filas = [...cont.querySelectorAll('tr[data-det]')].map(tr => ({ iddet: Number(tr.dataset.det), contado: tr.querySelector('.ct-cant').value, el: tr.querySelector('.ct-cant') }));
			const malo = filas.find(f => f.el.validity.badInput);
			if (malo) { aviso('Hay una cantidad mal escrita. Usa punto para decimales (ej: 1.5).', 'error'); malo.el.focus(); return; }
			const vacio = filas.find(f => leerNum(f.el, true) === null || Number(f.contado) < 0);
			if (vacio) { aviso('Falta escribir cuánto hay de un producto (0 si no hay).', 'error'); vacio.el.focus(); return; }
			const btn = e.currentTarget;
			btn.disabled = true;
			btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>Guardando…';
			try {
				pintar(cont, await api('conteo.php?op=terminar', { id: c.id, filas: filas.map(({ iddet, contado }) => ({ iddet, contado })) }), cantidad);
			} catch (err) { aviso(err.message, 'error'); btn.disabled = false; btn.innerHTML = '<i class="fa fa-check"></i>Terminar conteo'; }
		});
		return;
	}
	const mal = c.items.filter(i => i.diferencia !== 0);
	cont.innerHTML = tarjeta({
		titulo: tit, acciones: volver(),
		ayuda: mal.length ? 'Lo que no cuadra lo revisa la central: puede ajustar el stock o pedirte que cuentes de nuevo.' : '',
		cuerpo: `<p class="lg-conteo-res ${mal.length ? 'mal' : 'ok'}"><i class="fa ${mal.length ? 'fa-exclamation-circle' : 'fa-check-circle'}"></i>
				${mal.length ? `<b>${mal.length} de ${c.items.length}</b> no cuadran con el sistema.` : `¡Todo cuadra! Los ${c.items.length} productos están bien.`}
				${c.hora_fin ? `<span class="inv-sub" style="display:inline">· terminado ${esc(c.hora_fin)}</span>` : ''}</p>
			<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>Producto</th><th style="text-align:right">Sistema</th><th style="text-align:right">Contaste</th><th style="text-align:right">Diferencia</th></tr></thead>
			<tbody>${c.items.map(i => `<tr><td>${esc(i.descripcion)}</td><td style="text-align:right">${num(i.sistema)}</td><td style="text-align:right"><b>${num(i.contado)}</b></td>
				<td style="text-align:right">${i.diferencia ? `<b class="${i.diferencia < 0 ? 'inv-neg' : 'inv-pos'}">${i.diferencia > 0 ? '+' : ''}${num(i.diferencia)}</b> <span class="inv-sub">${soles(i.valor)}</span>` : '<span class="inv-pos"><i class="fa fa-check"></i></span>'}</td></tr>`).join('')}
			</tbody></table></div>
			${c.estado === 'aprobado' ? '<p class="inv-sub" style="margin-top:8px"><i class="fa fa-check"></i> La central ya ajustó el stock.</p>' : ''}`,
	});
}
