// Probar detección (ruta "probar/<camaraId>", desde Grabadores y cámaras y desde Marcar mesas).
// Mientras la pantalla se ve, cada 3 s (de inicio a inicio, nunca dos a la vez): POST probar (la PC del local saca
// una foto y cuenta las personas en cada mesa), se espera ese pedido (GET comandos/{id}, espera.js) y se traen
// GET probar + la foto. Cada mesa se pinta verde ("Libre") o naranja ("Ocupada · N personas", como Control de pedidos) y cada persona con un recuadro
// amarillo. Si la PC no pudo (por ejemplo, todavía no tiene la detección instalada) se muestra su mensaje simple,
// la última foto con las mesas sin color, y se reintenta cada 15 s. Con la pestaña oculta no se pide nada.
// A los 10 minutos de probar se pausa sola (no gastar internet del local) y queda el botón Seguir probando.
// Al salir (ctx.senal) para del todo y suelta la foto (object URL), el ResizeObserver y el dibujo pendiente.
// F2-R43: con el primer resultado se pide una vez GET mesas/estado y debajo de cada mesa va su pedido del POS
// (textoCuenta, cruzando por claveMesa) según el estado de la foto, no el del servidor: así no contradice la etiqueta
// de arriba. Los minutos van con la hora del servidor (data.ahora, F2-R45). Si falla (o el servidor es de F1 y
// responde 404) se ve como antes.
import { esc, tarjeta, volver } from '../ui.js?v=20261020i';
import { vigente } from '../router.js?v=20261020i';
import { dormir, esperarComando, falloComando } from '../espera.js?v=20261020i';
import { centro } from '../geometria.js?v=20261020i';
import { nombreCamara, avisoFotoChica } from './equipos.js?v=20261020i';
import { textoCuenta, desfaseReloj } from '../estado-mesas.js?v=20261020i';
import { claveMesa } from '../mesas-sede.js?v=20261020i';

export const CADA_MS = 3000;     // de inicio a inicio de una vuelta
export const LENTO_MS = 15000;   // pausa despues de una vuelta que no salio
export const PAUSA_MS = 10 * 60e3;   // a los 10 minutos de probar se pausa sola
const ANGOSTO_PX = 480;          // foto mas angosta que esto: en la foto va solo el numero (el detalle, en la lista)

const NO_EXISTE = 'Esta cámara ya no existe. Vuelve a Grabadores y cámaras.';
const NO_INSTALADA = 'La detección todavía no está instalada en la PC del local.';
const SIN_RESULTADO = 'Todavía no hay un resultado. Espera unos segundos.';
const SIN_PC = 'Este grabador ya no tiene una PC del local vinculada. Conéctalo de nuevo en Grabadores y cámaras.';
const GENERICO = 'Algo salió mal. Vuelve a intentar.';   // pintarFalla: ahi no se reintenta solo
// En el reintento lento la linea de estado agrega "Se vuelve a intentar sola cada 15 segundos.": estas frases no
// dicen "vuelve a intentar" (la pantalla ya lo hace sola).
const SIN_FOTO_NUEVA = 'No se pudo traer la foto nueva.';
const NO_SALIO = 'No se pudo completar.';
const TARDA = 'La PC del local está tardando en responder. Revisa que esté prendida.';
const SIN_RED = 'Sin conexión con el servicio de cámaras. Revisa el internet.';
const ALGO_MAL = 'Algo salió mal.';
const TEXTO_LENTO = {
	error_interno: 'El servicio de cámaras tuvo un problema.',
	demasiados_pedidos: 'Muchos pedidos seguidos. Espera un momento.',
};
const PAUSADA = 'Se pausó para no gastar internet del local.';
const SIN_FOTO = 'Esta cámara todavía no tiene foto. Vuelve a Grabadores y cámaras y toca Actualizar foto.';
const SIN_MESAS = 'Esta cámara todavía no tiene mesas marcadas. Toca Marcar mesas para señalarlas en la foto.';
const AYUDA = 'La PC del local saca una foto cada pocos segundos y cuenta las personas en cada mesa. Verde: libre. Naranja: ocupada.';
const dos = n => String(n).padStart(2, '0');
const propio = (mapa, k) => (Object.prototype.hasOwnProperty.call(mapa, k) ? mapa[k] : '');

/* ---------- lo que no es DOM (se prueba en Node) ---------- */

/**
 * Cada zona de la cámara con su conteo del resultado: estado 'libre' (0 personas), 'ocupada' (1 o más) o
 * 'sin_contar' (sin resultado, o la PC todavía no cuenta esa mesa); texto para mostrar.
 */
export function estadoMesas(zonas, resultado) {
	const conteos = new Map();
	for (const z of (resultado && Array.isArray(resultado.zonas) ? resultado.zonas : [])) {
		if (z && Number.isInteger(z.personas) && z.personas >= 0) { conteos.set(z.zona_id, z.personas); }
	}
	return (Array.isArray(zonas) ? zonas : []).map(z => {
		const personas = conteos.has(z.id) ? conteos.get(z.id) : null;
		const estado = personas === null ? 'sin_contar' : (personas > 0 ? 'ocupada' : 'libre');
		const texto = estado === 'ocupada' ? `Ocupada · ${personas} ${personas === 1 ? 'persona' : 'personas'}` : (estado === 'libre' ? 'Libre' : 'Aún sin contar');
		return { id: z.id, mesa: String(z.mesa ?? ''), area: z.area || '', poligono: z.poligono, estado, personas, texto };
	});
}

/** "Mesas ocupadas: 2 de 5" ('' sin mesas). */
export function resumenMesas(estados) {
	if (!estados.length) { return ''; }
	return `Mesas ocupadas: ${estados.filter(e => e.estado === 'ocupada').length} de ${estados.length}`;
}

/** Lo que va escrito sobre la mesa en la foto; angosto (celular): solo el número y las personas. */
export function etiquetaLienzo(e, angosto) {
	if (e.estado === 'sin_contar') { return e.mesa; }
	if (angosto) { return e.estado === 'ocupada' ? `${e.mesa} · ${e.personas}` : e.mesa; }
	return `${e.mesa} · ${e.texto}`;
}

const enRango = v => Math.min(1, Math.max(0, v));

/** Cajas de personas [x1, y1, x2, y2] en 0..1 (recortadas y con las esquinas en orden); lo que no sirve se descarta. */
export function cajasValidas(cajas) {
	if (!Array.isArray(cajas)) { return []; }
	return cajas
		.filter(c => Array.isArray(c) && c.length === 4 && c.every(n => typeof n === 'number' && Number.isFinite(n)))
		.map(([x1, y1, x2, y2]) => [enRango(Math.min(x1, x2)), enRango(Math.min(y1, y2)), enRango(Math.max(x1, x2)), enRango(Math.max(y1, y2))]);
}

/** "Foto de las 15:04:05" u otro día "Foto del 17/10 a las 22:40:00" (la hora viene del servidor, X-Tomada). */
export function textoFoto(iso, ahora = Date.now()) {
	const t = iso ? Date.parse(iso) : NaN;
	if (!Number.isFinite(t)) { return ''; }
	const d = new Date(t);
	const hora = `${dos(d.getHours())}:${dos(d.getMinutes())}:${dos(d.getSeconds())}`;
	return d.toDateString() === new Date(ahora).toDateString()
		? `Foto de las ${hora}` : `Foto del ${dos(d.getDate())}/${dos(d.getMonth() + 1)} a las ${hora}`;
}

/**
 * Texto si el probar no salió, '' si salió (siempre en el reintento lento: sin "vuelve a intentar"). El servidor
 * manda frases simples, salvo los códigos del motor: el motor sin detector responde "no_soportado"; otro código
 * crudo ("interno"), nada, o el "No se pudo completar, vuelve a intentar" del servidor salen como NO_SALIO.
 */
export function falloProbar(r) {
	const texto = falloComando(r);
	if (!texto) { return ''; }
	if (r.estado === 'vencido') { return TARDA; }
	const error = String(r.valor.error || '');
	if (error === 'no_soportado') { return NO_INSTALADA; }
	return !error || /^[a-z0-9_]+$/.test(error) || /vuelve a intentar/i.test(error) ? NO_SALIO : texto;
}

const TEXTO_ERROR = { motor_no_activo: SIN_PC, no_encontrado: NO_EXISTE };

/** Mensaje de un error del cliente (ApiError: codigo y status). Un error de programa no se muestra tal cual. */
export function errorProbar(e) {
	if (!e || typeof e.codigo !== 'string') { return GENERICO; }
	return propio(TEXTO_ERROR, e.codigo) || e.message || GENERICO;
}

/**
 * Igual que errorProbar, para el reintento lento: ninguna frase dice "vuelve a intentar" (la línea de estado ya dice
 * que se vuelve a intentar sola). status 0: sin red o el servidor no respondió a tiempo (tiempo_agotado).
 */
export function errorLento(e) {
	if (!e || typeof e.codigo !== 'string') { return ALGO_MAL; }
	const texto = propio(TEXTO_ERROR, e.codigo) || propio(TEXTO_LENTO, e.codigo);
	if (texto) { return texto; }
	if (e.status === 0) { return SIN_RED; }
	return e.message && !/intentar/i.test(e.message) ? e.message : ALGO_MAL;
}

/** Vuelta que no salio: sin colores, reintento lento. */
const vueltaFallida = falla => ({ siguiente: 'lento', resultado: null, falla, foto: null });
const generico = status => Object.assign(new Error(GENERICO), { codigo: '', status });

/**
 * esperarComando, pero un 404 del comando (vencido o de otro motor) no es "la cámara ya no existe": es una vuelta
 * que no salió. Solo el POST probar, GET zonas y GET probar dicen que la cámara se borró.
 */
async function esperarPedido(api, id, senal) {
	try {
		return await esperarComando(api, id, senal);
	} catch (e) {
		throw e && e.codigo === 'no_encontrado' ? generico(404) : e;
	}
}

/**
 * El pedido del POS de cada mesa (F2-R43): GET mesas/estado → {conPedidos, mesas: Map(claveMesa → mesa), desfase}
 * (desfase: reloj del servidor − reloj de esta PC al recibir, F2-R45), o null si no se pudo por cualquier motivo
 * (servidor de F1 sin la ruta: 404; sin red; salió de la pantalla). Nunca lanza: Probar no muestra un error por
 * esto. Un error de programa (no de la API) va además a la consola.
 */
export async function leerCuentas(api) {
	try {
		const d = await api.get('mesas/estado');
		if (!d || !Array.isArray(d.mesas)) { return null; }
		const mesas = new Map(d.mesas.filter(m => m && typeof m === 'object').map(m => [claveMesa(m.mesa_clave || m.mesa), m]));
		return { conPedidos: d.con_pedidos === true, mesas, desfase: desfaseReloj(d.ahora, Date.now()) };
	} catch (e) {
		if (!e || typeof e.codigo !== 'string') { console.warn('Cámaras IA, Probar (pedido de las mesas):', e); }
		return null;
	}
}

async function leerResultado(api, ruta) {
	try {
		return await api.get(ruta + '/probar');
	} catch (e) {
		if (e && e.codigo === 'sin_resultado') { return null; }   // todavia ningun probar salio bien
		throw e;
	}
}

/**
 * Una vuelta: pide probar, espera a la PC y, si salió, trae el último resultado y la foto ({blob, tomada} o null).
 * Devuelve {siguiente: 'ok' | 'lento' | 'parar', resultado (o null), falla (texto o ''), foto}, o null si la señal
 * se cortó (salió de la pantalla u ocultó la pestaña): entonces no se pide nada más.
 */
export async function contarUnaVez(api, ruta, senal) {
	try {
		const d = await api.post(ruta + '/probar');
		if (senal.aborted) { return null; }
		if (!d || !d.comando_id) { throw generico(200); }   // respondio, pero sin el pedido
		const r = await esperarPedido(api, d.comando_id, senal);
		if (r.estado === 'cancelado' || senal.aborted) { return null; }
		const falla = falloProbar(r);
		if (falla) { return vueltaFallida(falla); }
		const [resultado, foto] = await Promise.all([leerResultado(api, ruta), api.blob(ruta + '/foto').catch(() => null)]);
		if (senal.aborted) { return null; }
		// el resultado es de la foto nueva: sobre la anterior las mesas y las personas no coincidirian
		if (resultado && !foto) { return vueltaFallida(SIN_FOTO_NUEVA); }
		return { siguiente: 'ok', resultado, falla: resultado ? '' : SIN_RESULTADO, foto };
	} catch (e) {
		if (senal.aborted) { return null; }
		// camara borrada, sesion terminada o el POS cambio de sede (otra pestaña): reintentar no sirve
		const fin = !!e && (e.codigo === 'no_encontrado' || e.status === 401 || e.codigo === 'sede_cambiada');
		return { siguiente: fin ? 'parar' : 'lento', resultado: null, falla: fin ? errorProbar(e) : errorLento(e), foto: null };
	}
}

/**
 * Llama paso(senalVuelta) en bucle mientras la pestaña se ve (doc.visibilityState) y senal no se aborta.
 * paso devuelve 'ok' (la siguiente sale `cada` ms después de que empezó esta, o enseguida si tardó más), 'lento'
 * (la siguiente, `lento` ms después de terminar) o 'parar'; si lanza (un error de programa), se anota en la consola,
 * se avisa con alFallar(e) y cuenta como 'lento'. Nunca dos a la vez.
 * Al ocultarse la pestaña se aborta senalVuelta (la vuelta deja de pedir) y no empieza otra hasta que se vea.
 * Termina (y deja de escuchar la pestaña) al abortarse senal, con 'parar' o, pasados `hasta` ms desde que empezó,
 * antes de la vuelta siguiente: entonces resuelve 'pausa' (la pantalla ofrece Seguir probando).
 */
export async function repetir(paso, { senal, doc = globalThis.document, cada = CADA_MS, lento = LENTO_MS, hasta = PAUSA_MS, ahora = () => Date.now(), alFallar = () => {} } = {}) {
	const visible = () => doc.visibilityState === 'visible';
	let vuelta = null;      // AbortController de la vuelta en curso
	let despertar = null;   // resuelve la espera de "la pestaña se ve"
	const alCambiar = () => {
		if (!visible()) { if (vuelta) { vuelta.abort(); } return; }
		if (despertar) { despertar(); }
	};
	const alSalir = () => {
		if (vuelta) { vuelta.abort(); }
		if (despertar) { despertar(); }
	};
	doc.addEventListener('visibilitychange', alCambiar);
	senal.addEventListener('abort', alSalir, { once: true });
	const comienzo = ahora();
	try {
		while (!senal.aborted) {
			if (!visible()) {
				await new Promise(r => { despertar = r; });
				despertar = null;
				continue;
			}
			if (ahora() - comienzo >= hasta) { return 'pausa'; }
			vuelta = new AbortController();
			const inicio = ahora();
			let r;
			try {
				r = await paso(vuelta.signal);
			} catch (e) {
				console.error(e);
				r = 'lento';
				if (!senal.aborted) { try { alFallar(e); } catch (e2) { console.error(e2); } }
			}
			const cortada = vuelta.signal.aborted;
			vuelta = null;
			if (senal.aborted || r === 'parar') { return; }
			if (cortada) { continue; }   // se oculto a mitad: al volver a verse, otra enseguida
			const pausa = r === 'lento' ? lento : cada - (ahora() - inicio);
			if (pausa > 0 && !(await dormir(pausa, senal))) { return; }
		}
	} finally {
		doc.removeEventListener('visibilitychange', alCambiar);
		senal.removeEventListener('abort', alSalir);
	}
}

/* ---------- pantalla ---------- */

export async function render(cont, { api, senal }, t, foco) {
	cont.innerHTML = '<p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p>';
	const id = Number(foco);
	if (!Number.isInteger(id) || id <= 0) { pintarFalla(cont, NO_EXISTE); return; }
	const ruta = `camaras/${encodeURIComponent(id)}`;
	let zonas, equipos;
	try {
		[zonas, equipos] = await Promise.all([api.get(ruta + '/zonas'), api.get('equipos')]);
	} catch (e) {
		if (vigente(t) && !senal.aborted) { pintarFalla(cont, errorProbar(e)); }
		return;
	}
	if (!vigente(t) || senal.aborted) { return; }
	const camara = ((equipos && equipos.equipos) || []).flatMap(e => e.camaras || []).find(c => c.id === id);
	if (!camara) { pintarFalla(cont, NO_EXISTE); return; }

	// estado de esta pantalla (se descarta entero al salir)
	const v = {
		api, senal, cont, ruta, zonas: Array.isArray(zonas) ? zonas : [],
		resultado: null, falla: '', siguiente: 'ok', foto: null, vueltas: 0, cuadro: 0, obs: null, pintado: new Map(), pausada: false,
		cuentas: null, cuentasPedidas: false,   // el pedido de cada mesa (leerCuentas, una vez)
	};
	const sinMesas = !v.zonas.length;
	cont.innerHTML = tarjeta({
		titulo: 'Probar detección · ' + nombreCamara(camara),
		ayuda: esc(AYUDA),
		acciones: `${volver('equipos')}<a class="btn btn-sm btn-light" href="#" data-ir="mesas/${id}"><i class="fa fa-th-large"></i>Marcar mesas</a>`,
		cuerpo: `<div class="cm-probar">
			${sinMesas ? `<p class="cm-alerta"><i class="fa fa-exclamation-triangle"></i>${esc(SIN_MESAS)}</p>` : ''}
			<div class="cm-probar-estado" aria-live="polite"></div>
			<div class="cm-foto-chica"></div>
			<div class="cm-lienzo"><canvas aria-label="Foto de la cámara con las mesas libres y ocupadas" hidden></canvas>
				<span class="cm-sin-foto"><i class="fa fa-video-camera"></i><span class="cm-sin-foto-txt"></span></span></div>
			<p class="cm-foto-txt"></p>
			<div class="cm-leyenda" aria-hidden="true"><span class="libre">Libre</span><span class="ocupada">Ocupada</span><span class="persona">Persona</span></div>
			${sinMesas ? '' : '<p class="cm-sub">Mesas de esta cámara</p><div class="cm-zonas"></div>'}
		</div>`,
	});
	v.lienzo = cont.querySelector('.cm-lienzo');
	v.canvas = cont.querySelector('.cm-lienzo canvas');
	senal.addEventListener('abort', () => soltar(v), { once: true });
	vigilarAncho(v);
	actualizar(v);
	// la ultima foto, con las mesas sin color, mientras la PC cuenta la primera vez (antes del ciclo: asi una foto
	// vieja nunca pisa a una nueva)
	const inicial = await api.blob(ruta + '/foto').catch(() => null);
	if (inicial && !senal.aborted) { await ponerFoto(v, inicial); }
	if (senal.aborted) { return; }
	actualizar(v);
	// un error de programa en una vuelta: queda en la consola y la pantalla dice "Algo salió mal", sin colores
	const alFallar = () => mostrarVuelta(v, { siguiente: 'lento', resultado: null, falla: ALGO_MAL });
	const probar = () => {
		repetir(s => paso(v, s), { senal, doc: document, alFallar }).then(fin => {
			if (fin === 'pausa' && !senal.aborted) { v.pausada = true; actualizar(v); }
		});
	};
	// pausada a los 10 minutos: Seguir probando arranca otros 10, como al entrar (sin los colores viejos)
	cont.querySelector('.inv-card').addEventListener('click', e => {
		if (!v.pausada || !e.target.closest('[data-acc="seguir"]')) { return; }
		Object.assign(v, { pausada: false, resultado: null, falla: '', siguiente: 'ok' });
		actualizar(v);
		probar();
	});
	probar();
}

function pintarFalla(cont, texto) {
	cont.innerHTML = tarjeta({
		titulo: 'Probar detección',
		acciones: volver('equipos'),
		cuerpo: `<p class="cm-falla"><i class="fa fa-exclamation-circle"></i>${esc(texto)}</p>`,
	});
}

/** Una vuelta del ciclo con su dibujo. Sin colores si no salió: la foto anterior queda con las mesas marcadas. */
async function paso(v, s) {
	const r = await contarUnaVez(v.api, v.ruta, s);
	if (!r || v.senal.aborted) { return 'ok'; }   // cortada: repetir sabe que hacer
	if (r.siguiente === 'parar' && r.falla === NO_EXISTE) { pintarFalla(v.cont, NO_EXISTE); return 'parar'; }
	const puesta = r.foto ? await ponerFoto(v, r.foto) : false;
	if (v.senal.aborted) { return 'ok'; }
	// un resultado sin su foto nueva (no se pudo leer el JPEG) no se pinta sobre la anterior
	const cuenta = r.resultado && !puesta ? { siguiente: 'lento', resultado: null, falla: SIN_FOTO_NUEVA } : r;
	mostrarVuelta(v, cuenta);
	if (cuenta.resultado && !v.cuentasPedidas) { pedirCuentas(v); }
	return cuenta.siguiente;
}

/** Una vez por pantalla, sin frenar la vuelta: el pedido de cada mesa; si no llega, nada cambia. */
function pedirCuentas(v) {
	v.cuentasPedidas = true;
	leerCuentas(v.api).then(c => {
		if (c && !v.senal.aborted) { v.cuentas = c; actualizar(v); }
	}).catch(e => console.warn('Cámaras IA, Probar (pedido de las mesas):', e));   // un error de programa al pintar
}

function mostrarVuelta(v, { siguiente, resultado, falla }) {
	v.vueltas++;
	v.resultado = resultado;
	v.falla = falla;
	v.siguiente = siguiente;
	actualizar(v);
}

/** Cambia la foto por la nueva {blob, tomada}: true si quedó puesta; si no carga, queda la anterior (false). */
async function ponerFoto(v, { blob, tomada }) {
	let url = '';
	try {
		url = URL.createObjectURL(blob);
		const img = new Image();
		await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url; });
		if (img.naturalWidth && img.naturalHeight && !v.senal.aborted) {
			if (v.foto) { URL.revokeObjectURL(v.foto.url); }
			v.foto = { img, url, tomada };
			return true;
		}
	} catch (e) {
		// no es una imagen: queda la anterior
	}
	if (url) { URL.revokeObjectURL(url); }
	return false;
}

function vigilarAncho(v) {
	// redibujar al cambiar el ancho (girar la tablet, abrir el menu del POS)
	if (typeof ResizeObserver === 'function') {
		v.obs = new ResizeObserver(() => pedirDibujo(v));
		v.obs.observe(v.lienzo);
	} else {
		v.alRedimensionar = () => pedirDibujo(v);
		window.addEventListener('resize', v.alRedimensionar);
	}
}

function soltar(v) {
	if (v.obs) { v.obs.disconnect(); v.obs = null; }
	if (v.alRedimensionar) { window.removeEventListener('resize', v.alRedimensionar); v.alRedimensionar = null; }
	if (v.cuadro) { cancelAnimationFrame(v.cuadro); v.cuadro = 0; }
	if (v.foto) { URL.revokeObjectURL(v.foto.url); v.foto = null; }
}

/* ---------- pintar ---------- */

/** innerHTML solo si cambio: el aviso (aria-live) no se repite cada 3 s y la lista no parpadea. */
function pintar(v, selector, html) {
	const el = v.cont.querySelector(selector);
	if (!el || v.pintado.get(selector) === html) { return; }
	el.innerHTML = html;
	v.pintado.set(selector, html);
}

/** La línea de estado (encima de la foto). v: {pausada, falla, siguiente, resultado, zonas}. */
export function htmlEstado(v) {
	if (v.pausada) {
		return `<div class="cm-pausa"><p><i class="fa fa-pause-circle"></i>${esc(PAUSADA)}</p>
			<button class="btn btn-sm btn-success" type="button" data-acc="seguir"><i class="fa fa-play"></i>Seguir probando</button></div>`;
	}
	if (v.falla && v.siguiente === 'ok') {   // todavia sin resultado: no es una falla
		return `<p class="cm-buscando"><i class="fa fa-spinner fa-spin"></i>${esc(v.falla)}</p>`;
	}
	if (v.falla) {
		const frase = /[.!?]$/.test(v.falla) ? v.falla : v.falla + '.';   // las del servidor vienen sin punto
		const nota = v.siguiente === 'lento' ? ` Se vuelve a intentar sola cada ${LENTO_MS / 1000} segundos.` : '';
		return `<p class="cm-alerta"><i class="fa fa-exclamation-triangle"></i>${esc(frase + nota)}</p>`;
	}
	if (v.resultado) {
		const resumen = resumenMesas(estadoMesas(v.zonas, v.resultado));
		return `<p class="cm-vivo"><i class="fa fa-circle"></i>${esc(resumen ? `En vivo · ${resumen}` : 'En vivo')}</p>`;
	}
	return '<p class="cm-buscando"><i class="fa fa-spinner fa-spin"></i>Contando las personas en la foto…</p>';
}

// foto muy chica (ej. 352×240): solo avisa, se sigue probando
function htmlFotoChica(img) {
	const texto = img ? avisoFotoChica(img.naturalWidth, img.naturalHeight) : '';
	return texto ? `<p class="cm-alerta"><i class="fa fa-exclamation-triangle"></i>${esc(texto)}</p>` : '';
}

/**
 * La segunda línea de la zona e (de estadoMesas): su pedido del POS (cuentas de leerCuentas), o '' si no hay nada
 * que decir. Con el estado de la foto (ocupada si contó a alguien, libre si no), no el del servidor, así no
 * contradice la etiqueta de arriba; sin contar todavía, nada. ahora: el reloj de esta PC (se le suma el desfase).
 */
function htmlCuenta(cuentas, e, ahora) {
	const m = cuentas && e.estado !== 'sin_contar' ? cuentas.mesas.get(claveMesa(e.mesa)) : null;
	const c = m ? textoCuenta({ ...m, estado: e.estado }, cuentas.conPedidos, ahora + (cuentas.desfase || 0)) : null;
	return c ? `<span class="vm-pedido ${c.clase}">${esc(c.texto)}</span>` : '';
}

/** La lista de mesas bajo la foto. v: {zonas, resultado, cuentas}; sin cuentas, igual que en F1. */
export const htmlMesas = (v, ahora = Date.now()) => estadoMesas(v.zonas, v.resultado).map(e => `<div class="cm-zona ${e.estado}">
	<b>Mesa ${esc(e.mesa)}</b><span>${e.area ? `${esc(e.area)} · ` : ''}${esc(e.texto)}</span>${htmlCuenta(v.cuentas, e, ahora)}</div>`).join('');

function actualizar(v) {
	if (v.senal.aborted || !v.canvas) { return; }
	pintar(v, '.cm-probar-estado', htmlEstado(v));
	pintar(v, '.cm-foto-chica', htmlFotoChica(v.foto && v.foto.img));
	pintar(v, '.cm-foto-txt', esc(textoFoto(v.foto && v.foto.tomada)));
	pintar(v, '.cm-zonas', htmlMesas(v));
	pintar(v, '.cm-sin-foto-txt', esc(v.vueltas ? SIN_FOTO : 'Cargando la foto…'));
	v.canvas.hidden = !v.foto;
	v.cont.querySelector('.cm-lienzo > .cm-sin-foto').hidden = !!v.foto;
	dibujar(v);
}

function pedirDibujo(v) {
	if (v.cuadro || v.senal.aborted) { return; }
	v.cuadro = requestAnimationFrame(() => { v.cuadro = 0; dibujar(v); });
}

const COLOR = {
	libre: { relleno: 'rgba(40, 167, 69, .30)', borde: '#28a745', fondo: '#28a745', letra: '#fff' },
	ocupada: { relleno: 'rgba(230, 81, 0, .35)', borde: '#e65100', fondo: '#e65100', letra: '#fff' },   // naranja, como Control
	sin_contar: { relleno: 'rgba(255, 255, 255, .10)', borde: '#fff', fondo: '#fff', letra: '#212529' },
};

/** Foto a lo ancho (sin deformar), las mesas con su color, las personas en amarillo y encima los números. */
function dibujar(v) {
	const cv = v.canvas;
	const f = v.foto;
	if (!cv || !f || v.senal.aborted) { return; }
	const ancho = v.lienzo.clientWidth;
	if (!ancho) { return; }
	const alto = Math.round((ancho * f.img.naturalHeight) / f.img.naturalWidth);
	const dpr = window.devicePixelRatio || 1;
	const w = Math.round(ancho * dpr);
	const h = Math.round(alto * dpr);
	if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
	cv.style.height = alto + 'px';
	const g = cv.getContext('2d');
	g.setTransform(dpr, 0, 0, dpr, 0, 0);
	g.clearRect(0, 0, ancho, alto);
	g.drawImage(f.img, 0, 0, ancho, alto);
	const estados = estadoMesas(v.zonas, v.resultado).filter(e => Array.isArray(e.poligono) && e.poligono.length >= 3);
	estados.forEach(e => dibujarMesa(g, e, ancho, alto));
	cajasValidas(v.resultado && v.resultado.cajas).forEach(c => dibujarCaja(g, c, ancho, alto));
	estados.forEach(e => dibujarEtiqueta(g, e, ancho < ANGOSTO_PX, ancho, alto));
}

function dibujarMesa(g, e, ancho, alto) {
	const c = COLOR[e.estado];
	g.beginPath();
	e.poligono.forEach(([x, y], i) => { if (i) { g.lineTo(x * ancho, y * alto); } else { g.moveTo(x * ancho, y * alto); } });
	g.closePath();
	g.fillStyle = c.relleno;
	g.fill();
	g.lineWidth = 2;
	g.strokeStyle = c.borde;
	g.setLineDash(e.estado === 'sin_contar' ? [6, 4] : []);   // sin contar: solo el contorno, punteado
	g.stroke();
	g.setLineDash([]);
}

function dibujarCaja(g, [x1, y1, x2, y2], ancho, alto) {
	const [x, y, w, h] = [x1 * ancho, y1 * alto, (x2 - x1) * ancho, (y2 - y1) * alto];
	g.lineWidth = 4;
	g.strokeStyle = 'rgba(0, 0, 0, .45)';   // borde oscuro debajo: el amarillo se ve tambien sobre paredes claras
	g.strokeRect(x, y, w, h);
	g.lineWidth = 2;
	g.strokeStyle = '#facc15';
	g.strokeRect(x, y, w, h);
}

function dibujarEtiqueta(g, e, angosto, ancho, alto) {
	const c = COLOR[e.estado];
	const [nx, ny] = centro(e.poligono);
	const [cx, cy] = [nx * ancho, ny * alto];
	const texto = etiquetaLienzo(e, angosto);
	g.font = '600 12px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
	const w = g.measureText(texto).width + 14;
	g.fillStyle = c.fondo;
	g.beginPath();
	if (g.roundRect) { g.roundRect(cx - w / 2, cy - 11, w, 22, 11); } else { g.rect(cx - w / 2, cy - 11, w, 22); }
	g.fill();
	g.fillStyle = c.letra;
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillText(texto, cx, cy + 1);
}
