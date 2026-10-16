// Stock minimo sugerido (F7, central): por sede, minimo = lo que vende en N dias. Con un buen minimo, el pedido sugerido
// de la sede no la deja sin stock. Se revisa y se aplica con un boton (solo lo marcado).
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver, confirmar, leerNum } from '../ui.js?v=20261015i';
import { vigente } from '../router.js?v=20261015i';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });

export async function render(cont, sesion, t) {
	const cfg = await api('catalogo.php?op=config');
	if (!vigente(t)) { return; }
	if (!cfg.org) {   // Logistica aun no configurada: se explica en vez de un error tecnico
		cont.innerHTML = tarjeta({ titulo: 'Stock mínimo sugerido', acciones: volver(),
			cuerpo: '<p class="inv-empty"><i class="fa fa-cog"></i>Primero configura Logística (sede central y sedes que participan) en <a href="#" data-ir="config">Configurar</a>.</p>' });
		return;
	}
	const sedes = cfg.sedes.filter(s => Number(s.activo) === 1 && Number(s.idsede) !== Number(cfg.org.idsede_central));
	cont.innerHTML = tarjeta({
		titulo: 'Stock mínimo sugerido',
		ayuda: 'El mínimo es lo que la sede no debe dejar de tener. El sistema sugiere <b>lo que vende en 3 días</b>. '
			+ 'Con un buen mínimo, el pedido sugerido no la deja sin stock.',
		acciones: `${volver()}<button class="btn btn-sm btn-success" id="mn_aplicar" disabled><i class="fa fa-check"></i>Aplicar los marcados</button>`,
		cuerpo: `<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Sede</span><select class="inv-select" id="mn_sede">
					<option value="">— elige una sede —</option>${sedes.map(s => `<option value="${s.idsede}">${esc(s.nombre)}</option>`).join('')}</select></div>
				<span class="inv-sep"></span><p class="inv-ayuda" id="mn_res"></p></div>
			<div id="mn_lista"><p class="inv-empty"><i class="fa fa-hand-o-up"></i>Elige una sede.</p></div>`,
	});
	const lista = cont.querySelector('#mn_lista');
	let datos = null;
	let pedido = 0;   // al cambiar de sede rapido, solo vale la ultima respuesta
	const contar = () => {
		const n = lista.querySelectorAll('.mn-ok:checked').length;
		const b = cont.querySelector('#mn_aplicar');
		b.disabled = n === 0;
		b.innerHTML = `<i class="fa fa-check"></i>Aplicar los marcados${n ? ` (${n})` : ''}`;
	};
	cont.querySelector('#mn_sede').addEventListener('change', async e => {
		const s = Number(e.target.value);
		const n = ++pedido;
		datos = null;
		if (!s) { lista.innerHTML = '<p class="inv-empty"><i class="fa fa-hand-o-up"></i>Elige una sede.</p>'; contar(); return; }
		lista.innerHTML = '<p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Calculando…</p>';
		contar();
		let d;
		try { d = await api('resumen.php?op=minimos&idsede=' + s); } catch (err) { if (n === pedido) { lista.innerHTML = `<div class="lg-error">${esc(err.message)}</div>`; } return; }
		if (n !== pedido || !lista.isConnected) { return; }
		datos = d;
		const p = datos.productos;
		cont.querySelector('#mn_res').textContent = `${p.filter(x => x.sugerido !== x.minimo).length} producto(s) con un mínimo distinto al sugerido`;
		lista.innerHTML = p.length ? `<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th style="width:28px"></th><th>Producto</th><th style="text-align:right">Vende al día</th><th style="text-align:right">Mínimo actual</th><th>Nuevo mínimo</th></tr></thead>
			<tbody>${p.map((x, i) => `<tr>
				<td><input type="checkbox" class="mn-ok" data-i="${i}" ${x.sugerido !== x.minimo ? 'checked' : ''}></td>
				<td>${esc(x.descripcion)}<span class="inv-sub">${esc(x.familia)}</span></td>
				<td style="text-align:right">${x.por_dia ? num(x.por_dia) : '<span class="inv-muted">no se vende</span>'}</td>
				<td style="text-align:right">${num(x.minimo)} <span class="inv-muted">${esc(x.unidad || 'und')}</span></td>
				<td><input class="inv-input mn-val" data-i="${i}" type="number" min="0" step="any" style="width:90px" value="${x.sugerido}">
					${x.sugerido < x.minimo ? '<span class="inv-sub">Bajarlo libera stock parado</span>' : x.sugerido > x.minimo ? '<span class="inv-sub inv-neg">Hoy se puede quedar sin stock</span>' : ''}</td>
			</tr>`).join('')}</tbody></table></div>`
			: '<p class="inv-empty">Esta sede aún no tiene ventas registradas de productos del catálogo.</p>';
		contar();
	});
	lista.addEventListener('change', e => { if (e.target.closest('.mn-ok')) { contar(); } });
	lista.addEventListener('input', e => {
		const v = e.target.closest('.mn-val');
		if (v) { lista.querySelector(`.mn-ok[data-i="${v.dataset.i}"]`).checked = true; contar(); }
	});
	cont.querySelector('#mn_aplicar').addEventListener('click', async e => {
		const btn = e.currentTarget;
		const sel = [...lista.querySelectorAll('.mn-ok:checked')].map(c => {
			const i = Number(c.dataset.i);
			return { idproducto: datos.productos[i].idproducto, minimo: leerNum(lista.querySelector(`.mn-val[data-i="${i}"]`), true), nombre: datos.productos[i].descripcion };
		});
		const malo = sel.find(x => x.minimo === null || !(x.minimo >= 0));
		if (malo) { aviso(`El mínimo de ${malo.nombre} no es válido.`, 'error'); return; }
		const sede = cont.querySelector('#mn_sede').selectedOptions[0].textContent;
		const ok = await confirmar({ titulo: `¿Cambiar el mínimo de ${sel.length} producto(s) en ${sede}?`, peligro: false, boton: 'Sí, aplicar',
			textoHtml: '<p style="margin:0">Desde ahora el pedido sugerido de la sede usará estos mínimos.</p>' });
		if (!ok) { return; }
		btn.disabled = true;
		try {
			const r = await api('resumen.php?op=aplicar_minimos', { idsede: Number(cont.querySelector('#mn_sede').value), items: sel.map(({ idproducto, minimo }) => ({ idproducto, minimo })) });
			aviso(`Listo: ${r.actualizados} mínimo(s) actualizados en ${sede}.`);
			cont.querySelector('#mn_sede').dispatchEvent(new Event('change'));
		} catch (err) {
			aviso(err.message, 'error');
			btn.disabled = false;
		}
	});
}
