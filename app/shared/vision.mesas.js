// Camaras IA (papaya-vision, F2) sobre las tarjetas de mesa de Control de pedidos (app/page/x-control-mesas.html)
// y Anfitrion (app/page/x-anfitrion.html): lo que ve la camara ("Ocupada · 12 min") y las alertas (insignia que
// titila si el aviso es para caja; en Control de pedidos, "Ya lo vi" y "Silenciar esta mesa", decision D1).
// No pinta el pedido (F2-R43): la tarjeta ya lo muestra.
// Plan: docs/superpowers/plans/2026-10-19-vision-mesas-f2-estado-en-vivo.md (Task 21). Servidor: bdphp/log_vision.php
// (op estado / silenciar / resolver, proxy al servidor Go /interno/v1). Textos: app/camaras/js/estado-mesas.js (import()).
//
// REGLA (incidente 2026-10-06): en el nivel superior SOLO esta declaracion de funcion. Sin llamadas sueltas ni
// var/const/let globales: la pagina llama xVisionMesasIniciar(...) al montarse.
// Son pantallas de cobro: todo va en try/catch y es async; si algo falla, un console.warn y nada mas. Si la
// organizacion no tiene camaras_ia o la sede esta en "Solo medir" (D4): un op=estado y nada mas (sin import(),
// sin oyentes, sin tocar la pantalla).
// Maqueta 3D del salon (app/maqueta/js/vivo.js, spec 2026-10-31-maqueta-salon-3d §5.3): al iniciarse define
// window.VisionMesas {estadoDe, alCambiar, resolver, silenciar}, que lee lo ya cargado (nada se pide de nuevo) y usa
// los mismos botones de la linea de la tarjeta. Sin camaras_ia o en "Solo medir", estadoDe da null.

/**
 * Arranca el modulo en la pagina. opciones:
 *  - pantalla: 'control' (Control de pedidos, #_gridCM .xMiCardPedido) | 'anfitrion' (#anf_grid .anf-mesa[data-mesa])
 *  - escuchar: function (evento, fn), registra fn en el socket de la sede (socketService.getInstance()._listen)
 *  - socket (opcional): function () que devuelve el socket actual; sirve para no escuchar dos veces el mismo y
 *    para volver a engancharse si la pagina lo rehace (Control de pedidos lo rehace a los 2 s, _cpSocketOpen).
 * Devuelve una Promise<boolean> (true si quedo pintando). Nunca lanza ni rechaza.
 */
function xVisionMesasIniciar(opciones) {
	var CONF = {
		control: { grid: '_gridCM', tarjeta: '.xMiCardPedido', botones: true, aviso: true },
		anfitrion: { grid: 'anf_grid', tarjeta: '.anf-mesa[data-mesa]', botones: false, aviso: false }
	};
	var EVENTOS = [['vision-mesas-estado', 'estado'], ['vision-alerta', 'alerta'], ['vision-alerta-resuelta', 'resuelta'], ['connect', 'conexion']];
	var TEXTO_ERROR = {
		alerta_resuelta: 'Esta alerta ya estaba cerrada.',
		sesion_cerrada: 'La mesa ya se vació: no hace falta silenciarla.',
		no_encontrado: 'Esta mesa ya cambió. Mira cómo está ahora.'
	};
	var GENERICO = 'Algo salió mal. Vuelve a intentar.';
	var IGNORAR = ['.tiempo', '.importe', '.ppc-cinta', '.vmp-cam'];   // mutaciones de la pagina que no despiertan al observador
	var ESTADOS = ['libre', 'ocupada', 'por_limpiar', 'limpiando', 'sin_info'];   // Camara.estado de la maqueta
	var ALERTAS = ['sin_atencion', 'cuenta_abierta', 'por_limpiar'];             // Camara.alerta de la maqueta
	var o = opciones && typeof opciones === 'object' ? opciones : {};
	var conf = typeof o.pantalla === 'string' && Object.prototype.hasOwnProperty.call(CONF, o.pantalla) ? CONF[o.pantalla] : null;
	var st = null;
	var gen = 0;
	var avisado = false;

	/* ---------- utilidades ---------- */

	// Una sola vez por montaje: nunca un aviso por cada evento que falle.
	function avisar(e) {
		if (avisado) { return; }
		avisado = true;
		try {
			if (typeof console !== 'undefined' && console && typeof console.warn === 'function') {
				console.warn('[camaras-ia] ' + (e && e.message ? e.message : String(e)));
			}
		} catch (e2) { /* sin consola */ }
	}
	function seguro(fn) {
		return function () {
			try { return fn.apply(this, arguments); } catch (e) { avisar(e); return undefined; }
		};
	}
	function vigente() { return !!st && st.gen === gen; }
	function grid() {
		var g = document.getElementById(conf.grid);
		return g && document.body && document.body.contains(g) ? g : null;
	}
	// El codigo de la tarjeta como lo pinta la pagina (igual que pedido.por.confirmar.js en Control de pedidos).
	// Sin codigo (sin linea de camara): las reservas (.otroCard.tpc99; solo tpc99 no basta, es tpc+id del tipo de
	// consumo LOCAL en las tarjetas de mesa) y "Mesa Pago App" (data-isconfirmarpago="1"), x-control-mesas.html (M7).
	function codigoDe(card) {
		if (st.pantalla === 'anfitrion') { return card.getAttribute('data-mesa') || ''; }
		if (card.getAttribute('data-isconfirmarpago') === '1'
			|| (card.classList.contains('otroCard') && card.classList.contains('tpc99'))) { return ''; }
		var num = card.querySelector('.numero');
		return card.getAttribute('data-codigo-mesa') || (num ? String(num.textContent).trim() : '')
			|| card.getAttribute('data-nummesa') || '';
	}

	/** POST JSON a log_vision.php (relativo a la pagina, app/page/m_panel.html). Resuelve siempre {success, data, error}. */
	function pedir(op, cuerpo) {
		return new Promise(function (resolve) {
			var corte = null;
			var fin = function (r) { if (corte) { clearTimeout(corte); } resolve(r); };
			try {
				var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
				if (ctrl) { corte = setTimeout(function () { ctrl.abort(); }, 15000); }
				fetch('../../bdphp/log_vision.php?op=' + op, {
					method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(cuerpo || {}), signal: ctrl ? ctrl.signal : undefined
				}).then(function (res) { return res.text(); }).then(function (txt) {
					var j = null;
					try { j = JSON.parse(txt); } catch (e) { j = null; }   // HTML de un error de PHP
					fin(j && typeof j === 'object' ? j : { success: false, error: 'respuesta_invalida' });
				}, function () { fin({ success: false, error: 'sin_conexion' }); });
			} catch (e) { fin({ success: false, error: 'sin_conexion' }); }
		});
	}

	/* ---------- pintado ---------- */

	function css() {
		if (document.getElementById('vmp-css')) { return; }
		var s = document.createElement('style');
		s.id = 'vmp-css';
		s.textContent = ''
			+ '.vmp-cam{display:block;margin:6px 0 0;padding:2px 4px;border-radius:4px;font-size:10px;line-height:14px;font-weight:600;'
			+ 'text-align:center;white-space:normal;overflow-wrap:anywhere;cursor:default;}'
			+ '.vmp-cam .fa{margin-right:3px;}'
			+ '.xMiCardPedido.otroCard .vmp-cam{grid-column:1 / -1;}'
			+ '.vmp-cam.vm-libre{background:#e8f5e9;color:#1b5e20;}'
			+ '.vmp-cam.vm-ocupada{background:#fff3e0;color:#8d4a00;}'
			+ '.vmp-cam.vm-sininfo{background:#eceff1;color:#546e7a;}'
			+ '.vmp-cam.vm-alerta{background:#c62828;color:#fff;}'
			+ '.vmp-cam.vmp-titila{box-shadow:0 0 0 2px #ffcdd2;}'
			+ '.vmp-titila .vmp-txt,.vmp-titila .fa{animation:vmpTitila 1s ease-in-out infinite;}'
			+ '@keyframes vmpTitila{50%{opacity:.25;}}'
			+ '@media (prefers-reduced-motion:reduce){.vmp-titila .vmp-txt,.vmp-titila .fa{animation:none;}}'
			+ '.vmp-acc{display:flex;flex-wrap:wrap;gap:3px;margin-top:3px;}'
			+ '.vmp-btn{flex:1 1 auto;min-height:24px;border:0;border-radius:4px;background:#fff;color:#c62828;font-size:10px;'
			+ 'font-weight:700;line-height:12px;padding:3px 4px;cursor:pointer;}'
			// aviso propio cuando PNotify no esta cargado (I-2)
			+ '.vmp-avisos{position:fixed;right:16px;bottom:16px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;'
			+ 'gap:8px;max-width:calc(100vw - 32px);pointer-events:none;}'
			+ '.vmp-aviso{pointer-events:auto;width:320px;max-width:100%;box-sizing:border-box;padding:10px 12px;border-radius:6px;'
			+ 'background:#263238;color:#fff;font-size:13px;line-height:18px;box-shadow:0 2px 8px rgba(0,0,0,.3);cursor:pointer;overflow-wrap:anywhere;}'
			+ '.vmp-aviso.vmp-aviso-alerta{background:#c62828;}';
		document.head.appendChild(s);
	}
	function boton(accion, texto) {
		var b = document.createElement('button');
		b.setAttribute('type', 'button');
		b.className = 'vmp-btn';
		b.setAttribute('data-vmp-acc', accion);
		b.textContent = texto;
		return b;
	}
	/**
	 * Que cambia en la linea de la camara de una tarjeta, sin tocar la pagina: null si nada; si no,
	 * {card, vieja, caja (null = quitarla), botones}. Todo texto va con textContent (F2-R20).
	 */
	function plan(card, codigo, m) {
		var vieja = card.querySelector('.vmp-cam');
		if (!m) { return vieja ? { card: card, vieja: vieja, caja: null, botones: 0 } : null; }
		var id = m.alertaId === null || m.alertaId === undefined ? '' : String(m.alertaId);
		var titila = id !== '' && st.avisadas[id] === true;
		var botones = conf.botones && id !== '';
		var silenciar = botones && m.alertaTipo === 'sin_atencion';   // cuenta_abierta: la sesion ya se cerro
		var firma = [m.texto, m.clase, id, titila ? 1 : 0, silenciar ? 2 : (botones ? 1 : 0), codigo].join('|');
		if (vieja && vieja.getAttribute('data-vmp') === firma) { return null; }   // igual: no se toca (sin bucles con el observador)
		var caja = document.createElement('div');
		caja.className = 'vmp-cam ' + m.clase + (titila ? ' vmp-titila' : '');
		caja.setAttribute('data-vmp', firma);
		caja.setAttribute('data-vmp-alerta', id);
		caja.setAttribute('data-vmp-mesa', codigo);
		caja.setAttribute('title', id ? 'Aviso de las cámaras para esta mesa' : 'Lo que ve la cámara en esta mesa');
		var ico = document.createElement('i');
		ico.className = 'fa ' + (id ? 'fa-bell' : 'fa-video-camera');
		var txt = document.createElement('span');
		txt.className = 'vmp-txt';
		txt.textContent = m.texto;
		caja.appendChild(ico);
		caja.appendChild(txt);
		if (botones) {
			var acc = document.createElement('div');
			acc.className = 'vmp-acc';
			acc.appendChild(boton('resolver', 'Ya lo vi'));
			if (silenciar) { acc.appendChild(boton('silenciar', 'Silenciar esta mesa')); }
			caja.appendChild(acc);
		}
		return { card: card, vieja: vieja, caja: caja, botones: silenciar ? 2 : (botones ? 1 : 0) };
	}
	function relayout() {
		try {
			if (typeof $ === 'undefined' || !$.fn || !$.fn.isotope) { return; }
			var $g = $('#' + conf.grid);
			if ($g.data('isotope')) { $g.isotope('layout'); }   // la tarjeta crecio una linea
		} catch (e) { /* grilla aun sin isotope */ }
	}
	function pintar() {
		var g = grid();
		if (!g || !st.mod || !st.datos) { return; }
		var cards = g.querySelectorAll(conf.tarjeta);
		var codigos = [];
		for (var i = 0; i < cards.length; i++) { codigos.push(codigoDe(cards[i])); }
		var mapa = st.mod.marcas(st.datos, codigos.filter(Boolean), Date.now() + st.desfase);
		var planes = [];
		for (var j = 0; j < cards.length; j++) {
			var p = plan(cards[j], codigos[j], codigos[j] ? mapa.get(codigos[j]) : null);
			if (p) { planes.push(p); }
		}
		if (!planes.length) { return; }
		// Si solo cambia el texto (mismos botones), se compara el alto: se lee todo antes y todo despues de escribir,
		// nunca entre escrituras. isotope reacomoda solo si una linea aparecio, se fue o cambio de alto (M3).
		var k;
		for (k = 0; k < planes.length; k++) {
			var pk = planes[k];
			pk.alto = pk.vieja && pk.caja && pk.vieja.querySelectorAll('[data-vmp-acc]').length === pk.botones ? pk.vieja.offsetHeight : null;
		}
		if (st.obs) { st.obs.disconnect(); }   // lo propio no despierta al observador
		try {
			for (k = 0; k < planes.length; k++) {
				if (planes[k].vieja && planes[k].vieja.parentNode) { planes[k].vieja.parentNode.removeChild(planes[k].vieja); }
				if (planes[k].caja) { planes[k].card.appendChild(planes[k].caja); }
			}
		} finally {
			if (st.obs) { st.obs.observe(g, { childList: true, subtree: true }); }
		}
		for (k = 0; k < planes.length; k++) {
			if (planes[k].alto === null || planes[k].caja.offsetHeight !== planes[k].alto) { relayout(); return; }
		}
	}
	// Despierta solo si la pagina agrego o quito tarjetas o borro una linea nuestra (Anfitrion rehace el innerHTML de
	// cada tarjeta en cada carga). El reloj de la pagina (.tiempo), el importe y la cinta de pedido por confirmar, no (M3).
	function esTarjetaOLinea(n) {
		if (!n || typeof n.matches !== 'function') { return false; }   // texto
		return n.matches(conf.tarjeta) || n.matches('.vmp-cam') || !!n.querySelector(conf.tarjeta) || !!n.querySelector('.vmp-cam');
	}
	function importa(registros) {
		for (var i = 0; i < registros.length; i++) {
			var r = registros[i];
			var t = r.target;
			var ignorar = false;
			for (var s = 0; t && typeof t.closest === 'function' && s < IGNORAR.length && !ignorar; s++) { ignorar = !!t.closest(IGNORAR[s]); }
			if (ignorar) { continue; }
			var listas = [r.addedNodes || [], r.removedNodes || []];
			for (var l = 0; l < listas.length; l++) {
				for (var n = 0; n < listas[l].length; n++) { if (esTarjetaOLinea(listas[l][n])) { return true; } }
			}
		}
		return false;
	}
	// Se repinta en el mismo callback (microtarea, antes del siguiente frame): la tarjeta nunca se ve sin su linea
	// ni la grilla salta dos veces (I1). pintar() desconecta el observador mientras escribe: no hay bucle.
	function observar() {
		var g = grid();
		if (!g || typeof MutationObserver !== 'function') { return; }
		if (st.obs) { st.obs.disconnect(); }
		st.obs = new MutationObserver(seguro(function (registros) {
			if (vigente() && registros && importa(registros)) { pintar(); }
		}));
		st.obs.observe(g, { childList: true, subtree: true });
	}
	function quitarMarcas() {
		var g = grid();
		var cajas = g ? g.querySelectorAll('.vmp-cam') : [];
		for (var i = 0; i < cajas.length; i++) { if (cajas[i].parentNode) { cajas[i].parentNode.removeChild(cajas[i]); } }
		if (cajas.length) { relayout(); }
	}

	/* ---------- estado, alertas y avisos ---------- */

	function aplicar(d) {
		st.datos = { modo: d.modo, mesas: Array.isArray(d.mesas) ? d.mesas : [] };
		st.desfase = st.mod.desfaseReloj(d.ahora, Date.now());   // F2-R45: el reloj de la PC suele estar mal
		st.ultimaCarga = Date.now();
		cambio();
	}
	function recordar(id) {
		if (Object.keys(st.avisadas).length > 200) { st.avisadas = {}; }
		st.avisadas[id] = true;
	}
	function cerrarAviso(id) {
		var n = st.avisos[id];
		delete st.avisos[id];
		if (n) { try { n.close(); } catch (e) { /* ya cerrado */ } }
	}
	function cerrarAlerta(id) {
		delete st.avisadas[id];
		cerrarAviso(id);
		st.datos = st.mod.sinAlerta(st.datos, id);
		cambio();
	}
	// Pila propia de PNotify (no stackBottomRight): su tope de 5 no cierra los avisos fijos de pago ni de pedido por
	// confirmar (M6). A la izquierda de esa columna (PNotify mide 360 px) para no taparla.
	function pila() {
		if (typeof window.stackVision === 'undefined') {
			window.stackVision = { dir1: 'up', dir2: 'left', firstpos1: 25, firstpos2: 400 };
		}
		return window.stackVision;
	}
	// Respaldo si PNotify no esta cargado (m_panel no lo carga; lo importan Caja, Historial y Pedidos registrados):
	// un aviso fijo abajo a la derecha, solo con textContent; se cierra con un clic o a los 8 s; 3 a la vista (I-2).
	function avisoPropio(texto, tipo) {
		var caja = document.getElementById('vmp-avisos');
		if (!caja) {
			caja = document.createElement('div');
			caja.id = 'vmp-avisos';
			caja.className = 'vmp-avisos';
			document.body.appendChild(caja);
		}
		while (caja.children.length >= 3) { caja.removeChild(caja.children[0]); }
		var a = document.createElement('div');
		a.className = 'vmp-aviso vmp-aviso-' + tipo;
		a.setAttribute('role', 'status');
		a.textContent = texto;
		var cerrar = function () { if (a.parentNode) { a.parentNode.removeChild(a); } };
		a.addEventListener('click', seguro(cerrar));
		setTimeout(seguro(cerrar), 8000);
		caja.appendChild(a);
		return { close: cerrar };
	}
	/** Aviso en texto plano (textTrusted false: el texto llega sin filtrar, F2-R20). tipo: alerta (fija) | success | notice. */
	function mostrar(texto, tipo) {
		if (typeof PNotify !== 'function' || typeof PNotify.notice !== 'function') { return avisoPropio(texto, tipo); }
		var fn = tipo === 'success' && typeof PNotify.success === 'function' ? PNotify.success : PNotify.notice;
		return fn.call(PNotify, tipo === 'alerta'
			? { text: texto, textTrusted: false, hide: false, stack: pila(), modules: { History: { maxInStack: 5 } } }
			: { text: texto, textTrusted: false, delay: 4000, stack: pila() });
	}
	// Aviso en caja, con el sonido de pedido por confirmar (M7): solo al llegar la alerta, nunca al cargar la pagina.
	function notificar(d) {
		var id = String(d.alerta_id);
		cerrarAviso(id);   // el recordatorio reemplaza al primero
		var hora = typeof pTimeNow === 'function' ? pTimeNow() + ' ' : '';
		var texto = typeof d.texto === 'string' && d.texto ? d.texto : 'Aviso de las cámaras';
		try { if (typeof PlaySound === 'function') { PlaySound('notificaLlamadoCliente'); } } catch (e) { /* sin audio en esta pagina */ }
		var n = mostrar(hora + texto, 'alerta');
		st.avisos[id] = n;
		if (n && typeof n.on === 'function') { n.on('click', function () { try { n.close(); } catch (e) { /* ya cerrado */ } }); }
	}
	// vision-mesas-estado: el payload datos tal cual ({mesas}, estado completo de la sede, F2-R7)
	function alEstado(d) {
		if (!grid() || !d || typeof d !== 'object' || !Array.isArray(d.mesas)) { return; }
		st.ultimoEvento = Date.now();   // el Go sigue en "alertar" (en "Solo medir" no emite): no hace falta releer (I-1)
		st.datos = { modo: st.datos ? st.datos.modo : 'alertar', mesas: d.mesas };
		cambio();
		pintar();
	}
	// vision-alerta: el cuerpo completo de la alerta; solo cuenta si es para caja
	function alAlerta(d) {
		if (!grid() || !d || typeof d !== 'object' || d.alerta_id === null || d.alerta_id === undefined) { return; }
		if (!Array.isArray(d.para) || d.para.indexOf('caja') < 0) { return; }
		recordar(String(d.alerta_id));
		st.datos = st.mod.conAlerta(st.datos, d);
		cambio();
		pintar();
		if (conf.aviso) { notificar(d); }
	}
	// vision-alerta-resuelta: {alerta_id, mesa_clave, resuelta_por}
	function alResuelta(d) {
		if (!d || typeof d !== 'object' || d.alerta_id === null || d.alerta_id === undefined) { return; }
		cerrarAlerta(String(d.alerta_id));
		if (grid()) { pintar(); }
	}
	function alEvento(tipo, d) {
		try {
			if (!vigente() || !st.activo) { return; }
			if (tipo === 'estado') { alEstado(d); }
			else if (tipo === 'alerta') { alAlerta(d); }
			else if (tipo === 'resuelta') { alResuelta(d); }
			else if (tipo === 'conexion' && grid() && Date.now() - st.ultimaCarga > 5000) { refrescar(); }   // volvio el internet
		} catch (e) { avisar(e); }
	}
	/** false (y se apaga o se duerme) si op=estado dice que ya no hay que mostrar nada. */
	function sigueAlertando(d) {
		if (d.activo !== true) { desactivar(); return false; }   // se apago camaras_ia
		if (d.modo !== 'alertar') { dormir(); return false; }     // "Solo medir" (D4)
		return true;
	}
	/**
	 * op=estado otra vez (reconexion, error, socket rehecho o 5 min sin noticias). Una a la vez; la hora del intento
	 * cuenta como carga (con el Go caido no se reintenta cada 30 s). Dormido ("Solo medir"), si vuelve "alertar", despierta.
	 */
	function refrescar() {
		if (st.cargando) { return Promise.resolve(null); }
		st.cargando = true;
		st.ultimaCarga = Date.now();
		return pedir('estado', {}).then(function (r) {
			st.cargando = false;
			if (!vigente() || !st.mod || (!st.activo && !st.tick)) { return null; }
			if (!r || r.success !== true || !r.data || typeof r.data !== 'object') { avisar(new Error('op=estado: ' + (r && r.error))); return null; }
			if (!sigueAlertando(r.data)) { return null; }
			if (!st.activo) { despertar(r.data); return r.data; }
			aplicar(r.data);
			pintar();
			return r.data;
		}).catch(function (e) { st.cargando = false; avisar(e); return null; });
	}

	/* ---------- socket ---------- */

	// Los oyentes buscan el montaje vigente en window.__xVisionMesas: sirven aunque la pagina se vuelva a montar.
	function despachador(tipo) {
		return function (d) {
			var s = window.__xVisionMesas;
			if (s && typeof s.alEvento === 'function') { s.alEvento(tipo, d); }
		};
	}
	function engancharSocket() {
		if (!vigente() || !st.activo) { return; }
		var sk = null;
		if (st.socket) {
			try { sk = st.socket(); } catch (e) { sk = null; }   // socketService aun no cargo (async en m_panel)
			if (!sk || typeof sk !== 'object' || sk.__xVisionMesasOn) { return; }
		} else if (st.escuchando) { return; }
		for (var i = 0; i < EVENTOS.length; i++) {
			try { st.escuchar(EVENTOS[i][0], despachador(EVENTOS[i][1])); } catch (e) { return; }   // se reintenta
		}
		if (sk) { sk.__xVisionMesasOn = true; } else { st.escuchando = true; }
		// Socket rehecho (no el del arranque): lo emitido en el hueco se perdio y un socket ya conectado no da 'connect' (M6).
		if (Date.now() - st.ultimaCarga > 5000) { refrescar(); }
	}

	/* ---------- botones (solo Control de pedidos, D1) ---------- */

	// Dialogo del POS (SweetAlert, js/mi.sweet.alert.js); nunca confirm(). titleText y text: SweetAlert los pone como texto.
	function preguntar(titulo, texto, si) {
		var v = { titleText: titulo, text: texto, icon: 'question', showCancelButton: true, confirmButtonText: si, cancelButtonText: 'Cancelar' };
		var ok = function (r) { return !!(r && r.isConfirmed); };
		var no = function () { return false; };
		try {
			if (typeof showAlertSwalHtmlDecision === 'function') { return Promise.resolve(showAlertSwalHtmlDecision(v, 1)).then(ok, no); }
			if (typeof Swal !== 'undefined' && Swal && typeof Swal.fire === 'function') { return Promise.resolve(Swal.fire(v)).then(ok, no); }
		} catch (e) { avisar(e); }
		return Promise.resolve(false);   // sin dialogo no se hace nada
	}
	function resolverAlerta(id) {
		return pedir('resolver', { id: Number(id) }).then(function (r) {
			if (r && r.success === true) { cerrarAlerta(id); pintar(); return { ok: true }; }
			if (r && r.error === 'alerta_resuelta') { cerrarAlerta(id); pintar(); }
			return { ok: false, error: r && r.error };
		});
	}
	// El socket no trae la sesion de la mesa: se lee de nuevo antes de silenciar (y se confirma que sigue abierta).
	function silenciarMesa(id) {
		return pedir('estado', {}).then(function (r) {
			if (r && r.success === true && r.data && !sigueAlertando(r.data)) { return null; }   // como refrescar
			if (!r || r.success !== true || !r.data || !Array.isArray(r.data.mesas)) { return { ok: false, error: r && r.error }; }
			aplicar(r.data);
			var m = null;
			for (var i = 0; i < r.data.mesas.length; i++) {
				var x = r.data.mesas[i];
				if (x && x.alerta && String(x.alerta.id) === String(id)) { m = x; }
			}
			if (!m) { cerrarAlerta(id); pintar(); return { ok: false, error: 'alerta_resuelta' }; }
			if (!st.mod.puedeSilenciar(m)) { pintar(); return { ok: false, error: 'sesion_cerrada' }; }
			return pedir('silenciar', { id: Number(m.sesion_id) }).then(function (s2) {
				if (!s2 || s2.success !== true) { return { ok: false, error: s2 && s2.error }; }
				var ids = s2.data && Array.isArray(s2.data.alertas_resueltas) ? s2.data.alertas_resueltas : [];
				cerrarAlerta(String(id));
				for (var j = 0; j < ids.length; j++) { cerrarAlerta(String(ids[j])); }
				pintar();
				return { ok: true };
			});
		});
	}
	// El resultado va por PNotify (texto plano), nunca por un toast de SweetAlert: SweetAlert tiene un solo popup y el
	// toast cerraria un dialogo que el cajero abrio mientras tanto (M4).
	function resultado(r, listo) {
		if (!r.ok) { refrescar(); }   // la alerta o la sesion ya cambio en el servidor
		if (r.ok) { mostrar(listo, 'success'); return; }
		mostrar(r.error && Object.prototype.hasOwnProperty.call(TEXTO_ERROR, r.error) ? TEXTO_ERROR[r.error] : GENERICO, 'notice');
	}
	function accion(tipo, alertaId, mesa) {
		if (st.enVuelo || !alertaId || (tipo !== 'resolver' && tipo !== 'silenciar')) { return; }
		var resolver = tipo === 'resolver';
		st.enVuelo = true;
		preguntar(
			resolver ? '¿Ya viste la mesa ' + mesa + '?' : '¿Silenciar la mesa ' + mesa + '?',
			resolver ? 'La alerta se cierra y deja de verse en esta mesa.' : 'Las cámaras no avisarán nada más de esta mesa mientras sigan estos clientes.',
			resolver ? 'Sí, ya lo vi' : 'Sí, silenciar'
		).then(function (si) {
			if (!si || !vigente() || !st.activo) { return null; }
			return resolver ? resolverAlerta(alertaId) : silenciarMesa(alertaId);
		}).then(function (r) {
			if (r) { resultado(r, resolver ? 'Listo, la alerta se cerró' : 'Listo, la mesa quedó silenciada'); }
		}).catch(avisar).then(function () { st.enVuelo = false; });
	}
	// Fase de captura en window: corre antes que el click de la tarjeta (abrir la mesa) y que el de pedido por confirmar.
	function alClick(e) {
		try {
			if (!vigente() || !st.activo || !conf.botones || !e || !e.target || typeof e.target.closest !== 'function') { return; }
			var b = e.target.closest('[data-vmp-acc]');
			var caja = b ? b.closest('.vmp-cam') : null;
			var g = grid();
			if (!caja || !g || !g.contains(caja)) { return; }
			e.preventDefault();
			e.stopPropagation();
			if (typeof e.stopImmediatePropagation === 'function') { e.stopImmediatePropagation(); }
			accion(b.getAttribute('data-vmp-acc'), caja.getAttribute('data-vmp-alerta'), caja.getAttribute('data-vmp-mesa'));
		} catch (err) { avisar(err); }
	}
	function escucharClicks() {
		if (!conf.botones || st.clickOn) { return; }
		st.clickOn = true;
		window.addEventListener('click', function (e) {
			var s = window.__xVisionMesas;
			if (s && typeof s.alClick === 'function') { s.alClick(e); }
		}, true);
	}

	/* ---------- lectura para la maqueta 3D (window.VisionMesas) ---------- */

	// La mesa de la tarjeta por la clave de las camaras (claveMesa de mesas-sede.js, como marcas): "05" = "5",
	// "PISO1-05" ≠ "PISO2-05". La maqueta pasa el codigo de la tarjeta tal cual, no su propia clave.
	function mesaDe(codigo) {
		var k = st.claveMesa(codigo);
		for (var i = 0; k && i < st.datos.mesas.length; i++) {
			var m = st.datos.mesas[i];
			if (m && typeof m === 'object' && st.claveMesa(m.mesa_clave || m.mesa) === k) { return m; }
		}
		return null;
	}
	function minutosDesde(iso, ahoraMs) {
		var t = typeof iso === 'string' ? Date.parse(iso) : NaN;
		return isFinite(t) ? Math.max(0, Math.floor((ahoraMs - t) / 60000)) : null;
	}
	// Con la sesion a la vista (op=estado), puedeSilenciar de estado-mesas.js. El socket no la trae: la misma regla que
	// la linea de la tarjeta (sin_atencion); silenciarMesa la relee con op=estado antes de mandar nada.
	function silenciable(m, alerta) {
		if (!alerta || alerta.tipo !== 'sin_atencion') { return false; }
		if (!Object.prototype.hasOwnProperty.call(m, 'sesion_id')) { return true; }
		return st.mod.puedeSilenciar(Object.assign({}, m, { alerta: alerta }));
	}
	/**
	 * El Camara de la maqueta para la mesa m: {estado, alerta, minutos, personas, conPedido, alertaId, puedeSilenciar}.
	 * La alerta sale de marcas, como la linea (op=estado trae alerta {id, tipo}; el socket, alerta_id y alerta_tipo).
	 * minutos desde m.desde con el reloj del servidor (desfase); personas solo si el servidor la manda; conPedido null
	 * si no dice nada de la cuenta (sin puente o el socket).
	 */
	function camara(codigo, m) {
		var ahora = Date.now() + st.desfase;
		var marca = st.mod.marcas({ mesas: [m] }, [codigo], ahora).get(codigo);
		var tipo = marca && ALERTAS.indexOf(marca.alertaTipo) >= 0 ? marca.alertaTipo : null;
		var alerta = tipo ? { id: marca.alertaId, tipo: tipo } : null;
		return {
			estado: ESTADOS.indexOf(m.estado) >= 0 ? m.estado : 'sin_info',
			alerta: tipo,
			minutos: minutosDesde(m.desde, ahora),
			personas: Number.isInteger(m.personas) && m.personas >= 0 ? m.personas : null,
			conPedido: m.cuenta === undefined ? null : m.cuenta !== null,
			alertaId: alerta ? String(alerta.id) : null,
			puedeSilenciar: silenciable(m, alerta)
		};
	}
	/** Camara de la mesa con ese codigo de tarjeta; null sin camaras_ia, en "Solo medir" o si la mesa no tiene camara. */
	function estadoDe(codigo) {
		if (!vigente() || !st.activo || !st.mod || !st.datos || codigo === null || codigo === undefined) { return null; }
		var m = mesaDe(String(codigo));
		return m ? camara(String(codigo), m) : null;
	}
	// Los botones de la maqueta son los de la linea (accion: dialogo del POS, op y aviso); solo en Control (D1).
	function accionMesa(tipo, codigo) {
		var c = conf.botones ? estadoDe(codigo) : null;
		if (!c || !c.alertaId || (tipo === 'silenciar' && !c.puedeSilenciar)) { return; }
		accion(tipo, c.alertaId, String(codigo));
	}
	// Cada cambio del estado (carga, socket, alerta cerrada, "Solo medir"). Un oyente que falla no corta a los demas.
	function cambio() {
		var fns = st.cambios.slice();
		for (var i = 0; i < fns.length; i++) {
			try { fns[i](); } catch (e) { avisar(e); }
		}
	}
	// Un solo objeto por pagina: cada llamada va al montaje vigente (window.__xVisionMesas), como los oyentes del
	// socket; los oyentes de alCambiar sobreviven a volver a montar la pantalla. Nunca lanza.
	function exponer() {
		if (window.VisionMesas) { return; }
		var del = function (k) { var s = window.__xVisionMesas; return s && typeof s[k] === 'function' ? s[k] : null; };
		window.VisionMesas = {
			estadoDe: function (codigo) { var fn = del('estadoDe'); return (fn && fn(codigo)) || null; },
			alCambiar: function (fn) {
				var s = window.__xVisionMesas;
				if (s && Array.isArray(s.cambios) && typeof fn === 'function' && s.cambios.indexOf(fn) < 0) { s.cambios.push(fn); }
			},
			resolver: function (codigo) { var fn = del('accionMesa'); if (fn) { fn('resolver', codigo); } },
			silenciar: function (codigo) { var fn = del('accionMesa'); if (fn) { fn('silenciar', codigo); } }
		};
	}

	/* ---------- ciclo ---------- */

	function apagar() {
		if (st.tick) { clearInterval(st.tick); st.tick = null; }
		for (var i = 0; i < st.reintentos.length; i++) { clearTimeout(st.reintentos[i]); }
		st.reintentos = [];
		if (st.obs) { st.obs.disconnect(); st.obs = null; }
	}
	// "Solo medir" con la pantalla abierta (D4): nada a la vista y sin atender eventos; el reloj sigue, solo para releer.
	function dormir() {
		if (st.obs) { st.obs.disconnect(); st.obs = null; }
		quitarMarcas();
		for (var id in st.avisos) { if (Object.prototype.hasOwnProperty.call(st.avisos, id)) { cerrarAviso(id); } }
		st.activo = false;
		st.alEvento = null;
		st.alClick = null;
		st.estadoDe = null;
		st.accionMesa = null;
		st.datos = null;
		cambio();
	}
	function desactivar() {
		apagar();
		dormir();
	}
	function despertar(d) {
		st.activo = true;
		st.alEvento = alEvento;
		st.alClick = alClick;
		st.estadoDe = seguro(estadoDe);
		st.accionMesa = seguro(accionMesa);
		aplicar(d);   // avisa a la maqueta ya despierto: estadoDe lee lo nuevo
		engancharSocket();
		observar();
		pintar();
	}
	// Cada 30 s: los minutos ("Ocupada · 12 min") y el socket por si la pagina lo rehizo. Con 5 min sin cargas ni
	// vision-mesas-estado relee el modo: el Go no avisa el paso a "Solo medir" (I-1). Fuera de la pagina, se apaga.
	function tic() {
		if (!vigente()) { return; }
		if (!grid()) { apagar(); return; }
		if (Date.now() - Math.max(st.ultimaCarga || 0, st.ultimoEvento || 0) > 300000) { refrescar(); }
		if (!st.activo) { return; }   // dormido
		engancharSocket();
		pintar();
	}
	function activar(mod, claveMesa, d) {
		st.mod = mod;
		st.claveMesa = claveMesa;
		css();
		escucharClicks();
		despertar(d);
		st.tick = setInterval(seguro(tic), 30000);
		st.reintentos = [setTimeout(seguro(engancharSocket), 3000), setTimeout(seguro(engancharSocket), 8000)];
	}

	if (!conf || typeof o.escuchar !== 'function') { return Promise.resolve(false); }
	try {
		st = window.__xVisionMesas || (window.__xVisionMesas = { gen: 0, avisadas: {}, avisos: {}, reintentos: [] });
		apagar();   // la pagina se volvio a montar: lo del montaje anterior se suelta
		st.gen += 1;
		gen = st.gen;
		st.activo = false;
		st.alEvento = null;
		st.alClick = null;
		st.estadoDe = null;
		st.accionMesa = null;
		st.cambios = st.cambios || [];
		st.cargando = false;
		st.ultimoEvento = 0;
		st.pantalla = o.pantalla;
		st.escuchar = o.escuchar;
		st.socket = typeof o.socket === 'function' ? o.socket : null;
		exponer();
	} catch (e) {
		avisar(e);
		return Promise.resolve(false);
	}
	return pedir('estado', {}).then(function (r) {
		if (!vigente()) { return false; }
		if (!r || r.success !== true || !r.data || typeof r.data !== 'object') {
			avisar(new Error('op=estado: ' + (r && r.error ? r.error : 'sin respuesta')));
			return false;
		}
		if (r.data.activo !== true || r.data.modo !== 'alertar') { return false; }   // sin camaras_ia o "Solo medir" (D4)
		// mesas-sede.js ya lo carga estado-mesas.js con la misma URL: el segundo import() no vuelve a pedirlo.
		return Promise.all([
			import('../camaras/js/estado-mesas.js?v=20261020i'),
			import('../camaras/js/mesas-sede.js?v=20261020i')
		]).then(function (mods) {
			if (!vigente()) { return false; }
			activar(mods[0], mods[1].claveMesa, r.data);
			return true;
		});
	}).catch(function (e) { avisar(e); return false; });
}
