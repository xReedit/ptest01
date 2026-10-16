// Diagrama vivo del inicio (central): cada caja es una etapa con lo que esta esperando ahi.
// Lineas animadas = hay algo por avanzar; rojo = urgente; clic en una caja = ir a resolverlo.
// SVG + CSS, sin librerias. Se refresca solo cada 2 minutos mientras esta en pantalla.
import { api } from '../api.js?v=20261015i';
import { esc } from '../ui.js?v=20261015i';

const W = 144, H = 54;
const C = { sede: '#0d9488', central: '#2563eb', reparto: '#16a34a', compra: '#ea580c', alerta: '#dc2626', ambar: '#d97706', planta: '#7c3aed' };
// periodo: solo cambia lo que YA paso (Llego, Recibido y el dinero); lo pendiente siempre es "ahora"
const PERIODOS = [['hoy', 'Hoy'], ['7', '7 días'], ['15', '15 días'], ['mes', 'Este mes']];
const ETQ = { hoy: 'hoy', 7: '7 días', 15: '15 días', mes: 'este mes' };
const CLAVE_PER = 'lg_flujo_periodo';
const soles = n => 'S/ ' + Number(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const s = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
// filas (centro vertical) y columnas (centro horizontal): cada caja queda centrada en su carril con >= 15 px de aire
const Y1 = 130, Y2 = 335, Y3 = 525;

// [clave, x, y, color, icono FA4, titulo, sub(d), cantidad(d), urgente(d) -> texto|null, pantalla]
const NODOS = [
	['parado', 100, Y1, C.ambar, '', 'Stock parado', d => d.parado.productos ? soles(d.parado.valor).replace('.00', '') + ' en ' + s(d.parado.sedes, 'sede', 'sedes') : 'todo se mueve', d => d.parado.productos, () => null, 'parado'],
	['pedidos', 100, Y2, C.sede, '', 'Pedidos', d => `${d.pedidos_nuevos} nuevos · ${d.pedidos_vistos} vistos`, d => d.pedidos_nuevos + d.pedidos_vistos, d => d.pedidos_nuevos ? s(d.pedidos_nuevos, 'nuevo', 'nuevos') : null, 'bandeja'],
	['otra', 300, Y2, C.ambar, '', 'En otra sede', d => d.otra_sede ? 'no lo compres, tráelo' : 'nada que traer', d => d.otra_sede, d => d.otra_sede ? 'no comprar' : null, 'ordenes/otra'],
	['comprar', 300, Y3, C.central, '', 'Por comprar', () => 'productos sin orden', d => d.por_comprar, () => null, 'ordenes/comprar'],
	['central', 300, Y1, C.central, '', 'Del almacén', d => d.falta_almacen ? s(d.falta_almacen, 'producto no alcanza', 'productos no alcanzan') : 'productos que salen', d => d.sale_central, d => d.falta_almacen ? s(d.falta_almacen, 'sin stock', 'sin stock') : null, 'envios/central'],
	['despachar', 500, Y1, C.reparto, '', 'Por despachar', d => d.por_despachar === 1 ? 'envío listo para salir' : 'envíos listos para salir', d => d.por_despachar, () => null, 'envios/despachar'],
	['camino', 705, Y1, C.reparto, '', 'En camino', d => d.valor_en_camino > 0 ? 'S/ ' + Number(d.valor_en_camino).toLocaleString('es-PE', { maximumFractionDigits: 0 }) + ' en camino' : 'sin confirmar', d => d.en_camino, d => d.sin_confirmar ? `${d.sin_confirmar} > 24 h` : null, 'envios/camino'],
	['recibido', 910, Y1, C.reparto, '', 'Recibido', d => d.con_diferencia_per ? s(d.con_diferencia_per, 'con faltante', 'con faltantes') : 'en ' + ETQ[d.periodo], d => d.recibidos_per, d => d.con_diferencia_per ? s(d.con_diferencia_per, 'faltante', 'faltantes') : null, 'envios/recibido'],
	['vencer', 1105, Y1, C.alerta, '', 'Por vencer', d => d.vencidos ? s(d.vencidos, 'vencido', 'vencidos') : 'lotes en 7 días', d => d.vencidos + d.vencen_7, d => d.vencidos ? s(d.vencidos, 'vencido', 'vencidos') : null, 'vencimientos'],
	// 05 · la central produce, reparte sin pedido y repone su almacen
	['producir', 500, Y2, C.planta, '', 'Producir', d => !d.produccion.activa ? 'actívala en Configurar' : d.por_producir ? 'en ' + d.produccion.planta : 'nada por producir',
		d => d.por_producir, () => null, d => (d.produccion.activa ? 'produccion' : 'config')],
	['repartir', 705, Y2, C.planta, '', 'Repartir', d => d.repartos ? 'sin pedido, por despachar' : 'manda sin esperar pedidos', d => d.repartos, () => null, d => (d.repartos ? 'envios/repartos' : 'repartir')],
	['bajo', 910, Y2, C.ambar, '', 'Almacén bajo', d => d.almacen_bajo ? 'se está terminando' : 'el almacén está bien', d => d.almacen_bajo,
		d => d.almacen_bajo ? s(d.almacen_bajo, 'por comprar', 'por comprar') : null, 'ordenes/bajo'],
	['aprobar', 500, Y3, C.compra, '', 'Por aprobar', () => 'órdenes de compra', d => d.oc_por_aprobar, () => null, 'ordenes/aprobar'],
	['enviar', 705, Y3, C.compra, '', 'Falta enviar', () => 'al proveedor', d => d.oc_aprobada, () => null, 'ordenes/enviar'],
	['proveedor', 910, Y3, C.compra, '', 'En proveedor', d => d.oc_parcial ? `${d.oc_parcial} llegó una parte` : 'esperando', d => d.oc_enviada + d.oc_parcial, d => d.oc_atrasadas ? s(d.oc_atrasadas, 'atrasada', 'atrasadas') : null, 'recepcion'],
	['llego', 1105, Y3, C.compra, '', 'Llegó', d => 'en ' + ETQ[d.periodo] + ' · ver detalle', d => d.compras_per, () => null, 'llegadas'],
];
// [desde, hasta, camino SVG, etiqueta?]  (bordes: x ± 72, y ± 27)
const LINEAS = [
	['pedidos', 'central', 'M172 335 H191 V130 H228'], ['pedidos', 'comprar', 'M172 335 H191 V525 H228'],
	['comprar', 'otra', 'M300 498 V362', ['¿otra sede lo tiene?', 300, 434]],
	['otra', 'despachar', 'M372 335 H400 V130 H428'], ['central', 'despachar', 'M372 130 H428'],
	['despachar', 'camino', 'M572 130 H633'], ['camino', 'recibido', 'M777 130 H838'],
	['comprar', 'aprobar', 'M372 525 H428'], ['aprobar', 'enviar', 'M572 525 H633'], ['enviar', 'proveedor', 'M777 525 H838'], ['proveedor', 'llego', 'M982 525 H1033'],
	['llego', 'despachar', 'M1105 498 V241 H540 V157', ['lo que llega se reparte', 830, 236]],
	['producir', 'despachar', 'M480 308 V157'], ['repartir', 'despachar', 'M705 308 V241 H540 V157'],
	['bajo', 'comprar', 'M910 362 V411 H330 V498', ['se repone el almacén', 620, 406]],
];
const CARRILES = [
	[10, 30, 180, 560, '01 · Las sedes', C.sede], [210, 30, 180, 560, '02 · La central decide', C.central],
	[410, 30, 590, 190, '03 · Reparto a las sedes', C.reparto], [1018, 30, 174, 190, 'Alertas', C.alerta],
	[410, 262, 782, 130, '05 · Producción y almacén central', C.planta],
	[410, 430, 782, 160, '04 · Compras al proveedor', C.compra],
];

function svg(d) {
	const val = Object.fromEntries(NODOS.map(n => [n[0], n[7](d)]));
	const color = Object.fromEntries(NODOS.map(n => [n[0], n[3]]));
	const marcas = [...new Set(NODOS.map(n => n[3]))].map(c => `<marker id="lgf-${c.slice(1)}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
		<path d="M0 0 L10 5 L0 10 z" fill="${c}"/></marker>`).join('') + '<marker id="lgf-off" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#c4c9d2"/></marker>';
	const carriles = CARRILES.map(([x, y, w, h, t, c]) => `<rect class="lgf-carril" stroke-dasharray="5 4" x="${x}" y="${y}" width="${w}" height="${h}" rx="12" style="stroke:${c};fill:${c}0a"/>
		<text class="lgf-carril-t" x="${x + 12}" y="${y + 17}" fill="${c}">${esc(t)}</text>`).join('');
	const lineas = LINEAS.map(([a, b, p, et], i) => {
		const on = val[a] > 0, c = color[a];
		return `<g class="lgf-e ${on ? 'on' : ''}" data-a="${a}" data-b="${b}">
			<path id="lgf-p${i}" d="${p}" fill="none" stroke="${on ? c : '#c4c9d2'}" marker-end="url(#lgf-${on ? c.slice(1) : 'off'})"/>
			${on ? `<circle r="3.5" fill="${c}"><animateMotion dur="${2 + (i % 3) * 0.4}s" repeatCount="indefinite"><mpath href="#lgf-p${i}"/></animateMotion></circle>` : ''}
			${et ? `<text class="lgf-et" x="${et[1]}" y="${et[2]}" text-anchor="middle">${esc(et[0])}</text>` : ''}</g>`;
	}).join('');
	const nodos = NODOS.map(([k, x, y, c, ic, t, sub, , urg, rutaN], i) => {
		const n = val[k], u = urg(d), l = x - W / 2, tp = y - H / 2, ruta = typeof rutaN === 'function' ? rutaN(d) : rutaN;
		return `<g class="lgf-n ${n > 0 ? 'on' : 'off'} ${u ? 'urg' : ''}" data-k="${k}" data-ir="${ruta}" tabindex="0" role="link" style="animation-delay:${i * 45}ms"
			aria-label="${esc(t)}: ${n}. Clic para ir">
			<title>${esc(t)}: ${n}. Clic para ir a resolverlo</title>
			${u ? `<rect class="lgf-pulso" fill="none" x="${l - 4}" y="${tp - 4}" width="${W + 8}" height="${H + 8}" rx="13" style="stroke:${C.alerta}"/>` : ''}
			<rect class="lgf-caja" x="${l}" y="${tp}" width="${W}" height="${H}" rx="10" style="stroke:${c};fill:${n > 0 ? c + '14' : '#fff'}"/>
			<text class="lgf-ic" x="${l + 11}" y="${tp + 21}" fill="${c}" font-family="FontAwesome" font-size="13">${ic}</text>
			<text class="lgf-t" x="${l + 29}" y="${tp + 21}">${esc(t)}</text>
			<text class="lgf-s" x="${l + 11}" y="${tp + 41}">${esc(sub(d))}</text>
			<text class="lgf-num" x="${l + W - 10}" y="${tp + 24}" font-size="18" font-weight="700" text-anchor="end" fill="${n > 0 ? c : '#adb5bd'}" data-n="${n}">${n}</text>
			${u ? `<g class="lgf-badge"><rect x="${l + W - 82}" y="${tp - 10}" width="78" height="18" rx="9" fill="${C.alerta}"/>
				<text x="${l + W - 43}" y="${tp + 3}" text-anchor="middle">${esc(u)}</text></g>` : ''}</g>`;
	}).join('');
	return `<svg class="lgf-svg" viewBox="0 0 1200 610" role="img" aria-label="Flujo de logística"><defs>${marcas}</defs>${carriles}${lineas}${nodos}</svg>`;
}

/** Frase de arriba: lo urgente primero, en palabras. */
function frase(d) {
	const t = [
		d.sin_confirmar && s(d.sin_confirmar, 'envío sin confirmar hace más de 24 h', 'envíos sin confirmar hace más de 24 h'),
		d.vencidos && s(d.vencidos, 'lote vencido', 'lotes vencidos'),
		d.falta_almacen && s(d.falta_almacen, 'producto que no alcanza en el almacén', 'productos que no alcanzan en el almacén'),
		d.otra_sede && s(d.otra_sede, 'producto que otra sede tiene (no lo compres)', 'productos que otra sede tiene (no los compres)'),
		d.oc_atrasadas && s(d.oc_atrasadas, 'orden atrasada', 'órdenes atrasadas'),
		d.parado.valor > 0 && `${soles(d.parado.valor)} parado en ${s(d.parado.sedes, 'sede', 'sedes')} (llévalo a otra sede)`,
		d.pedidos_nuevos && s(d.pedidos_nuevos, 'pedido nuevo', 'pedidos nuevos'),
		d.por_producir && `${s(d.por_producir, 'producto por producir', 'productos por producir')} en ${d.produccion.planta}`,
		d.almacen_bajo && s(d.almacen_bajo, 'producto que se termina en el almacén (cómpralo)', 'productos que se terminan en el almacén (cómpralos)'),
		d.oc_por_aprobar && s(d.oc_por_aprobar, 'orden por aprobar', 'órdenes por aprobar'),
		d.oc_aprobada && s(d.oc_aprobada, 'orden por enviar al proveedor', 'órdenes por enviar al proveedor'),
		d.por_despachar && s(d.por_despachar, 'envío por despachar', 'envíos por despachar'),
	].filter(Boolean);
	return t.length ? `<i class="fa fa-hand-o-right"></i> Por hacer: <b>${t.join('</b>, <b>')}</b>.` : '<i class="fa fa-check-circle inv-pos"></i> Todo al día. No hay nada esperando.';
}

/** Dinero: lo que se debe a proveedores (siempre todo) y lo del periodo. Cada tarjeta lleva a su pantalla. */
function dinero(d) {
	const m = d.dinero, e = ETQ[d.periodo];
	return `<div class="lgf-dinero">
		<a href="#" data-ir="llegadas" data-filtro="por_pagar" class="${m.deuda > 0 ? 'rojo' : ''}"><span>Debes a proveedores</span><b>${soles(m.deuda)}</b>
			<small>${m.deuda_n ? s(m.deuda_n, 'compra a crédito', 'compras a crédito') + ' sin pagar' : 'todo pagado'}</small></a>
		<a href="#" data-ir="llegadas" data-filtro="${d.periodo}"><span>Compraste (${e})</span><b>${soles(m.comprado)}</b><small>${s(d.compras_per, 'compra', 'compras')}</small></a>
		<a href="#" data-ir="resumen"><span>Enviaste a sedes (${e})</span><b>${soles(m.enviado)}</b><small>valor al costo</small></a>
		<a href="#" data-ir="resumen" class="${m.faltante > 0 ? 'rojo' : ''}"><span>Faltó al recibir (${e})</span><b>${soles(m.faltante)}</b><small>${m.faltante > 0 ? 'se perdió en el camino' : 'nada perdido'}</small></a>
	</div>`;
}

/** Cuenta de 0 al valor (solo la primera vez). */
function contar(el) {
	if (matchMedia('(prefers-reduced-motion: reduce)').matches) { return; }
	el.querySelectorAll('.lgf-num').forEach(t => {
		const fin = Number(t.dataset.n);
		if (!fin) { return; }
		const t0 = performance.now();
		const paso = ahora => { const k = Math.min(1, (ahora - t0) / 700); t.textContent = Math.round(fin * (1 - Math.pow(1 - k, 3))); if (k < 1) { requestAnimationFrame(paso); } };
		requestAnimationFrame(paso);
	});
}

function enfocar(el) {
	const s2 = el.querySelector('.lgf-svg');
	const on = k => {
		const lin = [...s2.querySelectorAll('.lgf-e')].filter(e => e.dataset.a === k || e.dataset.b === k);
		const vec = new Set([k, ...lin.flatMap(e => [e.dataset.a, e.dataset.b])]);
		s2.classList.add('foco');
		lin.forEach(e => e.classList.add('vivo'));
		s2.querySelectorAll('.lgf-n').forEach(n => n.classList.toggle('vivo', vec.has(n.dataset.k)));
	};
	const off = () => { s2.classList.remove('foco'); s2.querySelectorAll('.vivo').forEach(e => e.classList.remove('vivo')); };
	s2.querySelectorAll('.lgf-n').forEach(n => {
		n.addEventListener('mouseenter', () => on(n.dataset.k));
		n.addEventListener('focus', () => on(n.dataset.k));
		n.addEventListener('mouseleave', off);
		n.addEventListener('blur', off);
		n.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); n.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
	});
}

/** Dibuja el diagrama en el.  Devuelve cuando termina la primera carga. */
export async function dibujarFlujo(el) {
	let primera = true;
	let periodo = '7';
	try { periodo = localStorage.getItem(CLAVE_PER) || '7'; } catch (e) { /* sin storage: 7 dias */ }
	const cargar = async () => {
		let d;
		try { d = await api('resumen.php?op=flujo&periodo=' + encodeURIComponent(periodo)); }
		catch (err) { if (primera) { el.innerHTML = `<p class="inv-empty"><i class="fa fa-info-circle"></i>${esc(err.message)}</p>`; } return; }
		if (!el.isConnected) { return; }
		const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
		el.innerHTML = `<div class="lgf-cab"><p class="lgf-frase">${frase(d)}</p>
			<div class="lgf-per" role="group" aria-label="Periodo">${PERIODOS.map(([v, x]) => `<button type="button" data-per="${v}" class="${v === d.periodo ? 'act' : ''}">${x}</button>`).join('')}</div>
			<button class="btn btn-sm btn-light" type="button" data-lgf-act title="Actualizar"><i class="fa fa-refresh"></i>${hora}</button></div>
			${dinero(d)}
			<div class="lgf-wrap ${primera ? 'entra' : ''}">${svg(d)}</div>
			<div class="lgf-ley"><span><i class="lgf-l on"></i>se mueve: hay algo esperando</span><span><i class="lgf-l"></i>sin pendientes</span>
				<span><i class="lgf-l urg"></i>urgente</span><span><i class="fa fa-mouse-pointer"></i> clic en una caja para ir a resolverlo</span></div>`;
		el.querySelector('[data-lgf-act]').addEventListener('click', cargar);
		el.querySelectorAll('[data-per]').forEach(b => b.addEventListener('click', () => {
			periodo = b.dataset.per;
			try { localStorage.setItem(CLAVE_PER, periodo); } catch (e) { /* no se recuerda */ }
			cargar();
		}));
		// "Debes a proveedores" / "Compraste": Lo que llego abre con ese filtro
		el.querySelectorAll('[data-filtro]').forEach(a => a.addEventListener('click', () => {
			try { sessionStorage.setItem('lg_llegadas_filtro', a.dataset.filtro); } catch (e) { /* abre con su filtro normal */ }
		}));
		enfocar(el);
		if (primera) { contar(el); }
		primera = false;
	};
	await cargar();
	const reloj = setInterval(() => { if (!el.isConnected) { clearInterval(reloj); return; } if (!document.hidden) { cargar(); } }, 120000);
}
