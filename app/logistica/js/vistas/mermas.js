// Registrar merma (sede o central): lo que se rompio, vencio, malogro o consumio el personal. Baja el stock de tu
// almacen principal y queda con su valor para el reporte de perdidas. Debajo: lo registrado este mes.
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, autocompletar, leerNum, fecha } from '../ui.js?v=20261026a';
import { vigente, turnoActual } from '../router.js?v=20261026a';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const soles = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MOTIVO_TXT = { roto: 'Se rompió o derramó', vencido: 'Se venció', mal_estado: 'En mal estado / malogrado', consumo: 'Consumo del personal', otro: 'Otro (escribe qué pasó)' };

export async function render(cont, sesion, t) {
	const [d, m] = await Promise.all([api('mermas.php?op=productos'), api('mermas.php?op=mias')]);
	if (t !== undefined && !vigente(t)) { return; }
	const prods = new Map(d.productos.map(p => [String(p.idproducto), p]));
	cont.innerHTML = tarjeta({
		titulo: 'Registrar merma',
		ayuda: 'Anota aquí lo que se pierde. Se descuenta de tu almacén principal y la central ve cuánto se pierde y por qué.',
		acciones: sesion.rol_logistica === 'central' ? volver('perdidas') : volver(),
		cuerpo: `<div class="lg-merma-form">
				<div class="inv-form-row"><span class="inv-label">Producto</span>
					<input class="inv-input" id="mm_prod" placeholder="Escribe para buscar…" style="max-width:420px"><span class="inv-sub" id="mm_hay"></span></div>
				<div class="inv-form-row"><span class="inv-label">Cuánto se perdió</span>
					<input class="inv-input" id="mm_cant" type="number" min="0" step="any" inputmode="decimal" style="width:120px"> <span class="inv-sub" id="mm_und" style="display:inline"></span></div>
				<div class="inv-form-row"><span class="inv-label">¿Por qué?</span>
					<select class="inv-input" id="mm_mot" style="max-width:280px"><option value="">— elegir —</option>
						${Object.keys(d.motivos).map(k => `<option value="${k}">${MOTIVO_TXT[k] || esc(d.motivos[k])}</option>`).join('')}</select></div>
				<div class="inv-form-row"><span class="inv-label">Nota (opcional)</span>
					<input class="inv-input" id="mm_nota" maxlength="150" placeholder="ej. se cayó la caja al descargar" style="max-width:420px"></div>
				<button class="btn btn-success" id="mm_ok"><i class="fa fa-check"></i>Registrar merma</button>
			</div>
			<p class="inv-titulo-sec" style="margin-top:20px">Este mes · <b class="inv-neg">${soles(m.total)}</b> perdidos</p>
			${m.filas.length ? `<div class="inv-table-wrap"><table class="inv-table">
				<thead><tr><th>Cuándo</th><th>Producto</th><th style="text-align:right">Cantidad</th><th>Motivo</th><th style="text-align:right">Valor</th></tr></thead>
				<tbody>${m.filas.map(f => `<tr><td>${esc(fecha(f.fecha))}<span class="inv-sub">${esc(f.usuario || '')}</span></td><td>${esc(f.producto)}</td>
					<td style="text-align:right">${num(f.cantidad)} ${esc(f.unidad)}</td>
					<td>${esc(m.motivos[f.motivo] || f.motivo)}${f.nota ? `<span class="inv-sub">${esc(f.nota)}</span>` : ''}</td>
					<td style="text-align:right">${soles(f.valor)}</td></tr>`).join('')}</tbody></table></div>`
			: '<p class="inv-empty"><i class="fa fa-check-circle"></i>No hay mermas este mes.</p>'}`,
	});
	const $ = s => cont.querySelector(s);
	const inp = $('#mm_prod');
	autocompletar(inp, d.productos.map(p => ({ texto: p.descripcion, valor: String(p.idproducto) })));
	inp.addEventListener('input', () => {
		const p = prods.get(inp.dataset.valor || '');
		$('#mm_hay').textContent = p ? `Hay ${num(p.stock)} ${p.unidad} en tu almacén` : '';
		$('#mm_und').textContent = p ? p.unidad : '';
		if (p) { $('#mm_cant').focus(); }
	});
	const token = 'mm' + Date.now() + Math.random().toString(36).slice(2);   // doble clic -> una sola merma
	$('#mm_ok').addEventListener('click', async e => {
		const p = prods.get(inp.dataset.valor || '');
		if (!p) { aviso('Elige el producto de la lista.', 'error'); inp.focus(); return; }
		const cant = leerNum($('#mm_cant'), true);
		if (cant === null) { aviso('Cantidad mal escrita. Usa punto para decimales (ej: 1.5).', 'error'); $('#mm_cant').focus(); return; }
		if (!(cant > 0)) { aviso('Escribe cuánto se perdió.', 'error'); $('#mm_cant').focus(); return; }
		if (cant > p.stock) { aviso(`Solo hay ${num(p.stock)} ${p.unidad} de ${p.descripcion}.`, 'error'); $('#mm_cant').focus(); return; }
		if (!$('#mm_mot').value) { aviso('Elige por qué se perdió.', 'error'); $('#mm_mot').focus(); return; }
		const btn = e.currentTarget;
		btn.disabled = true;
		btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>Guardando…';
		try {
			const r = await api('mermas.php?op=registrar', { idproducto: p.idproducto, cantidad: cant, motivo: $('#mm_mot').value, nota: $('#mm_nota').value, token });
			aviso(`Listo: ${num(r.cantidad)} de ${r.producto} (${soles(r.valor)}) registrado como merma.`);
			// con el turno actual: si el usuario ya se fue a otra pantalla, la respuesta no la pisa
			render(cont, sesion, turnoActual()).catch(err => aviso(err.message, 'error'));
		} catch (err) { aviso(err.message, 'error'); btn.disabled = false; btn.innerHTML = '<i class="fa fa-check"></i>Registrar merma'; }
	});
}
