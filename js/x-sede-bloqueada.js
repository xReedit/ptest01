/* Sede bloqueada o dada de baja: si el servidor responde 423 (ERR_SEDE_BLOQUEADA) a cualquier
   pedido ($.ajax, axios o fetch), se vuelve al login con el aviso "Servicio suspendido".
   Sin jQuery a proposito: en m_panel.html jQuery carga async y podria no existir aun. */
(function () {
	if (window.__xSedeBloqueada) { return; }
	window.__xSedeBloqueada = true;
	var yendo = false;

	function irAlLogin() {
		if (yendo) { return; }
		yendo = true;
		var p = window.location.pathname;
		var i = p.indexOf('/app/');
		var base = i >= 0 ? p.substring(0, i + 1) : '/';
		window.location.href = base + 'logueese.html?suspendido=1';
	}

	/* Aviso de servidor lento / sin conexion: las pantallas dejan el "cargando" girando sin decir
	   nada si una peticion tarda o falla. Solo se miran las del sistema (/bdphp/). */
	var LENTO_MS = 8000;
	var pendientes = {}, sec = 0, aviso = null, errorHasta = 0;

	function esDelSistema(url) { return String(url || '').indexOf('/bdphp/') >= 0; }

	function pintarAviso() {
		var ahora = Date.now(), lento = false;
		for (var k in pendientes) { if (ahora - pendientes[k] > LENTO_MS) { lento = true; break; } }
		var msj = ahora < errorHasta ? 'Sin conexión. Revise su internet e intente de nuevo.'
			: (lento ? 'Conexión en proceso, espere un momento…' : '');
		if (!msj) { if (aviso) { aviso.style.display = 'none'; } return; }
		if (!aviso) {
			if (!document.body) { return; }
			aviso = document.createElement('div');
			aviso.setAttribute('role', 'status');
			aviso.style.cssText = 'position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647;'
				+ 'max-width:calc(100% - 32px);padding:10px 16px;border-radius:8px;background:#323232;color:#fff;'
				+ 'font:14px/1.4 sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.3);';
			document.body.appendChild(aviso);
		}
		aviso.textContent = msj;
		aviso.style.display = 'block';
	}
	setInterval(pintarAviso, 1000);

	function inicio(url) {
		if (!esDelSistema(url)) { return null; }
		var id = ++sec;
		pendientes[id] = Date.now();
		return id;
	}
	function fin(id, fallo) {
		if (id === null) { return; }
		delete pendientes[id];
		if (fallo) { errorHasta = Date.now() + 6000; }
		pintarAviso();
	}

	var abrir = XMLHttpRequest.prototype.open;
	var enviar = XMLHttpRequest.prototype.send;
	XMLHttpRequest.prototype.open = function (metodo, url) {
		this.__xUrl = url;
		this.addEventListener('load', function () {
			if (this.status === 423) { irAlLogin(); }
		});
		return abrir.apply(this, arguments);
	};
	XMLHttpRequest.prototype.send = function () {
		var id = inicio(this.__xUrl);
		if (id !== null) {
			var cancelada = false; // abort() de la propia app no es falta de conexion
			this.addEventListener('abort', function () { cancelada = true; });
			this.addEventListener('loadend', function () { fin(id, !cancelada && (this.status === 0 || this.status >= 500)); });
		}
		return enviar.apply(this, arguments);
	};

	if (window.fetch) {
		var f = window.fetch;
		window.fetch = function (recurso) {
			var id = inicio(typeof recurso === 'string' ? recurso : (recurso && recurso.url));
			return f.apply(this, arguments).then(function (r) {
				fin(id, r.status >= 500);
				if (r.status === 423) { irAlLogin(); }
				return r;
			}, function (e) {
				fin(id, true);
				throw e;
			});
		};
	}
})();
