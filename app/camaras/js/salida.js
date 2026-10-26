// Cambios sin guardar (ej. mesas marcadas en la foto) al salir de Cámaras IA por FUERA del modulo:
// - Dentro del POS el hash es del app-router de Polymer (app/web_components/app-router): el menu llama router.go(),
//   que dispara 'state-change' (cancelable, sin burbuja) en <app-router> ANTES de cambiar de pagina. Se escucha en
//   captura en document (corre antes que el de x-router y su consulta de permisos): con cambios se frena, la barra
//   vuelve a Cámaras IA y se pregunta con el dialogo de la pantalla; si el usuario sale, se repite el router.go.
// - Cerrar o recargar la pestaña: beforeunload (ese aviso lo pone el navegador; es la unica forma).
// Las pantallas del modulo (ir(), el hash de la pagina suelta) las vigila router.js.
import { sinCodigoVincular } from './router.js?v=20261020i';

/**
 * hayCambios(): boolean y antesDeSalir(): true | Promise<boolean> (los de router.js).
 * enPOS: escuchar el app-router (dentro del POS). Devuelve quitar(): deja de escuchar todo.
 */
export function vigilarSalida({ hayCambios, antesDeSalir }, { enPOS = true, doc = document, win = window } = {}) {
	// la de Cámaras IA, al montar, sin el ?vincular= (ya usado: volver a esta URL no debe traer el codigo de nuevo)
	const aqui = sinCodigoVincular(win.location.hash);
	let esperando = false;            // la pregunta esta abierta
	let dejar = false;                // el router.go que repite el cambio despues del "Sí"
	let quitado = false;

	const alCambiarPagina = e => {
		const router = e.target;
		if (dejar || !router || typeof router.go !== 'function') { return; }
		const r = esperando ? null : antesDeSalir();   // mientras pregunta, otro intento tambien se frena
		if (r === true) { return; }
		e.preventDefault();
		e.stopImmediatePropagation();
		const destino = win.location.hash.replace(/^#/, '');   // con su ?parametro, si tiene
		win.history.replaceState(null, '', aqui);
		if (esperando) { return; }
		esperando = true;
		r.then(ok => {
			esperando = false;
			if (!ok || quitado) { return; }
			dejar = true;
			try { router.go(destino); } finally { dejar = false; }
		});
	};
	const alCerrar = e => {
		if (!hayCambios()) { return; }
		e.preventDefault();
		e.returnValue = '';   // Chrome viejo pide returnValue para mostrar el aviso
	};

	if (enPOS) { doc.addEventListener('state-change', alCambiarPagina, true); }
	win.addEventListener('beforeunload', alCerrar);
	return () => {
		quitado = true;
		if (enPOS) { doc.removeEventListener('state-change', alCambiarPagina, true); }
		win.removeEventListener('beforeunload', alCerrar);
	};
}
