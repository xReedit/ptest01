// Importar catalogo desde Excel (alta inicial de la cadena). Se lee en el navegador con SheetJS (misma version que
// x-producto-almacen) y se envia en lotes de 100 a catalogo.php?op=importar.
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver } from '../ui.js?v=20261026a';

const XLSX_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
const LOTE = 100;
// encabezado normalizado -> campo
const COLUMNAS = {
	nombre: 'descripcion', producto: 'descripcion', descripcion: 'descripcion',
	familia: 'familia', categoria: 'familia',
	unidad: 'unidad', und: 'unidad', 'unidad de medida': 'unidad',
	codigo: 'codigo_barra', 'codigo de barras': 'codigo_barra', codigo_barra: 'codigo_barra',
	precio: 'precio_venta', 'precio de venta': 'precio_venta', 'precio venta': 'precio_venta',
};

function cargarXlsx() {
	if (window.XLSX) { return Promise.resolve(window.XLSX); }
	return new Promise((ok, mal) => {
		const s = document.createElement('script');
		s.src = XLSX_URL;
		s.integrity = 'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw';   // SRI: si el CDN sirve otro archivo, el navegador no lo ejecuta
		s.crossOrigin = 'anonymous';
		s.onload = () => ok(window.XLSX);
		s.onerror = () => mal(new Error('No se pudo cargar el lector de Excel. Revisa tu internet.'));
		document.head.appendChild(s);
	});
}

const normal = t => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/** Devuelve [{fila, descripcion, familia, unidad, codigo_barra}] desde la primera hoja. */
function leerFilas(XLSX, buf) {
	const hoja = XLSX.read(buf, { type: 'array' });
	const aoa = XLSX.utils.sheet_to_json(hoja.Sheets[hoja.SheetNames[0]], { header: 1, defval: '' });
	if (aoa.length < 2) { return []; }
	const campos = aoa[0].map(h => COLUMNAS[normal(h)] || null);
	if (!campos.includes('descripcion')) { throw new Error('No encuentro la columna "nombre" en la primera fila.'); }
	return aoa.slice(1)
		.map((r, i) => {
			const o = { fila: i + 2 };
			campos.forEach((c, j) => { if (c) { o[c] = String(r[j] ?? '').trim(); } });
			return o;
		})
		.filter(o => o.descripcion || o.familia);
}

export async function render(cont) {
	cont.innerHTML = tarjeta({
		titulo: 'Importar productos desde Excel',
		ayuda: 'Columnas: <b>nombre</b>, <b>familia</b>, unidad (vacío = unidad/pieza; o kg, litros…), código de barras, precio. '
			+ 'Los que ya existen en el catálogo se saltan. Todo lo nuevo se envía también a las sedes.',
		acciones: `${volver('catalogo')}<button class="btn btn-sm btn-light" id="im_plantilla"><i class="fa fa-download"></i>Descargar plantilla</button>`,
		cuerpo: `
			<div class="inv-toolbar">
				<div class="inv-field"><span class="inv-label">Archivo</span><input type="file" id="im_file" accept=".xlsx,.xls,.csv" style="font-size:12px"></div>
			</div>
			<div id="im_vista"><p class="inv-empty"><i class="fa fa-file-excel-o"></i>Elige tu archivo de Excel para ver la vista previa.</p></div>`,
	});

	cont.querySelector('#im_plantilla').addEventListener('click', async () => {
		try {
			const XLSX = await cargarXlsx();
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
				['nombre', 'familia', 'unidad', 'codigo de barras', 'precio'],
				['INCA KOLA 500ML', 'BEBIDAS', '', '7750182001234', 3.5],
				['ARROZ COSTEÑO', 'ABARROTES', 'kg', '', 5.2],
			]), 'Productos');
			XLSX.writeFile(wb, 'plantilla_catalogo.xlsx');
		} catch (e) { aviso(e.message, 'error'); }
	});

	cont.querySelector('#im_file').addEventListener('change', async e => {
		const archivo = e.target.files[0];
		if (!archivo) { return; }
		const vista = cont.querySelector('#im_vista');
		try {
			const XLSX = await cargarXlsx();
			const filas = leerFilas(XLSX, await archivo.arrayBuffer());
			mostrarPrevia(vista, filas);
		} catch (err) {
			vista.innerHTML = `<div class="lg-error">${esc(err.message)}</div>`;
		}
	});
}

function mostrarPrevia(vista, filas) {
	const malas = filas.filter(f => !f.descripcion || !f.familia);
	vista.innerHTML = `
		<p class="inv-ayuda" style="margin-bottom:8px"><b>${filas.length}</b> productos en el archivo${malas.length ? `, <span class="inv-neg">${malas.length} sin nombre o familia (se saltarán)</span>` : ''}.</p>
		<div class="inv-table-wrap"><table class="inv-table">
			<thead><tr><th>Fila</th><th>Nombre</th><th>Familia</th><th class="lg-oc">Unidad</th><th class="lg-oc">Código</th></tr></thead>
			<tbody>${filas.slice(0, 15).map(f => `
				<tr ${!f.descripcion || !f.familia ? 'style="background:#fff7f7"' : ''}>
					<td>${f.fila}</td><td>${esc(f.descripcion)}</td><td>${esc(f.familia)}</td>
					<td class="lg-oc">${esc(f.unidad)}</td><td class="lg-oc">${esc(f.codigo_barra)}</td>
				</tr>`).join('')}</tbody>
		</table></div>
		${filas.length > 15 ? `<p class="inv-ayuda" style="margin-top:6px">… y ${filas.length - 15} más.</p>` : ''}
		<p style="margin-top:12px"><button class="btn btn-sm btn-success" id="im_ir" ${filas.length ? '' : 'disabled'}><i class="fa fa-upload"></i>Importar ${filas.length} productos</button>
			<span class="inv-ayuda" id="im_progreso" style="margin-left:8px"></span></p>
		<div id="im_resultado"></div>`;
	vista.querySelector('#im_ir').addEventListener('click', e => importar(vista, filas, e.currentTarget));
}

async function importar(vista, filas, btn) {
	btn.disabled = true;
	const prog = vista.querySelector('#im_progreso');
	const tot = { creados: 0, existentes: 0, enviados: 0, errores: [], conflicto: [] };
	try {
		for (let i = 0; i < filas.length; i += LOTE) {
			prog.textContent = `Importando ${Math.min(i + LOTE, filas.length)} de ${filas.length}…`;
			const lote = filas.slice(i, i + LOTE);
			const r = await api('catalogo.php?op=importar', { filas: lote });
			tot.creados += r.creados;
			tot.existentes += r.existentes;
			tot.enviados += r.replicado.creado;
			tot.errores.push(...r.errores);
			tot.conflicto.push(...r.replicado.conflicto);
		}
		prog.textContent = 'Listo.';
	} catch (err) {
		prog.textContent = '';
		aviso(`Se detuvo: ${err.message}. Lo ya importado quedó guardado; vuelve a subir el archivo para continuar.`, 'error');
	}
	vista.querySelector('#im_resultado').innerHTML = `
		<div class="inv-toolbar" style="display:block;margin-top:12px">
			<p style="margin:0"><i class="fa fa-check-circle inv-pos"></i> <b>${tot.creados}</b> productos nuevos · ${tot.existentes} ya existían · ${tot.enviados} copias creadas en las sedes.</p>
			${tot.errores.length ? `<p class="inv-neg" style="margin:6px 0 0">Con problemas (${tot.errores.length}):</p>
				<ul>${tot.errores.map(x => `<li>Fila ${x.fila}: ${esc(x.motivo)}</li>`).join('')}</ul>` : ''}
			${tot.conflicto.length ? `<p style="margin:6px 0 0">No enviados porque la sede ya tiene un producto con ese nombre (${tot.conflicto.length}): vincúlalos a mano.</p>` : ''}
		</div>`;
}
