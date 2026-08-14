// carta.diseno.js — "Diseñar carta": plantillas listas para imprimir o subir a redes,
// rellenadas con las secciones/items visibles al cliente de la carta actual (xdtCAct).
// Export PNG con dom-to-image (ya cargado en m_panel.html). Sin backend.
(function () {

	const FORMATOS = {
		a4:    { nombre: 'A4 (imprimir)',    w: 1240, h: 1754 },
		a5:    { nombre: 'A5 (2 por hoja A4)', w: 874, h: 1240 },
		a5solo:{ nombre: 'A5 (hoja suelta)',   w: 874, h: 1240 },
		post:  { nombre: 'Post 1080×1350',  w: 1080, h: 1350 },
		story: { nombre: 'Story 1080×1920', w: 1080, h: 1920 }
	};
	const PLANTILLAS = [
		{ id: 'elegante', nombre: 'Elegante', swatch: '#b99d5b' },
		{ id: 'pizarra',  nombre: 'Pizarra',  swatch: '#20272e' },
		{ id: 'minimal',  nombre: 'Minimal',  swatch: '#ffffff' },
		{ id: 'rustico',  nombre: 'Rústico',  swatch: '#7a4f2b' },
		{ id: 'bistro',   nombre: 'Bistró',   swatch: '#4d1c21' },
		{ id: 'tropical', nombre: 'Tropical', swatch: '#3aa06b' },
		{ id: 'botanico',  nombre: 'Botánico',  swatch: '#b8cba0' },
		{ id: 'editorial', nombre: 'Editorial', swatch: '#d9d9d9' },
		{ id: 'cinta',     nombre: 'Cintas',    swatch: '#111111' },
		{ id: 'retro',     nombre: 'Retro',     swatch: '#c8352e' },
		{ id: 'brunch',    nombre: 'Brunch',    swatch: '#fbe3d6' },
		{ id: 'columnas',  nombre: 'Columnas',  swatch: '#e5e0d3' },
		{ id: 'vintage',   nombre: 'Vintage',   swatch: '#d8433a' }
	];

	// columnas fijas por plantilla (el resto decide solo segun cantidad de items)
	const TPL_COLS = { editorial: 1, cinta: 2, retro: 2, brunch: 2, columnas: 2 };

	const FUENTES = [
		{ id: 'auto',    nombre: 'De la plantilla', css: '' },
		{ id: 'serif',   nombre: 'Serif clásica',   css: "Georgia,'Times New Roman',serif" },
		{ id: 'moderna', nombre: 'Moderna',          css: "'Segoe UI',Helvetica,Arial,sans-serif" },
		{ id: 'script',  nombre: 'Manuscrita',       css: "'Segoe Script','Comic Sans MS',cursive" },
		{ id: 'conden',  nombre: 'Condensada',       css: "'Arial Narrow',Arial,sans-serif" },
		{ id: 'maquina', nombre: 'Máquina de escribir', css: "'Courier New',monospace" },
		// woff2 propias en css/fonts-carta (se ven igual en cualquier navegador/dispositivo)
		{ id: 'playfair',   nombre: 'Playfair (elegante)',    css: "'DC Playfair',Georgia,serif" },
		{ id: 'dancing',    nombre: 'Dancing (manuscrita)',   css: "'DC Dancing','Segoe Script',cursive" },
		{ id: 'oswald',     nombre: 'Oswald (condensada)',    css: "'DC Oswald','Arial Narrow',sans-serif" },
		{ id: 'lobster',    nombre: 'Lobster (retro)',        css: "'DC Lobster','Comic Sans MS',cursive" },
		{ id: 'montserrat', nombre: 'Montserrat (moderna)',   css: "'DC Montserrat','Segoe UI',sans-serif" }
	];

	// @font-face de las fuentes propias (ruta relativa a app/page/, donde vive m_panel)
	const FONT_FACES = ['playfair', 'dancing', 'oswald', 'lobster', 'montserrat'].map(function (n) {
		return '@font-face{font-family:\'DC ' + n.charAt(0).toUpperCase() + n.slice(1) + '\';' +
			'src:url(\'../../css/fonts-carta/' + n + '.woff2\') format(\'woff2\');font-display:swap;}';
	}).join('');

	// ornamentos SVG inline (data URI: sin requests externos, el export PNG nunca falla por CORS)
	const SVG_CUTLERY = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 32' fill='%235c3a1e'%3E%3Cpath d='M14 2v9a4 4 0 0 0 3 3.9V30h2V14.9A4 4 0 0 0 22 11V2h-2v8h-1V2h-2v8h-1V2z'/%3E%3Cpath d='M46 2c-3 0-5 6-5 11 0 3 1 5 3 5.7V30h2V2z'/%3E%3C/svg%3E\")";
	const SVG_FLOURISH = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 12'%3E%3Cpath d='M2 6 Q30 -2 54 6' fill='none' stroke='%23c9a34e' stroke-width='1.5'/%3E%3Cpath d='M66 6 Q90 14 118 6' fill='none' stroke='%23c9a34e' stroke-width='1.5'/%3E%3Crect x='57' y='3' width='6' height='6' transform='rotate(45 60 6)' fill='%23c9a34e'/%3E%3C/svg%3E\")";
	const SVG_LEAF = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Cpath d='M0 0 C 45 5 75 30 82 75 C 55 70 20 45 0 0 Z' fill='%233aa06b' opacity='.9'/%3E%3Cpath d='M0 30 C 30 38 50 55 55 88 C 33 82 10 60 0 30 Z' fill='%23ef8b3f' opacity='.85'/%3E%3C/svg%3E\")";
	const SVG_SAGE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120' fill='none' stroke='%23b8cba0' stroke-width='2'%3E%3Cpath d='M10 110 C 30 70 60 40 105 12'/%3E%3Cpath d='M38 78 C 20 70 12 55 14 38 C 30 48 38 62 38 78 Z'/%3E%3Cpath d='M62 55 C 46 48 38 34 40 18 C 55 28 62 40 62 55 Z'/%3E%3Cpath d='M52 88 C 62 72 78 64 95 66 C 85 80 70 88 52 88 Z'/%3E%3C/svg%3E\")";
	const SVG_SPRIG = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 160' fill='none' stroke='%231c1c1c' stroke-width='1.4'%3E%3Cpath d='M40 160 C 40 110 40 60 40 10'/%3E%3Cpath d='M40 80 C 25 70 18 55 20 40 C 33 50 40 63 40 80 Z'/%3E%3Cpath d='M40 50 C 55 42 62 30 60 15 C 48 24 41 36 40 50 Z'/%3E%3Cpath d='M40 120 C 26 112 20 100 21 86 C 33 95 39 106 40 120 Z'/%3E%3C/svg%3E\")";
	const SVG_SPRIG_CAFE = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 80 160' fill='none' stroke='%23a5836a' stroke-width='1.6'%3E%3Cpath d='M40 160 C 40 110 40 60 40 10'/%3E%3Cpath d='M40 80 C 25 70 18 55 20 40 C 33 50 40 63 40 80 Z'/%3E%3Cpath d='M40 50 C 55 42 62 30 60 15 C 48 24 41 36 40 50 Z'/%3E%3Cpath d='M40 120 C 26 112 20 100 21 86 C 33 95 39 106 40 120 Z'/%3E%3C/svg%3E\")";

	const sel = { tpl: 'elegante', fmt: 'post', precios: true, font: 'auto', bg: '', page: 0, orient: 'v' };

	// dimensiones del formato actual segun orientacion
	function dimsFmt() {
		const f = FORMATOS[sel.fmt];
		return sel.orient === 'h' ? { w: f.h, h: f.w } : { w: f.w, h: f.h };
	}

	// ---------- datos ----------
	function limpiarTxt(v) {
		if (v === null || v === undefined) { return ''; }
		v = String(v).trim();
		return (v === 'null' || v === 'undefined') ? '' : v;
	}
	function esc(v) {
		return limpiarTxt(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	}

	// secciones/items visibles al cliente (is_visible_cliente* === '1' significa OCULTO)
	function getSecciones() {
		const secs = [];
		let cur = null;
		(window.xdtCAct || []).forEach(function (r) {
			if (String(r.is_visible_cliente_seccion) === '1') { return; }
			if (String(r.is_visible_cliente) === '1') { return; }
			if (!cur || cur.id !== r.idseccion) {
				cur = { id: r.idseccion, nombre: limpiarTxt(r.des_seccion), items: [] };
				secs.push(cur);
			}
			cur.items.push({
				des: limpiarTxt(r.des_item),
				precio: limpiarTxt(r.precio),
				detalle: limpiarTxt(r.detalle),
				star: String(r.is_recomendacion) === '1'
			});
		});
		return secs.filter(function (s) { return s.nombre !== '' && s.items.length > 0; });
	}

	function datosSede() {
		try { return xm_log_get('datos_org_sede')[0] || {}; } catch (e) { return {}; }
	}

	// ---------- overlay ----------
	function montarOverlay() {
		if (document.getElementById('dcx_overlay')) {
			document.getElementById('dcx_overlay').style.display = 'flex';
			return;
		}
		const org = datosSede();
		const pieDef = [limpiarTxt(org.sededireccion), limpiarTxt(org.sedetelefono)].filter(Boolean).join(' • ');
		const chips = PLANTILLAS.map(function (p) {
			return '<button class="dcx-chip" data-tpl="' + p.id + '"><span class="dcx-sw" style="background:' + p.swatch + '"></span>' + p.nombre + '</button>';
		}).join('');
		const fmts = Object.keys(FORMATOS).map(function (k) {
			return '<option value="' + k + '">' + FORMATOS[k].nombre + '</option>';
		}).join('');

		const ov = document.createElement('div');
		ov.id = 'dcx_overlay';
		ov.innerHTML =
			'<div class="dcx-panel">' +
				'<div class="dcx-ctrl">' +
					'<h4 style="margin:0 0 10px 0;">Diseñar carta</h4>' +
					'<label class="dcx-lbl">Plantilla</label>' +
					'<div id="dcx_chips">' + chips + '</div>' +
					'<label class="dcx-lbl">Formato</label>' +
					'<select id="dcx_fmt" class="dcx-in">' + fmts + '</select>' +
					'<div style="display:flex;gap:6px;margin-top:4px;">' +
						'<button class="dcx-chip" id="dcx_or_v">▯ Vertical</button>' +
						'<button class="dcx-chip" id="dcx_or_h">▭ Horizontal</button>' +
					'</div>' +
					'<label class="dcx-lbl">Tipo de letra</label>' +
					'<select id="dcx_font" class="dcx-in">' +
						FUENTES.map(function (f) { return '<option value="' + f.id + '">' + f.nombre + '</option>'; }).join('') +
					'</select>' +
					'<label class="dcx-lbl">Color de fondo</label>' +
					'<div style="display:flex;gap:8px;align-items:center;">' +
						'<input id="dcx_bg" type="color" value="#ffffff" style="width:44px;height:28px;padding:1px;border:1px solid #ccc;border-radius:4px;cursor:pointer;">' +
						'<button id="dcx_bg_reset" class="dcx-chip" title="Volver al fondo de la plantilla">Restaurar</button>' +
					'</div>' +
					'<label class="dcx-lbl">Nombre del local</label>' +
					'<input id="dcx_titulo" class="dcx-in" type="text" value="' + esc(org.sedenombre) + '">' +
					'<label class="dcx-lbl">Subtítulo</label>' +
					'<input id="dcx_sub" class="dcx-in" type="text">' +
					'<label class="dcx-lbl">Pie de página</label>' +
					'<input id="dcx_pie" class="dcx-in" type="text" value="' + esc(pieDef) + '">' +
					'<div style="display:flex;gap:12px;align-items:center;margin-top:8px;">' +
						'<label style="font-size:12px;"><input id="dcx_precios" type="checkbox" checked> Mostrar precios</label>' +
						'<input id="dcx_moneda" class="dcx-in" type="text" value="S/" style="width:50px;margin:0;" title="Símbolo de moneda">' +
					'</div>' +
					'<div id="dcx_nav" style="display:none;align-items:center;gap:10px;margin-top:12px;">' +
						'<button class="dcx-chip" id="dcx_pg_prev">◀</button>' +
						'<span id="dcx_pg_lbl" style="font-size:12px;">Hoja 1 de 1</span>' +
						'<button class="dcx-chip" id="dcx_pg_next">▶</button>' +
					'</div>' +
					'<div id="dcx_aviso" style="display:none;color:#c0392b;font-size:12px;margin-top:8px;">⚠ Una sección tiene demasiados items para una hoja y se recortará: divídela o usa formato Story/A4.</div>' +
					'<div style="margin-top:16px;">' +
						'<div class="xBoton2 xVerde" id="dcx_btn_png">Descargar PNG</div>' +
						'<div class="xBoton2 xAzul" id="dcx_btn_print">Imprimir</div>' +
						'<div class="xBoton2 xPlomo" id="dcx_btn_close">Cerrar</div>' +
					'</div>' +
				'</div>' +
				'<div class="dcx-prev" id="dcx_prev"><div id="dcx_scaler"><div id="dcx_node" class="dc-node"></div></div></div>' +
			'</div>';
		document.body.appendChild(ov);
		inyectarCss();

		// eventos
		ov.querySelectorAll('.dcx-chip').forEach(function (b) {
			b.onclick = function () { sel.tpl = b.dataset.tpl; render(); };
		});
		document.getElementById('dcx_fmt').onchange = function (e) { sel.fmt = e.target.value; render(); };
		document.getElementById('dcx_or_v').onclick = function () { sel.orient = 'v'; render(); };
		document.getElementById('dcx_or_h').onclick = function () { sel.orient = 'h'; render(); };
		document.getElementById('dcx_font').onchange = function (e) { sel.font = e.target.value; render(); };
		document.getElementById('dcx_bg').oninput = function (e) { sel.bg = e.target.value; render(); };
		document.getElementById('dcx_bg_reset').onclick = function () {
			sel.bg = '';
			sel.font = 'auto';
			document.getElementById('dcx_font').value = 'auto';
			document.getElementById('dcx_bg').value = '#ffffff';
			render();
		};
		document.getElementById('dcx_pg_prev').onclick = function () { sel.page--; render(); };
		document.getElementById('dcx_pg_next').onclick = function () { sel.page++; render(); };
		['dcx_titulo', 'dcx_sub', 'dcx_pie', 'dcx_moneda'].forEach(function (id) {
			document.getElementById(id).oninput = render;
		});
		document.getElementById('dcx_precios').onchange = function (e) { sel.precios = e.target.checked; render(); };
		document.getElementById('dcx_btn_close').onclick = function () { ov.style.display = 'none'; };
		document.getElementById('dcx_btn_png').onclick = descargarPNG;
		document.getElementById('dcx_btn_print').onclick = imprimirDiseno;

		// subtitulo por defecto: nombre de la carta seleccionada
		const $selCarta = document.querySelector('.SelCarta');
		if ($selCarta && $selCarta.selectedIndex >= 0) {
			document.getElementById('dcx_sub').value = $selCarta.options[$selCarta.selectedIndex].text;
		}
	}

	// ---------- render ----------
	let paginas = [[]]; // secciones repartidas por hoja

	function pintarPagina(secciones) {
		const f = dimsFmt();
		const node = document.getElementById('dcx_node');
		const conPrecios = sel.precios;
		const moneda = document.getElementById('dcx_moneda').value;
		const totalItems = secciones.reduce(function (a, s) { return a + s.items.length; }, 0);

		let h = '<div class="dc-head"><div class="dc-titulo">' + esc(document.getElementById('dcx_titulo').value) + '</div>' +
			'<div class="dc-sub">' + esc(document.getElementById('dcx_sub').value) + '</div></div><div class="dc-body">';
		secciones.forEach(function (s) {
			h += '<div class="dc-sec"><div class="dc-sec-t"><span>' + esc(s.nombre) + '</span></div>';
			s.items.forEach(function (it) {
				h += '<div class="dc-item"><span class="dc-item-l"><span class="dc-des">' + (it.star ? '★ ' : '') + esc(it.des) + '</span>' +
					(it.detalle ? '<span class="dc-det">' + esc(it.detalle) + '</span>' : '') + '</span>' +
					(conPrecios ? '<span class="dc-dots"></span><span class="dc-precio">' + esc(moneda) + ' ' + esc(it.precio) + '</span>' : '') +
					'</div>';
			});
			h += '</div>';
		});
		h += '</div><div class="dc-pie">' + esc(document.getElementById('dcx_pie').value) +
			'<div class="dc-brand">papaya.com.pe</div></div>';

		node.className = 'dc-node tpl-' + sel.tpl + (sel.font !== 'auto' ? ' dc-font-override' : '');
		node.style.width = f.w + 'px';
		node.style.height = f.h + 'px';
		node.style.fontSize = (Math.min(f.w, f.h) / 64) + 'px'; // escala por el lado menor: mismo tamaño en v y h
		// personalizacion: fuente y fondo (vacio = usa lo de la plantilla)
		const fuente = FUENTES.find(function (x) { return x.id === sel.font; });
		node.style.fontFamily = (fuente && fuente.css) || '';
		node.style.background = sel.bg || '';
		node.innerHTML = h;
		node.querySelector('.dc-body').style.columnCount =
			TPL_COLS[sel.tpl] || (totalItems > (sel.fmt === 'story' ? 20 : 14) ? 2 : 1);

		// escala de la vista previa
		const prev = document.getElementById('dcx_prev');
		const s = Math.min((prev.clientWidth - 30) / f.w, (prev.clientHeight - 30) / f.h, 1);
		node.style.transform = 'scale(' + s + ')';
		node.style.transformOrigin = 'top left';
		const scaler = document.getElementById('dcx_scaler');
		scaler.style.width = (f.w * s) + 'px';
		scaler.style.height = (f.h * s) + 'px';
	}

	// el desborde ocurre DENTRO de .dc-body (alto fijo + columnas: lo extra se va a lo ancho)
	function cabePagina() {
		const b = document.getElementById('dcx_node').querySelector('.dc-body');
		return b.scrollHeight <= b.clientHeight + 2 && b.scrollWidth <= b.clientWidth + 2;
	}

	function render() {
		// chips activos
		document.querySelectorAll('.dcx-chip[data-tpl]').forEach(function (b) {
			b.classList.toggle('dcx-chip-on', b.dataset.tpl === sel.tpl);
		});
		document.getElementById('dcx_or_v').classList.toggle('dcx-chip-on', sel.orient === 'v');
		document.getElementById('dcx_or_h').classList.toggle('dcx-chip-on', sel.orient === 'h');

		// paginado: reparte secciones en hojas midiendo sobre el nodo real
		const todas = getSecciones();
		paginas = [];
		let resto = todas.slice();
		if (resto.length === 0) { paginas = [[]]; }
		while (resto.length > 0 && paginas.length < 9) {
			let n = resto.length;
			pintarPagina(resto.slice(0, n));
			while (n > 1 && !cabePagina()) {
				n--;
				pintarPagina(resto.slice(0, n));
			}
			paginas.push(resto.slice(0, n));
			resto = resto.slice(n);
		}
		if (sel.page > paginas.length - 1) { sel.page = paginas.length - 1; }
		if (sel.page < 0) { sel.page = 0; }
		pintarPagina(paginas[sel.page]);

		// navegacion de hojas
		document.getElementById('dcx_pg_lbl').textContent = 'Hoja ' + (sel.page + 1) + ' de ' + paginas.length;
		document.getElementById('dcx_nav').style.display = paginas.length > 1 ? 'flex' : 'none';

		// aviso solo si una seccion sola no entra ni en su propia hoja
		document.getElementById('dcx_aviso').style.display = cabePagina() ? 'none' : 'block';

		guardarPrefs();
	}

	// ---------- export ----------
	// genera el PNG de cada hoja y vuelve a dejar la hoja que se estaba viendo
	async function exportarPaginas() {
		if (typeof domtoimage === 'undefined') { throw new Error('domtoimage no cargado'); }
		const f = dimsFmt();
		const node = document.getElementById('dcx_node');
		const urls = [];
		for (let i = 0; i < paginas.length; i++) {
			pintarPagina(paginas[i]);
			urls.push(await domtoimage.toPng(node, { width: f.w, height: f.h, style: { transform: 'none' } }));
		}
		pintarPagina(paginas[sel.page]);
		return urls;
	}

	function descargarPNG() {
		xPopupLoad.xopen();
		exportarPaginas().then(function (urls) {
			urls.forEach(function (url, i) {
				setTimeout(function () { // pausa entre descargas para que el navegador no bloquee
					const a = document.createElement('a');
					a.href = url;
					a.download = 'carta-' + sel.tpl + '-' + sel.fmt + (urls.length > 1 ? '-hoja' + (i + 1) : '') + '.png';
					a.click();
				}, i * 500);
			});
			xPopupLoad.xclose();
			ToastAlertSwal.fire({ icon: 'success', title: urls.length > 1 ? urls.length + ' imágenes descargadas' : 'Imagen descargada' });
		}).catch(function () {
			xPopupLoad.xclose();
			showAlertSwalOk('error', 'Error', 'No se pudo generar la imagen. Recargue la página e intente nuevamente.');
		});
	}

	function imprimirDiseno() {
		// abrir la ventana ANTES del await para no ser bloqueados por el popup blocker
		const w = window.open('', '_blank');
		if (!w) { showAlertSwalOk('info', 'Popup bloqueado', 'Permita ventanas emergentes para imprimir.'); return; }
		// La hoja fisica SIEMPRE se imprime en vertical (Chrome no deja forzar horizontal
		// desde CSS): los disenos horizontales se giran 90° para llenar la hoja.
		const esA5 = sel.fmt === 'a5';
		const horiz = sel.orient === 'h';
		let cssPrint = '@page{margin:0}body{margin:0}.par{page-break-after:always;overflow:hidden}';
		if (esA5 && !horiz) {
			// 2 copias A5 verticales, giradas y apiladas: cortar a la mitad
			cssPrint += '.a5{width:210mm;height:148.5mm;overflow:hidden}' +
				'.a5 img{width:148.5mm;height:210mm;transform:translateX(210mm) rotate(90deg);transform-origin:0 0;}';
		} else if (esA5 && horiz) {
			// 2 copias A5 horizontales: se apilan directo, sin girar
			cssPrint += '.a5{width:210mm;height:148.5mm;overflow:hidden}' +
				'.a5 img{width:210mm;height:148.5mm;display:block}';
		} else if (horiz) {
			// hoja completa horizontal: girada para llenar la hoja vertical
			// (papel A5 si es hoja suelta, A4 en el resto)
			const pw = sel.fmt === 'a5solo' ? 148 : 210;
			const ph = sel.fmt === 'a5solo' ? 210 : 297;
			cssPrint += '.par{width:' + pw + 'mm;height:' + ph + 'mm}' +
				'.par img{width:' + ph + 'mm;height:' + pw + 'mm;transform:translateX(' + pw + 'mm) rotate(90deg);transform-origin:0 0;}';
		} else {
			cssPrint += '.par img{width:100%;display:block}';
		}
		w.document.write('<html><head><title>Carta</title><style>' + cssPrint + '</style></head><body>Generando...</body></html>');
		exportarPaginas().then(function (urls) {
			w.document.body.innerHTML = urls.map(function (u, i) {
				const onload = i === urls.length - 1 ? ' onload="setTimeout(function(){window.print()},300)"' : '';
				return esA5
					? '<div class="par"><div class="a5"><img src="' + u + '"></div><div class="a5"><img src="' + u + '"' + onload + '></div></div>'
					: '<div class="par"><img src="' + u + '"' + onload + '></div>';
			}).join('');
		}).catch(function () {
			w.close();
			showAlertSwalOk('error', 'Error', 'No se pudo generar la impresión.');
		});
	}

	// ---------- css ----------
	function inyectarCss() {
		if (document.getElementById('dcx_css')) { return; }
		const css =
		FONT_FACES +
		/* overlay */
		'#dcx_overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;}' +
		'.dcx-panel{background:#fff;border-radius:10px;width:94vw;height:92vh;display:flex;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.35);}' +
		'.dcx-ctrl{width:270px;min-width:270px;padding:18px;overflow-y:auto;border-right:1px solid #e5e5e5;font-family:inherit;}' +
		'.dcx-prev{flex:1;background:#8d8d94;display:flex;align-items:center;justify-content:center;overflow:auto;padding:15px;}' +
		'#dcx_scaler{overflow:hidden;box-shadow:0 4px 25px rgba(0,0,0,.45);}' +
		'.dcx-lbl{display:block;font-size:11px;color:#777;margin:10px 0 2px;text-transform:uppercase;letter-spacing:.05em;}' +
		'.dcx-in{width:100%;padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;margin-bottom:2px;}' +
		'.dcx-chip{display:inline-flex;align-items:center;gap:6px;margin:2px 4px 2px 0;padding:5px 10px;border:1px solid #ccc;border-radius:16px;background:#fff;cursor:pointer;font-size:12px;}' +
		'.dcx-chip-on{border-color:#2196f3;box-shadow:0 0 0 2px rgba(33,150,243,.25);}' +
		'.dcx-sw{width:14px;height:14px;border-radius:50%;border:1px solid #bbb;display:inline-block;}' +
		/* base plantilla */
		'.dc-node{position:relative;overflow:hidden;display:flex;flex-direction:column;}' +
		'.dc-node,.dc-node *{box-sizing:border-box;margin:0;}' +
		'.dc-head,.dc-body,.dc-pie{position:relative;}' + /* por encima de los fondos ::before */
		'.dc-head{text-align:center;margin-bottom:1.6em;}' +
		'.dc-titulo{font-size:2.5em;line-height:1.1;}' +
		'.dc-sub{font-size:1em;letter-spacing:.35em;text-transform:uppercase;margin-top:.5em;opacity:.85;}' +
		'.dc-body{flex:1;overflow:hidden;column-gap:2.5em;}' +
		'.dc-sec{break-inside:avoid;margin-bottom:1.7em;}' +
		'.dc-sec-t{margin-bottom:.6em;}' +
		'.dc-item{display:flex;align-items:baseline;margin:.5em 0;}' +
		'.dc-item-l{display:inline-flex;flex-direction:column;max-width:75%;}' +
		'.dc-det{font-size:.7em;opacity:.7;line-height:1.25;}' +
		'.dc-dots{flex:1;margin:0 .55em;border-bottom:.13em dotted currentColor;opacity:.35;min-width:1.5em;}' +
		'.dc-precio{white-space:nowrap;font-weight:700;}' +
		'.dc-pie{text-align:center;font-size:.8em;opacity:.85;padding-top:1em;}' +
		'.dc-brand{font-size:.95em;font-weight:700;letter-spacing:.28em;opacity:.8;margin-top:.55em;}' +
		'.dc-font-override *{font-family:inherit!important;}' + /* solo hijos: el nodo usa su style inline */
		/* elegante */
		'.tpl-elegante{background:#f7f2e7;color:#3b3327;font-family:Georgia,\'Times New Roman\',serif;padding:4.5em 4em;}' +
		'.tpl-elegante::before{content:\'\';position:absolute;top:1.3em;left:1.3em;right:1.3em;bottom:1.3em;border:.22em double #b99d5b;pointer-events:none;}' +
		'.tpl-elegante .dc-titulo{color:#5d4a1f;font-variant:small-caps;letter-spacing:.08em;}' +
		'.tpl-elegante .dc-sec-t{display:flex;align-items:center;gap:.8em;text-transform:uppercase;letter-spacing:.25em;color:#8a6d2f;font-size:1.1em;}' +
		'.tpl-elegante .dc-sec-t::before,.tpl-elegante .dc-sec-t::after{content:\'\';flex:1;border-top:1px solid #b99d5b;}' +
		'.tpl-elegante .dc-precio{color:#8a6d2f;}' +
		/* pizarra */
		'.tpl-pizarra{background-color:#20272e;background-image:radial-gradient(ellipse at 25% 15%,rgba(255,255,255,.07),transparent 55%),radial-gradient(ellipse at 80% 80%,rgba(255,255,255,.05),transparent 50%);color:#f2efe8;font-family:\'Trebuchet MS\',Verdana,sans-serif;padding:4em 3.8em;}' +
		'.tpl-pizarra::before{content:\'\';position:absolute;top:1.2em;left:1.2em;right:1.2em;bottom:1.2em;border:.14em dashed rgba(255,255,255,.45);border-radius:.8em;pointer-events:none;}' +
		'.tpl-pizarra .dc-titulo{font-family:\'Segoe Script\',\'Comic Sans MS\',cursive;color:#fff;}' +
		'.tpl-pizarra .dc-sub{color:#ffd95e;}' +
		'.tpl-pizarra .dc-sec-t{font-family:\'Segoe Script\',\'Comic Sans MS\',cursive;font-size:1.35em;color:#ffd95e;border-bottom:1px dashed rgba(255,255,255,.4);padding-bottom:.25em;}' +
		'.tpl-pizarra .dc-precio{color:#ffd95e;}' +
		/* minimal */
		'.tpl-minimal{background:#fff;color:#1a1a1a;font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;padding:4.5em 4.2em;}' +
		'.tpl-minimal .dc-titulo{font-weight:200;letter-spacing:.3em;text-transform:uppercase;font-size:2.1em;}' +
		'.tpl-minimal .dc-sec-t{font-size:.95em;font-weight:700;letter-spacing:.3em;text-transform:uppercase;border-bottom:.14em solid #1a1a1a;padding-bottom:.35em;}' +
		'.tpl-minimal .dc-dots{border-bottom-style:solid;opacity:.15;}' +
		/* rustico: madera + panel de papel + cubiertos */
		'.tpl-rustico{background-color:#7a4f2b;background-image:repeating-linear-gradient(90deg,rgba(0,0,0,.14) 0 .12em,transparent .12em 7em),linear-gradient(rgba(255,255,255,.07),rgba(0,0,0,.16));color:#4a382a;font-family:Georgia,\'Times New Roman\',serif;padding:3.8em 4em;}' +
		'.tpl-rustico::before{content:\'\';position:absolute;top:1.6em;left:1.6em;right:1.6em;bottom:1.6em;background:#f5ecd8;border-radius:.5em;box-shadow:0 .3em 1.5em rgba(0,0,0,.45);}' +
		'.tpl-rustico .dc-titulo{color:#5c3a1e;letter-spacing:.05em;}' +
		'.tpl-rustico .dc-head::after{content:\'\';display:block;margin:.5em auto 0;width:6em;height:2em;background:' + SVG_CUTLERY + ' center/contain no-repeat;}' +
		'.tpl-rustico .dc-sec-t{text-align:center;}' +
		'.tpl-rustico .dc-sec-t span{display:inline-block;background:#5c3a1e;color:#f5ecd8;padding:.3em 1.3em;border-radius:.25em;letter-spacing:.18em;text-transform:uppercase;font-size:.95em;}' +
		'.tpl-rustico .dc-precio{color:#a0522d;}' +
		/* bistro: burdeos + dorado + filigranas */
		'.tpl-bistro{background-color:#4d1c21;background-image:radial-gradient(ellipse at 50% 0%,rgba(255,255,255,.08),transparent 60%);color:#f3e8d8;font-family:Georgia,\'Times New Roman\',serif;padding:4.5em 4em;}' +
		'.tpl-bistro::before{content:\'\';position:absolute;top:1.3em;left:1.3em;right:1.3em;bottom:1.3em;border:.2em double #c9a34e;pointer-events:none;}' +
		'.tpl-bistro .dc-titulo{color:#f7d98c;font-variant:small-caps;letter-spacing:.08em;}' +
		'.tpl-bistro .dc-head::after{content:\'\';display:block;margin:.6em auto 0;width:10em;height:1em;background:' + SVG_FLOURISH + ' center/contain no-repeat;}' +
		'.tpl-bistro .dc-sec-t{text-align:center;color:#f7d98c;letter-spacing:.28em;text-transform:uppercase;font-size:1.05em;background:' + SVG_FLOURISH + ' center bottom/8em auto no-repeat;padding-bottom:1.1em;}' +
		'.tpl-bistro .dc-precio{color:#f7d98c;}' +
		'.tpl-bistro .dc-dots{opacity:.3;}' +
		/* tropical: hojas en esquinas, para juguerias/cevicherias */
		'.tpl-tropical{background:#fdf8ee;color:#2c3e35;font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;padding:4.8em 4.2em;}' +
		'.tpl-tropical::before{content:\'\';position:absolute;top:0;left:0;width:13em;height:13em;background:' + SVG_LEAF + ' no-repeat;background-size:contain;}' +
		'.tpl-tropical::after{content:\'\';position:absolute;bottom:0;right:0;width:13em;height:13em;background:' + SVG_LEAF + ' no-repeat;background-size:contain;transform:rotate(180deg);}' +
		'.tpl-tropical .dc-titulo{color:#1f7a4d;font-family:\'Segoe Print\',\'Comic Sans MS\',cursive;}' +
		'.tpl-tropical .dc-sub{color:#e2711d;letter-spacing:.25em;}' +
		'.tpl-tropical .dc-sec-t span{font-family:\'Segoe Print\',\'Comic Sans MS\',cursive;font-size:1.25em;color:#2e8b57;text-decoration:underline wavy #ef8b3f .06em;text-underline-offset:.3em;}' +
		'.tpl-tropical .dc-precio{color:#e2711d;}' +
		/* botanico: blanco + hojas line-art + titulo manuscrito (modelo Canva) */
		'.tpl-botanico{background:#fff;color:#333;font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;padding:5em 4.5em;}' +
		'.tpl-botanico::before{content:\'\';position:absolute;top:1em;left:1em;width:12em;height:12em;background:' + SVG_SAGE + ' no-repeat;background-size:contain;}' +
		'.tpl-botanico::after{content:\'\';position:absolute;bottom:1em;right:1em;width:12em;height:12em;background:' + SVG_SAGE + ' no-repeat;background-size:contain;transform:rotate(180deg);}' +
		'.tpl-botanico .dc-titulo{font-family:\'Segoe Script\',\'Comic Sans MS\',cursive;font-size:2.8em;}' +
		'.tpl-botanico .dc-sub{display:inline-block;background:#dde8cf;color:#41522e;border-radius:2em;padding:.4em 1.6em;letter-spacing:.15em;}' +
		'.tpl-botanico .dc-sec{text-align:center;}' +
		'.tpl-botanico .dc-sec-t span{font-weight:700;font-size:1.1em;}' +
		'.tpl-botanico .dc-item{justify-content:center;}' +
		'.tpl-botanico .dc-item-l{max-width:none;}' +
		'.tpl-botanico .dc-dots{display:none;}' +
		'.tpl-botanico .dc-precio{color:#41522e;margin-left:.6em;}' +
		'.tpl-botanico .dc-precio::before{content:\'·  \';opacity:.5;}' +
		/* editorial: columna de titulo + linea vertical (modelo Canva) */
		'.tpl-editorial{background:#fff;color:#1c1c1c;font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;padding:4em;flex-direction:row;}' +
		'.tpl-editorial .dc-head{width:32%;min-width:32%;text-align:left;margin:0;border-right:.13em solid #1c1c1c;padding-right:2em;background:' + SVG_SPRIG + ' left 70% no-repeat;background-size:5em auto;}' +
		'.tpl-editorial .dc-titulo{font-family:Georgia,\'Times New Roman\',serif;font-size:3em;line-height:.95;font-weight:700;text-transform:uppercase;overflow-wrap:break-word;}' +
		'.tpl-editorial .dc-sub{text-align:left;font-size:.8em;letter-spacing:.25em;}' +
		'.tpl-editorial .dc-body{padding-left:2.5em;}' +
		'.tpl-editorial .dc-sec-t span{letter-spacing:.45em;font-size:1.15em;font-weight:600;text-transform:uppercase;}' +
		'.tpl-editorial .dc-des{text-transform:uppercase;font-weight:600;font-size:.9em;letter-spacing:.08em;}' +
		'.tpl-editorial .dc-dots{border:none;}' + /* espaciador invisible: precio a la derecha */
		'.tpl-editorial .dc-precio{font-weight:400;}' +
		'.tpl-editorial .dc-pie{position:absolute;bottom:1.4em;left:0;right:0;}' +
		/* cinta: blanco + titulos de seccion en cinta negra (modelo moderno B/N) */
		'.tpl-cinta{background:#fff;color:#222;font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;padding:4.2em 4em;}' +
		'.tpl-cinta .dc-titulo{font-weight:300;letter-spacing:.4em;text-transform:uppercase;font-size:2.1em;}' +
		'.tpl-cinta .dc-sec-t{text-align:center;}' +
		'.tpl-cinta .dc-sec-t span{display:inline-block;background:#111;color:#fff;padding:.35em 1.7em;font-size:.85em;letter-spacing:.25em;text-transform:uppercase;clip-path:polygon(0 0,100% 0,calc(100% - .8em) 50%,100% 100%,0 100%,.8em 50%);}' +
		'.tpl-cinta .dc-des{font-weight:600;font-size:.88em;text-transform:uppercase;}' +
		'.tpl-cinta .dc-dots{border:none;}' +
		/* retro: crema + rojo diner (modelo retro) */
		'.tpl-retro{background:#f2ead8;color:#26211a;font-family:\'Arial Narrow\',Arial,sans-serif;padding:3.8em 3.5em;}' +
		'.tpl-retro .dc-titulo{font-family:Georgia,\'Times New Roman\',serif;font-style:italic;font-weight:700;color:#c8352e;}' +
		'.tpl-retro .dc-sub{font-weight:700;letter-spacing:.3em;}' +
		'.tpl-retro .dc-sec-t{display:flex;align-items:center;gap:.6em;color:#c8352e;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:1.05em;}' +
		'.tpl-retro .dc-sec-t::before,.tpl-retro .dc-sec-t::after{content:\'\';flex:1;border-top:.12em solid #c8352e;}' +
		'.tpl-retro .dc-des{font-weight:700;font-size:.9em;text-transform:uppercase;}' +
		'.tpl-retro .dc-dots{border-bottom:.14em dotted #26211a;opacity:.5;}' +
		'.tpl-retro .dc-precio{color:#c8352e;}' +
		/* brunch: salmon + coral (modelo brunch) */
		'.tpl-brunch{background:#fce8dc;color:#3d2b26;font-family:\'Segoe UI\',Helvetica,Arial,sans-serif;padding:4.5em 4em;}' +
		'.tpl-brunch .dc-head{text-align:left;}' +
		'.tpl-brunch .dc-titulo{font-weight:800;text-transform:uppercase;font-size:2.3em;line-height:1.05;color:#2f2320;}' +
		'.tpl-brunch .dc-sub{text-align:left;color:#e2604f;letter-spacing:.2em;margin-top:.4em;}' +
		'.tpl-brunch .dc-sec-t span{color:#e2604f;font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:1.15em;}' +
		'.tpl-brunch .dc-des{font-weight:600;font-size:.9em;}' +
		'.tpl-brunch .dc-dots{border:none;}' +
		'.tpl-brunch .dc-precio{font-size:.85em;}' +
		/* columnas: crema editorial a 2 columnas con regla central (modelo La Cocina Paisa) */
		'.tpl-columnas{background:#f4f1ea;color:#2b2b2b;font-family:Georgia,\'Times New Roman\',serif;padding:4em 3.8em;}' +
		'.tpl-columnas .dc-titulo{display:inline-block;background:#e5e0d3;border-radius:.35em;padding:.2em 1em;letter-spacing:.5em;text-transform:uppercase;font-weight:700;font-size:1.9em;}' +
		'.tpl-columnas .dc-sub{font-variant:small-caps;font-weight:700;letter-spacing:.12em;text-transform:none;}' +
		'.tpl-columnas .dc-body{column-rule:1px solid #2b2b2b;column-gap:3em;}' +
		'.tpl-columnas .dc-sec{text-align:center;}' +
		'.tpl-columnas .dc-sec-t span{display:inline-block;background:#e5e0d3;border-radius:.4em;padding:.25em 1.2em;letter-spacing:.35em;font-weight:700;text-transform:uppercase;font-size:.95em;}' +
		'.tpl-columnas .dc-item{justify-content:center;}' +
		'.tpl-columnas .dc-item-l{max-width:none;}' +
		'.tpl-columnas .dc-des{font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.85em;}' +
		'.tpl-columnas .dc-det{font-style:italic;font-size:.78em;}' +
		'.tpl-columnas .dc-dots{display:none;}' +
		'.tpl-columnas .dc-precio{margin-left:.6em;}' +
		'.tpl-columnas .dc-precio::before{content:\'·  \';opacity:.5;}' +
		'.tpl-columnas .dc-pie{border-top:1px solid #2b2b2b;padding-top:.8em;font-variant:small-caps;letter-spacing:.15em;}' +
		/* vintage: crema + cinta roja + puntos de guia (modelo since 1992) */
		'.tpl-vintage{background:#f6ead8;color:#33261f;font-family:Georgia,\'Times New Roman\',serif;padding:4em 3.6em;}' +
		'.tpl-vintage::after{content:\'\';position:absolute;bottom:1em;right:1.4em;width:6em;height:11em;background:' + SVG_SPRIG_CAFE + ' no-repeat;background-size:contain;opacity:.7;}' +
		'.tpl-vintage .dc-titulo{font-weight:800;letter-spacing:.12em;text-transform:uppercase;}' +
		'.tpl-vintage .dc-titulo::before{content:\'\\2013  \';}' +
		'.tpl-vintage .dc-titulo::after{content:\'  \\2013\';}' +
		'.tpl-vintage .dc-sub{display:inline-block;background:#d8433a;color:#fff;padding:.4em 1.8em;letter-spacing:.2em;clip-path:polygon(0 0,100% 0,calc(100% - .8em) 50%,100% 100%,0 100%,.8em 50%);}' +
		'.tpl-vintage .dc-sec-t{text-align:center;color:#d8433a;font-weight:700;font-size:1.2em;}' +
		'.tpl-vintage .dc-sec-t span::before{content:\'-  \';}' +
		'.tpl-vintage .dc-sec-t span::after{content:\'  -\';}' +
		'.tpl-vintage .dc-des{font-weight:700;}' +
		'.tpl-vintage .dc-dots{border-bottom:.14em dotted #33261f;opacity:.55;}' +
		'.tpl-vintage .dc-precio{color:#d8433a;font-weight:800;}';

		const st = document.createElement('style');
		st.id = 'dcx_css';
		st.textContent = css;
		document.head.appendChild(st);
	}

	// ---------- preferencias (persisten por sede: los menu cambian de carta a diario) ----------
	function clavePrefs() {
		try { return 'dcx_prefs_' + xm_log_get('datos_org_sede')[0].idsede; } catch (e) { return 'dcx_prefs'; }
	}
	function guardarPrefs() {
		try {
			localStorage.setItem(clavePrefs(), JSON.stringify({
				tpl: sel.tpl, fmt: sel.fmt, precios: sel.precios, font: sel.font, bg: sel.bg, orient: sel.orient
			}));
		} catch (e) { /* almacenamiento lleno o bloqueado: se ignora */ }
	}
	function cargarPrefs() {
		try {
			const p = JSON.parse(localStorage.getItem(clavePrefs()));
			if (!p) { return; }
			if (PLANTILLAS.some(function (x) { return x.id === p.tpl; })) { sel.tpl = p.tpl; }
			if (FORMATOS[p.fmt]) { sel.fmt = p.fmt; }
			if (FUENTES.some(function (x) { return x.id === p.font; })) { sel.font = p.font; }
			sel.precios = p.precios !== false;
			sel.bg = p.bg || '';
			sel.orient = p.orient === 'h' ? 'h' : 'v';
		} catch (e) { /* prefs corruptas: se usan los valores por defecto */ }
	}

	// ---------- api ----------
	// habilita/deshabilita el boton segun la carta tenga contenido visible
	window.xRefrescarBtnDiseno = function () {
		const btn = document.querySelector('.btn-disenar-carta');
		if (btn) { btn.classList.toggle('off', getSecciones().length === 0); }
	};

	window.xAbrirDisenoCarta = function () {
		if (getSecciones().length === 0) {
			showAlertSwalOk('info', 'Carta vacía', 'Cargue o guarde una carta antes de diseñar.');
			return;
		}
		cargarPrefs();
		montarOverlay();
		// reflejar prefs guardadas en los controles
		document.getElementById('dcx_fmt').value = sel.fmt;
		document.getElementById('dcx_font').value = sel.font;
		document.getElementById('dcx_precios').checked = sel.precios;
		if (sel.bg) { document.getElementById('dcx_bg').value = sel.bg; }
		render();
	};

})();
