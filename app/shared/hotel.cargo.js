// Cargo a habitación (forma de pago 17). Plan: restobar-2026/docs/plans/cargo-habitacion-pos.md
// Lo carga x-pago.html. El servidor (bdphp/log_hotel.php) habla con el hotel; aquí no hay API key.
//
// Flujo en el cobro:
//  1. El cajero elige "Cargo habitacion" -> selector de habitación (busca por número o nombre).
//  2. Al elegir: el beneficio del huésped (desc_pct y luego el incluido de hoy) entra como descuento de la
//     página (mismo mecanismo que "Aplicar descuento"), se pre-llena el cliente y, si se pide, "sin comprobante".
//  3. Al registrar: goSendPedidoFecht de la página llama xHotelCargoAntesDeGuardar (POST /cargos) ANTES de
//     guardar el pago y xHotelCargoDespuesDeGuardar después (vincula el pago y el comprobante, o anula si falló).
//
// Cada página registra un adaptador con xHotelCargoRegistrarPagina(xValPago, { descuentoActual, aplicarDescuento, limpiar }).

var HOTEL_CARGO_TIPO_PAGO = 17;
var xHotelCargoVinculado = null; // null = aún no se sabe; lo lee x-comp-find-tipo-pago-option
var xHotelCargoEstado = { estadia: null, adapter: null, aplicado: false, ocupado: false, base: 0, manual: 0, descPct: 0, cubierto: 0, total: 0 };

function xHotelCargoRedondear(n) { return Math.round((parseFloat(n) || 0) * 100) / 100; }
function xHotelCargoEsc(s) {
	return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
	});
}
function xHotelCargoNormalizar(s) {
	return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function xHotelCargoAviso(icon, titulo, texto) {
	if (typeof showAlertSwalOk === 'function') { showAlertSwalOk(icon, titulo, texto); } else { alert(titulo + '\n' + texto); }
}

function xHotelCargoPost(op, body) {
	return new Promise(function (resolve) {
		$.ajax({ type: 'POST', url: '../../bdphp/log_hotel.php?op=' + op, data: JSON.stringify(body || {}),
			contentType: 'application/json', dataType: 'json', timeout: 25000 })
		.done(function (r) { resolve(r && typeof r === 'object' ? r : { success: false, error: 'Respuesta no válida del servidor.', code: 'ERROR' }); })
		.fail(function () { resolve({ success: false, error: 'No hay conexión con el servidor. Intenta de nuevo.', code: 'SIN_CONEXION' }); });
	});
}

// ¿La sede está vinculada a un hotel? (solo entonces se muestra la forma de pago 17). Cache corto por pestaña.
function xHotelCargoCargarEstado() {
	var KEY = '::app3_hotel_vinculado';
	try {
		var c = JSON.parse(sessionStorage.getItem(KEY) || 'null');
		if (c && (Date.now() - c.t) < 5 * 60 * 1000) { xHotelCargoVinculado = c.v === true; return; }
	} catch (e) {}
	xHotelCargoPost('estado').then(function (r) {
		xHotelCargoVinculado = !!(r.success && r.datos && r.datos.vinculado);
		try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), v: xHotelCargoVinculado })); } catch (e) {}
	});
}
xHotelCargoCargarEstado();

function xHotelCargoRegistrarPagina(pagoEl, adapter) {
	if (pagoEl) { pagoEl._hotelAdapter = adapter; }
}

// Descuento ya aplicado en los subtotales (fila id 6 "Descuento ..."), en positivo.
function xHotelCargoDescuentoDeSubtotales(arr) {
	var fila = (arr || []).filter(function (x) { return x && x.id === 6; })[0];
	return fila ? Math.max(0, -(parseFloat(fila.importe) || 0)) : 0;
}

// Deja el componente x-comp-descuento como si el cajero hubiera puesto el importe (así se guarda en registro_pago_descuento).
// descripcion vacía = quitar el beneficio y volver al descuento manual que había antes.
function xHotelCargoMarcarDescuento(comp, importe, descripcion) {
	var c = (typeof xThisCompDesc !== 'undefined' && xThisCompDesc) ? xThisCompDesc : comp; // get() del componente lee esta instancia
	if (!c) { return; }
	try {
		if (descripcion) {
			if (!c._hotelPrevio) {
				c._hotelPrevio = { tipo: c.tipoDscSelected ? JSON.parse(JSON.stringify(c.tipoDscSelected)) : null, importe: c.importeDsc || 0, txt: c.$.txt_imp_dsc.value };
			}
			var tipo = (c.listTipoConceptos || []).filter(function (x) { return String(x.idtipo_descuento) === '1'; })[0] || { idtipo_descuento: '1' };
			c.tipoDscSelected = Object.assign({}, tipo, { descripcion: descripcion });
			c.importeDsc = importe;
			c.$.txt_imp_dsc.value = importe.toFixed(2);
		} else {
			var p = c._hotelPrevio;
			delete c._hotelPrevio;
			if (p && importe > 0) {
				c.tipoDscSelected = p.tipo; c.importeDsc = p.importe; c.$.txt_imp_dsc.value = p.txt;
			} else {
				c.resetDsc(); c.$.txt_imp_dsc.value = '';
			}
		}
	} catch (err) { console.warn('hotel: descuento', err); }
}

function xHotelCargoLimpiar() {
	xHotelCargoEstado = { estadia: null, adapter: null, aplicado: false, ocupado: false, base: 0, manual: 0, descPct: 0, cubierto: 0, total: 0 };
}

// x-pago: cada cambio en la tabla de formas de pago.
function xHotelCargoRevisarPagos(lista, pago) {
	var e = xHotelCargoEstado;
	lista = lista || [];
	var con17 = lista.some(function (p) { return parseInt(p && p.id) === HOTEL_CARGO_TIPO_PAGO; });
	if (!con17) {
		if (e.estadia && !e.ocupado) { xHotelCargoQuitar(pago); }
		return;
	}
	if (e.estadia || e.ocupado) { return; }
	if (lista.length > 1) {
		xHotelCargoAviso('info', 'Cargo a habitación', 'El cargo a la habitación tiene que cubrir toda la cuenta. Borra las otras formas de pago y elige de nuevo "Cargo habitacion".');
		return;
	}
	e.ocupado = true;
	xHotelCargoElegirEstadia(pago).then(function () { xHotelCargoEstado.ocupado = false; }, function (err) {
		console.error('hotel: elegir habitación', err);
		xHotelCargoEstado.ocupado = false;
	});
}

// x-pago: antes de "Listo, registrar pago".
function xHotelCargoPuedeRegistrar(lista) {
	lista = lista || [];
	if (!lista.some(function (p) { return parseInt(p && p.id) === HOTEL_CARGO_TIPO_PAGO; })) { return true; }
	if (lista.length > 1) {
		xHotelCargoAviso('info', 'Cargo a habitación', 'El cargo a la habitación tiene que cubrir toda la cuenta. Borra las otras formas de pago.');
		return false;
	}
	if (!xHotelCargoEstado.estadia) {
		xHotelCargoAviso('info', 'Cargo a habitación', 'Elige la habitación: vuelve a tocar "Cargo habitacion".');
		return false;
	}
	return true;
}

// x-pago: el cajero sale del cobro o deja de usar el cargo a habitación -> se quita el beneficio aplicado.
function xHotelCargoQuitar(pago) {
	var e = xHotelCargoEstado;
	if (!e.estadia) { return Promise.resolve(); }
	var ad = e.adapter, aplicado = e.aplicado, manual = e.manual;
	xHotelCargoLimpiar();
	if (!aplicado || !ad) { return Promise.resolve(); }
	return Promise.resolve(ad.aplicarDescuento(manual, '')).then(function (t) {
		if (pago && t !== null && t !== undefined && !isNaN(parseFloat(t))) { pago.setTotalCobrar(t); }
	});
}

// x-pago.setVal: se abre un cobro nuevo; los subtotales de la página ya se rehicieron, solo se olvida la selección.
function xHotelCargoAlAbrirPago() {
	xHotelCargoLimpiar();
}

// Vuelve la fila que tenía "Cargo habitacion" a Efectivo, sin reconstruir la tabla
// (resetFormaPago la vacía y la rearma a los 200 ms: se veía un parpadeo).
function xHotelCargoDeshacerSeleccion() {
	try {
		var hecho = false;
		var btns = Array.prototype.slice.call(document.querySelectorAll('.xMiBoton_icon_option'));
		btns.forEach(function (b) {
			if (String(b.dataId) !== String(HOTEL_CARGO_TIPO_PAGO) || !b.hasAttribute('selected')) { return; }
			var hermanos = Array.prototype.slice.call(b.parentNode.querySelectorAll('.xMiBoton_icon_option'));
			var efectivo = hermanos.filter(function (x) { return String(x.dataId) === '1'; })[0];
			if (efectivo) { efectivo.click(); hecho = true; }
		});
		if (hecho) { try { xCalcImporte(); } catch (e) {} return; }
	} catch (e) {}
	try { xCompTableFP.resetFormaPago(); } catch (e) {}
}

// El cobro vive en un paper-dialog modal: Polymer (IronOverlay) devuelve el foco al
// diálogo y no deja escribir en el buscador del SweetAlert. Se suspende mientras está abierto.
function xHotelCargoSoltarFoco() {
	var mgr = window.Polymer && Polymer.IronOverlayManager;
	var overlays = (mgr && mgr._overlays) ? mgr._overlays.slice() : [];
	var originales = overlays.map(function (o) { return o._onCaptureFocus; });
	overlays.forEach(function (o) { o._onCaptureFocus = function () {}; });
	return function () {
		overlays.forEach(function (o, i) { o._onCaptureFocus = originales[i]; });
	};
}

function xHotelCargoBadges(b) {
	b = b || {};
	var pct = parseFloat(b.desc_pct) || 0, disp = parseFloat(b.incluido_disponible_hoy) || 0, dia = parseFloat(b.incluido_dia) || 0;
	var badge = function (t, color) { return '<span style="display:inline-block;margin-left:4px;padding:1px 7px;border-radius:10px;font-size:11px;font-weight:600;color:#fff;background:' + color + '">' + xHotelCargoEsc(t) + '</span>'; };
	if (pct >= 100) { return badge('Todo incluido', '#2e7d32'); }
	var h = '';
	if (pct > 0) { h += badge(xHotelCargoRedondear(pct) + '% huésped', '#1565c0'); }
	if (disp > 0) { h += badge('S/ ' + disp.toFixed(2) + ' incluidos hoy', '#2e7d32'); }
	else if (dia > 0) { h += badge('Incluido de hoy ya usado', '#9e9e9e'); }
	return h;
}

function xHotelCargoFilaHtml(x, i, sel) {
	var h = x.huesped || {};
	var acomp = (x.acompanantes || []).map(function (a) { return a && a.nombre; }).filter(Boolean);
	var extra = [];
	if (acomp.length) { extra.push('Acompañantes: ' + acomp.join(', ')); }
	if (x.empresa) { extra.push(x.empresa); }
	// Fila compacta: número a la izquierda, huésped y beneficio a la derecha (caben muchas habitaciones).
	return '<div class="hc-row" data-i="' + i + '" style="display:flex;align-items:center;gap:10px;border:1px solid ' + (sel ? '#2196f3' : '#e0e0e0') + ';background:' + (sel ? '#e3f2fd' : '#fff') +
		';border-radius:6px;padding:5px 8px;margin-bottom:4px;cursor:pointer;color:#212121;font-size:12px;line-height:1.3">' +
		'<span style="min-width:38px;font-size:14px;font-weight:600">' + xHotelCargoEsc(x.habitacion) + '</span>' +
		'<span style="flex:1;min-width:0">' +
		'<span style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + xHotelCargoEsc(h.nombre) + (h.num_doc ? ' <span style="color:#757575">· ' + xHotelCargoEsc(h.tipo_doc || 'Doc') + ' ' + xHotelCargoEsc(h.num_doc) + '</span>' : '') + '</span>' +
		(extra.length ? '<span style="display:block;font-size:11px;color:#757575;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + xHotelCargoEsc(extra.join(' · ')) + '</span>' : '') +
		'</span>' +
		'<span style="white-space:nowrap">' + xHotelCargoBadges(x.beneficio) + '</span>' +
		'</div>';
}

// Selector de habitación. Devuelve { estadia, sinComprobante } o null si se cancela.
function xHotelCargoSelector(lista, hotel) {
	var sel = -1, visibles = lista.map(function (x, i) { return i; });
	var swal = (typeof themeDefaultAlertSwal !== 'undefined') ? themeDefaultAlertSwal : Swal;
	var restaurarFoco = xHotelCargoSoltarFoco();
	return swal.fire({
		title: 'Cargo a habitación',
		html: '<p style="font-size:12px;color:#757575;margin:0 0 6px">' + xHotelCargoEsc(hotel || '') + '</p>' +
			'<input id="hc_buscar" type="search" style="display:block;margin:0;width:100%;box-sizing:border-box;height:34px;padding:6px 10px;font-size:13px;border:1px solid #ccc;border-radius:4px;outline:none;color:#212121;background:#fff" placeholder="Busca por habitación, nombre o DNI" autocomplete="off">' +
			'<div id="hc_lista" style="max-height:340px;overflow:auto;text-align:left;margin-top:8px"></div>' +
			'<label style="display:flex;gap:6px;align-items:center;justify-content:center;margin-top:10px;font-size:13px;cursor:pointer">' +
			'<input type="checkbox" id="hc_sin_cpe"> Sin comprobante (lo emite el hotel al checkout)</label>',
		showCancelButton: true,
		confirmButtonText: 'Cargar a la habitación',
		cancelButtonText: 'Cancelar',
		focusConfirm: false,
		didOpen: function () {
			var cont = document.getElementById('hc_lista'), buscar = document.getElementById('hc_buscar');
			var pintar = function () {
				cont.innerHTML = visibles.length
					? visibles.map(function (i) { return xHotelCargoFilaHtml(lista[i], i, i === sel); }).join('')
					: '<p style="color:#757575;text-align:center">No hay habitaciones que coincidan.</p>';
			};
			buscar.addEventListener('input', function () {
				var q = xHotelCargoNormalizar(buscar.value.trim());
				visibles = lista.map(function (x, i) { return i; }).filter(function (i) {
					if (!q) { return true; }
					var x = lista[i], h = x.huesped || {};
					var texto = [x.habitacion, h.nombre, h.num_doc, x.empresa].concat((x.acompanantes || []).map(function (a) { return a && a.nombre; })).join(' ');
					return xHotelCargoNormalizar(texto).indexOf(q) > -1;
				});
				if (visibles.length === 1) { sel = visibles[0]; }
				pintar();
			});
			buscar.addEventListener('keydown', function (ev) {
				if (ev.keyCode === 13 && sel > -1) { ev.preventDefault(); Swal.clickConfirm(); }
			});
			cont.addEventListener('click', function (ev) {
				var row = ev.target.closest ? ev.target.closest('.hc-row') : null;
				if (!row) { return; }
				sel = parseInt(row.getAttribute('data-i'));
				pintar();
			});
			cont.addEventListener('dblclick', function (ev) {
				if (ev.target.closest && ev.target.closest('.hc-row')) { Swal.clickConfirm(); }
			});
			if (lista.length === 1) { sel = 0; }
			pintar();
			setTimeout(function () { buscar.focus(); }, 50);
		},
		didClose: function () { restaurarFoco(); },
		preConfirm: function () {
			if (sel < 0) { Swal.showValidationMessage('Elige una habitación'); return false; }
			return { estadia: lista[sel], sinComprobante: document.getElementById('hc_sin_cpe').checked };
		}
	}).then(function (res) { restaurarFoco(); return res && res.isConfirmed ? res.value : null; });
}

function xHotelCargoElegirEstadia(pago) {
	return xHotelCargoPost('estadias').then(function (r) {
		if (!r.success) {
			xHotelCargoAviso('error', 'No se pudo consultar el hotel', r.error || '');
			xHotelCargoDeshacerSeleccion();
			return;
		}
		var lista = (r.datos && r.datos.estadias) || [];
		if (!lista.length) {
			xHotelCargoAviso('info', 'Sin huéspedes', 'No hay habitaciones ocupadas con cargos habilitados en el hotel.');
			xHotelCargoDeshacerSeleccion();
			return;
		}
		return xHotelCargoSelector(lista, r.datos.hotel).then(function (elegido) {
			if (!elegido) { xHotelCargoDeshacerSeleccion(); return; }
			return xHotelCargoAplicar(elegido.estadia, elegido.sinComprobante, pago);
		});
	});
}

// Aplica el beneficio: primero desc_pct, luego cubre hasta el incluido disponible de hoy.
function xHotelCargoAplicar(est, sinComprobante, pago) {
	var ad = pago ? pago._hotelAdapter : null;
	var b = est.beneficio || {};
	var base = xHotelCargoRedondear(pago.importe_total_cobrar);
	var manual = ad && ad.descuentoActual ? xHotelCargoRedondear(ad.descuentoActual()) : 0;
	var pct = Math.min(100, Math.max(0, parseFloat(b.desc_pct) || 0));
	var descPct = xHotelCargoRedondear(base * pct / 100);
	var cubierto = xHotelCargoRedondear(Math.min(Math.max(0, parseFloat(b.incluido_disponible_hoy) || 0), base - descPct));
	var hotelDesc = xHotelCargoRedondear(descPct + cubierto);
	var habitacion = est.habitacion || '';

	var seguir = function (total, aplicado) {
		xHotelCargoEstado = { estadia: est, adapter: ad, aplicado: aplicado, ocupado: true, base: base, manual: manual,
			descPct: aplicado ? descPct : 0, cubierto: aplicado ? cubierto : 0, total: xHotelCargoRedondear(total) };
		if (aplicado) { pago.setTotalCobrar(total); }
		// Primero el comprobante (cambiarlo limpia el nombre del cliente) y luego el huésped como cliente.
		if (sinComprobante) { pago.setSinComprobante(); }
		var h = est.huesped || {};
		pago.setClienteHotel(h.num_doc || '', h.nombre || '');
		try { xCalcImporte(); } catch (e) {} // refresca lo que x-pago manda a la página (cliente / comprobante)
		if (typeof showToastSwal === 'function') {
			showToastSwal('success', 'Hab. ' + habitacion + (aplicado && hotelDesc > 0 ? ' · beneficio S/ ' + hotelDesc.toFixed(2) : ''));
		}
	};

	if (hotelDesc <= 0) { seguir(base, false); return Promise.resolve(); }

	var sinBeneficio = function () {
		var swal = (typeof themeDefaultAlertSwal !== 'undefined') ? themeDefaultAlertSwal : Swal;
		return swal.fire({
			icon: 'warning', title: 'No se puede aplicar el beneficio aquí',
			text: 'En este cobro no se puede aplicar el beneficio del huésped (S/ ' + hotelDesc.toFixed(2) + '). ¿Cargar el total sin beneficio?',
			showCancelButton: true, confirmButtonText: 'Sí, cargar el total', cancelButtonText: 'No'
		}).then(function (res) {
			if (res && res.isConfirmed) { descPct = 0; cubierto = 0; seguir(base, false); } else { xHotelCargoDeshacerSeleccion(); }
		});
	};
	if (!ad || !ad.aplicarDescuento) { return sinBeneficio(); }

	return Promise.resolve(ad.aplicarDescuento(xHotelCargoRedondear(manual + hotelDesc), 'huésped hab. ' + habitacion)).then(function (total) {
		if (total === null || total === undefined || isNaN(parseFloat(total))) { return sinBeneficio(); }
		seguir(parseFloat(total), true);
	});
}

// Líneas para el folio del hotel (informativo). Si no se reconocen, una sola línea con el total.
function xHotelCargoDetalle(items, bruto) {
	var out = [];
	(Array.isArray(items) ? items : []).forEach(function (x) {
		if (!x || typeof x !== 'object') { return; }
		var des = x.des || x.descripcion;
		var cant = parseFloat(x.cantidad_seleccionada || x.cantidad);
		var sub = parseFloat(x.precio_total || x.ptotal || x.total);
		if (!des || !(cant > 0) || isNaN(sub) || sub < 0) { return; }
		out.push({ descripcion: String(des).slice(0, 120), cantidad: cant, precio_unit: xHotelCargoRedondear(sub / cant), subtotal: xHotelCargoRedondear(sub) });
	});
	return out.length ? out : [{ descripcion: 'Consumo restaurante', cantidad: 1, precio_unit: bruto, subtotal: bruto }];
}

function xHotelCargoNumComprobante(comp, correlativo) {
	if (!comp || !correlativo || ['01', '03'].indexOf(String(comp.codsunat)) < 0) { return null; } // ticket/ninguno: lo factura el hotel
	var n = parseInt(correlativo);
	return n > 0 ? String(comp.inicial || '') + String(comp.serie || '') + '-' + n : null;
}

// Página (goSendPedidoFecht), ANTES de guardar el pago. { ok:false } = no guardar.
function xHotelCargoAntesDeGuardar(data, items) {
	var pagos = (data && data.p_tipo_pago) || [];
	if (!pagos.some(function (p) { return parseInt(p && p.id) === HOTEL_CARGO_TIPO_PAGO; })) { return Promise.resolve({ ok: true, ref: null }); }
	var e = xHotelCargoEstado, est = e.estadia;
	if (!est) { xHotelCargoAviso('info', 'Cargo a habitación', 'Elige la habitación antes de registrar el pago.'); return Promise.resolve({ ok: false }); }
	if (pagos.length > 1) { xHotelCargoAviso('info', 'Cargo a habitación', 'El cargo a la habitación tiene que cubrir toda la cuenta.'); return Promise.resolve({ ok: false }); }

	var subt = data.p_subtotales || [];
	var totalPago = subt.length ? xHotelCargoRedondear(subt[subt.length - 1].importe) : NaN;
	if (isNaN(totalPago) || Math.abs(totalPago - e.total) > 0.01) {
		xHotelCargoAviso('warning', 'Cargo a habitación', 'El total cambió después de elegir la habitación. Vuelve a elegir "Cargo habitacion".');
		return Promise.resolve({ ok: false });
	}
	var bruto = xHotelCargoRedondear(e.base + e.manual);
	var cubierto = xHotelCargoRedondear(Math.min(e.cubierto, bruto - e.total));
	var descuento = xHotelCargoRedondear(bruto - cubierto - e.total);
	var h = est.huesped || {};
	return xHotelCargoPost('cargar', {
		estadia_id: est.estadia_id, habitacion: est.habitacion, huesped: h.nombre || '',
		bruto: bruto, descuento: descuento, cubierto_incluido: cubierto, total: e.total,
		detalle: xHotelCargoDetalle(items, bruto)
	}).then(function (r) {
		if (r.success && r.datos && r.datos.ref) { return { ok: true, ref: r.datos.ref, habitacion: est.habitacion, adapter: e.adapter }; }
		if (r.code === 'INCLUIDO_AGOTADO') {
			xHotelCargoAviso('warning', 'Incluido de hoy ya usado', 'Otro punto de venta ya usó el consumo incluido de hoy. Vuelve a elegir "Cargo habitacion" para recalcular.');
		} else {
			xHotelCargoAviso('error', 'No se pudo cargar a la habitación', (r.error || '') + ' El pago no se registró.');
		}
		return { ok: false };
	});
}

// Página, DESPUÉS de guardar el pago (rpt = respuesta de log_001.php, o null si falló).
function xHotelCargoDespuesDeGuardar(ctx, rpt, data) {
	if (!ctx || !ctx.ref) { return; }
	var idrp = rpt ? parseInt(rpt.idregistro_pago) : 0;
	if (!(idrp > 0)) {
		xHotelCargoPost('anular', { ref: ctx.ref, motivo: 'No se guardó el pago en el POS' }).then(function (r) {
			if (!r.success) {
				xHotelCargoAviso('error', 'Revisa el cargo en el hotel', 'El pago no se guardó y no se pudo anular el cargo de la habitación ' + ctx.habitacion + '. ' + (r.error || '') + ' Anúlalo en recepción.');
			}
		});
		return;
	}
	var body = { ref: ctx.ref, idregistro_pago: idrp, comprobante: xHotelCargoNumComprobante(data && data.p_comprobante, rpt.correlativo_comprobante) };
	xHotelCargoPost('comprobante', body).then(function (r) {
		if (r.success) { return; }
		if (r.code === 'FOLIO_CERRADO' || r.code === 'CARGO_ANULADO') {
			// el pago ya quedó vinculado; solo el hotel no aceptó el número de comprobante
			if (body.comprobante) {
				xHotelCargoAviso('warning', 'Revisa el comprobante con recepción', 'Se emitió el comprobante ' + body.comprobante + ', pero el hotel no lo registró en la habitación ' + ctx.habitacion + '. ' + (r.error || '') + ' Coordina con recepción para no facturarlo dos veces.');
			}
			return;
		}
		// un reintento: sin este vínculo, anular el pago después no anularía el cargo en el hotel
		setTimeout(function () {
			xHotelCargoPost('comprobante', body).then(function (r2) { if (!r2.success) { console.warn('hotel: comprobante', ctx.ref, r2.error); } });
		}, 3000);
	});
	// el beneficio ya es parte de la venta guardada: se olvida la selección sin revertir el descuento
	try { if (ctx.adapter && ctx.adapter.limpiar) { ctx.adapter.limpiar(); } } catch (e) {}
	xHotelCargoLimpiar();
	if (typeof showToastSwal === 'function') { showToastSwal('success', 'Cargado a la habitación ' + ctx.habitacion); }
}
