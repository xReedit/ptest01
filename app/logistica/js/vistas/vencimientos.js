// Por vencer (F6b): lo que vence pronto en cada sede. Si no se va a vender a tiempo, el sistema dice a que sede llevarlo
// (la que mas lo vende y alcanza) y con un boton queda en Envios. La sede ve solo lo suyo (sin botones).
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, confirmar, nuevoToken, fecha } from '../ui.js?v=20261026a';
import { vigente, recargar } from '../router.js?v=20261026a';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });

function cuando(dias) {
	if (dias < 0) { return `<span class="inv-estado anulado">Venció hace ${-dias} día(s)</span>`; }
	if (dias === 0) { return '<span class="inv-estado anulado">Vence hoy</span>'; }
	return `<span class="inv-estado ${dias <= 7 ? 'borrador' : 'cerrado'}">En ${dias} día(s)</span>`;
}

let estado = { datos: null, sede: '', q: '' };

export async function render(cont, sesion, t) {
	const datos = await api('vencimientos.php?op=lista');
	if (!vigente(t)) { return; }
	estado = { datos, sede: '', q: '' };
	const l = datos.lotes;
	const sedes = [...new Set(l.map(x => x.sede))].sort();
	cont.innerHTML = tarjeta({
		titulo: datos.es_central ? 'Por vencer' : 'Por vencer en mi sede',
		ayuda: `Productos que vencen en los próximos <b>${datos.dias_alerta}</b> días.`
			+ (datos.es_central ? ' Si en una sede no se van a vender a tiempo, el sistema te dice <b>a qué sede llevarlos</b>.' : ' Véndelos primero.'),
		acciones: volver(),
		cuerpo: `
			<div class="inv-kpis">
				<div class="inv-kpi inv-kpi-rojo"><span>YA VENCIDOS</span><b>${l.filter(x => x.dias < 0).length}</b><em>sacar de la venta</em></div>
				<div class="inv-kpi inv-kpi-rojo"><span>VENCEN EN 7 DÍAS</span><b>${l.filter(x => x.dias >= 0 && x.dias <= 7).length}</b></div>
				<div class="inv-kpi inv-kpi-azul"><span>VENCEN EN ${datos.dias_alerta} DÍAS</span><b>${l.filter(x => x.dias >= 0).length}</b></div>
				${datos.es_central ? `<div class="inv-kpi inv-kpi-verde"><span>SE PUEDEN SALVAR</span><b>${l.filter(x => x.sugerencia).length}</b><em>llevándolos a otra sede</em></div>` : ''}
			</div>
			${l.length ? `<div class="inv-toolbar">
				${datos.es_central ? `<div class="inv-field"><span class="inv-label">Sede</span><select class="inv-select" id="pv_sede">
					<option value="">Todas</option>${sedes.map(s => `<option>${esc(s)}</option>`).join('')}</select></div>` : ''}
				<div class="inv-field"><span class="inv-label">Buscar</span><input class="inv-input" id="pv_q" placeholder="Producto"></div>
			</div>` : ''}
			<div id="pv_lista"></div>`,
	});
	if (cont.querySelector('#pv_sede')) { cont.querySelector('#pv_sede').addEventListener('change', e => { estado = { ...estado, sede: e.target.value }; pintar(cont); }); }
	if (cont.querySelector('#pv_q')) { cont.querySelector('#pv_q').addEventListener('input', e => { estado = { ...estado, q: e.target.value.trim().toUpperCase() }; pintar(cont); }); }
	cont.querySelector('#pv_lista').addEventListener('click', e => {
		const b = e.target.closest('[data-llevar]');
		if (b) { llevar(estado.datos.lotes[Number(b.dataset.llevar)], b); }
	});
	pintar(cont);
}

function queHacer(x, i) {
	if (x.dias < 0) { return '<span class="inv-neg">Ya venció: sácalo de la venta</span>'; }
	if (x.en_envios) { return `<span class="inv-ayuda"><i class="fa fa-truck"></i> Ya está en Envíos (${num(x.en_envios)})</span>`; }
	if (!x.sobra) { return '<span class="inv-pos"><i class="fa fa-check"></i> Se vende a tiempo</span>'; }
	if (!estado.datos.es_central) { return `<span class="inv-neg">Sobrarían ${num(x.sobra)}: avisa a la central</span>`; }
	if (!x.sugerencia) { return `<span class="inv-neg">Sobrarían ${num(x.sobra)}</span><span class="inv-sub">Ninguna otra sede alcanza a venderlo a tiempo. Considera una promoción.</span>`; }
	return `<span class="inv-neg">Sobrarían ${num(x.sobra)}</span><br>
		<button class="btn btn-sm btn-success" data-llevar="${i}" style="margin-top:4px"><i class="fa fa-exchange"></i>Llevar ${num(x.sugerencia.cantidad)} a ${esc(x.sugerencia.sede)}</button>`;
}

function pintar(cont) {
	const todas = estado.datos.lotes.map((x, i) => ({ x, i }))
		.filter(({ x }) => (!estado.sede || x.sede === estado.sede) && (!estado.q || x.producto.toUpperCase().includes(estado.q)));
	cont.querySelector('#pv_lista').innerHTML = todas.length ? `<div class="inv-table-wrap"><table class="inv-table">
		<thead><tr><th>Producto</th>${estado.datos.es_central ? '<th>Sede</th>' : ''}<th>Vence</th><th style="text-align:right">Hay</th>
			<th style="text-align:right" class="lg-oc">Se vende al día</th><th>¿Qué hacer?</th></tr></thead>
		<tbody>${todas.map(({ x, i }) => `<tr>
			<td>${esc(x.producto)}<span class="inv-sub">Lote ${esc(x.lote || 's/n')} · ${fecha(x.vence)}</span></td>
			${estado.datos.es_central ? `<td>${esc(x.sede)}</td>` : ''}
			<td>${cuando(x.dias)}</td>
			<td style="text-align:right">${num(x.cantidad)} <span class="inv-muted">${esc(x.unidad || 'und')}</span></td>
			<td style="text-align:right" class="lg-oc">${x.por_dia ? num(x.por_dia) : '<span class="inv-muted">no se vende</span>'}</td>
			<td>${queHacer(x, i)}</td></tr>`).join('')}</tbody></table></div>`
		: `<p class="inv-empty"><i class="fa fa-check-circle"></i>${estado.datos.lotes.length ? 'Nada coincide con la búsqueda.' : `Nada vence en los próximos ${estado.datos.dias_alerta} días.`}</p>`;
}

// token por lote: sobrevive al redibujar la lista (filtros), el reintento usa el mismo y no se traslada dos veces
const tokens = new Map();

async function llevar(x, btn) {
	const ok = await confirmar({
		titulo: `¿Llevar ${num(x.sugerencia.cantidad)} de ${x.producto} a ${x.sugerencia.sede}?`, peligro: false, boton: 'Sí, mandar a Envíos',
		textoHtml: `<p style="margin:0 0 8px">En <b>${esc(x.sede)}</b> vence en ${x.dias} día(s) y no se alcanza a vender. En <b>${esc(x.sugerencia.sede)}</b> sí se vende.</p>
			<p class="inv-ayuda" style="margin:0">Quedará en <b>Envíos a las sedes</b> para la próxima ruta (ahí puedes cambiar la cantidad).</p>`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	if (!tokens.has(x.idlote)) { tokens.set(x.idlote, nuevoToken('pv' + x.idlote + '_')); }
	try {
		await api('vencimientos.php?op=trasladar', { idlote: x.idlote, idsede_origen: x.idsede, idsede_destino: x.sugerencia.idsede,
			cantidad: x.sugerencia.cantidad, token: tokens.get(x.idlote) });
		tokens.delete(x.idlote);
		aviso(`Listo: ${x.producto} quedó en Envíos.`);
		recargar();
	} catch (err) {
		aviso(err.message, 'error');
		btn.disabled = false;
	}
}
