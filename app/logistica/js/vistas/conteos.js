// Conteos de las sedes (central): quien conto hoy, que no cuadra y cuanto vale. "Ajustar stock" deja el sistema
// igual a lo contado (como aprobar un conteo de Inventario); "Descartar" lo deja como estaba (ej. se conto mal).
import { cargarHistorias } from '../historia.js?v=20261026a';
import { api } from '../api.js?v=20261026a';
import { esc, aviso, tarjeta, volver, confirmar, fecha } from '../ui.js?v=20261026a';
import { vigente, turnoActual } from '../router.js?v=20261026a';

const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const soles = n => (n < 0 ? '-' : '') + 'S/ ' + Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const ESTADO = { cerrado: ['borrador', 'Por revisar'], aprobado: ['aprobado', 'Stock ajustado'], borrador: ['', 'Contando…'] };

export async function render(cont, sesion, t) {
	const d = await api('conteo.php?op=resumen');
	if (t !== undefined && !vigente(t)) { return; }
	const chip = s => s.hoy === null ? '<span class="lg-chip no"><i class="fa fa-clock-o"></i>no contó</span>'
		: s.hoy === 'borrador' ? '<span class="lg-chip">contando</span>' : '<span class="lg-chip si"><i class="fa fa-check"></i>contó</span>';
	cont.innerHTML = tarjeta({
		titulo: 'Conteos de las sedes',
		ayuda: `Cada sede cuenta ${d.cantidad} productos al día sin ver el stock. Aquí ves lo que no cuadró en los últimos 7 días.`,
		acciones: volver(),
		cuerpo: `${d.activo ? '' : '<p class="inv-ayuda"><i class="fa fa-info-circle"></i> El conteo rápido está apagado. Actívalo en <b>Configurar</b>.</p>'}
			<p class="inv-titulo-sec">Hoy</p>
			<div class="lg-chips">${d.sedes.map(s => `<span class="lg-chip-sede"><b>${esc(s.sede)}</b> ${chip(s)}</span>`).join('')}</div>
			<p class="inv-titulo-sec" style="margin-top:16px">Resultados</p>
			${d.conteos.filter(c => c.estado !== 'borrador').map(c => {
				const mal = c.items.filter(i => i.diferencia !== 0);
				return `<div class="inv-toolbar lg-conteo-caja" style="display:block" data-id="${c.id}">
					<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
						<b>${esc(c.sede)}</b><span class="inv-sub" style="display:inline">${esc(fecha(c.fecha))}${c.usuario ? ' · ' + esc(c.usuario) : ''}</span>
						<span class="inv-estado ${ESTADO[c.estado][0]}">${ESTADO[c.estado][1]}</span>
						<span class="inv-sep"></span>
						${mal.length ? `<span><b class="inv-neg">${mal.length}</b> de ${c.items.length} no cuadran · <b class="${c.valor < 0 ? 'inv-neg' : 'inv-pos'}">${soles(c.valor)}</b></span>` : `<span class="inv-pos"><i class="fa fa-check-circle"></i> Todo cuadra</span>`}
						${c.estado === 'cerrado' && mal.length ? `<button class="btn btn-sm btn-success" data-ajustar="${c.id}"><i class="fa fa-check"></i>Ajustar stock</button>
							<button class="btn btn-sm btn-light" data-descartar="${c.id}"><i class="fa fa-times"></i>Descartar</button>` : ''}
					</div>
					${mal.length ? `<div class="inv-table-wrap" style="margin-top:8px"><table class="inv-table"><thead><tr><th>Producto</th><th style="text-align:right">Sistema</th><th style="text-align:right">Contaron</th><th style="text-align:right">Diferencia</th></tr></thead>
						<tbody>${mal.map(i => `<tr><td>${esc(i.descripcion)}</td><td style="text-align:right">${num(i.sistema)}</td><td style="text-align:right"><b>${num(i.contado)}</b></td>
							<td style="text-align:right"><b class="${i.diferencia < 0 ? 'inv-neg' : 'inv-pos'}">${i.diferencia > 0 ? '+' : ''}${num(i.diferencia)} ${esc(i.unidad)}</b> <span class="inv-sub">${soles(i.valor)}</span></td></tr>`).join('')}</tbody></table></div>` : ''}
					<details class="lg-tl-det"><summary><i class="fa fa-history"></i>Ver historia</summary><div data-historia="conteo:${c.id}"></div></details>
				</div>`;
			}).join('') || '<p class="inv-empty"><i class="fa fa-inbox"></i>Todavía no hay conteos terminados.</p>'}`,
	});
	cont.querySelector('.xContentCard').addEventListener('click', async e => {
		const b = e.target.closest('[data-ajustar],[data-descartar]');
		if (!b) { return; }
		const ajustar = 'ajustar' in b.dataset, id = Number(b.dataset.ajustar || b.dataset.descartar);
		const ok = await confirmar(ajustar
			? { titulo: 'Ajustar el stock', textoHtml: 'El stock del sistema quedará <b>igual a lo que contó la sede</b>. Queda registrado como "AJUSTE INVENTARIO" en el kardex.', boton: 'Sí, ajustar', peligro: false }
			: { titulo: 'Descartar este conteo', textoHtml: 'El stock queda como está. Úsalo si la sede contó mal o ya se corrigió de otra forma.', boton: 'Sí, descartar' });
		if (!ok) { return; }
		b.disabled = true;
		try {
			await api('conteo.php?op=' + (ajustar ? 'aprobar' : 'descartar'), { id });
			aviso(ajustar ? 'Stock ajustado.' : 'Conteo descartado.');
			render(cont, sesion, turnoActual()).catch(err => aviso(err.message, 'error'));   // turno: no pisa otra pantalla
		} catch (err) { aviso(err.message, 'error'); b.disabled = false; }
	});
}
