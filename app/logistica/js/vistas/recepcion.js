// Recepcion en la central (F5): las ordenes que esperan mercaderia -> clic -> anotar lo que llego
// (cantidad, precio, lote, vencimiento). Opcional: leer la factura con IA (mismo servicio que Compras).
// Al confirmar entra el stock al almacen central como una compra normal (cuentas por pagar, kardex).
import { api, subirLegacy } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver, confirmar, autocompletar, leerNum, fecha } from '../ui.js?v=20261015i';
import { vigente, recargar, turnoActual } from '../router.js?v=20261015i';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const soles = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n4 = v => Number(v);

export async function render(cont, sesion, t) {
	const pend = await api('recepcion_oc.php?op=pendientes');
	if (!vigente(t)) { return; }
	cont.innerHTML = '<div id="rc_raiz">' + tarjeta({
		titulo: 'Recepción en la central',
		ayuda: 'Órdenes de compra que esperan mercadería. Abre la que llegó y anota lo que vino.',
		acciones: `${volver()}<a class="btn btn-sm btn-light" href="#" data-ir="llegadas"><i class="fa fa-history"></i>Lo que ya llegó</a>`,
		cuerpo: pend.length ? `<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>N°</th><th>Proveedor</th><th>Fecha de la orden</th><th>Estado</th><th></th></tr></thead>
			<tbody>${pend.map(o => `<tr style="cursor:pointer" data-abrir="${o.idorden}">
				<td><b>${o.idorden}</b></td><td>${esc(o.proveedor)}</td><td>${esc(fecha(o.fecha))}</td>
				<td>${o.estado === 'parcial' ? `<span class="inv-estado borrador">Llegó una parte · faltan ${o.faltan}</span>` : '<span class="inv-estado cerrado">Esperando</span>'}</td>
				<td class="inv-acciones"><span class="inv-link"><i class="fa fa-download"></i>Recibir</span></td></tr>`).join('')}
			</tbody></table></div>`
			: '<p class="inv-empty"><i class="fa fa-check-circle"></i>No hay órdenes esperando mercadería. Las órdenes enviadas al proveedor aparecen aquí.</p>',
	}) + '</div>';
	cont.querySelector('#rc_raiz').addEventListener('click', e => {
		const tr = e.target.closest('[data-abrir]');
		if (tr) { abrir(cont, Number(tr.dataset.abrir)); }
	});
}

async function abrir(cont, id) {
	const t = turnoActual();
	let d;
	try { d = await api('recepcion_oc.php?op=orden&id=' + id); } catch (err) { if (vigente(t)) { aviso(err.message, 'error'); } return; }
	if (!vigente(t)) { return; }   // el usuario ya se fue a otra pantalla
	const o = d.orden;
	// DECIMAL llega como texto
	const items = d.items.map(i => ({ ...i, pedida: n4(i.pedida), recibida: n4(i.recibida), precio: n4(i.precio), factor: n4(i.factor) }));
	const credito = Number(d.credito);
	// fecha LOCAL (toISOString es UTC: de noche en Peru ya da el dia siguiente)
	const f30 = new Date(Date.now() + 30 * 864e5);
	const en30 = `${f30.getFullYear()}-${String(f30.getMonth() + 1).padStart(2, '0')}-${String(f30.getDate()).padStart(2, '0')}`;
	cont.innerHTML = tarjeta({
		titulo: `Recibir orden N° ${o.idorden} · ${o.proveedor}`,
		ayuda: 'Ya está puesto lo que falta llegar: <b>corrige solo lo que vino distinto</b>. Si tienes la factura, léela con la cámara y se llena sola.',
		acciones: `<button class="btn btn-sm btn-light" id="rc_volver"><i class="fa fa-arrow-left"></i>Todas</button>
			<label class="btn btn-sm btn-light" style="margin:0 0 0 6px"><i class="fa fa-camera"></i>Leer factura<input type="file" id="rc_factura" accept="image/*,application/pdf" hidden></label>
			<button class="btn btn-sm btn-success" id="rc_ok"><i class="fa fa-check"></i>Confirmar recepción</button>`,
		cuerpo: `
			<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">¿Cómo se paga?</span><select class="inv-select" id="rc_pago">
					${d.tipos_pago.map(tp => `<option value="${tp.idtipo_pago}" ${Number(tp.idtipo_pago) === credito ? 'selected' : ''}>${esc(tp.descripcion)}</option>`).join('')}</select></div>
				<div class="inv-field" id="rc_fp_box"><span class="inv-label">Fecha de pago</span><input class="inv-input" id="rc_fpago" type="date" value="${en30}" style="width:160px"></div>
				<div class="inv-field"><span class="inv-label">N° de factura / guía</span><input class="inv-input" id="rc_comp" maxlength="40" placeholder="F001-123"></div>
				<span class="inv-sep"></span>
				<p class="inv-ayuda" id="rc_total"></p>
			</div>
			<div id="rc_ia"></div>
			<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Producto</th><th style="text-align:right">Pedido</th><th>Llegó ahora</th><th>Precio c/u</th><th class="lg-oc">Lote</th><th class="lg-oc">Vence</th><th>Observación</th></tr></thead>
				<tbody>${items.map(i => {
					const falta = Math.max(0, i.pedida - i.recibida);
					return `<tr data-item="${i.idorden_item}" data-prod="${i.idproducto}">
					<td>${esc(i.descripcion)}${i.recibida ? `<span class="inv-sub">ya llegaron ${num(i.recibida)}</span>` : ''}
						<span class="inv-link rc-otro" style="font-size:11px;display:block;margin-top:2px"><i class="fa fa-exchange"></i>¿Llegó otro producto?</span>
						<div class="rc-cambio-box" hidden style="margin-top:4px"><span class="inv-sub">En su lugar llegó:</span>
							<input class="inv-input rc-cambio" style="width:100%;min-width:200px" placeholder="Escribe y elige del catálogo"></div></td>
					<td style="text-align:right">${i.presentacion && i.factor > 1 ? `${num(i.pedida / i.factor)} ${esc(i.presentacion)} <span class="inv-muted">(${num(i.pedida)})</span>` : num(i.pedida)}
						<span class="inv-muted">${esc(i.unidad || 'und')}</span></td>
					<td><input class="inv-input rc-cant" type="number" min="0" step="any" inputmode="decimal" style="width:90px" value="${falta || ''}" placeholder="0"></td>
					<td><input class="inv-input rc-precio" type="number" min="0" step="0.0001" inputmode="decimal" style="width:100px" value="${i.precio || ''}" placeholder="0.00">
						<span class="inv-sub rc-pref"></span></td>
					<td class="lg-oc"><input class="inv-input rc-lote" maxlength="40" style="width:110px" placeholder="opcional"></td>
					<td class="lg-oc"><input class="inv-input rc-venc" type="date" style="width:150px"></td>
					<td><input class="inv-input rc-nota" maxlength="150" style="width:170px" placeholder="ej. 2 cajas golpeadas"></td></tr>`;
				}).join('')}</tbody></table></div>
			<div class="inv-form-row" style="margin-top:12px"><span class="inv-label">Observaciones de la recepción (opcional)</span>
				<textarea class="inv-input inv-w100" id="rc_nota" maxlength="150" rows="2" style="height:auto;padding:6px" placeholder="ej. llegó tarde, el chofer no traía guía"></textarea></div>
			${o.estado === 'parcial' ? '<p style="margin-top:12px"><span class="inv-link inv-link-rojo" id="rc_cerrar"><i class="fa fa-ban"></i>No llegará lo que falta: cerrar esta orden</span></p>' : ''}`,
	});
	const $ = s => cont.querySelector(s);
	const total = () => {
		let t = 0;
		cont.querySelectorAll('tr[data-item]').forEach(tr => { t += Number(tr.querySelector('.rc-cant').value || 0) * Number(tr.querySelector('.rc-precio').value || 0); });
		$('#rc_total').innerHTML = `Total de lo que llegó: <b>${soles(t)}</b>`;
	};
	const verFecha = () => { $('#rc_fp_box').hidden = Number($('#rc_pago').value) !== credito; };
	cont.querySelector('table').addEventListener('input', total);
	// alerta de precio: contra lo que se pago la ultima vez a ESTE proveedor, y si otro lo vendio mas barato
	const refPrecio = tr => {
		const it = items.find(x => Number(x.idorden_item) === Number(tr.dataset.item));
		const ref = it && it.precio_ref, caja = tr.querySelector('.rc-pref');
		if (!ref || !caja) { return; }
		const p = Number(tr.querySelector('.rc-precio').value || 0), u = ref.ultimo;
		const mismo = u && Number(u.idproveedor) === Number(o.idproveedor);
		let t = '';
		if (mismo && p > 0 && u.precio > 0) {
			const pct = Math.round((p - u.precio) / u.precio * 1000) / 10;
			t = `Última vez ${soles(u.precio)}` + (Math.abs(pct) >= 0.1 ? ` · <b class="${pct >= d.alerta_pct ? 'inv-neg' : pct < 0 ? 'inv-pos' : ''}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%</b>` : ' · igual');
		} else if (mismo) { t = `Última vez ${soles(u.precio)}`; }
		const otro = ref.mejor_otro || (!mismo && u ? u : null);
		if (otro && p > 0 && otro.precio < p) { t += `${t ? '<br>' : ''}<i class="fa fa-lightbulb-o"></i> ${esc(otro.proveedor)} lo vendió a ${soles(otro.precio)}`; }
		caja.innerHTML = t;
	};
	cont.querySelectorAll('tr[data-item]').forEach(refPrecio);
	cont.querySelector('table').addEventListener('input', e => { const tr = e.target.closest('tr[data-item]'); if (tr && e.target.classList.contains('rc-precio')) { refPrecio(tr); } });
	cont.querySelectorAll('tr[data-item]').forEach(tr => {
		const inp = tr.querySelector('.rc-cambio');
		autocompletar(inp, (d.catalogo || []).filter(c => Number(c.valor) !== Number(tr.dataset.prod)));
		tr.querySelector('.rc-otro').addEventListener('click', () => {
			const box = tr.querySelector('.rc-cambio-box');
			box.hidden = !box.hidden;
			if (box.hidden) { inp.value = ''; delete inp.dataset.valor; } else { inp.focus(); }
		});
	});
	$('#rc_pago').addEventListener('change', verFecha);
	verFecha(); total();
	$('#rc_volver').addEventListener('click', () => recargar());
	$('#rc_factura').addEventListener('change', e => leerFactura(cont, e.target, total));
	const token = 'rc' + Date.now() + Math.random().toString(36).slice(2);   // doble clic -> el servidor no ingresa dos veces
	$('#rc_ok').addEventListener('click', e => guardar(cont, o, items, credito, e.currentTarget, token, d.alerta_pct));
	if ($('#rc_cerrar')) {
		$('#rc_cerrar').addEventListener('click', async () => {
			const ok = await confirmar({ titulo: `¿Cerrar la orden N° ${o.idorden}?`, boton: 'Sí, cerrar',
				textoHtml: '<p style="margin:0">Lo que no llegó vuelve a <b>Por comprar</b> para pedirlo de nuevo (a este u otro proveedor).</p>' });
			if (!ok) { return; }
			try { await api('recepcion_oc.php?op=cerrar_faltante', { idorden: o.idorden }); aviso('Orden cerrada.'); recargar(); }
			catch (err) { aviso(err.message, 'error'); }
		});
	}
}

/** Lee la factura con IA (endpoint de Compras) y llena cantidad y precio de los productos que reconoce. */
async function leerFactura(cont, input, total) {
	const archivo = input.files[0];
	if (!archivo) { return; }
	const caja = cont.querySelector('#rc_ia');
	caja.innerHTML = '<p class="inv-ayuda"><i class="fa fa-spinner fa-spin"></i> Leyendo la factura… puede tardar unos segundos.</p>';
	try {
		const r = await subirLegacy('log_compras.php?op=factura-leer', 'archivo', archivo);
		const sinIgv = Number(r.recupera_igv) === 1;
		const noReconocidos = [];
		let llenos = 0;
		r.lineas.forEach(l => {
			const tr = l.match && cont.querySelector(`tr[data-prod="${l.match.idproducto}"]`);
			if (!tr) { noReconocidos.push(l.descripcion); return; }
			const factor = Number(l.match.factor) || 1;
			tr.querySelector('.rc-cant').value = Math.round(Number(l.cantidad || 0) * factor * 10000) / 10000;
			tr.querySelector('.rc-precio').value = Math.round(Number(sinIgv ? l.costo_sin : l.costo_con) / factor * 10000) / 10000;
			llenos++;
		});
		if (r.comprobante && r.comprobante.serie) { cont.querySelector('#rc_comp').value = `${r.comprobante.serie}-${r.comprobante.numero}`; }
		total();
		caja.innerHTML = `<div class="inv-toolbar" style="display:block">
			<p style="margin:0"><i class="fa fa-check-circle inv-pos"></i> Se llenaron <b>${llenos}</b> producto(s) desde la factura. Revisa antes de confirmar.</p>
			${noReconocidos.length ? `<p class="inv-neg" style="margin:6px 0 0">No están en esta orden: ${noReconocidos.map(esc).join(', ')}. Si llegaron, regístralos en Compras.</p>` : ''}
			${(r.avisos || []).map(a => `<p class="${a.tipo === 'error' ? 'inv-neg' : 'inv-ayuda'}" style="margin:4px 0 0">${esc(a.texto)}</p>`).join('')}</div>`;
	} catch (err) {
		caja.innerHTML = '';
		aviso(err.message, 'error');
	} finally {
		input.value = '';
	}
}

async function guardar(cont, o, items, credito, btn, token, alertaPct = 5) {
	const filas = [...cont.querySelectorAll('tr[data-item]')].map(tr => ({
		idorden_item: Number(tr.dataset.item),
		recibido: leerNum(tr.querySelector('.rc-cant')),
		precio: leerNum(tr.querySelector('.rc-precio')),
		lote: tr.querySelector('.rc-lote').value,
		vencimiento: tr.querySelector('.rc-venc').value,
		nota: tr.querySelector('.rc-nota').value.trim(),
		cambio: Number(tr.querySelector('.rc-cambio').dataset.valor || 0),
		cambioTxt: tr.querySelector('.rc-cambio').value.trim(),
	}));
	const malEscrito = filas.find(f => f.recibido === null || f.precio === null);
	if (malEscrito) { aviso(`Cantidad o precio mal escrito en ${(items.find(i => Number(i.idorden_item) === malEscrito.idorden_item) || {}).descripcion}. Usa punto para decimales (ej: 1.5).`, 'error'); return; }
	const sinElegir = filas.find(f => f.cambioTxt && !f.cambio);
	if (sinElegir) { aviso(`Elige de la lista qué producto llegó en lugar de ${(items.find(i => Number(i.idorden_item) === sinElegir.idorden_item) || {}).descripcion}.`, 'error'); return; }
	const llegan = filas.filter(f => f.recibido > 0);
	if (!llegan.length) { aviso('Pon cuánto llegó de al menos un producto.', 'error'); return; }
	const nombre = id => (items.find(i => Number(i.idorden_item) === id) || {}).descripcion;
	const falta = items.some(i => (filas.find(f => f.idorden_item === Number(i.idorden_item)) || {}).recibido < i.pedida - i.recibida - 0.0001);
	// errores de tipeo: mas de lo que faltaba o precio muy distinto al de la orden
	const raros = [];
	llegan.forEach(f => {
		const i = items.find(x => Number(x.idorden_item) === f.idorden_item);
		const pend = Math.max(0, i.pedida - i.recibida);
		if (f.recibido > pend + 0.0001) { raros.push(`${esc(i.descripcion)}: llegó <b>${num(f.recibido)}</b> y faltaban ${num(pend)}`); }
		const u = i.precio_ref && i.precio_ref.ultimo;
		if (u && Number(u.idproveedor) === Number(o.idproveedor) && u.precio > 0 && (f.precio - u.precio) / u.precio * 100 >= alertaPct) {
			raros.push(`${esc(i.descripcion)}: <b>subió ${Math.round((f.precio - u.precio) / u.precio * 1000) / 10}%</b> (antes ${soles(u.precio)}, ahora ${soles(f.precio)})`);
		}
		if (i.precio > 0 && Math.abs(f.precio - i.precio) / i.precio > 0.3) { raros.push(`${esc(i.descripcion)}: precio <b>${soles(f.precio)}</b> y en la orden era ${soles(i.precio)}`); }
	});
	const ok = await confirmar({
		titulo: `¿Confirmar lo que llegó de la orden N° ${o.idorden}?`, peligro: false, boton: 'Sí, ingresar al almacén',
		textoHtml: `<div class="inv-table-wrap" style="max-height:240px;overflow:auto"><table class="inv-table">
				<thead><tr><th>Producto</th><th style="text-align:right">Llegó</th><th style="text-align:right">Subtotal</th></tr></thead>
				<tbody>${llegan.map(f => `<tr><td>${f.cambio ? `<b>${esc(f.cambioTxt)}</b><span class="inv-sub">en lugar de ${esc(nombre(f.idorden_item))}</span>` : esc(nombre(f.idorden_item))}${f.nota ? `<span class="inv-sub"><i class="fa fa-comment-o"></i> ${esc(f.nota)}</span>` : ''}</td><td style="text-align:right">${num(f.recibido)}</td>
					<td style="text-align:right">${soles(f.recibido * f.precio)}</td></tr>`).join('')}</tbody></table></div>
			<p class="inv-ayuda" style="margin:8px 0 0">Entra al stock del almacén central y se registra como compra${Number(cont.querySelector('#rc_pago').value) === credito ? ' a crédito (aparece en Cuentas por pagar)' : ''}.
				${falta ? '<b>Faltan productos:</b> la orden quedará como "Llegó una parte".' : ''}</p>
			${raros.length ? `<div class="lg-error" style="margin-top:8px"><b>Revisa antes de confirmar:</b><br>${raros.join('<br>')}</div>` : ''}`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	try {
		const r = await api('recepcion_oc.php?op=guardar', {
			idorden: o.idorden, items: filas, idtipo_pago: Number(cont.querySelector('#rc_pago').value),
			fecha_pago: cont.querySelector('#rc_fpago').value, comprobante: cont.querySelector('#rc_comp').value, token,
			nota: cont.querySelector('#rc_nota').value.trim(),
		});
		aviso(`Listo: ${soles(r.total)} ingresados al almacén (compra #${r.idcompra}).${r.completa ? ' La orden quedó completa.' : ' Quedan productos por llegar.'}`);
		recargar();
	} catch (err) {
		aviso(err.message, 'error');
		btn.disabled = false;
	}
}
