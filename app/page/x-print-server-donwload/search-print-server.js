/**
 * Detecta que version del servidor de impresion tiene la sede y lo abre (m_panel case 27).
 * - Nueva: Node.js en esta PC, http://localhost:3847 (/api/ping devuelve version, con CORS).
 * - Anterior: Laragon en sede.ip_server_local -> restobar/print/client/index.html?o=...
 * En produccion (https) el navegador bloquea consultar http://<ip> (contenido mixto): la anterior no se
 * puede comprobar, solo abrir. Por eso, si no esta la nueva y la sede tiene ip, se pregunta.
 * Se carga dos veces (m_panel.html y x-print-server-donwload.html): solo var/function en nivel superior.
 */

var PrintServerDetector = {
	NEW_SERVER_URL: 'http://localhost:3847',
	NEW_SERVER_PING: 'http://localhost:3847/api/ping',
	TIMEOUT_MS: 3000,

	getEncodedOrgData: function () {
		var demo = window.location.href.indexOf('demo') > -1 ? 'd' : '';
		return btoa(JSON.stringify({
			o: typeof xIdOrg !== 'undefined' ? xIdOrg : '',
			s: typeof xIdSede !== 'undefined' ? xIdSede : '',
			d: demo
		}));
	},

	getLaragonServerUrl: function () {
		try {
			var datosSede = xm_log_get('datos_org_sede');
			if (datosSede && datosSede[0] && datosSede[0].ip_server_local) {
				return 'http://' + String(datosSede[0].ip_server_local).trim();
			}
		} catch (e) { /* sin datos de sede: no hay version anterior */ }
		return null;
	},

	fetchConTiempo: function (url, mode) {
		var controller = new AbortController();
		var timer = setTimeout(function () { controller.abort(); }, this.TIMEOUT_MS);
		return fetch(url, { method: 'GET', mode: mode, cache: 'no-store', signal: controller.signal })
			.finally(function () { clearTimeout(timer); });
	},

	// cors para leer la version; si el navegador no deja leerla, no-cors al menos confirma que responde
	checkNewServer: async function () {
		try {
			var r = await this.fetchConTiempo(this.NEW_SERVER_PING, 'cors');
			var data = r.ok ? await r.json() : {};
			return { installed: true, serverType: 'new', version: data.version || '', isConfigured: !!data.isConfigured };
		} catch (e) { /* sigue con no-cors */ }
		try {
			await this.fetchConTiempo(this.NEW_SERVER_PING, 'no-cors');
			return { installed: true, serverType: 'new', version: '' };
		} catch (e) {
			return { installed: false, serverType: 'new' };
		}
	},

	// installed: true | false | 'unknown' (https no puede consultar http://<ip>)
	checkLaragonServer: async function () {
		var baseUrl = this.getLaragonServerUrl();
		if (!baseUrl) { return { installed: false, serverType: 'laragon' }; }
		if (window.location.protocol === 'https:') { return { installed: 'unknown', serverType: 'laragon', baseUrl: baseUrl }; }
		try {
			await this.fetchConTiempo(baseUrl, 'no-cors');
			return { installed: true, serverType: 'laragon', baseUrl: baseUrl };
		} catch (e) {
			return { installed: false, serverType: 'laragon', baseUrl: baseUrl };
		}
	},

	detectInstalledServer: async function () {
		var nuevo = await this.checkNewServer();
		if (nuevo.installed) { return nuevo; }
		var anterior = await this.checkLaragonServer();
		if (anterior.installed) { return anterior; }
		return { installed: false, serverType: 'none', laragonUrl: anterior.baseUrl || null };
	},

	getRedirectUrl: function (serverInfo) {
		if (serverInfo.serverType === 'new') { return this.NEW_SERVER_URL; }
		if (serverInfo.serverType === 'laragon' && serverInfo.baseUrl) {
			return serverInfo.baseUrl + '/restobar/print/client/index.html?o=' + this.getEncodedOrgData();
		}
		return null;
	},

	abrir: function (url) {
		window.open(url, 'Servidor de Impresion');
	},

	redirectToServer: async function () {
		var info = await this.detectInstalledServer();
		if (info.installed === true) {
			var url = this.getRedirectUrl(info);
			this.abrir(url);
			return { success: true, serverType: info.serverType, version: info.version || '', url: url };
		}
		if (info.installed === 'unknown') { return this.preguntarAnterior(info); }
		this.showDownloadPage();
		return { success: false, reason: 'no_server' };
	},

	// la sede tiene la version anterior configurada pero no se puede comprobar si esta prendida
	preguntarAnterior: function (info) {
		var self = this;
		var url = this.getRedirectUrl(info);
		if (window.xPopupLoad && xPopupLoad.xclose) { xPopupLoad.xclose(); } // el "Cargando" de m_panel no debe quedar detras de la pregunta
		if (typeof showAlertSwalHtmlDecision !== 'function') { this.abrir(url); return Promise.resolve({ success: true, serverType: 'laragon', url: url }); }
		return showAlertSwalHtmlDecision({
			title: 'Abrir servidor de impresion',
			html: 'En esta computadora no esta instalado el <b>servidor de impresion nuevo</b>.<br><br>' +
				'Tu local tiene configurada la <b>version anterior</b> (Laragon). Si no abre, revisa que Laragon este iniciado.',
			icon: 'question', showCancelButton: true,
			confirmButtonText: 'Abrir version anterior', cancelButtonText: 'Instalar version nueva'
		}, 1).then(function (r) {
			if (r && r.isConfirmed) { self.abrir(url); return { success: true, serverType: 'laragon', url: url }; }
			if (r && r.dismiss === 'cancel') { self.showDownloadPage(); }
			return { success: false, reason: 'cancel' };
		});
	},

	showDownloadPage: function () {
		if (typeof router !== 'undefined' && router) {
			router.go('/print-server');
		} else {
			window.location.hash = '#/print-server';
		}
	}
};

async function searchAndRedirectPrintServer() {
	return await PrintServerDetector.redirectToServer();
}

async function checkPrintServerStatus() {
	return await PrintServerDetector.detectInstalledServer();
}
