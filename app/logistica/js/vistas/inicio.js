// Inicio del modulo: muestra SOLO las opciones del rol de quien entra (central o sede), para que sea simple.
import { esc, tarjeta, aviso } from '../ui.js?v=20261026a';
import { dibujarFlujo } from './flujo.js?v=20261026a';
import { ir, refrescarSesion } from '../router.js?v=20261026a';

const CENTRAL = [
	{ icono: 'fa-sun-o', titulo: 'Resumen del día', texto: 'Qué hay que hacer hoy, lo urgente primero', ruta: 'resumen' },
	{ icono: 'fa-comments', titulo: 'Pregúntale a la IA', texto: '¿Cuánto arroz hay? ¿Qué le compré a Backus?', ruta: 'preguntas' },
	{ icono: 'fa-book', titulo: 'Catálogo', texto: 'Productos para todas las sedes y cuántas porciones da cada uno', ruta: 'catalogo' },
	{ icono: 'fa-link', titulo: 'Productos de las sedes', texto: 'Ordena lo que cada sede creó por su cuenta', ruta: 'productos_sedes' },
	{ icono: 'fa-inbox', titulo: 'Bandeja central', texto: 'Pedidos de las sedes: atender, trasladar o comprar', ruta: 'bandeja' },
	{ icono: 'fa-file-text-o', titulo: 'Órdenes de compra', texto: 'Lo que hay que comprar, por proveedor', ruta: 'ordenes' },
	{ icono: 'fa-star-half-o', titulo: 'Proveedores', texto: 'Quién cumple, quién llega tarde y quién sube precios', ruta: 'precios' },
	{ icono: 'fa-download', titulo: 'Recepción', texto: 'Anota lo que llegó del proveedor', ruta: 'recepcion' },
	{ icono: 'fa-share-alt', titulo: 'Repartir a las sedes', texto: 'Manda productos sin esperar que las sedes pidan', ruta: 'repartir' },
	{ icono: 'fa-truck', titulo: 'Envíos a las sedes', texto: 'Arma la ruta del día y despacha', ruta: 'envios' },
	{ icono: 'fa-id-card-o', titulo: 'Choferes', texto: 'Quién reparte y su app para marcar entregas', ruta: 'choferes' },
	{ icono: 'fa-chain-broken', titulo: 'Mermas y pérdidas', texto: 'Cuánto se pierde en cada local y por qué', ruta: 'perdidas' },
	{ icono: 'fa-hourglass-half', titulo: 'Stock parado', texto: 'Lo que en una sede no sale: llévalo a otra', ruta: 'parado' },
	{ icono: 'fa-clock-o', titulo: 'Por vencer', texto: 'Lo que vence pronto y a qué sede llevarlo', ruta: 'vencimientos' },
	{ icono: 'fa-sliders', titulo: 'Stock mínimo sugerido', texto: 'Lo que cada sede no debe dejar de tener', ruta: 'minimos' },
	{ icono: 'fa-cog', titulo: 'Configurar', texto: 'Sedes que participan, su almacén y cada cuánto piden', ruta: 'config' },
];

const SEDE = [
	{ icono: 'fa-shopping-basket', titulo: 'Pedir a la central', texto: 'La lista ya trae lo que te falta según lo que vendes', ruta: 'pedir' },
	{ icono: 'fa-list-alt', titulo: 'Mis pedidos', texto: 'Qué pediste y en qué va cada pedido', ruta: 'mis_pedidos' },
	{ icono: 'fa-truck', titulo: 'Recibir mercadería', texto: 'Cuenta lo que llegó de la central', ruta: 'recibir' },
	{ icono: 'fa-chain-broken', titulo: 'Registrar merma', texto: 'Algo se rompió, venció o se malogró', ruta: 'mermas' },
	{ icono: 'fa-clock-o', titulo: 'Por vencer en mi sede', texto: 'Lo que hay que vender primero', ruta: 'vencimientos' },
];

const AVISO = {
	no_participa: 'Esta sede todavía no participa en Logística. Pide a la central que la active en <b>Configurar</b>.',
};

// Fuera de la central: decir cual es y, al admin dentro del POS, ofrecer pasar a ella (lo que confundia al activar).
function avisoCentral(sesion) {
	const c = sesion.central;
	if (!c) { return ''; }
	const nombre = `<b>${esc(c.nombre)}</b>`;
	const enPos = typeof window.xCompSedeToll_CambiarSede === 'function';
	const salida = !sesion.es_admin ? 'Entra con un usuario de esa sede.'
		: enPos ? `<button class="btn btn-sm btn-success" id="lg_ir_central" style="margin-left:6px"><i class="fa fa-exchange"></i>Pasar a ${esc(c.nombre)}</button>`
		: 'Toca el nombre de la sede, arriba, y elígela.';
	return `<p class="inv-ayuda" style="margin-bottom:12px"><i class="fa fa-home"></i> La sede central es ${nombre}: comprar, armar el catálogo y despachar se hace desde ahí. ${salida}</p>`;
}

// Usa el mismo cambio de sede de la barra del POS (x-comp-sede-toolbar) y espera a que la sesion del servidor ya este en la central.
async function pasarACentral(c) {
	const lista = (window.xThisComToolSede && window.xThisComToolSede.listSede) || [];
	const idx = lista.findIndex(s => String(s.idsede) === String(c.idsede));
	if (idx < 0) { aviso(`Toca el nombre de la sede, arriba, y elige ${c.nombre}.`, 'error'); return; }
	window.xCompSedeToll_CambiarSede({ dataId: idx });
	for (let i = 0; i < 20; i++) {
		await new Promise(r => setTimeout(r, 400));
		if ((await refrescarSesion()).rol_logistica === 'central') { ir(''); return; }
	}
	// ponytail: 8 s sin respuesta = la sede esta suspendida o el POS fallo; el toolbar no avisa del error
	aviso(`No se pudo pasar a ${c.nombre}. Si esa sede está suspendida, actívala primero.`, 'error');
}

// Primera vez (empresa sin configurar): que es el modulo y que podra hacer, segun tenga uno o varios locales.
function bienvenida(sesion) {
	const sedes = sesion.sedes_empresa || [];
	const cadena = sedes.length > 1;
	const item = (i, t, d) => `<li><i class="fa ${i}"></i><div><b>${t}</b><span>${d}</span></div></li>`;
	const puede = cadena ? [
		item('fa-home', 'Un almacén central para todos', 'Una sede compra y guarda; las demás le piden a ella. Un solo catálogo de productos para toda la empresa.'),
		item('fa-shopping-basket', 'Las sedes piden con la lista ya armada', 'El sistema sugiere qué pedir según lo que cada local vende. El encargado solo revisa y envía.'),
		item('fa-truck', 'Envíos con chofer y aviso por WhatsApp', 'La central arma la ruta del día y la sede cuenta lo que llegó. Se ve qué falta o llegó de más.'),
		item('fa-file-text-o', 'Compras juntas a los proveedores', 'Lo que piden todas las sedes se junta en una sola orden por proveedor. Ves quién cumple y quién sube precios.'),
		item('fa-chain-broken', 'Cuánto se pierde en cada local', 'Mermas, productos por vencer y stock parado que conviene llevar a otra sede.'),
	] : [
		item('fa-file-text-o', 'Órdenes de compra a tus proveedores', 'El sistema arma la lista de lo que te falta. La mandas por WhatsApp y anotas lo que llegó.'),
		item('fa-star-half-o', 'Quién cumple y quién sube precios', 'Cada proveedor con su nota: si llega a tiempo, completo y si te subió el precio.'),
		item('fa-clock-o', 'Lo que vence y lo que se pierde', 'Productos por vencer, mermas registradas y cuánto dinero se va en cada una.'),
		item('fa-check-square-o', 'Conteo rápido sin cerrar el local', 'Unos pocos productos al día para encontrar faltantes a tiempo.'),
	];
	const pasos = cadena
		? ['Elige la sede central: la que compra y guarda la mercadería.', 'Marca las sedes que le piden a la central y el almacén donde recibe cada una.', 'Revisa el catálogo: los productos de la central pasan a ser de toda la empresa.']
		: ['Elige tu local como sede central (es la única).', 'Elige el almacén donde recibes la mercadería.', 'Revisa tus proveedores y crea tu primera orden de compra.'];
	return tarjeta({
		titulo: 'Bienvenido al Centro Logístico',
		ayuda: cadena
			? `Tu empresa tiene <b>${sedes.length} locales</b> (${esc(sedes.slice(0, 6).join(', '))}${sedes.length > 6 ? '…' : ''}). Aquí se ordena todo lo que se compra, se guarda y se reparte entre ellos.`
			: 'Aquí ordenas lo que compras, lo que llega y lo que se pierde en tu local.',
		cuerpo: `<p class="lg-bienv-sub">Lo que vas a poder hacer:</p><ul class="lg-bienv">${puede.join('')}</ul>
			<p class="lg-bienv-sub">Para empezar (5 minutos):</p><ol class="lg-bienv-pasos">${pasos.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
			${cadena ? '' : '<p class="inv-ayuda"><i class="fa fa-info-circle"></i> Si más adelante abres otro local, aquí mismo lo agregas y empieza a pedirle a la central.</p>'}
			<a class="btn btn-success lg-bienv-btn" href="#" data-ir="config"><i class="fa fa-cog"></i>Configurar Logística</a>
			<a class="btn btn-light lg-bienv-btn" href="#" data-ir="ayuda"><i class="fa fa-question-circle"></i>Ver la ayuda</a>`,
	});
}

export function render(cont, sesion) {
	const rol = sesion.rol_logistica;
	if (rol === 'sin_activar') { cont.innerHTML = bienvenida(sesion); return; }
	let mods = rol === 'central' ? CENTRAL : rol === 'sede' ? SEDE : CENTRAL.filter(m => m.ruta === 'config');
	// conteo rapido: solo si la empresa lo activo en Configurar
	if (sesion.conteo_rapido) {
		const c = [{ icono: 'fa-check-square-o', titulo: 'Conteo rápido de hoy', texto: 'Cuenta unos pocos productos: 2 minutos', ruta: 'conteo' }];
		if (rol === 'central') { c.push({ icono: 'fa-balance-scale', titulo: 'Conteos de las sedes', texto: 'Qué sede contó y dónde no cuadra el stock', ruta: 'conteos' }); }
		mods = [...c, ...mods];
	}
	// produccion: solo si la empresa la activo; la planta la ve primero (es su trabajo del dia)
	if (sesion.produccion && (rol === 'central' || rol === 'sede')) {
		const p = { icono: 'fa-flask', titulo: 'Producción', ruta: 'produccion',
			texto: rol === 'central' ? 'Qué producir para las sedes y las recetas de cada local'
				: sesion.es_planta ? 'Lo que piden las sedes: produce y despacha' : 'Tus recetas: mayonesa, ají de la casa, cremas' };
		mods = sesion.es_planta ? [p, ...mods] : [...mods, p];
	}
	mods = [...mods, { icono: 'fa-question-circle', titulo: 'Ayuda', texto: 'Cómo se usa cada pantalla, paso a paso', ruta: 'ayuda' }];   // siempre la ultima
	// central: primero el diagrama vivo (que hay pendiente y donde), debajo las opciones
	cont.innerHTML = (rol === 'central' ? tarjeta({
		titulo: 'Centro de operaciones logísticas',
		ayuda: 'Todo lo que se mueve en tu cadena, en vivo. Cada caja es una etapa y su número es lo que está esperando ahí. Las líneas que se mueven tienen algo por avanzar.',
		acciones: '<a class="btn btn-sm btn-light" href="#" data-ir="ayuda/diagrama" title="Qué significa cada caja"><i class="fa fa-question-circle"></i>Ayuda</a>',
		cuerpo: '<div id="lg_flujo"><p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p></div>',
	}) : '') + tarjeta({
		titulo: rol === 'sede' ? 'Logística · ' + sesion.sede : 'Centro Logístico',
		ayuda: `${esc(sesion.usuario)} · ${esc(sesion.sede)}` + (rol === 'central' ? ' (sede central)' : ''),
		cuerpo: `${avisoCentral(sesion)}${AVISO[rol] ? `<p class="inv-ayuda" style="margin-bottom:12px"><i class="fa fa-info-circle"></i> ${AVISO[rol]}</p>` : ''}
			<div class="lg-grid">${mods.map(m => m.ruta
				? `<a class="lg-mod" href="#" data-ir="${m.ruta}"><i class="fa ${m.icono}"></i><div><h4>${esc(m.titulo)}</h4><p>${esc(m.texto)}</p></div></a>`
				: `<div class="lg-mod off"><i class="fa ${m.icono}"></i><div><h4>${esc(m.titulo)}</h4><p>${esc(m.texto)} · próximamente</p></div></div>`
			).join('')}</div>`,
	});
	if (rol === 'central') { dibujarFlujo(cont.querySelector('#lg_flujo')); }
	const btnCentral = cont.querySelector('#lg_ir_central');
	if (btnCentral) { btnCentral.addEventListener('click', () => pasarACentral(sesion.central)); }
}
