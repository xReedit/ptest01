// Helpers de interfaz compartidos por las vistas (copia de app/logistica/js/ui.js con prefijo cm-).
// Nada se ejecuta al importar: solo funciones.

export function esc(s) {
	return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Aviso flotante (sin alert() nativo). tipo: 'ok' | 'error' */
export function aviso(texto, tipo = 'ok') {
	const d = document.createElement('div');
	d.className = 'cm-aviso' + (tipo === 'error' ? ' error' : '');
	d.setAttribute('role', tipo === 'error' ? 'alert' : 'status');
	d.textContent = texto;
	document.body.appendChild(d);
	setTimeout(() => d.remove(), tipo === 'error' ? 6000 : 3000);
}

/**
 * Tarjeta estandar del sistema (xMiCard + inv-head, igual que Logística/Inventario).
 * ayuda, acciones y cuerpo son HTML ya escapado.
 */
export function tarjeta({ titulo, ayuda = '', acciones = '', cuerpo = '' }) {
	return `
		<div class="xMiCard xradius inv-card">
			<div class="xEncanezadoCard inv-head">
				<div class="inv-head-top">
					<div><h3>${esc(titulo)}</h3>${ayuda ? `<p>${ayuda}</p>` : ''}</div>
					<div class="inv-head-acciones">${acciones}</div>
				</div>
			</div>
			<div class="xContentCard">${cuerpo}</div>
		</div>`;
}

/** Boton Volver a otra pantalla del modulo ('' = inicio). */
export const volver = (ruta = '') => `<a class="btn btn-sm btn-light" href="#" data-ir="${esc(ruta)}"><i class="fa fa-arrow-left"></i>Volver</a>`;

/**
 * Alerta de confirmacion (en lugar de confirm() nativo). Devuelve Promise<boolean>.
 * textoHtml ya escapado. El boton de cancelar queda con el foco: Enter por error no confirma.
 */
export function confirmar({ titulo, textoHtml, boton = 'Sí, continuar', peligro = true }) {
	return new Promise(resolver => {
		const dlg = document.createElement('dialog');
		dlg.className = 'cm-dlg cm-app';
		dlg.innerHTML = `
			<div class="xdlg-head"><h3><i class="fa ${peligro ? 'fa-exclamation-triangle' : 'fa-question-circle'}" style="color:${peligro ? '#dc3545' : '#007bff'};margin-right:6px"></i>${esc(titulo)}</h3></div>
			<div class="xdlg-body" style="font-size:13px">${textoHtml}</div>
			<div class="xdlg-foot">
				<button class="btn btn-sm btn-light" data-r="0"><i class="fa fa-times"></i>No, cancelar</button>
				<button class="btn btn-sm ${peligro ? 'btn-danger' : 'btn-success'}" data-r="1"><i class="fa fa-check"></i>${esc(boton)}</button>
			</div>`;
		document.body.appendChild(dlg);
		let r = false;
		dlg.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) { r = b.dataset.r === '1'; dlg.close(); } });
		dlg.addEventListener('close', () => { dlg.remove(); resolver(r); });
		dlg.showModal();
		dlg.querySelector('[data-r="0"]').focus();
	});
}
