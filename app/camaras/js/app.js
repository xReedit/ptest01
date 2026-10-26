// Punto de entrada. montar(contenedor, suelta, {sedePOS, alCambiarSede}): dentro del POS lo llama app/page/x-camaras
// (suelta=false) y desmontar() al salir de la pagina. Al importar no pasa nada: el cliente, el CSS y los eventos se
// crean en montar().
import { crearCliente } from './api.js?v=20261020i';
import { iniciar, detener, leerCodigoVincular, hayCambios, antesDeSalir } from './router.js?v=20261020i';
import { vigilarSalida } from './salida.js?v=20261020i';
import * as inicio from './vistas/inicio.js?v=20261020i';
import * as vincular from './vistas/vincular.js?v=20261020i';
import * as equipos from './vistas/equipos.js?v=20261020i';
import * as mesas from './vistas/mesas.js?v=20261020i';
import * as probar from './vistas/probar.js?v=20261020i';
import * as parametros from './vistas/parametros.js?v=20261020i';
import * as enVivo from './vistas/en-vivo.js?v=20261020i';
import * as registro from './vistas/registro.js?v=20261020i';

const VISTAS = { '': inicio, vincular, equipos, mesas, probar, parametros, 'en-vivo': enVivo, registro };

let quitarAvisoSede = null;
let quitarSalida = null;   // cambios sin guardar: menu del POS y cerrar la pestaña (salida.js)

function cargarCss() {
	if (document.getElementById('cm_css')) { return; }
	const l = document.createElement('link');
	l.id = 'cm_css';
	l.rel = 'stylesheet';
	l.href = new URL('../camaras.css?v=20261020i', import.meta.url).href;   // subir la version al cambiar el CSS (nginx no manda no-cache)
	document.head.appendChild(l);
}

/**
 * sedePOS(): {idsede, nombre} de la sede que el POS tiene puesta AHORA, o null (la da el host; para mostrar a
 * que sede se vincula la PC). Cliente NUEVO en cada montar: el POS puede cambiar de sede sin recargar (barra de
 * sedes, op=-1001) y la sesion del servidor de camaras queda atada a la sede con la que se entro.
 * alCambiarSede(fn) → quitar(): el host avisa (fn) cuando el POS ya cambio de sede; entonces se vuelve a entrar
 * con un cliente nuevo y se va al inicio (los grabadores de la otra sede ya no valen).
 */
export async function montar(cont, suelta = false, { sedePOS = () => null, alCambiarSede = null } = {}) {
	desmontar();
	cargarCss();
	cont.classList.add('cm-app');
	const arrancar = ruta => iniciar(cont, VISTAS, { api: crearCliente(), sedePOS }, suelta, ruta);
	// el programa de la PC abre "#/camaras?vincular=123456": directo a Vincular con el codigo puesto
	arrancar(leerCodigoVincular(location.hash) ? 'vincular' : '');
	if (alCambiarSede) { quitarAvisoSede = alCambiarSede(() => arrancar('')); }
	quitarSalida = vigilarSalida({ hayCambios, antesDeSalir }, { enPOS: !suelta });
}

/** El POS salio de Camaras IA: corta la pantalla (esperas, fotos), deja de escuchar el cambio de sede y la salida. */
export function desmontar() {
	if (quitarAvisoSede) { quitarAvisoSede(); quitarAvisoSede = null; }
	if (quitarSalida) { quitarSalida(); quitarSalida = null; }
	detener();
}
