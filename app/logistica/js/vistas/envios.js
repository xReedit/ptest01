// Envios a las sedes (F6, central): lo que sale del almacen central o se trae de otra sede, agrupado por
// origen -> destino. Se marca lo que va hoy, vehiculo y chofer, y "Despachar ruta": sale el stock del origen,
// se imprime la hoja de ruta y se avisa por WhatsApp a cada encargado.
import { cargarHistorias } from '../historia.js?v=20261015i';
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver, confirmar, autocompletar, imprimir, nuevoToken, leerNum, fecha } from '../ui.js?v=20261015i';
import { vigente, recargar } from '../router.js?v=20261015i';
import { dialogoChofer } from './choferes.js?v=20261015i';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const soles = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ESTADO = { despachado: ['En camino', 'cerrado'], recibido: ['Recibido', 'aprobado'], recibido_con_diferencia: ['Recibido con diferencias', 'borrador'], anulado: ['Anulado', 'anulado'] };

const FILTROS = [['todos', 'Todos'], ['camino', 'En camino'], ['recibido', 'Recibidos']];
let filtroRec = 'todos';
let ultimaLista = [];
// desde el diagrama cada caja abre solo su tarea (ruta "envios/<foco>")
const FOCOS = {
	central: ['Sale del almacén central', 'Lo que sale del almacén central a las sedes. En rojo lo que no alcanza: pásalo desde PRODUCCION, prodúcelo o va lo que hay.'],
	repartos: ['Repartos sin pedido', 'Lo que mandaste desde Repartir a las sedes (o Stock parado / Por vencer) sin que la sede lo pida. Despáchalo con <b>Despachar ruta</b>.'],
	despachar: ['Por despachar', 'Arma la ruta: marca lo que va hoy, escribe el vehículo y el chofer, y presiona <b>Despachar ruta</b>.'],
	camino: ['En camino', 'Envíos que salieron y la sede aún no confirma. Clic en uno para ver el chofer y desde qué hora está en camino.'],
	recibido: ['Recibidos', 'Lo que las sedes confirmaron: quién recibió, a qué hora y si faltó algo.'],
};

export async function render(cont, sesion, t, foco = '') {
	const F = FOCOS[foco];
	filtroRec = FILTROS.some(x => x[0] === foco) ? foco : 'todos';
	const [pe, lista] = await Promise.all([api('traslados.php?op=por_enviar'), api('traslados.php?op=listar')]);
	if (!vigente(t)) { return; }
	// "Del almacen": solo lo que sale de la central, lo que no alcanza primero
	// "Repartir": solo lo que se mando sin pedido
	const grupos = foco === 'central'
		? pe.grupos.filter(g => g.origen === pe.central).map(g => ({ ...g, items: [...g.items].sort((a, b) => (b.stock < b.cantidad) - (a.stock < a.cantidad)) }))
		: foco === 'repartos' ? pe.grupos.map(g => ({ ...g, items: g.items.filter(i => i.sin_pedido > 0) })).filter(g => g.items.length)
		: pe.grupos;
	const tk = { v: 'dp' + Date.now() + Math.random().toString(36).slice(2) };   // doble clic en Despachar (uno nuevo por cada despacho)
	const enviar = !F || ['central', 'despachar', 'repartos'].includes(foco), recientes = !F || foco === 'camino' || foco === 'recibido';
	cont.innerHTML = '<div id="ev_raiz">' + (F ? `<div class="lg-foco"><i class="fa fa-filter"></i>Solo: <b>${esc(F[0])}</b><span class="inv-link" data-ir="envios"><i class="fa fa-th-list"></i>Ver todo lo de envíos</span></div>` : '')
		+ (enviar ? tarjeta({
		titulo: F && enviar ? F[0] : 'Envíos a las sedes',
		ayuda: F && enviar ? F[1] : 'Lo que sale del almacén central o se trae de otra sede. Marca lo que va hoy, escribe el vehículo y el chofer, y presiona <b>Despachar ruta</b>.',
		acciones: `${volver()}${grupos.length ? '<button class="btn btn-sm btn-success" id="ev_despachar"><i class="fa fa-truck"></i>Despachar ruta</button>' : ''}`,
		cuerpo: grupos.length ? `
			<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Vehículo</span><input class="inv-input" id="ev_veh" placeholder="Ej: ABC-123 FURGÓN"></div>
				<div class="inv-field"><span class="inv-label">Chofer</span><select class="inv-select" id="ev_cho">${opcionesChofer(pe.choferes)}</select></div>
				<div class="inv-field"><span class="inv-label">Guía</span><select class="inv-select" id="ev_guia">
					<option value="interna">Guía interna (se imprime con la hoja de ruta)</option>
					<option value="manual">Guía de remisión (escribe el N°)</option>
					<option value="ninguna">Sin guía</option></select></div>
				<div class="inv-field" id="ev_guia_box" hidden><span class="inv-label">N° de guía</span><input class="inv-input" id="ev_guia_num" maxlength="30" placeholder="T001-123"></div>
			</div>
			<div id="ev_resultado"></div>
			${grupos.map((g, gi) => `<div class="ev-gbloque" data-gb="${gi}">
				<div class="inv-toolbar" style="align-items:center;margin-top:10px">
					<label class="inv-check"><input type="checkbox" class="ev-grupo" data-g="${gi}" checked>
						<b>${esc(g.origen_nombre)} → ${esc(g.destino_nombre)}</b></label>
					<span class="inv-ayuda">${g.items.length} producto(s)${g.telefono ? '' : ' · <span class="inv-neg">sin WhatsApp del encargado (ponlo en Configurar)</span>'}</span>
					<span class="inv-sep"></span>
					<span class="lg-valor" title="Costo de la mercadería (último costo de compra)">Valor del envío: <b class="ev-valor" data-g="${gi}">—</b></span>
				</div>
				<div class="inv-table-wrap"><table class="inv-table">
					<thead><tr><th>Producto</th><th style="text-align:right">Por enviar</th><th style="text-align:right" title="Almacén principal de ${esc(g.origen_nombre)}">Hay en ${esc(g.almacen || g.origen_nombre)}</th><th>Enviar</th><th style="text-align:right">Valor</th></tr></thead>
					<tbody>${g.items.map((i, ii) => {
						const enviar = Math.min(i.cantidad, Math.max(0, i.stock));
						return `<tr><td>${esc(i.descripcion)}${origenPedido(i)}
							<span class="inv-link inv-link-rojo" style="font-size:11px;display:block;margin-top:3px" data-noenviar="${gi}-${ii}"><i class="fa fa-ban"></i>No enviar esto</span></td>
							<td style="text-align:right">${num(i.cantidad)} <span class="inv-muted">${esc(i.unidad || 'und')}</span></td>
							<td style="text-align:right" class="${i.stock < i.cantidad ? 'inv-neg' : ''}">${num(i.stock)}</td>
							<td><input class="inv-input ev-cant" data-g="${gi}" data-i="${ii}" type="number" min="0" step="any" inputmode="decimal"
								style="width:90px" value="${enviar ? Number(enviar.toFixed(2)) : ''}" placeholder="0">
								${i.stock < i.cantidad ? (Number(i.producir) > 0
									? `<span class="inv-sub inv-neg"><i class="fa fa-flask"></i> falta producir ${num(i.cantidad - Math.max(0, i.stock))} en ${esc(g.origen_nombre)} (Producción)</span>`
									: '<span class="inv-sub inv-neg">no alcanza: va lo que hay</span>') : ''}
								${(i.otros_almacenes || []).map(a => {
									const q = Math.min(i.cantidad - Math.max(0, i.stock), Number(a.stock));
									return `<div class="lg-mover"><i class="fa fa-lightbulb-o"></i> Hay <b>${num(a.stock)}</b> en <b>${esc(a.almacen)}</b>.
										<button class="btn btn-sm btn-success" data-mover="${gi}-${ii}" data-desde="${a.idalmacen}" data-almacen="${esc(a.almacen)}" data-q="${q}">
										<i class="fa fa-arrow-right"></i>Pasar ${num(q)} a ${esc(g.almacen || 'el almacén principal')}</button></div>`;
								}).join('')}</td>
							<td style="text-align:right">${i.costo > 0 ? `<span class="ev-vi" data-g="${gi}" data-i="${ii}"></span><span class="inv-sub">${soles(i.costo)} c/u</span>`
								: '<span class="inv-sub inv-neg" title="Este producto no tiene costo de compra registrado">sin costo</span>'}</td></tr>`;
					}).join('')}</tbody></table></div></div>`).join('')}
			<p class="lg-valor-total" id="ev_total_p">Valor total de lo que sale: <b id="ev_total">—</b>
				${grupos.some(g => g.items.some(i => !(i.costo > 0))) ? '<span class="inv-sub inv-neg">Hay productos sin costo: regístralos con una compra para que el valor sea exacto.</span>' : ''}</p>
`
			: '<p class="inv-empty"><i class="fa fa-check-circle"></i>No hay nada por enviar. Cuando aceptes pedidos en la Bandeja central, aparecerán aquí.</p>',
	}) : '') + (recientes ? `<div id="ev_rec_card">${tarjeta({
		titulo: F ? F[0] : 'Envíos recientes',
		ayuda: F ? F[1] : 'Los últimos 50. Clic en uno para ver el detalle (qué llegó y qué faltó) o imprimir su hoja de ruta.',
		acciones: `<select class="inv-input" id="ev_filtro" aria-label="Mostrar" style="width:auto">
			${FILTROS.map(([v, t]) => `<option value="${v}" ${v === filtroRec ? 'selected' : ''}>${t}</option>`).join('')}</select>`,
		cuerpo: `<div id="ev_recientes">${recientesHtml(lista)}</div>`,
	})}</div>` : '') + '</div>';

	const raiz = cont.querySelector('#ev_raiz');
	if (recientes) { raiz.querySelector('#ev_filtro').addEventListener('change', e => { filtroRec = e.target.value; raiz.querySelector('#ev_recientes').innerHTML = recientesHtml(ultimaLista); }); }
	raiz.addEventListener('click', e => {
		const r = e.target.closest('[data-ruta]');
		const imp = e.target.closest('[data-imprimir]');
		if (imp) { imprimirHoja(Number(imp.dataset.imprimir)); return; }
		if (r && Number(r.dataset.ruta) && !e.target.closest('[data-tel]')) { verDetalle(r); }
		const ne = e.target.closest('[data-noenviar]');
		if (ne) { const [gi, ii] = ne.dataset.noenviar.split('-').map(Number); noEnviar(grupos[gi], grupos[gi].items[ii]); }
		const m = e.target.closest('[data-mover]');
		if (m) { const [gi, ii] = m.dataset.mover.split('-').map(Number); moverAlmacen(grupos[gi], grupos[gi].items[ii], m); }
	});
	if (!enviar || !grupos.length) { return; }
	const valorar = () => {
		let total = 0;
		grupos.forEach((g, gi) => {
			const chk = cont.querySelector(`.ev-grupo[data-g="${gi}"]`);
			if (!chk) { return; }   // ya despachado: salio de la vista
			const marcado = chk.checked;
			let v = 0;
			g.items.forEach((i, ii) => {
				const q = Number(cont.querySelector(`.ev-cant[data-g="${gi}"][data-i="${ii}"]`).value || 0);
				const vi = q * (i.costo || 0);
				v += vi;
				const el = cont.querySelector(`.ev-vi[data-g="${gi}"][data-i="${ii}"]`);
				if (el) { el.textContent = soles(vi); }
			});
			cont.querySelector(`.ev-valor[data-g="${gi}"]`).textContent = soles(v);
			if (marcado) { total += v; }
		});
		const tot = cont.querySelector('#ev_total');
		if (tot) { tot.textContent = soles(total); }
	};
	raiz.addEventListener('input', valorar);
	raiz.addEventListener('change', valorar);
	valorar();
	autocompletar(cont.querySelector('#ev_veh'), pe.vehiculos);
	const cho = cont.querySelector('#ev_cho');
	cho.addEventListener('change', async () => {
		if (cho.value !== 'nuevo') { return; }
		const c = await dialogoChofer();
		if (c) { pe.choferes.push({ idchofer: c.idchofer, nombre: c.nombre, telefono: c.telefono }); }
		cho.innerHTML = opcionesChofer(pe.choferes, c ? c.idchofer : '');
	});
	const guia = cont.querySelector('#ev_guia');
	guia.addEventListener('change', () => { cont.querySelector('#ev_guia_box').hidden = guia.value !== 'manual'; });
	cont.querySelector('#ev_despachar').addEventListener('click', e => despachar(cont, grupos, e.currentTarget, tk));
}

function seleccion(cont, grupos) {
	return grupos.map((g, gi) => ({ g, gi })).filter(({ gi }) => { const c = cont.querySelector(`.ev-grupo[data-g="${gi}"]`); return c && c.checked; })
		.map(({ g, gi }) => ({
			origen: g.origen, destino: g.destino, destino_nombre: g.destino_nombre, origen_nombre: g.origen_nombre, telefono: g.telefono,
			items: g.items.map((i, ii) => ({ idproducto_central: i.idproducto_central, descripcion: i.descripcion, unidad: i.unidad, costo: i.costo,
				cantidad: Number(cont.querySelector(`.ev-cant[data-g="${gi}"][data-i="${ii}"]`).value || 0) })).filter(i => i.cantidad > 0),
		}));
}

function opcionesChofer(lista, elegido) {
	return `<option value="">— Sin chofer —</option>${lista.map(c => `<option value="${c.idchofer}" ${Number(elegido) === c.idchofer ? 'selected' : ''}>${esc(c.nombre)}${c.telefono ? '' : ' (sin celular)'}</option>`).join('')}
		<option value="nuevo">+ Nuevo chofer…</option>`;
}

/** "2 h 15 min", "3 días 4 h" */
function duracion(min) {
	const m = Math.max(0, Number(min) || 0);
	if (m < 60) { return `${m} min`; }
	if (m < 1440) { return `${Math.floor(m / 60)} h${m % 60 ? ' ' + (m % 60) + ' min' : ''}`; }
	const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60);
	return `${d} día${d > 1 ? 's' : ''}${h ? ' ' + h + ' h' : ''}`;
}

function choferHtml(x) {
	if (!x.chofer && !x.vehiculo) { return '<span class="inv-sub">—</span>'; }
	const tel = String(x.chofer_tel || '').replace(/\D/g, '');
	return `${esc(x.chofer || 'Sin chofer')}${x.vehiculo ? `<span class="inv-sub">${esc(x.vehiculo)}</span>` : ''}
		${tel.length >= 9 ? `<span class="inv-sub"><a href="tel:${tel}" data-tel><i class="fa fa-phone"></i> ${esc(x.chofer_tel)}</a></span>` : ''}`;
}

function llegadaHtml(x) {
	if (x.estado === 'despachado') {
		const tarde = Number(x.minutos) >= 1440;
		return `<b class="${tarde ? 'inv-neg' : ''}">En camino hace ${duracion(x.minutos)}</b>${tarde ? '<span class="inv-sub inv-neg">más de 24 h: llama al chofer o a la sede</span>' : ''}`;
	}
	if (x.recibido) {
		return `Recibió <b>${esc(x.recibio || '—')}</b><span class="inv-sub">${esc(x.recibido)} · tardó ${duracion(x.minutos)}</span>`;
	}
	return '<span class="inv-sub">—</span>';
}

function recientesHtml(lista) {
	ultimaLista = lista;
	const ver = lista.filter(x => filtroRec === 'todos' || (filtroRec === 'camino' ? x.estado === 'despachado' : String(x.estado).startsWith('recibido')));
	if (!ver.length) { return `<p class="inv-empty">${lista.length ? (filtroRec === 'camino' ? 'No hay envíos en camino.' : 'No hay envíos recibidos entre los últimos 50.') : 'Aún no hay envíos.'}</p>`; }
	return `<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>N°</th><th>De → A</th><th>Salió</th><th>Chofer</th><th>Llegada</th><th>Productos</th><th style="text-align:right">Valor</th><th>Estado</th></tr></thead>
			<tbody>${ver.map(x => { const [txt, cls] = ESTADO[x.estado] || [x.estado, '']; return `<tr style="cursor:pointer" data-ruta="${x.idruta}" data-tras="${x.idtraslado}">
				<td><b>${x.idtraslado}</b>${x.idruta ? `<span class="inv-sub">ruta ${x.idruta}</span>` : ''}</td><td>${esc(x.origen)} → ${esc(x.destino)}</td>
				<td>${esc(fecha(x.fecha_despacho))}</td><td>${choferHtml(x)}</td><td>${llegadaHtml(x)}</td><td>${x.productos}</td>
				<td style="text-align:right">${soles(x.valor || 0)}${Number(x.valor_faltante) > 0 ? `<span class="inv-sub inv-neg">faltó ${soles(x.valor_faltante)}</span>` : ''}</td>
				<td><span class="inv-estado ${cls}">${esc(txt)}</span>${x.entregado ? `<span class="inv-sub"><i class="fa fa-map-marker"></i> Entregado ${esc(x.entregado)}${x.entrega_recibio ? ' a ' + esc(x.entrega_recibio) : ''}${x.entrega_lat ? ` · <a href="https://www.google.com/maps?q=${Number(x.entrega_lat)},${Number(x.entrega_lng)}" target="_blank" rel="noopener">ver ubicación</a>` : ''}${x.estado === 'despachado' ? ' · falta que la sede cuente' : ''}</span>` : ''}${x.observaciones ? `<span class="inv-sub" title="${esc(x.observaciones)}"><i class="fa fa-comment-o"></i> ${esc(x.observaciones)}</span>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
}

/** De que pedido viene: "Pedido N° 10: pidió 50 · ya salieron 40 · faltan 10" (asi se entiende un saldo). */
function origenPedido(i) {
	return (i.sin_pedido > 0 ? `<span class="inv-sub"><i class="fa fa-share-alt"></i> Reparto sin pedido: ${num(i.sin_pedido)}</span>` : '') + (i.pedidos || []).map(p => {
		const salio = Number(p.salio);
		return `<span class="inv-sub">Pedido N° ${p.idsol}: pidió ${num(p.pidio)}${salio > 0
			? ` · <b>ya salieron ${num(salio)}</b> · faltan ${num(p.falta)} <span class="inv-muted">(es lo que no fue en el envío anterior)</span>` : ''}</span>`;
	}).join('');
}

async function noEnviar(g, i) {
	const ok = await confirmar({
		titulo: `¿No enviar ${num(i.cantidad)} ${i.unidad || 'und'} de ${i.descripcion} a ${g.destino_nombre}?`, boton: 'Sí, no enviar',
		textoHtml: `<p style="margin:0">Desaparece de esta lista y el pedido se da por atendido con lo que ya salió. Úsalo si ya no lo van a mandar
			(no hay, la sede ya no lo necesita, etc.).</p>`,
	});
	if (!ok) { return; }
	try {
		await api('traslados.php?op=no_enviar', { origen: g.origen, destino: g.destino, idproducto_central: i.idproducto_central });
		aviso('Listo, ya no está por enviar.');
		recargar();
	} catch (err) { aviso(err.message, 'error'); }
}

// Lo que falta esta en otro almacen de la misma sede (ej. PRODUCCION): se pasa al principal con un clic y se recarga
async function moverAlmacen(g, i, btn) {
	const q = Number(btn.dataset.q);
	const ok = await confirmar({
		titulo: `¿Pasar ${num(q)} ${i.unidad || 'und'} de ${i.descripcion} a ${g.almacen || 'el almacén principal'}?`, peligro: false,
		boton: 'Sí, pasar ' + num(q),
		textoHtml: `<p style="margin:0">Sale de <b>${esc(btn.dataset.almacen)}</b> y entra a <b>${esc(g.almacen || 'el almacén principal')}</b> de ${esc(g.origen_nombre)}.
			Así se completa el envío a <b>${esc(g.destino_nombre)}</b>.</p>`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	if (!btn.dataset.tk) { btn.dataset.tk = nuevoToken('mv'); }   // el reintento usa el mismo: si ya se movio, el servidor no mueve otra vez
	try {
		await api('traslados.php?op=mover_almacen', { idsede: g.origen, idproducto_central: i.idproducto_central, desde: Number(btn.dataset.desde),
			cantidad: q, token: btn.dataset.tk });
		delete btn.dataset.tk;
		aviso(`Listo: ${num(q)} de ${i.descripcion} ya están en ${g.almacen || 'el almacén principal'}.`);
		recargar();
	} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
}

async function despachar(cont, grupos, btn, tk) {
	const malo = [...cont.querySelectorAll('.ev-cant')].find(inp => leerNum(inp) === null);
	if (malo) { aviso('Hay una cantidad mal escrita. Usa punto para decimales (ej: 1.5).', 'error'); malo.focus(); return; }
	const sel = seleccion(cont, grupos);
	if (!sel.length) { aviso('Marca al menos un envío.', 'error'); return; }
	const vacio = sel.find(g => !g.items.length);
	if (vacio) { aviso(`El envío a ${vacio.destino_nombre} no tiene cantidades: desmárcalo o pon cuánto va.`, 'error'); return; }
	const veh = cont.querySelector('#ev_veh').value.trim();
	const selCho = cont.querySelector('#ev_cho'), idchofer = Number(selCho.value) || 0;
	const cho = idchofer ? selCho.options[selCho.selectedIndex].text.replace(' (sin celular)', '') : '';
	const guia = cont.querySelector('#ev_guia').value, guiaNum = cont.querySelector('#ev_guia_num').value.trim();
	if (guia === 'manual' && !guiaNum) { aviso('Escribe el número de la guía de remisión.', 'error'); return; }
	const ok = await confirmar({
		titulo: `¿Despachar la ruta con ${sel.length} envío(s)?`, peligro: false, boton: 'Sí, despachar',
		textoHtml: `<ul style="margin:0 0 8px;padding-left:18px">${sel.map(g => `<li><b>${esc(g.origen_nombre)} → ${esc(g.destino_nombre)}</b>: ${g.items.length} producto(s) · <b>${soles(g.items.reduce((s, i) => s + i.cantidad * (i.costo || 0), 0))}</b></li>`).join('')}</ul>
			${(() => { const q = []; sel.forEach(g => { const og = grupos.find(x => x.origen === g.origen && x.destino === g.destino);
				g.items.forEach(i => { const p = og && og.items.find(x => x.idproducto_central === i.idproducto_central);
					if (p && i.cantidad < p.cantidad - 0.0001) { q.push(`${esc(i.descripcion)}: van ${num(i.cantidad)} de ${num(p.cantidad)}, <b>quedan ${num(p.cantidad - i.cantidad)} pendientes</b>`); } }); });
				return q.length ? `<div class="lg-alerta" style="margin:0 0 8px">${q.join('<br>')}<br><span class="inv-muted">Lo pendiente seguirá apareciendo aquí para otro envío. Si no lo vas a mandar, usa "No enviar esto".</span></div>` : ''; })()}
			<p style="margin:0 0 6px">Valor total que sale: <b>${soles(sel.reduce((s, g) => s + g.items.reduce((t, i) => t + i.cantidad * (i.costo || 0), 0), 0))}</b></p>
			<p class="inv-ayuda" style="margin:0">El stock <b>sale ahora</b> del almacén de origen. ${veh ? 'Vehículo: ' + esc(veh) + '. ' : ''}${cho ? 'Chofer: ' + esc(cho) + '.' : ''}</p>`,
	});
	if (!ok) { return; }
	const bloques = [...cont.querySelectorAll('.ev-gbloque')].filter(b => { const c = b.querySelector('.ev-grupo'); return c && c.checked; });
	const textoBtn = btn.innerHTML;
	btn.disabled = true;
	btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>Despachando…';
	bloques.forEach(b => b.classList.add('ev-cargando'));
	try {
		const r = await api('traslados.php?op=despachar', {
			grupos: sel.map(g => ({ origen: g.origen, destino: g.destino, items: g.items.map(i => ({ idproducto_central: i.idproducto_central, cantidad: i.cantidad })) })),
			vehiculo: veh, idchofer, guia_tipo: guia, guia_numero: guiaNum, token: tk.v,
		});
		const link = new URL('../../index.html#/recibir', import.meta.url).href;   // app/logistica/index.html (abre en el celular)
		const caja = cont.querySelector('#ev_resultado');
		caja.innerHTML = `<div class="inv-toolbar" style="display:block;margin-top:14px">
			<p style="margin:0 0 8px"><i class="fa fa-check-circle inv-pos"></i> <b>Ruta N° ${r.idruta} despachada.</b></p>
			<div id="ev_avisos"><p class="inv-ayuda" style="margin:0 0 8px"><i class="fa fa-spinner fa-spin"></i> Avisando a cada sede por WhatsApp…</p></div>
			<button class="btn btn-sm btn-light" id="ev_hoja" style="margin:0 0 6px"><i class="fa fa-print"></i>Imprimir hoja de ruta</button></div>`;
		caja.querySelector('#ev_hoja').addEventListener('click', () => imprimirHoja(r.idruta));
		caja.scrollIntoView({ behavior: 'smooth', block: 'center' });
		tk.v = 'dp' + Date.now() + Math.random().toString(36).slice(2);   // el siguiente despacho es otro
		aviso(`Ruta N° ${r.idruta} despachada.`);
		// lo despachado sale de la vista (se desvanece); si no queda nada, se dice
		bloques.forEach(b => { b.classList.remove('ev-cargando'); b.classList.add('ev-sale'); });
		setTimeout(() => {
			bloques.forEach(b => b.remove());
			const quedan = cont.querySelectorAll('.ev-gbloque').length;
			btn.innerHTML = textoBtn;
			btn.disabled = false;
			if (!quedan) {
				btn.hidden = true;
				['#ev_total_p'].forEach(q => { const e = cont.querySelector(q); if (e) { e.remove(); } });
				const tb = cont.querySelector('#ev_veh') && cont.querySelector('#ev_veh').closest('.inv-toolbar');
				if (tb) { tb.insertAdjacentHTML('afterend', '<p class="inv-empty"><i class="fa fa-check-circle"></i>Todo despachado. Lo nuevo que acepten en la Bandeja aparecerá aquí.</p>'); tb.remove(); }
			}
		}, 450);
		api('traslados.php?op=listar').then(l => { const e = cont.querySelector('#ev_recientes'); if (e) { e.innerHTML = recientesHtml(l); } }).catch(() => {});
		avisarSedes(caja.querySelector('#ev_avisos'), r, sel, { link, veh, cho });
	} catch (err) {
		aviso(err.message, 'error');
		bloques.forEach(b => b.classList.remove('ev-cargando'));
		btn.innerHTML = textoBtn;
		btn.disabled = false;
	}
}

// Aviso automatico por el WhatsApp del POS; si una sede no se pudo avisar, queda el boton para avisar a mano.
async function avisarSedes(caja, r, sel, { link, veh, cho }) {
	let res, ch = null;
	try { const a = await api('traslados.php?op=avisar', { idruta: r.idruta }); res = a.sedes; ch = a.chofer; }
	catch (err) { res = r.traslados.map(tr => ({ idtraslado: tr.idtraslado, destino: tr.destino, enviado: false, error: err.message })); }
	const lineaChofer = !ch ? '' : ch.enviado
		? `<p style="margin:0 0 6px"><i class="fa fa-id-card-o inv-pos"></i> Chofer ${esc(ch.nombre)}: <b>le llegó su ruta por WhatsApp</b></p>`
		: `<p style="margin:0 0 6px"><i class="fa fa-exclamation-circle inv-neg"></i> Chofer ${esc(ch.nombre)}: no se pudo avisar solo. ${esc(ch.error || '')}
			${ch.enlace ? `<button class="btn btn-sm btn-light" data-copiar-chofer="${esc(ch.enlace)}" style="margin-left:6px"><i class="fa fa-copy"></i>Copiar su enlace</button>` : ''}</p>`;
	caja.innerHTML = lineaChofer + res.map(x => x.enviado
		? `<p style="margin:0 0 6px"><i class="fa fa-whatsapp inv-pos"></i> ${esc(x.destino)}: <b>avisado por WhatsApp</b></p>`
		: `<p style="margin:0 0 6px"><i class="fa fa-exclamation-circle inv-neg"></i> ${esc(x.destino)}: no se pudo avisar solo. ${esc(x.error || '')}
			<button class="btn btn-sm btn-success" data-wsp="${x.idtraslado}" style="margin-left:6px"><i class="fa fa-whatsapp"></i>Avisar a mano</button></p>`).join('');
	const cc = caja.querySelector('[data-copiar-chofer]');
	if (cc) { cc.addEventListener('click', async () => { try { await navigator.clipboard.writeText(cc.dataset.copiarChofer); aviso('Enlace copiado.'); } catch (e) { aviso('No se pudo copiar.', 'error'); } }); }
	caja.querySelectorAll('[data-wsp]').forEach(b => b.addEventListener('click', () => {
		const tr = r.traslados.find(x => x.idtraslado === Number(b.dataset.wsp));
		const g = sel.find(x => Number(x.origen) === tr.idorigen && Number(x.destino) === tr.iddestino);
		const texto = [`Hola, *va en camino* mercadería para ${tr.destino} (envío N° ${tr.idtraslado}):`, '',
			...g.items.map(i => `- ${num(i.cantidad)} ${i.unidad || 'und'} de ${i.descripcion}`), '',
			cho ? `Chofer: ${cho}${veh ? ' · ' + veh : ''}` : '', `Cuando llegue, cuéntalo y confírmalo aquí: ${link}`].join('\n');
		const dig = String(g.telefono || '').replace(/\D/g, '');
		if (dig.length < 9) { aviso(`${tr.destino} no tiene WhatsApp del encargado. Ponlo en Configurar.`, 'error'); return; }
		window.open(`https://wa.me/${dig.length === 9 ? '51' + dig : dig}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
	}));
}

/** Detalle de un envio debajo de su fila: por producto, cuanto salio, cuanto llego, cuanto falto y por que. */
async function verDetalle(tr) {
	const abierto = tr.nextElementSibling && tr.nextElementSibling.classList.contains('ev-det') ? tr.nextElementSibling : null;
	const tb = tr.closest('tbody');
	tb.querySelectorAll('.ev-sel').forEach(x => x.classList.remove('ev-sel'));
	// el que estaba abierto se cierra con animacion (y se quita al terminar)
	tb.querySelectorAll('.ev-det').forEach(d => { d.classList.add('cierra'); setTimeout(() => d.remove(), 220); });
	if (abierto) { return; }   // segundo clic: se cierra
	tr.classList.add('ev-sel');
	const det = document.createElement('tr');
	det.className = 'ev-det';
	det.innerHTML = `<td colspan="${tr.children.length}"><p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p></td>`;
	tr.after(det);
	let d;
	try { d = await api('traslados.php?op=hoja&id=' + tr.dataset.ruta); } catch (err) { det.remove(); aviso(err.message, 'error'); return; }
	if (!det.isConnected) { return; }
	const t = d.traslados.find(x => Number(x.idtraslado) === Number(tr.dataset.tras));
	if (!t) { det.remove(); return; }
	let falta = 0;
	const filas = t.items.map(i => {
		const llego = i.cantidad_recibida === null ? null : Number(i.cantidad_recibida);
		const dif = llego === null ? 0 : llego - Number(i.enviada);
		if (dif < 0) { falta += -dif * Number(i.costo || 0); }
		const nota = [i.motivo_diferencia, i.observacion].filter(Boolean).map(esc).join(' · ');
		return `<tr${dif < 0 ? ' class="ev-falta"' : ''}><td>${esc(i.descripcion)}</td>
			<td class="inv-num">${num(i.enviada)} ${esc(i.unidad || 'und')}</td>
			<td class="inv-num">${llego === null ? '<span class="inv-sub">sin contar</span>' : num(llego)}</td>
			<td class="inv-num">${dif < 0 ? `<b class="inv-neg">${num(dif)}</b>` : dif > 0 ? `+${num(dif)}` : llego === null ? '' : '<i class="fa fa-check inv-pos"></i>'}</td>
			<td class="inv-num">${dif < 0 ? `<span class="inv-neg">${soles(-dif * Number(i.costo || 0))}</span>` : ''}</td>
			<td>${nota || ''}</td></tr>`;
	}).join('');
	const quien = [`Salió ${esc(fecha(d.ruta.fecha_salida))}`, d.ruta.chofer ? `chofer <b>${esc(d.ruta.chofer)}</b>${d.ruta.vehiculo ? ' (' + esc(d.ruta.vehiculo) + ')' : ''}` : '',
		t.entregado ? `el chofer lo entregó ${esc(t.entregado)}${t.entrega_recibio ? ' a ' + esc(t.entrega_recibio) : ''}` : '',
		t.recibido ? `contó y recibió <b>${esc(t.recibio || '—')}</b> el ${esc(t.recibido)}` : 'la sede aún no lo cuenta'].filter(Boolean).join(' · ');
	det.innerHTML = `<td colspan="${tr.children.length}"><div class="ev-det-caja">
		<p style="margin:0 0 8px">${quien}</p>
		<div class="inv-table-wrap"><table class="inv-table"><thead><tr><th>Producto</th><th class="inv-num">Salió</th><th class="inv-num">Llegó</th><th class="inv-num">Diferencia</th><th class="inv-num">Valor que faltó</th><th>Por qué / observación</th></tr></thead>
		<tbody>${filas}</tbody></table></div>
		${falta > 0 ? `<p class="inv-neg" style="margin:8px 0 0"><b>Faltó en total: ${soles(falta)}</b></p>` : ''}
		${t.nota_recibe ? `<p style="margin:8px 0 0"><i class="fa fa-comment-o"></i> Observación de la sede: ${esc(t.nota_recibe)}</p>` : ''}
		${t.entrega_obs ? `<p style="margin:4px 0 0"><i class="fa fa-truck"></i> Observación del chofer: ${esc(t.entrega_obs)}</p>` : ''}
		<div data-historia="traslado:${t.idtraslado}"></div>
		<button type="button" class="btn btn-sm btn-light" data-imprimir="${tr.dataset.ruta}" style="margin-top:10px"><i class="fa fa-print"></i>Imprimir hoja de ruta</button>
	</div></td>`;
	cargarHistorias(det);
}

async function imprimirHoja(idruta) {
	let d;
	try { d = await api('traslados.php?op=hoja&id=' + idruta); } catch (err) { aviso(err.message, 'error'); return; }
	const lotes = txt => { try { return (JSON.parse(txt) || []).map(l => `${esc(l.lote || 's/l')}${l.vence ? ' vence ' + esc(fecha(l.vence)) : ''}: ${num(l.cantidad)}`).join('<br>'); } catch (e) { return ''; } };
	imprimir({
		titulo: `Hoja de ruta N° ${d.ruta.idruta}`,
		cuerpo: `<h1>Hoja de ruta N° ${d.ruta.idruta}</h1>
		<div class="m">Salida: ${esc(fecha(d.ruta.fecha_salida))} · Vehículo: ${esc(d.ruta.vehiculo || '—')} · Chofer: ${esc(d.ruta.chofer || '—')}</div>
		${d.traslados.map(t => `<div class="pag"><h2>${t.orden_entrega}. ${esc(t.destino)} <span class="m">(envío N° ${t.idtraslado} · desde ${esc(t.origen)})</span></h2>
			<div class="m">${esc(t.direccion || '')}${t.guia_tipo === 'manual' ? ' · Guía de remisión ' + esc(t.guia_numero || '') : t.guia_tipo === 'interna' ? ' · Guía interna N° ' + t.idtraslado : ''}</div>
			<table><thead><tr><th>Producto</th><th>Cantidad</th><th class="solo-a5">Lote</th><th class="n">Valor</th><th class="solo-a5">Recibido</th></tr></thead><tbody>
			${t.items.map(i => `<tr><td>${esc(i.descripcion)}${i.observacion ? `<div class="m">Obs.: ${esc(i.observacion)}</div>` : ''}</td><td>${num(i.enviada)} ${esc(i.unidad || 'und')}</td><td class="solo-a5">${lotes(i.lotes)}</td><td class="n">${soles(i.valor || 0)}</td><td class="solo-a5"></td></tr>`).join('')}
			<tr><td colspan="2" class="n"><b>Valor del envío</b></td><td class="solo-a5"></td><td class="n"><b>${soles(t.items.reduce((s, i) => s + Number(i.valor || 0), 0))}</b></td><td class="solo-a5"></td></tr>
			</tbody></table>${t.entregado ? `<div class="m">Entregado por el chofer: ${esc(t.entregado)}${t.entrega_recibio ? ' · recibió ' + esc(t.entrega_recibio) : ''}${t.entrega_obs ? ' · ' + esc(t.entrega_obs) : ''}</div>` : ''}${t.nota_recibe ? `<div class="m">Observación al recibir: ${esc(t.nota_recibe)}</div>` : ''}<div class="firma"><div>Entregó (chofer)</div><div>Recibió (${esc(t.destino)})</div></div></div>`).join('')}`,
	});
}
