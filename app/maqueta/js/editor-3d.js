// "Ver en 3D" del editor (spec §6.2): la misma escena de la vista en vivo, sin datos (soloVista), en un dialogo a
// pantalla casi completa, con el panel Personalizar al costado para ver cada cambio en 3D. escena.js (efectos,
// controles de camara) se carga recien al abrir; Three.js ya vino con el editor (editor-svg.js importa piezas3d.js
// por puestosDe). Sin WebGL: lo dice en simple y el panel sigue sirviendo (los colores se guardan igual).
import { crearPanel } from './editor-panel.js?v=20261102m';

const SIN_3D = 'Esta computadora no puede mostrar el salón en 3D. Igual puedes elegir colores y sillas: se guardan y se verán en las cajas que sí puedan.';
const NO_ABRIO = 'No se pudo abrir la vista en 3D. Cierra y vuelve a intentar.';

function boton(texto, clase, icono) {
	const b = document.createElement('button');
	b.type = 'button';
	b.className = `btn btn-sm ${clase}`;
	const i = document.createElement('i');
	i.className = `fa ${icono}`;
	b.append(i, ` ${texto}`);
	return b;
}

function armarDialogo(nombreArea, conPanel) {
	const dlg = document.createElement('dialog');
	dlg.className = 'mqe-dlg mqe-dlg3d';
	const cab = document.createElement('div');
	cab.className = 'xdlg-head mqe-dlg3d-head';
	const textos = document.createElement('div');
	const h = document.createElement('h3');
	h.textContent = `Así se verá: ${nombreArea}`;
	const p = document.createElement('p');
	p.textContent = 'Arrastra para mover la vista, con el botón derecho la giras y con la rueda te acercas.';
	textos.append(h, p);
	const acciones = document.createElement('div');
	acciones.className = 'mqe-dlg3d-acciones';
	const personalizar = boton('Personalizar', 'btn-light', 'fa-paint-brush');
	personalizar.hidden = !conPanel;
	const cerrar = boton('Cerrar', 'btn-secondary', 'fa-times');
	acciones.append(personalizar, cerrar);
	cab.append(textos, acciones);
	const cuerpo = document.createElement('div');
	cuerpo.className = 'mqe-dlg3d-cuerpo';
	const host = document.createElement('div');
	host.className = 'mqe-3d';
	const panel = document.createElement('aside');
	panel.className = 'mqe-cfg';
	panel.hidden = true;
	cuerpo.append(host, panel);
	dlg.append(cab, cuerpo);
	return { dlg, host, panel, personalizar, cerrar };
}

function mensajeEn(host, texto) {
	const m = document.createElement('p');
	m.className = 'mqe-3d-msj';
	m.textContent = texto;
	host.appendChild(m);
}

/**
 * Abre la vista 3D del plano. Resuelve al cerrar.
 * @param {{plano: object, nombreArea: string, editable: boolean, abrirPanel?: boolean,
 *   alCambiarAjustes: (ajustes: object, final: boolean) => void}} op plano valido (validarPlano)
 * @returns {Promise<void>}
 */
export async function abrirVista3D({ plano, nombreArea, editable, abrirPanel = false, alCambiarAjustes }) {
	const d = armarDialogo(nombreArea, editable);
	document.body.appendChild(d.dlg);
	d.dlg.showModal();
	let escena = null;
	const panel = crearPanel(d.panel, {
		alCambiar(ajustes, final) {
			if (escena) { escena.setAjustes(ajustes); }
			alCambiarAjustes(ajustes, final);
		},
	});
	panel.pintar(plano.ajustes);
	d.panel.hidden = !(editable && abrirPanel);
	d.personalizar.addEventListener('click', () => { d.panel.hidden = !d.panel.hidden; });
	const cerrado = new Promise(resolver => {
		d.cerrar.addEventListener('click', () => d.dlg.close());
		d.dlg.addEventListener('close', () => {
			if (escena) { escena.destruir(); }
			escena = null;
			d.dlg.remove();
			resolver();
		}, { once: true });
	});
	try {
		const { crearEscena } = await import('./escena.js?v=20261102m');
		if (!d.dlg.open) { return cerrado; }   // se cerro (Esc) mientras cargaba escena.js
		escena = crearEscena(d.host, plano, { soloVista: true });
		if (escena) {
			escena.alPerderContexto(() => { escena.destruir(); escena = null; mensajeEn(d.host, SIN_3D); });
		} else {
			mensajeEn(d.host, SIN_3D);
		}
	} catch (e) {
		console.error('maqueta: no se pudo abrir la vista 3D', e);
		mensajeEn(d.host, NO_ABRIO);
	}
	return cerrado;
}
