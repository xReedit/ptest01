// Parámetros de la sede (ruta "parametros", desde el inicio): qué hacemos con las alertas, dónde pagan, los tiempos
// (un select nativo por tiempo), a quién avisar cada alerta y el horario por día. Guardar → PUT parametros, que
// reemplaza todo (parametros.js arma el cuerpo). Si la sede nunca guardó parámetros y no tiene horario, se precarga
// el del POS (op=horario) sin hacer esperar a la pantalla: llega después y completa el horario solo si todavía no lo
// tocaron; si no llega, queda sin horario (24 h) y sin error. Si ya guardó, sin horario = abierto todo el día.
// Por limpiar no se muestra hasta F3. Salir con cambios sin guardar pregunta (ctx.alSalir), como mesas.js; mientras
// guarda, el formulario queda deshabilitado y salir no pregunta (el PUT termina igual, api.js).
import { esc, tarjeta, volver, aviso, confirmar } from '../ui.js?v=20261020i';
import { vigente } from '../router.js?v=20261020i';
import {
	OPCIONES, ETIQUETAS, AYUDAS_TIEMPO, DIAS, TIPOS, formDesde, validar, aCuerpo, textoError, destinatariosAlCambiarPago,
	diasDesdeFranjas, cargarHorarioSede, debePrecargar,
} from '../parametros.js?v=20261020i';

const AYUDA = 'Cómo trabajan las cámaras en este local: cuándo una mesa está ocupada, cuándo avisar y a quién.';
// una línea por opción: qué pasa en el local con cada una
const AYUDA_MODO = [
	['Solo medir', 'las cámaras miden las mesas, pero nadie recibe avisos y Control de pedidos se ve como siempre. Úsalo los primeros días, mientras revisas en «En vivo» que las cámaras acierten.'],
	['Medir y avisar', 'se avisa cuando nadie atiende una mesa o cuando se vacía con la cuenta abierta (a quien marques en «¿A quién avisamos?»), y en Control de pedidos cada mesa muestra lo que ve la cámara.'],
];
const AYUDA_PARA = 'Si no marcas ninguna casilla, esa alerta no se avisa.';
const AYUDA_HORARIO = 'Marca los días que abre el local. Fuera de este horario, cuando ya no queda gente, las cámaras descansan. '
	+ 'Si cierra a media tarde, usa «y de … a …» para el segundo turno. Si un día abre las 24 horas, pon la misma hora en «de» y en «a».';
const PRECARGADO = 'Tomamos este horario del POS. Revísalo y toca Guardar.';
const SIN_HORARIO = 'Abierto todo el día: sin horario, las cámaras miran a toda hora, todos los días.';
const CON_HORARIO = 'Los días sin marcar, el local está cerrado.';
// solo las alertas que ya existen; por limpiar llega en F3 (su valor viaja igual al guardar)
const ALERTAS = [
	{ tipo: 'sin_atencion', texto: 'Cuando nadie atiende una mesa' },
	{ tipo: 'cuenta_abierta', texto: 'Cuando la mesa se vacía con la cuenta abierta' },
];
const PARA = [{ d: 'mozos', texto: 'Avisar a los mozos' }, { d: 'caja', texto: 'Avisar en caja' }];
const BTN_GUARDAR = '<button class="btn btn-sm btn-success" type="button" data-acc="guardar"><i class="fa fa-check"></i>Guardar</button>';
// cada pregunta es un <fieldset>: mientras guarda se deshabilitan todos. El estilo en linea quita el borde y el margen
// del navegador (camaras.css no tiene regla para fieldset; se puede pasar ahi cuando nadie mas lo este editando)
const grupo = (extra = '') => `<fieldset class="cm-grupo" style="border:0;margin:0"${extra}>`;

/* ---------- lo que no es DOM (se prueba en Node) ---------- */

/** Texto de un tiempo: "30 segundos", "1 minuto", "8 minutos"; el 0 es "No" (recordar) o "No esperar" (caja). */
function textoTiempo(campo, seg) {
	if (seg === 0) { return campo === 'recordatorio_seg' ? 'No' : 'No esperar'; }
	if (seg < 60) { return `${seg} segundos`; }
	const min = Math.floor(seg / 60);
	const resto = seg % 60;
	return `${min} minuto${min === 1 ? '' : 's'}${resto ? ` ${resto} s` : ''}`;
}

/**
 * Un select por tiempo. Un valor guardado que no está en la lista (puesto por otro medio) se muestra igual, para no
 * cambiarlo solo; al guardar, validar() pide elegir uno de la lista.
 */
function selectTiempo(campo, valor, oculto = false) {
	const lista = OPCIONES[campo];
	const opciones = Number.isInteger(valor) && !lista.includes(valor) ? [valor, ...lista] : lista;
	return `<label class="cm-campo" data-campo="${campo}"${oculto ? ' hidden' : ''}><span>${esc(ETIQUETAS[campo])}</span>
		<select class="inv-select" name="${campo}">${opciones.map(s => `<option value="${s}"${s === valor ? ' selected' : ''}>${esc(textoTiempo(campo, s))}</option>`).join('')}</select>
		<small class="cm-campo-ayuda">${esc(AYUDAS_TIEMPO[campo])}</small></label>`;
}

const radio = (nombre, valor, actual, texto) =>
	`<label class="cm-opcion"><input type="radio" name="${nombre}" value="${valor}"${valor === actual ? ' checked' : ''}>${esc(texto)}</label>`;

const casilla = (nombre, marcada, texto, clase = 'cm-check') =>
	`<label class="${clase}"><input type="checkbox" name="${nombre}"${marcada ? ' checked' : ''}>${esc(texto)}</label>`;

function filaDia(d) {
	const nombre = DIAS.find(x => x.n === d.dia).nombre;
	const hora = (campo, valor, etiqueta) => `<input type="time" class="inv-input cm-hora" name="${campo}_${d.dia}" value="${esc(valor)}"`
		+ ` aria-label="${esc(nombre)}: ${etiqueta}"${d.abre ? '' : ' disabled'}>`;
	const [t1, t2] = d.turnos;
	return `<div class="cm-dia${d.abre ? '' : ' cerrado'}" data-dia="${d.dia}">
		${casilla('abre_' + d.dia, d.abre, nombre, 'cm-check cm-dia-nombre')}
		<span class="cm-turno">de ${hora('de1', t1.de, 'abre a las')} a ${hora('a1', t1.a, 'cierra a las')}</span>
		<span class="cm-turno">y de ${hora('de2', t2.de, 'vuelve a abrir a las')} a ${hora('a2', t2.a, 'cierra a las')}</span>
	</div>`;
}

const textoHorario = dias => (dias.some(d => d.abre) ? CON_HORARIO : SIN_HORARIO);

/**
 * El formulario de la pantalla con los valores de form (formDesde: lo que trajo GET) marcados. La nota del horario
 * precargado va oculta: la muestra completarPrecarga() si el horario del POS llega.
 */
export function htmlParametros(form) {
	return `<form class="cm-param" novalidate>
		${grupo(' role="radiogroup" aria-label="¿Qué hacemos con las alertas?"')}
			<p class="cm-sub">¿Qué hacemos con las alertas?</p>
			<div class="cm-opciones">${radio('modo', 'solo_medir', form.modo, 'Solo medir, no avisar')}${radio('modo', 'alertar', form.modo, 'Medir y avisar')}</div>
			${AYUDA_MODO.map(([op, que]) => `<p class="inv-ayuda cm-nota"><b>${esc(op)}:</b> ${esc(que)}</p>`).join('')}
		</fieldset>
		${grupo(' role="radiogroup" aria-label="¿Dónde pagan los clientes?"')}
			<p class="cm-sub">¿Dónde pagan los clientes?</p>
			<div class="cm-opciones">${radio('modo_pago', 'caja', form.modo_pago, 'En caja')}${radio('modo_pago', 'mesa', form.modo_pago, 'En la mesa')}</div>
		</fieldset>
		${grupo()}
			<p class="cm-sub">Tiempos</p>
			<div class="cm-tiempos">
				${selectTiempo('ocupar_seg', form.ocupar_seg)}${selectTiempo('sin_atencion_seg', form.sin_atencion_seg)}
				${selectTiempo('vaciar_seg', form.vaciar_seg)}${selectTiempo('espera_caja_seg', form.espera_caja_seg, form.modo_pago === 'mesa')}
				${selectTiempo('recordatorio_seg', form.recordatorio_seg)}
			</div>
		</fieldset>
		${grupo()}
			<p class="cm-sub">¿A quién avisamos?</p>
			${ALERTAS.map(({ tipo, texto }) => `<div class="cm-para"><b>${esc(texto)}</b>
				${PARA.map(({ d, texto: t }) => casilla(`para_${tipo}_${d}`, form.destinatarios[tipo].includes(d), t)).join('')}</div>`).join('')}
			<p class="inv-ayuda cm-nota">${esc(AYUDA_PARA)}</p>
		</fieldset>
		${grupo()}
			<p class="cm-sub">Horario de atención</p>
			<p class="inv-ayuda cm-nota cm-horario-ayuda">${esc(AYUDA_HORARIO)}</p>
			<p class="cm-destino cm-precarga" hidden><i class="fa fa-info-circle"></i>${esc(PRECARGADO)}</p>
			<div class="cm-dias">${form.dias.map(filaDia).join('')}</div>
			<div class="cm-horario-pie">
				<p class="cm-horario-estado">${esc(textoHorario(form.dias))}</p>
				<button class="btn btn-sm btn-light" type="button" data-acc="todo-el-dia"><i class="fa fa-clock-o"></i>Abierto todo el día</button>
			</div>
		</fieldset>
	</form>`;
}

/**
 * Lo que tiene la pantalla, como form (ver parametros.js). el: form.elements (o uno falso: nombre → {value} o
 * {checked}). base: el form que se pintó; de ahí sale lo que no se muestra: por limpiar y, con pago en la mesa, la
 * espera de caja (va la que vino del servidor).
 */
export function leerFormulario(el, base) {
	const valor = n => (el[n] && el[n].value != null ? String(el[n].value) : '');
	const marcado = n => !!(el[n] && el[n].checked);
	const segundos = n => (/^\d+$/.test(valor(n)) ? Number(valor(n)) : Number.NaN);
	const mostradas = ALERTAS.map(a => a.tipo);
	const destinatarios = {};
	for (const tipo of TIPOS) {
		destinatarios[tipo] = mostradas.includes(tipo) ? PARA.map(p => p.d).filter(d => marcado(`para_${tipo}_${d}`)) : base.destinatarios[tipo];
	}
	return {
		modo: valor('modo'),
		modo_pago: valor('modo_pago'),
		ocupar_seg: segundos('ocupar_seg'),
		sin_atencion_seg: segundos('sin_atencion_seg'),
		vaciar_seg: segundos('vaciar_seg'),
		espera_caja_seg: valor('modo_pago') === 'mesa' ? base.espera_caja_seg : segundos('espera_caja_seg'),
		recordatorio_seg: segundos('recordatorio_seg'),
		por_limpiar_seg: base.por_limpiar_seg,
		destinatarios,
		dias: DIAS.map(({ n }) => ({
			dia: n,
			abre: marcado('abre_' + n),
			turnos: [{ de: valor('de1_' + n), a: valor('a1_' + n) }, { de: valor('de2_' + n), a: valor('a2_' + n) }],
		})),
	};
}

/**
 * Valida form en el cliente y, si está bien, PUT parametros. Devuelve {ok: true, data} (lo guardado, como GET) o
 * {ok: false, texto} con el mensaje en palabras simples (nunca el código del servidor).
 */
export async function guardar(api, form) {
	const error = validar(form);
	if (error) { return { ok: false, texto: error }; }
	try {
		return { ok: true, data: await api.put('parametros', aCuerpo(form)) };
	} catch (e) {
		return { ok: false, texto: textoError(e) };
	}
}

/* ---------- pantalla ---------- */

export async function render(cont, { api, senal, alSalir }, t) {
	cont.innerHTML = '<p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p>';
	let p;
	try {
		p = await api.get('parametros');
	} catch (e) {
		if (vigente(t) && !senal.aborted) { pintarFalla(cont, e.message); }
		return;
	}
	if (!vigente(t) || senal.aborted) { return; }
	// estado de esta pantalla (se descarta entero al salir). inicial: lo que se pintó, para saber si hay cambios
	const v = { api, senal, cont, base: formDesde(p), guardando: false, inicial: null, formEl: null, pago: '' };
	pintar(v);
	if (alSalir) { alSalir(() => hayCambios(v), preguntarSalir); }
	if (debePrecargar(p)) {
		// la pantalla no espera: el horario del POS completa el de la pantalla cuando llega ([] si no llega)
		const base = v.base;
		cargarHorarioSede(undefined, senal).then(franjas => {
			if (vigente(t) && !senal.aborted && v.base === base) { completarPrecarga(v, franjas); }
		});
	}
}

function pintarFalla(cont, texto) {
	cont.innerHTML = tarjeta({
		titulo: 'Parámetros',
		acciones: volver(''),
		cuerpo: `<p class="cm-falla"><i class="fa fa-exclamation-circle"></i>${esc(texto)}</p>`,
	});
}

const preguntarSalir = () => confirmar({
	titulo: '¿Salir sin guardar?',
	textoHtml: 'Cambiaste parámetros que todavía no se guardaron. Si sales ahora, se pierden.',
	boton: 'Sí, salir sin guardar',
});

/** Lo que tiene la pantalla ahora (lo que se mandaría al servidor). */
const leer = v => leerFormulario(v.formEl.elements, v.base);
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// mientras guarda no hay "cambios sin guardar": salir no pregunta y el PUT ya pedido termina igual (api.js)
const hayCambios = v => !!v.formEl && !v.guardando && !igual(leer(v), v.inicial);

/** Dibuja la tarjeta con v.base (al entrar y después de guardar) y la deja sin cambios pendientes. */
function pintar(v) {
	v.cont.innerHTML = tarjeta({
		titulo: 'Parámetros',
		ayuda: esc(AYUDA),
		acciones: `${volver('')}${BTN_GUARDAR}`,
		cuerpo: htmlParametros(v.base),
	});
	v.formEl = v.cont.querySelector('form.cm-param');
	v.pago = v.base.modo_pago;
	v.inicial = leer(v);
	v.cont.querySelector('.inv-card').addEventListener('click', e => {
		const b = e.target.closest('[data-acc]');
		if (b && b.dataset.acc === 'guardar') { alGuardar(v); }
		if (b && b.dataset.acc === 'todo-el-dia' && !v.guardando) { todoElDia(v); }
	});
	v.formEl.addEventListener('submit', e => e.preventDefault());   // Enter en un campo no recarga la página
	v.formEl.addEventListener('change', e => alCambiar(v, e.target));
}

function alCambiar(v, campo) {
	const nombre = campo.name || '';
	if (nombre === 'modo_pago') { cambiarPago(v, campo.value); }
	if (nombre.startsWith('abre_')) { abrirDia(v, Number(nombre.slice(5)), campo.checked); }
}

/** Pago en caja / en la mesa: la espera de caja solo vale con pago en caja; los avisos en su default siguen al modo. */
function cambiarPago(v, nuevo) {
	const el = v.formEl.elements;
	const ahora = leerFormulario(el, v.base).destinatarios;
	const siguen = destinatariosAlCambiarPago(ahora, v.pago, nuevo);
	for (const { tipo } of ALERTAS) {
		for (const { d } of PARA) { el[`para_${tipo}_${d}`].checked = siguen[tipo].includes(d); }
	}
	v.formEl.querySelector('[data-campo="espera_caja_seg"]').hidden = nuevo === 'mesa';
	v.pago = nuevo;
}

const CAMPOS_DIA = ['de1', 'a1', 'de2', 'a2'];

/** Las horas de un día cerrado no se editan (quedan escritas por si se vuelve a marcar). */
function marcarDia(v, n, abre) {
	CAMPOS_DIA.forEach(c => { v.formEl.elements[`${c}_${n}`].disabled = !abre; });
	v.formEl.querySelector(`.cm-dia[data-dia="${n}"]`).classList.toggle('cerrado', !abre);
}

/** Marcar o desmarcar un día. Al marcar un día vacío se copian las horas del primer día abierto (se pueden cambiar). */
function abrirDia(v, n, abre) {
	const el = v.formEl.elements;
	if (abre && !el['de1_' + n].value && !el['a1_' + n].value) {
		const modelo = DIAS.find(({ n: m }) => m !== n && el['abre_' + m].checked && el['de1_' + m].value && el['a1_' + m].value);
		if (modelo) { CAMPOS_DIA.forEach(c => { el[`${c}_${n}`].value = el[`${c}_${modelo.n}`].value; }); }
	}
	marcarDia(v, n, abre);
	pintarEstadoHorario(v);
}

/** Pone los 7 días (diasDesdeFranjas) en la pantalla ya pintada. */
function ponerDias(v, dias) {
	const el = v.formEl.elements;
	for (const d of dias) {
		el['abre_' + d.dia].checked = d.abre;
		d.turnos.forEach((tr, i) => {
			el[`de${i + 1}_${d.dia}`].value = tr.de;
			el[`a${i + 1}_${d.dia}`].value = tr.a;
		});
		marcarDia(v, d.dia, d.abre);
	}
	pintarEstadoHorario(v);
}

/**
 * Llegó el horario del POS (franjas; [] si no llegó). Se pone solo si nadie tocó el horario todavía y no se está
 * guardando; pasa a ser el punto de partida (salir sin tocarlo no pregunta) y se muestra la nota "Tomamos este horario
 * del POS…". Lo demás que ya se haya cambiado sigue contando como cambio.
 */
function completarPrecarga(v, franjas) {
	if (!franjas.length || v.guardando || !igual(leer(v).dias, v.inicial.dias)) { return; }
	ponerDias(v, diasDesdeFranjas(franjas));
	v.inicial = { ...v.inicial, dias: leer(v).dias };
	v.formEl.querySelector('.cm-precarga').hidden = false;
}

/** Abierto todo el día: sin horario (24 h). Las horas quedan escritas por si se vuelve a marcar un día. */
function todoElDia(v) {
	DIAS.forEach(({ n }) => {
		const casillaDia = v.formEl.elements['abre_' + n];
		if (casillaDia.checked) {
			casillaDia.checked = false;
			abrirDia(v, n, false);
		}
	});
	pintarEstadoHorario(v);
}

function pintarEstadoHorario(v) {
	const p = v.formEl.querySelector('.cm-horario-estado');
	if (p) { p.textContent = textoHorario(leerFormulario(v.formEl.elements, v.base).dias); }
}

/** Mientras guarda: el formulario deshabilitado (no se edita algo que el repintado borraría) y el botón "Guardando…". */
function pintarGuardando(v) {
	v.formEl.querySelectorAll('fieldset.cm-grupo').forEach(f => { f.disabled = v.guardando; });
	const btn = v.cont.querySelector('[data-acc="guardar"]');
	if (!btn) { return; }
	btn.disabled = v.guardando;
	btn.innerHTML = v.guardando ? '<i class="fa fa-spinner fa-spin"></i>Guardando…' : '<i class="fa fa-check"></i>Guardar';
}

async function alGuardar(v) {
	if (v.guardando) { return; }
	const form = leer(v);
	v.guardando = true;
	pintarGuardando(v);
	const r = await guardar(v.api, form);
	v.guardando = false;
	if (v.senal.aborted) { return; }   // salió de la pantalla: el PUT ya pedido termina igual (api.js)
	if (!r.ok) {
		pintarGuardando(v);
		aviso(r.texto, 'error');   // lo elegido queda en pantalla para corregirlo
		return;
	}
	// responde lo guardado (igual que GET): con eso se sigue
	v.base = r.data ? formDesde(r.data) : form;
	pintar(v);
	aviso('Guardado', 'ok');
}
