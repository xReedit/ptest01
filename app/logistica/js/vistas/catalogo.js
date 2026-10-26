// Catalogo de la central: listar, crear/editar (se propaga a las sedes) y replicar lo que falte.
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, confirmar, paginador } from '../ui.js?v=20261026a';
import { abrirForm, leerPresentaciones } from './producto_form.js?v=20261026a';

let datos = null;   // ultima respuesta de 'listar'

export async function render(cont, sesion) {
	cont.innerHTML = tarjeta({
		titulo: 'Catálogo de la central',
		ayuda: 'Los productos se crean aquí y se envían a todas las sedes. Cada sede pone su propio precio y stock.',
		acciones: `${volver()}
			<a class="btn btn-sm btn-light" id="ct_importar" href="#" data-ir="importar" hidden><i class="fa fa-file-excel-o"></i>Importar Excel</a>
			<a class="btn btn-sm btn-light" id="ct_porciones" href="#" data-ir="porciones" hidden><i class="fa fa-pie-chart"></i>Porciones</a>
			<button class="btn btn-sm btn-light" id="ct_replicar" hidden><i class="fa fa-share-alt"></i>Enviar a las sedes</button>
			<button class="btn btn-sm btn-success" id="ct_nuevo" hidden><i class="fa fa-plus"></i>Nuevo producto</button>`,
		cuerpo: `
			<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Buscar</span><input class="inv-input" id="ct_q" placeholder="Producto o familia"></div>
				<span class="inv-sep"></span>
				<p class="inv-ayuda" id="ct_resumen"></p>
			</div>
			<div id="ct_lista"><p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p></div>
			<dialog class="lg-dlg" id="ct_dlg"></dialog>`,
	});

	const q = cont.querySelector('#ct_q');
	let t = null;
	pagina = 1;
	q.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { pagina = 1; cargar(cont, sesion, q.value); }, 300); });
	cont.querySelector('#ct_nuevo').addEventListener('click', () => abrirForm(cont.querySelector('#ct_dlg'), datos, null, guardado(cont, sesion)));
	cont.querySelector('#ct_replicar').addEventListener('click', e => replicarPendientes(cont, sesion, e.currentTarget));
	cont.querySelector('#ct_lista').addEventListener('click', e => {
		const b = e.target.closest('[data-editar]');
		if (b) { abrirForm(cont.querySelector('#ct_dlg'), datos, datos.productos.find(p => String(p.idproducto) === b.dataset.editar), guardado(cont, sesion)); }
		const pg = e.target.closest('[data-pag]');
		if (pg) { pagina = Number(pg.dataset.pag); cargar(cont, sesion, q.value).then(() => cont.scrollIntoView({ block: 'start' })); }
		const x = e.target.closest('[data-eliminar]');
		if (x) { eliminar(cont, sesion, Number(x.dataset.eliminar)); }
	});
	await cargar(cont, sesion, '');
}

let pedido = 0;   // la busqueda dispara varias cargas: solo pinta la ultima
let pagina = 1;

async function cargar(cont, sesion, q) {
	const lista = cont.querySelector('#ct_lista');
	const n = ++pedido;
	try {
		const r = await api('catalogo.php?op=listar&q=' + encodeURIComponent(q) + '&pagina=' + pagina);
		if (n !== pedido || !lista.isConnected) { return; }   // llego tarde o ya se cambio de pantalla
		datos = r;
	} catch (e) {
		if (n !== pedido || !lista.isConnected) { return; }
		lista.innerHTML = `<div class="lg-error">${esc(e.message)}</div>
			<p style="margin-top:12px"><a class="btn btn-sm btn-success" href="#" data-ir="config"><i class="fa fa-cog"></i>Configurar Logística</a></p>`;
		return;
	}
	const esCentral = Number(datos.org.idsede_central) === Number(sesion.idsede);
	const total = Number(datos.sedes_total);
	cont.querySelector('#ct_nuevo').hidden = !esCentral;
	cont.querySelector('#ct_importar').hidden = !esCentral;
	cont.querySelector('#ct_porciones').hidden = !esCentral;
	const rep = cont.querySelector('#ct_replicar');
	rep.hidden = !esCentral || total === 0;   // el servidor dice cuantos faltan al presionarlo
	rep.innerHTML = '<i class="fa fa-share-alt"></i>Enviar a las sedes';
	rep.title = 'Crea en las sedes los productos del catálogo que todavía no tienen';
	pagina = datos.meta.pagina;
	cont.querySelector('#ct_resumen').textContent =
		`${datos.meta.total} productos · ${total} sede(s) participan` + (esCentral ? '' : ' · solo lectura: se edita desde la central');

	lista.innerHTML = datos.productos.length ? `
		<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>Familia</th><th>Producto</th><th class="lg-oc">Unidad</th><th style="text-align:right">Precio</th><th class="lg-oc">Se compra por</th><th class="lg-oc">Proveedor</th><th>En sedes</th><th></th></tr></thead>
			<tbody>${datos.productos.map(p => `
				<tr>
					<td>${esc(p.familia)}</td>
					<td>${esc(p.descripcion)}${p.porciones ? `<span class="inv-sub" title="Al recibir, la sede suma porciones. Cada sede enlaza su porción la primera vez que le llega.">
						<i class="fa fa-pie-chart"></i> 1 ${esc(p.unidad || 'und')} = ${Number(p.porciones)} porciones · enlazada en ${p.n_porcion}/${total} sedes</span>` : ''}</td>
					<td class="lg-oc">${esc(p.unidad) || '<span class="inv-muted">UND</span>'}</td>
					<td style="text-align:right">${Number(p.precio_venta || 0) ? 'S/ ' + Number(p.precio_venta).toFixed(2) : '<span class="inv-muted">—</span>'}</td>
					<td class="lg-oc">${leerPresentaciones(p.presentaciones).map(x => esc(`${x.nombre} x${x.factor}`)).join(', ') || '<span class="inv-muted">—</span>'}</td>
					<td class="lg-oc">${esc(p.proveedor) || '<span class="inv-muted">—</span>'}</td>
					<td><span class="inv-estado ${Number(p.n_sedes) < total ? 'borrador' : 'aprobado'}">${p.n_sedes}/${total}</span></td>
					<td class="inv-acciones">${esCentral ? `<span class="inv-link" data-editar="${p.idproducto}"><i class="fa fa-pencil"></i>Editar</span><span class="inv-link inv-link-rojo" data-eliminar="${p.idproducto}"><i class="fa fa-trash-o"></i>Eliminar</span>` : ''}</td>
				</tr>`).join('')}
			</tbody>
		</table></div>
		${paginador(datos.meta)}`
		: '<p class="inv-empty"><i class="fa fa-book"></i>Aún no hay productos. Crea uno o importa tu Excel.</p>';
}

function guardado(cont, sesion) {
	return async (r, esNuevo) => {
		aviso(esNuevo ? resumenReplica(r.replicado) : `Guardado en ${r.sedes_actualizadas} sedes.`);
		await cargar(cont, sesion, cont.querySelector('#ct_q').value);
	};
}

async function eliminar(cont, sesion, idproducto) {
	try {
		const info = await api('catalogo.php?op=antes_eliminar&idproducto=' + idproducto);
		const stock = Number(info.stock);
		const ok = await confirmar({
			titulo: '¿Eliminar este producto?',
			boton: 'Sí, eliminar',
			textoHtml: `
				<p style="margin:0 0 8px"><b>${esc(info.descripcion)}</b></p>
				<ul style="margin:0 0 8px;padding-left:18px">
					<li>Se quitará del catálogo de la central${info.sedes ? ` y de <b>${info.sedes}</b> sede(s)` : ''}.</li>
					<li>Ya no se podrá comprar, pedir ni trasladar.</li>
					<li>Las ventas, compras y movimientos ya registrados <b>no se pierden</b>.</li>
				</ul>
				${stock > 0 ? `<p class="inv-neg" style="margin:0"><i class="fa fa-exclamation-circle"></i> Todavía hay <b>${esc(String(stock))}</b> en stock entre todas las sedes.</p>` : ''}`,
		});
		if (!ok) { return; }
		const r = await api('catalogo.php?op=eliminar', { idproducto });
		aviso(`Producto eliminado (${r.eliminados} registro(s)).`);
		await cargar(cont, sesion, cont.querySelector('#ct_q').value);
	} catch (err) {
		aviso(err.message, 'error');
	}
}

async function replicarPendientes(cont, sesion, btn) {
	btn.disabled = true;
	try {
		const info = await api('catalogo.php?op=pendientes_envio');
		if (!info.pendientes) { aviso('Todas las sedes ya tienen todo el catálogo.'); return; }
		const ok = await confirmar({
			titulo: '¿Enviar el catálogo a las sedes?',
			peligro: false,
			boton: `Sí, enviar ${info.pendientes} productos`,
			textoHtml: `
				<p style="margin:0 0 8px">Hay <b>${info.pendientes}</b> productos del catálogo que todavía <b>no existen</b> en una o más de tus
					<b>${info.sedes}</b> sedes. Esto los crea en esas sedes para que puedan pedirlos, recibirlos y venderlos.</p>
				<ul style="margin:0 0 8px;padding-left:18px">
					<li>Llegan con <b>stock 0</b> y con el <b>precio de venta del catálogo</b>. Después cada sede puede cambiar su precio.</li>
					<li>Si una sede ya tiene un producto con el mismo nombre, <b>no se duplica</b>: lo verás en
						<b>Productos de las sedes</b> para vincularlo.</li>
					<li>No borra ni cambia nada de lo que las sedes ya tienen.</li>
				</ul>`,
		});
		if (!ok) { return; }
		let despues_de = 0, creado = 0, conflicto = 0, quedan = info.pendientes;
		while (quedan > 0) {
			btn.innerHTML = `<i class="fa fa-spinner fa-spin"></i>Enviando… faltan ${quedan}`;
			const r = await api('catalogo.php?op=enviar_pendientes', { despues_de });
			if (r.ultimo === despues_de) { break; }
			despues_de = r.ultimo;
			creado += r.creado;
			conflicto += r.conflicto.length;
			quedan = r.quedan;
		}
		aviso(`Listo: ${creado} productos creados en las sedes.` + (conflicto ? ` ${conflicto} ya existían con ese nombre: vincúlalos en Productos de las sedes.` : ''),
			conflicto ? 'error' : 'ok');
		await cargar(cont, sesion, cont.querySelector('#ct_q').value);
	} catch (err) {
		aviso(err.message, 'error');
	} finally {
		btn.disabled = false;
	}
}

function resumenReplica(r) {
	const base = `Creado en ${r.creado} sede(s).`;
	return r.conflicto.length
		? `${base} ${r.conflicto.length} no se crearon porque la sede ya tiene un producto con ese nombre (vincúlalo a mano).`
		: base;
}
