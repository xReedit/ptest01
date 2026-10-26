// Dialogo de producto del catalogo, en 3 partes con preguntas simples:
// 1. Datos del producto · 2. ¿Cómo lo compras? (presentaciones) · 3. ¿A quién se lo compras? (proveedor habitual).
// Un solo Guardar: crear/editar + presentaciones + proveedor van juntos en una transaccion del servidor.
import { api } from '../api.js?v=20261026a';
import { esc, aviso, autocompletar } from '../ui.js?v=20261026a';

const PRESENTACIONES_COMUNES = ['CAJA', 'PAQUETE', 'SACO', 'FARDO', 'DOCENA', 'BOLSA', 'BIDON', 'JABA', 'SIXPACK', 'BALDE', 'GALONERA'];

const norm = s => String(s ?? '').trim().toUpperCase();
const numero = f => Number(f).toString();   // 12.0000 -> "12"

/** 'CAJA|12.0000;SACO|50.0000' -> [{nombre, factor}] */
export function leerPresentaciones(txt) {
	return (txt || '').split(';').filter(Boolean).map(x => {
		const [nombre, factor] = x.split('|');
		return { nombre, factor: numero(factor) };
	});
}

function filaPresentacion(p, unidad) {
	return `
		<div class="lg-pres" style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">
			<input class="inv-input lg-pres-nombre" style="flex:1 1 140px;width:auto" maxlength="40" value="${esc(p.nombre)}" placeholder="Ej: CAJA">
			<span class="inv-ayuda">trae</span>
			<input class="inv-input lg-pres-factor" style="width:80px" type="number" min="0.01" step="any" inputmode="decimal" value="${esc(p.factor)}" placeholder="12">
			<span class="inv-ayuda lg-pres-und" style="min-width:70px">${esc(unidad)}</span>
			<button type="button" class="btn btn-sm btn-light lg-pres-quitar" title="Quitar"><i class="fa fa-trash-o" style="margin:0"></i></button>
		</div>`;
}

/**
 * @param {HTMLDialogElement} dlg
 * @param {object} datos respuesta de catalogo.php?op=listar (familias, unidades, proveedores)
 * @param {object|null} prod producto a editar, o null para nuevo
 * @param {function} alGuardar callback(respuesta, esNuevo)
 */
export function abrirForm(dlg, datos, prod, alGuardar) {
	const unidadDe = id => { const u = datos.unidades.find(x => Number(x.idunidad_medida) === Number(id)); return u ? u.unidad : ''; };
	const pres = prod ? leerPresentaciones(prod.presentaciones) : [];

	dlg.innerHTML = `
		<div class="xdlg-head">
			<h3>${prod ? 'Editar producto' : 'Nuevo producto'}</h3>
			<p>${prod ? 'Los cambios se aplican también en todas las sedes. El precio y el stock de cada sede no cambian.' : 'Se creará también en todas las sedes que participan.'}</p>
		</div>
		<div class="xdlg-body">
			<p class="inv-titulo-sec" style="margin-top:0"><i class="fa fa-tag"></i> 1. Datos del producto</p>
			<div class="inv-form-row"><div class="inv-field"><span class="inv-label">Nombre</span><input class="inv-input inv-w100" id="f_desc" maxlength="150" value="${esc(prod ? prod.descripcion : '')}" placeholder="Ej: INCA KOLA 500ML"></div></div>
			<div class="inv-form-row"><div class="inv-field"><span class="inv-label">Familia</span><input class="inv-input inv-w100" id="f_fam" maxlength="80" value="${esc(prod ? prod.familia : '')}" placeholder="Escribe o elige: BEBIDAS, ABARROTES…"></div>
				<span class="inv-sub" id="f_fam_nota"></span></div>
			<div class="inv-form-row"><div class="inv-field"><span class="inv-label">¿En qué unidad se cuenta en el almacén?</span><input class="inv-input inv-w100" id="f_und" maxlength="50" value="${esc(prod ? unidadDe(prod.idunidad_kardex) : '')}" placeholder="Vacío = por unidad (botella, lata, pieza). Ej: KILOGRAMOS, LITROS"></div>
				<span class="inv-sub" id="f_und_nota"></span></div>
			<div class="inv-form-row"><div class="inv-field"><span class="inv-label">Precio de venta (S/)</span><input class="inv-input" id="f_precio" type="number" min="0" step="0.01" inputmode="decimal" style="width:140px"
					value="${esc(prod ? Number(prod.precio_venta || 0) : '')}" placeholder="0.00"></div>
				<span class="inv-sub">Es el precio con el que llega a cada sede. Después cada sede puede cambiar el suyo.</span></div>
			<div class="inv-form-row"><div class="inv-field"><span class="inv-label">Código de barras (opcional)</span><input class="inv-input inv-w100" id="f_cod" maxlength="255" value="${esc(prod ? prod.codigo_barra : '')}"></div></div>

			<p class="inv-titulo-sec"><i class="fa fa-cube"></i> 2. ¿Cómo lo compras? <span class="inv-ayuda">(opcional)</span></p>
			<p class="inv-ayuda" style="margin:0 0 8px">Ej: <b>CAJA</b> que trae <b>12</b>. Así pides 5 cajas y el sistema sabe que son 60.</p>
			<div id="f_pres"></div>
			<button type="button" class="btn btn-sm btn-light" id="f_pres_add"><i class="fa fa-plus"></i>Agregar forma de compra</button>

			<p class="inv-titulo-sec"><i class="fa fa-truck"></i> 3. ¿A quién se lo compras? <span class="inv-ayuda">(opcional)</span></p>
			<div class="inv-form-row"><div class="inv-field"><span class="inv-label">Proveedor habitual</span><input class="inv-input inv-w100" id="f_prov" maxlength="150" value="${esc(prod ? prod.proveedor : '')}" placeholder="Escribe o elige el proveedor"></div>
				<span class="inv-sub" id="f_prov_nota"></span></div>

			<p class="inv-ayuda" style="margin:12px 0 0"><i class="fa fa-pie-chart"></i> ¿En las sedes se vende por porciones (ej. 1 bote = 20 porciones)?
				Se configura en <b>Catálogo → Porciones</b>.${prod && prod.porciones ? ` Este producto rinde <b>${numero(prod.porciones)}</b> porciones.` : ''}</p>
		</div>
		<div class="xdlg-foot">
			<button class="btn btn-sm btn-light" id="f_cancelar"><i class="fa fa-times"></i>Cancelar</button>
			<button class="btn btn-sm btn-success" id="f_guardar"><i class="fa fa-check"></i>Guardar</button>
		</div>`;

	const $ = sel => dlg.querySelector(sel);
	const fam = $('#f_fam'), und = $('#f_und'), prov = $('#f_prov'), cajaPres = $('#f_pres');
	const unidadTexto = () => (und.value.trim() || 'unidades').toLowerCase();

	// presentaciones: filas editables; la unidad mostrada sigue a lo que se escriba en "unidad"
	const agregarFila = p => {
		cajaPres.insertAdjacentHTML('beforeend', filaPresentacion(p, unidadTexto()));
		autocompletar(cajaPres.lastElementChild.querySelector('.lg-pres-nombre'), PRESENTACIONES_COMUNES);
	};
	pres.forEach(agregarFila);
	$('#f_pres_add').addEventListener('click', () => { agregarFila({ nombre: '', factor: '' }); cajaPres.lastElementChild.querySelector('input').focus(); });
	cajaPres.addEventListener('click', e => { const b = e.target.closest('.lg-pres-quitar'); if (b) { b.closest('.lg-pres').remove(); } });

	// aviso en vivo: "ya existe, se usará" / "nuevo, se creará"
	const nota = (inp, out, lista, vacio) => {
		const v = norm(inp.value);
		out.textContent = !v ? vacio : (lista.some(x => norm(x) === v) ? '✓ Ya existe: se usará ese.' : 'Nuevo: se creará al guardar.');
	};
	const nombresUnd = datos.unidades.flatMap(u => [u.unidad, u.abreviatura]).concat(['UND', 'UNIDAD', 'PIEZA']);
	const notas = () => {
		nota(fam, $('#f_fam_nota'), datos.familias, '');
		nota(und, $('#f_und_nota'), nombresUnd, 'Se contará por unidad.');
		nota(prov, $('#f_prov_nota'), datos.proveedores, '');
		cajaPres.querySelectorAll('.lg-pres-und').forEach(s => { s.textContent = unidadTexto(); });
	};
	autocompletar(fam, datos.familias);
	autocompletar(und, datos.unidades.map(u => u.unidad));
	autocompletar(prov, datos.proveedores);
	[fam, und, prov].forEach(i => i.addEventListener('input', notas));
	notas();

	$('#f_cancelar').addEventListener('click', () => dlg.close());
	$('#f_guardar').addEventListener('click', async e => {
		const btn = e.currentTarget;
		const presentaciones = [...cajaPres.querySelectorAll('.lg-pres')]
			.map(f => ({ nombre: f.querySelector('.lg-pres-nombre').value, factor: Number(f.querySelector('.lg-pres-factor').value) }))
			.filter(p => p.nombre.trim() !== '');
		const sinCantidad = presentaciones.find(p => !(p.factor > 0));
		if (sinCantidad) { aviso(`Indica cuántas ${unidadTexto()} trae ${norm(sinCantidad.nombre)}.`, 'error'); return; }
		const body = {
			idproducto: prod ? Number(prod.idproducto) : undefined,
			descripcion: $('#f_desc').value,
			familia: fam.value,
			unidad: und.value,
			codigo_barra: $('#f_cod').value,
			precio_venta: $('#f_precio').value,
			presentaciones,
			proveedor: prov.value,
		};
		btn.disabled = true;
		try {
			const r = await api('catalogo.php?op=' + (prod ? 'editar' : 'crear'), body);
			dlg.close();
			alGuardar(r, !prod);
		} catch (err) {
			aviso(err.message, 'error');
		} finally {
			btn.disabled = false;
		}
	});
	dlg.showModal();
}
