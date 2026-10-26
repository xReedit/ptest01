// Repartir a las sedes (sin que lo pidan), pensado para cadenas grandes (47 sedes):
//   1. marcas las sedes (lista con buscador)   2. agregas productos   3. tabla: una FILA por producto, una COLUMNA por sede
//   ("A todas" llena la fila; "copiar a las demas" repite una sede)   4. OK -> Envios. Cada sede puede llevar distinto.
// Despues se puede usar la misma orden para otras sedes. Cada sede lo cuenta en "Recibir mercaderia" y sube su stock.
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, autocompletar, nuevoToken, leerNum } from '../ui.js?v=20261026a';
import { vigente, turnoActual } from '../router.js?v=20261026a';

const num = n => Number(Number(n || 0).toFixed(3)).toLocaleString('es-PE', { maximumFractionDigits: 3 });
const sinTildes = t => String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let origenElegido = 0;

export async function render(cont, sesion, t) {
	const d = await api('repartir.php?op=inicio' + (origenElegido ? '&origen=' + origenElegido : ''));
	if (t !== undefined && !vigente(t)) { return; }
	// estado: sedes marcadas y productos {c, descripcion, unidad, libre, tiene:{idsede}, cant:{idsede}, molde}
	const st = { origen: d.origen, marcadas: new Set(), filas: [], token: nuevoToken('rp') };
	const ops = d.productos.map(p => ({ texto: `${p.descripcion} · hay ${num(p.stock)} ${p.unidad || 'und'}`, valor: String(p.c) }));
	cont.innerHTML = tarjeta({
		titulo: 'Repartir a las sedes',
		ayuda: 'Manda productos a las sedes <b>sin esperar que pidan</b>. Pasa a <b>Envíos</b>; cada sede lo cuenta en <b>Recibir mercadería</b> y sube su stock.',
		acciones: `${d.origenes.length > 1 ? `<select class="inv-select" id="rp_origen" style="width:auto" title="De dónde sale">${d.origenes.map(o =>
			`<option value="${o.idsede}" ${o.idsede === d.origen ? 'selected' : ''}>Sale de ${esc(o.nombre)}</option>`).join('')}</select>` : ''}${volver()}`,
		cuerpo: `<p class="rp-paso"><b>1.</b> ¿A qué sedes? <span class="inv-ayuda" id="rp_cuenta"></span></p>
			<div class="rp-pick">
				<input class="inv-input" id="rp_buscar" placeholder="Buscar sede" style="width:220px">
				<span class="inv-link" id="rp_todas">Marcar todas</span><span class="inv-link" id="rp_ninguna">Ninguna</span></div>
			<div class="rp-lista" id="rp_sedes">${d.sedes.map(z => `<label class="rp-sede" data-n="${esc(sinTildes(z.nombre))}"><input type="checkbox" value="${z.idsede}"> ${esc(z.nombre)}</label>`).join('')}</div>
			<p class="rp-paso"><b>2.</b> Agrega los productos</p>
			<input class="inv-input" id="rp_prod" style="width:100%;max-width:520px" placeholder="Escribe el producto (solo lo que hay en el almacén)">
			<div id="rp_tabla"></div>
			<div id="rp_listo"></div>`,
	});
	const $ = s => cont.querySelector(s);
	const sel = $('#rp_origen');
	if (sel) { sel.addEventListener('change', () => { origenElegido = Number(sel.value); render(cont, sesion, turnoActual()).catch(err => aviso(err.message, 'error')); }); }
	const marcadas = () => d.sedes.filter(z => st.marcadas.has(z.idsede));
	const totalProd = f => marcadas().reduce((t, z) => t + (f.tiene[z.idsede] ? Number(f.cant[z.idsede]) || 0 : 0), 0);
	const fila = c => st.filas.find(f => f.c === Number(c));
	const cuenta = () => { $('#rp_cuenta').textContent = `${st.marcadas.size} de ${d.sedes.length} marcadas`; };
	const marcar = (id, si) => {
		if (si) {
			st.marcadas.add(id);
			st.filas.forEach(f => { if (f.molde && f.tiene[id] && !f.cant[id]) { f.cant[id] = f.molde; } });   // orden copiada
		} else { st.marcadas.delete(id); }
	};
	const desmarcar = () => { st.marcadas.clear(); cont.querySelectorAll('#rp_sedes input').forEach(i => { i.checked = false; }); cuenta(); };

	function pintarTabla() {
		const ss = marcadas(), ps = st.filas;
		if (!ps.length) { $('#rp_tabla').innerHTML = ''; return; }
		if (!ss.length) {
			$('#rp_tabla').innerHTML = `<p class="inv-ayuda" style="margin-top:10px"><i class="fa fa-hand-o-up"></i> Marca arriba a qué sedes va.
				Productos: ${ps.map(f => `<b>${esc(f.descripcion)}</b>`).join(', ')}</p>`;
			return;
		}
		$('#rp_tabla').innerHTML = `<p class="rp-paso"><b>3.</b> ¿Cuánto va a cada sede?</p>
			<div class="inv-table-wrap rp-wrap"><table class="inv-table rp-tabla"><thead><tr>
				<th>Producto</th><th class="rp-col">A todas <span class="inv-muted" style="font-weight:400">(llena la fila)</span></th>
				${ss.map(z => `<th class="rp-col">${esc(z.nombre)}${ss.length > 1 ? `<span class="inv-link rp-copiar" data-copiar="${z.idsede}" title="Poner estas mismas cantidades en las demás sedes"><i class="fa fa-files-o"></i>copiar a las demás</span>` : ''}</th>`).join('')}
				<th class="rp-col">Total</th></tr></thead>
				<tbody>${ps.map(f => `<tr>
					<td><b>${esc(f.descripcion)}</b> <span class="inv-link inv-link-rojo" data-quitar="${f.c}" title="Quitar producto"><i class="fa fa-times"></i></span>
						<span class="inv-sub" title="Lo que hay en el almacén menos lo que ya espera salir por pedidos o repartos">hay ${num(f.libre)} ${esc(f.unidad || 'und')} disponibles</span></td>
					<td class="rp-col rp-fila-todas"><input class="inv-input rp-todas" data-c="${f.c}" type="number" min="0" step="any" inputmode="decimal" style="width:70px" placeholder="—">
						<span class="inv-link" data-parejo="${f.c}" title="Repartir lo disponible en partes iguales"><i class="fa fa-balance-scale"></i></span></td>
					${ss.map(z => `<td class="rp-col">${f.tiene[z.idsede]
						? `<input class="inv-input rp-cant" data-c="${f.c}" data-s="${z.idsede}" type="number" min="0" step="any" inputmode="decimal" style="width:75px" value="${esc(f.cant[z.idsede] || '')}">`
						: '<span class="inv-sub inv-neg" title="Esa sede no tiene este producto en su catálogo">no lo tiene</span>'}</td>`).join('')}
					<td class="rp-col rp-total" data-c="${f.c}"></td></tr>`).join('')}
				</tbody></table></div>
			<p style="margin:10px 0 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
				<span class="inv-ayuda" id="rp_resumen"></span>
				<button class="btn btn-sm btn-success" id="rp_ok"><i class="fa fa-check"></i>OK, mandar a Envíos</button></p>`;
		totales();
	}

	function totales() {
		let pasa = 0, con = 0;
		st.filas.forEach(f => {
			const td = cont.querySelector(`.rp-total[data-c="${f.c}"]`);
			if (!td) { return; }
			const t = totalProd(f), mal = t > f.libre + 0.0001;
			if (mal) { pasa++; }
			if (t > 0) { con++; }
			td.innerHTML = t ? `<b class="${mal ? 'inv-neg' : ''}">${num(t)}</b>${mal ? `<span class="inv-sub inv-neg">faltan ${num(t - f.libre)} (hay ${num(f.libre)})</span>` : ''}` : '<span class="inv-muted">—</span>';
		});
		$('#rp_resumen').innerHTML = `<b>${con}</b> de ${st.filas.length} producto(s) con cantidad · ${marcadas().length} sede(s)${pasa ? ` · <b class="inv-neg">${pasa === 1 ? '1 producto pide' : pasa + ' productos piden'} más de lo que hay: baja las cantidades</b>` : ''}`;
	}

	async function agregar(c, molde) {
		if (fila(c)) { aviso('Ese producto ya está en la lista.', 'error'); return; }
		let x;
		try { x = await api(`repartir.php?op=info&origen=${st.origen}&c=${c}`); } catch (err) { aviso(err.message, 'error'); return; }
		if (!cont.isConnected) { return; }
		if (!(x.libre > 0)) { aviso(`De ${x.producto} no queda nada disponible: todo ya espera salir por pedidos o repartos.`, 'error'); return; }
		const tiene = Object.fromEntries(x.sedes.map(z => [z.idsede, z.tiene]));
		const cant = molde ? Object.fromEntries([...st.marcadas].filter(id => tiene[id]).map(id => [id, molde])) : {};
		st.filas = [...st.filas, { c, descripcion: x.producto, unidad: x.unidad, libre: x.libre, cant, molde: molde || '', tiene }];
		pintarTabla();
	}

	// 1. sedes: buscar, marcar todas (las que se ven) / ninguna
	$('#rp_buscar').addEventListener('input', e => {
		const q = sinTildes(e.target.value.trim());
		cont.querySelectorAll('#rp_sedes .rp-sede').forEach(l => { l.hidden = q !== '' && !l.dataset.n.includes(q); });
	});
	$('#rp_sedes').addEventListener('change', e => { marcar(Number(e.target.value), e.target.checked); cuenta(); pintarTabla(); });
	$('#rp_todas').addEventListener('click', () => {
		cont.querySelectorAll('#rp_sedes .rp-sede:not([hidden]) input').forEach(i => { i.checked = true; marcar(Number(i.value), true); });
		cuenta(); pintarTabla();
	});
	$('#rp_ninguna').addEventListener('click', () => { desmarcar(); pintarTabla(); });
	cuenta();
	// 2. productos
	const inp = $('#rp_prod');
	autocompletar(inp, ops);
	inp.addEventListener('input', () => {
		const o = ops.find(x => x.texto === inp.value);
		if (o) { inp.value = ''; agregar(Number(o.valor)); }
	});
	// 3. cantidades, "a todas", parejo, quitar, OK
	$('#rp_tabla').addEventListener('input', e => {
		const i = e.target.closest('.rp-cant');
		if (i) { fila(i.dataset.c).cant[Number(i.dataset.s)] = i.value; totales(); }
	});
	$('#rp_tabla').addEventListener('change', e => {
		const a = e.target.closest('.rp-todas');
		if (!a || a.value === '') { return; }
		const f = fila(a.dataset.c);
		marcadas().forEach(z => { if (f.tiene[z.idsede]) { f.cant[z.idsede] = a.value; } });
		pintarTabla();
	});
	$('#rp_tabla').addEventListener('click', e => {
		const cp = e.target.closest('[data-copiar]');
		if (cp) {
			const de = Number(cp.dataset.copiar);
			st.filas.forEach(f => marcadas().forEach(z => { if (z.idsede !== de && f.tiene[z.idsede]) { f.cant[z.idsede] = f.cant[de] || ''; } }));
			pintarTabla();
			aviso(`Copiado: las demás sedes llevan lo mismo que ${d.sedes.find(z => z.idsede === de).nombre}.`);
			return;
		}
		const pj = e.target.closest('[data-parejo]');
		if (pj) {
			const f = fila(pj.dataset.parejo), ss = marcadas().filter(z => f.tiene[z.idsede]);
			const parte = ss.length ? Math.floor(f.libre / ss.length * 100) / 100 : 0;   // dos decimales, sin pasarse
			ss.forEach(z => { f.cant[z.idsede] = parte || ''; });
			pintarTabla();
			return;
		}
		const q = e.target.closest('[data-quitar]');
		if (q) { st.filas = st.filas.filter(f => f.c !== Number(q.dataset.quitar)); pintarTabla(); return; }
		const ok = e.target.closest('#rp_ok');
		if (ok) { enviar(ok); }
	});

	async function enviar(btn) {
		const productos = [];
		for (const f of st.filas) {
			const items = [];
			for (const z of marcadas()) {
				const v = f.tiene[z.idsede] ? String(f.cant[z.idsede] || '').trim() : '';
				if (v === '') { continue; }
				const q = leerNum({ value: v });
				if (q === null || q < 0) { aviso(`Revisa la cantidad de ${f.descripcion} para ${z.nombre}.`, 'error'); return; }
				if (q > 0) { items.push({ idsede: z.idsede, cantidad: q }); }
			}
			if (totalProd(f) > f.libre + 0.0001) { aviso(`De ${f.descripcion} solo hay ${num(f.libre)} disponibles y repartes ${num(totalProd(f))}. Baja las cantidades.`, 'error'); return; }
			if (items.length) { productos.push({ idproducto_central: f.c, items }); }
		}
		if (!productos.length) { aviso('Pon al menos una cantidad.', 'error'); return; }
		btn.disabled = true;
		try {
			const r = await api('repartir.php?op=guardar_lote', { origen: st.origen, productos, token: st.token });
			const ss = marcadas(), base = ss[0], hechas = st.filas.map(f => ({ c: f.c, molde: base ? f.cant[base.idsede] : '' }));
			st.token = nuevoToken('rp');   // la proxima es otra orden
			st.filas = [];
			desmarcar();
			pintarTabla();
			aviso(`Listo: ${r.productos} producto(s) para ${r.sedes} sede(s) en Envíos.`);
			$('#rp_listo').innerHTML = `<div class="lg-mover" style="margin-top:14px">
				<p style="margin:0 0 6px"><b><i class="fa fa-check"></i> Ya está en Envíos:</b> ${r.productos} producto(s) para ${r.sedes} sede(s)${ss.length <= 6 ? ' (' + esc(ss.map(z => z.nombre).join(', ')) + ')' : ''}.</p>
				<button class="btn btn-sm btn-success" data-ir="envios"><i class="fa fa-truck"></i>Ir a Envíos y despachar</button>
				<button class="btn btn-sm btn-light" id="rp_otra"><i class="fa fa-files-o"></i>Usar la misma orden para otras sedes</button></div>`;
			// copiar la orden: mismos productos; cada sede que marques arranca con las cantidades que llevo la primera
			$('#rp_otra').addEventListener('click', async () => {
				$('#rp_listo').innerHTML = '';
				for (const h of hechas) { await agregar(h.c, h.molde); }   // vuelve a leer lo disponible (ya bajo con lo que mandaste)
				if (st.filas.length) { aviso(`Marca las sedes: cada una arranca con las cantidades de ${base ? base.nombre : 'la orden anterior'}.`); }
				else { aviso('Ya no queda nada disponible de esos productos para otra sede.', 'error'); }
			});
		} catch (err) { aviso(err.message, 'error'); btn.disabled = false; }
	}
	inp.focus();
}
