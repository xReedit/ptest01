// Catalogo > Porciones (central): las porciones de la central son el modelo para todas las sedes.
// Cada una dice de que producto sale (1 bote = 20 porciones) y se envia a las sedes: cada sede la enlaza con la suya
// (sugerida por nombre) o se le crea. Asi, al recibir botes, a la sede le suben las porciones solas.
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, autocompletar } from '../ui.js?v=20261026a';
import { vigente, recargar } from '../router.js?v=20261026a';
import { parecida } from './recibir.js?v=20261026a';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 3 });

export async function render(cont, sesion, t) {
	const d = await api('porciones.php?op=lista');
	if (!vigente(t)) { return; }
	cont.innerHTML = tarjeta({
		titulo: 'Porciones',
		ayuda: 'Las mismas porciones de tu pantalla <b>Porciones</b>. Indica de qué producto sale cada una (ej. 1 bote = 20 porciones) y envíala a las sedes: '
			+ 'cada sede la enlaza con la suya. Así, cuando una sede recibe botes, le suben las porciones solas.',
		acciones: `${volver('catalogo')}<button class="btn btn-sm btn-success" id="pc_nueva"><i class="fa fa-plus"></i>Nueva porción</button>`,
		cuerpo: `
			<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Buscar</span><input class="inv-input" id="pc_q" placeholder="Nombre de la porción"></div>
				<span class="inv-sep"></span>
				<p class="inv-ayuda">${d.porciones.length} porciones en la central · ${d.sedes_total} sede(s) participan</p>
			</div>
			<div id="pc_lista"></div>
			<dialog class="lg-dlg" id="pc_dlg"></dialog>`,
	});
	const lista = cont.querySelector('#pc_lista'), q = cont.querySelector('#pc_q'), dlg = cont.querySelector('#pc_dlg');
	const pintar = () => {
		const f = q.value.trim().toUpperCase();
		const filas = d.porciones.filter(p => !f || p.descripcion.toUpperCase().includes(f) || p.producto.toUpperCase().includes(f));
		lista.innerHTML = filas.length ? `<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>Porción</th><th>Sale de</th><th>Rinde</th><th>En sedes</th><th></th></tr></thead>
			<tbody>${filas.map(p => `<tr>
				<td><b>${esc(p.descripcion)}</b>${p.codigo ? `<span class="inv-sub">Código único ${esc(p.codigo)}</span>` : ''}</td>
				<td>${p.producto ? esc(p.producto) : '<span class="inv-muted">— no viene del almacén —</span>'}</td>
				<td>${p.producto && p.factor ? `1 = <b>${num(p.factor)}</b> porciones` : '<span class="inv-muted">—</span>'}</td>
				<td><span class="inv-estado ${p.en_sedes < d.sedes_total ? 'borrador' : 'aprobado'}">${p.en_sedes}/${d.sedes_total}</span></td>
				<td class="inv-acciones"><span class="inv-link" data-editar="${p.idporcion}"><i class="fa fa-pencil"></i>Editar</span>
					<span class="inv-link" data-enviar="${p.idporcion}"><i class="fa fa-share-alt"></i>Enviar a las sedes</span></td>
			</tr>`).join('')}</tbody></table></div>`
			: `<p class="inv-empty"><i class="fa fa-pie-chart"></i>${d.porciones.length ? 'Ninguna porción con ese nombre.' : 'La central aún no tiene porciones. Crea la primera con <b>Nueva porción</b>.'}</p>`;
	};
	pintar();
	q.addEventListener('input', pintar);
	cont.querySelector('#pc_nueva').addEventListener('click', () => formulario(dlg, d, null));
	lista.addEventListener('click', e => {
		const ed = e.target.closest('[data-editar]');
		if (ed) { formulario(dlg, d, d.porciones.find(p => p.idporcion === Number(ed.dataset.editar))); }
		const en = e.target.closest('[data-enviar]');
		if (en) { enviar(dlg, d.porciones.find(p => p.idporcion === Number(en.dataset.enviar))); }
	});
}

/** Nueva porcion o editar de que producto sale y cuanto rinde. El nombre de una existente se cambia en la pantalla Porciones. */
function formulario(dlg, d, p) {
	dlg.innerHTML = `
		<div class="xdlg-head"><h3>${p ? esc(p.descripcion) : 'Nueva porción'}</h3>
			<p>${p ? 'El nombre se cambia en la pantalla Porciones.' : 'Se crea en la central. Después la envías a las sedes.'}</p></div>
		<div class="xdlg-body">
			${p ? '' : `<div class="inv-form-row"><div class="inv-field"><span class="inv-label">Nombre de la porción</span>
				<input class="inv-input inv-w100" id="pf_desc" maxlength="180" placeholder="Ej: HELADO DE FRESA"></div></div>`}
			<div class="inv-form-row"><div class="inv-field"><span class="inv-label">¿De qué producto del almacén sale?</span>
				<input class="inv-input inv-w100" id="pf_prod" maxlength="150" placeholder="Escribe y elige: bote, helado…" value="${esc(p && p.idproducto ? p.producto : '')}"></div>
				<span class="inv-sub">Es lo que la central envía a las sedes, ej. BOTE HELADO FRESA. Vacío = no llega del almacén.</span></div>
			<div class="inv-form-row" id="pf_rinde"><span class="inv-ayuda">De 1 <b id="pf_und"></b> salen</span>
				<input class="inv-input" id="pf_porc" type="number" min="1" max="10000" step="any" inputmode="decimal" style="width:90px" value="${p && p.factor ? num(p.factor) : ''}">
				<span class="inv-ayuda">porciones</span></div>
		</div>
		<div class="xdlg-foot">
			<button class="btn btn-sm btn-light" id="pf_cancelar"><i class="fa fa-times"></i>Cancelar</button>
			<button class="btn btn-sm btn-success" id="pf_guardar"><i class="fa fa-check"></i>Guardar</button>
		</div>`;
	const $ = s => dlg.querySelector(s);
	const prod = $('#pf_prod');
	if (p && p.idproducto) { prod.dataset.valor = p.idproducto; }
	autocompletar(prod, d.productos.map(x => ({ texto: x.descripcion, valor: String(x.idproducto) })));
	// elegido de la lista, o escrito igual a un producto del catalogo; vacio = de ninguno; otro texto = null (no existe)
	const idElegido = () => {
		const txt = prod.value.trim().toUpperCase();
		if (!txt) { return 0; }
		if (prod.dataset.valor) { return Number(prod.dataset.valor); }
		const x = d.productos.find(o => o.descripcion.trim().toUpperCase() === txt);
		return x ? Number(x.idproducto) : null;
	};
	const verRinde = () => { $('#pf_rinde').hidden = !prod.value.trim(); $('#pf_und').textContent = prod.value.trim(); };
	prod.addEventListener('input', verRinde);
	verRinde();
	$('#pf_cancelar').addEventListener('click', () => dlg.close());
	$('#pf_guardar').addEventListener('click', async e => {
		const btn = e.currentTarget;
		if ($('#pf_porc').validity.badInput) { aviso('Las porciones se escriben solo con números (ej. 20).', 'error'); return; }
		const idproducto = idElegido();
		if (idproducto === null) { aviso('Ese producto no está en el catálogo: escribe y elígelo de la lista (o déjalo vacío).', 'error'); prod.focus(); return; }
		btn.disabled = true;
		try {
			await api('porciones.php?op=guardar', { idporcion: p ? p.idporcion : 0, descripcion: p ? undefined : $('#pf_desc').value,
				idproducto, porciones: $('#pf_porc').value });
			dlg.close();
			aviso(p ? 'Porción guardada. Las sedes ya enlazadas toman el mismo número.' : 'Porción creada. Ahora envíala a las sedes.');
			recargar();
		} catch (err) {
			aviso(err.message, 'error');
		} finally {
			btn.disabled = false;
		}
	});
	dlg.showModal();
}

/** Por sede: ya enlazada, o elegir su porcion (sugerida por nombre), crearla o no enviar. */
async function enviar(dlg, p) {
	let s;
	try { s = await api('porciones.php?op=sedes&idporcion=' + p.idporcion); } catch (err) { aviso(err.message, 'error'); return; }
	dlg.innerHTML = `
		<div class="xdlg-head"><h3>Enviar ${esc(p.descripcion)} a las sedes</h3>
			<p>Si la sede ya tiene esta porción con otro nombre, elígela: <b>sus recetas siguen igual</b>. Si no la tiene, se le crea.</p></div>
		<div class="xdlg-body"><div class="inv-table-wrap"><table class="inv-table"><thead><tr><th>Sede</th><th>Su porción</th></tr></thead><tbody>
			${s.sedes.map(x => {
				if (x.enlazada) { return `<tr data-sede="${x.idsede}" data-ya="${x.enlazada.idporcion}"><td>${esc(x.sede)}</td><td><i class="fa fa-check-circle" style="color:#28a745"></i> ${esc(x.enlazada.descripcion)}</td></tr>`; }
				const sug = parecida(p.descripcion, x.porciones);
				return `<tr data-sede="${x.idsede}"><td>${esc(x.sede)}</td><td><select class="inv-select pe-sel" style="width:100%">
					<option value="0" ${sug ? '' : 'selected'}>➕ Crear "${esc(p.descripcion)}" en esta sede</option>
					<option value="-1">— No enviar a esta sede —</option>
					${x.porciones.map(o => `<option value="${o.idporcion}" ${sug === o ? 'selected' : ''}>Es su ${esc(o.descripcion)}</option>`).join('')}
				</select></td></tr>`;
			}).join('')}
		</tbody></table></div></div>
		<div class="xdlg-foot">
			<button class="btn btn-sm btn-light" id="pe_cancelar"><i class="fa fa-times"></i>Cancelar</button>
			<button class="btn btn-sm btn-success" id="pe_ok"><i class="fa fa-share-alt"></i>Enviar</button>
		</div>`;
	dlg.querySelector('#pe_cancelar').addEventListener('click', () => dlg.close());
	dlg.querySelector('#pe_ok').addEventListener('click', async e => {
		const btn = e.currentTarget;
		const sedes = [...dlg.querySelectorAll('tr[data-sede]')].map(tr => ({ idsede: Number(tr.dataset.sede),
			idporcion: tr.dataset.ya ? Number(tr.dataset.ya) : Number(tr.querySelector('.pe-sel').value) })).filter(x => x.idporcion >= 0);
		btn.disabled = true;
		try {
			const r = await api('porciones.php?op=enviar', { idporcion: p.idporcion, sedes });
			dlg.close();
			aviso(`Listo: ${r.enlazadas} sede(s) enlazadas y ${r.creadas} porción(es) creadas.`);
			recargar();
		} catch (err) {
			aviso(err.message, 'error');
		} finally {
			btn.disabled = false;
		}
	});
	dlg.showModal();
}
