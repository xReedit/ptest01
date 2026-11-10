// Rotulos de la maqueta en vivo (spec docs/superpowers/specs/2026-10-31-maqueta-salon-3d-design.md §5.4): capa HTML
// encima del canvas de escena.js. Portada del prototipo aprobado (placeLabels, detalle, accion, el apilado).
// Las mesas tranquilas muestran solo su numero; las que piden accion flotan en columna con un palito hasta la mesa;
// al pasar el mouse (o con la mesa fijada) sale la tarjeta de detalle. Referencias, mozos y codigos los escribe el
// usuario: todo se arma con createElement y texto, nunca con HTML. Estilos en ../maqueta.css (prefijo mq-).
// pintar() se llama en cada movimiento de la camara: los rotulos se reutilizan por mesa y solo se rearman si cambia
// lo que muestran; las medidas se leen una vez por contenido y se posicionan con transform (no mueve el layout).
import { urgencia, formatoMin, enFiltro } from './estado.js?v=20261102m';
import { claveMesa } from './plano.js?v=20261102m';

const SEPARACION = 6;   // px entre dos rotulos apilados
const TALLO = 16;       // palito minimo de un rotulo flotante
const GRANDE_PX = 70;   // mesa mas ancha que esto en pantalla → las no libres en detalle
const ALTO_POP = 14;    // el detalle del mouse va un poco por encima de la mesa
const UMBRAL_MIN = 90;  // "mucho tiempo" si quien llama no trae el de la sede (ajustes por defecto)
const MOVIDA_CLIC = 5;  // px: si el puntero se movio mas entre bajar y subir, fue arrastre (mover la vista), no clic
const FILTROS = ['alertas', 'cobrar', 'mozo', 'buscar'];
const SVG = 'http://www.w3.org/2000/svg';
const ICONOS = {
	print: [['path', { d: 'M4.5 6V2h7v4M4.5 12H2.5V6.5h11V12h-2M4.5 9.5h7V14h-7z' }]],
	pre: [['path', { d: 'M4 1.5h8v13l-2-1.2-2 1.2-2-1.2-2 1.2zM6 5h4M6 8h4' }]],
	qr: [['path', { d: 'M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM10 10h1M13 10h1M10 13h4' }]],
	cam: [['path', { d: 'M1.5 4.5h9v7h-9zM10.5 7.2 14.5 5v6l-4-2.2' }]],
	ref: [['path', { d: 'M2 2h6l6 6-6 6-6-6z' }], ['circle', { cx: '5', cy: '5', r: '.8' }]],
	clock: [['circle', { cx: '8', cy: '8', r: '6' }], ['path', { d: 'M8 4.5V8l2.5 1.5' }]],
};
const LIBRE = Object.freeze({ codigo: '', ocupada: false, importe: null, minutos: null, mozo: '', impreso: false,
	precuenta: false, reserva: false, porConfirmar: false, referencia: '' });

/**
 * Acomodo de los rotulos flotantes: de adelante (y mayor) hacia atras; si uno choca con otro ya puesto, sube por
 * encima de ese (su palito se alarga) y se vuelve a revisar. top es el borde de abajo del rotulo (donde nace el
 * palito): el rotulo ocupa [x - w/2, x + w/2] × [top - h, top]. Puro.
 * @param {{id: string, x: number, y: number, w: number, h: number}[]} items x, y: punto de la mesa en pantalla
 * @param {number} tallo largo minimo del palito
 * @returns {{id: string, top: number}[]} en el orden de items
 */
export function apilar(items, tallo) {
	if (!Array.isArray(items)) { return []; }
	const puestos = [], top = new Map();
	for (const it of [...items].sort((a, b) => b.y - a.y)) {
		let t = it.y - tallo;
		// Cada choque deja t por encima del rotulo chocado, y t solo baja: termina en a lo mas puestos.length pasos.
		for (;;) {
			const choque = puestos.find(r => Math.abs(r.x - it.x) < (r.w + it.w) / 2 + SEPARACION
				&& t > r.top - r.h - SEPARACION && t - it.h < r.top + SEPARACION);
			if (!choque) { break; }
			t = choque.top - choque.h - SEPARACION;
		}
		puestos.push({ x: it.x, w: it.w, h: it.h, top: t });
		top.set(it, t);
	}
	return items.map(it => ({ id: it.id, top: top.get(it) }));
}

// ---------------------------------------------------------------- reglas de lo que muestra cada mesa (puras)

const pedidoAbierto = m => m.ocupada && !m.reserva;
const conCuenta = m => pedidoAbierto(m) || m.porConfirmar;   // hay monto, mozo y chips que mostrar
const genteSinPedido = (m, c) => !pedidoAbierto(m) && !!c && (c.alerta === 'sin_atencion' || c.estado === 'ocupada');
const camaraVeAlgo = c => !!c && (!!c.alerta || ['ocupada', 'por_limpiar', 'limpiando'].includes(c.estado));
const esLibre = (m, c) => !m.ocupada && !m.porConfirmar && !camaraVeAlgo(c);
const personasDe = c => (c && Number.isFinite(c.personas) ? c.personas : null);
const soles = importe => `S/ ${Math.round(importe)}`;
const iniciales = nombre => nombre.split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();

/** Lo que ve la camara, en palabras (los textos de app/camaras/js/estado-mesas.js y del prototipo). '' = nada. */
function textoCamara(m, c) {
	if (!c) { return ''; }
	const min = c.minutos == null ? '' : ` · ${formatoMin(c.minutos)}`;
	if (c.alerta === 'sin_atencion') { return `Sin atención${min}`; }
	if (c.alerta === 'cuenta_abierta') { return 'Se fueron · cuenta abierta'; }
	if (c.alerta === 'por_limpiar' || c.estado === 'por_limpiar') { return 'Por limpiar'; }
	if (c.estado === 'limpiando') { return 'Limpiando'; }
	if (c.estado === 'ocupada') { return pedidoAbierto(m) ? `Ocupada${min}` : `Ocupada${min} · sin pedido`; }
	return '';
}

/** Botones de camara de la tarjeta de detalle (§5.3): [accion, texto, clase]. */
function botonesCamara(c) {
	if (c && c.alerta === 'sin_atencion') {
		return [['atendi', 'Ya atendí', ''], ...(c.puedeSilenciar ? [['silenciar', 'Silenciar', 'mq-g']] : [])];
	}
	if (c && c.alerta === 'cuenta_abierta') { return [['cobre', 'Ya cobré', '']]; }
	return [];
}

/**
 * Que rotulo lleva la mesa: 'num' (solo el numero, sobre la mesa), 'act' (urgencia en columna), 'info' (con un
 * filtro activo: lo basico en columna) o 'big' (detalle, de cerca). Las de fuera del filtro: 'num' apagado.
 */
function tipoDe(r, ctx) {
	if (ctx.filtroActivo && !enFiltro(r.m, r.c, ctx.filtro, ctx.umbral)) { return { tipo: 'num', dim: true, u: null }; }
	const u = urgencia(r.m, r.c, ctx.umbral);
	if (ctx.grande) { return { tipo: esLibre(r.m, r.c) ? 'num' : 'big', dim: false, u }; }
	return { tipo: u ? 'act' : ctx.filtroActivo ? 'info' : 'num', dim: false, u };
}

// ---------------------------------------------------------------- armado del DOM (solo texto)

function fabrica(doc) {
	// Hijos: nodos o texto no vacio; lo demas (false, null, 0 de un `cond && …`) se descarta.
	const el = (tag, clase, ...hijos) => {
		const e = doc.createElement(tag);
		if (clase) { e.className = clase; }
		e.append(...hijos.filter(h => (typeof h === 'string' ? h !== '' : !!h && typeof h === 'object')));
		return e;
	};
	const icono = (k, clase = '') => {
		const svg = doc.createElementNS(SVG, 'svg');
		svg.setAttribute('viewBox', '0 0 16 16');
		for (const [tag, atributos] of ICONOS[k]) {
			const forma = doc.createElementNS(SVG, tag);
			for (const [a, v] of Object.entries(atributos)) { forma.setAttribute(a, v); }
			svg.append(forma);
		}
		return el('i', clase ? `mq-ic ${clase}` : 'mq-ic', svg);
	};
	const boton = ([accion, texto, clase]) => {
		const b = el('button', clase, texto);
		b.type = 'button';
		b.dataset.accion = accion;
		return b;
	};
	const numero = m => el('span', 'mq-n', m.codigo);

	/** Tarjeta de detalle: vertical y angosta (mozo, monto, tiempo, referencia, chips, camara, botones). */
	function detalle(m, c, sinUbicar, umbral) {
		const avatar = m.mozo ? el('span', 'mq-av', iniciales(m.mozo)) : null;
		if (avatar) { avatar.title = m.mozo; }
		const cabeza = el('span', 'mq-fila', numero(m), el('span', 'mq-who', `Mesa ${m.codigo}`), conCuenta(m) && avatar);
		const aviso = sinUbicar ? el('span', 'mq-t', 'Sin ubicar en el plano') : null;
		const cam = textoCamara(m, c), alerta = !!c && ['sin_atencion', 'cuenta_abierta'].includes(c.alerta);
		const lineaCamara = cam ? el('span', alerta ? 'mq-camline mq-al' : 'mq-camline', icono('cam'), cam) : null;
		const botones = botonesCamara(c);
		const acciones = botones.length ? el('span', 'mq-acts', ...botones.map(boton)) : null;
		// Reservada: sin hora (la tarjeta no la trae); una alerta de camara igual se atiende desde aqui.
		if (m.reserva && !m.porConfirmar) { return el('div', 'mq-b', cabeza, el('span', 'mq-t', icono('clock'), ' Reservada'), lineaCamara, aviso, acciones); }
		const pers = personasDe(c);
		if (!conCuenta(m)) {
			const extra = !c ? '' : cam === 'Por limpiar' ? 'Cuenta cerrada · quedaron platos' : `${pers != null ? `${pers} pers. · ` : ''}sin pedido en el POS`;
			return el('div', 'mq-b', cabeza, lineaCamara || el('span', 'mq-t', 'Libre'), extra && el('span', 'mq-t', extra), aviso, acciones);
		}
		const tiempo = [m.minutos != null && formatoMin(m.minutos), pers != null && `${pers} pers.`].filter(Boolean).join(' · ');
		const tarde = pedidoAbierto(m) && m.minutos != null && m.minutos >= umbral;
		const chips = [
			m.impreso && el('span', 'mq-ch', icono('print'), 'Impreso'),
			m.precuenta && el('span', 'mq-ch', el('b', 'mq-o', icono('pre'), 'Precuenta')),
			m.porConfirmar && el('span', 'mq-ch', el('b', 'mq-v', icono('qr'), 'Por confirmar')),
		].filter(Boolean);
		return el('div', 'mq-b', cabeza,
			m.importe != null && el('span', 'mq-m', `S/ ${m.importe.toFixed(2)}`),
			tiempo && el('span', tarde ? 'mq-t mq-late' : 'mq-t', tiempo),
			m.referencia && el('span', 'mq-ref', icono('ref'), m.referencia),
			chips.length > 0 && el('span', 'mq-chips', ...chips),
			lineaCamara, aviso, acciones);
	}
	/** Rotulo de lejos: solo lo urgente, en columna (numero, motivo, dato). */
	const accion = (m, u) => el('div', 'mq-b', numero(m), el('span', 'mq-why', icono(u.icono), u.motivo), u.dato && el('span', 'mq-sub', u.dato));
	/** Con un filtro activo: lo basico de la mesa, tambien en columna (al buscar, la referencia primero). */
	function basico(m, c, buscando) {
		if (!conCuenta(m)) { return el('div', 'mq-b', numero(m), el('span', 'mq-sub', textoCamara(m, c) || (m.reserva ? 'Reservada' : 'Libre'))); }
		return el('div', 'mq-b', numero(m),
			buscando && m.referencia && el('span', 'mq-why mq-rf', m.referencia),
			m.importe != null && el('span', 'mq-why', soles(m.importe)),
			m.minutos != null && el('span', 'mq-sub', formatoMin(m.minutos)));
	}
	/** Mesa tranquila: su numero sobre la mesa y, si tiene pedido, los minutos debajo ("sin ubicar" explica el contorno). */
	function soloNumero(m, sinUbicar, dim) {
		return [numero(m),
			!dim && pedidoAbierto(m) && m.minutos != null && el('span', 'mq-mn', `${m.minutos} min`),
			sinUbicar && el('span', 'mq-su', 'sin ubicar')].filter(Boolean);
	}
	return { el, detalle, accion, basico, soloNumero };
}

function claseNumero(m, c, sinUbicar, dim) {
	const tipo = pedidoAbierto(m) ? 'mq-busy' : genteSinPedido(m, c) ? 'mq-gente' : m.reserva ? 'mq-res' : '';
	return ['mq-tag', 'mq-num', tipo, sinUbicar && 'mq-sinubicar', dim && 'mq-dim'].filter(Boolean).join(' ');
}

/** El contenido del rotulo: [clase, hijos()] (hijos se arma solo si cambio la firma). */
function contenidoDe(f, r, t, ctx) {
	const { m, c, sinUbicar } = r;
	if (t.tipo === 'num') { return [claseNumero(m, c, sinUbicar, t.dim), () => f.soloNumero(m, sinUbicar, t.dim)]; }
	const caja = t.tipo === 'big' ? () => f.detalle(m, c, sinUbicar, ctx.umbral)
		: t.tipo === 'act' ? () => f.accion(m, t.u) : () => f.basico(m, c, ctx.filtro.tipo === 'buscar');
	const clase = t.tipo === 'act' ? `mq-tag mq-act mq-k-${t.u.k}` : `mq-tag mq-${t.tipo}`;
	return [clase, () => [caja(), f.el('span', 'mq-stem'), f.el('span', 'mq-dot')]];
}

// ---------------------------------------------------------------- capa

/**
 * Capa de rotulos dentro de host (el mismo contenedor de la escena). Clic en un rotulo o en la mesa (canvas) →
 * cb.abrir(codigo), como tocar su tarjeta; los botones de camara → cb.accionCamara(codigo, accion) y no abren.
 * Pasar el mouse por una mesa o su rotulo muestra el detalle. Quien llama repinta en cada cambio de vista
 * (escena.alCambiarVista) y de datos.
 * @param {HTMLElement} host
 * @param {{abrir: (codigo: string) => void, accionCamara: (codigo: string, accion: 'atendi'|'silenciar'|'cobre') => void}} cb
 * @returns {{pintar: Function, fijar: Function, destruir: Function}} Rotulos
 */
export function crearRotulos(host, cb) {
	if (!host || !host.ownerDocument) { throw new TypeError('maqueta: rotulos sin contenedor'); }
	if (!cb || typeof cb.abrir !== 'function' || typeof cb.accionCamara !== 'function') { throw new TypeError('maqueta: rotulos sin acciones'); }
	const f = fabrica(host.ownerDocument);
	const capa = f.el('div', 'maq-rotulos');
	const pop = { el: f.el('div', 'mq-tag mq-big mq-pop'), firma: '' };
	pop.el.hidden = true;
	capa.append(pop.el);
	host.append(capa);
	const rotulos = new Map();   // clave → { el, firma, w, h, tallo, punto }
	let ultimo = null, hover = null, fijado = null, bajada = null, destruida = false;
	// Solo escribe si cambia (pintar corre en cada movimiento de la camara).
	const mostrar = (e, si) => { if (e.hidden !== !si) { e.hidden = !si; } };
	const ponerCodigo = (e, codigo) => { if (e.dataset.codigo !== codigo) { e.dataset.codigo = codigo; } };

	/** Entradas de pintarEstados (las mismas de la escena) → mesas proyectadas, una por clave. */
	function proyectadas(lista, escena) {
		const vistas = new Map();
		for (const e of Array.isArray(lista) ? lista : []) {
			const m = e && e.m ? e.m : { ...LIBRE, codigo: e && typeof e.codigo === 'string' ? e.codigo : '' };
			if (typeof m.codigo !== 'string' || !m.codigo) { continue; }
			const clave = claveMesa(m.codigo);
			if (!vistas.has(clave)) { vistas.set(clave, { clave, m, c: e.c || null, sinUbicar: !!e.sinUbicar, p: escena.proyectar(m.codigo) }); }
		}
		return vistas;
	}
	// De cerca (§5.4): por la mesa del medio, para que todas cambien juntas (no por la perspectiva de cada una).
	function esGrande(vistas) {
		const px = [...vistas.values()].filter(r => r.p).map(r => r.p.px).sort((a, b) => a - b);
		return px.length > 0 && px[Math.floor(px.length / 2)] > GRANDE_PX;
	}
	// Rearma el rotulo solo si cambio lo que muestra: sus hijos nuevos, o null si quedo igual.
	function poner(rot, clase, hijos, firma) {
		if (rot.firma === firma) { return null; }
		rot.firma = firma;
		rot.el.className = clase;
		const nuevos = hijos();
		rot.el.replaceChildren(...nuevos);
		return nuevos;
	}
	function rotuloDe(r) {
		let rot = rotulos.get(r.clave);
		if (!rot) {
			rot = { el: f.el('div', ''), firma: '', w: 0, h: 0, tallo: null, punto: null };
			capa.insertBefore(rot.el, pop.el);   // el detalle siempre al final (encima)
			rotulos.set(r.clave, rot);
		}
		ponerCodigo(rot.el, r.m.codigo);
		return rot;
	}

	function dibujar() {
		// Contenedor oculto (otra pestaña, tarjetas de siempre): no hay donde medir; se pinta al volver.
		if (!ultimo || destruida || !host.clientWidth || !host.clientHeight) { return; }
		const { escena, filtro, umbral } = ultimo;
		const vistas = proyectadas(ultimo.lista, escena);
		const ctx = { filtro, umbral, filtroActivo: !!filtro && FILTROS.includes(filtro.tipo), grande: esGrande(vistas) };
		for (const [clave, rot] of rotulos) { if (!vistas.has(clave)) { rot.el.remove(); rotulos.delete(clave); } }
		// 1) contenido (escrituras)
		const flotan = [], porMedir = [];
		for (const r of vistas.values()) {
			const rot = rotuloDe(r);
			mostrar(rot.el, !!r.p);
			if (!r.p) { continue; }
			const t = tipoDe(r, ctx);
			const [clase, hijos] = contenidoDe(f, r, t, ctx);
			const nuevos = poner(rot, clase, hijos, JSON.stringify([clase, r.m, r.c, r.sinUbicar, t.tipo === 'big' && umbral, t.tipo === 'info' && filtro.tipo]));
			if (nuevos && t.tipo !== 'num') { [, rot.tallo, rot.punto] = nuevos; }   // [caja, palito, punto]
			// Se mide lo que cambio y lo que quedo medido en 0 (la capa aun sin layout).
			if (t.tipo !== 'num' && (nuevos || !rot.w || !rot.h)) { porMedir.push(rot); }
			rot.el.classList.toggle('mq-sel', !!fijado && claveMesa(fijado) === r.clave);
			if (t.tipo === 'num') { rot.el.style.transform = `translate(${r.p.x}px, ${r.p.y}px) translate(-50%, -50%)`; } else { flotan.push({ r, rot }); }
		}
		// 2) medidas (lecturas juntas, solo de lo que cambio)
		for (const rot of porMedir) { rot.w = rot.el.offsetWidth; rot.h = rot.el.offsetHeight; }
		// 3) posiciones (transform: no vuelve a calcular el layout)
		const tops = apilar(flotan.map(({ r, rot }) => ({ id: r.clave, x: r.p.x, y: r.p.y, w: rot.w, h: rot.h })), TALLO);
		flotan.forEach(({ r, rot }, i) => {
			const top = tops[i].top, palito = r.p.y - top;
			rot.el.style.transform = `translate(${r.p.x}px, ${top}px) translate(-50%, -100%)`;
			if (rot.tallo) { rot.tallo.style.height = `${palito}px`; }
			if (rot.punto) { rot.punto.style.top = `calc(100% + ${palito}px)`; }
		});
		dibujarPop(vistas, umbral);
	}
	// Detalle de la mesa fijada (buscador) o bajo el mouse, encima de todo.
	function dibujarPop(vistas, umbral) {
		const codigo = fijado || hover, r = codigo ? vistas.get(claveMesa(codigo)) : null;
		mostrar(pop.el, !!r && !!r.p);
		if (pop.el.hidden) { return; }
		ponerCodigo(pop.el, r.m.codigo);
		poner(pop, 'mq-tag mq-big mq-pop', () => [f.detalle(r.m, r.c, r.sinUbicar, umbral)], JSON.stringify([r.m, r.c, r.sinUbicar, umbral]));
		pop.el.style.transform = `translate(${r.p.x}px, ${r.p.y - ALTO_POP}px) translate(-50%, -100%)`;
	}

	// ---------------------------------------------------------------- puntero
	const esCanvas = t => !!t && t.tagName === 'CANVAS' && t.parentNode === host;
	const rotuloBajo = t => {
		const tag = t && t.closest ? t.closest('.mq-tag[data-codigo]') : null;
		return tag && capa.contains(tag) ? tag : null;
	};
	function ponerHover(codigo) {
		if (codigo === hover) { return; }
		hover = codigo;
		dibujar();
	}
	function alMover(e) {
		if (e.buttons) { return; }   // arrastrando: se mueve la vista
		const tag = rotuloBajo(e.target);
		if (tag) { ponerHover(tag === pop.el ? hover : tag.dataset.codigo); return; }
		ponerHover(esCanvas(e.target) && ultimo && ultimo.escena.codigoEn ? ultimo.escena.codigoEn(e.clientX, e.clientY) : null);
	}
	function alSalir() { ponerHover(null); }
	function alClic(e) {
		const tag = rotuloBajo(e.target);
		if (!tag) { return; }
		e.stopPropagation();
		const boton = e.target.closest('button[data-accion]');
		if (boton) { cb.accionCamara(tag.dataset.codigo, boton.dataset.accion); } else { cb.abrir(tag.dataset.codigo); }
	}
	// Clic en la mesa misma (canvas): solo si no fue arrastre. Bajar en el canvas suelta la mesa fijada.
	function alBajar(e) {
		if (!esCanvas(e.target)) { return; }
		bajada = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
		if (fijado) { fijado = null; dibujar(); }
	}
	function alSubir(e) {
		const b = bajada;
		bajada = null;
		if (!b || !esCanvas(e.target) || !ultimo || !ultimo.escena.codigoEn) { return; }
		if (Math.hypot(e.clientX - b.x, e.clientY - b.y) > MOVIDA_CLIC) { return; }
		const codigo = ultimo.escena.codigoEn(e.clientX, e.clientY);
		if (codigo) { cb.abrir(codigo); }
	}
	const oyentes = [['pointermove', alMover], ['pointerleave', alSalir], ['pointerdown', alBajar], ['pointerup', alSubir]];
	for (const [tipo, fn] of oyentes) { host.addEventListener(tipo, fn); }
	capa.addEventListener('click', alClic);

	return Object.freeze({
		/**
		 * @param {{m: EstadoMesa|null, c: Camara|null, sinUbicar?: boolean, codigo?: string}[]} lista la de pintarEstados
		 * @param {{proyectar: Function, codigoEn?: Function}} escena
		 * @param {{tipo: string, mozo?: string, q?: string}|null} filtro el de estado.js enFiltro (null = todo)
		 * @param {number} umbralMin minutos de "mucho tiempo" de la sede
		 */
		pintar(lista, escena, filtro, umbralMin) {
			if (destruida) { return; }
			if (!escena || typeof escena.proyectar !== 'function') { throw new TypeError('maqueta: pintar rotulos sin escena'); }
			ultimo = { lista, escena, filtro: filtro || null, umbral: Number.isFinite(umbralMin) ? umbralMin : UMBRAL_MIN };
			dibujar();
		},
		/** Deja el detalle de la mesa a la vista (buscador); null lo suelta. */
		fijar(codigo) {
			if (destruida) { return; }
			fijado = typeof codigo === 'string' && codigo ? codigo : null;
			dibujar();
		},
		/** Quita la capa y sus oyentes; despues pintar y fijar no hacen nada. */
		destruir() {
			if (destruida) { return; }
			destruida = true;
			for (const [tipo, fn] of oyentes) { host.removeEventListener(tipo, fn); }
			capa.removeEventListener('click', alClic);
			capa.remove();
			rotulos.clear();
			ultimo = null;
		},
	});
}
