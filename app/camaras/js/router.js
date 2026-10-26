// Navegacion interna (copia de app/logistica/js/router.js con prefijo cm-). Dentro del POS no se toca location.hash
// (es del router de Polymer); solo una pagina suelta lo sincronizaria. Enlaces: <a data-ir="vincular">.
// Las vistas reciben render(cont, ctx, turno, foco); ctx = { api, sedePOS, senal } (ver app.js).
// ctx.senal (AbortSignal) se aborta al cambiar de pantalla, al redibujarla o al desmontar: ahi cada vista corta
// sus esperas (timers) y suelta lo que tenga (fotos en memoria). Asi no quedan pedidos corriendo al salir.
// ctx.api de cada pantalla es api.conSenal(ctx.senal): sus lecturas en curso tambien se cortan (error 'cancelado',
// que las vistas no muestran porque miran ctx.senal o vigente(t)); los cambios ya pedidos terminan (api.js).
// Cambios sin guardar: la vista llama ctx.alSalir(cambios, preguntar) (cambios() → boolean; preguntar() →
// Promise<boolean>, su confirmar "¿Salir sin guardar?"). ir() y el hash de la pagina suelta preguntan antes de
// salir; dentro del POS el cambio de pagina del menu lo frena salida.js con hayCambios/antesDeSalir.
import { esc } from './ui.js?v=20261020i';

let vistas = {};
let cont = null;
let ctx = null;
let suelta = false;
let turno = 0;   // descarta renders viejos si el usuario cambia de pantalla antes de que respondan
let actual = '';
let pantalla = null;          // AbortController de la pantalla que se ve
let quitarEventos = () => {};
let salida = null;            // {cambios, preguntar} de la pantalla que se ve (ctx.alSalir)
let preguntando = null;       // la pregunta abierta: dos intentos de salir no abren dos dialogos

/** El motor abre el POS en "#/camaras?vincular=123456": el codigo de 6 digitos, o null. */
export function leerCodigoVincular(hash) {
	const m = /vincular=(\d{6})/.exec(String(hash || ''));
	return m ? m[1] : null;
}

/** El hash sin el parametro vincular (ya usado: recargar o volver a esta URL no debe traerlo). */
export function sinCodigoVincular(hash) {
	const [ruta, q = ''] = String(hash || '').split('?');
	if (!q) { return ruta; }
	const p = new URLSearchParams(q);
	p.delete('vincular');
	const resto = p.toString();
	return ruta + (resto ? '?' + resto : '');
}

/** rutaInicial: pantalla con la que arranca dentro del POS ('' = inicio). Si ya habia un montaje, lo corta. */
export function iniciar(contenedor, mapaVistas, contexto, esSuelta, rutaInicial = '') {
	detener();
	cont = contenedor;
	vistas = mapaVistas;
	ctx = contexto;
	suelta = esSuelta;
	const alClic = e => {
		const a = e.target.closest('[data-ir]');
		if (a && contenedor.contains(a)) { e.preventDefault(); ir(a.dataset.ir); }
	};
	// el hash ya cambio (atras del navegador, un enlace): con cambios, la barra vuelve aqui mientras pregunta
	const alHash = () => {
		const r = antesDeSalir();
		if (r === true) { mostrar(rutaDelHash()); return; }
		const destino = location.hash;
		const t = turno;
		history.replaceState(null, '', '#/' + actual);
		r.then(ok => { if (ok && vigente(t)) { salida = null; location.hash = destino; } });
	};
	contenedor.addEventListener('click', alClic);
	if (esSuelta) { window.addEventListener('hashchange', alHash); }
	quitarEventos = () => {
		contenedor.removeEventListener('click', alClic);
		if (esSuelta) { window.removeEventListener('hashchange', alHash); }
	};
	mostrar(suelta ? rutaDelHash() : rutaInicial);
}

/** Deja de mostrar: corta la pantalla actual (sus esperas), descarta los renders en curso y quita los eventos. */
export function detener() {
	turno++;
	salida = null;
	if (pantalla) { pantalla.abort(); pantalla = null; }
	quitarEventos();
	quitarEventos = () => {};
}

const rutaDelHash = () => location.hash.replace(/^#\/?/, '').split('?')[0];

/** true si la pantalla que se ve tiene cambios sin guardar. */
export const hayCambios = () => !!(salida && salida.cambios());

/**
 * Antes de dejar la pantalla: true si no hay nada que perder; si no, Promise<boolean> con la respuesta del
 * usuario a la pregunta de la pantalla (true = sale y pierde los cambios).
 */
export function antesDeSalir() {
	if (!hayCambios()) { return true; }
	if (!preguntando) {
		const { preguntar } = salida;
		preguntando = Promise.resolve().then(preguntar).then(Boolean, () => false).finally(() => { preguntando = null; });
	}
	return preguntando;
}

export function ir(ruta) {
	const r = antesDeSalir();
	if (r === true) { cambiar(ruta); return; }
	const t = turno;
	r.then(ok => { if (ok && vigente(t)) { salida = null; cambiar(ruta); } });
}

function cambiar(ruta) {
	if (suelta) { location.hash = '#/' + ruta; return; }   // hashchange llama a mostrar
	mostrar(ruta);
}

/** Vuelve a dibujar la pantalla actual. */
export const recargar = () => mostrar(actual);

/** true si la pantalla que pidio el render sigue siendo la actual. */
export const vigente = t => t === turno;

async function mostrar(ruta) {
	const t = ++turno;
	actual = ruta;
	salida = null;
	if (pantalla) { pantalla.abort(); }   // la pantalla anterior corta sus esperas
	pantalla = new AbortController();
	const alSalir = (cambios, preguntar) => { if (vigente(t)) { salida = { cambios, preguntar }; } };
	// "equipos/5": pantalla + foco (ej. el motor 5); recargar conserva el foco
	const [base, foco = ''] = ruta.split('/');
	const vista = vistas[base] || vistas[''];
	window.scrollTo(0, 0);
	const senal = pantalla.signal;
	const api = ctx.api && typeof ctx.api.conSenal === 'function' ? ctx.api.conSenal(senal) : ctx.api;
	try {
		await vista.render(cont, { ...ctx, api, senal, alSalir }, t, foco);
	} catch (e) {
		if (vigente(t)) { cont.innerHTML = `<div class="cm-error">${esc(e.message)}</div>`; }
	}
}
