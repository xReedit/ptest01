// Grabadores y cámaras: buscar el grabador (DVR/NVR) en la red del local, conectarlo con su usuario y clave, ver la
// foto de cada cámara, ponerle nombre y marcar cuáles miran mesas. Lo que se le pide a la PC del local (buscar,
// conectar, sacar foto) se espera con espera.js (cada 2 s, hasta 60 s) y se corta con ctx.senal al salir.
// Las fotos se muestran con URL.createObjectURL y se sueltan (revokeObjectURL) al reemplazarlas o al salir.
import { esc, tarjeta, volver, aviso, confirmar } from '../ui.js?v=20261020i';
import { vigente } from '../router.js?v=20261020i';
import { esperarComando, falloComando } from '../espera.js?v=20261020i';
import { abrirConectar, nombreGrabador, errorConectar } from './conectar.js?v=20261020i';

const PC_DESCONECTADA = 'La PC del local no está conectada. Revisa que esté prendida y con internet.';
const SIN_PC = 'Todavía no hay ninguna PC vinculada. Vuelve al inicio y toca Vincular.';
const FOTO_NO_CARGO = 'No se pudo cargar la foto. Toca Actualizar foto.';
const dos = n => String(n).padStart(2, '0');
const propio = (mapa, k) => (Object.prototype.hasOwnProperty.call(mapa, k) ? mapa[k] : '');

/* ---------- lo que no es DOM (se prueba en Node) ---------- */

/** Motores que pueden buscar o conectar: los conectados según el servidor (campo conectado). */
export const motoresConectados = motores => (motores || []).filter(m => m.conectado);

/** Id del motor que busca: el pedido (foco de la ruta o el select) si está conectado; si no, el primero; null si ninguno. */
export function elegirMotor(conectados, pedido) {
	const m = conectados.find(x => String(x.id) === String(pedido)) || conectados[0];
	return m ? m.id : null;
}

/** Estado del último envío de usuario y clave del grabador: chip + mensaje simple del servidor si falló. */
export function estadoConexion(conexion) {
	const estado = conexion && conexion.estado;
	if (estado === 'ok') { return { texto: 'Conectado', clase: 'ok', mensaje: '' }; }
	if (estado === 'pendiente') { return { texto: 'Conectando…', clase: 'espera', mensaje: '' }; }
	return { texto: 'No conectado', clase: 'mal', mensaje: (conexion && conexion.mensaje) || 'No se pudo conectar con el grabador.' };
}

export const nombreCamara = c => c.nombre || `Cámara ${c.canal}`;

/** true si el grabador encontrado ya está en la lista de la sede (mismo IP y puerto). */
export const yaAgregado = (d, equipos) => equipos.some(e => e.ip === d.ip && Number(e.puerto) === Number(d.puerto));

/**
 * Cámaras a las que pedirles foto sin que el usuario toque nada. Al abrir: de grabadores conectados, sin foto y
 * sin probar (ok null). Recién conectado el grabador equipoId: todas las suyas sin foto (antes pudo fallar la clave).
 */
export function camarasSinFoto(equipos, equipoId = null) {
	if (equipoId !== null) {
		return equipos.filter(e => e.id === equipoId).flatMap(e => e.camaras.filter(c => !c.tiene_foto).map(c => c.id));
	}
	return equipos.filter(e => e.conexion && e.conexion.estado === 'ok')
		.flatMap(e => e.camaras.filter(c => !c.tiene_foto && c.ok === null).map(c => c.id));
}

/** "Foto de las 15:04" u otro día "Foto del 17/10 a las 22:40" (la hora viene del servidor, X-Tomada). */
export function textoTomada(iso, ahora = Date.now()) {
	const t = iso ? Date.parse(iso) : NaN;
	if (!Number.isFinite(t)) { return ''; }
	const d = new Date(t);
	const hora = `${dos(d.getHours())}:${dos(d.getMinutes())}`;
	return d.toDateString() === new Date(ahora).toDateString()
		? `Foto de las ${hora}` : `Foto del ${dos(d.getDate())}/${dos(d.getMonth() + 1)} a las ${hora}`;
}

export const ANCHO_MINIMO_FOTO = 640;   // mas angosta (ej. 352×240, CIF) no alcanza para marcar mesas ni contar personas

/**
 * Aviso si la foto que da el grabador es muy chica ('' si alcanza), con su tamaño real (naturalWidth×naturalHeight).
 * Solo avisa: se puede marcar y probar igual (las zonas van en 0..1, siguen sirviendo con una foto mas grande).
 */
export function avisoFotoChica(ancho, alto) {
	if (!(ancho > 0) || ancho >= ANCHO_MINIMO_FOTO) { return ''; }
	return `La foto que da el grabador es muy chica (${ancho}×${alto}). Para ver mejor las mesas, en el grabador sube la calidad de la instantánea: `
		+ 'Menú principal → Cámara → Codificación → Instantánea → Tamaño de imagen: el más grande, Calidad: 6. Después, en Grabadores y cámaras, toca Actualizar foto.';
}

const TEXTO_CAMARA = {
	motor_no_activo: 'Este grabador ya no tiene una PC del local vinculada. Conéctalo de nuevo.',
	nombre: 'El nombre puede tener hasta 60 letras.',
	no_encontrado: 'Esta cámara ya no existe. Toca Actualizar.',
};
export const errorCamara = e => propio(TEXTO_CAMARA, e.codigo) || e.message;

/**
 * Las cámaras del grabador: a la vista las que miran mesas y aparte las sin usar ("Agregar otra cámara"). Si
 * ninguna mira mesas (recién conectado: hay que elegir), todas a la vista.
 */
export function separarCamaras(camaras) {
	const usadas = camaras.filter(c => c.mira_mesas);
	return usadas.length ? { vista: usadas, sinUsar: camaras.filter(c => !c.mira_mesas) } : { vista: camaras, sinUsar: [] };
}

const donde = (n, marcadas) => {
	if (n === 1) { return 'ella'; }
	if (marcadas === n) { return 'ellas'; }
	return marcadas === 1 ? 'una de ellas' : `${marcadas} de ellas`;
};

/** Lo que pasa al quitar el grabador e, en palabras simples (el texto del diálogo). */
export function textoQuitar(e) {
	const n = e.camaras.length;
	const marcadas = e.camaras.filter(c => c.mira_mesas).length;
	const volverA = 'Si lo necesitas otra vez, conéctalo de nuevo con Buscar grabadores';
	if (!n) { return `El grabador sale de la lista. ${volverA}.`; }
	const camaras = n === 1 ? 'Se borra su cámara' : `Se borran sus ${n} cámaras`;
	return marcadas
		? `${camaras} y las mesas marcadas en ${donde(n, marcadas)}. ${volverA} y vuelve a marcar las mesas.`
		: `${camaras}. ${volverA}.`;
}

const preguntarQuitar = e => confirmar({ titulo: `¿Quitar el ${nombreGrabador(e)}?`, textoHtml: esc(textoQuitar(e)), boton: 'Sí, quitar' });

/**
 * Quitar el grabador e: pregunta (preguntar(e) → Promise<boolean>) y, si dice que sí, DELETE equipos/{id}.
 * null si no se confirmó, {ok: true} si se quitó (o ya no estaba) o {ok: false, texto} con el mensaje simple.
 */
export async function quitarGrabador(api, e, preguntar = preguntarQuitar) {
	if (!(await preguntar(e))) { return null; }
	try {
		await api.del('equipos/' + encodeURIComponent(e.id));
		return { ok: true };
	} catch (err) {
		return err.codigo === 'no_encontrado' ? { ok: true } : { ok: false, texto: err.message };
	}
}

/* ---------- pantalla ---------- */

export async function render(cont, { api, senal }, t, foco) {
	cont.innerHTML = '<p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p>';
	const [estado, lista] = await Promise.all([api.get('estado'), api.get('equipos')]);
	if (!vigente(t) || senal.aborted) { return; }
	const motores = estado.motores || [];
	const conectados = motoresConectados(motores);
	// estado de esta pantalla (se descarta entero al salir)
	const v = {
		api, senal, cont, motores, conectados, motorId: elegirMotor(conectados, foco),
		equipos: lista.equipos || [], encontrados: null, busqueda: 0,
		fotos: new Map(), bajando: new Set(), esperando: new Set(), fallas: new Map(), colas: new Map(),
	};
	senal.addEventListener('abort', () => soltarFotos(v), { once: true });
	cont.innerHTML = tarjeta({
		titulo: 'Grabadores y cámaras',
		ayuda: 'Conecta el grabador de las cámaras (DVR) y elige qué cámaras miran las mesas.',
		acciones: `${volver('')}<a class="btn btn-sm btn-light cm-actualizar" href="#" data-ir="${esc(rutaActualizar(v))}" title="Ver de nuevo"><i class="fa fa-refresh"></i>Actualizar</a>`,
		cuerpo: `${htmlBuscar(v)}<p class="cm-sub cm-sub-equipos">Grabadores de este local</p><div class="cm-equipos"></div>`,
	});
	enlazar(v);
	pintarEquipos(v);
	pedirFotos(v, camarasSinFoto(v.equipos));
}

// recargar conserva la PC elegida en el select
const rutaActualizar = v => `equipos/${v.motorId ?? ''}`;

function htmlBuscar(v) {
	const sinMotor = !v.motorId;
	const alerta = !v.motores.length ? SIN_PC : (sinMotor ? PC_DESCONECTADA : '');
	const apagado = sinMotor ? ' disabled' : '';
	return `<div class="cm-bloque">
		${alerta ? `<p class="cm-alerta"><i class="fa fa-exclamation-triangle"></i>${esc(alerta)}</p>` : ''}
		${v.conectados.length > 1 ? htmlElegirMotor(v) : ''}
		<div class="cm-buscar">
			<button class="btn btn-success" type="button" data-acc="buscar"${apagado}><i class="fa fa-search"></i>Buscar grabadores</button>
			<button class="btn btn-light" type="button" data-acc="manual"${apagado}><i class="fa fa-pencil"></i>Agregar grabador a mano</button>
		</div>
		<p class="inv-ayuda cm-nota"><i class="fa fa-info-circle"></i> La PC del local busca el grabador en su misma red. Tarda unos segundos.</p>
		<div class="cm-encontrados" aria-live="polite"></div>
	</div>`;
}

// mas de una PC conectada: el usuario elige cual busca (select nativo, se aplica al cambiar)
function htmlElegirMotor(v) {
	const op = v.conectados.map(m => `<option value="${esc(m.id)}"${m.id === v.motorId ? ' selected' : ''}>${esc(m.hostname || 'PC del local')}</option>`).join('');
	return `<label class="inv-field cm-elegir"><span class="inv-label">PC del local que busca</span><select class="inv-select" name="motor">${op}</select></label>`;
}

function enlazar(v) {
	const card = v.cont.querySelector('.inv-card');
	card.addEventListener('click', e => {
		const b = e.target.closest('[data-acc]');
		if (!b || b.disabled) { return; }
		const acc = b.dataset.acc;
		if (acc === 'buscar') { buscar(v, b); }
		if (acc === 'manual') { conectar(v, { aMano: true }); }
		if (acc === 'conectar') { conectar(v, (v.encontrados || [])[Number(b.dataset.i)]); }
		if (acc === 'reconectar') { conectar(v, v.equipos.find(x => x.id === Number(b.dataset.equipo))); }
		if (acc === 'quitar') { quitar(v, b); }
		if (acc === 'foto') { pedirFotos(v, [Number(b.closest('.cm-cam').dataset.cam)]); }
	});
	card.addEventListener('change', e => {
		const el = e.target;
		if (el.name === 'motor') {
			v.motorId = Number(el.value);
			v.cont.querySelector('.cm-actualizar').dataset.ir = rutaActualizar(v);
			v.busqueda++;   // lo encontrado era de la otra PC
			v.encontrados = null;
			v.cont.querySelector('.cm-encontrados').innerHTML = '';
			return;
		}
		const caja = el.closest('.cm-cam');
		if (caja && (el.name === 'nombre' || el.name === 'mira')) { guardarCamara(v, Number(caja.dataset.cam)); }
	});
}

const htmlError = texto => `<p class="cm-falla"><i class="fa fa-exclamation-circle"></i>${esc(texto)}</p>`;

/* ---------- buscar grabadores ---------- */

// descubiertos sigue mostrando la busqueda anterior mientras corre la nueva: el fin se ve en el comando
async function buscar(v, btn) {
	const caja = v.cont.querySelector('.cm-encontrados');
	const n = ++v.busqueda;
	const motorId = v.motorId;
	const vale = () => !v.senal.aborted && v.busqueda === n;
	btn.disabled = true;
	caja.innerHTML = '<p class="cm-buscando"><i class="fa fa-spinner fa-spin"></i>Buscando en la red del local…</p>';
	try {
		const { comando_id: id } = await v.api.post(`motores/${encodeURIComponent(motorId)}/descubrir`);
		const r = await esperarComando(v.api, id, v.senal);
		if (!vale() || r.estado === 'cancelado') { return; }
		const falla = falloComando(r);
		if (falla) { caja.innerHTML = htmlError(falla); return; }
		const ds = await v.api.get(`motores/${encodeURIComponent(motorId)}/descubiertos`);
		if (!vale()) { return; }
		v.encontrados = Array.isArray(ds) ? ds : [];
		pintarEncontrados(v);
	} catch (e) {
		if (vale()) { caja.innerHTML = htmlError(errorConectar(e)); }
	} finally {
		if (!v.senal.aborted) { btn.disabled = !v.motorId; }
	}
}

function pintarEncontrados(v) {
	const caja = v.cont.querySelector('.cm-encontrados');
	if (!caja || v.encontrados === null) { return; }
	if (!v.encontrados.length) {
		caja.innerHTML = `<p class="cm-vacio"><i class="fa fa-search"></i>No se encontró ningún grabador</p>
			<p class="inv-ayuda cm-nota">Revisa que el grabador esté prendido y conectado al mismo router que la PC del local.
			Si sabes su IP, toca <b>Agregar grabador a mano</b>.</p>`;
		return;
	}
	const filas = v.encontrados.map((d, i) => `<div class="cm-fila">
		<i class="fa fa-hdd-o"></i>
		<div class="cm-fila-txt"><h4>${esc(nombreGrabador(d))}</h4>${d.modelo ? `<p>Modelo ${esc(d.modelo)}</p>` : ''}</div>
		${yaAgregado(d, v.equipos) ? '<span class="cm-estado ok">Ya está en la lista</span>'
		: `<button class="btn btn-sm btn-success" type="button" data-acc="conectar" data-i="${i}"><i class="fa fa-plug"></i>Conectar</button>`}
	</div>`).join('');
	caja.innerHTML = `<p class="cm-sub">Encontrados en la red</p><div class="cm-lista">${filas}</div>`;
}

/* ---------- conectar (dialogo en conectar.js) ---------- */

function conectar(v, grabador) {
	if (!grabador) { return; }
	// el grabador ya conectado sigue con su PC si esta conectada; si no, la elegida
	const motorId = v.conectados.some(m => m.id === grabador.motor_id) ? grabador.motor_id : v.motorId;
	if (!motorId) { aviso(PC_DESCONECTADA, 'error'); return; }
	abrirConectar({
		api: v.api, senal: v.senal, dentro: v.cont, motorId, grabador,
		listo: equipoId => {
			aviso('Listo, el grabador quedó conectado');
			recargarEquipos(v, equipoId);
		},
		cancelado: () => recargarEquipos(v),   // pudo quedar "Conectando…"
	});
}

async function recargarEquipos(v, equipoId = null) {
	try {
		const d = await v.api.get('equipos');
		if (v.senal.aborted) { return; }
		v.equipos = d.equipos || [];
	} catch (e) {
		if (!v.senal.aborted) { aviso(e.message, 'error'); }
		return;
	}
	pintarEquipos(v);
	pintarEncontrados(v);   // "Ya está en la lista"
	if (equipoId !== null) { pedirFotos(v, camarasSinFoto(v.equipos, equipoId)); }
}

/* ---------- quitar un grabador ---------- */

async function quitar(v, b) {
	const e = v.equipos.find(x => x.id === Number(b.dataset.equipo));
	if (!e) { return; }
	b.disabled = true;
	const r = await quitarGrabador(v.api, e);
	if (v.senal.aborted) { return; }   // salio de la pantalla mientras preguntaba o esperaba
	b.disabled = false;
	if (!r) { return; }
	aviso(r.ok ? 'Listo, el grabador se quitó' : r.texto, r.ok ? 'ok' : 'error');
	if (r.ok) { recargarEquipos(v); }
}

/* ---------- grabadores y sus camaras ---------- */

const SIN_EQUIPOS = `<p class="cm-vacio"><i class="fa fa-video-camera"></i>Todavía no hay grabadores conectados</p>
	<p class="inv-ayuda cm-nota">Toca <b>Buscar grabadores</b>. Si no aparece, toca <b>Agregar grabador a mano</b>.</p>`;

function pintarEquipos(v) {
	const caja = v.cont.querySelector('.cm-equipos');
	if (!caja) { return; }
	caja.innerHTML = v.equipos.length ? v.equipos.map(e => htmlEquipo(v, e)).join('') : SIN_EQUIPOS;
	const vivas = new Set(v.equipos.flatMap(e => e.camaras.map(c => c.id)));
	for (const [id, f] of v.fotos) {
		if (!vivas.has(id)) { URL.revokeObjectURL(f.url); v.fotos.delete(id); }
	}
	for (const c of v.equipos.flatMap(e => e.camaras)) {
		pintarFoto(v, c.id);
		if (c.tiene_foto && !v.fotos.has(c.id)) { mostrarGuardada(v, c.id); }
	}
}

function htmlEquipo(v, e) {
	const est = estadoConexion(e.conexion);
	const n = e.camaras.length;
	const { vista, sinUsar } = separarCamaras(e.camaras);
	const boton = est.clase === 'espera' ? '' : `<button class="btn btn-sm ${est.clase === 'mal' ? 'btn-success' : 'btn-light'}" type="button"
		data-acc="reconectar" data-equipo="${Number(e.id)}"${v.motorId ? '' : ' disabled'}><i class="fa fa-key"></i>${est.clase === 'mal' ? 'Conectar de nuevo' : 'Cambiar usuario y clave'}</button>`;
	return `<div class="cm-equipo">
		<div class="cm-equipo-cab">
			<i class="fa fa-hdd-o"></i>
			<div class="cm-fila-txt"><h4>${esc(nombreGrabador(e))}</h4><p>${e.modelo ? `Modelo ${esc(e.modelo)} · ` : ''}${n} cámara${n === 1 ? '' : 's'}</p></div>
			<span class="cm-estado ${est.clase}">${esc(est.texto)}</span>
			${boton}
			<button class="btn btn-sm btn-light" type="button" data-acc="quitar" data-equipo="${Number(e.id)}"><i class="fa fa-trash-o"></i>Quitar</button>
		</div>
		${est.mensaje ? htmlError(est.mensaje) : ''}
		${est.clase === 'espera' ? '<p class="inv-ayuda cm-nota">La PC del local se está conectando con el grabador. Toca <b>Actualizar</b> en un momento.</p>' : ''}
		${vista.length ? `<div class="cm-camaras">${vista.map(htmlCamara).join('')}</div>` : ''}
		${sinUsar.length ? `<details class="cm-sin-usar"><summary><i class="fa fa-plus-circle"></i>Agregar otra cámara · ${sinUsar.length} sin usar</summary>
			<p class="inv-ayuda cm-nota">Marca «Esta cámara mira mesas» en la que quieras usar.</p>
			<div class="cm-camaras">${sinUsar.map(htmlCamara).join('')}</div></details>` : ''}
	</div>`;
}

function htmlCamara(c) {
	const id = Number(c.id);
	return `<div class="cm-cam" data-cam="${id}">
		<div class="cm-foto"></div>
		<p class="cm-foto-txt"></p>
		<label class="inv-field"><span class="inv-label">Nombre · canal ${Number(c.canal)}</span>
			<input class="inv-input cm-nombre" name="nombre" maxlength="60" autocomplete="off" placeholder="${esc(`Cámara ${c.canal}`)}" value="${esc(c.nombre)}"></label>
		<label class="inv-check cm-mira"><input type="checkbox" name="mira"${c.mira_mesas ? ' checked' : ''}>Esta cámara mira mesas</label>
		<div class="cm-cam-acciones">
			<button class="btn btn-sm btn-light" type="button" data-acc="foto"><i class="fa fa-camera"></i>Actualizar foto</button>
			<a class="btn btn-sm btn-primary" href="#" data-ir="mesas/${id}"${c.mira_mesas ? '' : ' hidden'}><i class="fa fa-th-large"></i>Marcar mesas</a>
			<a class="btn btn-sm btn-light" href="#" data-ir="probar/${id}"${c.mira_mesas ? '' : ' hidden'}><i class="fa fa-eye"></i>Probar</a>
		</div>
	</div>`;
}

const camaraEl = (v, id) => v.cont.querySelector(`.cm-cam[data-cam="${Number(id)}"]`);
const camaraDe = (v, id) => v.equipos.flatMap(e => e.camaras).find(c => c.id === id);

/* ---------- fotos ---------- */

/** Dibuja la foto de la camara (o "Sin foto"), la espera, la hora y el error de su ultimo intento. */
function pintarFoto(v, id) {
	const caja = camaraEl(v, id);
	const c = camaraDe(v, id);
	if (!caja || !c) { return; }
	const f = v.fotos.get(id);
	const esperando = v.esperando.has(id);
	const texto = esperando ? 'Pidiendo la foto…' : (v.bajando.has(id) ? 'Cargando la foto…' : 'Sin foto');
	caja.querySelector('.cm-foto').innerHTML = (f
		? `<img src="${esc(f.url)}" alt="${esc('Foto de ' + nombreCamara(c))}">`
		: `<span class="cm-sin-foto"><i class="fa fa-video-camera"></i>${texto}</span>`)
		+ (esperando ? '<span class="cm-foto-espera"><i class="fa fa-spinner fa-spin"></i></span>' : '');
	const falla = v.fallas.has(id) ? v.fallas.get(id) : (c.ok === false ? c.error || '' : '');
	const linea = caja.querySelector('.cm-foto-txt');
	linea.textContent = falla || (f ? textoTomada(f.tomada) : '');
	linea.classList.toggle('mal', !!falla);
	caja.querySelector('[data-acc="foto"]').disabled = esperando || !v.motorId;
}

/** Baja la foto guardada en el servidor y la muestra. Devuelve '' o el texto si no se pudo. */
async function bajarFoto(v, id) {
	v.bajando.add(id);
	try {
		const { blob, tomada } = await v.api.blob(`camaras/${encodeURIComponent(id)}/foto`);
		if (v.senal.aborted) { return ''; }
		const vieja = v.fotos.get(id);
		v.fotos.set(id, { url: URL.createObjectURL(blob), tomada });
		if (vieja) { URL.revokeObjectURL(vieja.url); }
		return '';
	} catch (e) {
		return e.codigo === 'sin_foto' ? '' : FOTO_NO_CARGO;
	} finally {
		v.bajando.delete(id);
	}
}

/** Al abrir: la foto que la camara ya tiene en el servidor. */
async function mostrarGuardada(v, id) {
	if (v.bajando.has(id)) { return; }
	const p = bajarFoto(v, id);
	pintarFoto(v, id);   // "Cargando la foto…"
	const falla = await p;
	if (v.senal.aborted) { return; }
	if (falla) { v.fallas.set(id, falla); }
	pintarFoto(v, id);
}

/**
 * Pide foto nueva a las camaras ids: todos los pedidos juntos (la PC los toma en un mismo reporte) y despues se
 * espera uno por uno, asi se consulta de a un comando cada 2 s (el servidor limita los pedidos por minuto).
 */
async function pedirFotos(v, ids) {
	if (!v.motorId || !ids.length) { return; }
	const pedidos = await Promise.all(ids.filter(id => !v.esperando.has(id)).map(id => pedirFoto(v, id)));
	for (const p of pedidos) {
		if (v.senal.aborted) { return; }
		if (p) { await esperarFoto(v, p.id, p.comando); }
	}
}

async function pedirFoto(v, id) {
	v.esperando.add(id);
	v.fallas.delete(id);
	pintarFoto(v, id);
	try {
		const { comando_id: comando } = await v.api.post(`camaras/${encodeURIComponent(id)}/foto`);
		return { id, comando };
	} catch (e) {
		terminarFoto(v, id, errorCamara(e));
		return null;
	}
}

async function esperarFoto(v, id, comando) {
	try {
		const r = await esperarComando(v.api, comando, v.senal);
		if (r.estado === 'cancelado') { return; }
		const falla = falloComando(r);
		terminarFoto(v, id, falla || await bajarFoto(v, id));
	} catch (e) {
		terminarFoto(v, id, errorCamara(e));
	}
}

function terminarFoto(v, id, falla) {
	if (v.senal.aborted) { return; }
	v.esperando.delete(id);
	v.fallas.set(id, falla);   // '' = salio bien (tapa un error viejo de la camara)
	pintarFoto(v, id);
}

function soltarFotos(v) {
	for (const f of v.fotos.values()) { URL.revokeObjectURL(f.url); }
	v.fotos.clear();
}

/* ---------- nombre y "mira mesas" (se guarda al cambiar) ---------- */

/** En fila por camara: cada guardado lee lo que hay en pantalla en ese momento (el ultimo cambio siempre llega). */
function guardarCamara(v, id) {
	const antes = v.colas.get(id) || Promise.resolve();
	v.colas.set(id, antes.then(() => guardar(v, id)));
}

async function guardar(v, id) {
	const caja = camaraEl(v, id);
	if (!caja || v.senal.aborted) { return; }
	const cuerpo = { nombre: caja.querySelector('[name="nombre"]').value.trim(), mira_mesas: caja.querySelector('[name="mira"]').checked };
	const antes = camaraDe(v, id);
	let ok = false;
	try {
		const { camara } = await v.api.put(`camaras/${encodeURIComponent(id)}`, cuerpo);
		if (v.senal.aborted) { return; }
		v.equipos = v.equipos.map(e => ({ ...e, camaras: e.camaras.map(c => (c.id === camara.id ? { ...c, ...camara } : c)) }));
		ok = true;
		const cambio = !!antes && antes.mira_mesas !== camara.mira_mesas;
		aviso(cambio && camara.mira_mesas ? 'Guardado. Ahora toca Marcar mesas para señalar las mesas en la foto.'
			: (cambio ? 'Guardado. Esta cámara ya no mira mesas.' : 'Guardado'));
		if (cambio) { pintarEquipos(v); }   // la cámara pasa arriba (en uso) o a «Agregar otra cámara»
	} catch (e) {
		if (v.senal.aborted) { return; }
		aviso(errorCamara(e), 'error');
	}
	pintarDatos(v, id, !ok);
}

/** "Marcar mesas" segun lo guardado; si el guardado fallo, la pantalla vuelve a lo guardado. */
function pintarDatos(v, id, volverAtras) {
	const caja = camaraEl(v, id);
	const c = camaraDe(v, id);
	if (!caja || !c) { return; }
	if (volverAtras) {
		caja.querySelector('[name="nombre"]').value = c.nombre;
		caja.querySelector('[name="mira"]').checked = c.mira_mesas;
	}
	caja.querySelectorAll('[data-ir^="mesas/"], [data-ir^="probar/"]').forEach(a => { a.hidden = !c.mira_mesas; });
}
