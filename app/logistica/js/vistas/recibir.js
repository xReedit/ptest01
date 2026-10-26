// Recibir mercaderia (F6, sede; pensado para el celular del encargado): lo que viene en camino desde la central u
// otra sede. Se cuenta, se anota lo que llego (si llego menos, el motivo) y se confirma: entra al stock de la sede.
import { cargarHistorias } from '../historia.js?v=20261026a';
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, confirmar, fecha } from '../ui.js?v=20261026a';
import { vigente, recargar } from '../router.js?v=20261026a';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const MOTIVOS = ['Llegó menos', 'Llegó roto o dañado', 'Llegó vencido', 'Otro'];

// porcion de la sede que mas se parece al producto (palabras en comun): "BOTE HELADO COCO" -> "HELADO DE COCO 2"
export function parecida(nombre, porciones) {
	const pal = s => String(s).toUpperCase().split(/[^A-Z0-9ÁÉÍÓÚÑ]+/).filter(w => w.length > 2);
	const mias = pal(nombre);
	let mejor = null, max = 0;
	porciones.forEach(p => {
		const suyas = pal(p.descripcion), n = suyas.filter(w => mias.includes(w)).length;
		// una palabra comun ("HELADO") no alcanza: elegiria otro sabor. Salvo que la porcion tenga una sola palabra
		if (n > max && (n >= 2 || suyas.length === 1)) { max = n; mejor = p; }
	});
	return mejor;
}

// producto que en la sede se vende por porcion: a que porcion entra y cuantas porciones son
function celdaPorcion(i, e) {
	if (!i.porciones) { return ''; }
	const destino = i.idporcion ? `de <b>${esc(i.porcion)}</b>`
		: `<select class="inv-select rb-porcion" style="width:100%;max-width:240px;margin-top:4px"><option value="">¿A qué porción de tu sede va?</option>
			${e.porciones_sede.map(p => `<option value="${p.idporcion}" ${parecida(i.descripcion, e.porciones_sede) === p ? 'selected' : ''}>${esc(p.descripcion)}</option>`).join('')}</select>`;
	return `<span class="inv-sub rb-porc-txt" data-factor="${Number(i.porciones)}">1 ${esc(i.unidad || 'und')} = ${num(i.porciones)} porciones · entran
		<b class="rb-porc-n">${num(i.enviada * i.porciones)}</b> porciones ${destino}</span>`;
}

export async function render(cont, sesion, t) {
	const envios = await api('traslados.php?op=por_recibir');
	if (!vigente(t)) { return; }
	cont.innerHTML = '<div id="rb_raiz">' + (envios.length ? envios.map(e => tarjeta({
		titulo: `Envío N° ${e.idtraslado} desde ${e.origen}`,
		ayuda: `Salió ${esc(fecha(e.fecha_despacho))}${e.chofer ? ' · chofer ' + esc(e.chofer) : ''}${e.vehiculo ? ' · ' + esc(e.vehiculo) : ''}.`
			+ ' Ya está puesto lo que se envió: <b>corrige solo lo que llegó distinto</b>.',
		acciones: `${volver()}<button class="btn btn-sm btn-success" data-recibir="${e.idtraslado}"><i class="fa fa-check"></i>Confirmar lo que llegó</button>`,
		cuerpo: `<div class="inv-table-wrap"><table class="inv-table" data-envio="${e.idtraslado}">
			<thead><tr><th>Producto</th><th>¿Cuánto llegó?</th><th>Observación</th></tr></thead>
			<tbody>${e.items.map(i => `<tr data-item="${i.iditem}" data-env="${Number(i.enviada)}" data-nombre="${esc(i.descripcion)}">
				<td>${esc(i.descripcion)}<span class="inv-sub">Enviaron <b>${num(i.enviada)}</b> ${esc(i.unidad || 'und')}</span>${celdaPorcion(i, e)}</td>
				<td><input class="inv-input rb-cant" type="number" min="0" step="any" inputmode="decimal" style="width:100px" value="${Number(i.enviada)}">
					<select class="inv-select rb-motivo" hidden style="width:100%;max-width:220px;margin-top:6px"><option value="">¿Por qué llegó menos?</option>
						${MOTIVOS.map(m => `<option>${m}</option>`).join('')}</select></td>
				<td><input class="inv-input rb-obs" maxlength="150" style="width:100%;min-width:140px" placeholder="opcional"></td>
			</tr>`).join('')}</tbody></table></div>
			<div class="inv-form-row" style="margin-top:10px"><span class="inv-label">Observaciones de la entrega (opcional)</span>
				<textarea class="inv-input inv-w100 rb-nota" data-envio="${e.idtraslado}" maxlength="255" rows="2" style="height:auto;padding:6px"
					placeholder="ej. llegó a las 11, el chofer no traía guía, caja mojada"></textarea></div>
			<details class="lg-tl-det"><summary><i class="fa fa-history"></i>Ver historia de este envío</summary><div data-historia="traslado:${e.idtraslado}"></div></details>`,
	})).join('') : tarjeta({
		titulo: 'Recibir mercadería', acciones: volver(),
		cuerpo: '<p class="inv-empty"><i class="fa fa-check-circle"></i>No viene nada en camino a tu sede.</p>',
	})) + '</div>';
	const raiz = cont.querySelector('#rb_raiz');
	// el motivo aparece solo cuando llego menos de lo enviado
	raiz.addEventListener('input', e => {
		const inp = e.target.closest('.rb-cant');
		if (!inp) { return; }
		const tr = inp.closest('tr');
		tr.querySelector('.rb-motivo').hidden = !(Number(inp.value) < Number(tr.dataset.env));
		const pt = tr.querySelector('.rb-porc-txt');
		if (pt) { pt.querySelector('.rb-porc-n').textContent = num((Number(inp.value) || 0) * Number(pt.dataset.factor)); }
	});
	const tokens = {};
	envios.forEach(e => { tokens[e.idtraslado] = 'rb' + e.idtraslado + Date.now() + Math.random().toString(36).slice(2); });
	raiz.addEventListener('click', e => {
		const b = e.target.closest('[data-recibir]');
		if (b) { recibir(cont, envios.find(x => x.idtraslado === Number(b.dataset.recibir)), b, tokens[b.dataset.recibir]); }
	});
}

async function recibir(cont, envio, btn, token) {
	const tabla = cont.querySelector(`table[data-envio="${envio.idtraslado}"]`);
	const items = [...tabla.querySelectorAll('tr[data-item]')].map(tr => ({
		iditem: Number(tr.dataset.item), enviada: Number(tr.dataset.env), recibido: tr.querySelector('.rb-cant').value,
		motivo: tr.querySelector('.rb-motivo').value, nombre: tr.dataset.nombre, observacion: tr.querySelector('.rb-obs').value.trim(),
		idporcion: tr.querySelector('.rb-porcion') ? Number(tr.querySelector('.rb-porcion').value) : 0,
		porcionSinElegir: !!tr.querySelector('.rb-porcion') && !tr.querySelector('.rb-porcion').value,
	}));
	const nota = cont.querySelector(`.rb-nota[data-envio="${envio.idtraslado}"]`).value.trim();
	const malo = [...tabla.querySelectorAll('.rb-cant')].find(inp => inp.validity.badInput);
	if (malo) { aviso('Hay una cantidad mal escrita. Usa punto para decimales (ej: 1.5).', 'error'); malo.focus(); return; }
	const vacio = items.find(i => i.recibido === '');
	if (vacio) { aviso(`Escribe cuánto llegó de ${vacio.nombre} (0 si no llegó).`, 'error'); return; }
	const menos = items.filter(i => Number(i.recibido) < i.enviada);
	const sinMotivo = menos.find(i => !i.motivo);
	if (sinMotivo) { aviso(`De ${sinMotivo.nombre} llegó menos: elige el motivo.`, 'error'); return; }
	const sinPorcion = items.find(i => i.porcionSinElegir && Number(i.recibido) > 0);
	if (sinPorcion) { aviso(`De ${sinPorcion.nombre} elige a qué porción de tu sede va. Si no la tienes, créala primero en Porciones.`, 'error'); return; }
	const demas = items.find(i => Number(i.recibido) > i.enviada);
	if (demas) { aviso(`De ${demas.nombre} se enviaron ${num(demas.enviada)}: no pueden llegar ${num(demas.recibido)}. Revisa.`, 'error'); return; }
	const ok = await confirmar({
		titulo: `¿Confirmar lo que llegó del envío N° ${envio.idtraslado}?`, peligro: false, boton: 'Sí, entra a mi almacén',
		textoHtml: menos.length
			? `<p style="margin:0 0 6px">Llegó <b>menos</b> en:</p><ul style="margin:0 0 8px;padding-left:18px">${menos.map(i => `<li>${esc(i.nombre)}: ${num(i.recibido)} de ${num(i.enviada)} (${esc(i.motivo)})</li>`).join('')}</ul>
				<p class="inv-ayuda" style="margin:0">La central verá la diferencia.</p>`
			: '<p style="margin:0">Llegó todo completo. Entra al stock de tu sede.</p>',
	});
	if (!ok) { return; }
	btn.disabled = true;
	try {
		await api('traslados.php?op=recibir', { idtraslado: envio.idtraslado, token, nota,
			items: items.map(i => ({ iditem: i.iditem, recibido: i.recibido, motivo: i.motivo, observacion: i.observacion, idporcion: i.idporcion || undefined })) });
		aviso(`Envío N° ${envio.idtraslado} recibido.`);
		recargar();
	} catch (err) {
		aviso(err.message, 'error');
		btn.disabled = false;
	}
}
