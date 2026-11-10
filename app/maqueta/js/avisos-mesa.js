// Avisos de la carta virtual (QR de mesa, app pwa-app-pedido) en la maqueta en vivo:
// 1) crearAvisosMesa: el cliente pidio, llama al personal, pago por la app o dejo un pedido por confirmar → la mesa
//    late en el salon (ondas en el piso, una etiqueta y su persona animada: escena.setActores → actores3d.js).
//    Escucha los mismos eventos del socket que app/view/socket.service.p.js y app/shared/pedido.por.confirmar.js, sin tocarlos: los avisos de siempre (PNotify,
//    sonido) siguen saliendo igual. Tocar la etiqueta o la mesa la abre y apaga su aviso.
// 2) crearPortal: en pantalla completa solo se ve el contenedor; los avisos PNotify, los SweetAlert y el dialogo
//    "Por confirmar" se pintan en el body. Mientras dura la pantalla completa se mudan adentro (y vuelven al salir),
//    asi caja atiende todo sin minimizar.
// Todo texto entra como texto (createElement), nunca HTML. Estilos en ../maqueta.css (prefijo mq-av / maq-avisos).
import { claveMesa } from './plano.js?v=20261102m';

const SVG = 'http://www.w3.org/2000/svg';
const MIN_DIAMETRO = 44, FACTOR_DIAMETRO = 1.5;   // px: las ondas, segun el ancho de la mesa en pantalla
/** Que muestra cada aviso. ms: cuanto late despues del evento (los por confirmar laten ademas mientras sigan). */
export const AVISOS = Object.freeze({
	pedido: { texto: 'Pidió por QR', ms: 60000, trazos: ['M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3M20 14v3M14 20h7'] },
	llamado: { texto: 'Llama al personal', ms: 180000, trazos: ['M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9', 'M10.3 21a1.94 1.94 0 0 0 3.4 0'] },
	pago: { texto: 'Pagó por la app', ms: 60000, trazos: ['M2 5h20v14H2zM2 10h20'] },
	confirmar: { texto: 'Por confirmar', ms: 30000, trazos: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2'] },
});
const EVENTOS = ['nuevoPedido', 'notificar-cliente-llamado', 'notificar-pago-pwa', 'pedido-por-confirmar-nuevo', 'pedido-por-confirmar-recordar'];
// Lo que se muda a la pantalla completa: avisos PNotify, SweetAlert (modal y toast) y el dialogo de pedido por confirmar.
const AL_PORTAL = '.ui-pnotify, .swal2-container, #ppc-dlg';

const conMesa = (mesa, tipo) => {
	const s = mesa == null ? '' : String(mesa).trim();
	return s && s !== '0' ? { mesa: s, tipo } : null;
};
const noEsCliente = v => v === 0 || v === '0' || v === false;

/**
 * Evento del socket → aviso de mesa, o null si no es de una mesa (para llevar, delivery, mozo, pago rechazado). Puro.
 * @returns {{mesa: string, tipo: 'pedido'|'llamado'|'pago'|'confirmar'}|null}
 */
export function avisoDeEvento(evento, d) {
	switch (evento) {
	case 'nuevoPedido': {
		const h = d && d.p_header;
		return h && !noEsCliente(h.isCliente) ? conMesa(h.m, 'pedido') : null;   // la misma regla de pNotificaNuevoPedido
	}
	case 'notificar-cliente-llamado':
		return conMesa(d && typeof d === 'object' ? d.mesa : d, 'llamado');
	case 'notificar-pago-pwa':
		return d && !d.isdelivery && !(d.objTransaction && d.objTransaction.error) ? conMesa(d.mesa, 'pago') : null;
	case 'pedido-por-confirmar-nuevo':
	case 'pedido-por-confirmar-recordar':
		return conMesa(d && d.mesa, 'confirmar');
	default:
		return null;
	}
}

const numeroFinal = c => (claveMesa(c).match(/[0-9]+$/) || [''])[0];
/**
 * El codigo del plano para la mesa del aviso: igual por claveMesa ("5" = "05") o, si el area usa prefijo ("P1-05"),
 * por el numero cuando hay una sola mesa con ese numero. null = no esta en esta area (o es ambiguo). Puro.
 */
export function codigoDeMesa(codigos, mesa) {
	const lista = Array.isArray(codigos) ? codigos : [];
	const k = claveMesa(mesa);
	const igual = lista.find(c => claveMesa(c) === k);
	if (igual) { return igual; }
	const n = numeroFinal(mesa);
	const porNumero = n ? lista.filter(c => numeroFinal(c) === n) : [];
	return porNumero.length === 1 ? porNumero[0] : null;
}

/**
 * Los avisos que laten ahora: los del socket que no vencieron y, para cada mesa por confirmar sin otro aviso, uno
 * 'confirmar' (la marca de la tarjeta: late hasta que caja o el mozo lo atiendan). Puro.
 * @param {Map<string, {mesa: string, tipo: string, hasta: number}>} activos por claveMesa
 * @param {string[]|null} porConfirmar codigos de las mesas con pedido por confirmar
 */
export function vigentes(activos, ahora, porConfirmar) {
	const res = [], vistas = new Set();
	for (const [clave, a] of activos) {
		if (a.hasta > ahora) { res.push({ mesa: a.mesa, tipo: a.tipo }); vistas.add(clave); }
	}
	for (const codigo of Array.isArray(porConfirmar) ? porConfirmar : []) {
		if (!vistas.has(claveMesa(codigo))) { res.push({ mesa: codigo, tipo: 'confirmar' }); }
	}
	return res;
}

function icono(doc, trazos) {
	const svg = doc.createElementNS(SVG, 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	for (const d of trazos) {
		const p = doc.createElementNS(SVG, 'path');
		p.setAttribute('d', d);
		svg.append(p);
	}
	return svg;
}

/**
 * Capa de avisos dentro de host (el contenedor de la escena). Quien llama repinta con la lista de estados y la escena
 * en cada cambio de datos o de vista; los avisos vencidos se van solos.
 * @param {{doc: Document, global: Window, host: Element, abrir: (codigo: string) => void, avisar: Function}} o
 * @returns {{pintar: Function, atendida: Function, destruir: Function}}
 */
export function crearAvisosMesa({ doc, global: g, host, abrir, avisar }) {
	const capa = doc.createElement('div');
	capa.className = 'maq-avisos';
	host.append(capa);
	const activos = new Map();   // claveMesa → {mesa, tipo, hasta}
	const pintados = new Map();  // codigo → {el, tipo}
	let ultimo = null, socket = null, oyentes = [], reloj = 0, muerta = false;

	function recibir(evento, d) {
		const a = avisoDeEvento(evento, d);
		if (!a || muerta) { return; }
		activos.set(claveMesa(a.mesa), { ...a, hasta: Date.now() + AVISOS[a.tipo].ms });
		dibujar();
	}
	// El socket de la pagina (socket.master.service.js). Si se recreo, se vuelve a enganchar al nuevo.
	function enganchar() {
		const svc = g.socketService && typeof g.socketService.getInstance === 'function' ? g.socketService.getInstance() : null;
		const sk = svc && svc._socket;
		if (!sk || sk === socket || typeof sk.on !== 'function') { return; }
		soltar();
		socket = sk;
		oyentes = EVENTOS.map(ev => [ev, d => { try { recibir(ev, d); } catch (e) { avisar('error en un aviso de la carta', e); } }]);
		for (const [ev, fn] of oyentes) { sk.on(ev, fn); }
	}
	function soltar() {
		if (socket && typeof socket.off === 'function') { for (const [ev, fn] of oyentes) { socket.off(ev, fn); } }
		socket = null;
		oyentes = [];
	}

	function nuevo(codigo, tipo) {
		const el = doc.createElement('div');
		el.className = `mq-av mq-av-${tipo}`;
		const chip = doc.createElement('button');
		chip.type = 'button';
		chip.className = 'mq-av-chip';
		chip.title = `Mesa ${codigo}: abrir`;
		chip.append(icono(doc, AVISOS[tipo].trazos), AVISOS[tipo].texto);
		chip.addEventListener('click', e => { e.stopPropagation(); atendida(codigo); abrir(codigo); });
		for (let i = 0; i < 2; i++) { const o = doc.createElement('i'); o.className = 'mq-av-onda'; el.append(o); }
		el.append(chip);
		capa.append(el);
		return { el, tipo };
	}
	function dibujar() {
		clearTimeout(reloj);
		if (muerta || !ultimo) { return; }
		const { lista, escena } = ultimo, ahora = Date.now();
		for (const [k, a] of activos) { if (a.hasta <= ahora) { activos.delete(k); } }
		const codigos = lista.map(e => e.codigo).filter(Boolean);
		const porConfirmar = lista.filter(e => e.m && e.m.porConfirmar).map(e => e.m.codigo);
		const quedan = new Set(), actores = [];
		for (const a of vigentes(activos, ahora, porConfirmar)) {
			const codigo = codigoDeMesa(codigos, a.mesa);
			if (codigo && !actores.some(x => x.codigo === codigo)) { actores.push({ codigo, tipo: a.tipo }); }
			const p = codigo ? escena.proyectar(codigo) : null;
			if (!p || quedan.has(codigo)) { continue; }
			quedan.add(codigo);
			let r = pintados.get(codigo);
			if (r && r.tipo !== a.tipo) { r.el.remove(); r = null; }
			if (!r) { r = nuevo(codigo, a.tipo); pintados.set(codigo, r); }
			r.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
			r.el.style.setProperty('--d', `${Math.max(MIN_DIAMETRO, p.px * FACTOR_DIAMETRO)}px`);
		}
		for (const [codigo, r] of pintados) { if (!quedan.has(codigo)) { r.el.remove(); pintados.delete(codigo); } }
		// la persona de la mesa se anima (actores3d.js): levanta la mano, usa el celular en el QR o muestra con que paga
		if (typeof escena.setActores === 'function') { escena.setActores(actores); }
		// el proximo vencimiento repinta solo (sin esperar otro cambio de la grilla)
		const prox = Math.min(...[...activos.values()].map(a => a.hasta));
		if (Number.isFinite(prox)) { reloj = g.setTimeout(() => { try { dibujar(); } catch (e) { avisar('error en los avisos de la carta', e); } }, Math.max(0, prox - ahora) + 50); }
	}
	/** Se abrio la mesa: su aviso del socket se apaga (el por confirmar sigue hasta que se confirme o anule). */
	function atendida(codigo) {
		activos.delete(claveMesa(codigo));
		for (const [k, a] of activos) { if (codigoDeMesa([codigo], a.mesa)) { activos.delete(k); } }
		dibujar();
	}

	return Object.freeze({
		/** @param {{codigo: string, m: object|null}[]} lista la de pintarEstados; escena con proyectar(codigo) */
		pintar(lista, escena) {
			if (muerta) { return; }
			enganchar();
			ultimo = { lista: Array.isArray(lista) ? lista : [], escena };
			dibujar();
		},
		atendida,
		destruir() {
			if (muerta) { return; }
			muerta = true;
			clearTimeout(reloj);
			soltar();
			capa.remove();
			pintados.clear();
			activos.clear();
		},
	});
}

/**
 * Mientras el contenedor el esta en pantalla completa, los avisos y dialogos que la pagina pone en el body se mudan
 * adentro (los que ya estan y los que lleguen). soltar() los devuelve al body.
 * @returns {{soltar: Function}}
 */
export function crearPortal(doc, el) {
	const mover = n => { if (n.nodeType === 1 && n.parentNode !== el && n.matches(AL_PORTAL)) { el.appendChild(n); } };
	[...doc.body.children].forEach(mover);
	const obs = new MutationObserver(cambios => cambios.forEach(c => c.addedNodes.forEach(mover)));
	obs.observe(doc.body, { childList: true });
	return {
		soltar() {
			obs.disconnect();
			[...el.children].filter(n => n.matches(AL_PORTAL)).forEach(n => doc.body.appendChild(n));
		},
	};
}
