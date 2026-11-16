// Cobros de meseros: muestra u oculta la opcion "COBROS DE MESEROS" del menu lateral de Control de Pedidos.
// Solo aparece si hay cobros hechos por mozos (pedido por confirmar, origen MOZO + pagado) pendientes de
// rendir, o rendidos hoy, en la sede de la sesion. Si solo caja confirmo pagos, no aparece.
// Servidor: bdphp/log_cobros_meseros.php?op=hay. Pagina: app/page/x-cobros-meseros.html (ruta /cobros_meseros).
// REGLA (incidente 2026-10-06): aqui NO se ejecuta nada en nivel superior. Solo declaraciones de funcion.
// m_control_pedidos.js llama xCmIniciar() cuando la sesion ya esta verificada.

function xCmEstado() {
	if (!window.__xCm) {
		window.__xCm = { iniciado: false, timer: null, consultando: false, espera: null };
	}
	return window.__xCm;
}

function xCmIniciar() {
	var st = xCmEstado();
	if (st.iniciado) { xCmRevisar(); return; }
	st.iniciado = true;
	xCmRevisar();
	st.timer = setInterval(function () { xCmAsegurarSocket(); xCmRevisar(); }, 60000);
	setTimeout(xCmAsegurarSocket, 3000); // el socket lo abre otra pagina (x-control-mesas); puede tardar
}

function xCmPost(op, body) {
	return new Promise(function (resolve) {
		$.ajax({ type: 'POST', url: '../../bdphp/log_cobros_meseros.php?op=' + op, data: JSON.stringify(body || {}),
			contentType: 'application/json', dataType: 'json', timeout: 30000 })
		.done(function (r) { resolve(r && typeof r === 'object' ? r : { success: false, error: 'Respuesta no valida del servidor.' }); })
		.fail(function (x) {
			resolve({ success: false, error: x && x.status === 401 ? 'Tu sesion expiro, vuelve a entrar.' : 'No hay conexion con el servidor. Intenta de nuevo.' });
		});
	});
}

// Consulta 'hay' y pinta la opcion del menu. Si falla, deja el menu como estaba.
function xCmRevisar() {
	var st = xCmEstado();
	if (st.consultando) { return; }
	st.consultando = true;
	xCmPost('hay', {}).then(function (r) {
		st.consultando = false;
		if (!r || !r.success || !r.data) { return; }
		xCmPintarMenu(r.data.mostrar === true, parseInt(r.data.pendientes, 10) || 0);
		// Ningun usuario de la sede tiene "App Mesero caja" y no hay nada que mostrar: no seguir preguntando cada minuto.
		// El aviso por socket (xCmOnCambio) sigue activo. Si activan el permiso, aplica al volver a abrir la pagina.
		if (r.data.cobradores === false && r.data.mostrar !== true && st.timer) {
			clearInterval(st.timer);
			st.timer = null;
		}
	});
}

function xCmPintarMenu(mostrar, pendientes) {
	var li = document.getElementById('li_cobros_meseros');
	if (!li) { return; }
	li.style.display = mostrar ? '' : 'none';
	var badge = document.getElementById('cm_badge_pendientes');
	if (badge) {
		badge.textContent = pendientes > 99 ? '99+' : String(pendientes);
		badge.style.display = pendientes > 0 ? '' : 'none';
	}
}

// Respaldo en vivo: cuando un mozo confirma/cobra un pedido QR llega 'pedido-por-confirmar-cambio'.
// Usa el socket que ya abre socket.master.service.js; se marca el socket para no escuchar dos veces.
function xCmAsegurarSocket() {
	try {
		if (typeof socketService === 'undefined') { return; }
		var svc = socketService.getInstance();
		var sk = svc && svc._socket;
		if (!sk || sk.__xCmOn || typeof svc._listen !== 'function') { return; }
		sk.__xCmOn = true;
		svc._listen('pedido-por-confirmar-cambio', xCmOnCambio);
	} catch (e) { /* sin socket: queda el refresco cada 60 s */ }
}

function xCmOnCambio() {
	var st = xCmEstado();
	clearTimeout(st.espera);
	// pequeña espera: el pago se graba en el mismo paso y varios cambios seguidos se juntan en una consulta
	st.espera = setTimeout(function () {
		xCmRevisar();
		if (typeof xCmpRefrescarSiVisible === 'function') { xCmpRefrescarSiVisible(); }
	}, 1500);
}
