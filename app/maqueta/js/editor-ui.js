// Avisos del editor "Armar salon" sin alert()/confirm() nativos (docs/design.md §7): aviso flotante y dialogo con el
// encabezado a sangre (.xdlg-head/.xdlg-body/.xdlg-foot de css/micss.css). Todo texto entra con textContent.

// Lo que se le dice al dueño por cada codigo del servidor o de validarPlano (nunca el codigo crudo).
const MENSAJES = {
	sin_conexion: 'Sin conexión con el servidor. Revisa tu internet e intenta de nuevo.',
	no_session: 'Tu sesión terminó. Vuelve a entrar al sistema.',
	sin_permiso: 'No tienes permiso para cambiar el salón. Pídeselo al administrador.',
	conflicto: 'Otra persona guardó este salón. Recarga para ver sus cambios.',
	sin_plano: 'Primero guarda el salón de al menos un área. Después podrás usarlo en Control de pedidos.',
	codigo_repetido: 'Hay dos mesas con el mismo número. Borra una de las dos y vuelve a guardar.',
	demasiadas_piezas: 'El salón tiene demasiadas piezas (máximo 500). Borra algunas y vuelve a guardar.',
	plano_invalido: 'Algo del salón no se pudo guardar. Revisa que todas las piezas estén dentro del salón.',
};
const MENSAJE_GENERAL = 'No se pudo completar. Intenta de nuevo en un momento.';

/** Texto simple para un codigo de error (ErrorMaqueta.codigo o el error de validarPlano). */
export function textoDeError(codigo) {
	if (MENSAJES[codigo]) { return MENSAJES[codigo]; }
	return ['piezas_invalidas', 'pieza_invalida', 'ajustes_invalidos'].includes(codigo) ? MENSAJES.plano_invalido : MENSAJE_GENERAL;
}

/** Aviso flotante abajo a la derecha (reemplaza al anterior). tipo: 'ok' | 'error'. */
export function aviso(texto, tipo = 'ok') {
	for (const viejo of document.querySelectorAll('.mqe-aviso')) { viejo.remove(); }
	const d = document.createElement('div');
	d.className = 'mqe-aviso' + (tipo === 'error' ? ' mqe-aviso-error' : '');
	d.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
	d.textContent = texto;
	document.body.appendChild(d);
	setTimeout(() => d.remove(), tipo === 'error' ? 6000 : 3500);
}

/**
 * Dialogo modal. Resuelve con el valor del boton elegido (null si se cierra con Esc).
 * @param {{titulo: string, texto: string, botones: Array<{texto: string, valor: string, clase?: string}>}} op
 *   botones en orden: primero el de cancelar, al final la accion (docs/design.md)
 * @returns {Promise<string|null>}
 */
export function dialogo({ titulo, texto, botones }) {
	return new Promise(resolver => {
		const dlg = document.createElement('dialog');
		dlg.className = 'mqe-dlg';
		const cab = document.createElement('div');
		cab.className = 'xdlg-head';
		const h = document.createElement('h3');
		h.textContent = titulo;
		cab.appendChild(h);
		const cuerpo = document.createElement('div');
		cuerpo.className = 'xdlg-body';
		cuerpo.textContent = texto;
		const pie = document.createElement('div');
		pie.className = 'xdlg-foot';
		for (const b of botones) {
			const btn = document.createElement('button');
			btn.type = 'button';
			btn.className = `btn btn-sm ${b.clase || 'btn-light'}`;
			btn.textContent = b.texto;
			btn.dataset.valor = b.valor;
			pie.appendChild(btn);
		}
		dlg.append(cab, cuerpo, pie);
		document.body.appendChild(dlg);
		let valor = null;
		pie.addEventListener('click', e => {
			const b = e.target.closest('[data-valor]');
			if (b) { valor = b.dataset.valor; dlg.close(); }
		});
		dlg.addEventListener('close', () => { dlg.remove(); resolver(valor); });
		dlg.showModal();
		pie.querySelector('button').focus();
	});
}

/** Pregunta si/no. true solo si eligio la accion. */
export async function preguntar(titulo, texto, accion) {
	const r = await dialogo({ titulo, texto, botones: [{ texto: 'Cancelar', valor: 'no' }, { texto: accion, valor: 'si', clase: 'btn-success' }] });
	return r === 'si';
}
