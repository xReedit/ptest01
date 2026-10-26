// Resumen del dia (F7, central): que hay que hacer hoy (cada pendiente lleva a su pantalla), diferencias que se repiten
// en 30 dias, y el resumen para mandar por WhatsApp (redactado por la IA o, si no hay IA, por plantilla).
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver } from '../ui.js?v=20261026a';
import { vigente } from '../router.js?v=20261026a';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });

export async function render(cont, sesion, t) {
	const d = await api('resumen.php?op=hoy');
	if (!vigente(t)) { return; }
	const h = d.hoy;
	// [cantidad, texto, pantalla, urgente]
	const tareas = [
		[h.sin_confirmar.length, `envío(s) en camino hace más de 24 h sin confirmar: <b>${esc([...new Set(h.sin_confirmar.map(x => x.sede))].join(', '))}</b>. Llama al encargado.`, 'envios', true],
		[h.vencidos, 'lote(s) <b>vencidos</b>: sacarlos de la venta', 'vencimientos', true],
		[h.atrasadas, 'orden(es) de compra enviadas hace más de 3 días que no llegan: llama al proveedor', 'recepcion', true],
		[h.pedidos, 'pedido(s) de las sedes por atender', 'bandeja', false],
		[h.por_aprobar, 'orden(es) de compra por aprobar', 'ordenes', false],
		[h.por_comprar, 'producto(s) por comprar sin orden', 'ordenes', false],
		[h.por_despachar, 'envío(s) a sedes por despachar', 'envios', false],
		[h.esperando - h.atrasadas, 'orden(es) esperando que llegue la mercadería', 'recepcion', false],
		[h.vencen_7, `lote(s) vencen en 7 días${h.se_pueden_salvar ? ` (${h.se_pueden_salvar} se pueden salvar llevándolos a otra sede)` : ''}`, 'vencimientos', false],
	].filter(x => x[0] > 0);
	const df = d.diferencias;
	const tabla = (titulo, filas, cols) => filas.length ? `<p class="inv-titulo-sec">${titulo}</p>
		<div class="inv-table-wrap"><table class="inv-table"><tbody>${filas.map(f => `<tr>${cols.map(c => `<td>${c(f)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` : '';

	cont.innerHTML = tarjeta({
		titulo: 'Resumen del día',
		ayuda: 'Lo que hay que hacer hoy, lo más urgente primero. Clic en una tarea para ir a resolverla.',
		acciones: `${volver()}<button class="btn btn-sm btn-success" id="rs_wsp"><i class="fa fa-whatsapp"></i>Enviar resumen por WhatsApp</button>`,
		cuerpo: tareas.length ? `<div class="inv-table-wrap"><table class="inv-table"><tbody>${tareas.map(([n, txt, ruta, urg]) => `
			<tr style="cursor:pointer" data-ir="${ruta}"><td style="width:56px"><span class="inv-estado ${urg ? 'anulado' : 'cerrado'}" style="font-size:13px">${n}</span></td>
			<td>${urg ? '<i class="fa fa-exclamation-circle inv-neg"></i> ' : ''}${txt}</td>
			<td class="inv-acciones" style="width:70px"><span class="inv-link"><i class="fa fa-arrow-right"></i>Ir</span></td></tr>`).join('')}</tbody></table></div>`
			: '<p class="inv-empty"><i class="fa fa-check-circle"></i>Todo al día. No hay pendientes.</p>',
	}) + tarjeta({
		titulo: 'Diferencias que se repiten (últimos 30 días)',
		ayuda: 'Dónde se pierde mercadería: sedes y choferes con faltantes en los envíos, productos que llegan mal y proveedores que entregan incompleto.',
		cuerpo: (df.por_sede.length + df.por_chofer.length + df.por_producto.length + df.proveedores.length)
			? tabla('<i class="fa fa-map-marker"></i> Sedes que reciben con faltantes', df.por_sede, [f => `<b>${esc(f.nombre)}</b>`, f => `${f.con_faltante} de ${f.envios} envíos`, f => `faltaron ${num(f.faltante)}`])
			+ tabla('<i class="fa fa-truck"></i> Choferes con envíos incompletos', df.por_chofer, [f => `<b>${esc(f.nombre)}</b>`, f => `${f.con_faltante} de ${f.envios} envíos`, f => `faltaron ${num(f.faltante)}`])
			+ tabla('<i class="fa fa-cube"></i> Productos que más llegan mal', df.por_producto, [f => `<b>${esc(f.nombre)}</b>`, f => `${f.veces} vez/veces`, f => esc(f.motivos || '')])
			+ tabla('<i class="fa fa-industry"></i> Proveedores que entregan incompleto', df.proveedores, [f => `<b>${esc(f.nombre)}</b>`, f => `${f.incompletas} de ${f.ordenes} órdenes`, () => ''])
			: '<p class="inv-empty"><i class="fa fa-check-circle"></i>Sin diferencias en los últimos 30 días.</p>',
	}) + '<div id="rs_valor"></div>' + '<dialog class="lg-dlg" id="rs_dlg"></dialog>';
	cont.querySelector('#rs_wsp').addEventListener('click', e => abrirWhatsapp(cont, d.telefono, e.currentTarget));
	pintarValor(cont.querySelector('#rs_valor'), 30);
}

const soles = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Valor (costo) de la mercaderia que se movio entre locales: cuanto salio de cada local, cuanto entro y cuanto falto
async function pintarValor(caja, dias) {
	let v;
	try { v = await api('resumen.php?op=valor&dias=' + dias); } catch (err) { caja.innerHTML = ''; aviso(err.message, 'error'); return; }
	if (!caja.isConnected) { return; }
	const t = v.total;
	caja.innerHTML = tarjeta({
		titulo: 'Valor de la mercadería movida',
		ayuda: 'Cuánto cuesta lo que se mueve entre locales (al último costo de compra). Lo que faltó al recibir es plata que se perdió en el camino.',
		acciones: `<select class="inv-select" id="rs_dias" style="width:auto">${[7, 30, 90].map(n => `<option value="${n}" ${n === dias ? 'selected' : ''}>Últimos ${n} días</option>`).join('')}</select>`,
		cuerpo: `<div class="lg-ficha">
				<div><span class="inv-label">Salió de los locales</span><b style="font-size:18px">${soles(t.enviado)}</b></div>
				<div><span class="inv-label">Llegó a destino</span><b style="font-size:18px">${soles(t.recibido)}</b></div>
				<div><span class="inv-label">En camino ahora</span><b style="font-size:18px">${soles(t.en_camino)}</b></div>
				<div><span class="inv-label">Faltó al recibir</span><b style="font-size:18px" class="${t.faltante > 0 ? 'inv-neg' : ''}">${soles(t.faltante)}</b></div>
			</div>
			${t.sin_costo ? `<p class="lg-alerta"><i class="fa fa-exclamation-triangle"></i> ${t.sin_costo} producto(s) enviados no tienen costo registrado: no suman al valor.</p>` : ''}
			${v.locales.length ? `<p class="inv-titulo-sec" style="margin-top:12px"><i class="fa fa-building-o"></i> Por local</p>
			<div class="inv-table-wrap"><table class="inv-table"><thead><tr><th>Local</th><th style="text-align:right">Salió</th><th style="text-align:right">Entró</th><th style="text-align:right">Faltó</th></tr></thead>
				<tbody>${v.locales.map(l => `<tr><td><b>${esc(l.local)}</b></td><td style="text-align:right">${soles(l.salio)}</td><td style="text-align:right">${soles(l.entro)}</td>
					<td style="text-align:right" class="${l.falto > 0 ? 'inv-neg' : ''}">${soles(l.falto)}</td></tr>`).join('')}</tbody></table></div>
			<p class="inv-titulo-sec" style="margin-top:12px"><i class="fa fa-exchange"></i> De dónde a dónde</p>
			<div class="inv-table-wrap"><table class="inv-table"><thead><tr><th>De → A</th><th style="text-align:right">Envíos</th><th style="text-align:right">Valor enviado</th><th style="text-align:right">En camino</th><th style="text-align:right">Faltó</th></tr></thead>
				<tbody>${v.rutas.map(r => `<tr><td>${esc(r.origen)} → ${esc(r.destino)}</td><td style="text-align:right">${r.envios}</td><td style="text-align:right">${soles(r.enviado)}</td>
					<td style="text-align:right">${soles(r.en_camino)}</td><td style="text-align:right" class="${Number(r.faltante) > 0 ? 'inv-neg' : ''}">${soles(r.faltante)}</td></tr>`).join('')}</tbody></table></div>`
			: `<p class="inv-empty">No se movió mercadería en los últimos ${dias} días.</p>`}`,
	});
	caja.querySelector('#rs_dias').addEventListener('change', e => pintarValor(caja, Number(e.target.value)));
}

async function abrirWhatsapp(cont, telefono, btn) {
	btn.disabled = true;
	btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>Redactando…';
	let r;
	try { r = await api('resumen.php?op=whatsapp', {}); }
	catch (err) { aviso(err.message, 'error'); return; }
	finally { btn.disabled = false; btn.innerHTML = '<i class="fa fa-whatsapp"></i>Enviar resumen por WhatsApp'; }
	const dlg = cont.querySelector('#rs_dlg');
	dlg.innerHTML = `
		<div class="xdlg-head"><h3>Resumen para WhatsApp</h3>
			<p>${r.con_ia ? '<i class="fa fa-magic"></i> Redactado por la IA con los datos del sistema.' : 'Resumen automático.'} Puedes corregirlo antes de enviar.</p></div>
		<div class="xdlg-body">
			<div class="inv-form-row"><span class="inv-label">Mensaje</span>
				<textarea class="inv-input inv-w100" id="rs_txt" rows="12" style="height:auto;padding:8px;font-size:13px">${esc(r.texto)}</textarea></div>
			<div class="inv-form-row"><span class="inv-label">WhatsApp de quien lo recibe</span>
				<input class="inv-input" id="rs_tel" inputmode="tel" maxlength="15" value="${esc(r.telefono || telefono || '')}" placeholder="987654321">
				<span class="inv-sub">Se guarda para la próxima vez.</span></div>
		</div>
		<div class="xdlg-foot"><button class="btn btn-sm btn-light" id="rs_no"><i class="fa fa-times"></i>Cerrar</button>
			<button class="btn btn-sm btn-success" id="rs_si"><i class="fa fa-whatsapp"></i>Abrir WhatsApp</button></div>`;
	dlg.querySelector('#rs_no').addEventListener('click', () => dlg.close());
	dlg.querySelector('#rs_si').addEventListener('click', async () => {
		const tel = dlg.querySelector('#rs_tel').value.replace(/\D/g, '');
		if (tel.length < 9) { aviso('Escribe el número de WhatsApp (9 dígitos).', 'error'); return; }
		if (tel !== String(r.telefono || '')) {
			try { await api('resumen.php?op=telefono', { telefono: tel }); } catch (err) { aviso(err.message, 'error'); return; }
		}
		window.open(`https://wa.me/${tel.length === 9 ? '51' + tel : tel}?text=${encodeURIComponent(dlg.querySelector('#rs_txt').value)}`, '_blank', 'noopener');
		dlg.close();
	});
	dlg.showModal();
}
