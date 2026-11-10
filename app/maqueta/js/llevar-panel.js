// Panel "Llevar · Delivery" de la maqueta 3D, solo en pantalla completa (diseño A del prototipo salon-3d.html:
// boton junto a la ocupacion + panel lateral derecho). vivo.js lo crea al entrar a pantalla completa y lo destruye
// al salir. Todo con createElement/textContent: nada del servidor se pinta como HTML.
// Datos: para llevar = tarjetas de la grilla (se releen en cada cuadro de vivo.js); delivery = op=7 de log_009
// (al abrir el panel y cada 60 s mientras esta abierto) + los delivery abiertos de la grilla.
import {
	ESTADOS, esTarde, haceMin, soles, fechaHoy, tiposDeConsumo, pedidosDeGrilla, deliveryDeOp7, unirDelivery, grupos, pie,
	conteos, subtotalesSinReparto, conMinutos,
} from './llevar.js?v=20261102m';
import { emitirSoloComprobante } from './llevar-comprobante.js?v=20261102m';

const URL_DELIVERY = '../../bdphp/log_009.php?op=7';
const CADA_MS = 60000;
const MARGEN = 12;   // px entre el panel y los bordes
const PESTANAS = [['llevar', 'bolsa', 'Llevar'], ['delivery', 'moto', 'Delivery'], ['reserva', 'reloj', 'Reservas']];   // Reservas: solo si hay
// Iconos de linea (trazos tipo Lucide, 24x24): sin emojis, se ven igual en cualquier equipo.
const ICONOS = {
	bolsa: ['M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z', 'M3 6h18', 'M16 10a4 4 0 0 1-8 0'],
	moto: ['M2 17.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0', 'M15 17.5a3.5 3.5 0 1 0 7 0a3.5 3.5 0 1 0-7 0', 'M14 5a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M12 17.5V14l-3-3 4-3 2 3h2'],
	pin: ['M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0', 'M9 10a3 3 0 1 0 6 0a3 3 0 1 0-6 0'],
	fono: ['M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.9.6 2.8.7a2 2 0 0 1 1.7 2'],
	recibo: ['M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z', 'M8 8h8', 'M8 12h8', 'M8 16h5'],
	alerta: ['m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3', 'M12 9v4', 'M12 17h.01'],
	check: ['M20 6 9 17l-5-5'],
	reloj: ['M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0', 'M12 6v6l4 2'],
};
const AVISO_SIN_RED = 'No se pudo actualizar los delivery. Se vuelve a intentar en 1 minuto.';

function icono(doc, nombre) {
	const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('class', 'maq-ld-svg');
	for (const d of ICONOS[nombre]) { const p = doc.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d); svg.append(p); }
	return svg;
}

function nodo(doc, tag, clase, texto) {
	const e = doc.createElement(tag);
	if (clase) { e.className = clase; }
	if (texto != null && texto !== '') { e.textContent = String(texto); }
	return e;
}

/** Tipos de consumo y reparto de la sede, de lo que el POS ya tiene en memoria (sin pedir nada). */
function leerSede(g) {
	const leer = k => { try { return typeof g.xm_log_get === 'function' ? g.xm_log_get(k) : null; } catch (e) { return null; } };
	const sede = leer('datos_org_all_sede');
	const propio = Array.isArray(sede) && sede[0] ? sede[0].pwa_delivery_servicio_propio === '1' : true;
	return { tipos: tiposDeConsumo(leer('estructura_pedido')), subtotales: propio ? (s => s) : subtotalesSinReparto };
}

/**
 * @param {{doc: Document, global: Window, contenedor: Element, junto: Element, grid: Element,
 *   abrir: (tarjeta: Element) => void, avisar: (que: string, e?: any) => void, ahora?: () => number}} o
 *   contenedor: lo que esta en pantalla completa; junto: el indicador de ocupacion (el boton va a su derecha)
 * @returns {{refrescar: Function, destruir: Function}}
 */
export function crearLlevar(o) {
	const { doc, global: g, contenedor, junto, grid } = o;
	const sede = leerSede(g);
	const ahora = typeof o.ahora === 'function' ? o.ahora : () => Date.now();
	const st = { abierto: false, pestana: 'llevar', op7: null, sinRed: false, timer: 0, gen: 0, muerto: false, firmaBoton: '', firmaLista: '' };
	const comprobantes = new Map();   // id → numero emitido desde aqui (hasta que op=7 lo traiga)
	const enCurso = new Set();
	let llevar = [], delivery = [], reservas = [];

	// ---------------------------------------------------------------- piezas
	const boton = nodo(doc, 'button', 'maq-ld-btn');
	boton.type = 'button';
	boton.title = 'Pedidos para llevar y delivery';
	const panel = nodo(doc, 'aside', 'maq-ld-drawer');
	panel.setAttribute('aria-label', 'Para llevar y delivery');
	const cabeza = nodo(doc, 'div', 'maq-ld-head');
	const tabs = nodo(doc, 'div', 'maq-ld-tabs');
	const botonesTab = PESTANAS.map(([t]) => {
		const b = nodo(doc, 'button');
		b.type = 'button';
		b.setAttribute('data-t', t);
		b.addEventListener('click', seguro(() => { st.pestana = t; pintarPanel(true); }));
		return b;
	});
	tabs.append(...botonesTab);
	const cerrarX = nodo(doc, 'button', 'maq-ld-x', '×');
	cerrarX.type = 'button';
	cerrarX.title = 'Cerrar';
	cabeza.append(tabs, cerrarX);
	const buscar = nodo(doc, 'div', 'maq-ld-buscar');
	const input = nodo(doc, 'input');
	input.type = 'search';
	input.placeholder = 'Buscar cliente, #pedido, teléfono o dirección…';
	input.autocomplete = 'off';
	input.setAttribute('aria-label', 'Buscar un pedido para llevar o delivery');
	buscar.append(input);
	const aviso = nodo(doc, 'div', 'maq-ld-aviso');
	aviso.setAttribute('role', 'status');
	aviso.hidden = true;
	const lista = nodo(doc, 'div', 'maq-ld-list');
	const piePanel = nodo(doc, 'div', 'maq-ld-foot');
	panel.append(cabeza, buscar, aviso, lista, piePanel);

	const quitar = [];
	if (junto && junto.parentNode) { junto.parentNode.insertBefore(boton, junto); } else { contenedor.append(boton); }
	contenedor.append(panel);
	quitar.push(() => boton.remove(), () => panel.remove());

	/** fn que nunca lanza: un error del panel se avisa y el panel se quita (la maqueta y el cobro siguen). */
	function seguro(fn) {
		return (...a) => {
			try { return fn(...a); } catch (e) { o.avisar('error en el panel de llevar y delivery; se quita', e); destruir(); return undefined; }
		};
	}

	// ---------------------------------------------------------------- datos
	function leerDatos() {
		const deGrilla = pedidosDeGrilla(Array.from(grid.querySelectorAll('.xMiCardPedido')), sede.tipos, ahora());
		llevar = deGrilla.filter(p => p.t === 'llevar');
		reservas = deGrilla.filter(p => p.t === 'reserva');
		delivery = unirDelivery(st.op7 && conMinutos(st.op7, ahora()), deGrilla).map(p => (comprobantes.has(p.id) && !p.comprobante ? { ...p, comprobante: comprobantes.get(p.id) } : p));
	}

	async function pedirDelivery() {
		const mio = ++st.gen;
		let datos = null;
		try {
			const res = await g.fetch(URL_DELIVERY, {
				method: 'POST', credentials: 'same-origin', cache: 'no-store',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
				body: `fecha=${encodeURIComponent(fechaHoy(ahora()))}`,
			});
			const txt = await res.text();
			const json = JSON.parse(txt);
			if (!json || !Array.isArray(json.datos)) { throw new Error('respuesta de op=7 no valida'); }
			datos = json;
		} catch (e) {
			o.avisar('no se pudo leer los delivery (op=7)', e);
		}
		if (st.muerto || mio !== st.gen) { return; }
		st.sinRed = !datos;
		if (datos) { st.op7 = deliveryDeOp7(datos, ahora(), sede.subtotales); }
		refrescar();
	}

	function programarDelivery() {
		g.clearTimeout(st.timer);
		st.timer = g.setTimeout(seguro(() => {
			if (!st.abierto || st.muerto) { return; }
			pedirDelivery();
			programarDelivery();
		}), CADA_MS);
	}

	// ---------------------------------------------------------------- pintar
	function pintarBoton() {
		const c = conteos(llevar, delivery, reservas);
		const firma = JSON.stringify([c, st.abierto]);
		if (firma === st.firmaBoton) { return; }
		st.firmaBoton = firma;
		const cuenta = x => { const b = nodo(doc, 'b', x.tarde ? 'maq-ld-late' : '', String(x.n)); return b; };
		const car = nodo(doc, 'span', 'maq-ld-car', st.abierto ? '▴' : '▾');
		const conReservas = c.reserva.n ? [nodo(doc, 'span', 'maq-ld-sep'), icono(doc, 'reloj'), 'Reservas ', cuenta(c.reserva)] : [];
		boton.replaceChildren(icono(doc, 'bolsa'), 'Llevar ', cuenta(c.llevar), nodo(doc, 'span', 'maq-ld-sep'), icono(doc, 'moto'), 'Delivery ', cuenta(c.delivery), ...conReservas, car);
		boton.classList.toggle('maq-on', st.abierto);
		boton.setAttribute('aria-expanded', String(st.abierto));
	}

	function estado(p) {
		const e = nodo(doc, 'span', `maq-ld-est maq-ld-${p.est}`);
		e.append(nodo(doc, 'i'), ESTADOS[p.est] || '');
		return e;
	}

	function fila(p) {
		const it = nodo(doc, 'div', 'maq-ld-it');
		it.setAttribute('data-id', p.id);
		if (p.tarjeta) {
			it.setAttribute('role', 'button');
			it.setAttribute('tabindex', '0');
			it.title = 'Abrir el pedido';
		} else {
			it.classList.add('maq-ld-fija');
		}
		const ico = nodo(doc, 'span', p.t === 'delivery' ? 'maq-ld-ico maq-ld-dl' : 'maq-ld-ico');
		ico.append(icono(doc, { delivery: 'moto', reserva: 'reloj' }[p.t] || 'bolsa'));
		const tx = nodo(doc, 'span', 'maq-ld-tx');
		const tarde = esTarde(p);
		const l1 = nodo(doc, 'span', 'maq-ld-l1');
		const min = nodo(doc, 'span', tarde ? 'maq-ld-min maq-ld-late' : 'maq-ld-min');
		if (tarde) { min.append(icono(doc, 'alerta')); }
		min.append(haceMin(p.min));
		l1.append(nodo(doc, 'span', 'maq-ld-num', `#${p.n}`), nodo(doc, 'span', 'maq-ld-who', p.quien), min);
		const l2 = nodo(doc, 'span', 'maq-ld-l2');
		const pago = nodo(doc, 'span', p.pag ? 'maq-ld-pago maq-ld-si' : 'maq-ld-pago maq-ld-no');
		if (p.pag) { pago.append(icono(doc, 'check')); }
		pago.append(p.pag ? 'Pagado' : 'Por cobrar');
		l2.append(estado(p), pago, nodo(doc, 'span', 'maq-ld-imp', soles(p.imp)));
		tx.append(l1, l2);
		if (p.t === 'delivery') {
			const partes = [['pin', p.dir], ['fono', p.tel], ['moto', p.rep]].filter(x => x[1]);
			if (partes.length) {
				const l3 = nodo(doc, 'span', 'maq-ld-l3');
				partes.forEach(([i, t], k) => l3.append(k ? ' · ' : '', icono(doc, i), String(t)));
				tx.append(l3);
			}
			if (p.comprobante) { const c = nodo(doc, 'span', 'maq-ld-l3 maq-ld-cpe'); c.append(icono(doc, 'recibo'), String(p.comprobante)); tx.append(c); }
		}
		if (p.mesa) { tx.append(nodo(doc, 'span', 'maq-ld-l3', `Mesa ${p.mesa}`)); }
		if (p.items) { tx.append(nodo(doc, 'span', 'maq-ld-l3', p.items)); }
		if (p.t === 'delivery' && !p.pag) {
			const acc = nodo(doc, 'span', 'maq-ld-acc');
			if (p.tarjeta) {
				const b = nodo(doc, 'button', 'maq-ld-prim', 'Cobrar');
				b.type = 'button';
				b.setAttribute('data-acc', 'cobrar');
				acc.append(b);
			}
			if (!p.comprobante && p.json) {
				const b = nodo(doc, 'button');
				b.append(icono(doc, 'recibo'), enCurso.has(p.id) ? 'Emitiendo…' : 'Solo comprobante');
				b.type = 'button';
				b.title = 'Emite boleta o factura sin registrar el pago';
				b.setAttribute('data-acc', 'comprobante');
				if (enCurso.has(p.id)) { b.disabled = true; }
				acc.append(b);
			}
			if (acc.children.length) { tx.append(acc); }
		}
		it.append(ico, tx);
		return it;
	}

	function pintarPanel(forzar) {
		if (!st.abierto) { return; }
		const q = input.value;
		if (st.pestana === 'reserva' && !reservas.length) { st.pestana = 'llevar'; }   // se atendio la ultima reserva
		const deTab = { llevar, delivery, reserva: reservas }[st.pestana];
		const gr = grupos(deTab, q);
		const firma = JSON.stringify([st.pestana, q, llevar.length, delivery.length, reservas.length, gr.lista.map(p => ({ ...p, json: !!p.json })), [...enCurso], st.sinRed, st.op7 == null]);
		if (!forzar && firma === st.firmaLista) { return; }
		st.firmaLista = firma;
		const n = { llevar: llevar.length, delivery: delivery.length, reserva: reservas.length };
		botonesTab.forEach((b, i) => {
			const [t, ico, rotulo] = PESTANAS[i];
			b.replaceChildren(icono(doc, ico), `${rotulo} (${n[t]})`);
			b.classList.toggle('maq-on', t === st.pestana);
			b.hidden = t === 'reserva' && !n.reserva;
		});
		aviso.textContent = AVISO_SIN_RED;
		aviso.hidden = !(st.sinRed && st.pestana === 'delivery');
		const hijos = [];
		const grupo = (titulo, g2) => {
			if (!g2.pedidos.length) { return; }
			const cab = nodo(doc, 'div', 'maq-ld-grupo');
			cab.append(nodo(doc, 'span', '', titulo), nodo(doc, 'span', '', `${g2.pedidos.length} · ${soles(g2.total)}`));
			hijos.push(cab, ...g2.pedidos.map(fila));
		};
		grupo('Por cobrar', gr.porCobrar);
		grupo('Pagados', gr.pagados);
		if (!hijos.length) {
			const vacio = st.pestana === 'delivery' && st.op7 == null && !st.sinRed ? 'Cargando delivery…' : (q.trim() ? `Ningún pedido con «${q.trim()}».` : 'Sin pedidos.');
			hijos.push(nodo(doc, 'p', 'maq-ld-vacio', vacio));
		}
		lista.replaceChildren(...hijos);
		piePanel.replaceChildren(nodo(doc, 'span', '', pie(gr.lista)), nodo(doc, 'span', '', 'tocar = abrir el pedido'));
	}

	/** Debajo del boton, hasta abajo de la pantalla (el alto lo pone la lista: crece y luego hace scroll). */
	function ubicar() {
		const r = boton.getBoundingClientRect();
		const arriba = Math.max(MARGEN, Math.round((r && r.bottom ? r.bottom : 44) + 8));
		panel.style.top = `${arriba}px`;
		if (r && r.right && g.innerWidth) { panel.style.right = `${Math.max(MARGEN, Math.round(g.innerWidth - r.right))}px`; }   // alineado al boton
		panel.style.maxHeight = `calc(100vh - ${arriba + MARGEN}px)`;
	}

	function refrescar() {
		if (st.muerto) { return; }
		leerDatos();
		pintarBoton();
		pintarPanel(false);
	}

	// ---------------------------------------------------------------- abrir, cerrar, acciones
	function abrirPanel() {
		st.abierto = true;
		panel.classList.add('maq-ld-open');
		ubicar();
		refrescar();
		pintarPanel(true);
		pedirDelivery();
		programarDelivery();
	}
	function cerrarPanel() {
		if (!st.abierto) { return; }
		st.abierto = false;
		g.clearTimeout(st.timer);
		st.gen++;   // una respuesta que llega con el panel cerrado no se pinta
		panel.classList.remove('maq-ld-open');
		pintarBoton();
	}

	function tarjetaDe(id) {
		return Array.from(grid.querySelectorAll('.xMiCardPedido')).find(el => String(el.getAttribute('data-p') || el.getAttribute('id') || '') === id) || null;
	}
	function abrirPedido(p) {
		const t = tarjetaDe(p.id);
		if (t) { o.abrir(t); } else { refrescar(); }   // ya no esta en la grilla (cobrado o cerrado)
	}
	function comprobante(p) {
		if (enCurso.has(p.id)) { return; }
		enCurso.add(p.id);
		pintarPanel(true);
		emitirSoloComprobante({ doc, global: g, contenedor, pedido: p }).then(seguro(num => {
			enCurso.delete(p.id);
			if (num) {
				comprobantes.set(p.id, num);
				if (typeof g.showToastSwal === 'function') { g.showToastSwal('success', `Comprobante ${num} emitido. El pedido sigue por cobrar.`); }
			}
			refrescar();
			pintarPanel(true);
		}));
	}

	boton.addEventListener('click', seguro(() => { if (st.abierto) { cerrarPanel(); } else { abrirPanel(); } }));
	cerrarX.addEventListener('click', seguro(cerrarPanel));
	input.addEventListener('input', seguro(() => pintarPanel(false)));
	lista.addEventListener('click', seguro(e => {
		const it = e.target && e.target.closest ? e.target.closest('.maq-ld-it') : null;
		if (!it) { return; }
		const p = [...llevar, ...delivery, ...reservas].find(x => x.id === it.getAttribute('data-id'));
		if (!p) { return; }
		const acc = e.target.closest('button[data-acc]');
		if (acc && acc.getAttribute('data-acc') === 'comprobante') { comprobante(p); return; }
		if (p.tarjeta) { abrirPedido(p); }
	}));
	lista.addEventListener('keydown', seguro(e => {
		if (e.key !== 'Enter' && e.key !== ' ') { return; }
		const it = e.target && e.target.matches && e.target.matches('.maq-ld-it') ? e.target : null;
		const p = it ? [...llevar, ...delivery, ...reservas].find(x => x.id === it.getAttribute('data-id')) : null;
		if (p && p.tarjeta) { if (e.preventDefault) { e.preventDefault(); } abrirPedido(p); }
	}));
	const alTecla = seguro(e => { if (e.key === 'Escape' && st.abierto) { cerrarPanel(); } });
	if (typeof doc.addEventListener === 'function') {
		doc.addEventListener('keydown', alTecla);
		quitar.push(() => doc.removeEventListener('keydown', alTecla));
	}
	const alRedimensionar = seguro(() => { if (st.abierto) { ubicar(); } });
	if (typeof g.addEventListener === 'function') {
		g.addEventListener('resize', alRedimensionar);
		quitar.push(() => g.removeEventListener('resize', alRedimensionar));
	}

	function destruir() {
		if (st.muerto) { return; }
		st.muerto = true;
		st.abierto = false;
		g.clearTimeout(st.timer);
		while (quitar.length) { try { quitar.pop()(); } catch (e) { o.avisar('error al quitar el panel de llevar', e); } }
	}

	refrescar();
	return { refrescar: seguro(refrescar), destruir, _estado: st };
}
