// "Productos de las sedes": productos que una sede creo por su cuenta (no vienen del catalogo central).
// Por cada uno, dos acciones claras: "Es el mismo que…" (vincular) o "Agregar al catálogo".
// Si no se hace nada, sigue siendo un producto solo de esa sede.
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta, volver, autocompletar, confirmar, paginador } from '../ui.js?v=20261015i';
import { vigente } from '../router.js?v=20261015i';

// elegidos: { idproducto: {valor, texto} } lo que el usuario eligio en "es el mismo que" (sobrevive al buscar)
let estado = { sedes: [], idsede: 0, productos: [], central: [], elegidos: {}, pagina: 1 };
const POR_PAGINA = 50;

export async function render(cont, sesion, t) {
	const sedes = await api('vincular.php?op=sedes');
	if (!vigente(t)) { return; }
	estado = { sedes, idsede: 0, productos: [], central: [], elegidos: {}, pagina: 1 };
	cont.innerHTML = tarjeta({
		titulo: 'Productos de las sedes',
		ayuda: 'Productos que cada sede creó por su cuenta. Dile al sistema si <b>es el mismo</b> que uno del catálogo, '
			+ 'o <b>agrégalo al catálogo</b> para todas las sedes. Si no haces nada, sigue siendo solo de esa sede.',
		acciones: volver(),
		cuerpo: `
			<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Sede</span><select class="inv-select" id="ps_sede">
					<option value="0">— elige una sede —</option>
					${sedes.map(s => `<option value="${s.idsede}">${esc(s.nombre)} (${s.pendientes})</option>`).join('')}
				</select></div>
				<div class="inv-field"><span class="inv-label">Buscar</span><input class="inv-input" id="ps_q" placeholder="Producto de la sede"></div>
				<span class="inv-sep"></span>
				<p class="inv-ayuda" id="ps_resumen"></p>
				<button class="btn btn-sm btn-success" id="ps_todos" disabled title="Vincula de una vez todas las filas donde ya elegiste el producto del catálogo">
					<i class="fa fa-link"></i>Vincular los elegidos (0)</button>
			</div>
			<div id="ps_lista"><p class="inv-empty"><i class="fa fa-hand-o-up"></i>Elige una sede para ver sus productos.</p></div>`,
	});
	if (!sedes.length) {
		cont.querySelector('#ps_lista').innerHTML = '<p class="inv-empty"><i class="fa fa-info-circle"></i>No hay sedes participando. Actívalas en Configurar.</p>';
		return;
	}
	cont.querySelector('#ps_sede').addEventListener('change', e => cargar(cont, Number(e.target.value)));
	cont.querySelector('#ps_q').addEventListener('input', () => { estado = { ...estado, pagina: 1 }; pintar(cont); });
	cont.querySelector('#ps_todos').addEventListener('click', e => vincularTodos(cont, e.currentTarget));
	const lista = cont.querySelector('#ps_lista');
	// recordar lo elegido en cada fila (dataset.valor lo pone autocompletar al elegir; escribir lo borra)
	lista.addEventListener('input', e => {
		const inp = e.target.closest('.ps-mismo');
		if (!inp) { return; }
		const id = inp.closest('tr').dataset.fila;
		const elegidos = { ...estado.elegidos };
		if (inp.dataset.valor) { elegidos[id] = { valor: inp.dataset.valor, texto: inp.value }; } else { delete elegidos[id]; }
		estado = { ...estado, elegidos };
		contarElegidos(cont);
	});
	// autocompletar recien al enfocar: con 500 filas no se crean 500 listas de golpe
	lista.addEventListener('focusin', e => {
		const inp = e.target.closest('.ps-mismo');
		if (inp && !inp.dataset.ac) {
			inp.dataset.ac = '1';
			autocompletar(inp, estado.central.map(c => ({ texto: c.familia ? `${c.descripcion} · ${c.familia}` : c.descripcion, valor: String(c.idproducto) })));
			inp.dispatchEvent(new Event('focus'));
		}
	});
	lista.addEventListener('click', e => {
		const pg = e.target.closest('[data-pag]');
		if (pg) { estado = { ...estado, pagina: Number(pg.dataset.pag) }; pintar(cont); cont.scrollIntoView({ block: 'start' }); return; }
		const v = e.target.closest('[data-vincular]');
		if (v) { vincular(cont, Number(v.dataset.vincular), v); }
		const a = e.target.closest('[data-agregar]');
		if (a) { agregar(cont, Number(a.dataset.agregar), a); }
	});
}

async function cargar(cont, idsede) {
	const lista = cont.querySelector('#ps_lista');
	if (!idsede) { lista.innerHTML = '<p class="inv-empty"><i class="fa fa-hand-o-up"></i>Elige una sede para ver sus productos.</p>'; return; }
	lista.innerHTML = '<p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p>';
	try {
		const r = await api('vincular.php?op=pendientes&idsede=' + idsede);
		estado = { ...estado, idsede, productos: r.productos, central: r.central, elegidos: {}, pagina: 1 };
		pintar(cont);
	} catch (e) {
		lista.innerHTML = `<div class="lg-error">${esc(e.message)}</div>`;
	}
}

function pintar(cont) {
	const q = cont.querySelector('#ps_q').value.trim().toUpperCase();
	const todas = estado.productos.filter(p => !q || p.descripcion.toUpperCase().includes(q));
	const paginas = Math.max(1, Math.ceil(todas.length / POR_PAGINA));
	const pag = Math.min(estado.pagina, paginas);
	const filas = todas.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
	cont.querySelector('#ps_resumen').textContent = estado.idsede ? `${estado.productos.length} productos solo de esta sede` : '';
	cont.querySelector('#ps_lista').innerHTML = filas.length ? `
		<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>Producto de la sede</th><th>¿Es el mismo que uno del catálogo?</th><th>¿O es nuevo?</th></tr></thead>
			<tbody>${filas.map(p => `
				<tr data-fila="${p.idproducto}">
					<td>${esc(p.descripcion)}<span class="inv-sub">${esc(p.familia || 'sin familia')}${p.unidad ? ' · ' + esc(p.unidad) : ''}</span></td>
					<td style="min-width:320px"><div style="display:flex;gap:6px">
						<input class="inv-input ps-mismo" style="flex:1;width:auto" placeholder="Escribe y elige del catálogo…"
							value="${esc(estado.elegidos[p.idproducto] ? estado.elegidos[p.idproducto].texto : '')}"
							${estado.elegidos[p.idproducto] ? `data-valor="${esc(estado.elegidos[p.idproducto].valor)}"` : ''}>
						<button class="btn btn-sm btn-light" data-vincular="${p.idproducto}"><i class="fa fa-link"></i>Vincular</button>
					</div></td>
					<td><button class="btn btn-sm btn-light" data-agregar="${p.idproducto}"><i class="fa fa-plus"></i>Agregar al catálogo</button></td>
				</tr>`).join('')}
			</tbody>
		</table></div>
		${paginador({ pagina: pag, paginas, total: todas.length })}`
		: `<p class="inv-empty"><i class="fa fa-check-circle"></i>${estado.productos.length ? 'Ningún producto coincide con la búsqueda.' : 'Esta sede no tiene productos pendientes: todo viene del catálogo.'}</p>`;
}

function contarElegidos(cont) {
	const n = Object.keys(estado.elegidos).length;
	const b = cont.querySelector('#ps_todos');
	b.disabled = n === 0;
	b.innerHTML = `<i class="fa fa-link"></i>Vincular los elegidos (${n})`;
}

function quitarFila(cont, idproducto) {
	const elegidos = { ...estado.elegidos };
	delete elegidos[idproducto];
	estado = { ...estado, elegidos, productos: estado.productos.filter(p => Number(p.idproducto) !== idproducto) };
	contarElegidos(cont);
	const opt = cont.querySelector(`#ps_sede option[value="${estado.idsede}"]`);
	const s = estado.sedes.find(x => Number(x.idsede) === estado.idsede);
	if (opt && s) { opt.textContent = `${s.nombre} (${estado.productos.length})`; }
	pintar(cont);
}

async function vincular(cont, idproducto, btn) {
	const inp = btn.closest('tr').querySelector('.ps-mismo');
	const idcentral = Number(inp.dataset.valor || 0);   // solo vale lo elegido de la lista
	if (!idcentral) { aviso('Escribe y elige de la lista el producto del catálogo.', 'error'); inp.focus(); return; }
	const prod = estado.productos.find(p => Number(p.idproducto) === idproducto);
	const central = estado.central.find(c => Number(c.idproducto) === idcentral);
	const ok = await confirmar({
		titulo: '¿Vincular estos productos?',
		peligro: false,
		boton: 'Sí, vincular',
		textoHtml: `<p style="margin:0 0 8px">En la sede, <b>${esc(prod.descripcion)}</b> pasará a llamarse
			<b>${esc(central.descripcion)}</b> y desde ahora lo administra la central.</p>
			<p class="inv-ayuda" style="margin:0">Su precio, stock y ventas de la sede no cambian.</p>`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	try {
		await api('vincular.php?op=vincular', { idproducto, idproducto_central: idcentral });
		estado = { ...estado, central: estado.central.filter(c => Number(c.idproducto) !== idcentral) };
		aviso(`Vinculado a ${central.descripcion}.`);
		quitarFila(cont, idproducto);
	} catch (err) {
		aviso(err.message, 'error');
		btn.disabled = false;
	}
}

async function agregar(cont, idproducto, btn) {
	const prod = estado.productos.find(p => Number(p.idproducto) === idproducto);
	const ok = await confirmar({
		titulo: '¿Agregar al catálogo?',
		peligro: false,
		boton: 'Sí, agregar',
		textoHtml: `<p style="margin:0 0 8px"><b>${esc(prod.descripcion)}</b> pasará al catálogo de la central y se enviará a todas las sedes que participan.</p>
			<p class="inv-ayuda" style="margin:0">Revisa antes que no exista ya con otro nombre (por ejemplo "COCA COLA" y "COCACOLA"): en ese caso usa <b>Vincular</b>.</p>`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	try {
		const r = await api('vincular.php?op=agregar', { idproducto });
		aviso(`Agregado al catálogo y enviado a ${r.creado} sede(s) más.` + (r.conflicto.length ? ` ${r.conflicto.length} sede(s) ya tenían uno con ese nombre: vincúlalo ahí.` : ''));
		quitarFila(cont, idproducto);
	} catch (err) {
		aviso(err.message, 'error');
		btn.disabled = false;
	}
}

async function vincularTodos(cont, btn) {
	const pares = Object.entries(estado.elegidos).map(([id, e]) => ({ idproducto: Number(id), idproducto_central: Number(e.valor) }));
	if (!pares.length) { return; }
	const nombre = id => (estado.productos.find(p => Number(p.idproducto) === id) || {}).descripcion || '';
	const ok = await confirmar({
		titulo: `¿Vincular ${pares.length} productos?`,
		peligro: false,
		boton: `Sí, vincular ${pares.length}`,
		textoHtml: `<p style="margin:0 0 8px">Cada producto de la sede tomará el nombre del catálogo y lo administrará la central.
				Su precio, stock y ventas no cambian.</p>
			<div class="inv-table-wrap" style="max-height:260px;overflow:auto"><table class="inv-table">
				<thead><tr><th>En la sede</th><th>Pasa a ser</th></tr></thead>
				<tbody>${pares.map(p => `<tr><td>${esc(nombre(p.idproducto))}</td><td>${esc(estado.elegidos[p.idproducto].texto)}</td></tr>`).join('')}</tbody>
			</table></div>`,
	});
	if (!ok) { return; }
	btn.disabled = true;
	try {
		const r = await api('vincular.php?op=vincular_varios', { pares });
		const usados = new Set(r.vinculados.map(v => v.idproducto_central));
		estado = { ...estado, central: estado.central.filter(c => !usados.has(Number(c.idproducto))) };
		r.vinculados.forEach(v => quitarFila(cont, v.idproducto));
		if (r.errores.length) {
			aviso(`${r.vinculados.length} vinculados. ${r.errores.length} no se pudieron: ` + r.errores.map(e => `${nombre(e.idproducto)} (${e.motivo})`).join('; '), 'error');
		} else {
			aviso(`${r.vinculados.length} productos vinculados.`);
		}
	} catch (err) {
		aviso(err.message, 'error');
	} finally {
		contarElegidos(cont);
	}
}
