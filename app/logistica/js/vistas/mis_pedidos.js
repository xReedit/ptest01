// "Mis pedidos" (sede): que se pidio y en que va cada pedido. Se puede cancelar mientras la central no lo vio.
import { cargarHistorias } from '../historia.js?v=20261015i';
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver, confirmar, fecha } from '../ui.js?v=20261015i';
import { vigente, recargar } from '../router.js?v=20261015i';

// estado legacy -> texto simple + clase inv-estado
const ESTADOS = {
	enviado: ['Enviado', 'borrador'],
	visto: ['La central lo vio', 'cerrado'],
	atendido: ['Preparando', 'cerrado'],
	despachado: ['En camino', 'cerrado'],
	recibido: ['Recibido', 'aprobado'],
	cancelado: ['Cancelado', 'anulado'],
};

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });

export async function render(cont, sesion, t) {
	const pedidos = await api('pedidos.php?op=mis_pedidos');
	if (!vigente(t)) { return; }
	cont.innerHTML = tarjeta({
		titulo: 'Mis pedidos',
		ayuda: 'Los últimos 30 pedidos de tu sede a la central y en qué va cada uno.',
		acciones: `${volver()}<a class="btn btn-sm btn-success" href="#" data-ir="pedir"><i class="fa fa-plus"></i>Nuevo pedido</a>`,
		cuerpo: pedidos.length ? `
			<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>N°</th><th>Fecha</th><th>Productos</th><th>Estado</th><th></th></tr></thead>
				<tbody>${pedidos.map(p => {
					const [txt, cls] = ESTADOS[p.estado] || [p.estado, ''];
					return `<tr>
						<td>${p.id}</td>
						<td>${esc(fecha(p.fecha))}${p.nota ? `<span class="inv-sub">${esc(p.nota)}</span>` : ''}</td>
						<td>${p.productos}</td>
						<td><span class="inv-estado ${cls}">${esc(txt)}</span></td>
						<td class="inv-acciones"><span class="inv-link" data-ver="${p.id}"><i class="fa fa-eye"></i>Ver</span>
							${p.estado === 'enviado' ? `<span class="inv-link inv-link-rojo" data-cancelar="${p.id}"><i class="fa fa-times"></i>Cancelar</span>` : ''}</td>
					</tr>`;
				}).join('')}</tbody>
			</table></div>
			<dialog class="lg-dlg" id="mp_dlg"></dialog>`
			: '<p class="inv-empty"><i class="fa fa-shopping-basket"></i>Aún no has hecho pedidos. Presiona <b>Nuevo pedido</b>.</p>',
	});
	cont.querySelector('.xContentCard').addEventListener('click', async e => {
		const v = e.target.closest('[data-ver]');
		if (v) { ver(cont, Number(v.dataset.ver)); }
		const c = e.target.closest('[data-cancelar]');
		if (c) { cancelar(cont, sesion, Number(c.dataset.cancelar)); }
	});
}

async function ver(cont, id) {
	try {
		const items = await api('pedidos.php?op=detalle&id=' + id);
		const dlg = cont.querySelector('#mp_dlg');
		dlg.innerHTML = `
			<div class="xdlg-head"><h3>Pedido N° ${id}</h3></div>
			<div class="xdlg-body"><div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Producto</th><th style="text-align:right">Pediste</th><th style="text-align:right">Te envían</th></tr></thead>
				<tbody>${items.map(i => `<tr><td>${esc(i.descripcion)}</td>
					<td style="text-align:right">${num(i.cantidad_solicitada)} <span class="inv-muted">${esc(i.unidad_medida || 'und')}</span></td>
					<td style="text-align:right">${Number(i.cantidad_despachada) ? num(i.cantidad_despachada) : '<span class="inv-muted">—</span>'}</td></tr>`).join('')}</tbody>
			</table></div><div data-historia="pedido:${id}"></div></div>
			<div class="xdlg-foot"><button class="btn btn-sm btn-light" id="mp_cerrar"><i class="fa fa-times"></i>Cerrar</button></div>`;
		dlg.querySelector('#mp_cerrar').addEventListener('click', () => dlg.close());
		dlg.showModal();
		cargarHistorias(dlg);
	} catch (err) {
		aviso(err.message, 'error');
	}
}

async function cancelar(cont, sesion, id) {
	const ok = await confirmar({ titulo: `¿Cancelar el pedido N° ${id}?`, boton: 'Sí, cancelar pedido',
		textoHtml: '<p style="margin:0">La central ya no lo verá. Si necesitas esos productos, haz un pedido nuevo.</p>' });
	if (!ok) { return; }
	try {
		await api('pedidos.php?op=cancelar', { id });
		aviso(`Pedido N° ${id} cancelado.`);
		recargar();
	} catch (err) {
		aviso(err.message, 'error');
	}
}
