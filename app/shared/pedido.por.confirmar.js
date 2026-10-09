// Pedido por confirmar (carta QR, sede unica) en Control de Pedidos:
// - la tarjeta de la mesa pasa a "Por confirmar" (la mesa recien se activa cuando caja/mozo confirma)
// - opcion "Por confirmar (N)" en la cabecera junto a "Por Estado / Por Numero" (filtra la grilla)
// - aviso con sonido y dialogo Confirmar / Anular al tocar la mesa.
// Plan: plan/PEDIDO-POR-CONFIRMAR-PLAN.md. Servidor: bdphp/log_pedido_confirmar.php (proxy a backend-pedidos).
// REGLA (incidente 2026-10-06): aqui NO se ejecuta nada en nivel superior. Solo declaraciones de funcion.
// La pagina llama xPpcIniciar() despues de _cpSocketOpen(). Si la sede no tiene el flag, no hace nada mas.

function xPpcEstado() {
	if (!window.__xPpc) {
		window.__xPpc = { iniciado: false, activo: false, exigePago: false, lista: [], timer: null,
			observer: null, cargando: false, tiposPago: null, enVuelo: {}, filtroOn: false, mesaDialogo: null };
	}
	return window.__xPpc;
}

function xPpcIniciar() {
	var st = xPpcEstado();
	if (st.iniciado) { // la pagina puede volver a montarse: solo re-enganchar
		if (st.activo) { xPpcAsegurarSocket(); xPpcObservarGrid(); xPpcRefrescar(); }
		return;
	}
	st.iniciado = true;
	xPpcPost('config', {}).then(function (r) {
		var cfg = r && r.success && r.data ? r.data : null;
		if (!cfg || cfg.requiere_confirmacion !== true) { return; } // sede sin flag: cero cambio
		st.activo = true;
		st.exigePago = cfg.exige_pago === true;
		xPpcInyectarCss();
		xPpcAsegurarSocket();
		setTimeout(xPpcAsegurarSocket, 2500); // _cpSocketOpen puede reconectar a los 2 s
		xPpcObservarGrid();
		xPpcEscucharClickMesa();
		xPpcRefrescar();
		st.timer = setInterval(xPpcTick, 60000);
	});
}

// Cada 60 s: re-engancha el socket si se recreo, actualiza "hace X min" y refresca (respaldo del socket).
function xPpcTick() {
	var st = xPpcEstado();
	xPpcAsegurarSocket();
	if (!xPpcPaginaVisible()) { return; }
	if (st.lista.length > 0) { xPpcRefrescar(); } else { xPpcPintarFiltro(); }
}

function xPpcPaginaVisible() {
	var g = document.getElementById('_gridCM');
	return !!(g && document.body.contains(g));
}

function xPpcPost(op, body) {
	return new Promise(function (resolve) {
		$.ajax({ type: 'POST', url: '../../bdphp/log_pedido_confirmar.php?op=' + op, data: JSON.stringify(body || {}),
			contentType: 'application/json', dataType: 'json', timeout: 30000 })
		.done(function (r) { resolve(r && typeof r === 'object' ? r : { success: false, error: 'Respuesta no valida del servidor.' }); })
		.fail(function () { resolve({ success: false, error: 'No hay conexion con el servidor. Intenta de nuevo.' }); });
	});
}

// Usa el socket que ya abre socket.master.service.js (sala room{idorg}{idsede}). Marca el socket para no duplicar.
function xPpcAsegurarSocket() {
	if (typeof socketService === 'undefined') { return; }
	var svc = socketService.getInstance();
	var sk = svc && svc._socket;
	if (!sk || sk.__xPpcOn) { return; }
	sk.__xPpcOn = true;
	svc._listen('pedido-por-confirmar-nuevo', xPpcOnNuevo);
	svc._listen('pedido-por-confirmar-cambio', xPpcOnCambio);
	svc._listen('pedido-por-confirmar-recordar', xPpcOnRecordar);
}

// El cliente toco "Volver a llamar al personal": aviso con sonido de nuevo.
function xPpcOnRecordar(data) {
	if (!xPpcEstado().activo) { return; }
	xPpcNotificar(data || {}, true);
}

function xPpcOnNuevo(data) {
	if (!xPpcEstado().activo) { return; }
	xPpcNotificar(data || {});
	xPpcRefrescar();
}

function xPpcOnCambio() {
	if (!xPpcEstado().activo) { return; }
	xPpcRefrescar();
}

// Aviso fijo con sonido, mismo estilo que pNotificaPersonal (notifica.js, sin modificarlo).
function xPpcNotificar(data, esRecordatorio) {
	try { PlaySound('notificaLlamadoCliente'); } catch (e) { /* sin audio en esta pagina */ }
	if (typeof PNotify === 'undefined') { return; }
	if (typeof window.stackBottomRight === 'undefined') {
		window.stackBottomRight = { 'dir1': 'up', 'dir2': 'left', 'firstpos1': 25, 'firstpos2': 25 };
	}
	var hora = typeof pTimeNow === 'function' ? pTimeNow() + ' ' : '';
	var cliente = data.nombre_cliente ? ' (' + xPpcEsc(data.nombre_cliente) + ')' : '';
	var notice = PNotify.notice({
		text: hora + 'Mesa <strong>' + xPpcEsc(data.mesa) + '</strong>: '
			+ (esRecordatorio ? '<strong>vuelve a llamar</strong>, pedido por confirmar' : 'pedido por confirmar') + cliente
			+ '. <u>Clic para revisar</u>',
		textTrusted: true,
		hide: false,
		stack: window.stackBottomRight,
		modules: { History: { maxInStack: 5 } }
	});
	notice.on('click', function () { notice.close(); xPpcAbrirDialogo(data.mesa); });
}

function xPpcRefrescar() {
	var st = xPpcEstado();
	if (!st.activo || st.cargando) { return; }
	st.cargando = true;
	xPpcPost('pendientes', {}).then(function (r) {
		st.cargando = false;
		if (!r.success) { console.warn('[pedido-por-confirmar] pendientes:', r.error); return; }
		st.lista = Array.isArray(r.data) ? r.data : [];
		xPpcPintarTodo();
	});
}

function xPpcPintarTodo() {
	xPpcPintarFiltro();
	xPpcPintarMesas();
	xPpcPintarDialogo();
}

// ---------- mesa: codigo normalizado para comparar "05", "5", "PISO1-05" ----------
function xPpcClaveMesa(v) {
	var s = String(v === null || v === undefined ? '' : v).trim().toUpperCase();
	return s.replace(/(\D|^)0+(\d)/g, '$1$2');
}

function xPpcPendientesDeMesa(mesa) {
	var k = xPpcClaveMesa(mesa);
	return xPpcEstado().lista.filter(function (p) { return xPpcClaveMesa(p.mesa) === k; });
}

// ---------- opcion "Por confirmar (N)" al costado de las areas (Piso 1, Piso 2...) ----------
function xPpcPintarFiltro() {
	var st = xPpcEstado();
	var areas = document.getElementById('comp-area-mesas');
	var n = st.lista.length;
	var caja = document.getElementById('ppc-filtro');
	if (!areas || !areas.parentNode || !xPpcPaginaVisible()) { return; }
	var fila = areas.parentNode; // div que la pagina oculta fuera de "Local"
	if (!caja || caja.parentNode !== fila) {
		if (caja && caja.parentNode) { caja.parentNode.removeChild(caja); }
		caja = document.createElement('div');
		caja.id = 'ppc-filtro';
		caja.className = 'ppc-filtro-box mb-2';
		caja.title = 'Pedidos que los clientes enviaron desde la carta QR y esperan que caja o el mozo los confirme';
		caja.onclick = xPpcToggleFiltro;
		fila.classList.add('ppc-fila-areas');
		fila.appendChild(caja);
	}
	if (n === 0 && st.filtroOn) { xPpcAplicarFiltro(false); }
	caja.innerHTML = '<div class="ppc-filtro"><i class="fa fa-bell"></i> Por confirmar'
		+ (n > 0 ? '<span class="badge ml-2 ppc-filtro-n">' + n + '</span>' : '') + '</div>';
	caja.classList.toggle('ppc-hay', n > 0);
	caja.classList.toggle('ppc-on', st.filtroOn);
}

function xPpcToggleFiltro() {
	var st = xPpcEstado();
	if (!st.lista.length && !st.filtroOn) {
		if (typeof showToastSwal === 'function') { showToastSwal('info', 'No hay pedidos por confirmar'); }
		return;
	}
	xPpcAplicarFiltro(!st.filtroOn);
	xPpcPintarFiltro();
}

function xPpcAplicarFiltro(on) {
	var st = xPpcEstado();
	st.filtroOn = !!on;
	if (typeof $ === 'undefined' || !$.fn || !$.fn.isotope) { return; }
	try {
		var base = typeof xIdFiltro1 !== 'undefined' && xIdFiltro1 ? xIdFiltro1 : '*';
		$('#_gridCM').isotope({ filter: on ? '.ppc-mesa' : base });
	} catch (e) { /* grilla aun sin isotope */ }
}

// ---------- tarjeta de la mesa en la grilla ----------
// Mesa libre: la tarjeta "disponible" pasa a "Por confirmar" (la mesa no se activa hasta confirmar).
// Mesa ocupada (cliente pide mas): se marca con la cinta sobre su tarjeta.
function xPpcPintarMesas() {
	var grid = document.getElementById('_gridCM');
	if (!grid) { return; }
	var st = xPpcEstado();
	var cambio = false;
	var cards = grid.querySelectorAll('.xMiCardPedido');
	for (var i = 0; i < cards.length; i++) {
		var card = cards[i];
		// control de mesas convierte la tarjeta libre en ocupada (y al liberarla deja data-nummesa): manda xNeutro
		var esLibre = card.classList.contains('xNeutro');
		var mesa = card.getAttribute('data-codigo-mesa') || xPpcTexto(card, '.numero') || card.getAttribute('data-nummesa');
		var pend = mesa ? xPpcPendientesDeMesa(mesa) : [];
		var marcada = card.classList.contains('ppc-mesa');
		if (pend.length) {
			xPpcMarcarMesa(card, esLibre, pend);
			cambio = cambio || !marcada;
		} else if (marcada) {
			xPpcDesmarcarMesa(card);
			cambio = true;
		}
	}
	if (cambio) { xPpcRelayout(); }
	if (st.filtroOn) { xPpcAplicarFiltro(true); }
}

function xPpcTexto(card, sel) {
	var el = card.querySelector(sel);
	return el ? el.textContent.trim() : '';
}

function xPpcMarcarMesa(card, esLibre, pend) {
	var total = pend.reduce(function (a, p) { return a + (parseFloat(p.total) || 0); }, 0);
	var min = pend.reduce(function (a, p) { return Math.max(a, parseInt(p.minutos, 10) || 0); }, 0);
	var revisar = pend.some(function (p) { return String(p.estado) === '4'; });
	var etiqueta = (revisar ? 'Revisar' : 'Por confirmar') + (pend.length > 1 ? ' (' + pend.length + ')' : '');
	card.classList.add('ppc-mesa');
	card.classList.toggle('ppc-libre', esLibre);
	card.classList.toggle('ppc-ocupada', !esLibre);
	card.classList.toggle('ppc-revisar', revisar);
	var cinta = card.querySelector('.ppc-cinta');
	if (!cinta) {
		cinta = document.createElement('div');
		cinta.className = 'ppc-cinta';
		card.insertBefore(cinta, card.firstChild);
	}
	cinta.innerHTML = '<i class="fa fa-bell"></i> ' + etiqueta;
	cinta.title = 'Tocar para confirmar o anular';
	if (!esLibre) { xPpcOlvidarTextos(card); return; } // la pagina ya ocupo la mesa: sus textos mandan
	// guarda el texto original de la tarjeta libre para restaurarlo al confirmar / anular
	var tiempo = card.querySelector('.tiempo');
	var importe = card.querySelector('.importe');
	if (tiempo && !tiempo.hasAttribute('data-ppc-orig')) { tiempo.setAttribute('data-ppc-orig', tiempo.textContent); }
	if (importe && !importe.hasAttribute('data-ppc-orig')) { importe.setAttribute('data-ppc-orig', importe.textContent); }
	if (tiempo) { tiempo.textContent = min <= 0 ? 'recien' : 'hace ' + min + ' min'; }
	if (importe) { importe.textContent = 'S/. ' + xPpcMoneda(total); }
}

function xPpcDesmarcarMesa(card) {
	card.classList.remove('ppc-mesa', 'ppc-libre', 'ppc-ocupada', 'ppc-revisar');
	var cinta = card.querySelector('.ppc-cinta');
	if (cinta) { cinta.parentNode.removeChild(cinta); }
	if (card.classList.contains('xNeutro')) { // sigue libre: vuelve a "disponible / -"
		var orig = card.querySelectorAll('[data-ppc-orig]');
		for (var i = 0; i < orig.length; i++) { orig[i].textContent = orig[i].getAttribute('data-ppc-orig'); }
	}
	xPpcOlvidarTextos(card);
}

function xPpcOlvidarTextos(card) {
	var orig = card.querySelectorAll('[data-ppc-orig]');
	for (var i = 0; i < orig.length; i++) { orig[i].removeAttribute('data-ppc-orig'); }
}

function xPpcRelayout() {
	if (typeof $ === 'undefined' || !$.fn || !$.fn.isotope) { return; }
	try { $('#_gridCM').isotope('layout'); } catch (e) { /* grilla aun sin isotope */ }
}

// Tocar una mesa con pedido por confirmar (libre u ocupada) abre la confirmacion en vez del flujo normal.
// La mesa se abre como siempre recien cuando ya no tiene pendientes (confirmado o anulado).
// Fase de captura: corre antes que los clicks de la pagina.
function xPpcEscucharClickMesa() {
	var st = xPpcEstado();
	if (st.clickOn) { return; }
	st.clickOn = true;
	document.addEventListener('click', function (e) {
		if (!xPpcEstado().activo || !e.target || !e.target.closest) { return; }
		var card = e.target.closest('#_gridCM .xMiCardPedido.ppc-mesa');
		if (!card) { return; }
		e.preventDefault();
		e.stopPropagation();
		e.stopImmediatePropagation();
		xPpcAbrirDialogo(card.getAttribute('data-codigo-mesa') || xPpcTexto(card, '.numero') || card.getAttribute('data-nummesa'));
	}, true);
}

// Control de mesas redibuja las tarjetas: se vuelve a marcar (idempotente).
function xPpcObservarGrid() {
	var st = xPpcEstado();
	var grid = document.getElementById('_gridCM');
	if (!grid || typeof MutationObserver === 'undefined') { return; }
	if (st.observer && st.observerGrid === grid) { return; }
	if (st.observer) { st.observer.disconnect(); }
	var t = null;
	st.observer = new MutationObserver(function () {
		if (t) { return; }
		t = setTimeout(function () {
			t = null;
			if (xPpcEstado().lista.length) { xPpcPintarMesas(); }
			xPpcPintarFiltro(); // la cabecera tambien se rearma al cambiar de filtro
		}, 300);
	});
	st.observer.observe(grid, { childList: true, subtree: true });
	st.observerGrid = grid;
}

// ---------- dialogo (una mesa) ----------
function xPpcAbrirDialogo(mesa) {
	var st = xPpcEstado();
	if (!st.activo) { return; }
	st.mesaDialogo = mesa === undefined || mesa === null ? null : String(mesa);
	var dlg = document.getElementById('ppc-dlg');
	if (!dlg) {
		dlg = document.createElement('div');
		dlg.id = 'ppc-dlg';
		dlg.className = 'ppc-overlay';
		dlg.innerHTML = '<div class="ppc-box">'
			+ '<div class="ppc-head"><div><p class="fs-18 fw-600 m-0" id="ppc-dlg-titulo">Por confirmar</p>'
			+ '<p class="fs-12 text-secondary m-0" id="ppc-dlg-sub"></p></div>'
			+ '<button type="button" class="ppc-x" title="Cerrar" onclick="xPpcCerrarDialogo()">&times;</button></div>'
			+ '<div class="ppc-body" id="ppc-dlg-body"></div>'
			+ '</div>';
		dlg.addEventListener('click', function (e) { if (e.target === dlg) { xPpcCerrarDialogo(); } });
		document.body.appendChild(dlg);
	}
	dlg.style.display = 'flex';
	xPpcPintarDialogo();
	xPpcRefrescar();
	if (st.exigePago) { xPpcCargarTiposPago(); }
}

function xPpcCerrarDialogo() {
	var dlg = document.getElementById('ppc-dlg');
	if (dlg) { dlg.style.display = 'none'; }
}

function xPpcDialogoAbierto() {
	var dlg = document.getElementById('ppc-dlg');
	return !!(dlg && dlg.style.display !== 'none');
}

function xPpcListaDialogo() {
	var st = xPpcEstado();
	return st.mesaDialogo === null ? st.lista : xPpcPendientesDeMesa(st.mesaDialogo);
}

function xPpcPintarDialogo() {
	if (!xPpcDialogoAbierto()) { return; }
	var st = xPpcEstado();
	var lista = xPpcListaDialogo();
	var titulo = st.mesaDialogo === null ? 'Pedidos por confirmar' : 'Mesa ' + xPpcEsc(st.mesaDialogo) + ' · por confirmar';
	document.getElementById('ppc-dlg-titulo').innerHTML = titulo;
	document.getElementById('ppc-dlg-sub').textContent = 'El cliente envió este pedido desde la carta QR. Al confirmarlo se envía a preparación'
		+ (st.exigePago ? ' y se registra el pago.' : '.');
	var body = document.getElementById('ppc-dlg-body');
	// No repintar una tarjeta mientras el usuario esta escribiendo el pago o el motivo: se conserva lo abierto.
	var abiertos = {};
	var prev = body.querySelectorAll('.ppc-card');
	for (var i = 0; i < prev.length; i++) {
		var idp = prev[i].getAttribute('data-id');
		if (prev[i].querySelector('.ppc-panel:not(.ppc-oculto)') || st.enVuelo[idp]) { abiertos[idp] = prev[i]; }
	}
	if (lista.length === 0) {
		if (Object.keys(abiertos).length === 0) { xPpcCerrarDialogo(); }
		return;
	}
	var frag = document.createDocumentFragment();
	lista.forEach(function (p) {
		var id = String(p.id);
		if (abiertos[id]) { frag.appendChild(abiertos[id]); return; }
		var div = document.createElement('div');
		div.innerHTML = xPpcHtmlTarjeta(p);
		frag.appendChild(div.firstChild);
	});
	body.innerHTML = '';
	body.appendChild(frag);
}

function xPpcHtmlTarjeta(p) {
	var st = xPpcEstado();
	var id = parseInt(p.id, 10);
	var min = parseInt(p.minutos, 10) || 0;
	var hace = min <= 0 ? 'recien' : 'hace ' + min + ' min';
	var revisar = String(p.estado) === '4';
	var motivos = ['Cliente se retiro', 'Pedido duplicado', 'Cliente no pago', 'Otro'];
	return '<div class="ppc-card" data-id="' + id + '">'
		+ '<div class="ppc-card-top"><div><span class="ppc-chip"><i class="fa fa-clock-o"></i> ' + hace + '</span>'
		+ (p.nombre_cliente ? ' <span class="ppc-cliente"><i class="fa fa-user"></i> ' + xPpcEsc(p.nombre_cliente) + '</span>' : '') + '</div>'
		+ '<span class="ppc-total">S/. ' + xPpcMoneda(p.total) + '</span></div>'
		+ xPpcHtmlItems(p.p_body)
		+ (p.ultimo_error ? '<p class="ppc-aviso">' + xPpcEsc(p.ultimo_error) + '</p>' : '')
		+ '<p class="ppc-msg"></p>'
		+ '<div class="ppc-panel ppc-oculto" data-panel="pago">' + (st.exigePago ? xPpcHtmlPago() : '') + '</div>'
		+ '<div class="ppc-panel ppc-oculto" data-panel="anular">'
		+ '<label class="ppc-lbl">Motivo de la anulacion</label>'
		+ '<select class="ppc-ctrl ppc-motivo" onchange="xPpcMotivoCambio(' + id + ')">'
		+ '<option value="" selected disabled>Elija un motivo</option>'
		+ motivos.map(function (m) { return '<option value="' + m + '">' + m + '</option>'; }).join('') + '</select>'
		+ '<input class="ppc-ctrl ppc-motivo-otro ppc-oculto" maxlength="200" placeholder="Escriba el motivo">'
		+ '<div class="ppc-acciones"><button type="button" class="btn btn-light" onclick="xPpcPanel(' + id + ', null)">Volver</button>'
		+ '<button type="button" class="btn btn-danger ppc-accion" onclick="xPpcAnular(' + id + ')">Si, anular pedido</button></div></div>'
		+ '<div class="ppc-acciones ppc-acciones-main">'
		+ '<button type="button" class="btn btn-outline-danger ppc-accion" onclick="xPpcPanel(' + id + ', \'anular\')">Anular</button>'
		+ (revisar ? '' : '<button type="button" class="btn btn-success ppc-accion ppc-btn-ok" onclick="xPpcClickConfirmar(' + id + ')">'
			+ '<i class="fa fa-check"></i> ' + (st.exigePago ? 'Cobrar y confirmar' : 'Confirmar pedido') + '</button>')
		+ '</div>'
		+ '</div>';
}

// p_body = { tipoconsumo: [ { descripcion, titulo, secciones: [ { des, items: [ {des, cantidad_seleccionada, precio_print, subitems_view, indicaciones} ] } ] } ] }
// Agrupado como el detalle de la mesa: canal de consumo > seccion > items.
function xPpcHtmlItems(pBody) {
	var out = '';
	var tcs = pBody && Array.isArray(pBody.tipoconsumo) ? pBody.tipoconsumo : [];
	tcs.forEach(function (tc) {
		var secs = '';
		(Array.isArray(tc.secciones) ? tc.secciones : []).forEach(function (sec) {
			var items = (Array.isArray(sec.items) ? sec.items : []).map(xPpcHtmlItem).join('');
			if (items) { secs += '<li class="ppc-sec">' + xPpcEsc(sec.des || '') + '</li>' + items; }
		});
		if (secs) { out += '<li class="ppc-tc">' + xPpcEsc(tc.descripcion || tc.titulo || '') + '</li>' + secs; }
	});
	return out ? '<ul class="ppc-items">' + out + '</ul>' : '<p class="ppc-sub">Sin detalle de productos.</p>';
}

function xPpcHtmlItem(it) {
	var cant = it.cantidad_seleccionada || it.cantidad || 1;
	var precio = it.precio_print || it.precio_total || '';
	var subs = Array.isArray(it.subitems_view) ? it.subitems_view.map(function (s) { return xPpcEsc(s && s.des ? s.des : ''); })
		.filter(function (s) { return s; }).join(', ') : '';
	return '<li><span class="ppc-cant">' + xPpcEsc(String(cant).padStart(2, '0')) + '</span><span class="ppc-des">' + xPpcEsc(it.des || '')
		+ (subs ? '<span class="ppc-sub">' + subs + '</span>' : '')
		+ (it.indicaciones ? '<span class="ppc-sub">Nota: ' + xPpcEsc(it.indicaciones) + '</span>' : '')
		+ '</span>' + (precio !== '' ? '<span class="ppc-precio">' + xPpcMoneda(precio) + '</span>' : '')
		+ '</li>';
}

function xPpcHtmlPago() {
	var fila = function (n) {
		return '<div class="ppc-fila-pago"><select class="ppc-ctrl ppc-tp" data-n="' + n + '">' + xPpcOpcionesPago(n) + '</select>'
			+ '<input class="ppc-ctrl ppc-monto" data-n="' + n + '" type="number" min="0" step="0.10" placeholder="0.00"></div>';
	};
	return '<label class="ppc-lbl">Forma de pago (hasta 2)</label>' + fila(0) + fila(1)
		+ '<div class="ppc-acciones"><button type="button" class="btn btn-light" onclick="xPpcPanel(this.closest(\'.ppc-card\').getAttribute(\'data-id\'), null)">Volver</button></div>';
}

function xPpcOpcionesPago(n) {
	var tps = xPpcEstado().tiposPago || [];
	var ops = n === 0 ? '' : '<option value="">-- ninguna --</option>';
	tps.forEach(function (t) { ops += '<option value="' + parseInt(t.idtipo_pago, 10) + '">' + xPpcEsc(t.nombre) + '</option>'; });
	if (!tps.length && n === 0) { ops = '<option value="1">Efectivo</option>'; }
	return ops;
}

// Mismas formas de pago que el cobro de caja (log_componentes.php op 602 + metodo_pago_aceptados), sin credito/app/hotel.
function xPpcCargarTiposPago() {
	var st = xPpcEstado();
	if (st.tiposPago) { return; }
	var cocinar = function (lista) {
		var acept = null;
		try { acept = xm_log_get('datos_org_sede')[0].metodo_pago_aceptados || null; } catch (e) { acept = null; }
		var aceptados = acept ? String(acept).split(',').map(function (x) { return parseInt(x, 10); }) : null;
		st.tiposPago = (lista || []).filter(function (t) {
			var id = parseInt(t.idtipo_pago, 10);
			if (id === 3 || id === 4 || id === 17 || String(t.requiere_cliente) === '1') { return false; }
			return aceptados ? aceptados.indexOf(id) > -1 : String(t.visible) !== '1';
		}).map(function (t) {
			var d = String(t.descripcion || '').toLowerCase();
			return { idtipo_pago: t.idtipo_pago, nombre: d.charAt(0).toUpperCase() + d.slice(1) };
		});
		var sels = document.querySelectorAll('#ppc-dlg .ppc-tp');
		for (var i = 0; i < sels.length; i++) {
			var n = parseInt(sels[i].getAttribute('data-n'), 10);
			sels[i].innerHTML = xPpcOpcionesPago(n);
		}
	};
	var cache = null;
	try { cache = JSON.parse(localStorage.getItem('::app3_comp_tpp_all') || 'null'); } catch (e) { cache = null; }
	if (Array.isArray(cache) && cache.length) { cocinar(cache); return; }
	$.ajax({ type: 'GET', url: '../../bdphp/log_componentes.php?op=602', dataType: 'text' })
		.done(function (t) { try { cocinar(JSON.parse(t).datos); } catch (e) { cocinar([]); } })
		.fail(function () { cocinar([]); });
}

function xPpcCard(id) {
	return document.querySelector('#ppc-dlg .ppc-card[data-id="' + parseInt(id, 10) + '"]');
}

function xPpcPanel(id, cual) {
	var card = xPpcCard(id);
	if (!card) { return; }
	var panels = card.querySelectorAll('.ppc-panel');
	for (var i = 0; i < panels.length; i++) {
		panels[i].classList.toggle('ppc-oculto', panels[i].getAttribute('data-panel') !== cual);
	}
	card.querySelector('.ppc-acciones-main').classList.toggle('ppc-oculto', cual === 'anular');
	xPpcMsg(card, '');
}

function xPpcMotivoCambio(id) {
	var card = xPpcCard(id);
	if (!card) { return; }
	var otro = card.querySelector('.ppc-motivo').value === 'Otro';
	card.querySelector('.ppc-motivo-otro').classList.toggle('ppc-oculto', !otro);
}

function xPpcMsg(card, texto, ok) {
	var m = card.querySelector('.ppc-msg');
	m.textContent = texto || '';
	m.classList.toggle('ppc-ok', !!ok);
}

function xPpcBloquear(card, si) {
	var st = xPpcEstado();
	var id = card.getAttribute('data-id');
	if (si) { st.enVuelo[id] = true; } else { delete st.enVuelo[id]; }
	var bs = card.querySelectorAll('.ppc-accion');
	for (var i = 0; i < bs.length; i++) { bs[i].disabled = !!si; }
}

function xPpcPedido(id) {
	var l = xPpcEstado().lista;
	for (var i = 0; i < l.length; i++) { if (parseInt(l[i].id, 10) === parseInt(id, 10)) { return l[i]; } }
	return null;
}

function xPpcClickConfirmar(id) {
	var st = xPpcEstado();
	var card = xPpcCard(id);
	if (!card || st.enVuelo[String(id)]) { return; }
	if (!st.exigePago) { xPpcConfirmar(id, null); return; }
	var panel = card.querySelector('.ppc-panel[data-panel="pago"]');
	if (panel.classList.contains('ppc-oculto')) { // primer clic: mostrar el cobro con el total sugerido
		xPpcPanel(id, 'pago');
		var p = xPpcPedido(id);
		var m0 = card.querySelector('.ppc-monto[data-n="0"]');
		if (p && m0 && !m0.value) { m0.value = xPpcMoneda(p.total); }
		return;
	}
	var pagos = xPpcLeerPagos(card, xPpcPedido(id));
	if (pagos.error) { xPpcMsg(card, pagos.error); return; }
	xPpcConfirmar(id, pagos.data);
}

// Mismo formato que app-forma-pago del mozo: amount = lo ingresado, amount_real = lo que se aplica (efectivo da vuelto).
function xPpcLeerPagos(card, pedido) {
	var total = Math.round((parseFloat(pedido ? pedido.total : 0) || 0) * 100) / 100;
	var filas = [];
	for (var n = 0; n < 2; n++) {
		var sel = card.querySelector('.ppc-tp[data-n="' + n + '"]');
		var inp = card.querySelector('.ppc-monto[data-n="' + n + '"]');
		var idtp = parseInt(sel && sel.value, 10) || 0;
		var monto = Math.round((parseFloat(inp && inp.value) || 0) * 100) / 100;
		if (!idtp || monto <= 0) { continue; }
		if (filas.length && filas[0].id === idtp) { return { error: 'Elija dos formas de pago distintas.' }; }
		filas.push({ id: idtp, name: sel.options[sel.selectedIndex].text, amount: monto, amount_real: monto, isActive: true });
	}
	if (!filas.length) { return { error: 'Ingrese la forma de pago y el importe.' }; }
	var digital = filas.filter(function (f) { return f.id !== 1; }).reduce(function (a, f) { return a + f.amount; }, 0);
	var suma = filas.reduce(function (a, f) { return a + f.amount; }, 0);
	if (digital > total + 0.001) { return { error: 'Tarjeta / Yape / otros no pueden pasar del total (S/. ' + xPpcMoneda(total) + ').' }; }
	if (suma + 0.001 < total) { return { error: 'Falta cobrar S/. ' + xPpcMoneda(total - suma) + '.' }; }
	filas.forEach(function (f) { if (f.id === 1) { f.amount_real = Math.round((total - digital) * 100) / 100; } });
	return { data: { methods: filas, isPaymentSuccess: true } };
}

function xPpcConfirmar(id, pagos) {
	var card = xPpcCard(id);
	if (!card) { return; }
	xPpcBloquear(card, true);
	xPpcMsg(card, 'Confirmando...', true);
	var body = { id: parseInt(id, 10) };
	if (pagos) { body.pagos = pagos; }
	xPpcPost('confirmar', body).then(function (r) {
		xPpcBloquear(card, false);
		if (!r.success) { xPpcMsg(card, r.error || 'No se pudo confirmar.'); xPpcRefrescarSinPerder(); return; }
		xPpcQuitar(id);
		var aviso = r.data && r.data.aviso;
		if (typeof showToastSwal === 'function') { showToastSwal(aviso ? 'warning' : 'success', aviso || 'Pedido confirmado y enviado a preparación'); }
	});
}

function xPpcAnular(id) {
	var card = xPpcCard(id);
	if (!card || xPpcEstado().enVuelo[String(id)]) { return; }
	var motivo = card.querySelector('.ppc-motivo').value || '';
	if (!motivo) { xPpcMsg(card, 'Elija el motivo de la anulacion.'); return; }
	if (motivo === 'Otro') { motivo = card.querySelector('.ppc-motivo-otro').value.trim(); }
	if (motivo.length < 3) { xPpcMsg(card, 'Escriba el motivo (minimo 3 letras).'); return; }
	xPpcBloquear(card, true);
	xPpcMsg(card, 'Anulando...', true);
	xPpcPost('anular', { id: parseInt(id, 10), motivo: motivo }).then(function (r) {
		xPpcBloquear(card, false);
		if (!r.success) { xPpcMsg(card, r.error || 'No se pudo anular.'); xPpcRefrescarSinPerder(); return; }
		xPpcQuitar(id);
		if (typeof showToastSwal === 'function') { showToastSwal('success', 'Pedido anulado'); }
	});
}

// Tras un error (p.ej. 409 ya atendido por otro) se refresca la lista; la tarjeta con el mensaje queda si sigue pendiente.
function xPpcRefrescarSinPerder() {
	setTimeout(xPpcRefrescar, 1500);
}

function xPpcQuitar(id) {
	var st = xPpcEstado();
	st.lista = st.lista.filter(function (p) { return parseInt(p.id, 10) !== parseInt(id, 10); });
	var card = xPpcCard(id);
	if (card && card.parentNode) { card.parentNode.removeChild(card); }
	xPpcPintarTodo();
}

// ---------- detalle de la mesa: en los pedidos de la carta QR muestra quien los confirmo ----------
// La pagina lo llama despues de pintar #tb_pedidos. Solo filas de cliente (icono del celular).
function xPpcMarcarConfirmados() {
	var filas = document.querySelectorAll('#tb_pedidos tr.check_item_p');
	var ids = [];
	for (var i = 0; i < filas.length; i++) {
		if (filas[i].querySelector('.fa-mobile')) { ids.push(parseInt(filas[i].getAttribute('data-idpedido'), 10)); }
	}
	if (!ids.length) { return; }
	xPpcPost('confirmados', { ids: ids }).then(function (r) {
		if (!r.success || !Array.isArray(r.data)) { return; }
		r.data.forEach(function (c) {
			var tr = document.querySelector('#tb_pedidos tr.check_item_p[data-idpedido="' + parseInt(c.idpedido, 10) + '"]');
			var celda = tr ? tr.querySelector('.fa-mobile') : null;
			if (!celda || !celda.parentNode || celda.parentNode.querySelector('.ppc-confirmo')) { return; }
			var quien = c.usuario ? c.usuario.charAt(0).toUpperCase() + c.usuario.slice(1).toLowerCase() : 'Usuario';
			var donde = c.origen === 'MOZO' ? 'mozo' : c.origen === 'CAJA' ? 'caja' : '';
			var span = document.createElement('span');
			span.className = 'ppc-confirmo';
			span.style.cssText = 'display:block;font-size:11px;line-height:1.2;color:#6c757d;white-space:normal;'; // inline: tambien sin el flag activo
			span.textContent = 'Confirmó: ' + quien + (donde ? ' (' + donde + ')' : '');
			celda.parentNode.title = 'Pedido de la carta QR confirmado por ' + quien + (donde ? ' desde ' + donde : '');
			celda.parentNode.appendChild(span);
		});
	});
}

// ---------- utilidades ----------
function xPpcEsc(s) {
	return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
	});
}

function xPpcMoneda(n) {
	var v = parseFloat(n);
	return isNaN(v) ? '0.00' : v.toFixed(2);
}

// Colores de docs/design.md: --ui-warning #f59e0b, --ui-bg-warning #fff7ed, cabecera lavenderblush.
function xPpcInyectarCss() {
	if (document.getElementById('ppc-css')) { return; }
	var css = document.createElement('style');
	css.id = 'ppc-css';
	css.textContent = ''
		// opcion en la cabecera (misma forma que xBoton2 Por Estado / Por Numero)
		// misma caja gris y pestaña que x-comp-area-mesa (.content-areas / .area)
		+ '.ppc-fila-areas:not([hidden]){display:flex;align-items:flex-start;flex-wrap:wrap;gap:8px;}'
		+ '.ppc-filtro-box{display:inline-block;padding:7px;background:#cbcbcb;border-radius:8px;cursor:pointer;user-select:none;}'
		+ '.ppc-filtro{border:1px solid #bdbdbd;border-radius:5px;padding:4px 10px;background:#fff;font-weight:600;color:#7f7f7f;white-space:nowrap;}'
		+ '.ppc-filtro-n{position:relative;top:-0.1em;background:#dc3545;color:#fff;}'
		+ '.ppc-filtro-box.ppc-hay .ppc-filtro{background:#fff7ed;border-color:#f59e0b;color:#b45309;}'
		+ '.ppc-filtro-box.ppc-on .ppc-filtro{background:#f59e0b;border-color:#f59e0b;color:#fff;}'
		// tarjeta de mesa
		+ '.xMiCardPedido.ppc-mesa{position:relative;}'
		+ '.xMiCardPedido.ppc-libre{background:#fff7ed !important;border:2px dashed #f59e0b !important;animation:ppcPulso 2s ease-in-out infinite;}'
		+ '.xMiCardPedido.ppc-libre .numero{color:#b45309;}'
		+ '.xMiCardPedido.ppc-libre .tipo,.xMiCardPedido.ppc-libre .tiempo{color:#92400e !important;}'
		+ '.xMiCardPedido.ppc-libre .importe{color:#92400e;}'
		+ '.xMiCardPedido.ppc-ocupada{box-shadow:0 0 0 3px #f59e0b;}'
		+ '.xMiCardPedido.ppc-revisar.ppc-libre{border-color:#dc3545 !important;background:#fff1f2 !important;}'
		+ '.ppc-cinta{display:block;background:#f59e0b;color:#fff;font-size:10px;font-weight:600;line-height:18px;border-radius:4px;'
		+ 'padding:0 6px;margin:-4px -4px 6px;text-transform:uppercase;letter-spacing:.3px;white-space:nowrap;cursor:pointer;}'
		+ '.ppc-revisar .ppc-cinta{background:#dc3545;}'
		+ '.otroCard .ppc-cinta{grid-column:1 / -1;}'
		+ '@keyframes ppcPulso{0%,100%{box-shadow:0 0 0 0 rgba(245,158,11,.45);}50%{box-shadow:0 0 0 6px rgba(245,158,11,0);}}'
		// dialogo
		+ '.ppc-overlay{position:fixed;inset:0;z-index:1040;background:rgba(0,0,0,.35);display:none;align-items:center;justify-content:center;padding:16px;}'
		+ '.ppc-box{display:block;width:480px;max-width:100%;max-height:92vh;overflow:hidden;background:#fff;border:1px solid #cdcdcd;border-radius:10px;box-shadow:0 8px 24px rgba(16,24,40,.18);}'
		+ '.ppc-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;background:#fff0f5;border-bottom:1px solid #dddddd;padding:14px 16px;}'
		+ '.ppc-x{border:0;background:transparent;font-size:24px;line-height:1;color:#6c757d;cursor:pointer;padding:0 4px;}'
		+ '.ppc-body{max-height:75vh;overflow-y:auto;padding:12px 16px;}'
		+ '.ppc-card{display:block;padding:4px 0 12px;}'
		+ '.ppc-card + .ppc-card{border-top:1px solid #dddddd;padding-top:14px;}'
		+ '.ppc-card-top{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;}'
		+ '.ppc-chip{display:inline-block;font-size:11px;font-weight:600;color:#92400e;background:#fff7ed;border:1px solid #fde68a;border-radius:999px;padding:1px 8px;}'
		+ '.ppc-cliente{font-size:12px;color:#6c757d;margin-left:6px;}'
		+ '.ppc-total{font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;color:#212529;}'
		+ '.ppc-items{list-style:none;margin:10px 0;padding:0;border:1px solid #dddddd;border-radius:8px;background:#f8fafc;}'
		+ '.ppc-items li{display:flex;gap:8px;align-items:baseline;padding:7px 10px;font-size:13px;}'
		+ '.ppc-items li + li{border-top:1px solid #edf0f2;}'
		+ '.ppc-items li.ppc-tc{display:block;background:#ededed;font-size:12px;font-weight:600;text-transform:uppercase;color:#333;padding:7px 10px;}'
		+ '.ppc-items li.ppc-sec{display:block;background:#fff;font-size:11px;font-weight:600;text-transform:uppercase;color:#555;padding:6px 10px;}'
		+ '.ppc-items li:first-child{border-radius:8px 8px 0 0;}'
		+ '.ppc-cant{min-width:22px;font-weight:600;}'
		+ '.ppc-des{flex:1 1 auto;}'
		+ '.ppc-sub{display:block;font-size:11px;color:#6c757d;}'
		+ '.ppc-precio{font-variant-numeric:tabular-nums;color:#495057;}'
		+ '.ppc-aviso{font-size:12px;color:#991b1b;background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;padding:6px 8px;margin:6px 0;}'
		+ '.ppc-msg{color:#dc3545;font-size:12px;margin:4px 0;}'
		+ '.ppc-msg.ppc-ok{color:#6c757d;}'
		+ '.ppc-msg:empty{display:none;}'
		+ '.ppc-lbl{display:block;font-size:11px;font-weight:600;text-transform:uppercase;color:#6c757d;margin:8px 0 4px;}'
		+ '.ppc-ctrl{box-sizing:border-box;height:34px;border:1px solid #cdcdcd;border-radius:6px;padding:0 8px;font-size:13px;background:#fff;}'
		+ '.ppc-motivo,.ppc-motivo-otro{width:100%;margin-bottom:6px;}'
		+ '.ppc-fila-pago{display:flex;gap:8px;margin-bottom:6px;}'
		+ '.ppc-fila-pago .ppc-tp{flex:1 1 auto;}'
		+ '.ppc-fila-pago .ppc-monto{width:110px;text-align:right;}'
		+ '.ppc-acciones{display:flex;justify-content:flex-end;gap:8px;margin-top:10px;}'
		+ '.ppc-acciones-main .ppc-btn-ok{flex:1 1 auto;}'
		+ '.ppc-oculto{display:none !important;}';
	document.head.appendChild(css);
}
