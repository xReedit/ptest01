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

	var abrir = XMLHttpRequest.prototype.open;
	XMLHttpRequest.prototype.open = function () {
		this.addEventListener('load', function () {
			if (this.status === 423) { irAlLogin(); }
		});
		return abrir.apply(this, arguments);
	};

	if (window.fetch) {
		var f = window.fetch;
		window.fetch = function () {
			return f.apply(this, arguments).then(function (r) {
				if (r.status === 423) { irAlLogin(); }
				return r;
			});
		};
	}
})();
