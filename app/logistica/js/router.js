// Navegacion interna. Dentro del POS no se toca location.hash (es del router de Polymer); solo la pagina
// suelta (index.html) sincroniza el hash para poder recargar. Enlaces: <a data-ir="catalogo">.
import { esc } from './ui.js?v=20261015i';

let vistas = {};
let cont = null;
let sesion = null;
let suelta = false;
let turno = 0;   // descarta renders viejos si el usuario cambia de pantalla antes de que respondan
let actual = '';

export function iniciar(contenedor, mapaVistas, datosSesion, esSuelta) {
	cont = contenedor;
	vistas = mapaVistas;
	sesion = datosSesion;
	suelta = esSuelta;
	cont.addEventListener('click', e => {
		const a = e.target.closest('[data-ir]');
		if (a && cont.contains(a)) { e.preventDefault(); ir(a.dataset.ir); }
	});
	if (suelta) { window.addEventListener('hashchange', () => mostrar(rutaDelHash())); }
	mostrar(suelta ? rutaDelHash() : '');
}

const rutaDelHash = () => location.hash.replace(/^#\/?/, '').split('?')[0];

export function ir(ruta) {
	if (suelta) { location.hash = '#/' + ruta; return; }   // hashchange llama a mostrar
	mostrar(ruta);
}

/** Vuelve a dibujar la pantalla actual (ej. despues de cancelar algo). */
export const recargar = () => mostrar(actual);

/** true si la pantalla que pidio el render sigue siendo la actual. */
export const vigente = t => t === turno;

/** Pantalla actual sin el foco ("ordenes/enviar" -> "ordenes"): el boton Ayuda abre su tema. */
export const rutaActual = () => actual.split('/')[0];

/** Turno de la pantalla actual: lo guardan los detalles que se abren sin pasar por el router (ej. abrir una orden). */
export const turnoActual = () => turno;

async function mostrar(ruta) {
	const t = ++turno;
	actual = ruta;
	// "ordenes/enviar": pantalla + foco (solo esa tarea); recargar conserva el foco
	const [base, foco = ''] = ruta.split('/');
	const vista = vistas[base] || vistas[''];
	window.scrollTo(0, 0);
	try {
		await vista.render(cont, sesion, t, foco);
	} catch (e) {
		if (vigente(t)) { cont.innerHTML = `<div class="lg-error">${esc(e.message)}</div>`; }
	}
}
