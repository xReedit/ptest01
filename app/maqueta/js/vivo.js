// Maqueta 3D del salon en vivo (spec docs/superpowers/specs/2026-10-31-maqueta-salon-3d-design.md §5) en Control de
// pedidos (app/page/x-control-mesas.html, Pedidos | Local). x-control-mesas llama MaquetaVivo.montar(grid, ctx) al
// final de xPintarMesas.
// Las tarjetas .xMiCardPedido siguen siendo la fuente de verdad: se crean y actualizan como siempre, pero fuera de
// pantalla (sin display:none: isotope las sigue midiendo y acomodando), y la maqueta las lee con un MutationObserver
// (un solo redibujo por cuadro). Tocar una mesa = $(tarjeta).trigger('click'), lo mismo que tocar la tarjeta.
// REGLA (incidente 2026-10-06): script clasico; al cargarse solo define window.MaquetaVivo, nada corre hasta montar().
// Pantalla de cobro: todo en try/catch; si algo falla, un console.warn y las tarjetas de siempre. Sede sin la maqueta
// activa o area sin plano: un op=planos y nada mas (sin import(), sin Three.js, sin tocar las tarjetas).
// Rutas: import() se resuelve contra este archivo (app/maqueta/js/); fetch, el estilo y el editor contra la pagina
// (app/page/), como los demas fetch de x-control-mesas.
(function (global) {
	'use strict';
	if (global.MaquetaVivo) { return; }   // segunda carga del script (HTML import repetido): queda la primera

	const URL_PLANOS = '../../bdphp/log_maqueta.php?op=planos';
	const URL_PLATOS = '../../bdphp/log_maqueta.php?op=platos';
	const MAX_PEDIDOS = 200, MAX_PLATOS_GUARDADOS = 600;
	const URL_EDITOR = '../maqueta/index.html?v=20261102m&area=';
	const URL_CSS = '../maqueta/maqueta.css?v=20261111c';
	const ID_ARMAR = 'maq_armar_salon';      // boton "Armar salón" de x-control-mesas.html (con xInvisible si no hay C1)
	const ID_AREAS = 'comp-area-mesas';      // pestañas de area: emite onChangeTitle {title}
	const ID_DETALLE = 'dialog_detalle';     // paper-dialog del pedido de la mesa (x-control-mesas.html)
	const MENU_CERRADO = 'cp-menu-cerrado';   // body: menu lateral cerrado (m_control_pedidos.js xMenuLateral)
	const COMPLETA = 'maq-completa';         // maqueta.css: fondo y margen del contenedor en pantalla completa
	const OCULTA = 'maq-grid-oculta';        // maqueta.css: la grilla fuera de pantalla, pero medible
	const ALTO_MIN = 360, MARGEN_ABAJO = 14; // px
	const GUARDAR_VISTA_MS = 500;
	const MAX_RESULTADOS = 6;
	const ZOOM = { acercar: 0.8, alejar: 1.25 };
	// Modos de la barra de abajo: que hace arrastrar con el mouse (iconos de trazo, como los de Lucide).
	const MODOS = [
		{ modo: 'mover', tip: 'Mover: arrastra con el mouse para recorrer el salón.',
			trazos: ['M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8', 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15'] },
		{ modo: 'girar', tip: 'Girar: arrastra con el mouse para girar el salón. Atajo: mantén Ctrl y mueve el mouse.',
			trazos: ['M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8', 'M21 3v5h-5'] },
	];
	const TODO = Object.freeze({ tipo: 'todo' });
	const TEXTO_SIN_3D = 'Esta computadora no puede mostrar el salón en 3D: se ven las mesas de siempre.';
	const ESPERA_MAX_MS = 8000;   // "Preparando maqueta…" no se queda mas que esto: si no llego, las tarjetas
	const CARGANDO_MIN_MS = 1200; // ...ni menos que esto: un destello de cartel parece un error, no una preparacion
	const DESVANECER_MS = 350;
	// Mientras carga, la grilla va fuera de pantalla como con maq-grid-oculta (maqueta.css aun no llego): en linea.
	const FUERA = { position: 'absolute', left: '-100000px', top: '0', width: '100%', height: '0', visibility: 'hidden', 'pointer-events': 'none' };

	// Estado del modulo: solo declaraciones, se llenan en montar().
	let grid = null, ctx = null, datos = null, vista = null, aviso = null, modulos = null, css = null, oyenteArea = null;
	let genPedido = 0, genElegir = 0, roto = false, sinWebgl = false;
	let cargando = null;          // {el, t}: el cartel "Preparando maqueta…" mientras se decide y se arma
	let portal = null;            // avisos-mesa.js crearPortal mientras el contenedor esta en pantalla completa
	const avisados = new Set();   // un console.warn por clase de aviso
	// Personas segun los platos de cada pedido ("idpedido|importe" → n o null): si cambia el importe, se vuelve a pedir.
	const platos = new Map();
	let pidiendoPlatos = false;

	// ---------------------------------------------------------------- errores

	// Avisos que se pueden repetir (sin conexion, cada cambio de pestaña): una vez por texto.
	function avisar(que, e) {
		if (avisados.has(que)) { return; }
		avisados.add(que);
		console.warn(`maqueta: ${que}`, e);
	}
	// Error propio: siempre a la consola, y las tarjetas de siempre hasta recargar la pagina.
	function fallar(e) {
		console.warn('maqueta: error en la vista en vivo; se vuelve a las tarjetas', e);
		roto = true;
		quitarVista();
		quitarCargando();
	}
	/** fn que nunca lanza a la pagina (tampoco si devuelve una promesa que falla). */
	function seguro(fn) {
		return function (...args) {
			try {
				const r = fn.apply(this, args);
				if (r && typeof r.then === 'function') { r.then(null, fallar); }
			} catch (e) {
				fallar(e);
			}
		};
	}

	// ---------------------------------------------------------------- servidor, modulos y estilo

	async function pedirPlanos() {
		const res = await fetch(URL_PLANOS, {
			method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: '{}',
		});
		const json = await res.json();
		const d = json && json.success ? json.data : null;
		if (!d || typeof d.activo !== 'boolean' || !Array.isArray(d.planos)) {
			throw new Error(`respuesta de op=planos no valida (${json && json.error})`);
		}
		return { activo: d.activo, puedeEditar: d.puedeEditar === true, planos: d.planos };
	}

	const llavePlatos = m => `${m.idpedido}|${m.importe}`;

	/**
	 * Las mesas ocupadas que aun no tienen su cuenta de personas por platos: un pedido al servidor a la vez, y al
	 * llegar un cuadro nuevo. Si falla, quedan sin cuenta (2 a 4 personas) hasta que cambie su importe.
	 */
	async function pedirPlatos(v, lista) {
		if (pidiendoPlatos) { return; }
		const faltan = lista.filter(e => e.m.ocupada && e.m.idpedido && !platos.has(llavePlatos(e.m)));
		if (!faltan.length) { return; }
		pidiendoPlatos = true;
		const ids = [...new Set(faltan.map(e => e.m.idpedido))].slice(0, MAX_PEDIDOS);
		let porPedido = {};
		try {
			const res = await fetch(URL_PLATOS, {
				method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ pedidos: ids }),
			});
			const json = await res.json();
			if (!json || !json.success || !json.data || typeof json.data !== 'object') { throw new Error(`op=platos (${json && json.error})`); }
			porPedido = json.data;
		} catch (e) {
			avisar('no se pudo leer los platos de las mesas', e);
		} finally {
			pidiendoPlatos = false;
		}
		for (const e of faltan.filter(x => ids.includes(x.m.idpedido))) {
			const items = Array.isArray(porPedido[e.m.idpedido]) ? porPedido[e.m.idpedido] : [];
			platos.set(llavePlatos(e.m), v.mods.personasPorPlatos(items));
		}
		for (const k of platos.keys()) { if (platos.size <= MAX_PLATOS_GUARDADOS) { break; } platos.delete(k); }   // los mas viejos
		programar(v);
	}

	/**
	 * Los modulos de la maqueta (Three.js incluido). Las pruebas reemplazan MaquetaVivo._cargar. El panel de llevar y
	 * delivery (pantalla completa) es opcional: si no carga, la maqueta sigue sin el.
	 */
	function cargar() {
		const llevar = import('./llevar-panel.js?v=20261102m').then(null, e => { avisar('no cargo el panel de llevar y delivery', e); return {}; });
		const avisos = import('./avisos-mesa.js?v=20261102m').then(null, e => { avisar('no cargaron los avisos de la carta', e); return {}; });
		return Promise.all([
			import('./escena.js?v=20261102m'), import('./rotulos.js?v=20261102m'),
			import('./estado.js?v=20261102m'), import('./plano.js?v=20261102m'), llevar, avisos,
		]).then(([escena, rotulos, estado, plano, panel, carta]) => ({
			...plano, ...estado, crearEscena: escena.crearEscena, crearRotulos: rotulos.crearRotulos, crearLlevar: panel.crearLlevar,
			crearAvisosMesa: carta.crearAvisosMesa, crearPortal: carta.crearPortal,
		}));
	}
	function cargarModulos() {
		if (!modulos) { modulos = Promise.resolve().then(() => api._cargar()); }
		return modulos;
	}
	// Los rotulos se miden al pintarse: la maqueta se arma con el estilo ya cargado.
	function ponerCss(doc) {
		if (!css) {
			css = new Promise(listo => {
				const link = doc.createElement('link');
				link.rel = 'stylesheet';
				link.href = URL_CSS;
				link.addEventListener('load', () => listo());
				link.addEventListener('error', () => { avisar('no cargo maqueta.css'); listo(); });
				doc.head.appendChild(link);
			});
		}
		return css;
	}

	// ---------------------------------------------------------------- "Preparando maqueta…"
	// Sin esto, al abrir Control de pedidos se ven las tarjetas uno o dos segundos (op=planos, Three.js, armar) y luego
	// salta la maqueta. Se recuerda que areas de la sede tenian maqueta la ultima vez; en esas, las tarjetas no se
	// muestran y se ve el cartel hasta que la maqueta este lista (o se decida que no va: entonces, las tarjetas).

	const llaveAreas = () => `maq-areas-${ctx.sede}`;
	function areasConMaqueta() {
		try { return JSON.parse(global.localStorage.getItem(llaveAreas()) || '[]'); } catch (e) { return []; }
	}
	function recordarAreas(d) {
		try { global.localStorage.setItem(llaveAreas(), JSON.stringify(d.activo ? d.planos.map(p => p && p.area) : [])); } catch (e) { /* sin localStorage: sin cartel */ }
	}

	function mostrarCargando() {
		if (cargando || roto || sinWebgl || !grid || !grid.parentNode) { return; }
		if (vista && vista.grid === grid && vista.area === ctx.area) { return; }   // ya esta la maqueta
		const lista = areasConMaqueta();
		if (!Array.isArray(lista) || !lista.includes(ctx.area)) { return; }
		const doc = grid.ownerDocument;
		// estilos en linea: maqueta.css aun no llego (la ruedita gira con SMIL, sin @keyframes)
		const el = nodo(doc, 'div', 'maq-cargando');
		el.append(ruedita(doc), nodo(doc, 'span', '', 'Preparando maqueta…'));
		el.setAttribute('role', 'status');
		el.style.cssText = 'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;min-height:360px;'
			+ 'margin-bottom:8px;border-radius:14px;background:#f4f3f0;color:#6b6b72;font-size:14px;font-weight:600';
		grid.parentNode.insertBefore(el, grid);
		// lo que tenia la grilla (isotope le pone position:relative): al quitar el cartel vuelve tal cual
		const antes = Object.keys(FUERA).map(k => [k, grid.style.getPropertyValue(k), grid.style.getPropertyPriority(k)]);
		for (const [k, valor] of Object.entries(FUERA)) { grid.style.setProperty(k, valor, 'important'); }
		cargando = { el, g: grid, antes, desde: Date.now(), t: global.setTimeout(seguro(quitarCargando), ESPERA_MAX_MS) };
	}

	function ruedita(doc) {
		const svg = doc.createElementNS(SVG, 'svg');
		for (const [k, v] of [['viewBox', '0 0 24 24'], ['width', '30'], ['height', '30'], ['aria-hidden', 'true']]) { svg.setAttribute(k, v); }
		const trazo = (d, color) => {
			const p = doc.createElementNS(SVG, 'path');
			for (const [k, v] of [['d', d], ['fill', 'none'], ['stroke', color], ['stroke-width', '2.5'], ['stroke-linecap', 'round']]) { p.setAttribute(k, v); }
			svg.append(p);
			return p;
		};
		trazo('M12 3a9 9 0 1 1 0 18a9 9 0 1 1 0-18', '#dedbd5');
		const arco = trazo('M21 12a9 9 0 0 0-9-9', '#6a1b9a');
		const giro = doc.createElementNS(SVG, 'animateTransform');
		for (const [k, v] of [['attributeName', 'transform'], ['type', 'rotate'], ['from', '0 12 12'], ['to', '360 12 12'], ['dur', '0.8s'], ['repeatCount', 'indefinite']]) { giro.setAttribute(k, v); }
		arco.append(giro);
		return svg;
	}

	/**
	 * Quita el cartel. Si la maqueta ya esta, el cartel pasa a taparla hasta cumplir CARGANDO_MIN_MS y se desvanece;
	 * si no hay maqueta, vuelven las tarjetas al instante.
	 */
	function quitarCargando() {
		if (!cargando) { return; }
		const { el, g, t, desde, antes } = cargando;
		cargando = null;
		global.clearTimeout(t);
		for (const [k, valor, prioridad] of antes) { if (valor) { g.style.setProperty(k, valor, prioridad); } else { g.style.removeProperty(k); } }
		const host = vista && vista.grid === g && g.parentNode ? g.parentNode.querySelector('.maq-vivo') : null;
		if (!host) {
			el.remove();
			const $ = global.jQuery;
			if ($ && $(g).data('isotope')) { $(g).isotope('layout'); }   // las tarjetas a su lugar
			return;
		}
		host.append(el);   // .maq-vivo es position:relative: el cartel la cubre entera
		el.style.cssText += ';position:absolute;inset:0;z-index:30;min-height:0;margin:0;border-radius:0;transition:opacity .35s';
		global.setTimeout(seguro(() => {
			el.style.opacity = '0';
			global.setTimeout(seguro(() => el.remove()), DESVANECER_MS);
		}), Math.max(0, CARGANDO_MIN_MS - (Date.now() - desde)));
	}

	// ---------------------------------------------------------------- tarjetas

	const sinEspacios = t => String(t == null ? '' : t).replace(/ /g, '');
	const textoDe = e => (e ? e.textContent : '');
	const codigoDe = el => (el.getAttribute('data-codigo-mesa') || textoDe(el.querySelector('.numero'))).trim();

	/**
	 * Tarjetas de mesa del area en el orden de la grilla. Sin los pedidos sin mesa fisica (reserva sin mesa .otroCard,
	 * "Mesa Pago App", mesa 0): se atienden desde el menu lateral, como hoy. area '' = sede sin areas.
	 */
	function tarjetasDelArea(mods, g, area) {
		return Array.from(g.querySelectorAll('.xMiCardPedido')).filter(el => {
			if (el.classList.contains('otroCard') || el.getAttribute('data-isconfirmarpago') === '1') { return false; }
			const codigo = codigoDe(el);
			return !!codigo && mods.claveMesa(codigo) !== '0' && (area === '' || sinEspacios(el.getAttribute('data-area')) === area);
		});
	}

	/** Pedidos | Local con esta area a la vista: isotope no filtra sus tarjetas (Para llevar, Delivery u otra area si). */
	function enVista(g, tarjetas) {
		if (!g.isConnected || g.classList.contains('xInvisible') || !tarjetas.length) { return false; }
		const $ = global.jQuery, iso = $ ? $(g).data('isotope') : null;
		return !iso || iso.filteredItems.some(item => item.element === tarjetas[0]);
	}

	function ocultarTarjetas(g) { g.classList.add(OCULTA); controlesArriba(g, false); }
	function mostrarTarjetas(g) {
		controlesArriba(g, true);
		if (!g.classList.contains(OCULTA)) { return; }
		g.classList.remove(OCULTA);
		const $ = global.jQuery;
		if ($ && $(g).data('isotope')) { $(g).isotope('layout'); }   // vuelve a acomodar con su ancho de siempre
	}

	// Con la maqueta a la vista la cabecera de Control de pedidos (titulo, WhatsApp, buscador, Por Estado/Numero) no
	// sirve: en m_control_pedidos se esconde entera (el aviso de WhatsApp pasa junto a las areas, ver espejoWhatsapp) y
	// el contenido toma su alto. Donde la cabecera es la del panel (m_panel: menu), solo se esconden los controles que
	// pone x-control-mesas. Se vuelve a mostrar solo lo que se escondio aqui (otra pagina reescribe la cabecera).
	const MARCA_ARRIBA = 'data-maq-oculto';
	function esconder(e, si) {
		if (!e || !e.style) { return; }
		if (si) {
			if (e.hasAttribute(MARCA_ARRIBA)) { return; }
			e.setAttribute(MARCA_ARRIBA, e.style.display || '');
			e.style.display = 'none';
		} else if (e.hasAttribute(MARCA_ARRIBA)) {
			e.style.display = e.getAttribute(MARCA_ARRIBA);
			e.removeAttribute(MARCA_ARRIBA);
		}
	}
	function controlesArriba(g, ver) {
		const doc = g.ownerDocument;
		const h = doc && typeof doc.getElementById === 'function' ? doc.getElementById('div_filtro_header') : null;
		if (!h) { return; }
		const barra = typeof h.closest === 'function' ? h.closest('paper-toolbar') : null;
		if (barra && barra.querySelector('#' + ID_WHATSAPP)) {
			esconder(barra, !ver);
			const contenido = Array.from(barra.parentNode ? barra.parentNode.children : []).find(e => e.classList.contains('content'));
			if (contenido && contenido.style) {
				if (!ver && !contenido.hasAttribute(MARCA_ALTO)) { contenido.setAttribute(MARCA_ALTO, contenido.style.height || ''); contenido.style.height = '100vh'; }
				if (ver && contenido.hasAttribute(MARCA_ALTO)) { contenido.style.height = contenido.getAttribute(MARCA_ALTO); contenido.removeAttribute(MARCA_ALTO); }
			}
			return;
		}
		for (const e of Array.from(h.children || [])) { esconder(e, !ver); }
	}
	const MARCA_ALTO = 'data-maq-alto';

	// El aviso de WhatsApp (x-detected-mensajeria #detectorMensajeria, en la cabecera escondida) repetido junto a las
	// pestañas de area: mismo color, mismo tooltip; tocarlo abre mensajeria. Se copia en cada cuadro (sin oyentes).
	const ID_WHATSAPP = 'detectorMensajeria';
	function crearEspejoWhatsapp(doc) {
		const det = doc.getElementById(ID_WHATSAPP);
		if (!det) { return null; }
		const b = nodo(doc, 'button', 'maq-wa');
		b.type = 'button';
		const svg = doc.createElementNS(SVG, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		for (const d of ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z', 'M16 14.3v1.3a.9.9 0 0 1-1 .9 8.9 8.9 0 0 1-3.9-1.4 8.8 8.8 0 0 1-2.7-2.7A8.9 8.9 0 0 1 7 8.5a.9.9 0 0 1 .9-1h1.3a.9.9 0 0 1 .9.8c.1.4.2.9.3 1.3a.9.9 0 0 1-.2.9l-.6.6a7.2 7.2 0 0 0 2.7 2.7l.6-.6a.9.9 0 0 1 .9-.2c.4.1.8.2 1.3.3a.9.9 0 0 1 .8.9Z']) {
			const p = doc.createElementNS(SVG, 'path');
			p.setAttribute('d', d);
			svg.append(p);
		}
		b.append(svg);
		b.addEventListener('click', seguro(() => { if (typeof det._irAMensajeria === 'function') { det._irAMensajeria(); } }));
		return { el: b, det };
	}
	function pintarEspejoWhatsapp(w) {
		if (!w) { return; }
		const d = w.det;
		const estado = d.isChecking ? '' : (!d.isConectado ? 'no' : (d.chatbotPausado ? 'pausa' : 'si'));
		w.el.className = estado ? `maq-wa maq-wa-${estado}` : 'maq-wa';
		const titulo = typeof d._getTituloPunto === 'function' ? d._getTituloPunto(d.isConectado, d.isChecking, d.chatbotPausado) : 'WhatsApp';
		if (w.el.title !== titulo) { w.el.title = titulo; w.el.setAttribute('aria-label', titulo); }
	}

	// Camaras (§5.3): window.VisionMesas de app/shared/vision.mesas.js. Puede llegar despues de la maqueta o no estar
	// (sin camaras_ia, "Solo medir"): se busca en cada cuadro y, si falla, la maqueta sigue sin capa de camaras.
	const ACCION_CAMARA = { atendi: 'resolver', cobre: 'resolver', silenciar: 'silenciar' };
	let camarasOidas = null;   // el VisionMesas al que ya se suscribio la maqueta (uno por pagina)

	function visionMesas() {
		const vm = global.VisionMesas;
		return vm && typeof vm.estadoDe === 'function' ? vm : null;
	}
	/** El Camara de la mesa: VisionMesas recibe el codigo de la tarjeta tal cual (tiene su propia clave de mesa). */
	function camaraDe(codigo) {
		const vm = visionMesas();
		if (!vm) { return null; }
		try {
			return vm.estadoDe(codigo) || null;
		} catch (e) {
			avisar('no se pudo leer las camaras', e);
			return null;
		}
	}
	// Un cambio en las camaras → un cuadro, como un cambio de tarjeta. Una sola suscripcion por pagina.
	function escucharCamaras() {
		const vm = visionMesas();
		if (!vm || vm === camarasOidas || typeof vm.alCambiar !== 'function') { return; }
		camarasOidas = vm;
		vm.alCambiar(seguro(() => { if (vista) { vista.refrescar(); } }));
	}
	/** Ya atendí / Ya cobré → resolver, Silenciar → silenciar: el dialogo de SweetAlert del modulo (dentro de la pantalla completa si hay portal). */
	function accionCamara(doc, codigo, accion) {
		const vm = visionMesas();
		const metodo = Object.prototype.hasOwnProperty.call(ACCION_CAMARA, accion) ? ACCION_CAMARA[accion] : null;
		if (!vm || !metodo || typeof vm[metodo] !== 'function') { return; }
		if (!portal) { salirDePantallaCompleta(doc); }   // con portal el SweetAlert se muda a la pantalla completa
		try {
			vm[metodo](codigo);
		} catch (e) {
			// Fallo el modulo de camaras (igual que su boton en la tarjeta): la maqueta sigue.
			console.error('maqueta: error en la accion de camara', codigo, accion, e);
		}
	}

	// ---------------------------------------------------------------- piezas de la pantalla (solo texto, nunca HTML)

	function nodo(doc, tag, clase, texto) {
		const e = doc.createElement(tag);
		if (clase) { e.className = clase; }
		if (texto != null && texto !== '') { e.textContent = String(texto); }
		return e;
	}
	function boton(doc, clase, texto, titulo, fn) {
		const b = nodo(doc, 'button', clase, texto);
		b.type = 'button';
		if (titulo) { b.title = titulo; }
		b.addEventListener('click', seguro(fn));
		return b;
	}
	const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

	/** Arriba al centro: Todo · Alertas n · Por cobrar n · Mozo ▾ (como el prototipo). */
	function crearFiltros(doc, elegir) {
		const el = nodo(doc, 'div', 'maq-filtros');
		const cuenta = { alertas: nodo(doc, 'i'), cobrar: nodo(doc, 'i') };
		const botones = {
			todo: boton(doc, '', 'Todo', 'Todas las mesas', () => elegir(TODO)),
			alertas: boton(doc, '', 'Alertas', 'Mesas que piden algo (sin las precuentas)', () => elegir({ tipo: 'alertas' })),
			cobrar: boton(doc, '', 'Por cobrar', 'Precuentas y cuentas abiertas', () => elegir({ tipo: 'cobrar' })),
		};
		botones.alertas.append(cuenta.alertas);
		botones.cobrar.append(cuenta.cobrar);
		const mozo = nodo(doc, 'select');
		mozo.title = 'Mesas de un mozo';
		mozo.addEventListener('change', seguro(() => elegir(mozo.value ? { tipo: 'mozo', mozo: mozo.value } : TODO)));
		el.append(botones.todo, botones.alertas, botones.cobrar, mozo);
		let firmaMozos = null;
		return {
			el,
			pintar(filtro, n, mozos) {
				for (const [tipo, b] of Object.entries(botones)) { b.classList.toggle('maq-on', filtro.tipo === tipo); }
				mozo.classList.toggle('maq-on', filtro.tipo === 'mozo');
				cuenta.alertas.textContent = String(n.alertas);
				cuenta.cobrar.textContent = String(n.cobrar);
				const elegido = filtro.tipo === 'mozo' ? filtro.mozo : '';
				const lista = elegido && !mozos.includes(elegido) ? [...mozos, elegido] : mozos;
				const firma = JSON.stringify([lista, elegido]);
				if (firma === firmaMozos) { return; }   // no rearmar la lista mientras esta abierta
				firmaMozos = firma;
				const primera = nodo(doc, 'option', '', 'Mozo…');
				primera.value = '';
				mozo.replaceChildren(primera, ...lista.map(z => nodo(doc, 'option', '', z)));
				mozo.value = elegido;
			},
		};
	}

	/** Arriba a la izquierda: buscador por referencia o numero de mesa, con la lista de coincidencias. */
	function crearBuscador(doc, cb) {
		const el = nodo(doc, 'div', 'maq-buscar');
		const input = nodo(doc, 'input');
		input.type = 'search';
		input.placeholder = 'Buscar cliente o referencia…';
		input.autocomplete = 'off';
		input.setAttribute('aria-label', 'Buscar una mesa por cliente, referencia o número');
		const res = nodo(doc, 'div', 'maq-res');
		el.append(input, res);
		let hits = [], firma = '';
		input.addEventListener('input', seguro(() => cb.buscar(input.value)));
		input.addEventListener('keydown', seguro(e => {
			if (e.key === 'Enter' && hits.length) { cb.ir(hits[0].codigo); }
			if (e.key === 'Escape') { input.value = ''; cb.buscar(''); }
		}));
		res.addEventListener('click', seguro(e => {
			const b = e.target.closest('button[data-codigo]');
			if (b) { cb.ir(b.getAttribute('data-codigo')); }
		}));
		const fila = ({ codigo, m }) => {
			const b = nodo(doc, 'button');
			b.type = 'button';
			b.setAttribute('data-codigo', codigo);
			const detalle = m.mozo ? `${m.mozo.split(/\s+/)[0]}${m.importe == null ? '' : ` · S/ ${Math.round(m.importe)}`}` : (m.reserva ? 'Reservada' : 'Libre');
			const texto = nodo(doc, 'span');
			texto.append(nodo(doc, 'b', '', m.referencia || `Mesa ${codigo}`), nodo(doc, 'small', '', detalle));
			b.append(nodo(doc, 'span', 'maq-rn', codigo), texto);
			return b;
		};
		return {
			el,
			/** encontradas: null = sin busqueda. */
			pintar(q, encontradas) {
				hits = encontradas || [];
				const nueva = JSON.stringify([q, hits]);
				if (nueva === firma) { return; }
				firma = nueva;
				if (!encontradas) { res.replaceChildren(); return; }
				res.replaceChildren(...(hits.length ? hits.map(fila) : [nodo(doc, 'p', '', `Ninguna mesa con «${q.trim()}»`)]));
			},
			limpiar() { input.value = ''; },
		};
	}

	const SVG = 'http://www.w3.org/2000/svg';
	function icono(doc, trazos) {
		const svg = doc.createElementNS(SVG, 'svg');
		svg.setAttribute('viewBox', '0 0 24 24');
		svg.setAttribute('aria-hidden', 'true');
		for (const d of trazos) { const p = doc.createElementNS(SVG, 'path'); p.setAttribute('d', d); svg.append(p); }
		return svg;
	}

	/** Abajo a la derecha: mover ✋ | girar (que hace arrastrar) · + / − / ver todo / pantalla completa. */
	function crearZoom(doc, escena, host) {
		const el = nodo(doc, 'div', 'maq-zoom');
		const modos = MODOS.map(m => {
			const b = boton(doc, 'maq-modo', '', '', () => elegir(m.modo));
			b.append(icono(doc, m.trazos));
			b.setAttribute('data-tip', m.tip);
			b.setAttribute('aria-label', m.tip);
			return { ...m, b };
		});
		function elegir(modo) {
			escena.setModo(modo);
			for (const m of modos) { m.b.classList.toggle('maq-on', m.modo === modo); m.b.setAttribute('aria-pressed', String(m.modo === modo)); }
		}
		elegir('mover');
		el.append(...modos.map(m => m.b), nodo(doc, 'span', 'maq-sep'),
			boton(doc, '', '+', 'Acercar', () => escena.zoom(ZOOM.acercar)),
			boton(doc, '', '−', 'Alejar', () => escena.zoom(ZOOM.alejar)),
			boton(doc, '', '⤢', 'Ver todo el salón', () => escena.encuadrar()),
			boton(doc, '', '⛶', 'Pantalla completa', () => pantallaCompleta(doc, host)));
		return el;
	}
	// Si el navegador no deja (sin la API, permiso, iframe), no es un error de la maqueta: solo el aviso de consola.
	/**
	 * Lo que va a pantalla completa: lo mas chico que tiene la maqueta, las pestañas de area, la ocupacion y el detalle
	 * del pedido (asi abrir una mesa no saca de pantalla completa). Sin el detalle en la pagina, solo la maqueta.
	 */
	function contenedorCompleto(doc, host) {
		const detalle = doc.getElementById(ID_DETALLE);
		for (let n = host.parentNode; detalle && n && n !== doc.body && n.nodeType === 1; n = n.parentNode) {
			if (n.contains(detalle)) { return n; }
		}
		return host;
	}

	function pantallaCompleta(doc, host) {
		if (doc.fullscreenElement) { salirDePantallaCompleta(doc); return; }
		const el = contenedorCompleto(doc, host);
		if (typeof el.requestFullscreen !== 'function') { return; }
		el.classList.add(COMPLETA);
		// SweetAlert, avisos PNotify (pedido, llamado, pago por la carta) y el dialogo "Por confirmar" se pintan en el body,
		// fuera de la pantalla completa: avisos-mesa.js crearPortal los muda adentro mientras dure (caja no sale).
		const soltarPortal = () => { const p = portal; portal = null; if (p) { try { p.soltar(); } catch (e) { avisar('error al devolver los avisos', e); } } };
		const alCambiar = () => {
			llevarSegun(doc, el);   // el panel de llevar y delivery: solo mientras este contenedor esta en pantalla completa
			if (doc.fullscreenElement === el) {
				ponerPortal(doc, el);
				return;
			}
			soltarPortal();
			el.classList.remove(COMPLETA);
			doc.removeEventListener('fullscreenchange', alCambiar);
		};
		doc.addEventListener('fullscreenchange', alCambiar);
		const p = el.requestFullscreen();
		if (p && typeof p.then === 'function') { p.then(null, e => { alCambiar(); console.warn('maqueta: pantalla completa', e); }); }
	}

	/** Los avisos y dialogos del body pasan al contenedor mientras este en pantalla completa (modulos ya cargados). */
	function ponerPortal(doc, el) {
		if (portal || !vista || !modulos) { return; }
		modulos.then(m => {
			if (!portal && doc.fullscreenElement === el && typeof m.crearPortal === 'function') { portal = m.crearPortal(doc, el); }
		}).then(null, e => avisar('no se pudieron traer los avisos a la pantalla completa', e));
	}

	/**
	 * Panel "Llevar · Delivery" (js/llevar-panel.js): lo pone la vista a la vista mientras su contenedor esta en
	 * pantalla completa y lo quita al salir. Si falla, un aviso y sin panel (nunca toca la maqueta ni el cobro).
	 */
	function llevarSegun(doc, el) {
		try {
			if (vista && vista.llevar) { vista.llevar(el, conPanelLlevar(doc, el)); }
		} catch (e) {
			avisar('error en el panel de llevar y delivery', e);
		}
	}

	/** Sale de pantalla completa solo si lo que se va a abrir (id) queda fuera de ella. */
	function salirSiNoSeVe(doc, id) {
		const fs = doc.fullscreenElement, el = doc.getElementById(id);
		if (!(fs && el && fs.contains(el))) { salirDePantallaCompleta(doc); }
	}
	/**
	 * Antes de abrir algo de la pagina (detalle del pedido, SweetAlert, acciones de camara): sus dialogos se pintan fuera
	 * de la maqueta y en pantalla completa no se verian.
	 */
	function salirDePantallaCompleta(doc) {
		if (!doc.fullscreenElement || typeof doc.exitFullscreen !== 'function') { return; }
		const p = doc.exitFullscreen();
		if (p && typeof p.then === 'function') { p.then(null, e => console.warn('maqueta: salir de pantalla completa', e)); }
	}

	/** "90% ocupación ▬ 45/50 mesas · 135 personas · 5 precuentas · 3 alertas" (personas y alertas solo si hay). */
	function pintarOcupacion(doc, el, o) {
		const barra = nodo(doc, 'span', 'maq-oc-barra'), relleno = nodo(doc, 'i');
		relleno.style.width = `${o.pct}%`;
		barra.append(relleno);
		const partes = [nodo(doc, 'b', '', `${o.pct}%`), ' ocupación ', barra, ` ${o.ocupadas}/${o.total} mesas`];
		if (o.personas != null) { partes.push(` · ${plural(o.personas, 'persona', 'personas')}`); }
		partes.push(' · ', nodo(doc, 'em', '', plural(o.precuentas, 'precuenta', 'precuentas')));
		if (o.alertas) { partes.push(' · ', nodo(doc, 'strong', '', plural(o.alertas, 'alerta', 'alertas'))); }
		el.replaceChildren(...partes);
	}

	// ---------------------------------------------------------------- vista de un area

	/** Lugar de la maqueta: donde estaba la grilla, hasta abajo de la ventana. */
	function ajustarAlto(host) {
		if (host.hidden) { return; }
		const arriba = host.getBoundingClientRect().top;
		host.style.height = `${Math.max(ALTO_MIN, Math.round(global.innerHeight - arriba - MARGEN_ABAJO))}px`;
	}

	function leerVista(llave) {
		try { return JSON.parse(global.localStorage.getItem(llave) || 'null'); } catch (e) { return null; }
	}
	function guardarVista(llave, texto) {
		try { global.localStorage.setItem(llave, texto); } catch (e) { /* sin localStorage: se vuelve a encuadrar */ }
	}

	const filtroActivo = v => (v.filtro.tipo === 'todo' ? null : v.filtro);

	/** Una entrada de pintarEstados (escena.js) por tarjeta; las mesas sin pieza llevan su lugar de "sin ubicar". */
	function entrada(v, el, ahora) {
		const m = v.mods.leerTarjeta(el, ahora);
		const p = m.ocupada && m.idpedido ? platos.get(llavePlatos(m)) : null;
		const e = { codigo: m.codigo, m, c: camaraDe(m.codigo), p: p == null ? null : p };
		const lugar = v.sinUbicar.get(m.clave);
		return lugar ? { ...e, sinUbicar: true, x: lugar.x, y: lugar.y } : e;
	}

	function ponerVisible(v, si) {
		if (v.visible === si) { return; }
		v.visible = si;
		v.host.hidden = !si;
		v.ui.ocupacion.hidden = !si;
		if (v.ui.whatsapp) { v.ui.whatsapp.el.hidden = !si; }
		if (si) { ocultarTarjetas(v.grid); ajustarAlto(v.host); } else { mostrarTarjetas(v.grid); }
	}

	// Un cuadro: vuelve a leer las tarjetas; si algo cambio, redibuja la escena y los rotulos una sola vez.
	function alCuadro(v) {
		v.raf = 0;
		if (!v.grid.isConnected) { soltarVista(v.grid); return; }   // la pagina quito la grilla: nada que mirar
		if (v.llevar) { v.llevar.refrescar(); }   // nunca lanza: si falla, el panel se quita solo
		pintarEspejoWhatsapp(v.ui && v.ui.whatsapp);
		const tarjetas = tarjetasDelArea(v.mods, v.grid, v.area);
		ponerVisible(v, enVista(v.grid, tarjetas));
		if (!v.visible) { return; }
		escucharCamaras();
		const ahora = Date.now();
		const lista = tarjetas.map(el => entrada(v, el, ahora));
		pedirPlatos(v, lista);
		const firma = JSON.stringify(lista);
		if (firma === v.firma) { return; }
		v.firma = firma;
		v.lista = lista;
		v.escena.pintarEstados(lista);
		aplicarFiltro(v);
	}
	function programar(v) {
		if (!v.raf && !v.muerta) { v.raf = requestAnimationFrame(seguro(() => alCuadro(v))); }
	}

	// Velo (solo si cambia: rearma mallas), rotulos y los controles de encima.
	function aplicarFiltro(v) {
		const { mods, lista } = v, f = filtroActivo(v);
		const dentro = f ? lista.filter(e => mods.enFiltro(e.m, e.c, f, v.umbral)).map(e => e.codigo) : null;
		const velo = dentro ? `f:${dentro.join('|')}` : '';
		if (velo !== v.velo) {
			v.velo = velo;
			v.escena.setVelo(dentro ? new Set(dentro) : null);
		}
		v.rotulos.pintar(lista, v.escena, f, v.umbral);
		if (v.avisos) { v.avisos.pintar(lista, v.escena); }
		pintarControles(v);
	}
	function pintarControles(v) {
		const { mods, lista } = v;
		const contar = tipo => lista.filter(e => mods.enFiltro(e.m, e.c, { tipo }, v.umbral)).length;
		const mozos = [...new Set(lista.map(e => e.m.mozo).filter(Boolean))].sort();
		v.ui.filtros.pintar(v.filtro, { alertas: contar('alertas'), cobrar: contar('cobrar') }, mozos);
		const q = v.filtro.tipo === 'buscar' ? v.filtro.q : '';
		v.ui.buscador.pintar(q, q ? lista.filter(e => mods.coincide(e.m, q)).slice(0, MAX_RESULTADOS) : null);
		const o = mods.ocupacion(lista), firma = JSON.stringify(o);
		if (firma !== v.firmaOcupacion) {
			v.firmaOcupacion = firma;
			pintarOcupacion(v.doc, v.ui.ocupacion, o);
		}
	}

	function elegirFiltro(v, f) {
		v.filtro = f;
		if (f.tipo !== 'buscar') { v.ui.buscador.limpiar(); }
		aplicarFiltro(v);
	}
	// Escribir busca; borrar todo vuelve a "Todo" (si el filtro era la busqueda) y suelta la mesa fijada.
	function buscar(v, q) {
		const texto = String(q);
		if (!texto.trim()) { v.rotulos.fijar(null); }
		elegirFiltro(v, texto.trim() ? { tipo: 'buscar', q: texto } : (v.filtro.tipo === 'buscar' ? TODO : v.filtro));
	}
	// La camara viaja a la mesa y deja su detalle a la vista.
	function irA(v, codigo) {
		v.rotulos.fijar(codigo);
		v.escena.irA(codigo);
	}

	/**
	 * Tocar la mesa = tocar su tarjeta: el mismo handler de siempre (xLoadDetallesPedido; la libre no hace nada).
	 * El codigo puede venir del plano ("5") y la tarjeta decir "05": se busca por claveMesa.
	 */
	function abrirMesa(v, codigo) {
		const clave = v.mods.claveMesa(codigo);
		const tarjeta = tarjetasDelArea(v.mods, v.grid, v.area).find(el => v.mods.claveMesa(codigoDe(el)) === clave);
		if (v.avisos) { v.avisos.atendida(codigo); }   // pidio, llama o pago por la carta: ya se abrio
		if (tarjeta) { abrirTarjeta(v, tarjeta, codigo); }
	}
	/** Abre el pedido de una tarjeta (mesa, para llevar o delivery): el mismo click de siempre. */
	function abrirTarjeta(v, tarjeta, que) {
		salirSiNoSeVe(v.doc, ID_DETALLE);   // el detalle va dentro de la pantalla completa del contenedor
		const $ = global.jQuery;
		try {
			if ($) { $(tarjeta).trigger('click'); } else { tarjeta.click(); }
		} catch (e) {
			// Fallo la pagina al abrir el pedido (igual que con la tarjeta): la maqueta sigue.
			console.error('maqueta: error al abrir la mesa', que, e);
		}
	}

	/** Con el panel: en pantalla completa o con el menu lateral cerrado (m_control_pedidos.js xMenuLateral). */
	function conPanelLlevar(doc, el) {
		if (doc.fullscreenElement === el && el.classList.contains(COMPLETA)) { return true; }
		return !!(doc.body && doc.body.classList && doc.body.classList.contains(MENU_CERRADO));
	}

	/** Pone (si) o quita el panel de llevar y delivery de la vista; el es el contenedor en pantalla completa. */
	function ponerLlevar(v, el, si) {
		if (!si || v.muerta) { quitarLlevar(v); return; }
		if (v.llevar || typeof v.mods.crearLlevar !== 'function' || operaOtraSede()) { return; }
		try {
			v.llevar = v.mods.crearLlevar({
				doc: v.doc, global, contenedor: el, junto: v.ui.ocupacion, grid: v.grid,
				abrir: tarjeta => abrirTarjeta(v, tarjeta, tarjeta.getAttribute('data-p')), avisar,
			});
		} catch (e) {
			avisar('no se pudo armar el panel de llevar y delivery', e);
			quitarLlevar(v);
		}
	}
	function quitarLlevar(v) {
		const l = v.llevar;
		v.llevar = null;
		if (!l) { return; }
		try { l.destruir(); } catch (e) { avisar('error al quitar el panel de llevar y delivery', e); }
	}

	// Contenedor + escena. false si la PC no tiene WebGL (crearEscena → null).
	function armarEscena(v, plano) {
		v.host = nodo(v.doc, 'div', 'maq-vivo');
		v.visible = enVista(v.grid, tarjetasDelArea(v.mods, v.grid, v.area));
		v.host.hidden = !v.visible;
		// encima del cartel "Preparando maqueta…" si esta: su alto se mide desde donde queda (ajustarAlto) y el cartel
		// pasa despues a taparla por dentro; debajo del cartel mediria 370 px de menos hasta redimensionar la ventana
		const antes = cargando && cargando.g === v.grid && cargando.el.parentNode === v.grid.parentNode ? cargando.el : v.grid;
		v.grid.parentNode.insertBefore(v.host, antes);
		v.deshacer.push(() => v.host.remove());
		v.deshacer.push(() => mostrarTarjetas(v.grid));   // antes de ocultar: un error al ocultar no deja la grilla escondida
		if (v.visible) { ocultarTarjetas(v.grid); ajustarAlto(v.host); }
		v.escena = v.mods.crearEscena(v.host, plano);
		if (!v.escena) { return false; }
		v.deshacer.push(() => v.escena.destruir());
		const guardada = leerVista(v.llave);
		if (guardada) { v.escena.setVista(guardada); }
		v.vistaGuardada = JSON.stringify(v.escena.vista());   // la de arranque no se vuelve a escribir
		return true;
	}

	/** Avisos de la carta virtual (avisos-mesa.js): opcionales; si no cargan o fallan, la maqueta sigue sin ellos. */
	function armarAvisos(v) {
		if (typeof v.mods.crearAvisosMesa !== 'function') { return; }
		try {
			v.avisos = v.mods.crearAvisosMesa({ doc: v.doc, global, host: v.host, abrir: seguro(codigo => abrirMesa(v, codigo)), avisar });
			v.deshacer.push(() => { const a = v.avisos; v.avisos = null; a.destruir(); });
		} catch (e) {
			avisar('no se pudieron armar los avisos de la carta', e);
			v.avisos = null;
		}
	}

	// Rotulos, controles, ocupacion en la barra de pestañas y los oyentes de la escena y la ventana.
	function armarControles(v, alPerder) {
		const { doc, escena, host } = v;
		v.rotulos = v.mods.crearRotulos(host, { abrir: seguro(codigo => abrirMesa(v, codigo)), accionCamara: seguro((codigo, accion) => accionCamara(doc, codigo, accion)) });
		v.deshacer.push(() => v.rotulos.destruir());
		armarAvisos(v);
		v.ui = {
			filtros: crearFiltros(doc, f => elegirFiltro(v, f)),
			buscador: crearBuscador(doc, { buscar: q => buscar(v, q), ir: codigo => irA(v, codigo) }),
			ocupacion: nodo(doc, 'span', 'maq-ocupacion'),
		};
		v.ui.ocupacion.hidden = !v.visible;
		host.append(v.ui.filtros.el, v.ui.buscador.el, crearZoom(doc, escena, host));
		const pestanas = doc.getElementById(ID_AREAS);
		(pestanas && pestanas.parentNode ? pestanas.parentNode : host).append(v.ui.ocupacion);
		v.deshacer.push(() => v.ui.ocupacion.remove());
		v.ui.whatsapp = pestanas && pestanas.parentNode ? crearEspejoWhatsapp(doc) : null;
		if (v.ui.whatsapp) {
			v.ui.whatsapp.el.hidden = !v.visible;
			pestanas.parentNode.insertBefore(v.ui.whatsapp.el, pestanas.nextSibling);
			pintarEspejoWhatsapp(v.ui.whatsapp);
			v.deshacer.push(() => v.ui.whatsapp.el.remove());
		}
		v.deshacer.push(() => quitarLlevar(v));
		// Cada cuadro repinta los rotulos; la vista se guarda solo si la camara se movio (arrastre, zoom, viaje), no
		// tras un redibujo por un cambio de mesa.
		v.deshacer.push(escena.alCambiarVista(seguro(() => {
			v.rotulos.pintar(v.lista, escena, filtroActivo(v), v.umbral);
			if (v.avisos) { v.avisos.pintar(v.lista, escena); }
			const ahora = JSON.stringify(escena.vista());
			if (ahora === v.vistaGuardada) { return; }
			clearTimeout(v.guardar);
			v.guardar = setTimeout(seguro(() => { guardarVista(v.llave, ahora); v.vistaGuardada = ahora; }), GUARDAR_VISTA_MS);
		})));
		v.deshacer.push(() => clearTimeout(v.guardar));
		v.deshacer.push(escena.alPerderContexto(seguro(alPerder)));
		// el menu lateral se abre o cierra con un resize (xMenuLateral): ahi tambien se pone o quita el panel de llevar
		const conPanel = () => { const el = contenedorCompleto(doc, host); ponerLlevar(v, el, conPanelLlevar(doc, el)); };
		const alRedimensionar = seguro(() => { ajustarAlto(host); conPanel(); });
		seguro(conPanel)();
		global.addEventListener('resize', alRedimensionar);
		v.deshacer.push(() => global.removeEventListener('resize', alRedimensionar));
	}

	// Cualquier cambio en la grilla (socket, cobro, precuenta, el reloj de 2 s) → un cuadro.
	function observar(v) {
		const obs = new MutationObserver(seguro(() => programar(v)));
		obs.observe(v.grid, { attributes: true, childList: true, subtree: true, characterData: true });
		v.deshacer.push(() => obs.disconnect());
		v.deshacer.push(() => { cancelAnimationFrame(v.raf); v.raf = 0; });
		programar(v);
	}

	/**
	 * Arma la maqueta del area actual sobre la grilla. null si la PC no tiene WebGL (no deja nada: tarjetas).
	 * @param {object} plano validado, sin las mesas que ya no existen
	 * @param {string[]} codigos del area en su orden (para ubicar las "sin ubicar")
	 * @returns {{grid: Element, area: string, version: number, refrescar: Function, destruir: Function}|null}
	 */
	function crearVista(mods, plano, codigos, alPerder) {
		const v = {
			mods, grid, doc: grid.ownerDocument, area: ctx.area, llave: `maq-vista-${ctx.sede}-${ctx.area}`,
			umbral: mods.ajustesConDefaults(plano.ajustes).muchoTiempoMin,
			sinUbicar: new Map(mods.ubicarSinUbicar(plano, codigos).map(s => [mods.claveMesa(s.codigo), s])),
			filtro: TODO, lista: [], firma: '', velo: '', firmaOcupacion: '', raf: 0, guardar: 0, vistaGuardada: '',
			muerta: false, deshacer: [], llevar: null,
		};
		// De atras para adelante; un paso que falla no impide los demas.
		const destruir = () => {
			v.muerta = true;
			while (v.deshacer.length) {
				try { v.deshacer.pop()(); } catch (e) { avisar('error al quitar la maqueta', e); }
			}
		};
		try {
			if (!armarEscena(v, plano)) { destruir(); return null; }
			armarControles(v, alPerder);
			observar(v);
		} catch (e) {
			destruir();
			throw e;
		}
		return { grid: v.grid, area: v.area, version: plano.version, refrescar: () => programar(v), destruir, llevar: (el, si) => ponerLlevar(v, el, si) };
	}

	// ---------------------------------------------------------------- que se muestra (tarjetas o maqueta)

	function quitarVista() {
		if (!vista) { return; }
		const v = vista;
		vista = null;
		v.destruir();
	}
	function soltarVista(g) {
		if (vista && vista.grid === g) { quitarVista(); }
	}

	function mostrarAviso() {
		if (aviso && aviso.parentNode) { return; }
		const doc = grid.ownerDocument;
		aviso = nodo(doc, 'div', 'maq-aviso', TEXTO_SIN_3D);
		aviso.setAttribute('role', 'status');
		aviso.append(boton(doc, 'maq-aviso-x', '×', 'Cerrar aviso', () => aviso.remove()));
		grid.parentNode.insertBefore(aviso, grid);
	}
	// La PC perdio el 3D (driver, memoria): tarjetas y aviso; no se reintenta hasta recargar.
	function alPerderContexto() {
		sinWebgl = true;
		avisar('se perdio el dibujo 3D; se vuelve a las tarjetas');
		quitarVista();
		mostrarAviso();
	}

	function ponerBotonArmar(puede, area) {
		const a = grid.ownerDocument.getElementById(ID_ARMAR);
		if (!a) { return; }
		a.classList.toggle('xInvisible', !puede);
		a.setAttribute('href', URL_EDITOR + encodeURIComponent(area));
	}

	/** Codigos del area en su orden (mesasDelArea, como xPintarMesas); sede sin areas: los de las tarjetas. */
	function codigosDelArea(mods) {
		const a = ctx.areas.find(x => x && sinEspacios(x.title) === ctx.area);
		return a ? mods.mesasDelArea(a, ctx.alfanumerica) : tarjetasDelArea(mods, grid, ctx.area).map(codigoDe);
	}
	/** El plano sin las mesas que ya no existen en el area (se achico el rango: en vivo no se dibujan), validado. */
	function planoVivo(mods, plano, codigos) {
		const claves = new Set(codigos.map(mods.claveMesa));
		const existe = p => !(p && p.t === 'mesa') || claves.has(mods.claveMesa(p.codigo));
		return mods.validarPlano({ ...plano, piezas: Array.isArray(plano.piezas) ? plano.piezas.filter(existe) : plano.piezas });
	}

	// Con lo ultimo que dijo el servidor: maqueta del area actual (la misma si no cambio su version) o tarjetas.
	async function elegir() {
		const mio = ++genElegir;
		try {
			await elegirMaqueta(mio);
		} finally {
			if (mio === genElegir) { quitarCargando(); }   // ya se decidio: maqueta lista o tarjetas
		}
	}
	async function elegirMaqueta(mio) {
		if (!grid || !datos) { return; }
		ponerBotonArmar(datos.puedeEditar, ctx.area);
		const plano = datos.activo && !roto && !sinWebgl ? datos.planos.find(p => p && p.area === ctx.area) : null;
		if (!plano) { quitarVista(); return; }
		if (vista && vista.grid === grid && vista.area === ctx.area && vista.version === plano.version) { vista.refrescar(); return; }
		const [mods] = await Promise.all([cargarModulos(), ponerCss(grid.ownerDocument)]);
		if (mio !== genElegir) { return; }
		quitarVista();
		const codigos = codigosDelArea(mods);
		const valido = planoVivo(mods, plano, codigos);
		if (!valido.ok) { avisar(`el plano del area "${ctx.area}" no es valido (${valido.error}); se ven las tarjetas`); return; }
		vista = crearVista(mods, valido.plano, codigos, alPerderContexto);
		const fs = grid.ownerDocument.fullscreenElement;   // otra area con la pantalla completa ya puesta: su panel
		if (vista && fs && fs.classList && fs.classList.contains(COMPLETA)) { llevarSegun(grid.ownerDocument, fs); }
		if (!vista) {
			sinWebgl = true;
			avisar('esta PC no tiene WebGL; se ven las tarjetas');
			mostrarAviso();
		}
	}

	// op=planos y elegir. Sin conexion: queda lo que habia (tarjetas o la ultima maqueta).
	async function actualizar() {
		const mio = ++genPedido;
		let d;
		try {
			d = await pedirPlanos();
		} catch (e) {
			avisar('no se pudo leer la maqueta de la sede', e);
			if (!datos) { quitarCargando(); }   // sin respuesta y sin nada leido antes: las tarjetas
			return;
		}
		if (mio !== genPedido || !grid) { return; }
		datos = d;
		recordarAreas(d);
		await elegir();
	}

	// Pestaña de area: decide al instante con lo ya leido y, si la maqueta esta activa, vuelve a pedir los planos
	// (un plano guardado desde otra PC se ve al cambiar de pestaña, spec §12).
	function alCambiarArea(e) {
		ctx = { ...ctx, area: sinEspacios(e && e.detail ? e.detail.title : '') };
		quitarCargando();   // el cartel es solo para la primera carga: entre areas se pasa directo
		if (!datos) { return null; }   // la primera respuesta aun no llega: ella elige
		return Promise.all([elegir(), datos.activo ? actualizar() : null]);
	}
	function escucharAreas() {
		const comp = grid.ownerDocument.getElementById(ID_AREAS);
		if (oyenteArea && oyenteArea.el === comp) { return; }
		dejarDeEscucharAreas();
		if (!comp) { return; }
		const fn = seguro(alCambiarArea);
		comp.addEventListener('onChangeTitle', fn);
		oyenteArea = { el: comp, fn };
	}
	function dejarDeEscucharAreas() {
		if (!oyenteArea) { return; }
		oyenteArea.el.removeEventListener('onChangeTitle', oyenteArea.fn);
		oyenteArea = null;
	}

	/**
	 * Pestaña de call center operando otra sede (window.opSede de app/view/op_sede.service.js, permiso A27):
	 * log_maqueta no pasa por log_pos_op y traeria los planos de la sede de la sesion, no los de la que se ve. Ahi solo
	 * tarjetas. Si opSede falla al responder, tambien tarjetas: nunca mezclar el plano de una sede con otra.
	 */
	function operaOtraSede() {
		const op = global.opSede;
		if (!op || typeof op.isOverride !== 'function') { return false; }
		try {
			return op.isOverride() === true;
		} catch (e) {
			avisar('no se pudo saber que sede opera la pestaña; se ven las tarjetas', e);
			return true;
		}
	}

	/**
	 * Engancha la maqueta a la grilla de Control de pedidos. Se puede llamar muchas veces (xPintarMesas): vuelve a
	 * pedir los planos y conserva la escena si el area y la version no cambiaron. Con la pestaña operando otra sede
	 * (call center) desmonta y quedan las tarjetas. Nunca lanza.
	 * @param {Element} g la .grid de las tarjetas
	 * @param {{areaActual: string, alfanumerica: boolean, areas: object[], sede: string|number}} c areaActual: titulo
	 *   del area a la vista ('' sin areas); areas: las de xGetAreaMesas (title, desde, hasta, prefijo)
	 */
	function montar(g, c) {
		try {
			if (!g || !g.parentNode || !g.ownerDocument || !c) { return; }
			if (operaOtraSede()) { desmontar(); return; }
			if (grid !== g) { quitarVista(); }
			grid = g;
			ctx = {
				area: sinEspacios(c.areaActual), alfanumerica: !!c.alfanumerica,
				areas: Array.isArray(c.areas) ? c.areas : [], sede: String(c.sede == null ? '' : c.sede),
			};
			escucharAreas();
			mostrarCargando();
			actualizar().then(null, fallar);
		} catch (e) {
			fallar(e);
		}
	}

	/** Quita la maqueta y sus oyentes: las tarjetas de siempre. */
	function desmontar() {
		try {
			genPedido++;
			genElegir++;
			quitarVista();
			quitarCargando();
			dejarDeEscucharAreas();
			if (aviso) { aviso.remove(); aviso = null; }
			const a = grid ? grid.ownerDocument.getElementById(ID_ARMAR) : null;
			if (a) { a.classList.add('xInvisible'); }
			grid = null;
			ctx = null;
			datos = null;
		} catch (e) {
			avisar('error al desmontar la maqueta', e);
		}
	}

	const api = { montar, desmontar, _cargar: cargar };
	global.MaquetaVivo = api;
}(typeof window !== 'undefined' ? window : this));
