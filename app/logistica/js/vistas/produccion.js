// Produccion: que producir hoy, recetas y lo producido. La PLANTA produce para las sedes (lo que la Bandeja mando
// a producir); cada local tiene sus propias recetas (mayonesa, aji de la casa) y produce para si mismo.
// La central puede ver y manejar la produccion de cualquier sede (selector arriba).
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver, confirmar, autocompletar, nuevoToken, leerNum } from '../ui.js?v=20261015i';
import { vigente, turnoActual } from '../router.js?v=20261015i';

const num = n => Number(Number(n || 0).toFixed(3)).toLocaleString('es-PE', { maximumFractionDigits: 3 });
const soles = n => 'S/ ' + Number(n || 0).toFixed(2);
const hoyMas = dias => { const d = new Date(); d.setDate(d.getDate() + Number(dias)); return d.toISOString().slice(0, 10); };

let sedeElegida = 0;   // la central puede mirar otra sede; se recuerda mientras no se recargue la app

export async function render(cont, sesion, t) {
	const d = await api('produccion.php?op=inicio' + (sedeElegida ? '&sede=' + sedeElegida : ''));
	if (t !== undefined && !vigente(t)) { return; }
	pintar(cont, sesion, d);
}

function recargarVista(cont, sesion) {
	const raiz = cont.querySelector('.pr-raiz');
	if (raiz) { raiz.classList.add('lg-recargando'); }   // se ve que esta trabajando (cambio de sede, despues de guardar)
	render(cont, sesion, turnoActual()).catch(err => { aviso(err.message, 'error'); if (raiz) { raiz.classList.remove('lg-recargando'); } });
}

function pintar(cont, sesion, d) {
	const selector = d.central && d.sedes.length > 1
		? `<select class="inv-select" id="pr_sede" style="width:auto" title="Ver la producción de otra sede">${d.sedes.map(s =>
			`<option value="${s.idsede}" ${s.idsede === d.idsede ? 'selected' : ''}>${esc(s.nombre)}${s.idsede === d.planta.idsede ? ' (planta)' : ''}</option>`).join('')}</select>` : '';
	const ayuda = d.es_planta
		? `Aquí se produce para todas las sedes. <b>Piden las sedes</b> es lo que la Bandeja mandó a producir; después se despacha en <b>Envíos</b>.`
		: `Recetas de <b>${esc(d.sede)}</b>. Al producir se descuentan los insumos y entra lo producido a su almacén.`;
	const filas = d.recetas.map(r => {
		const falta = faltantes(r);
		const pedir = falta.filter(i => i.pedir > 0 && i.idcentral);
		return `<tr>
			<td><b>${esc(r.descripcion)}</b>${r.nota ? `<span class="inv-sub">${esc(r.nota)}</span>` : ''}
				${falta.length ? `<span class="inv-sub inv-neg"><i class="fa fa-exclamation-triangle"></i> No alcanza: ${falta.map(i => esc(i.descripcion)
					+ (i.pedido ? ` <span class="inv-muted">(ya pedido ${num(i.pedido)})</span>` : '')).join(', ')}</span>
					${pedir.length ? `<button class="btn btn-sm btn-light" data-insumos="${r.idreceta}" style="margin-top:4px">
						<i class="fa fa-shopping-cart"></i>${d.idsede === d.idsede_central ? 'Comprar lo que falta' : 'Pedir a la central lo que falta'}</button>` : ''}` : ''}</td>
			<td class="inv-num">${num(r.stock)} <span class="inv-muted">${esc(r.unidad || 'und')}</span></td>
			${d.es_planta ? `<td class="inv-num">${r.pendiente ? `<b>${num(r.pendiente)}</b>` : '<span class="inv-muted">—</span>'}</td>
				<td class="inv-num">${r.sugerido ? `<b class="inv-neg">${num(r.sugerido)}</b>` : r.pendiente ? '<span class="inv-pos"><i class="fa fa-check"></i> alcanza</span>' : '<span class="inv-muted">—</span>'}</td>` : ''}
			<td class="inv-num">${r.costo_unidad ? soles(r.costo_unidad) : '<span class="inv-muted">—</span>'}</td>
			<td style="text-align:right;white-space:nowrap">${d.es_planta && Number(r.stock) > 0
				? `<button class="btn btn-sm btn-light" data-repartir="${r.idreceta}" title="Mandar lo producido a las sedes (sale por Envíos)"><i class="fa fa-truck"></i>Repartir a las sedes</button> ` : ''}
				<button class="btn btn-sm btn-success" data-producir="${r.idreceta}"><i class="fa fa-flask"></i>Producir</button></td></tr>`;
	}).join('');
	cont.innerHTML = '<div class="pr-raiz">' + tarjeta({
		titulo: `Producción · ${d.sede}`,
		ayuda,
		acciones: `${selector}${volver()}`,
		cuerpo: d.recetas.length ? `<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Producto</th><th class="inv-num">Hay</th>${d.es_planta ? '<th class="inv-num">Piden las sedes</th><th class="inv-num">Falta producir</th>' : ''}
					<th class="inv-num">Costo x unidad</th><th></th></tr></thead>
				<tbody>${filas}</tbody></table></div>`
			: '<p class="inv-empty"><i class="fa fa-flask"></i>Aún no hay recetas en esta sede. Crea la primera abajo.</p>',
	}) + tarjeta({
		titulo: 'Recetas',
		ayuda: 'Qué insumos lleva cada producto y cuánto sale. Todo con productos de esta sede.',
		acciones: '<button class="btn btn-sm btn-success" id="pr_nueva"><i class="fa fa-plus"></i>Nueva receta</button>',
		cuerpo: d.recetas.length ? `<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Sale</th><th>Lleva</th><th>Dura</th><th></th></tr></thead>
				<tbody>${d.recetas.map(r => `<tr>
					<td><b>${num(r.rinde)} ${esc(r.unidad || 'und')}</b> de ${esc(r.descripcion)}</td>
					<td class="inv-sub" style="display:table-cell">${r.insumos.map(i => `${num(i.cantidad)} ${esc(i.unidad || 'und')} ${esc(i.descripcion)}`).join(' · ')}</td>
					<td>${r.vence_dias ? `${r.vence_dias} día(s)` : '<span class="inv-muted">no vence</span>'}</td>
					<td style="text-align:right;white-space:nowrap"><button class="btn btn-sm btn-light" data-editar="${r.idreceta}"><i class="fa fa-pencil"></i>Editar</button>
						<span class="inv-link inv-link-rojo" data-baja="${r.idreceta}" style="margin-left:8px"><i class="fa fa-trash"></i>Quitar</span></td></tr>`).join('')}
				</tbody></table></div>` : '<p class="inv-empty">Ej: <b>5 L de mayonesa de la casa</b> = 2 L de aceite + 30 huevos + 0.2 L de limón.</p>',
	}) + tarjeta({
		titulo: 'Lo producido',
		ayuda: 'Las últimas 30 veces que se produjo en esta sede.',
		cuerpo: d.historial.length ? `<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Fecha</th><th>Producto</th><th class="inv-num">Salió</th><th class="inv-num">Costo</th><th>Vence</th><th>Quién</th></tr></thead>
				<tbody>${d.historial.map(h => {
					const dif = Number(h.salio) - Number(h.esperada);
					return `<tr><td>${esc(h.fecha)}</td><td>${esc(h.descripcion)}${h.nota ? `<span class="inv-sub">${esc(h.nota)}</span>` : ''}</td>
						<td class="inv-num"><b>${num(h.salio)}</b> ${esc(h.unidad || 'und')}${Math.abs(dif) > 0.0001 ? `<span class="inv-sub ${dif < 0 ? 'inv-neg' : 'inv-pos'}">esperado ${num(h.esperada)}</span>` : ''}</td>
						<td class="inv-num">${soles(h.costo)}</td><td>${esc(h.vence || '—')}</td><td>${esc(h.quien || '')}</td></tr>`;
				}).join('')}</tbody></table></div>` : '<p class="inv-empty"><i class="fa fa-inbox"></i>Todavía no se produjo nada aquí.</p>',
	}) + '</div>';
	const sel = cont.querySelector('#pr_sede');
	if (sel) { sel.addEventListener('change', () => { sedeElegida = Number(sel.value); recargarVista(cont, sesion); }); }
	cont.querySelector('#pr_nueva').addEventListener('click', () => dialogoReceta(cont, sesion, d, null));
	cont.querySelector('.pr-raiz').addEventListener('click', async e => {
		const rp = e.target.closest('[data-repartir]');
		if (rp) { dialogoRepartir(cont, sesion, d, d.recetas.find(r => r.idreceta === Number(rp.dataset.repartir)), rp); return; }
		const pi = e.target.closest('[data-insumos]');
		if (pi) { dialogoInsumos(cont, sesion, d, d.recetas.find(r => r.idreceta === Number(pi.dataset.insumos))); return; }
		const p = e.target.closest('[data-producir]');
		if (p) { dialogoProducir(cont, sesion, d, d.recetas.find(r => r.idreceta === Number(p.dataset.producir))); return; }
		const ed = e.target.closest('[data-editar]');
		if (ed) { dialogoReceta(cont, sesion, d, d.recetas.find(r => r.idreceta === Number(ed.dataset.editar))); return; }
		const b = e.target.closest('[data-baja]');
		if (b) {
			const r = d.recetas.find(x => x.idreceta === Number(b.dataset.baja));
			if (!await confirmar({ titulo: `¿Quitar la receta de ${r.descripcion}?`, boton: 'Sí, quitar',
				textoHtml: '<p style="margin:0">Ya no aparecerá para producir. Lo producido antes no cambia.</p>' })) { return; }
			try { await api('produccion.php?op=baja_receta', { sede: d.idsede, idreceta: r.idreceta }); aviso('Receta quitada.'); recargarVista(cont, sesion); }
			catch (err) { aviso(err.message, 'error'); }
		}
	});
}

/** Insumos que no alcanzan para producir lo sugerido (o una receta): cuanto falta y cuanto conviene pedir (menos lo ya pedido). */
function faltantes(r) {
	const q = r.sugerido || r.rinde;
	return r.insumos.map(i => {
		const usa = Number(i.cantidad) * q / r.rinde, falta = Math.max(0, usa - Number(i.stock));
		return { ...i, usa, falta, pedir: Math.max(0, Number((falta - Number(i.pedido || 0)).toFixed(3))) };
	}).filter(i => i.falta > 0.0001);
}

// ---------- lo que falta: comprar (central) o pedir a la central (otra sede) ----------

function dialogoInsumos(cont, sesion, d, r) {
	const central = d.idsede === d.idsede_central, token = nuevoToken('pi');
	const falta = faltantes(r);
	const dlg = abrirDialogo(`
		<div class="xdlg-head"><h3><i class="fa fa-shopping-cart" style="margin-right:6px"></i>${central ? 'Comprar' : 'Pedir a la central'} para ${esc(r.descripcion)}</h3></div>
		<div class="xdlg-body" style="font-size:13px">
			<p class="inv-ayuda" style="margin:0 0 8px">Para producir <b>${num(r.sugerido || r.rinde)} ${esc(r.unidad || 'und')}</b>.
				${central ? 'Va a <b>Órdenes de compra → Por comprar</b>, agrupado por proveedor.' : 'Se arma un pedido a la central: allí deciden si sale de su almacén o se compra.'}</p>
			<table class="inv-table"><thead><tr><th>Insumo</th><th class="inv-num">Hay</th><th class="inv-num">Falta</th><th>${central ? 'Comprar' : 'Pedir'}</th></tr></thead>
				<tbody>${falta.map(i => `<tr data-pi="${i.idproducto}">
					<td>${esc(i.descripcion)}${i.pedido ? `<span class="inv-sub">ya pedido ${num(i.pedido)}</span>` : ''}
						${i.idcentral ? '' : '<span class="inv-sub inv-neg">no está en el catálogo: cómpralo en Compras</span>'}</td>
					<td class="inv-num">${num(i.stock)}</td><td class="inv-num">${num(i.falta)}</td>
					<td style="white-space:nowrap"><input class="inv-input pi-cant" type="number" min="0" step="any" inputmode="decimal" style="width:90px"
						value="${i.idcentral && i.pedir ? i.pedir : ''}" ${i.idcentral ? '' : 'disabled'}> <span class="inv-muted">${esc(i.unidad || 'und')}</span></td></tr>`).join('')}</tbody></table>
		</div>
		<div class="xdlg-foot">
			<button class="btn btn-sm btn-light" data-cerrar><i class="fa fa-times"></i>Cancelar</button>
			<button class="btn btn-sm btn-success" id="pi_ok"><i class="fa fa-check"></i>${central ? 'Mandar a comprar' : 'Enviar pedido'}</button>
		</div>`);
	dlg.querySelector('#pi_ok').addEventListener('click', async e => {
		const btn = e.currentTarget, items = [];
		for (const tr of dlg.querySelectorAll('[data-pi]')) {
			const inp = tr.querySelector('.pi-cant');
			if (inp.disabled) { continue; }
			const q = leerNum(inp);
			if (q === null || q < 0) { aviso('Revisa las cantidades.', 'error'); return; }
			if (q > 0) { items.push({ idproducto: Number(tr.dataset.pi), cantidad: q }); }
		}
		if (!items.length) { aviso('Pon la cantidad en al menos un insumo.', 'error'); return; }
		btn.disabled = true;
		try {
			const res = await api('produccion.php?op=pedir_insumos', { sede: d.idsede, idreceta: r.idreceta, items, token });
			dlg.close();
			aviso(res.donde === 'compra' ? `Listo: ${res.productos} insumo(s) en Órdenes de compra → Por comprar.`
				: `Listo: pedido N° ${res.idsolicitud} enviado a la central.`);
			recargarVista(cont, sesion);
		} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
	});
}

// ---------- repartir lo producido a las sedes (sale por Envios; cada sede lo recibe y sube su stock) ----------

async function dialogoRepartir(cont, sesion, d, r, btn) {
	let x;
	btn.classList.add('lg-cargando'); btn.disabled = true;
	try { x = await api(`produccion.php?op=repartir_info&sede=${d.idsede}&idreceta=${r.idreceta}`); }
	catch (err) { aviso(err.message, 'error'); return; }
	finally { btn.classList.remove('lg-cargando'); btn.disabled = false; }
	const token = nuevoToken('rp'), u = esc(x.unidad || 'und');
	const dlg = abrirDialogo(`
		<div class="xdlg-head"><h3><i class="fa fa-truck" style="margin-right:6px"></i>Repartir ${esc(x.producto)}</h3></div>
		<div class="xdlg-body" style="font-size:13px">
			<p class="inv-ayuda" style="margin:0 0 8px">Hay <b>${num(x.stock)} ${u}</b>${x.comprometido ? `, ${num(x.comprometido)} ya esperan salir (pedidos)` : ''}:
				hay <b>${num(x.libre)} ${u}</b> disponibles para repartir. Pasa a <b>Envíos</b>; cada sede lo cuenta en <b>Recibir mercadería</b> y entra a su almacén.</p>
			<table class="inv-table"><thead><tr><th>Sede</th><th class="inv-num">Tiene</th><th>Mandar</th></tr></thead>
				<tbody>${x.sedes.map(z => `<tr data-rs="${z.idsede}"><td>${esc(z.nombre)}${z.tiene ? '' : '<span class="inv-sub inv-neg">no lo tiene en su catálogo</span>'}</td>
					<td class="inv-num">${z.tiene ? num(z.stock) : '—'}</td>
					<td style="white-space:nowrap"><input class="inv-input rp-cant" type="number" min="0" step="any" inputmode="decimal" style="width:90px" ${z.tiene ? '' : 'disabled'}> <span class="inv-muted">${u}</span></td></tr>`).join('')}</tbody></table>
			<p style="margin:8px 0 0;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
				<span class="inv-link" id="rp_parejo"><i class="fa fa-balance-scale"></i>Repartir parejo</span>
				<span class="inv-ayuda" id="rp_total"></span></p>
		</div>
		<div class="xdlg-foot">
			<button class="btn btn-sm btn-light" data-cerrar><i class="fa fa-times"></i>Cancelar</button>
			<button class="btn btn-sm btn-success" id="rp_ok"><i class="fa fa-check"></i>Mandar a Envíos</button>
		</div>`);
	const inputs = [...dlg.querySelectorAll('.rp-cant:not([disabled])')];
	const total = () => inputs.reduce((t, i) => t + (leerNum(i) || 0), 0);
	const pintarTotal = () => {
		const t = total();
		dlg.querySelector('#rp_total').innerHTML = `Repartes <b class="${t > x.libre + 0.0001 ? 'inv-neg' : ''}">${num(t)}</b> de ${num(x.libre)} ${u}`;
	};
	inputs.forEach(i => i.addEventListener('input', pintarTotal));
	dlg.querySelector('#rp_parejo').addEventListener('click', () => {
		const n = inputs.length;
		if (!n) { return; }
		const parte = Math.floor(x.libre / n * 100) / 100;   // dos decimales, sin pasarse
		inputs.forEach(i => { i.value = parte || ''; });
		pintarTotal();
	});
	pintarTotal();
	dlg.querySelector('#rp_ok').addEventListener('click', async e => {
		const b = e.currentTarget, items = [];
		for (const tr of dlg.querySelectorAll('[data-rs]')) {
			const inp = tr.querySelector('.rp-cant');
			if (inp.disabled) { continue; }
			const q = leerNum(inp);
			if (q === null || q < 0) { aviso('Revisa las cantidades.', 'error'); return; }
			if (q > 0) { items.push({ idsede: Number(tr.dataset.rs), cantidad: q }); }
		}
		if (!items.length) { aviso('Pon cuánto va a cada sede.', 'error'); return; }
		if (total() > x.libre + 0.0001) { aviso(`Solo puedes repartir ${num(x.libre)} ${x.unidad || 'und'}.`, 'error'); return; }
		b.disabled = true;
		try {
			const res = await api('produccion.php?op=repartir', { sede: d.idsede, idreceta: r.idreceta, items, token });
			dlg.close();
			aviso(`Listo: ${num(res.total)} ${x.unidad || 'und'} de ${res.producto} para ${res.sedes} sede(s). Despáchalo en Envíos a las sedes.`);
			recargarVista(cont, sesion);
		} catch (err) { aviso(err.message, 'error'); b.disabled = false; }
	});
}

function abrirDialogo(html) {
	const dlg = document.createElement('dialog');
	dlg.className = 'lg-dlg lg-app';
	dlg.innerHTML = html;
	document.body.appendChild(dlg);
	dlg.addEventListener('close', () => dlg.remove());
	dlg.querySelectorAll('[data-cerrar]').forEach(b => b.addEventListener('click', () => dlg.close()));
	dlg.showModal();
	return dlg;
}

// ---------- receta (nueva / editar) ----------

function dialogoReceta(cont, sesion, d, r) {
	const ops = d.productos.map(p => ({ texto: p.descripcion, valor: String(p.idproducto) }));
	const unidad = id => { const p = d.productos.find(x => x.idproducto === Number(id)); return p ? p.unidad || 'UND' : ''; };
	const opUnidades = `<option value="0">UND (unidad)</option>${d.unidades.map(u => `<option value="${u.idunidad_medida}">${esc(u.unidad)}${u.abreviatura && u.abreviatura !== u.unidad ? ' (' + esc(u.abreviatura) + ')' : ''}</option>`).join('')}`;
	const filaIns = (i = {}) => `<tr class="pr-ins">
		<td><input class="inv-input pr-ins-prod" style="width:100%" placeholder="Escribe el insumo" value="${esc(i.descripcion || '')}" data-valor="${i.idproducto || ''}"></td>
		<td style="white-space:nowrap"><input class="inv-input pr-ins-cant" type="number" min="0" step="any" inputmode="decimal" style="width:90px" value="${i.cantidad ? Number(i.cantidad) : ''}">
			<span class="inv-muted pr-ins-u">${esc(i.unidad || '')}</span></td>
		<td><span class="inv-link inv-link-rojo pr-ins-x" title="Quitar"><i class="fa fa-times"></i></span></td></tr>`;
	const dlg = abrirDialogo(`
		<div class="xdlg-head"><h3><i class="fa fa-flask" style="margin-right:6px"></i>${r ? 'Editar receta' : 'Nueva receta'} · ${esc(d.sede)}</h3></div>
		<div class="xdlg-body" style="font-size:13px">
			<div class="inv-form-row"><span class="inv-label">¿Qué producto sale?</span>
				<input class="inv-input" id="rc_prod" style="width:100%" placeholder="Ej: MAYONESA DE LA CASA" value="${esc(r ? r.descripcion : '')}" data-valor="${r ? r.idproducto : ''}">
				<p class="inv-sub" id="rc_nuevo" hidden style="margin:4px 0 0"><i class="fa fa-plus-circle"></i> No existe: se creará <b></b>${d.es_planta ? ' en el catálogo y se enviará a todas las sedes para que puedan pedirlo' : ' en ' + esc(d.sede)}.</p></div>
			<div class="inv-form-row" style="display:flex;gap:16px;flex-wrap:wrap">
				<div><span class="inv-label">Con esta receta salen</span>
					<input class="inv-input" id="rc_rinde" type="number" min="0" step="any" inputmode="decimal" style="width:100px" value="${r ? Number(r.rinde) : ''}">
					<b id="rc_u">${esc(r ? r.unidad || 'UND' : '')}</b>
					<select class="inv-select" id="rc_unidad" hidden style="width:auto" title="Unidad de medida de lo que sale">${opUnidades}</select></div>
				<div><span class="inv-label">Dura (días) <span class="inv-muted">— vacío si no vence</span></span>
					<input class="inv-input" id="rc_vence" type="number" min="1" step="1" style="width:100px" value="${r && r.vence_dias ? r.vence_dias : ''}"></div>
			</div>
			<span class="inv-label">Lleva estos insumos</span>
			<table class="inv-table"><tbody id="rc_ins">${(r ? r.insumos : [{}]).map(filaIns).join('')}</tbody></table>
			<span class="inv-link" id="rc_mas" style="display:inline-block;margin:6px 0 10px"><i class="fa fa-plus"></i>Agregar insumo</span>
			<div class="inv-form-row"><span class="inv-label">Nota (opcional)</span>
				<input class="inv-input" id="rc_nota" maxlength="255" style="width:100%" placeholder="Ej: batir 5 minutos, guardar en frío" value="${esc(r && r.nota ? r.nota : '')}"></div>
		</div>
		<div class="xdlg-foot">
			<button class="btn btn-sm btn-light" data-cerrar><i class="fa fa-times"></i>Cancelar</button>
			<button class="btn btn-sm btn-success" id="rc_guardar"><i class="fa fa-check"></i>Guardar receta</button>
		</div>`);
	const conAc = inp => {
		autocompletar(inp, ops);
		inp.addEventListener('input', () => {
			// escribir a mano borra la eleccion: solo vale lo elegido de la lista
			const o = ops.find(x => x.texto === inp.value);
			inp.dataset.valor = o ? o.valor : '';
			const u = inp.id === 'rc_prod' ? dlg.querySelector('#rc_u') : inp.closest('tr').querySelector('.pr-ins-u');
			u.textContent = o ? unidad(o.valor) : '';
			if (inp.id === 'rc_prod') {
				// no esta en la lista: se crea con la unidad que elijan
				const nuevo = !o && inp.value.trim() !== '';
				dlg.querySelector('#rc_nuevo').hidden = !nuevo;
				dlg.querySelector('#rc_nuevo b').textContent = inp.value.trim().toUpperCase();
				dlg.querySelector('#rc_unidad').hidden = !nuevo;
			}
		});
	};
	conAc(dlg.querySelector('#rc_prod'));
	dlg.querySelectorAll('.pr-ins-prod').forEach(conAc);
	dlg.querySelector('#rc_mas').addEventListener('click', () => {
		dlg.querySelector('#rc_ins').insertAdjacentHTML('beforeend', filaIns());
		const inp = dlg.querySelector('#rc_ins tr:last-child .pr-ins-prod');
		conAc(inp);
		inp.focus();
	});
	dlg.querySelector('#rc_ins').addEventListener('click', e => { if (e.target.closest('.pr-ins-x')) { e.target.closest('tr').remove(); } });
	dlg.querySelector('#rc_guardar').addEventListener('click', async e => {
		const btn = e.currentTarget;
		const idproducto = Number(dlg.querySelector('#rc_prod').dataset.valor);
		const nombre = dlg.querySelector('#rc_prod').value.trim();
		if (!idproducto && !nombre) { aviso('Escribe qué producto sale.', 'error'); return; }
		const nuevo = idproducto ? null : { descripcion: nombre, idunidad_kardex: Number(dlg.querySelector('#rc_unidad').value) };
		const rinde = leerNum(dlg.querySelector('#rc_rinde'), true);
		if (!rinde || rinde <= 0) { aviso('Escribe cuánto sale con esta receta.', 'error'); return; }
		const insumos = [];
		for (const tr of dlg.querySelectorAll('.pr-ins')) {
			const inp = tr.querySelector('.pr-ins-prod');
			if (!inp.value.trim() && !tr.querySelector('.pr-ins-cant').value) { continue; }   // fila vacia
			if (!inp.dataset.valor) { aviso(`Elige "${inp.value || 'el insumo'}" de la lista.`, 'error'); inp.focus(); return; }
			const cantidad = leerNum(tr.querySelector('.pr-ins-cant'), true);
			if (!cantidad || cantidad <= 0) { aviso(`Escribe la cantidad de ${inp.value}.`, 'error'); return; }
			insumos.push({ idproducto: Number(inp.dataset.valor), cantidad });
		}
		if (!insumos.length) { aviso('Agrega al menos un insumo.', 'error'); return; }
		btn.disabled = true;
		try {
			const res = await api('produccion.php?op=guardar_receta', { sede: d.idsede, idreceta: r ? r.idreceta : 0, idproducto, nuevo, rinde,
				vence_dias: dlg.querySelector('#rc_vence').value, nota: dlg.querySelector('#rc_nota').value, insumos });
			dlg.close();
			aviso(res.creado ? `Receta guardada. Se creó ${nombre.toUpperCase()}.` : 'Receta guardada.');
			recargarVista(cont, sesion);
		} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
	});
}

// ---------- producir ----------

function dialogoProducir(cont, sesion, d, r) {
	const token = nuevoToken('pr');
	const inicial = r.sugerido || r.rinde;
	const dlg = abrirDialogo(`
		<div class="xdlg-head"><h3><i class="fa fa-flask" style="margin-right:6px"></i>Producir ${esc(r.descripcion)}</h3></div>
		<div class="xdlg-body" style="font-size:13px">
			<div class="inv-form-row"><span class="inv-label">¿Cuánto vas a producir?</span>
				<input class="inv-input" id="pd_cant" type="number" min="0" step="any" inputmode="decimal" style="width:110px" value="${Number(Number(inicial).toFixed(3))}">
				<span class="inv-muted">${esc(r.unidad || 'und')}</span>
				${r.sugerido ? `<span class="inv-sub">Piden las sedes ${num(r.pendiente)} y hay ${num(r.stock)}.</span>` : ''}</div>
			<span class="inv-label">Se usa <span class="inv-muted">— si usaste otra cantidad, cámbiala</span></span>
			<table class="inv-table"><thead><tr><th>Insumo</th><th class="inv-num">Usa</th><th class="inv-num">Hay</th></tr></thead>
				<tbody>${r.insumos.map(i => `<tr data-ins="${i.idproducto}"><td>${esc(i.descripcion)}</td>
					<td class="inv-num" style="white-space:nowrap"><input class="inv-input pd-usa" type="number" min="0" step="any" inputmode="decimal" style="width:90px">
						<span class="inv-muted">${esc(i.unidad || 'und')}</span></td>
					<td class="inv-num pd-hay" data-hay="${Number(i.stock)}">${num(i.stock)}</td></tr>`).join('')}</tbody></table>
			<div class="inv-form-row" style="display:flex;gap:16px;flex-wrap:wrap;margin-top:10px">
				<div><span class="inv-label">¿Cuánto salió de verdad?</span>
					<input class="inv-input" id="pd_salio" type="number" min="0" step="any" inputmode="decimal" style="width:110px"> <span class="inv-muted">${esc(r.unidad || 'und')}</span></div>
				<div><span class="inv-label">Vence</span>
					<input class="inv-input" id="pd_vence" type="date" min="${hoyMas(0)}" style="width:160px" value="${r.vence_dias ? hoyMas(r.vence_dias) : ''}"></div>
			</div>
			<div class="inv-form-row"><span class="inv-label">Nota (opcional)</span>
				<input class="inv-input" id="pd_nota" maxlength="255" style="width:100%" placeholder="Ej: salió más espesa, faltó limón"></div>
			<p class="inv-ayuda" id="pd_costo" style="margin:6px 0 0"></p>
		</div>
		<div class="xdlg-foot">
			<button class="btn btn-sm btn-light" data-cerrar><i class="fa fa-times"></i>Cancelar</button>
			<button class="btn btn-sm btn-success" id="pd_ok"><i class="fa fa-check"></i>Producir</button>
		</div>`);
	const $ = s => dlg.querySelector(s);
	let salioTocado = false;
	const escalar = () => {
		const q = leerNum($('#pd_cant')) || 0;
		r.insumos.forEach(i => { dlg.querySelector(`[data-ins="${i.idproducto}"] .pd-usa`).value = Number((Number(i.cantidad) * q / r.rinde).toFixed(3)); });
		if (!salioTocado) { $('#pd_salio').value = q || ''; }
		revisar();
	};
	const revisar = () => {
		let costo = 0;
		r.insumos.forEach(i => {
			const tr = dlg.querySelector(`[data-ins="${i.idproducto}"]`);
			const usa = leerNum(tr.querySelector('.pd-usa')) || 0;
			tr.querySelector('.pd-hay').classList.toggle('inv-neg', usa > Number(i.stock) + 0.0001);
			costo += usa * Number(i.costo || 0);
		});
		const salio = leerNum($('#pd_salio')) || 0;
		$('#pd_costo').innerHTML = costo > 0 ? `Costo aprox.: <b>${soles(costo)}</b>${salio > 0 ? ` · <b>${soles(costo / salio)}</b> por ${esc(r.unidad || 'unidad')}` : ''}` : '';
	};
	$('#pd_cant').addEventListener('input', escalar);
	$('#pd_salio').addEventListener('input', () => { salioTocado = true; revisar(); });
	dlg.querySelectorAll('.pd-usa').forEach(i => i.addEventListener('input', revisar));
	escalar();
	$('#pd_ok').addEventListener('click', async e => {
		const btn = e.currentTarget;
		const cantidad = leerNum($('#pd_cant'), true);
		const salio = leerNum($('#pd_salio'), true);
		if (!cantidad || cantidad <= 0) { aviso('Escribe cuánto vas a producir.', 'error'); return; }
		if (!salio || salio <= 0) { aviso('Escribe cuánto salió de verdad.', 'error'); return; }
		const insumos = [];
		for (const tr of dlg.querySelectorAll('[data-ins]')) {
			const q = leerNum(tr.querySelector('.pd-usa'));
			if (q === null || q < 0) { aviso('Revisa las cantidades de los insumos.', 'error'); return; }
			insumos.push({ idproducto: Number(tr.dataset.ins), cantidad: q });
		}
		if (dlg.querySelector('.pd-hay.inv-neg')) { aviso('No alcanza un insumo (en rojo). Produce menos o primero pide el insumo.', 'error'); return; }
		btn.disabled = true;
		try {
			const res = await api('produccion.php?op=producir', { sede: d.idsede, idreceta: r.idreceta, cantidad, salio, insumos,
				vencimiento: $('#pd_vence').value, nota: $('#pd_nota').value, token });
			dlg.close();
			aviso(`Listo: entraron ${num(res.salio)} ${r.unidad || 'und'} de ${res.producto}${res.vence ? ' (vence ' + res.vence + ')' : ''}.`
				+ (d.es_planta && r.pendiente ? ' Ya puedes despacharlo en Envíos.' : ''));
			recargarVista(cont, sesion);
		} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
	});
}
