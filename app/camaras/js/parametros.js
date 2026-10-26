// Parámetros de la sede (GET/PUT /api/v1/parametros del servidor de Cámaras IA; campos, rangos y codigos de error en
// api/openapi.yaml de papaya-vision, validacion en internal/servidor/parametros.go). Sin DOM: se prueba en Node.
// form es lo que muestra la pantalla: los tiempos en segundos (recordatorio 0 = "No"), destinatarios por tipo de
// alerta y el horario por dia (dias: 7 filas, 1 = lunes … 7 = domingo, hasta 2 turnos). aCuerpo(form) lo pasa al
// cuerpo del PUT, que REEMPLAZA todo: por eso viaja tambien lo que no se muestra (por limpiar, hasta F3).

// relativo a este archivo (app/camaras/js/), no a la pagina: sirve igual dentro del POS
const URL_HORARIO = new URL('../../../bdphp/log_vision.php?op=horario', import.meta.url).href;
const LIMITE_HORARIO_MS = 10e3;   // el horario del POS es solo una ayuda: si no llega, la pantalla sale sin el
const HORA = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;   // la de servidor/parametros.go (formatoHora)
const RECORDATORIO_APAGADO = 300;   // "Recordar: No" va como recordatorio_activo false con un recordatorio_seg valido

export const TIPOS = ['sin_atencion', 'cuenta_abierta', 'por_limpiar'];
const PARA = ['mozos', 'caja'];   // en este orden se mandan

/** Segundos que se pueden elegir en cada select (dentro de los rangos del servidor). */
export const OPCIONES = {
	ocupar_seg: [30, 60, 120, 180, 300],
	sin_atencion_seg: [180, 300, 480, 600, 900],
	vaciar_seg: [120, 180, 300, 600],
	espera_caja_seg: [0, 300, 600, 900, 1200, 1800],
	recordatorio_seg: [0, 180, 300, 600],   // 0 = No (recordatorio_activo false)
};

/** El texto de cada tiempo en la pantalla (tambien para los avisos de error). */
export const ETIQUETAS = {
	ocupar_seg: 'Para marcar una mesa como ocupada',
	sin_atencion_seg: 'Para avisar que nadie atiende',
	vaciar_seg: 'Para marcar una mesa como libre',
	espera_caja_seg: 'Para avisar una cuenta sin cobrar',
	recordatorio_seg: 'Para recordar un aviso',
};

/** Debajo de cada tiempo, qué hace, en palabras simples. */
export const AYUDAS_TIEMPO = {
	ocupar_seg: 'Cuánto tiempo seguido tiene que haber alguien sentado. Así no cuenta a quien solo pasa.',
	sin_atencion_seg: 'Si los clientes se sientan y en este tiempo no hay ningún pedido en el sistema, se avisa.',
	vaciar_seg: 'Cuánto tiempo seguido tiene que estar vacía. Así no se libera si alguien va un rato al baño.',
	espera_caja_seg: 'Cuando los clientes se van y la cuenta sigue abierta, cuánto esperar a que caja cobre antes de avisar.',
	recordatorio_seg: 'Si nadie toca «Ya lo vi», el aviso se repite una vez después de este tiempo.',
};

/**
 * Copia de ocupacion.DestinatariosPorDefecto (papaya-vision internal/ocupacion/sesion.go): mozos y caja, salvo la
 * cuenta abierta con pago en caja, que va solo a caja. Si cambia alla, cambiar aqui.
 */
export const DESTINATARIOS_POR_DEFECTO = {
	caja: { sin_atencion: ['mozos', 'caja'], cuenta_abierta: ['caja'], por_limpiar: ['mozos', 'caja'] },
	mesa: { sin_atencion: ['mozos', 'caja'], cuenta_abierta: ['mozos', 'caja'], por_limpiar: ['mozos', 'caja'] },
};

// como en Go: cualquier modo de pago que no sea "mesa" usa los de caja
const porDefecto = (tipo, modoPago) => (DESTINATARIOS_POR_DEFECTO[modoPago === 'mesa' ? 'mesa' : 'caja'][tipo] || PARA);

/** Lista de destinatarios limpia y en orden (mozos, caja); null si no es una lista. */
const limpiarPara = lista => (Array.isArray(lista) ? PARA.filter(d => lista.includes(d)) : null);
const mismos = (a, b) => a.length === b.length && a.every(d => b.includes(d));

export const DIAS = [
	{ n: 1, nombre: 'Lunes' }, { n: 2, nombre: 'Martes' }, { n: 3, nombre: 'Miércoles' }, { n: 4, nombre: 'Jueves' },
	{ n: 5, nombre: 'Viernes' }, { n: 6, nombre: 'Sábado' }, { n: 7, nombre: 'Domingo' },
];
const TURNOS = 2;   // 7 dias × 2 turnos = 14, el maximo de franjas del servidor
const vacio = () => ({ de: '', a: '' });

/* ---------- horario del POS (bdphp/log_vision.php?op=horario) ---------- */

/**
 * Filas de sede_horario_trabajo ({numdia: "2,3,4,", de, a}) a franjas [{dias, de, a}]. Los dias del legacy son
 * 1 = domingo … 7 = sabado: a ISO (1 = lunes … 7 = domingo) con d == 1 ? 7 : d − 1. Un de/a que no es HH:MM descarta
 * la fila (no se inventa una hora); una fila sin dias validos tambien.
 */
export function horarioDesdeSede(filas) {
	if (!Array.isArray(filas)) { return []; }
	const r = [];
	for (const f of filas) {
		const de = String((f && f.de) ?? '').trim();
		const a = String((f && f.a) ?? '').trim();
		if (!HORA.test(de) || !HORA.test(a)) { continue; }
		const legacy = String((f && f.numdia) ?? '').split(',').map(s => s.trim()).filter(s => /^[1-7]$/.test(s)).map(Number);
		const dias = [...new Set(legacy.map(d => (d === 1 ? 7 : d - 1)))].sort((x, y) => x - y);
		if (dias.length) { r.push({ dias, de, a }); }
	}
	return r;
}

/**
 * Se precarga el horario del POS solo si la sede nunca guardo parametros (GET los da por defecto, con cambiado_en
 * null: ver la openapi) y no hay horario. Si ya guardo, un horario vacio es lo que eligio: abierto todo el dia.
 */
export const debePrecargar = p => p.cambiado_en == null && !(Array.isArray(p.horario) && p.horario.length);

/**
 * Senal que se corta a los ms o, antes, al cortarse senal (la de la pantalla). Navegador sin AbortSignal.any o
 * timeout (Chrome < 103): AbortController + setTimeout, el mismo fallback de api.js (limite).
 */
function corte(ms, senal) {
	if (typeof AbortSignal.any === 'function' && typeof AbortSignal.timeout === 'function') {
		const tope = AbortSignal.timeout(ms);
		return senal ? AbortSignal.any([senal, tope]) : tope;
	}
	const c = new AbortController();
	const cortar = () => c.abort();
	setTimeout(() => { if (senal) { senal.removeEventListener('abort', cortar); } c.abort(); }, ms);
	if (senal && senal.aborted) { c.abort(); } else if (senal) { senal.addEventListener('abort', cortar, { once: true }); }
	return c.signal;
}

/**
 * El horario de trabajo que el POS tiene para su sede (la de la sesion PHP), como franjas. senal: la de la pantalla
 * (al salir se corta). Si no se pudo (sin red, sesion vencida, PHP caido, se salio o tarda mas de 10 s) devuelve []
 * sin error: la pantalla sigue sin horario.
 */
export async function cargarHorarioSede(fetchFn = (...a) => fetch(...a), senal = null, ms = LIMITE_HORARIO_MS) {
	try {
		const res = await fetchFn(URL_HORARIO, {
			method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
			signal: corte(ms, senal),
		});
		const json = JSON.parse(await res.text());
		return json && json.success ? horarioDesdeSede(json.data) : [];
	} catch (e) {
		return [];
	}
}

/* ---------- horario por dia ---------- */

/** Franjas [{dias, de, a}] a los 7 dias de la pantalla: [{dia, abre, turnos: [{de, a}, {de, a}]}] ('' = sin turno). */
export function diasDesdeFranjas(franjas) {
	const validas = (Array.isArray(franjas) ? franjas : [])
		.filter(f => f && Array.isArray(f.dias) && HORA.test(f.de) && HORA.test(f.a));
	return DIAS.map(({ n }) => {
		const turnos = [];
		for (const f of validas) {
			if (f.dias.includes(n) && !turnos.some(x => x.de === f.de && x.a === f.a)) { turnos.push({ de: f.de, a: f.a }); }
		}
		turnos.sort((x, y) => x.de.localeCompare(y.de));
		const filas = turnos.slice(0, TURNOS);
		while (filas.length < TURNOS) { filas.push(vacio()); }
		return { dia: n, abre: turnos.length > 0, turnos: filas };
	});
}

/** Los dias abiertos a franjas: los dias con el mismo turno van juntos. Ningun dia abierto = [] (sin horario, 24 h). */
export function franjasDesdeDias(dias) {
	const porTurno = new Map();   // "de|a" → franja, en orden de aparicion
	for (const d of dias || []) {
		if (!d.abre) { continue; }
		for (const t of d.turnos) {
			if (!HORA.test(t.de) || !HORA.test(t.a)) { continue; }
			const k = t.de + '|' + t.a;
			if (!porTurno.has(k)) { porTurno.set(k, { dias: [], de: t.de, a: t.a }); }
			const f = porTurno.get(k);
			if (!f.dias.includes(d.dia)) { f.dias.push(d.dia); }
		}
	}
	return [...porTurno.values()];
}

/** '' si el horario se puede guardar; si no, que revisar (el primer dia con problemas). */
function errorDias(dias) {
	for (const d of dias || []) {
		if (!d.abre) { continue; }
		const nombre = (DIAS.find(x => x.n === d.dia) || {}).nombre || '';
		const [t1, t2 = vacio()] = d.turnos;
		if (!HORA.test(t1.de) || !HORA.test(t1.a)) { return `Revisa el horario del ${nombre}: pon a qué hora abre y a qué hora cierra.`; }
		const segundoVacio = t2.de === '' && t2.a === '';
		if (!segundoVacio && (!HORA.test(t2.de) || !HORA.test(t2.a))) {
			return `Revisa el horario del ${nombre}: el segundo turno necesita las dos horas, o déjalo vacío.`;
		}
	}
	return '';
}

/* ---------- formulario ---------- */

/** Lo que responde GET (o PUT) parametros, como lo muestra la pantalla. */
export function formDesde(p) {
	const destinatarios = {};
	for (const tipo of TIPOS) {
		destinatarios[tipo] = limpiarPara(p.destinatarios && p.destinatarios[tipo]) || porDefecto(tipo, p.modo_pago);
	}
	return {
		modo: p.modo, modo_pago: p.modo_pago,
		ocupar_seg: p.ocupar_seg, sin_atencion_seg: p.sin_atencion_seg, vaciar_seg: p.vaciar_seg, espera_caja_seg: p.espera_caja_seg,
		recordatorio_seg: p.recordatorio_activo ? p.recordatorio_seg : 0,
		por_limpiar_seg: p.por_limpiar_seg,
		destinatarios,
		dias: diasDesdeFranjas(p.horario),
	};
}

/**
 * '' si form se puede guardar; si no, el texto simple de lo que hay que revisar. Con pago en la mesa la espera de
 * caja no se muestra (no se usa) y no se valida: va la que vino del servidor (leerFormulario).
 */
export function validar(form) {
	if (form.modo !== 'solo_medir' && form.modo !== 'alertar') { return 'Elige una opción en «¿Qué hacemos con las alertas?».'; }
	if (form.modo_pago !== 'caja' && form.modo_pago !== 'mesa') { return 'Elige una opción en «¿Dónde pagan los clientes?».'; }
	for (const campo of Object.keys(OPCIONES)) {
		if (campo === 'espera_caja_seg' && form.modo_pago === 'mesa') { continue; }
		if (!OPCIONES[campo].includes(form[campo])) { return `Elige uno de los tiempos de la lista en «${ETIQUETAS[campo]}».`; }
	}
	return errorDias(form.dias);
}

/**
 * Cuerpo del PUT parametros. Recordatorio 0 → recordatorio_activo false (con 300). En destinatarios van solo los tipos
 * que difieren de los por defecto de su modo de pago: los demas se omiten y asi siguen al modo de pago si cambia.
 */
export function aCuerpo(form) {
	const recordar = form.recordatorio_seg > 0;
	const destinatarios = {};
	for (const tipo of TIPOS) {
		const para = limpiarPara(form.destinatarios && form.destinatarios[tipo]);
		if (para && !mismos(para, porDefecto(tipo, form.modo_pago))) { destinatarios[tipo] = para; }
	}
	return {
		modo: form.modo,
		modo_pago: form.modo_pago,
		ocupar_seg: form.ocupar_seg,
		sin_atencion_seg: form.sin_atencion_seg,
		vaciar_seg: form.vaciar_seg,
		espera_caja_seg: form.espera_caja_seg,
		por_limpiar_seg: Number.isInteger(form.por_limpiar_seg) ? form.por_limpiar_seg : null,   // null = el por defecto
		recordatorio_seg: recordar ? form.recordatorio_seg : RECORDATORIO_APAGADO,
		recordatorio_activo: recordar,
		destinatarios,
		horario: franjasDesdeDias(form.dias),
	};
}

/**
 * Al cambiar el modo de pago: los tipos que estaban en el default del modo viejo pasan al del nuevo (siguen al modo
 * de pago, como en el servidor); los elegidos a mano quedan. Devuelve un objeto nuevo.
 */
export function destinatariosAlCambiarPago(destinatarios, viejo, nuevo) {
	const r = {};
	for (const tipo of TIPOS) {
		const para = limpiarPara(destinatarios[tipo]) || porDefecto(tipo, viejo);
		r[tipo] = mismos(para, porDefecto(tipo, viejo)) ? [...porDefecto(tipo, nuevo)] : para;
	}
	return r;
}

/* ---------- errores del PUT ---------- */

const NO_SE_PUDO = 'No se pudo guardar. Vuelve a entrar a esta pantalla y prueba otra vez.';

/**
 * El error de guardar en palabras simples. PUT parametros responde 400 parametro_invalido:<campo> o pedido_invalido
 * (ver la openapi); el resto ya viene con su texto simple de api.js. Nunca se muestra el codigo crudo.
 */
export function textoError(e) {
	const codigo = String((e && e.codigo) || '');
	if (codigo === 'pedido_invalido') { return NO_SE_PUDO; }
	if (!codigo.startsWith('parametro_invalido:')) { return (e && e.message) || NO_SE_PUDO; }
	const campo = codigo.slice('parametro_invalido:'.length);
	if (Object.prototype.hasOwnProperty.call(ETIQUETAS, campo)) { return `Elige uno de los tiempos de la lista en «${ETIQUETAS[campo]}» y vuelve a guardar.`; }
	if (campo === 'modo') { return 'Elige una opción en «¿Qué hacemos con las alertas?» y vuelve a guardar.'; }
	if (campo === 'modo_pago') { return 'Elige una opción en «¿Dónde pagan los clientes?» y vuelve a guardar.'; }
	if (campo === 'destinatarios' || campo.startsWith('destinatarios.')) { return 'Revisa a quién avisar en cada alerta y vuelve a guardar.'; }
	if (campo === 'horario') { return 'Revisa el horario: cada día abierto necesita la hora en que abre y la hora en que cierra.'; }
	return NO_SE_PUDO;   // un campo que el servidor no conoce: la pantalla esta desactualizada
}
