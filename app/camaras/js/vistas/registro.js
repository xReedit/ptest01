// Registro (ruta "registro", desde el inicio): lo que pasó en las mesas en un rango de días, en dos pestañas:
// Sesiones (GET sesiones: cada vez que se ocupó una mesa) y Alertas (GET alertas). Las dos con api.lista, de la más
// nueva a la más vieja, de a 50: "Cargar más" pide la página siguiente con meta.cursor_siguiente (con null el botón no
// se ve) y queda deshabilitado mientras carga, así nunca hay dos cargas a la vez. Desde/hasta son hoy por defecto, con
// 150 días como máximo entre las dos, validado aquí antes de llamar. "Mostrar" filtra por alerta (solo= en sesiones,
// tipo= en alertas). Cambiar una fecha, el filtro o la pestaña busca de nuevo (sin botón Buscar); la respuesta de una
// búsqueda vieja no pisa la nueva y lo que llega después de salir (ctx.senal) no se pinta.
// Arriba, la planilla del día (GET planilla, CSV para Excel): 60 momentos al azar para comparar con la grabación del
// DVR (spec §22). Solo de los últimos 90 días (min/max del <input type="date">); fuera de eso, 400 dia_invalido.
// Las horas del servidor vienen en hora de Lima (-05:00) y se muestran tal cual: la hora de la PC no cuenta.
import { esc, tarjeta, volver } from '../ui.js?v=20261020i';

export const RANGO_MAX_DIAS = 150;   // entre desde y hasta; más, 400 rango_invalido
export const PLANILLA_DIAS = 90;     // hoy y los 89 anteriores; más atrás, 400 dia_invalido
const LIMA_MS = 5 * 3600e3;          // Lima es UTC−5 todo el año (no tiene horario de verano)
const DIA_MS = 86400e3;

const AYUDA = 'Lo que pasó en cada mesa: cuándo se ocupó, cuándo pidió, cuánto consumió y qué alertas hubo.';
const AYUDA_PLANILLA = 'Revisa 10 filas con la grabación del DVR y marca si el estado era correcto.';
const SIN_FECHAS = 'Elige las dos fechas.';
const AL_REVES = 'La fecha «Hasta» no puede ser antes que «Desde».';
const MUY_LARGO = `Puedes ver hasta ${RANGO_MAX_DIAS} días a la vez. Acorta las fechas.`;
const DIA_INVALIDO = 'Elige un día de los últimos 90 días.';
// el día operativo va del corte (hora_cierre_dia de la sede) al del día siguiente: entre las 00:00 y el corte, "hoy"
// todavía no empezó en el sistema (no se pide el corte al servidor: solo se explica)
const HOY_NO_EMPIEZA = 'El día de hoy todavía no empieza en el sistema; elige ayer.';
const CORTE_DIA = 'Si el local atiende pasada la medianoche, eso sale en el día de ayer.';
const GENERICO = 'Algo salió mal. Vuelve a intentar.';
const NO_SE_GUARDO = 'No se pudo guardar el archivo. Vuelve a intentar.';
// los códigos del servidor que esta pantalla explica; el resto, el texto simple que ya trae el error (api.js)
const TEXTO_ERROR = {
	rango_invalido: `Revisa las fechas. Puedes ver hasta ${RANGO_MAX_DIAS} días a la vez.`,
	cursor_invalido: 'La lista cambió mientras la veías. Elige las fechas de nuevo.',
	dia_invalido: DIA_INVALIDO,
};
const CARGANDO = '<p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p>';

const MOSTRAR = [
	{ valor: '', texto: 'Todas' },
	{ valor: 'cuenta_abierta', texto: 'Con cuenta abierta' },
	{ valor: 'sin_atencion', texto: 'Sin atención' },
];
const col = (texto, num = false) => ({ texto, num });
const PESTANAS = [
	{ ruta: 'sesiones', texto: 'Sesiones', filtro: 'solo', vacio: 'No hay mesas ocupadas en esas fechas.', una: 'sesión', varias: 'sesiones',
		columnas: [col('Mesa'), col('Entró'), col('Salió'), col('Minutos', true), col('Primer pedido'), col('Monto', true), col('Alerta')] },
	{ ruta: 'alertas', texto: 'Alertas', filtro: 'tipo', vacio: 'No hubo alertas en esas fechas.', una: 'alerta', varias: 'alertas',
		columnas: [col('Mesa'), col('Hora'), col('Alerta'), col('Aviso'), col('Se cerró'), col('Tardó (min)', true)] },
];
const TEXTO_ALERTA = { sin_atencion: 'Sin atención', cuenta_abierta: 'Cuenta abierta', por_limpiar: 'Por limpiar' };
const CERRADA_POR = {
	pedido: 'hicieron un pedido', pago: 'pagaron', limpieza: 'se limpió la mesa', manual: 'con «Ya lo vi»', silenciada: 'se silenció la mesa',
};
const DESTINO = { mozos: 'mozos', caja: 'caja' };
const propio = (mapa, k) => (typeof k === 'string' && Object.prototype.hasOwnProperty.call(mapa, k) ? mapa[k] : '');
const pestanaDe = ruta => PESTANAS.find(p => p.ruta === ruta) || PESTANAS[0];
const filtroValido = m => MOSTRAR.some(o => o.valor && o.valor === m);

/* ---------- fechas (se prueba en Node) ---------- */

/** Hoy en Lima ('YYYY-MM-DD') según el reloj de esta PC, sin importar su zona horaria. */
export const hoyLima = (ahoraMs = Date.now()) => new Date(ahoraMs - LIMA_MS).toISOString().slice(0, 10);

/** Medianoche UTC del día 'YYYY-MM-DD' en ms, o NaN si no es un día que exista (2026-02-30 no). */
function msDia(dia) {
	const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof dia === 'string' ? dia : '');
	if (!m) { return NaN; }
	const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
	return new Date(ms).toISOString().slice(0, 10) === dia ? ms : NaN;
}

/** El día n días después de dia (n negativo: antes). dia tiene que ser válido ('YYYY-MM-DD'). */
export const sumarDias = (dia, n) => new Date(msDia(dia) + n * DIA_MS).toISOString().slice(0, 10);

/** Los días que se pueden pedir de planilla: {min: hoy − 89, max: hoy} (los del <input type="date">). */
export const limitesDia = hoy => ({ min: sumarDias(hoy, -(PLANILLA_DIAS - 1)), max: hoy });

/** '' si desde/hasta sirven (hasta ≥ desde y hasta − desde ≤ 150 días); si no, el texto simple de qué cambiar. */
export function validarRango({ desde, hasta } = {}) {
	const a = msDia(desde);
	const b = msDia(hasta);
	if (!Number.isFinite(a) || !Number.isFinite(b)) { return SIN_FECHAS; }
	if (b < a) { return AL_REVES; }
	return (b - a) / DIA_MS > RANGO_MAX_DIAS ? MUY_LARGO : '';
}

/** '' si dia es de los últimos 90 días (hoy incluido); si no, "Elige un día de los últimos 90 días." */
export function validarDia(dia, hoy) {
	const { min, max } = limitesDia(hoy);
	return Number.isFinite(msDia(dia)) && dia >= min && dia <= max ? '' : DIA_INVALIDO;
}

/* ---------- la consulta ---------- */

/**
 * Ruta de api.lista: "sesiones?desde=…&hasta=…" + el filtro (solo= en sesiones, tipo= en alertas; "Todas" o un valor
 * que no es de la lista, ninguno) + el cursor de la página siguiente. filtros ya validados (validarRango).
 * @param {'sesiones'|'alertas'} pestana
 * @param {{desde: string, hasta: string, mostrar?: string}} filtros
 * @param {string|null} [cursor]
 */
export function rutaLista(pestana, { desde, hasta, mostrar } = {}, cursor = null) {
	const p = pestanaDe(pestana);
	const q = new URLSearchParams({ desde, hasta });
	if (filtroValido(mostrar)) { q.set(p.filtro, mostrar); }
	if (cursor) { q.set('cursor', cursor); }
	return `${p.ruta}?${q}`;
}

/**
 * El texto de un error: el de esta pantalla para su código o el texto simple que ya trae un ApiError (api.js, que
 * siempre tiene codigo string). Otro error es de programa: nunca se muestra su texto, solo el genérico y un aviso en
 * la consola para quien lo depure.
 */
function textoError(e) {
	if (e && typeof e.codigo === 'string') { return propio(TEXTO_ERROR, e.codigo) || e.message || GENERICO; }
	console.warn('Cámaras IA, Registro: error inesperado', e);
	return GENERICO;
}

/** La página que trajo api.lista sumada a las filas previas; cursor null si es la última (o no vino meta). */
function conPagina(r, previas) {
	const meta = r && r.meta && typeof r.meta === 'object' ? r.meta : null;
	const data = r && Array.isArray(r.data) ? r.data : [];
	const cursor = meta && typeof meta.cursor_siguiente === 'string' && meta.cursor_siguiente ? meta.cursor_siguiente : null;
	return { filas: [...previas, ...data], total: meta && Number.isInteger(meta.total) ? meta.total : null, cursor };
}

/**
 * La lista de la pantalla, sin DOM. estado(): {pestana, filtros, filas, total, cursor, cargando, error}.
 * buscar(pestana, filtros): valida el rango (si no sirve, no llama: queda el error) y pide la primera página;
 * una búsqueda nueva descarta la respuesta de la anterior. cargarMas(): la página siguiente con el cursor; no hace
 * nada sin cursor o mientras carga. Si falla, quedan las filas y el cursor para reintentar, salvo con cursor_invalido
 * (repetirlo daría el mismo error): ahí el cursor se limpia y queda solo el aviso. alCambiar(estado) se llama en cada
 * cambio (al empezar a cargar y al terminar); si lanza, el error sale tal cual (no se toma por un fallo de la red).
 * @param {{lista: (ruta: string) => Promise<{data: object[], meta: object|null}>}} api
 * @param {(estado: object) => void} [alCambiar]
 */
export function crearListado(api, alCambiar = () => {}) {
	let v = { pestana: 'sesiones', filtros: null, filas: [], total: null, cursor: null, cargando: false, error: '' };
	let consulta = 0;   // la búsqueda vigente: lo que responde una vieja se descarta
	const poner = cambios => {
		v = { ...v, ...cambios };
		alCambiar(v);
	};
	async function pedir(n, cursor, previas) {
		let r;
		try {
			r = await api.lista(rutaLista(v.pestana, v.filtros, cursor));
		} catch (e) {
			if (n !== consulta) { return; }
			const sinCursor = e && e.codigo === 'cursor_invalido' ? { cursor: null } : {};
			poner({ cargando: false, error: textoError(e), ...sinCursor });
			return;
		}
		if (n === consulta) { poner({ ...conPagina(r, previas), cargando: false }); }
	}
	return {
		estado: () => v,
		buscar(pestana, filtros) {
			const n = ++consulta;
			const error = validarRango(filtros);
			poner({ pestana: pestanaDe(pestana).ruta, filtros: { ...filtros }, filas: [], total: null, cursor: null, cargando: !error, error });
			return error ? Promise.resolve() : pedir(n, null, []);
		},
		cargarMas() {
			if (v.cargando || !v.cursor) { return Promise.resolve(); }
			poner({ cargando: true, error: '' });
			return pedir(consulta, v.cursor, v.filas);
		},
	};
}

/* ---------- la tabla (se prueba en Node) ---------- */

/** Fecha y hora de una hora del servidor (2026-10-19T12:03:41-05:00), leídas tal cual; null si no es eso. */
function partes(iso) {
	const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(typeof iso === 'string' ? iso : '');
	return m ? { fecha: `${m[1]}-${m[2]}-${m[3]}`, dia: `${m[3]}/${m[2]}`, hora: `${m[4]}:${m[5]}` } : null;
}

/** "19/10 12:03"; '—' si no hay hora. */
function conDia(iso) {
	const p = partes(iso);
	return p ? `${p.dia} ${p.hora}` : '—';
}

/** "12:48" si es el mismo día que base; si no, "20/10 00:15". '—' si no hay hora. */
function despues(iso, base) {
	const p = partes(iso);
	if (!p) { return '—'; }
	const b = partes(base);
	return b && b.fecha === p.fecha ? p.hora : `${p.dia} ${p.hora}`;
}

const segundos = s => Number.isInteger(s) && s >= 0;
const minutos = s => (segundos(s) ? String(Math.floor(s / 60)) : '—');
const primerPedido = s => {
	if (!segundos(s)) { return '—'; }
	return s < 60 ? 'en menos de 1 min' : `a los ${Math.floor(s / 60)} min`;
};

/** "S/ 75.00"; '—' si el monto todavía no se sabe (null) o no es un número. */
export const textoMonto = m => (typeof m === 'number' && Number.isFinite(m) ? `S/ ${m.toFixed(2)}` : '—');

/** Las alertas que tuvo una sesión, en palabras: "Sin atención, cuenta abierta"; '—' si ninguna. Nunca el código. */
export function textoAlertas(tipos) {
	const textos = (Array.isArray(tipos) ? tipos : []).map(t => propio(TEXTO_ALERTA, t)).filter(Boolean);
	return textos.length ? textos.map((t, i) => (i ? t.toLowerCase() : t)).join(', ') : '—';
}

/**
 * Si la alerta se avisó: solo se anotó (solo medir o nadie a quien avisar), se avisó (a quiénes), no se avisó (ya se
 * cerró sin avisarse) o todavía no (sigue abierta).
 */
function textoAviso(a) {
	if (a.no_enviar) { return { texto: 'Solo se anotó', sub: '' }; }
	if (!a.enviada) { return { texto: a.resuelta_en ? 'No se avisó' : 'Todavía no se avisó', sub: '' }; }
	const quienes = (Array.isArray(a.destinatarios) ? a.destinatarios : []).map(d => propio(DESTINO, d)).filter(Boolean);
	return { texto: 'Se avisó', sub: quienes.length ? `a ${quienes.join(' y ')}` : '' };
}

function textoCerrada(a) {
	if (!a.resuelta_en) { return 'Sigue abierta'; }
	const por = propio(CERRADA_POR, a.resuelta_por);
	return por ? `${despues(a.resuelta_en, a.creada)} · ${por}` : despues(a.resuelta_en, a.creada);
}

const td = (texto, { num = false, sub = '' } = {}) =>
	`<td${num ? ' class="inv-num"' : ''}>${esc(texto)}${sub ? `<span class="inv-sub">${esc(sub)}</span>` : ''}</td>`;

const filaSesion = s => `<tr>${td(s.mesa, { sub: s.area || '' })}${td(conDia(s.inicio))}`
	+ `${td(s.fin ? despues(s.fin, s.inicio) : 'Sigue en la mesa')}${td(minutos(s.duracion_seg), { num: true })}`
	+ `${td(primerPedido(s.atencion_seg))}${td(textoMonto(s.monto), { num: true })}${td(textoAlertas(s.alertas))}</tr>`;

function filaAlerta(a) {
	const aviso = textoAviso(a);
	return `<tr>${td(a.mesa)}${td(conDia(a.creada))}${td(propio(TEXTO_ALERTA, a.tipo) || '—')}`
		+ `${td(aviso.texto, { sub: aviso.sub })}${td(textoCerrada(a))}${td(minutos(a.respuesta_seg), { num: true })}</tr>`;
}

/**
 * Las filas (<tr>) de la tabla de la pestaña; sin filas, una que dice qué hacer. mostrar: el filtro elegido (con uno
 * puesto, sugiere volver a «Mostrar: todas»). terminaHoy: el rango termina hoy; vacía, avisa que lo de pasada la
 * medianoche (antes del corte del día) sale en el día de ayer. Todo lo del servidor va escapado.
 * @param {'sesiones'|'alertas'} pestana
 * @param {object[]} filas
 * @param {{mostrar?: string, terminaHoy?: boolean}} [o]
 */
export function htmlFilas(pestana, filas, { mostrar = '', terminaHoy = false } = {}) {
	const p = pestanaDe(pestana);
	const lista = (Array.isArray(filas) ? filas : []).filter(f => f && typeof f === 'object');
	if (!lista.length) {
		const otra = filtroValido(mostrar) ? ' Prueba con otras fechas o con «Mostrar: todas».' : ' Prueba con otras fechas.';
		const corte = terminaHoy ? ` ${CORTE_DIA}` : '';
		return `<tr><td class="inv-empty" colspan="${p.columnas.length}">${esc(p.vacio + otra + corte)}</td></tr>`;
	}
	return lista.map(p.ruta === 'alertas' ? filaAlerta : filaSesion).join('');
}

function htmlTabla(v) {
	if (v.cargando && !v.filas.length) { return CARGANDO; }
	if (v.error && !v.filas.length) { return ''; }
	const p = pestanaDe(v.pestana);
	const f = v.filtros || {};
	const cab = p.columnas.map(c => `<th${c.num ? ' class="inv-num"' : ''}>${esc(c.texto)}</th>`).join('');
	return `<table class="inv-table"><thead><tr>${cab}</tr></thead>`
		+ `<tbody>${htmlFilas(v.pestana, v.filas, { mostrar: f.mostrar, terminaHoy: f.hasta === hoyLima() })}</tbody></table>`;
}

/**
 * El aviso de error de la lista ('' sin error). Si falló la primera página (sin filas ni cursor) con un rango que
 * sirve, trae Reintentar: vuelve a buscar con la misma pestaña y los mismos filtros.
 */
export function htmlAviso(v) {
	if (!v.error) { return ''; }
	const reintentar = !v.cargando && !v.filas.length && !v.cursor && v.filtros && !validarRango(v.filtros)
		? ' <button class="btn btn-sm btn-light" type="button" data-acc="reintentar" style="margin-left:8px;vertical-align:middle">'
			+ '<i class="fa fa-refresh"></i>Reintentar</button>'
		: '';
	return `<p class="cm-alerta"><i class="fa fa-exclamation-triangle"></i>${esc(v.error)}${reintentar}</p>`;
}

function htmlResumen(v) {
	const n = v.filas.length;
	if (!n) { return ''; }
	const p = pestanaDe(v.pestana);
	const nombre = k => (k === 1 ? p.una : p.varias);
	return esc(Number.isInteger(v.total) ? `Mostrando ${n} de ${v.total} ${nombre(v.total)}` : `${n} ${nombre(n)}`);
}

const MAS_CARGANDO = '<i class="fa fa-spinner fa-spin"></i>Cargando…';
const MAS_LISTO = '<i class="fa fa-chevron-down"></i>Cargar más';

/** El botón Cargar más: '' sin cursor (última página); deshabilitado mientras carga. */
export function htmlMas(v) {
	if (!v.cursor) { return ''; }
	return `<button class="btn btn-sm btn-light" type="button" data-acc="mas"${v.cargando ? ' disabled' : ''}>`
		+ `${v.cargando ? MAS_CARGANDO : MAS_LISTO}</button>`;
}

const htmlPestanas = actual => PESTANAS.map(p => `<button class="inv-seg-item${p.ruta === actual ? ' activa' : ''}" type="button"`
	+ ` data-pestana="${p.ruta}" aria-pressed="${p.ruta === actual}">${esc(p.texto)}</button>`).join('');

/* ---------- la planilla ---------- */

/** planilla-2026-10-19.csv (el mismo nombre que da el servidor). */
export const nombrePlanilla = dia => `planilla-${dia}.csv`;

/**
 * Descarga la planilla del día: valida que sea de los últimos 90 días (si no, no llama), GET planilla?dia= (CSV,
 * api.blob) y la entrega a guardar(blob, nombre). {ok: true, nombre} | {ok: false, texto} con el texto simple.
 * hoy es hoyLima(): si el servidor dice dia_invalido para hoy, es que todavía no pasó el corte del día.
 * @param {{blob: (ruta: string) => Promise<{blob: Blob}>}} api
 * @param {(blob: Blob, nombre: string) => void} guardar
 */
export async function descargarPlanilla(api, dia, hoy, guardar) {
	const mal = validarDia(dia, hoy);
	if (mal) { return { ok: false, texto: mal }; }
	let blob;
	try {
		({ blob } = await api.blob('planilla?dia=' + encodeURIComponent(dia)));
	} catch (e) {
		const hoyNoEmpieza = !!e && e.codigo === 'dia_invalido' && dia === hoy;
		return { ok: false, texto: hoyNoEmpieza ? HOY_NO_EMPIEZA : textoError(e) };
	}
	const nombre = nombrePlanilla(dia);
	try {
		guardar(blob, nombre);
	} catch (e) {
		console.warn('Cámaras IA, Registro: no se pudo guardar la planilla', e);
		return { ok: false, texto: NO_SE_GUARDO };
	}
	return { ok: true, nombre };
}

/* ---------- pantalla ---------- */

function htmlCuerpo(hoy) {
	const { min, max } = limitesDia(hoy);
	const fecha = (nombre, etiqueta, extra = '') => `<label class="inv-field"><span class="inv-label">${etiqueta}</span>`
		+ `<input type="date" class="inv-input" name="${nombre}" value="${hoy}"${extra}></label>`;
	return `<div class="rg">
		<div class="rg-planilla">
			<div class="rg-planilla-txt"><p class="cm-sub">Planilla del día</p><p class="inv-ayuda">${esc(AYUDA_PLANILLA)}</p></div>
			${fecha('dia', 'Día', ` min="${min}" max="${max}"`)}
			<button class="btn btn-sm btn-light" type="button" data-acc="planilla"><i class="fa fa-download"></i>Descargar planilla del día</button>
			<div class="rg-planilla-msg" aria-live="polite"></div>
		</div>
		<div class="inv-seg rg-pestanas" role="group" aria-label="Qué ver">${htmlPestanas('sesiones')}</div>
		<div class="inv-toolbar">
			${fecha('desde', 'Desde')}${fecha('hasta', 'Hasta')}
			<label class="inv-field"><span class="inv-label">Mostrar</span><select class="inv-select" name="mostrar">`
		+ `${MOSTRAR.map(o => `<option value="${o.valor}">${esc(o.texto)}</option>`).join('')}</select></label>
		</div>
		<div class="rg-aviso" aria-live="polite"></div>
		<p class="inv-resumen rg-total"></p>
		<div class="inv-table-wrap rg-tabla">${CARGANDO}</div>
		<div class="rg-mas"></div>
	</div>`;
}

export async function render(cont, { api, senal }) {
	const hoy = hoyLima();
	// lo de esta pantalla que no es la lista (se descarta entero al salir)
	const x = { cont, senal, api, pintado: new Map(), dia: hoy, bajando: false, url: '' };
	cont.innerHTML = tarjeta({ titulo: 'Registro', ayuda: esc(AYUDA), acciones: volver(''), cuerpo: htmlCuerpo(hoy) });
	senal.addEventListener('abort', () => soltarArchivo(x), { once: true });
	const listado = crearListado(api, v => mostrar(x, v));
	const card = cont.querySelector('.inv-card');
	card.addEventListener('change', e => { alCambiar(e, x, listado); });
	card.addEventListener('click', e => { alClic(e, x, listado); });
	await listado.buscar('sesiones', { desde: hoy, hasta: hoy, mostrar: '' });
}

/** innerHTML solo si cambió (un botón no se reemplaza si no hace falta). */
function pintar(x, selector, html) {
	const el = x.cont.querySelector(selector);
	if (!el || x.pintado.get(selector) === html) { return; }
	el.innerHTML = html;
	x.pintado.set(selector, html);
}

/** Las pestañas: solo cambian la clase y aria-pressed de los mismos botones (el que se tocó conserva el foco). */
function pintarPestanas(x, actual) {
	const el = x.cont.querySelector('.rg-pestanas');
	const botones = el && typeof el.querySelectorAll === 'function' ? Array.from(el.querySelectorAll('[data-pestana]')) : [];
	if (!botones.length) { pintar(x, '.rg-pestanas', htmlPestanas(actual)); return; }
	for (const b of botones) {
		const si = b.dataset.pestana === actual;
		b.classList.toggle('activa', si);
		b.setAttribute('aria-pressed', String(si));
	}
}

/** Cargar más: si el botón ya está y sigue haciendo falta, cambia disabled y su texto sin reemplazarlo. */
function pintarMas(x, v) {
	const el = x.cont.querySelector('.rg-mas');
	const b = v.cursor && el && typeof el.querySelector === 'function' ? el.querySelector('[data-acc="mas"]') : null;
	if (!b) { pintar(x, '.rg-mas', htmlMas(v)); return; }
	b.disabled = v.cargando;
	b.innerHTML = v.cargando ? MAS_CARGANDO : MAS_LISTO;
	x.pintado.set('.rg-mas', htmlMas(v));
}

function mostrar(x, v) {
	if (x.senal.aborted) { return; }
	pintarPestanas(x, v.pestana);
	pintar(x, '.rg-aviso', htmlAviso(v));
	pintar(x, '.rg-total', htmlResumen(v));
	pintar(x, '.rg-tabla', htmlTabla(v));
	pintarMas(x, v);
}

/** Cambió una fecha o el filtro: busca de nuevo con la pestaña de ahora. El día de la planilla solo se anota. */
function alCambiar(e, x, listado) {
	const { name, value } = e.target || {};
	if (name === 'dia') {
		x.dia = String(value ?? '');
		pintar(x, '.rg-planilla-msg', '');
		return;
	}
	if (name !== 'desde' && name !== 'hasta' && name !== 'mostrar') { return; }
	const v = listado.estado();
	listado.buscar(v.pestana, { ...v.filtros, [name]: String(value ?? '') });
}

function alClic(e, x, listado) {
	const b = e.target.closest('[data-acc], [data-pestana]');
	if (!b) { return; }
	const v = listado.estado();
	if (b.dataset.pestana) {
		if (b.dataset.pestana !== v.pestana) { listado.buscar(b.dataset.pestana, v.filtros); }
		return;
	}
	if (b.dataset.acc === 'mas') { listado.cargarMas(); return; }
	if (b.dataset.acc === 'reintentar') { listado.buscar(v.pestana, v.filtros); return; }
	if (b.dataset.acc === 'planilla') { bajarPlanilla(b, x); }
}

/** Descargar planilla del día: una a la vez (el botón deshabilitado mientras baja). */
async function bajarPlanilla(b, x) {
	if (x.bajando) { return; }
	x.bajando = true;
	b.disabled = true;
	pintar(x, '.rg-planilla-msg', '<p class="cm-buscando"><i class="fa fa-spinner fa-spin"></i>Preparando la planilla…</p>');
	let r;
	try {
		r = await descargarPlanilla(x.api, x.dia, hoyLima(), (blob, nombre) => entregar(x, blob, nombre));
	} finally {
		x.bajando = false;
		b.disabled = false;
	}
	if (x.senal.aborted || r.ok) { return; }
	pintar(x, '.rg-planilla-msg', `<p class="cm-falla"><i class="fa fa-exclamation-triangle"></i>${esc(r.texto)}</p>`);
}

/** El CSV ya llegó: un enlace planilla-<dia>.csv que se descarga solo (y queda por si el navegador lo frenó). */
function entregar(x, blob, nombre) {
	if (x.senal.aborted) { return; }
	soltarArchivo(x);
	x.url = URL.createObjectURL(blob);
	pintar(x, '.rg-planilla-msg', `<p class="cm-listo"><i class="fa fa-check"></i>Listo. Si no se descargó sola, toca `
		+ `<a class="inv-link" href="${esc(x.url)}" download="${esc(nombre)}"><i class="fa fa-file-excel-o"></i>${esc(nombre)}</a></p>`);
	const a = x.cont.querySelector('.rg-planilla-msg a');
	if (a && typeof a.click === 'function') { a.click(); }
}

/** Suelta el CSV en memoria (al bajar otro o al salir de la pantalla). */
function soltarArchivo(x) {
	if (!x.url) { return; }
	URL.revokeObjectURL(x.url);
	x.url = '';
}
