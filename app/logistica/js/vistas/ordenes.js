// Ordenes de compra (F4, central):
//  - "Por comprar": lo que la Bandeja decidio comprar, agrupado por proveedor habitual -> "Generar orden".
//  - "Ordenes": lista; clic -> detalle con Aprobar / Enviar por WhatsApp / Imprimir-PDF / Anular.
import { cargarHistorias } from '../historia.js?v=20261026a';
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, confirmar, autocompletar, imprimir, nuevoToken, leerNum, fecha } from '../ui.js?v=20261026a';
import { vigente, recargar, turnoActual } from '../router.js?v=20261026a';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const soles = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const manana = () => new Date(Date.now() + 864e5).toLocaleDateString('en-CA');   // YYYY-MM-DD con la hora local
const hoy = () => new Date().toLocaleDateString('en-CA');
// "para cuando debe llegar": con esto se califica si el proveedor llega a tiempo (Proveedores)
const campoEntrega = id => `<input type="date" class="inv-input" id="${id}" value="${manana()}" min="${hoy()}" style="width:180px">`;

/** Nota del proveedor (ultimos 90 dias) junto a su nombre: ★ 4.5 Cumple bien */
function notaProv(c) {
	if (!c || c.estrellas === null) { return ''; }
	const cls = c.estrellas >= 4 ? 'aprobado' : c.estrellas >= 3 ? 'borrador' : 'lg-sube';
	const det = [c.tarde ? `llegó tarde ${c.tarde} vez(es)` : '', c.faltas ? `faltaron ${c.faltas} producto(s)` : ''].filter(Boolean).join(', ');
	return `<span class="inv-estado ${cls}" title="Últimos 90 días${det ? ': ' + det : ''}">★ ${String(c.estrellas).replace('.', ',')} ${esc(c.etiqueta)}</span>`;
}

const CLASE = { por_aprobar: 'borrador', aprobada: 'cerrado', enviada: 'cerrado', parcial: 'borrador', recibida: 'aprobado', anulada: 'anulado' };

/** "2 CAJA (12 und)" o "12 und" */
function cantidadTxt(cant, factor, presentacion, unidad) {
	const u = esc(unidad || 'und');
	if (presentacion && Number(factor) > 1) { return `<b>${num(cant / factor)} ${esc(presentacion)}</b> <span class="inv-muted">(${num(cant)} ${u})</span>`; }
	return `<b>${num(cant)}</b> <span class="inv-muted">${u}</span>`;
}

let datos = null;
// desde el diagrama cada caja abre solo su tarea (ruta "ordenes/<foco>")
const FOCOS = {
	comprar: ['Por comprar', 'Productos que hay que comprar y aún no tienen orden. Elige a quién se lo compras y presiona <b>Generar orden</b>.'],
	otra: ['No lo compres: ya lo tienes', 'Estos productos están parados en otra sede o en otro almacén de la central. Tráelos en vez de comprarlos.'],
	bajo: ['Almacén bajo', 'Lo que se está terminando en el almacén central. Pon cuánto comprar y pásalo a Por comprar.'],
	aprobar: ['Órdenes por aprobar', 'Ábrela, revisa los precios y apruébala.', 'por_aprobar'],
	enviar: ['Falta enviar al proveedor', 'Ya están aprobadas. Ábrela y envíala por WhatsApp o imprímela.', 'aprobada'],
};

// Antes de comprar, mover: otra sede lo tiene parado o esta en otro almacen de la central
function alertas(i) {
	const p = (i.parado || []).map(o => `<div class="lg-alerta"><i class="fa fa-exchange"></i> <b>No lo compres:</b> ${esc(o.sede)} tiene ${num(o.libre)} ${esc(i.unidad || 'und')} parado
		(${o.dias_stock ? `le alcanza para ${o.dias_stock} días` : 'allá no se vende'}).
		<button class="btn btn-sm btn-success" data-trasladar="${i.idproducto_central}" data-origen="${o.idsede}" data-nombre="${esc(o.sede)}"><i class="fa fa-truck"></i>Traer de ${esc(o.sede)}</button></div>`).join('');
	const a = (i.otros || []).map(o => {
		const q = Math.min(i.pedido, o.stock);
		return `<div class="lg-alerta"><i class="fa fa-lightbulb-o"></i> <b>No lo compres:</b> en la central hay ${num(o.stock)} en <b>${esc(o.almacen)}</b>.
			<button class="btn btn-sm btn-success" data-usar="${i.idproducto_central}" data-desde="${o.idalmacen}" data-almacen="${esc(o.almacen)}" data-q="${q}"
				data-nombre="${esc(i.descripcion)}"><i class="fa fa-check"></i>Usar ${num(q)} de ${esc(o.almacen)}</button></div>`;
	}).join('');
	const b = i.mas_barato ? `<div class="lg-alerta"><i class="fa fa-tag"></i> <b>${esc(i.mas_barato.proveedor)}</b> lo vendió a ${soles(i.mas_barato.precio)}
		(${esc(fecha(i.mas_barato.fecha))}), más barato que ${esc(i.proveedor || 'el habitual')} (${soles(i.precio)}).</div>` : '';
	return p + a + b;
}

export async function render(cont, sesion, t, foco = '') {
	const F = FOCOS[foco];
	const [pc, ordenes] = await Promise.all([api('ordenes.php?op=por_comprar'), api('ordenes.php?op=listar' + (F && F[2] ? '&estado=' + F[2] : ''))]);
	if (!vigente(t)) { return; }
	datos = { pc, ordenes };
	const grupos = new Map();
	(foco === 'otra' ? pc.items.filter(i => (i.parado || []).length || (i.otros || []).length) : pc.items).forEach(i => {
		const k = i.idproveedor || 0;
		if (!grupos.has(k)) { grupos.set(k, { idproveedor: i.idproveedor, proveedor: i.proveedor || 'Sin proveedor', items: [] }); }
		grupos.get(k).items.push(i);
	});
	const lista = [...grupos.values()].sort((a, b) => (a.idproveedor ? 1 : 0) - (b.idproveedor ? 1 : 0) || a.proveedor.localeCompare(b.proveedor));

	const tPor = tarjeta({
		titulo: F && !F[2] ? F[0] : 'Por comprar',
		ayuda: (F && !F[2] ? F[1] + ' ' : '') + 'Lo que la Bandeja central decidió comprar, agrupado por proveedor. Las cantidades ya están redondeadas a cajas o sacos.'
			+ (pc.umbral > 0 ? ` Las órdenes de hasta <b>${soles(pc.umbral)}</b> se aprueban solas.` : ' Toda orden necesita aprobación.'),
		acciones: volver(),
		cuerpo: lista.length ? lista.map(g => `
			<div class="inv-toolbar" style="align-items:center;margin-top:8px">
				<b>${esc(g.proveedor)}</b>${g.idproveedor ? notaProv(pc.calificacion[g.idproveedor]) : ''}
				<span class="inv-ayuda">${g.items.length} producto(s)${g.idproveedor ? ' · aprox. ' + soles(g.items.reduce((s, i) => s + i.subtotal, 0)) : ''}</span>
				<span class="inv-sep"></span>
				${g.idproveedor
					? `<button class="btn btn-sm btn-success" data-generar="${g.idproveedor}"><i class="fa fa-file-text-o"></i>Generar orden</button>`
					: `<span class="inv-ayuda inv-neg">Elige a quién se le compra cada producto y presiona Guardar</span>
						<button class="btn btn-sm btn-success" data-asignar><i class="fa fa-check"></i>Guardar proveedores</button>`}
			</div>
			<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Producto</th><th class="lg-oc">Para</th><th>Comprar</th><th style="text-align:right">Último precio</th>
					${g.idproveedor ? '' : '<th>¿A quién se lo compras?</th>'}</tr></thead>
				<tbody>${g.items.map(i => `<tr>
					<td>${esc(i.descripcion)}<span class="inv-sub">pidieron ${num(i.pedido)} ${esc(i.unidad || 'und')}</span>${alertas(i)}</td>
					<td class="lg-oc inv-ayuda">${esc(i.sedes)}</td>
					<td>${cantidadTxt(i.comprar, i.factor, i.presentacion, i.unidad)}</td>
					<td style="text-align:right">${i.precio ? soles(i.precio) + ' <span class="inv-muted">c/u</span>' : '<span class="inv-muted">—</span>'}</td>
					${g.idproveedor ? '' : `<td><div><input class="inv-input oc-prov" data-id="${i.idproducto_central}" style="width:100%" placeholder="Escribe o elige el proveedor"></div></td>`}
				</tr>`).join('')}</tbody>
			</table></div>`).join('')
			: '<p class="inv-empty"><i class="fa fa-check-circle"></i>No hay nada pendiente de comprar. Lo que decidas comprar en la Bandeja central aparecerá aquí.</p>',
	});
	const tAlm = tarjeta({
		titulo: foco === 'bajo' ? F[0] : 'Comprar para el almacén',
		ayuda: (foco === 'bajo' ? F[1] + ' ' : '') + 'Lo que se está terminando en el almacén central y lo que quieras tener de stock, aunque ninguna sede lo haya pedido. Pasa a <b>Por comprar</b>.',
		cuerpo: '<div id="oc_alm"><p class="inv-muted"><i class="fa fa-spinner fa-spin"></i> Revisando el almacén…</p></div>',
	});
	const tOrd = tarjeta({
		titulo: F && F[2] ? F[0] : 'Órdenes de compra',
		ayuda: F && F[2] ? F[1] : 'Las últimas 50. Abre una para aprobarla, enviarla al proveedor o imprimirla.',
		acciones: '<button class="btn btn-sm btn-success" id="oc_nueva"><i class="fa fa-plus"></i>Nueva orden de compra</button>',
		cuerpo: ordenes.length ? `<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>N°</th><th>Proveedor</th><th>Fecha</th><th>Productos</th><th style="text-align:right">Total</th><th>Estado</th><th></th></tr></thead>
			<tbody>${ordenes.map(o => `<tr style="cursor:pointer" data-abrir="${o.idorden}">
				<td><b>${o.idorden}</b></td><td>${esc(o.proveedor)}</td><td>${esc(fecha(o.fecha))}</td><td>${o.productos}</td>
				<td style="text-align:right">${soles(o.total)}</td><td><span class="inv-estado ${CLASE[o.estado] || ''}">${esc(o.estado_txt)}</span></td>
				<td class="inv-acciones"><span class="inv-link"><i class="fa fa-folder-open-o"></i>Abrir</span></td></tr>`).join('')}
			</tbody></table></div>`
			: `<p class="inv-empty">${F && F[2] ? '<i class="fa fa-check-circle"></i>No hay órdenes aquí. ¡Todo al día!' : 'Aún no hay órdenes de compra.'}</p>`,
	});
	const verSolo = { comprar: [tPor], otra: [tPor], bajo: [tAlm], aprobar: [tOrd], enviar: [tOrd] }[foco];
	cont.innerHTML = '<div id="oc_raiz">' + (verSolo
		? `<div class="lg-foco"><i class="fa fa-filter"></i>Solo: <b>${esc(F[0])}</b><span class="inv-link" data-ir="ordenes"><i class="fa fa-th-list"></i>Ver todo lo de compras</span></div>` + verSolo.join('')
		: tPor + tAlm + tOrd) + '</div>';

	cont.querySelectorAll('.oc-prov').forEach(inp => autocompletar(inp, pc.proveedores));
	if (cont.querySelector('#oc_alm')) { almacen(cont.querySelector('#oc_alm'), t); }
	// en #oc_raiz (no en cont): al recargar se reemplaza y el listener no se acumula
	cont.querySelector('#oc_raiz').addEventListener('click', e => {
		const g = e.target.closest('[data-generar]');
		// proveedores escritos sin guardar: se guardan primero, asi no se genera por error la orden de otro proveedor
		if (g) { if (escritos(cont).length) { asignar(cont, g); } else { generar(Number(g.dataset.generar), g, lista); } }
		const a = e.target.closest('[data-asignar]');
		if (a) { asignar(cont, a); }
		const o = e.target.closest('[data-abrir]');
		if (o) { abrirOrden(cont, Number(o.dataset.abrir)); }
		const tr = e.target.closest('[data-trasladar]');
		if (tr) { trasladar(tr); }
		const us = e.target.closest('[data-usar]');
		if (us) { usarOtroAlmacen(us, pc.idsede_central); }
		if (e.target.closest('#oc_nueva')) { nuevaOrden(cont, pc.proveedores); }
	});
}

// Lo que se iba a comprar ya esta en otro almacen de la central: se pasa al principal y sale de ahi (no se compra)
// ---------- comprar para el almacen central (por terminarse o para stockearse) ----------

async function almacen(caja, t) {
	let a;
	try { a = await api('ordenes.php?op=almacen'); } catch (err) { caja.innerHTML = `<p class="inv-neg">${esc(err.message)}</p>`; return; }
	if (!vigente(t) || !caja.isConnected) { return; }
	const token = nuevoToken('alm');
	const fila = i => `<tr data-c="${i.idproducto_central}">
		<td>${esc(i.descripcion)}${i.pedido ? `<span class="inv-sub">ya pedido ${num(i.pedido)}</span>` : ''}</td>
		<td class="inv-num ${i.dias === 0 ? 'inv-neg' : ''}">${num(i.stock)} <span class="inv-muted">${esc(i.unidad || 'und')}</span></td>
		<td class="inv-num lg-oc">${i.minimo ? num(i.minimo) : '<span class="inv-muted">—</span>'}</td>
		<td class="inv-num lg-oc">${i.sale_dia ? num(i.sale_dia) : '<span class="inv-muted">—</span>'}</td>
		<td class="lg-oc">${i.dias === null || i.dias === undefined ? '<span class="inv-muted">—</span>' : i.dias === 0 ? '<b class="inv-neg">ya no hay</b>' : `${i.dias} día(s)`}</td>
		<td style="white-space:nowrap"><input class="inv-input alm-cant" type="number" min="0" step="any" inputmode="decimal" style="width:90px" value="${i.sugerido || ''}">
			<span class="inv-muted">${esc(i.unidad || 'und')}</span></td></tr>`;
	caja.innerHTML = `
		<p class="inv-ayuda" style="margin:0 0 8px">${a.bajo.length
			? `<b>${a.bajo.length}</b> producto(s) se están terminando (le quedan menos de ${a.dias_alerta} días de lo que sale a las sedes, o está en su mínimo). La cantidad sugerida alcanza para unas ${a.dias_compra / 7} semanas.`
			: '<i class="fa fa-check-circle inv-pos"></i> Nada se está terminando en el almacén.'}</p>
		<div class="inv-table-wrap"><table class="inv-table"><thead><tr><th>Producto</th><th class="inv-num">Hay</th><th class="inv-num lg-oc">Mínimo</th>
			<th class="inv-num lg-oc">Sale por día</th><th class="lg-oc">Le alcanza</th><th>Comprar</th></tr></thead>
			<tbody id="alm_filas">${a.bajo.map(fila).join('')}</tbody></table></div>
		<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px">
			<input class="inv-input" id="alm_otro" style="flex:1;min-width:220px;max-width:420px" placeholder="Agregar otro producto para stockearte">
			<button class="btn btn-sm btn-success" id="alm_ok"><i class="fa fa-cart-plus"></i>Pasar a Por comprar</button></div>`;
	const ops = a.catalogo.map(p => ({ texto: `${p.descripcion} · hay ${num(p.stock)} ${p.unidad || 'und'}`, valor: String(p.c) }));
	const otro = caja.querySelector('#alm_otro');
	autocompletar(otro, ops);
	otro.addEventListener('input', () => {
		const o = ops.find(x => x.texto === otro.value);
		if (!o) { return; }
		const ya = caja.querySelector(`[data-c="${o.valor}"] .alm-cant`);
		if (!ya) {
			const p = a.catalogo.find(x => String(x.c) === o.valor);
			caja.querySelector('#alm_filas').insertAdjacentHTML('beforeend', fila({ idproducto_central: p.c, descripcion: p.descripcion, unidad: p.unidad, stock: Number(p.stock), dias: null }));
		}
		otro.value = '';
		caja.querySelector(`[data-c="${o.valor}"] .alm-cant`).focus();
	});
	caja.querySelector('#alm_ok').addEventListener('click', async e => {
		const btn = e.currentTarget, items = [];
		for (const tr of caja.querySelectorAll('#alm_filas [data-c]')) {
			const q = leerNum(tr.querySelector('.alm-cant'));
			if (q === null || q < 0) { aviso('Revisa las cantidades.', 'error'); return; }
			if (q > 0) { items.push({ idproducto_central: Number(tr.dataset.c), cantidad: q }); }
		}
		if (!items.length) { aviso('Pon cuánto comprar de al menos un producto.', 'error'); return; }
		btn.disabled = true;
		try {
			const r = await api('ordenes.php?op=para_almacen', { items, token });
			aviso(`Listo: ${r.productos} producto(s) en Por comprar.`);
			recargar();
		} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
	});
}

async function usarOtroAlmacen(btn, idsedeCentral) {
	const q = Number(btn.dataset.q);
	const ok = await confirmar({
		titulo: `¿Usar ${num(q)} de ${btn.dataset.almacen} en vez de comprar?`, peligro: false, boton: 'Sí, usar lo que hay',
		textoHtml: `<p style="margin:0">Se pasan <b>${num(q)} de ${esc(btn.dataset.nombre)}</b> de <b>${esc(btn.dataset.almacen)}</b> al almacén principal
			y el pedido de la sede sale de ahí: aparece en <b>Envíos a las sedes</b>. Ya no se compra (si faltara algo, eso sí se sigue comprando).</p>`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	if (!btn.dataset.tk) { btn.dataset.tk = nuevoToken('us'); }   // mismo token en el reintento: no se mueve dos veces
	try {
		// paso 1 ya hecho en un intento anterior (fallo el paso 2): no se repite
		if (!btn.dataset.movido) {
			await api('traslados.php?op=mover_almacen', { idsede: idsedeCentral, idproducto_central: Number(btn.dataset.usar), desde: Number(btn.dataset.desde),
				cantidad: q, token: btn.dataset.tk });
			btn.dataset.movido = '1';
		}
		const r = await api('ordenes.php?op=a_central', { idproducto_central: Number(btn.dataset.usar), movido: q });
		aviso(r.apartado
			? `Se pasaron ${num(q)} al almacén principal, pero ya estaban apartados para envíos a sedes que esperaban stock. Este producto se sigue comprando.`
			: `Listo: ${num(r.ya_no_se_compra)} ya no se compran, se usa lo del almacén.`, r.apartado ? 'error' : undefined);
		recargar();
	} catch (err) {
		aviso(err.message, 'error');
		// ya se movio: se recarga para que el boton no vuelva a pasar mercaderia
		if (btn.dataset.movido) { recargar(); } else { btn.disabled = false; }
	}
}

async function trasladar(btn) {
	const ok = await confirmar({
		titulo: `¿Traer de ${btn.dataset.nombre} en vez de comprar?`, peligro: false, boton: 'Sí, traer de ' + btn.dataset.nombre,
		textoHtml: `<p style="margin:0">Lo que alcance sale de <b>${esc(btn.dataset.nombre)}</b> y aparece en <b>Envíos a las sedes</b> para despacharlo. Lo que falte se sigue comprando.</p>`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	try {
		const r = await api('ordenes.php?op=trasladar', { idproducto_central: Number(btn.dataset.trasladar), idsede_origen: Number(btn.dataset.origen) });
		aviso(`Listo: ${num(r.trasladado)} se traen de ${r.sede}. Despáchalo en Envíos a las sedes.`);
		recargar();
	} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
}

const escritos = cont => [...cont.querySelectorAll('.oc-prov')].filter(i => i.value.trim());

// guarda a quien se le compra cada producto escrito; cada uno pasa al grupo de su proveedor, con su "Generar orden"
async function asignar(cont, btn) {
	const filas = escritos(cont);
	if (!filas.length) { aviso('Escribe o elige el proveedor de al menos un producto.', 'error'); return; }
	btn.disabled = true;
	try {
		for (const i of filas) { await api('ordenes.php?op=asignar_proveedor', { idproducto_central: Number(i.dataset.id), proveedor: i.value.trim() }); }
		const nombres = [...new Set(filas.map(i => i.value.trim().toUpperCase()))].join(', ');
		aviso(`Listo: ${filas.length} producto(s) se compran a ${nombres}. Ahora presiona Generar orden en ese proveedor.`);
		recargar();
	} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
}

async function generar(idproveedor, btn, lista) {
	const g = lista.find(x => x.idproveedor === idproveedor);
	const pregunta = confirmar({
		titulo: `¿Generar la orden para ${g.proveedor}?`, peligro: false, boton: 'Sí, generar orden',
		textoHtml: `<p style="margin:0 0 10px">${g.items.length} producto(s), aprox. <b>${soles(g.items.reduce((s, i) => s + i.subtotal, 0))}</b>.
			Después podrás revisar los precios, aprobarla y enviarla.</p>
			<label class="inv-ayuda" for="oc_entrega" style="display:block;margin-bottom:4px">¿Para cuándo debe llegar?</label>
			<div style="margin-bottom:10px">${campoEntrega('oc_entrega')}</div>
			<label class="inv-ayuda" for="oc_nota" style="display:block;margin-bottom:4px">Observaciones (opcional)</label>
			<textarea id="oc_nota" class="inv-input" rows="3" maxlength="255" style="width:100%;resize:vertical"
				placeholder="Ej: entregar antes del viernes, pedir factura, llamar a Juan al llegar"></textarea>`,
	});
	// el dialogo ya esta abierto (confirmar lo muestra al instante) y al cerrarse se borra: se guarda lo escrito mientras escribe
	let nota = '', entrega = manana();
	const caja = document.getElementById('oc_nota'), dia = document.getElementById('oc_entrega');
	if (caja) { caja.addEventListener('input', () => { nota = caja.value; }); }
	if (dia) { dia.addEventListener('change', () => { entrega = dia.value; }); }
	if (!await pregunta) { return; }
	btn.disabled = true;
	try {
		const r = await api('ordenes.php?op=generar', { idproveedor, nota: nota.trim(), fecha_entrega: entrega });
		aviso(`Orden N° ${r.idorden} generada.`);
		recargar();
	} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
}

// ---------- nueva orden armada a mano (para el almacen central) ----------

async function nuevaOrden(cont, proveedores) {
	const t = turnoActual();
	let a;
	try { a = await api('ordenes.php?op=almacen'); } catch (err) { if (vigente(t)) { aviso(err.message, 'error'); } return; }
	if (!vigente(t)) { return; }
	const token = nuevoToken('ocn');
	const filas = [];   // {c, descripcion, unidad, cant, precio}
	cont.innerHTML = tarjeta({
		titulo: 'Nueva orden de compra',
		ayuda: 'Elige el proveedor, agrega lo que quieres comprar y genera la orden. Llega al almacén central.',
		acciones: '<button class="btn btn-sm btn-light" id="ocn_volver"><i class="fa fa-arrow-left"></i>Volver</button>',
		cuerpo: `
			<label class="inv-ayuda" style="display:block;margin-bottom:4px">1. ¿A quién le compras?</label>
			<div style="position:relative;max-width:420px"><input class="inv-input" id="ocn_prov" style="width:100%" placeholder="Escribe o elige el proveedor"></div>
			<label class="inv-ayuda" style="display:block;margin:14px 0 4px">2. ¿Qué compras?</label>
			<div style="position:relative;max-width:420px"><input class="inv-input" id="ocn_buscar" style="width:100%" placeholder="Busca un producto para agregarlo"></div>
			<div class="inv-table-wrap" style="margin-top:8px"><table class="inv-table">
				<thead><tr><th>Producto</th><th>Cantidad</th><th style="text-align:right">Precio c/u</th><th style="text-align:right">Subtotal</th><th></th></tr></thead>
				<tbody id="ocn_filas"></tbody></table></div>
			<label class="inv-ayuda" for="ocn_entrega" style="display:block;margin:14px 0 4px">3. ¿Para cuándo debe llegar?</label>
			${campoEntrega('ocn_entrega')}
			<label class="inv-ayuda" for="ocn_nota" style="display:block;margin:14px 0 4px">4. Observaciones (opcional)</label>
			<textarea id="ocn_nota" class="inv-input" rows="2" maxlength="255" style="width:100%;max-width:620px;resize:vertical"
				placeholder="Ej: entregar antes del viernes, pedir factura"></textarea>
			<div style="margin-top:12px"><button class="btn btn-success" id="ocn_ok"><i class="fa fa-file-text-o"></i>Generar orden</button></div>`,
	});
	const $ = s => cont.querySelector(s);
	const pintar = () => {
		const total = filas.reduce((s, f) => s + f.cant * f.precio, 0);
		$('#ocn_filas').innerHTML = filas.length ? filas.map((f, i) => `<tr data-i="${i}">
			<td>${esc(f.descripcion)}</td>
			<td style="white-space:nowrap"><input class="inv-input ocn-cant" type="number" min="0" step="any" inputmode="decimal" style="width:90px" value="${f.cant || ''}">
				<span class="inv-muted">${esc(f.unidad || 'und')}</span></td>
			<td style="text-align:right"><input class="inv-input ocn-precio" type="number" min="0" step="0.01" inputmode="decimal" style="width:100px;text-align:right"
				value="${f.precio || ''}" placeholder="0.00"></td>
			<td style="text-align:right" class="ocn-sub">${soles(f.cant * f.precio)}</td>
			<td><span class="inv-link inv-link-rojo" data-quitar="${i}"><i class="fa fa-times"></i></span></td></tr>`).join('')
			+ `<tr><td colspan="3" style="text-align:right"><b>Total</b></td><td style="text-align:right"><b id="ocn_total">${soles(total)}</b></td><td></td></tr>`
			: '<tr><td colspan="5" class="inv-muted">Aún no agregas productos.</td></tr>';
	};
	pintar();
	autocompletar($('#ocn_prov'), proveedores);
	const ops = a.catalogo.map(p => ({ texto: `${p.descripcion} · hay ${num(p.stock)} ${p.unidad || 'und'}`, valor: String(p.c) }));
	const buscar = $('#ocn_buscar');
	autocompletar(buscar, ops);
	buscar.addEventListener('input', () => {
		const o = ops.find(x => x.texto === buscar.value);
		if (!o) { return; }
		buscar.value = '';
		let i = filas.findIndex(f => String(f.c) === o.valor);
		if (i < 0) {
			const p = a.catalogo.find(x => String(x.c) === o.valor);
			filas.push({ c: p.c, descripcion: p.descripcion, unidad: p.unidad, cant: 0, precio: Number(p.precio) || 0 });
			if (!$('#ocn_prov').value && p.proveedor) { $('#ocn_prov').value = p.proveedor; }   // su proveedor habitual
			i = filas.length - 1;
			pintar();
		}
		$(`[data-i="${i}"] .ocn-cant`).focus();
	});
	$('#ocn_filas').addEventListener('input', e => {
		const tr = e.target.closest('[data-i]');
		if (!tr) { return; }
		const f = filas[Number(tr.dataset.i)];
		f.cant = Number(tr.querySelector('.ocn-cant').value) || 0;
		f.precio = Number(tr.querySelector('.ocn-precio').value) || 0;
		tr.querySelector('.ocn-sub').textContent = soles(f.cant * f.precio);
		$('#ocn_total').textContent = soles(filas.reduce((s, x) => s + x.cant * x.precio, 0));
	});
	$('#ocn_filas').addEventListener('click', e => {
		const q = e.target.closest('[data-quitar]');
		if (q) { filas.splice(Number(q.dataset.quitar), 1); pintar(); }
	});
	$('#ocn_volver').addEventListener('click', () => recargar());
	$('#ocn_ok').addEventListener('click', async e => {
		const btn = e.currentTarget;
		const proveedor = $('#ocn_prov').value.trim();
		if (!proveedor) { aviso('Escribe a qué proveedor le compras.', 'error'); $('#ocn_prov').focus(); return; }
		if (!filas.length) { aviso('Agrega al menos un producto.', 'error'); buscar.focus(); return; }
		const sin = filas.find(f => !(f.cant > 0));
		if (sin) { aviso(`Pon cuánto compras de ${sin.descripcion}.`, 'error'); return; }
		btn.disabled = true;
		try {
			const r = await api('ordenes.php?op=nueva', { proveedor, nota: $('#ocn_nota').value.trim(), fecha_entrega: $('#ocn_entrega').value, token,
				items: filas.map(f => ({ idproducto_central: f.c, cantidad: f.cant, precio: f.precio })) });
			aviso(`Orden N° ${r.idorden} generada.`);
			abrirOrden(cont, r.idorden);
		} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
	});
}

// ---------- detalle de una orden ----------

async function abrirOrden(cont, id) {
	const t = turnoActual();
	let d;
	try { d = await api('ordenes.php?op=detalle&id=' + id); } catch (err) { if (vigente(t)) { aviso(err.message, 'error'); } return; }
	if (!vigente(t)) { return; }   // el usuario ya se fue a otra pantalla
	// MySQL devuelve DECIMAL como texto ("12.0000"): a numero antes de calcular
	d = { ...d, items: d.items.map(i => ({ ...i, cantidad: Number(i.cantidad), recibida: Number(i.recibida), precio: Number(i.precio), factor: Number(i.factor) })) };
	const o = d.orden;
	const editable = o.estado === 'por_aprobar' || o.estado === 'aprobada';
	const total = d.items.reduce((s, i) => s + i.cantidad * i.precio, 0);
	cont.innerHTML = tarjeta({
		titulo: `Orden de compra N° ${o.idorden} · ${d.proveedor ? d.proveedor.descripcion : ''}`,
		ayuda: `${esc(fecha(o.fecha))} · Estado: <b>${esc(d.estado_txt)}</b>` + (o.fecha_entrega ? ` · Debe llegar: <b>${esc(fecha(o.fecha_entrega))}</b>` : '')
			+ (o.estado === 'por_aprobar' ? (d.puede_aprobar ? ' · Revisa los precios y apruébala.' : ' · Debe aprobarla alguien con permiso.') : '')
			+ (o.estado === 'aprobada' ? ' · Lista para enviar al proveedor.' : ''),
		acciones: `<button class="btn btn-sm btn-light" id="oc_volver"><i class="fa fa-arrow-left"></i>Todas las órdenes</button>
			${o.estado === 'por_aprobar' && d.puede_aprobar ? '<button class="btn btn-sm btn-success" id="oc_aprobar"><i class="fa fa-check"></i>Aprobar</button>' : ''}
			${o.estado !== 'por_aprobar' && o.estado !== 'anulada' ? '<button class="btn btn-sm btn-success" id="oc_wsp"><i class="fa fa-whatsapp"></i>Enviar por WhatsApp</button>' : ''}
			${o.estado !== 'anulada' ? '<button class="btn btn-sm btn-light" id="oc_pdf"><i class="fa fa-print"></i>Imprimir / PDF</button>' : ''}`,
		cuerpo: `
			<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Producto</th><th>Cantidad</th><th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th></tr></thead>
				<tbody>${d.items.map(i => {
					const porBulto = i.presentacion && i.factor > 1;
					const precioMostrado = porBulto ? i.precio * i.factor : i.precio;
					return `<tr>
					<td>${esc(i.descripcion)}</td>
					<td>${cantidadTxt(i.cantidad, i.factor, i.presentacion, i.unidad)}</td>
					<td style="text-align:right;white-space:nowrap">${editable
						? `<input class="inv-input oc-precio" data-item="${i.idorden_item}" data-factor="${porBulto ? i.factor : 1}" type="number" min="0" step="0.01"
							style="width:100px;text-align:right" value="${precioMostrado ? Number(precioMostrado.toFixed(2)) : ''}" placeholder="0.00">`
						: soles(precioMostrado)} <span class="inv-muted">${porBulto ? 'por ' + esc(i.presentacion) : 'c/u'}</span></td>
					<td style="text-align:right">${soles(i.cantidad * i.precio)}</td></tr>`;
				}).join('')}
				<tr><td colspan="3" style="text-align:right"><b>Total</b></td><td style="text-align:right"><b>${soles(total)}</b></td></tr>
				</tbody></table></div>
			${o.nota ? `<p class="oc-nota"><i class="fa fa-comment-o"></i><b>Observaciones:</b> ${esc(o.nota)}</p>` : ''}
			<div data-historia="oc:${o.idorden}"></div>
			${['por_aprobar', 'aprobada', 'enviada'].includes(o.estado) ? '<p style="margin-top:12px"><span class="inv-link inv-link-rojo" id="oc_anular"><i class="fa fa-ban"></i>Anular esta orden</span></p>' : ''}`,
	});
	cargarHistorias(cont);
	const $ = s => cont.querySelector(s);
	$('#oc_volver').addEventListener('click', () => recargar());
	cont.querySelectorAll('.oc-precio').forEach(inp => inp.addEventListener('change', async () => {
		const ahora = leerNum(inp, true);
		if (ahora === null) { aviso('Precio mal escrito. Usa punto para decimales (ej: 12.50).', 'error'); inp.value = inp.defaultValue; return; }
		const antes = Number(inp.defaultValue || 0);
		// error de tipeo: mas del doble o menos de la mitad del precio que tenia
		if (antes > 0 && (ahora > antes * 2 || ahora < antes / 2)) {
			const ok = await confirmar({ titulo: '¿Seguro del precio?', peligro: false, boton: 'Sí, es correcto',
				textoHtml: `<p style="margin:0">Cambias de <b>${soles(antes)}</b> a <b>${soles(ahora)}</b>. Revisa que no sea un error de tipeo.</p>` });
			if (!ok) { inp.value = inp.defaultValue; return; }
		}
		try {
			// el usuario escribe el precio por caja/saco; se guarda por unidad base
			await api('ordenes.php?op=precio', { idorden: o.idorden, idorden_item: Number(inp.dataset.item), precio: ahora / Number(inp.dataset.factor) });
			abrirOrden(cont, o.idorden);
		} catch (err) { aviso(err.message, 'error'); }
	}));
	if ($('#oc_aprobar')) {
		$('#oc_aprobar').addEventListener('click', async e => {
			const btn = e.currentTarget;   // despues del await currentTarget ya es null
			const ok = await confirmar({ titulo: `¿Aprobar la orden N° ${o.idorden}?`, peligro: false, boton: 'Sí, aprobar',
				textoHtml: `<p style="margin:0">Total <b>${soles(total)}</b>. Después se podrá enviar al proveedor.</p>` });
			if (!ok) { return; }
			btn.disabled = true;
			try { await api('ordenes.php?op=aprobar', { idorden: o.idorden }); aviso('Orden aprobada.'); abrirOrden(cont, o.idorden); }
			catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
		});
	}
	if ($('#oc_wsp')) { $('#oc_wsp').addEventListener('click', () => enviarWhatsapp(cont, d, total)); }
	if ($('#oc_pdf')) { $('#oc_pdf').addEventListener('click', () => imprimirOrden(d, total)); }
	if ($('#oc_anular')) {
		$('#oc_anular').addEventListener('click', async () => {
			const ok = await confirmar({ titulo: `¿Anular la orden N° ${o.idorden}?`, boton: 'Sí, anular',
				textoHtml: '<p style="margin:0">Lo que estaba en esta orden vuelve a <b>Por comprar</b>. Si ya la enviaste, avísale al proveedor.</p>' });
			if (!ok) { return; }
			try { await api('ordenes.php?op=anular', { idorden: o.idorden }); aviso('Orden anulada.'); recargar(); }
			catch (err) { aviso(err.message, 'error'); }
		});
	}
}

function lineasTexto(d) {
	return d.items.map(i => (i.presentacion && i.factor > 1
		? `- ${num(i.cantidad / i.factor)} ${i.presentacion} de ${i.descripcion} (${num(i.cantidad)} ${i.unidad || 'und'})`
		: `- ${num(i.cantidad)} ${i.unidad || 'und'} de ${i.descripcion}`));
}

async function enviarWhatsapp(cont, d, total) {
	const o = d.orden;
	const texto = [`Hola ${d.proveedor ? d.proveedor.descripcion : ''}, le enviamos la *orden de compra N° ${o.idorden}*:`, '',
		...lineasTexto(d), '', `Total aprox.: ${soles(total)}`, o.fecha_entrega ? `Entregar hasta el: ${fecha(o.fecha_entrega)}` : '', o.nota ? `Observaciones: ${o.nota}` : '',
		d.entregar_en ? `Entregar en: ${d.entregar_en.nombre}${d.entregar_en.direccion ? ' - ' + d.entregar_en.direccion : ''}` : '', 'Gracias.'].join('\n');
	// telefono peruano: 9 digitos -> 51 + numero. Sin telefono, WhatsApp deja elegir el contacto.
	const dig = String(d.proveedor && d.proveedor.telefono || '').replace(/\D/g, '');
	const tel = dig.length === 9 ? '51' + dig : dig;
	window.open(`https://wa.me/${tel}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
	try {
		await api('ordenes.php?op=enviar', { idorden: o.idorden });
		if (o.estado === 'aprobada') { aviso('Orden marcada como enviada al proveedor.'); }
		abrirOrden(cont, o.idorden);
	} catch (err) { aviso(err.message, 'error'); }
}

function imprimirOrden(d, total) {
	const o = d.orden;
	imprimir({
		titulo: `Orden de compra N° ${o.idorden}`,
		cuerpo: `<h1>Orden de compra N° ${o.idorden}</h1>
		<div class="m">${esc(fecha(o.fecha))}</div>
		<p><b>Proveedor:</b> ${esc(d.proveedor ? d.proveedor.descripcion : '')}${d.proveedor && d.proveedor.dni ? ' · RUC/DNI ' + esc(d.proveedor.dni) : ''}<br>
		<b>Entregar en:</b> ${esc(d.entregar_en ? d.entregar_en.nombre : '')}${d.entregar_en && d.entregar_en.direccion ? ' - ' + esc(d.entregar_en.direccion) : ''}
		${o.fecha_entrega ? `<br><b>Entregar hasta el:</b> ${esc(fecha(o.fecha_entrega))}` : ''}</p>
		<table><thead><tr><th>Producto</th><th>Cantidad</th><th class="n">Subtotal</th></tr></thead><tbody>
		${d.items.map(i => `<tr><td>${esc(i.descripcion)}</td><td>${i.presentacion && i.factor > 1 ? `${num(i.cantidad / i.factor)} ${esc(i.presentacion)} (${num(i.cantidad)} ${esc(i.unidad || 'und')})` : `${num(i.cantidad)} ${esc(i.unidad || 'und')}`}</td>
			<td class="n">${soles(i.cantidad * i.precio)}</td></tr>`).join('')}
		<tr><td colspan="2" class="n"><b>Total</b></td><td class="n"><b>${soles(total)}</b></td></tr></tbody></table>
		${o.nota ? `<p><b>Observaciones:</b> ${esc(o.nota)}</p>` : ''}`,
	});
}
