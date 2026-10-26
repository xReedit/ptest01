// Choferes / repartidores (central): nombre y celular. A ese celular le llega por WhatsApp su enlace personal a la
// app del chofer (chofer.html), donde ve sus rutas y marca cada entrega (hora + GPS).
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, confirmar, fecha } from '../ui.js?v=20261026a';
import { vigente, recargar } from '../router.js?v=20261026a';

export async function render(cont, sesion, t) {
	const lista = await api('choferes.php?op=listar');
	if (!vigente(t)) { return; }
	cont.innerHTML = '<div id="ch_raiz">' + tarjeta({
		titulo: 'Choferes',
		ayuda: 'Quienes reparten la mercadería. A cada uno le llega por WhatsApp un enlace a <b>su</b> app: ahí ve sus entregas y las marca como entregadas (con hora y ubicación).',
		acciones: `${volver()}<button class="btn btn-sm btn-success" id="ch_nuevo"><i class="fa fa-plus"></i>Agregar chofer</button>`,
		cuerpo: lista.length ? `<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>Chofer</th><th>Celular</th><th>Entró a su app</th><th>Rutas en camino</th><th></th></tr></thead>
			<tbody>${lista.map(c => `<tr class="${Number(c.activo) ? '' : 'inv-muted'}">
				<td><b>${esc(c.nombre)}</b>${Number(c.activo) ? '' : ' <span class="inv-estado anulado">desactivado</span>'}</td>
				<td>${esc(c.telefono) || '<span class="inv-neg">sin celular</span>'}</td>
				<td>${c.ultimo_acceso ? esc(fecha(c.ultimo_acceso)) : '<span class="inv-muted">aún no</span>'}</td>
				<td>${c.rutas_abiertas}</td>
				<td class="inv-acciones">${Number(c.activo) ? `
					<button class="btn btn-sm btn-success" data-acceso="${c.idchofer}"><i class="fa fa-whatsapp"></i>Mandar su acceso</button>
					<span class="inv-link" data-editar="${c.idchofer}"><i class="fa fa-pencil"></i>Editar</span>
					<span class="inv-link" data-nuevo-enlace="${c.idchofer}" title="Si perdió el celular: el enlace anterior deja de servir"><i class="fa fa-refresh"></i>Enlace nuevo</span>
					<span class="inv-link inv-link-rojo" data-activo="${c.idchofer}" data-v="0"><i class="fa fa-ban"></i>Desactivar</span>`
					: `<span class="inv-link" data-activo="${c.idchofer}" data-v="1"><i class="fa fa-check"></i>Activar</span>`}</td>
			</tr>`).join('')}</tbody></table></div>`
			: '<p class="inv-empty"><i class="fa fa-truck"></i>Aún no hay choferes. Agrega el primero: nombre y celular.</p>',
	}) + '</div>';
	const porId = id => lista.find(c => c.idchofer === Number(id));
	cont.querySelector('#ch_nuevo').addEventListener('click', async () => { if (await dialogoChofer()) { recargar(); } });
	cont.querySelector('#ch_raiz').addEventListener('click', async e => {
		const a = e.target.closest('[data-acceso]');
		if (a) { mandarAcceso(porId(a.dataset.acceso), 'enviar_acceso', a); return; }
		const ed = e.target.closest('[data-editar]');
		if (ed) { if (await dialogoChofer(porId(ed.dataset.editar))) { recargar(); } return; }
		const ne = e.target.closest('[data-nuevo-enlace]');
		if (ne) {
			const c = porId(ne.dataset.nuevoEnlace);
			const ok = await confirmar({ titulo: `¿Enlace nuevo para ${c.nombre}?`, boton: 'Sí, enlace nuevo',
				textoHtml: '<p style="margin:0">El enlace anterior <b>deja de servir</b> (úsalo si perdió el celular o alguien más lo tiene). El nuevo le llega por WhatsApp.</p>' });
			if (ok) { mandarAcceso(c, 'nuevo_enlace', ne); }
			return;
		}
		const ac = e.target.closest('[data-activo]');
		if (ac) {
			const c = porId(ac.dataset.activo), v = ac.dataset.v === '1';
			if (!v && !(await confirmar({ titulo: `¿Desactivar a ${c.nombre}?`, boton: 'Sí, desactivar',
				textoHtml: '<p style="margin:0">Su enlace deja de servir y ya no aparece para asignarle rutas. Puedes activarlo después.</p>' }))) { return; }
			try { await api('choferes.php?op=activo', { idchofer: c.idchofer, activo: v }); recargar(); } catch (err) { aviso(err.message, 'error'); }
		}
	});
}

/** Manda (o reenvia) el enlace por WhatsApp; si el WhatsApp de la central no esta conectado, ofrece copiarlo. */
async function mandarAcceso(c, op, btn) {
	if (btn) { btn.style.pointerEvents = 'none'; }
	try {
		const r = await api('choferes.php?op=' + op, { idchofer: c.idchofer });
		if (r.enviado) { aviso(`Listo: el acceso le llegó por WhatsApp a ${c.nombre}.`); return; }
		const dlg = document.createElement('dialog');
		dlg.className = 'lg-dlg lg-app';
		const dig = String(c.telefono || '').replace(/\D/g, '');
		dlg.innerHTML = `<div class="xdlg-head"><h3>No se pudo mandar solo</h3><p>${esc(r.error || '')}</p></div>
			<div class="xdlg-body"><p style="margin:0 0 6px">Mándaselo tú: cópialo o ábrelo en tu WhatsApp.</p>
				<input class="inv-input inv-w100" readonly value="${esc(r.enlace)}"></div>
			<div class="xdlg-foot"><button class="btn btn-sm btn-light" data-x><i class="fa fa-times"></i>Cerrar</button>
				<button class="btn btn-sm btn-light" data-copiar><i class="fa fa-copy"></i>Copiar enlace</button>
				${dig.length >= 9 ? `<a class="btn btn-sm btn-success" target="_blank" rel="noopener" href="https://wa.me/${dig.length === 9 ? '51' + dig : dig}?text=${encodeURIComponent(`Hola ${c.nombre}, este es tu acceso para ver y marcar tus entregas: ${r.enlace}`)}"><i class="fa fa-whatsapp"></i>Abrir WhatsApp</a>` : ''}</div>`;
		document.body.appendChild(dlg);
		dlg.addEventListener('close', () => dlg.remove());
		dlg.querySelector('[data-x]').addEventListener('click', () => dlg.close());
		dlg.querySelector('[data-copiar]').addEventListener('click', async () => {
			try { await navigator.clipboard.writeText(r.enlace); aviso('Enlace copiado.'); } catch (e) { dlg.querySelector('input').select(); }
		});
		dlg.showModal();
	} catch (err) { aviso(err.message, 'error'); }
	finally { if (btn) { btn.style.pointerEvents = ''; } }
}

/** Dialogo para crear o editar un chofer. Devuelve el chofer guardado o null. Lo usa tambien Envios ("+ Nuevo chofer"). */
export function dialogoChofer(c) {
	return new Promise(resolver => {
		const dlg = document.createElement('dialog');
		dlg.className = 'lg-dlg lg-app';
		dlg.innerHTML = `<div class="xdlg-head"><h3>${c ? 'Editar chofer' : 'Nuevo chofer'}</h3><p>Al celular le llegará su acceso por WhatsApp.</p></div>
			<div class="xdlg-body">
				<div class="inv-form-row"><span class="inv-label">Nombre</span><input class="inv-input inv-w100" id="dc_nom" maxlength="80" value="${esc(c ? c.nombre : '')}" placeholder="Ej: PEDRO RAMOS"></div>
				<div class="inv-form-row"><span class="inv-label">Celular (WhatsApp)</span><input class="inv-input inv-w100" id="dc_tel" inputmode="tel" maxlength="15" value="${esc(c ? c.telefono : '')}" placeholder="Ej: 987654321"></div>
			</div>
			<div class="xdlg-foot"><button class="btn btn-sm btn-light" data-x><i class="fa fa-times"></i>Cancelar</button>
				<button class="btn btn-sm btn-success" data-ok><i class="fa fa-check"></i>Guardar</button></div>`;
		document.body.appendChild(dlg);
		let r = null;
		dlg.addEventListener('close', () => { dlg.remove(); resolver(r); });
		dlg.querySelector('[data-x]').addEventListener('click', () => dlg.close());
		dlg.querySelector('[data-ok]').addEventListener('click', async e => {
			e.currentTarget.disabled = true;
			try {
				r = await api('choferes.php?op=guardar', { idchofer: c ? c.idchofer : 0, nombre: dlg.querySelector('#dc_nom').value, telefono: dlg.querySelector('#dc_tel').value });
				aviso('Chofer guardado.');
				dlg.close();
			} catch (err) { aviso(err.message, 'error'); e.currentTarget.disabled = false; }
		});
		dlg.showModal();
		dlg.querySelector('#dc_nom').focus();
	});
}
