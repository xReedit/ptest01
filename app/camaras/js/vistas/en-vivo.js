// En vivo (ruta "en-vivo", desde el inicio): cómo están las mesas ahora según las cámaras, por área.
// Cada 5 s (de inicio a inicio, nunca dos a la vez) GET mesas/estado, solo mientras la pantalla se ve y la pestaña
// está visible (repetir de probar.js); si falla, a los 15 s, sin borrar las mesas. 404 (el servidor todavía no
// tiene esta función), 403, sesión terminada u otra sede: deja de pedir y lo dice. Al salir (ctx.senal) para del
// todo, sin timers ni listeners colgados. Cada lectura lleva su número: una respuesta o un error más viejo que lo ya
// pintado se descarta. Volver a la pantalla (por ejemplo, después de guardar Parámetros) la lee de nuevo. Los minutos
// van con la hora del servidor (data.ahora, F2-R45). Arriba, el modo de la sede ("solo medir": la API ya filtra las alertas).
// Cada mesa: su estado (etiqueta) y debajo su pedido del POS (textoCuenta, F2-R43). Con una alerta: Ya lo vi
// (POST alertas/{id}/resolver) y, si es de la sesión abierta, Silenciar esta mesa (POST sesiones/{id}/silenciar);
// los dos preguntan antes (confirmar) y al terminar se lee el estado de nuevo. Con un aviso del socket del POS (cobro,
// pedido nuevo, cámara) se lee enseguida, sin esperar los 5 s (escucharPos); la primera lectura y las de un cobro o
// pedido van con fresco=1: la cuenta sin la caché de 20 s del servidor.
import { esc, tarjeta, volver, aviso, confirmar } from '../ui.js?v=20261020i';
import { repetir } from './probar.js?v=20261020i';
import { etiqueta, textoCuenta, porArea, puedeSilenciar, desfaseReloj } from '../estado-mesas.js?v=20261020i';
import { claveMesa } from '../mesas-sede.js?v=20261020i';

export const CADA_MS = 5000;     // de inicio a inicio de una lectura
export const LENTO_MS = 15000;   // pausa después de una lectura que no salió
// Avisos del socket de la sede tras los que se lee el estado: [evento, con la cuenta fresca]. Cobro, anulación o
// cambio de mesa (Control de Mesas), venta, pago y pedido nuevo cambian una cuenta; vision-mesas-estado, la cámara.
export const EVENTOS_POS = [['mesa-cambio', true], ['restobar-venta-registrada-res', true],
	['restobar-notifica-pay-pedido-res', true], ['nuevoPedido', true],
	['vision-mesas-estado', false], ['vision-alerta', false], ['vision-alerta-resuelta', false]];
// junta la ráfaga de avisos de un cobro en una lectura; igual a RefrescoMin del servidor (puente.go): así la caché
// guardada justo antes del cobro ya tiene esa edad y se descarta
export const ESPERA_POS_MS = 1000;

const AYUDA = 'Cómo están las mesas ahora, según las cámaras. Se actualiza sola cada 5 segundos.';
const MODO_MEDIR = 'Modo: solo medir (no se avisa a nadie)';
const MODO_AVISAR = 'Modo: avisando';
const DORMIDA = 'Fuera del horario del local: las cámaras descansan.';
const SIN_MESAS = 'Todavía no hay mesas marcadas en las cámaras. Márcalas en Grabadores y cámaras.';
const SIN_RED = 'Sin conexión con el servicio de cámaras. Revisa el internet.';
const NO_SE_PUDO = 'No se pudo traer el estado de las mesas.';
const REINTENTO = ` Se vuelve a intentar sola cada ${LENTO_MS / 1000} segundos.`;
const GENERICO = 'Algo salió mal. Vuelve a intentar.';
// estos no se arreglan reintentando: la pantalla deja de pedir
const SIN_FUNCION = 'Esta función todavía no está instalada en el servidor de cámaras.';   // 404: servidor de F1
const SIN_PERMISO = 'No tienes permiso para ver esto.';   // 403
// la alerta o la sesión ya cambió en el servidor: el estado se lee de nuevo después del aviso
const TEXTO_ERROR = {
	alerta_resuelta: 'Esta alerta ya estaba cerrada.',
	sesion_cerrada: 'La mesa ya se vació: no hace falta silenciarla.',
	no_encontrado: 'Esta mesa ya cambió. Mira cómo está ahora.',
};
const BTN_PARAMETROS = '<a class="btn btn-sm btn-light" href="#" data-ir="parametros"><i class="fa fa-sliders"></i>Parámetros</a>';
const propio = (mapa, k) => (Object.prototype.hasOwnProperty.call(mapa, k) ? mapa[k] : '');

/* ---------- lo que no es DOM (se prueba en Node) ---------- */

/** Arriba: el modo de la sede y, fuera de horario, que las cámaras descansan. d = data de GET mesas/estado. */
export function htmlModo(d) {
	const avisando = d.modo === 'alertar';
	const dormida = d.vigilancia === 'dormida'
		? `<p class="inv-ayuda cm-nota"><i class="fa fa-moon-o"></i>${esc(DORMIDA)}</p>` : '';
	return `<p class="vm-modo${avisando ? ' avisando' : ''}"><i class="fa ${avisando ? 'fa-bell' : 'fa-bell-slash'}"></i>`
		+ `${esc(avisando ? MODO_AVISAR : MODO_MEDIR)}</p>${dormida}`;
}

function htmlBotones(m, clave) {
	if (!m.alerta) { return ''; }
	const silenciar = puedeSilenciar(m)
		? `<button class="btn btn-sm btn-light" type="button" data-acc="silenciar" data-mesa="${esc(clave)}"><i class="fa fa-bell-slash"></i>Silenciar esta mesa</button>`
		: '';
	return `<div class="vm-acciones"><button class="btn btn-sm btn-success" type="button" data-acc="resolver" data-mesa="${esc(clave)}"><i class="fa fa-check"></i>Ya lo vi</button>${silenciar}</div>`;
}

/** El pie de la tarjeta: el pedido (textoCuenta) con el monto resaltado y el resto ("pedido hace 23 min") debajo. */
function htmlPedido(c) {
	// ponytail: se parte el texto de textoCuenta en su primer " · " (monto · detalle); "Sin pedido" va entero
	const i = c.texto.indexOf(' · ');
	const resto = i < 0 ? '' : `<small>${esc(c.texto.slice(i + 3))}</small>`;
	return `<span class="vm-pedido ${c.clase}"><b>${esc(i < 0 ? c.texto : c.texto.slice(0, i))}</b>${resto}</span>`;
}

/** Una tarjeta: el número grande, las personas que ve la cámara, la etiqueta, los botones de la alerta y el pedido al pie. */
function htmlMesa(m, conPedidos, ahora) {
	const e = etiqueta(m, ahora);
	const c = textoCuenta(m, conPedidos, ahora);
	const gente = m.estado === 'ocupada' && Number.isInteger(m.personas) && m.personas > 0
		? `<span class="vm-gente" title="Personas que ve la cámara"><i class="fa fa-user"></i>${m.personas}</span>` : '';
	return `<div class="vm-mesa ${e.clase}"><div class="vm-cab"><span class="vm-nombre"><small>Mesa</small><b>${esc(m.mesa)}</b></span>${gente}</div>`
		+ `<span class="vm-etq">${esc(e.texto)}</span>`
		+ `${m.silenciada ? '<span class="vm-nota"><i class="fa fa-bell-slash"></i>Silenciada</span>' : ''}`
		+ `${htmlBotones(m, claveMesa(m.mesa_clave || m.mesa))}`
		+ `${c ? htmlPedido(c) : ''}</div>`;
}

/** Las tarjetas por área (porArea); el título del área solo si hay áreas. d = data de GET mesas/estado. */
export function htmlMesas(d, ahora) {
	const grupos = porArea(d && d.mesas);
	if (!grupos.length) {
		return `<p class="cm-vacio"><i class="fa fa-th-large"></i>${esc(SIN_MESAS)}</p>
			<a class="btn btn-sm btn-primary" href="#" data-ir="equipos"><i class="fa fa-video-camera"></i>Grabadores y cámaras</a>`;
	}
	const conTitulo = grupos.length > 1 || !!grupos[0].area;
	const conPedidos = d.con_pedidos === true;
	return grupos.map(g => `<div class="vm-area">${conTitulo ? `<p class="cm-sub">${esc(g.area || 'Sin área')}</p>` : ''}`
		+ `<div class="vm-grid">${g.mesas.map(m => htmlMesa(m, conPedidos, ahora)).join('')}</div></div>`).join('');
}

/** true si e es un error del cliente de la API (ApiError: codigo y status); si no, es un error de programa. */
const deApi = e => !!e && typeof e.codigo === 'string';

/** Un error de programa no se traga en silencio: a la consola (una vez por pantalla si se pasa v). */
function avisarConsola(e, v = null) {
	if (v && v.avisado) { return; }
	if (v) { v.avisado = true; }
	console.warn('Cámaras IA, En vivo:', e);
}

/**
 * Qué hacer si una lectura no salió: {fin, texto}. fin: reintentar no sirve y se deja de pedir (404: el servidor
 * todavía no tiene esta función; 403; sesión terminada; el POS cambió de sede). Si no, se reintenta a los 15 s.
 */
function falla(e) {
	if (!deApi(e)) { return { fin: false, texto: NO_SE_PUDO + REINTENTO }; }
	if (e.status === 404) { return { fin: true, texto: SIN_FUNCION }; }
	if (e.status === 403) { return { fin: true, texto: SIN_PERMISO }; }
	if (e.status === 401 || e.codigo === 'sede_cambiada') { return { fin: true, texto: e.message || GENERICO }; }
	return { fin: false, texto: (e.status === 0 ? SIN_RED : NO_SE_PUDO) + REINTENTO };
}

const preguntarResolver = m => confirmar({
	titulo: `¿Ya viste la mesa ${m.mesa}?`,
	textoHtml: esc('La alerta se cierra y deja de verse en esta mesa.'),
	boton: 'Sí, ya lo vi',
	peligro: false,
});

const preguntarSilenciar = m => confirmar({
	titulo: `¿Silenciar la mesa ${m.mesa}?`,
	textoHtml: esc('Las cámaras no avisarán nada más de esta mesa mientras sigan estos clientes.'),
	boton: 'Sí, silenciar',
});

/** Pregunta (preguntar(m) → Promise<boolean>) y, si dice que sí, POST ruta. null | {ok, texto} con el texto simple. */
async function accion(api, ruta, m, preguntar, listo) {
	if (!(await preguntar(m))) { return null; }
	try {
		await api.post(ruta);
		return { ok: true, texto: listo };
	} catch (e) {
		if (!deApi(e)) { avisarConsola(e); return { ok: false, texto: GENERICO }; }   // nunca el texto crudo de un error de programa
		return { ok: false, texto: propio(TEXTO_ERROR, e.codigo) || e.message || GENERICO };
	}
}

/** Ya lo vi: cierra la alerta que se ve en la mesa m. */
export const resolverAlerta = (api, m, preguntar = preguntarResolver) =>
	accion(api, `alertas/${encodeURIComponent(m.alerta.id)}/resolver`, m, preguntar, 'Listo, la alerta se cerró');

/** Silenciar esta mesa: la sesión abierta de m no crea más alertas y las vivas se cierran. */
export const silenciarMesa = (api, m, preguntar = preguntarSilenciar) =>
	accion(api, `sesiones/${encodeURIComponent(m.sesion_id)}/silenciar`, m, preguntar, 'Listo, la mesa quedó silenciada');

/* ---------- pantalla ---------- */

export async function render(cont, { api, senal, socket = socketPos() }) {
	// estado de esta pantalla (se descarta entero al salir). pedidos: el número de la última lectura pedida; ultimo:
	// el de la última que se pintó (respuesta o error); desfase: reloj del servidor − reloj de esta PC (F2-R45).
	const v = { cont, senal, pintado: new Map(), estado: null, desfase: 0, pedidos: 0, ultimo: 0, ocupado: false, avisado: false };
	cont.innerHTML = tarjeta({
		titulo: 'En vivo',
		ayuda: esc(AYUDA),
		acciones: volver('') + BTN_PARAMETROS,
		cuerpo: `<div class="vm-envivo"><div class="vm-cabecera"></div><div class="vm-falla" aria-live="polite"></div>
			<div class="vm-mesas"><p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p></div></div>`,
	});
	cont.querySelector('.inv-card').addEventListener('click', e => { alClic(e, v, api); });
	escucharPos(v, api, socket);
	// sin await: la pantalla queda dibujada y el sondeo sigue solo hasta que se aborte senal; la primera, fresca
	repetir(() => leer(v, api, v.pedidos === 0), { senal, doc: document, cada: CADA_MS, lento: LENTO_MS, hasta: Infinity });
}

/** El socket.io de la sede que abre el POS (socket.master.service.js), o null fuera del POS. */
function socketPos() {
	try {
		return typeof socketService === 'undefined' ? null : socketService.getInstance()._socket || null;
	} catch (e) {
		return null;
	}
}

/**
 * Con un aviso de EVENTOS_POS, una lectura a los ESPERA_POS_MS (una por ráfaga; fresca si algún aviso cambió una
 * cuenta). Al salir (senal) quita sus listeners y el timer. Sin socket no hace nada: queda el sondeo cada 5 s.
 * ponytail: si el POS rehace el socket con la pantalla abierta, los avisos se pierden hasta volver a entrar (el
 * sondeo sigue); re-enganchar como vision.mesas.js si llega a pasar seguido.
 */
export function escucharPos(v, api, s) {
	if (!s || typeof s.on !== 'function' || typeof s.off !== 'function') { return; }
	let t = null;
	let fresco = false;
	const oyentes = EVENTOS_POS.map(([ev, conCuenta]) => [ev, () => {
		fresco = fresco || conCuenta;
		clearTimeout(t);
		t = setTimeout(() => {
			const f = fresco;
			fresco = false;
			leer(v, api, f).catch(err => avisarConsola(err, v));   // leer no lanza; si fallara, a la consola
		}, ESPERA_POS_MS);
	}]);
	oyentes.forEach(([ev, fn]) => s.on(ev, fn));
	v.senal.addEventListener('abort', () => {
		clearTimeout(t);
		oyentes.forEach(([ev, fn]) => s.off(ev, fn));
	}, { once: true });
}

/**
 * Una lectura de GET mesas/estado con su número; devuelve lo que sigue para repetir: 'ok' | 'lento' | 'parar'.
 * Nunca lanza. Lo que llega tarde (salió de la pantalla, o ya se pintó una lectura más nueva) se descarta: un
 * error viejo no tapa datos nuevos, ni datos viejos a un error nuevo. fresco: la cuenta sin la caché del servidor.
 */
async function leer(v, api, fresco = false) {
	const n = ++v.pedidos;
	let d;
	try {
		d = await api.get(fresco ? 'mesas/estado?fresco=1' : 'mesas/estado');
	} catch (e) {
		if (v.senal.aborted || n < v.ultimo) { return 'ok'; }
		v.ultimo = n;
		return mostrarFalla(v, e);
	}
	if (v.senal.aborted || n < v.ultimo) { return 'ok'; }
	v.ultimo = n;
	try {
		mostrarEstado(v, d);
		return 'ok';
	} catch (e) {
		return mostrarFalla(v, e);   // un error de programa al pintar: quedan las mesas de antes
	}
}

/** Pinta el estado d. Arma todo el HTML antes de cambiar nada: si algo falla, la pantalla queda como estaba. */
function mostrarEstado(v, d) {
	const desfase = desfaseReloj(d.ahora, Date.now());
	const modo = htmlModo(d);
	const mesas = htmlMesas(d, Date.now() + desfase);
	Object.assign(v, { estado: d, desfase });
	pintar(v, '.vm-falla', '');
	pintar(v, '.vm-cabecera', modo);
	pintar(v, '.vm-mesas', mesas);
}

/**
 * Una lectura que no salió: el texto simple arriba de las mesas (que se quedan) y reintento a los 15 s; si
 * reintentar no sirve (404, 403, sesión terminada, otra sede), deja de pedir y quita las mesas, que ya no se
 * actualizarían. Un error de programa va además a la consola, una vez.
 */
function mostrarFalla(v, e) {
	if (!deApi(e)) { avisarConsola(e, v); }
	const { fin, texto } = falla(e);
	if (fin || !v.estado) {   // sin "Cargando…" si la primera no salió
		v.estado = null;
		pintar(v, '.vm-cabecera', '');
		pintar(v, '.vm-mesas', '');
	}
	pintar(v, '.vm-falla', `<p class="cm-alerta"><i class="fa fa-exclamation-triangle"></i>${esc(texto)}</p>`);
	return fin ? 'parar' : 'lento';
}

/**
 * innerHTML solo si cambió: la lista no parpadea y un botón no se reemplaza cada 5 s. Si un botón de la parte
 * tenía el foco (teclado), el mismo botón (data-acc + data-mesa) lo recupera después de repintar.
 */
function pintar(v, selector, html) {
	const el = v.cont.querySelector(selector);
	if (!el || v.pintado.get(selector) === html) { return; }
	const foco = botonConFoco(el);
	el.innerHTML = html;
	v.pintado.set(selector, html);
	if (foco) {
		const b = [...el.querySelectorAll('[data-acc]')].find(x => x.dataset.acc === foco.acc && x.dataset.mesa === foco.mesa);
		if (b) { b.focus(); }
	}
}

function botonConFoco(el) {
	const a = globalThis.document ? globalThis.document.activeElement : null;
	if (!a || a === el || typeof el.contains !== 'function' || !el.contains(a) || !a.dataset || !a.dataset.acc) { return null; }
	return { acc: a.dataset.acc, mesa: a.dataset.mesa };
}

/** Ya lo vi / Silenciar esta mesa: una acción a la vez; al terminar, aviso y el estado de nuevo. */
async function alClic(e, v, api) {
	const b = e.target.closest('[data-acc]');
	if (!b || v.ocupado || !v.estado) { return; }
	const m = (v.estado.mesas || []).find(x => x && claveMesa(x.mesa_clave || x.mesa) === b.dataset.mesa);
	const silenciar = b.dataset.acc === 'silenciar';
	if (!m || !m.alerta || (silenciar && !puedeSilenciar(m))) { return; }
	v.ocupado = true;
	b.disabled = true;
	let r = null;
	try {
		r = await (silenciar ? silenciarMesa(api, m) : resolverAlerta(api, m));
	} finally {
		v.ocupado = false;
		b.disabled = false;
	}
	if (v.senal.aborted || !r) { return; }   // salió de la pantalla mientras preguntaba o esperaba, o dijo que no
	aviso(r.texto, r.ok ? 'ok' : 'error');
	leer(v, api).catch(err => avisarConsola(err, v));   // leer no lanza; si fallara, a la consola
}
