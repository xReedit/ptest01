// "Pedir a la central" (sede): la lista ya trae lo que falta con la cantidad sugerida. La sede revisa y envia.
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver, confirmar, paginador, nuevoToken, leerNum } from '../ui.js?v=20261015i';
import { ir, vigente } from '../router.js?v=20261015i';

const POR_PAGINA = 50;
// cantidades: { idproducto: numero } lo que se va a pedir (arranca con lo sugerido; sobrevive a filtros y paginas)
let estado = { datos: null, cantidades: {}, soloFalta: true, q: '', pagina: 1 };

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });

export async function render(cont, sesion, t) {
	const datos = await api('pedidos.php?op=sugerido');
	if (!vigente(t)) { return; }
	const cantidades = {};
	datos.productos.forEach(p => { if (p.sugerido > 0) { cantidades[p.idproducto] = p.sugerido; } });
	// token del formulario: si el envio se repite (doble clic, reintento) el servidor devuelve el mismo pedido
	// malos: { idproducto: true } cantidades mal escritas (ej. "1,5"): no se envia hasta corregirlas
	estado = { datos, cantidades, malos: {}, soloFalta: true, q: '', pagina: 1, token: nuevoToken('pd') };

	cont.innerHTML = tarjeta({
		titulo: 'Pedir a la central',
		ayuda: datos.dias_historia
			? `La lista ya trae lo que te falta según lo que vendiste en los últimos <b>${datos.dias_historia}</b> días, para cubrir <b>${datos.dias_cobertura}</b> días. Revisa las cantidades y presiona <b>Enviar pedido</b>.`
			: 'Aún no hay ventas registradas en Logística: la cantidad sugerida usa solo tu <b>stock mínimo</b>. Revisa y presiona <b>Enviar pedido</b>.',
		acciones: `${volver()}<button class="btn btn-sm btn-success" id="pd_enviar"><i class="fa fa-paper-plane"></i>Enviar pedido</button>`,
		cuerpo: `
			<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Buscar</span><input class="inv-input" id="pd_q" placeholder="Producto o familia"></div>
				<label class="inv-check" style="align-self:flex-end;padding-bottom:8px"><input type="checkbox" id="pd_falta" checked>Solo lo que me falta</label>
				<span class="inv-sep"></span>
				<p class="inv-ayuda" id="pd_resumen"></p>
			</div>
			<div id="pd_lista"></div>
			<div class="inv-form-row" style="margin-top:12px"><div class="inv-field"><span class="inv-label">Nota para la central (opcional)</span><input class="inv-input inv-w100" id="pd_nota" maxlength="500" placeholder="Ej: urgente para el fin de semana"></div></div>`,
	});

	cont.querySelector('#pd_falta').addEventListener('change', e => { estado = { ...estado, soloFalta: e.target.checked, pagina: 1 }; pintar(cont); });
	cont.querySelector('#pd_q').addEventListener('input', e => { estado = { ...estado, q: e.target.value.trim().toUpperCase(), pagina: 1 }; pintar(cont); });
	cont.querySelector('#pd_enviar').addEventListener('click', e => enviar(cont, e.currentTarget));
	const lista = cont.querySelector('#pd_lista');
	lista.addEventListener('input', e => {
		const inp = e.target.closest('.pd-cant');
		if (!inp) { return; }
		const v = leerNum(inp);
		const cantidades = { ...estado.cantidades };
		const malos = { ...estado.malos };
		if (v > 0) { cantidades[inp.dataset.id] = v; } else { delete cantidades[inp.dataset.id]; }
		if (v === null) { malos[inp.dataset.id] = true; } else { delete malos[inp.dataset.id]; }
		estado = { ...estado, cantidades, malos };
		resumen(cont);
	});
	lista.addEventListener('click', e => {
		const pg = e.target.closest('[data-pag]');
		if (pg) { estado = { ...estado, pagina: Number(pg.dataset.pag) }; pintar(cont); cont.scrollIntoView({ block: 'start' }); }
	});
	pintar(cont);
}

function resumen(cont) {
	const n = Object.keys(estado.cantidades).length;
	cont.querySelector('#pd_resumen').textContent = `${n} producto(s) en el pedido`;
	const b = cont.querySelector('#pd_enviar');
	b.disabled = n === 0;
	b.innerHTML = `<i class="fa fa-paper-plane"></i>Enviar pedido${n ? ` (${n})` : ''}`;
}

/** "≈ 2 CAJA" si el producto tiene forma de compra. */
function enPresentacion(p, cant) {
	if (!p.presentacion || !(cant > 0)) { return ''; }
	const [nombre, factor] = p.presentacion.split('|');
	const n = cant / Number(factor);
	return n >= 0.5 ? `≈ ${num(Math.round(n * 10) / 10)} ${esc(nombre)}` : '';
}

function alcanza(p) {
	if (!(p.por_dia > 0)) { return '<span class="inv-muted">—</span>'; }
	const d = p.stock / p.por_dia;
	const corto = d < estado.datos.dias_cobertura;
	return `<span class="${corto ? 'inv-neg' : ''}">${d < 1 ? 'menos de 1 día' : `~${Math.floor(d)} día(s)`}</span>`;
}

function pintar(cont) {
	const todas = estado.datos.productos.filter(p =>
		(!estado.soloFalta || p.sugerido > 0 || estado.cantidades[p.idproducto])
		&& (!estado.q || p.descripcion.toUpperCase().includes(estado.q) || p.familia.toUpperCase().includes(estado.q)));
	const paginas = Math.max(1, Math.ceil(todas.length / POR_PAGINA));
	const pag = Math.min(estado.pagina, paginas);
	const filas = todas.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
	cont.querySelector('#pd_lista').innerHTML = filas.length ? `
		<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>Producto</th><th style="text-align:right">Tienes</th><th style="text-align:right" class="lg-oc">Vendes al día</th>
				<th class="lg-oc">Te alcanza</th><th style="text-align:right" class="lg-oc">Ya pedido</th><th>Pedir</th></tr></thead>
			<tbody>${filas.map(p => {
				const cant = estado.cantidades[p.idproducto] || '';
				return `<tr>
					<td>${esc(p.descripcion)}<span class="inv-sub">${esc(p.familia)}${p.stock_minimo ? ` · mínimo ${num(p.stock_minimo)}` : ''}</span></td>
					<td style="text-align:right">${num(p.stock)} <span class="inv-muted">${esc(p.unidad || 'und')}</span>${p.porcion
						? `<span class="inv-sub">${num(p.stock * p.porciones)} porciones de ${esc(p.porcion)}</span>` : ''}</td>
					<td style="text-align:right" class="lg-oc">${p.por_dia ? num(p.por_dia) : '<span class="inv-muted">—</span>'}</td>
					<td class="lg-oc">${alcanza(p)}</td>
					<td style="text-align:right" class="lg-oc">${p.en_camino ? num(p.en_camino) : '<span class="inv-muted">—</span>'}</td>
					<td style="white-space:nowrap"><input class="inv-input pd-cant" data-id="${p.idproducto}" type="number" min="0" step="any"
						inputmode="decimal" style="width:90px" value="${esc(cant)}" placeholder="0">
						<span class="inv-sub">${p.sugerido ? `sugerido ${num(p.sugerido)}` : ''} ${enPresentacion(p, p.sugerido)}</span></td>
				</tr>`;
			}).join('')}</tbody>
		</table></div>
		${paginador({ pagina: pag, paginas, total: todas.length })}`
		: `<p class="inv-empty"><i class="fa fa-check-circle"></i>${estado.soloFalta && !estado.q
			? 'No te falta nada por ahora. Desmarca "Solo lo que me falta" para pedir otra cosa.' : 'Ningún producto coincide con la búsqueda.'}</p>`;
	resumen(cont);
}

async function enviar(cont, btn) {
	const items = Object.entries(estado.cantidades).map(([id, cantidad]) => ({ idproducto: Number(id), cantidad }));
	const nombre = id => (estado.datos.productos.find(p => p.idproducto === id) || {}).descripcion || '';
	const malo = Object.keys(estado.malos)[0];
	if (malo) { aviso(`La cantidad de ${nombre(Number(malo))} está mal escrita. Usa punto para decimales (ej: 1.5).`, 'error'); return; }
	if (!items.length) { aviso('Pon la cantidad en al menos un producto.', 'error'); return; }
	// error de tipeo: mucho mas de lo sugerido (o mucho sin sugerencia)
	const raros = items.filter(i => { const p = estado.datos.productos.find(x => x.idproducto === i.idproducto) || {}; return i.cantidad > Math.max(20, (p.sugerido || 0) * 5); })
		.map(i => { const p = estado.datos.productos.find(x => x.idproducto === i.idproducto) || {}; return `${esc(p.descripcion)}: <b>${num(i.cantidad)}</b>${p.sugerido ? ` (sugerido ${num(p.sugerido)})` : ''}`; });
	const ok = await confirmar({
		titulo: `¿Enviar el pedido de ${items.length} producto(s)?`,
		peligro: false,
		boton: 'Sí, enviar a la central',
		textoHtml: `<div class="inv-table-wrap" style="max-height:280px;overflow:auto"><table class="inv-table">
				<thead><tr><th>Producto</th><th style="text-align:right">Cantidad</th></tr></thead>
				<tbody>${items.map(i => `<tr><td>${esc(nombre(i.idproducto))}</td><td style="text-align:right">${num(i.cantidad)}</td></tr>`).join('')}</tbody>
			</table></div>
			${raros.length ? `<div class="lg-error" style="margin-top:8px"><b>¿Seguro? Es mucho más de lo normal:</b><br>${raros.join('<br>')}</div>` : ''}
			<p class="inv-ayuda" style="margin:8px 0 0">Puedes cancelarlo desde <b>Mis pedidos</b> mientras la central no lo haya visto.</p>`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	try {
		const r = await api('pedidos.php?op=enviar', { items, nota: cont.querySelector('#pd_nota').value, token: estado.token });
		aviso(`Pedido N° ${r.idsolicitud} enviado a la central (${r.productos} productos).`);
		ir('mis_pedidos');
	} catch (err) {
		aviso(err.message, 'error');
		btn.disabled = false;
	}
}
