// Punto de entrada. montar(contenedor, suelta): dentro del POS lo llama app/page/x-logistica (suelta=false);
// la pagina suelta app/logistica/index.html lo llama con suelta=true.
import { api } from './api.js?v=20261015i';
import { esc } from './ui.js?v=20261015i';
import { iniciar } from './router.js?v=20261015i';
import * as inicio from './vistas/inicio.js?v=20261015i';
import * as catalogo from './vistas/catalogo.js?v=20261015i';
import * as config from './vistas/config.js?v=20261015i';
import * as importar from './vistas/importar.js?v=20261015i';
import * as productos_sedes from './vistas/productos_sedes.js?v=20261015i';
import * as porciones from './vistas/porciones.js?v=20261015i';
import * as pedir from './vistas/pedir.js?v=20261015i';
import * as mis_pedidos from './vistas/mis_pedidos.js?v=20261015i';
import * as bandeja from './vistas/bandeja.js?v=20261015i';
import * as ordenes from './vistas/ordenes.js?v=20261015i';
import * as recepcion from './vistas/recepcion.js?v=20261015i';
import * as envios from './vistas/envios.js?v=20261015i';
import * as recibir from './vistas/recibir.js?v=20261015i';
import * as vencimientos from './vistas/vencimientos.js?v=20261015i';
import * as resumen from './vistas/resumen.js?v=20261015i';
import * as preguntas from './vistas/preguntas.js?v=20261015i';
import * as llegadas from './vistas/llegadas.js?v=20261015i';
import * as choferes from './vistas/choferes.js?v=20261015i';
import * as parado from './vistas/parado.js?v=20261015i';
import * as precios from './vistas/precios.js?v=20261015i';
import * as conteo from './vistas/conteo.js?v=20261015i';
import * as conteos from './vistas/conteos.js?v=20261015i';
import * as mermas from './vistas/mermas.js?v=20261015i';
import * as produccion from './vistas/produccion.js?v=20261015i';
import * as repartir from './vistas/repartir.js?v=20261015i';
import * as perdidas from './vistas/perdidas.js?v=20261015i';
import * as minimos from './vistas/minimos.js?v=20261015i';
import * as ayuda from './vistas/ayuda.js?v=20261015i';

const VISTAS = { '': inicio, catalogo, porciones, config, importar, productos_sedes, pedir, mis_pedidos, bandeja, ordenes, recepcion, envios, recibir, vencimientos, resumen, minimos, preguntas, llegadas, choferes, parado, precios, conteo, conteos, mermas, perdidas, produccion, repartir, ayuda };

function cargarCss() {
	if (document.getElementById('lg_css')) { return; }
	const l = document.createElement('link');
	l.id = 'lg_css';
	l.rel = 'stylesheet';
	l.href = new URL('../logistica.css?v=20261015i', import.meta.url).href;   // subir la version al cambiar el CSS (nginx no manda no-cache)
	document.head.appendChild(l);
}

export async function montar(cont, suelta = false) {
	cargarCss();
	cont.classList.add('lg-app');
	try {
		const sesion = await api('sesion.php');
		iniciar(cont, VISTAS, sesion, suelta);
	} catch (e) {
		cont.innerHTML = `<div class="lg-error">${esc(e.message)}</div>`;
	}
}
