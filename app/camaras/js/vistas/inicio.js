// Inicio: estado de las PC del local (motores) y los pasos para empezar: descargar el programa y vincular.
// Cada PC se puede desvincular (DELETE motores/{id}): deja de mirar las cámaras hasta vincularla con otro código.
// Cada PC que ya midió dice cuántas cámaras puede vigilar (textoCapacidad: medicion y camaras_mesas de GET estado).
import { esc, tarjeta, aviso, confirmar } from '../ui.js?v=20261020i';
import { vigente, recargar } from '../router.js?v=20261020i';
import { textoCapacidad } from '../estado-mesas.js?v=20261020i';

const dos = n => String(n).padStart(2, '0');

/**
 * Texto y color del estado de un motor. "Conectado" lo decide el servidor (m.conectado, con su reloj): la hora
 * de la PC del POS suele estar mal. ahora (ms, reloj de esta PC) solo elige si la fecha es "hoy" u otro dia.
 */
export function estadoMotor(m, ahora = Date.now()) {
	if (m.conectado) { return { texto: 'Conectado', clase: 'ok' }; }
	const t = m.ultimo_reporte ? Date.parse(m.ultimo_reporte) : NaN;
	if (!Number.isFinite(t)) { return { texto: 'Todavía no se conecta', clase: 'mal' }; }
	const d = new Date(t);
	const hora = `${dos(d.getHours())}:${dos(d.getMinutes())}`;
	const hoy = d.toDateString() === new Date(ahora).toDateString();
	return { texto: hoy ? `Sin conexión desde ${hora}` : `Sin conexión desde el ${dos(d.getDate())}/${dos(d.getMonth() + 1)} a las ${hora}`, clase: 'mal' };
}

/** true si el servidor dio un enlace del instalador que se puede abrir (si no, no hay boton Descargar programa). */
const hayDescarga = url => /^https?:\/\//.test(url || '');

const btnDescargar = url => (hayDescarga(url)
	? `<a class="btn btn-sm btn-light" href="${esc(url)}" target="_blank" rel="noopener"><i class="fa fa-download"></i>Descargar programa</a>` : '');
const BTN_VINCULAR = '<a class="btn btn-sm btn-success" href="#" data-ir="vincular"><i class="fa fa-link"></i>Vincular</a>';
// con una PC vinculada, el paso siguiente: conectar el grabador (vistas/equipos.js)
const BTN_EQUIPOS = '<a class="btn btn-sm btn-primary" href="#" data-ir="equipos"><i class="fa fa-video-camera"></i>Grabadores y cámaras</a>';
// modo, tiempos, a quién avisar y horario (vistas/parametros.js)
const BTN_PARAMETROS = '<a class="btn btn-sm btn-light" href="#" data-ir="parametros"><i class="fa fa-sliders"></i>Parámetros</a>';
// las mesas ahora, por área (vistas/en-vivo.js)
const BTN_EN_VIVO = '<a class="btn btn-sm btn-light" href="#" data-ir="en-vivo"><i class="fa fa-eye"></i>En vivo</a>';
// sesiones y alertas de otros días, y la planilla del piloto (vistas/registro.js)
const BTN_REGISTRO = '<a class="btn btn-sm btn-light" href="#" data-ir="registro"><i class="fa fa-list"></i>Registro</a>';
const SIGUIENTE = `<p class="inv-ayuda cm-nota cm-siguiente"><i class="fa fa-arrow-right"></i> Siguiente paso: toca <b>Grabadores y cámaras</b>
	para conectar el grabador de las cámaras y elegir cuáles miran las mesas.</p>`;
const AL_DESVINCULAR = 'La PC deja de mirar las cámaras. Para usarla otra vez hay que vincularla con un código nuevo.';

/** La capacidad de la PC m ('' sin medición); resaltada si no le alcanza para todas sus cámaras. */
function capacidad(m) {
	const texto = textoCapacidad([m]);
	if (!texto) { return ''; }
	const falta = m.medicion.capacidad === 0 || m.medicion.capacidad < m.camaras_mesas;
	return `<p class="cm-capacidad${falta ? ' mal' : ''}">${esc(texto)}</p>`;
}

function motor(m) {
	const e = estadoMotor(m);
	return `<div class="cm-motor">
		<i class="fa fa-desktop"></i>
		<div class="cm-motor-txt">
			<h4>${esc(m.hostname || 'PC del local')}</h4>
			<p>${m.version ? `Versión ${esc(m.version)}` : 'Versión sin dato'}</p>${capacidad(m)}
		</div>
		<span class="cm-estado ${e.clase}">${esc(e.texto)}</span>
		<button class="btn btn-sm btn-light" type="button" data-acc="desvincular" data-id="${esc(m.id)}"><i class="fa fa-chain-broken"></i>Desvincular</button>
	</div>`;
}

/**
 * Sin PC vinculada: que hacer, en palabras simples. Sin enlace del instalador no hay boton Descargar programa:
 * entonces el paso 1 no lo nombra y dice a quien pedirlo.
 */
export function pasos(instaladorUrl) {
	const instalar = hayDescarga(instaladorUrl)
		? 'toca <b>Descargar programa</b> e instálalo.'
		: 'instala el programa Papaya Cámaras IA. Pide el programa de instalación a soporte de Papaya.';
	return `
	<p class="cm-vacio"><i class="fa fa-desktop"></i>Todavía no hay ninguna PC vinculada</p>
	<p class="cm-sub">Para empezar:</p>
	<ol class="cm-pasos">
		<li>En una PC del local que quede prendida y esté en la misma red que el grabador de las cámaras, ${instalar}</li>
		<li>Al terminar, el programa te muestra un código de 6 números.</li>
		<li>Toca <b>Vincular</b> y escribe ese código.</li>
	</ol>`;
}

const preguntarDesvincular = m => confirmar({
	titulo: `¿Desvincular ${m.hostname || 'la PC del local'}?`,
	textoHtml: esc(AL_DESVINCULAR),
	boton: 'Sí, desvincular',
});

/**
 * Desvincular la PC m: pregunta (preguntar(m) → Promise<boolean>) y, si dice que sí, DELETE motores/{id}.
 * Devuelve null si no se confirmó, {ok: true} si se desvinculó o {ok: false, texto} con el mensaje simple.
 */
export async function desvincular(api, m, preguntar = preguntarDesvincular) {
	if (!(await preguntar(m))) { return null; }
	try {
		await api.del('motores/' + encodeURIComponent(m.id));
		return { ok: true };
	} catch (e) {
		return { ok: false, texto: e.message };
	}
}

export async function render(cont, { api }, t) {
	cont.innerHTML = '<p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p>';
	const d = await api.get('estado');
	if (!vigente(t)) { return; }
	const motores = d.motores || [];
	cont.innerHTML = tarjeta({
		titulo: 'Cámaras IA',
		ayuda: 'Las cámaras que ya tienes en el local miran las mesas y te avisan cuáles están ocupadas.',
		acciones: `<a class="btn btn-sm btn-light" href="#" data-ir="" title="Ver el estado de nuevo"><i class="fa fa-refresh"></i>Actualizar</a>
			${btnDescargar(d.instalador_url)}${BTN_VINCULAR}${motores.length ? BTN_EQUIPOS + BTN_EN_VIVO + BTN_REGISTRO + BTN_PARAMETROS : ''}`,
		cuerpo: motores.length
			? `<p class="cm-sub">PC del local</p><div class="cm-motores">${motores.map(motor).join('')}</div>${SIGUIENTE}`
			: pasos(d.instalador_url),
	});
	cont.querySelector('.inv-card').addEventListener('click', async e => {
		const b = e.target.closest('[data-acc="desvincular"]');
		const m = b && motores.find(x => String(x.id) === b.dataset.id);
		if (!m || b.disabled) { return; }
		b.disabled = true;
		const r = await desvincular(api, m);
		if (!vigente(t)) { return; }   // salio de la pantalla mientras preguntaba o esperaba
		b.disabled = false;
		if (!r) { return; }
		if (!r.ok) { aviso(r.texto, 'error'); return; }
		aviso('Listo, la PC quedó desvinculada', 'ok');
		recargar();
	});
}
