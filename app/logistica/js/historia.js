// Linea de tiempo de cualquier proceso (pedido, envio, orden de compra, conteo): quien hizo que y cuando.
// Uso: poner <div data-historia="pedido:58"></div> (o traslado/oc/conteo) y llamar cargarHistorias(contenedor).
// Dentro de un <details> cerrado se carga recien al abrirlo.
import { api } from './api.js?v=20261015i';
import { esc } from './ui.js?v=20261015i';

const ICONO = { pedido: 'fa-shopping-basket', visto: 'fa-eye', bandeja: 'fa-inbox', creada: 'fa-file-text-o', aprobada: 'fa-check',
	precio: 'fa-tag', volvio: 'fa-undo', enviada: 'fa-paper-plane', recepcion: 'fa-truck', anulada: 'fa-ban', cerrada: 'fa-lock',
	despacho: 'fa-cube', camino: 'fa-road', aviso: 'fa-whatsapp', entrega: 'fa-map-marker', recibido: 'fa-check-circle', diferencia: 'fa-exclamation-triangle' };

const quienFecha = x => `${x.quien ? ` · <span class="lg-tl-quien"><i class="fa fa-user"></i>${esc(x.quien)}</span>` : ''}${x.fecha ? `<span class="inv-muted"> · ${esc(x.fecha)}</span>` : ''}`;
const ico = t => `<span class="lg-tl-ico"><i class="fa ${ICONO[t] || 'fa-circle'}"></i></span>`;

export function lineaTiempo(h, titulo = 'Historia') {
	if (!h.length) { return ''; }
	// eventos seguidos del mismo tipo (ej. varios cambios de precio) van juntos en un acordeon
	const grupos = [];
	h.forEach(x => { const g = grupos[grupos.length - 1]; g && g[0].tipo === x.tipo ? g.push(x) : grupos.push([x]); });
	return `<h4 class="lg-tl-tit"><i class="fa fa-history"></i>${esc(titulo)}</h4>
		<ol class="lg-tl">${grupos.map(g => {
			const x = g[g.length - 1];
			if (g.length === 1) {
				return `<li class="lg-tl-${esc(x.tipo)}">${ico(x.tipo)}
					<div><b>${esc(x.titulo)}</b>${quienFecha(x)}${x.detalle ? `<div class="inv-muted">${esc(x.detalle)}</div>` : ''}</div></li>`;
			}
			return `<li class="lg-tl-${esc(x.tipo)}">${ico(x.tipo)}
				<details class="lg-tl-grupo"><summary><b>${esc(x.titulo)}</b> <span class="lg-tl-n">${g.length} veces</span>${quienFecha(x)}
					<i class="fa fa-chevron-down"></i></summary>
					<ul>${g.map(y => `<li>${y.detalle ? esc(y.detalle) : esc(y.titulo)}<span class="inv-muted">${quienFecha(y)}</span></li>`).join('')}</ul>
				</details></li>`;
		}).join('')}
		</ol>`;
}

const TITULO = { pedido: 'Historia del pedido', traslado: 'Historia del envío', oc: 'Historia de la orden', conteo: 'Historia del conteo' };

export function cargarHistorias(raiz) {
	raiz.querySelectorAll('[data-historia]:not([data-cargada])').forEach(async el => {
		const det = el.closest('details');
		if (det && !det.open) { return; }
		el.dataset.cargada = '1';
		const [tipo, id] = el.dataset.historia.split(':');
		el.innerHTML = '<p class="inv-muted" style="margin:12px 0 0"><i class="fa fa-spinner fa-spin"></i> Cargando historia…</p>';
		try {
			const h = await api(`historia.php?op=${tipo}&id=${Number(id)}`);
			el.innerHTML = lineaTiempo(h, TITULO[tipo]);
		} catch (err) {
			el.innerHTML = `<p class="inv-muted" style="margin:12px 0 0"><i class="fa fa-exclamation-circle"></i> No se pudo cargar la historia: ${esc(err.message)}</p>`;
		}
	});
}

// <details> con historia adentro: carga al abrir
document.addEventListener('toggle', e => { if (e.target.open && e.target.querySelector('[data-historia]')) { cargarHistorias(e.target); } }, true);
