// Helpers de interfaz compartidos por las vistas.
import { rutaActual } from './router.js?v=20261026a';   // ciclo router<->ui: solo se usa al dibujar, no al cargar

export function esc(s) {
	return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Token anti doble envio: se genera UNA vez por accion y se reusa en los reintentos (se renueva solo tras exito). */
export const nuevoToken = prefijo => prefijo + Date.now() + Math.random().toString(36).slice(2);

/**
 * Numero escrito en un input. null = no es un numero valido (en type=number "1,5" o letras dejan value '' con
 * validity.badInput) o esta vacio siendo obligatorio; vacio no obligatorio = 0. En type=text acepta coma decimal.
 * La vista avisa con aviso(..., 'error') y no envia cuando devuelve null.
 */
/** "2026-10-10 14:19:00" -> "10/10/2026 14:19"; "2026-10-10" -> "10/10/2026". Lo que ya viene dd/mm/yyyy (o vacio) queda igual. */
export function fecha(v) {
	const m = String(v == null ? '' : v).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}:\d{2}))?/);
	return m ? `${m[3]}/${m[2]}/${m[1]}${m[4] ? ' ' + m[4] : ''}` : String(v == null ? '' : v);
}

export function leerNum(inp, obligatorio = false) {
	if (!inp || (inp.validity && inp.validity.badInput)) { return null; }
	const s = String(inp.value).trim().replace(',', '.');
	if (s === '') { return obligatorio ? null : 0; }
	const n = Number(s);
	return Number.isFinite(n) ? n : null;
}

/** Aviso flotante (sin alert() nativo). tipo: 'ok' | 'error' */
export function aviso(texto, tipo = 'ok') {
	const d = document.createElement('div');
	d.className = 'lg-aviso' + (tipo === 'error' ? ' error' : '');
	d.textContent = texto;
	document.body.appendChild(d);
	setTimeout(() => d.remove(), tipo === 'error' ? 6000 : 3000);
}

/**
 * Tarjeta estandar del sistema (xMiCard + inv-head, igual que Encuestas/Inventario).
 * acciones y cuerpo son HTML ya escapado.
 */
export function tarjeta({ titulo, ayuda = '', acciones = '', cuerpo = '' }) {
	return `
		<div class="xMiCard xradius inv-card">
			<div class="xEncanezadoCard inv-head">
				<div class="inv-head-top">
					<div><h3>${esc(titulo)}</h3>${ayuda ? `<p>${ayuda}</p>` : ''}</div>
					<div class="inv-head-acciones">${acciones}</div>
				</div>
			</div>
			<div class="xContentCard">${cuerpo}</div>
		</div>`;
}

/** Volver + Ayuda de la pantalla actual (abre su tema en vistas/ayuda.js). */
export const volver = (ruta = '') => (rutaActual() && rutaActual() !== 'ayuda'
	? `<a class="btn btn-sm btn-light" href="#" data-ir="ayuda/${esc(rutaActual())}" title="Cómo se usa esta pantalla"><i class="fa fa-question-circle"></i>Ayuda</a>` : '')
	+ `<a class="btn btn-sm btn-light" href="#" data-ir="${ruta}"><i class="fa fa-arrow-left"></i>Volver</a>`;

const sinTildes = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/**
 * Autocompletado simple: lista blanca bajo el input, del mismo ancho. Filtra mientras se escribe,
 * flechas + Enter para elegir, Esc o salir del campo la cierra. El texto libre se acepta igual
 * (el servidor vincula si existe o crea si no). Va en position:fixed para no recortarse dentro del dialogo.
 * opciones: ['texto', ...] o [{texto, valor}, ...]; con objetos, lo elegido queda en input.dataset.valor
 * (se borra al volver a escribir: texto libre = sin valor).
 */
export function autocompletar(input, opciones) {
	const ops = opciones.map(o => (typeof o === 'object' ? o : { texto: o, valor: '' }));
	const lista = document.createElement('div');
	lista.className = 'lg-ac';
	lista.hidden = true;
	// junto al propio campo (o en su dialogo): si la tabla/pantalla se vuelve a dibujar, la lista se va con el campo
	(input.closest('dialog') || input.parentElement).appendChild(lista);
	let items = [];
	let activo = -1;

	const cerrar = () => { lista.hidden = true; activo = -1; };
	const elegir = o => {
		input.value = o.texto;
		if (o.valor !== '') { input.dataset.valor = o.valor; }
		cerrar();
		input.dispatchEvent(new Event('input', { bubbles: true }));   // bubbles: las tablas escuchan por delegacion
	};
	const pintar = () => {
		lista.querySelectorAll('div').forEach((d, i) => d.classList.toggle('act', i === activo));
		const a = lista.children[activo];
		if (a) { a.scrollIntoView({ block: 'nearest' }); }
	};
	const abrir = () => {
		const q = sinTildes(input.value.trim());
		items = ops.filter(o => sinTildes(o.texto).includes(q)).slice(0, 50);
		if (!items.length || (items.length === 1 && sinTildes(items[0].texto) === q)) { cerrar(); return; }
		const r = input.getBoundingClientRect();
		Object.assign(lista.style, { left: r.left + 'px', top: (r.bottom + 2) + 'px', width: r.width + 'px' });
		lista.innerHTML = items.map(o => `<div>${esc(o.texto)}</div>`).join('');
		activo = -1;
		lista.hidden = false;
	};

	input.setAttribute('autocomplete', 'off');
	input.addEventListener('focus', abrir);
	input.addEventListener('input', e => { if (e.isTrusted) { delete input.dataset.valor; abrir(); } });
	input.addEventListener('blur', cerrar);
	input.addEventListener('keydown', e => {
		if (lista.hidden) { if (e.key === 'ArrowDown') { abrir(); } return; }
		if (e.key === 'ArrowDown') { activo = Math.min(activo + 1, items.length - 1); pintar(); e.preventDefault(); }
		else if (e.key === 'ArrowUp') { activo = Math.max(activo - 1, 0); pintar(); e.preventDefault(); }
		else if (e.key === 'Enter' && activo >= 0) { elegir(items[activo]); e.preventDefault(); }
		else if (e.key === 'Escape') { cerrar(); e.preventDefault(); e.stopPropagation(); }
	});
	// mousedown (no click) para elegir antes de que el blur cierre la lista
	lista.addEventListener('mousedown', e => {
		const d = e.target.closest('div');
		if (d && d.parentNode === lista) { e.preventDefault(); elegir(items[[...lista.children].indexOf(d)]); }
	});
}

/**
 * Alerta de confirmacion (en lugar de confirm() nativo). Devuelve Promise<boolean>.
 * textoHtml ya escapado. El boton de cancelar queda con el foco: Enter por error no confirma.
 */
export function confirmar({ titulo, textoHtml, boton = 'Sí, continuar', peligro = true }) {
	return new Promise(resolver => {
		const dlg = document.createElement('dialog');
		dlg.className = 'lg-dlg lg-app';
		dlg.innerHTML = `
			<div class="xdlg-head"><h3><i class="fa ${peligro ? 'fa-exclamation-triangle' : 'fa-question-circle'}" style="color:${peligro ? '#dc3545' : '#007bff'};margin-right:6px"></i>${esc(titulo)}</h3></div>
			<div class="xdlg-body" style="font-size:13px">${textoHtml}</div>
			<div class="xdlg-foot">
				<button class="btn btn-sm btn-light" data-r="0"><i class="fa fa-times"></i>No, cancelar</button>
				<button class="btn btn-sm ${peligro ? 'btn-danger' : 'btn-success'}" data-r="1"><i class="fa fa-check"></i>${esc(boton)}</button>
			</div>`;
		document.body.appendChild(dlg);
		let r = false;
		dlg.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { r = b.dataset.r === '1'; dlg.close(); } });
		dlg.addEventListener('close', () => { dlg.remove(); resolver(r); });
		dlg.showModal();
		dlg.querySelector('[data-r="0"]').focus();
	});
}

/** Paginador: "« Anterior · Página 2 de 15 (734) · Siguiente »". Los botones llevan data-pag="n". */
export function paginador({ pagina, paginas, total }) {
	if (paginas <= 1) { return ''; }
	const btn = (n, txt, ok) => `<button class="btn btn-sm btn-light" data-pag="${n}" ${ok ? '' : 'disabled'}>${txt}</button>`;
	return `<div style="display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-top:12px">
		${btn(pagina - 1, '<i class="fa fa-chevron-left"></i>Anterior', pagina > 1)}
		<span class="inv-ayuda">Página <b>${pagina}</b> de ${paginas} · ${total} en total</span>
		${btn(pagina + 1, 'Siguiente<i class="fa fa-chevron-right" style="margin:0 0 0 6px"></i>', pagina < paginas)}
	</div>`;
}

const FORMATO_KEY = 'lg_formato_impresion';
const CSS_IMPRESION = {
	a5: `@page{size:A5;margin:10mm}body{font:11px system-ui,sans-serif;color:#212529;margin:0}h1{font-size:15px}h2{font-size:12.5px}`,
	// 80 mm: el papel del ticket; columnas marcadas .solo-a5 no caben y se ocultan
	ticket: `@page{size:80mm auto;margin:3mm}body{font:11px system-ui,sans-serif;color:#000;margin:0;width:74mm}h1{font-size:13px}h2{font-size:11.5px}
		th,td{padding:2px 3px!important}.solo-a5{display:none!important}.firma{flex-direction:column;gap:22px!important}`,
};

/**
 * Imprime SIN abrir otra pagina: pregunta A5 o Ticket (recuerda la ultima eleccion), arma el documento en un iframe
 * oculto y abre solo el dialogo de impresion del navegador. cuerpo: HTML ya escapado; estilos: CSS propio del documento.
 */
export async function imprimir({ titulo, cuerpo, estilos = '' }) {
	let ultimo = 'a5';
	try { ultimo = localStorage.getItem(FORMATO_KEY) || 'a5'; } catch (e) { /* sin storage: A5 */ }
	const formato = await new Promise(resolver => {
		const dlg = document.createElement('dialog');
		dlg.className = 'lg-dlg lg-app';
		dlg.innerHTML = `
			<div class="xdlg-head"><h3><i class="fa fa-print" style="color:#007bff;margin-right:6px"></i>¿En qué formato imprimes?</h3></div>
			<div class="xdlg-body" style="display:flex;gap:10px;flex-wrap:wrap">
				<button class="btn btn-light lg-fmt" data-f="a5"><i class="fa fa-file-text-o"></i><b>Hoja A5</b><span>media hoja, impresora normal</span></button>
				<button class="btn btn-light lg-fmt" data-f="ticket"><i class="fa fa-ticket"></i><b>Ticket</b><span>80 mm, ticketera</span></button>
			</div>
			<div class="xdlg-foot"><button class="btn btn-sm btn-light" data-f=""><i class="fa fa-times"></i>Cancelar</button></div>`;
		document.body.appendChild(dlg);
		let f = '';
		dlg.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { f = b.dataset.f; dlg.close(); } });
		dlg.addEventListener('close', () => { dlg.remove(); resolver(f); });
		dlg.showModal();
		dlg.querySelector(`[data-f="${ultimo}"]`).focus();
	});
	if (!formato) { return; }
	try { localStorage.setItem(FORMATO_KEY, formato); } catch (e) { /* no se recuerda, no pasa nada */ }
	const ifr = document.createElement('iframe');
	ifr.setAttribute('aria-hidden', 'true');
	Object.assign(ifr.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
	document.body.appendChild(ifr);
	const doc = ifr.contentDocument;
	doc.open();
	doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>
		table{width:100%;border-collapse:collapse}th,td{padding:4px 6px;border-bottom:1px solid #ccc;text-align:left;vertical-align:top}
		.n{text-align:right}.m{color:#555}.firma{margin-top:24px;display:flex;gap:30px}.firma div{flex:1;border-top:1px solid #333;padding-top:3px;text-align:center}
		.pag{page-break-inside:avoid}${estilos}${CSS_IMPRESION[formato]}</style></head><body>${cuerpo}</body></html>`);
	doc.close();
	const quitar = () => setTimeout(() => ifr.remove(), 500);
	ifr.contentWindow.addEventListener('afterprint', quitar);
	setTimeout(() => { ifr.contentWindow.focus(); ifr.contentWindow.print(); setTimeout(() => ifr.isConnected && ifr.remove(), 60000); }, 150);
}
