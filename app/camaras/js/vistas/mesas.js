// Marcar mesas sobre la foto de una cámara (ruta "mesas/<camaraId>", desde Grabadores y cámaras).
// El usuario toca las esquinas de cada mesa (con sus sillas), la cierra tocando la primera esquina (o Cerrar mesa)
// y elige qué mesa del POS es (select nativo: las ya marcadas en esta cámara salen deshabilitadas, "05" y "5" son
// la misma) y cuántas sillas tiene. Guardar manda todas juntas (PUT zonas reemplaza las de la cámara).
// Los puntos van normalizados 0..1 (geometria.js). Si se sale con cambios sin guardar se pregunta (ctx.alSalir).
// Al salir (ctx.senal) se suelta todo: la foto (object URL), el ResizeObserver, el dibujo pendiente y el dialogo.
import { esc, tarjeta, volver, aviso, confirmar } from '../ui.js?v=20261020i';
import { vigente } from '../router.js?v=20261020i';
import { normalizar, puntoEnPoligono, poligonoValido, centro } from '../geometria.js?v=20261020i';
import { cargarMesasSede, claveMesa, codigoValido } from '../mesas-sede.js?v=20261020i';
import { nombreCamara, textoTomada, avisoFotoChica } from './equipos.js?v=20261020i';

const AYUDA = 'Haz clic en las esquinas de cada mesa, incluyendo las sillas. Cuando termines, elige el número de mesa.';
const CONSEJO = 'Marca el lugar donde se sienta la gente (la mesa más una silla de fondo alrededor): la cámara cuenta personas, no sillas, y ese lugar casi no cambia aunque las sillas se muevan. Deja fuera el pasillo y no pises la mesa de al lado.';
const MAX_ZONAS = 60;
const MAX_ESQUINAS = 30;
const SILLAS = 4;
const NO_EXISTE = 'Esta cámara ya no existe. Vuelve a Grabadores y cámaras.';
const SIN_MESAS = 'La sede no tiene mesas configuradas. Se configuran en Datos del sistema.';
const OTRA_SEDE = 'El POS cambió de sede en otra pestaña. Vuelve a abrir Cámaras IA desde el menú.';
const NO_LEYO = 'No se pudo leer las mesas del local. Vuelve a entrar a esta pantalla.';
const GENERICO = 'Algo salió mal. Vuelve a intentar.';
const propio = (mapa, k) => (Object.prototype.hasOwnProperty.call(mapa, k) ? mapa[k] : '');

/* ---------- lo que no es DOM (se prueba en Node) ---------- */

/**
 * Opciones del select de mesas para la zona `indice` (-1 = una nueva), en el orden de listaMesas.
 * usada: ya marcada en OTRA zona de esta cámara (misma clave: "05" y "5"); valida: el servidor acepta el código;
 * elegida: la que la zona ya tiene (misma clave y área; si no, la primera con su clave).
 */
export function opcionesMesas(lista, zonas, indice = -1, otras = new Map()) {
	const usadas = new Set(zonas.filter((_, i) => i !== indice).map(z => claveMesa(z.mesa)));
	const propia = indice >= 0 ? zonas[indice] : null;
	const clave = propia ? claveMesa(propia.mesa) : null;
	const area = propia && propia.idarea_mesa != null ? String(propia.idarea_mesa) : '';
	const iguales = lista.map((m, i) => i).filter(i => claveMesa(lista[i].codigo) === clave);
	const elegida = iguales.find(i => lista[i].idarea === area) ?? iguales[0] ?? -1;
	return lista.map((m, i) => ({
		i, codigo: m.codigo, area: m.area, idarea: m.idarea,
		usada: usadas.has(claveMesa(m.codigo)), valida: codigoValido(m.codigo), elegida: i === elegida,
		en: otras.get(claveMesa(m.codigo)) || [],
	}));
}

/**
 * Mesas ya marcadas en OTRAS cámaras de la sede: claveMesa → nombres de esas cámaras. Solo informa: una mesa puede
 * salir en varias cámaras (el servidor junta lo que ven), así que se puede elegir igual.
 * camaras: [{nombre, zonas}] (una cámara cuyas zonas no cargaron va con zonas null).
 */
export function marcadasEnOtras(camaras) {
	const r = new Map();
	for (const { nombre, zonas } of camaras) {
		for (const z of Array.isArray(zonas) ? zonas : []) {
			const k = claveMesa(z.mesa);
			const ya = r.get(k) || [];
			if (!ya.includes(nombre)) { r.set(k, [...ya, nombre]); }
		}
	}
	return r;
}

// idarea de listaMesas es texto ('' sin areas); el servidor pide un entero (0..2^31-1) o null
const idArea = s => (/^\d{1,10}$/.test(String(s ?? '')) && Number(s) <= 2147483647 ? Number(s) : null);
// el servidor acepta hasta 60 letras sin caracteres de control (unicode.IsControl)
const limpiarArea = s => [...String(s ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '')].slice(0, 60).join('');

/** Zona nueva con la mesa m de listaMesas: guarda tambien su área (el panel agrupa por área). */
export const zonaNueva = (m, sillas, poligono) => ({ mesa: m.codigo, idarea_mesa: idArea(m.idarea), area: limpiarArea(m.area), sillas, poligono });

/** Cuerpo del PUT zonas: solo los campos que acepta, en el mismo orden. */
export const cuerpoZonas = zonas => zonas.map(z => ({
	mesa: z.mesa, idarea_mesa: z.idarea_mesa ?? null, area: z.area || '', sillas: z.sillas, poligono: z.poligono,
}));

/** Para saber si hay cambios sin guardar: lo que se mandaria al servidor. */
export const firmaZonas = zonas => JSON.stringify(cuerpoZonas(zonas));

// PUT zonas responde 400 con el primer problema (ver api/openapi.yaml de papaya-vision)
const TEXTO_ZONAS = {
	mesa_repetida: 'Hay dos mesas con el mismo número. Toca una, luego Cambiar mesa, y elige otro número.',
	mesa: 'Una mesa tiene un número que no se puede usar. Tócala, luego Cambiar mesa, y elige otro.',
	sillas: 'Las sillas de cada mesa van de 1 a 30. Revisa las mesas y vuelve a guardar.',
	poligono: 'Una mesa quedó mal marcada (de 3 a 30 esquinas). Bórrala y márcala de nuevo.',
	zonas: 'Una cámara puede tener hasta 60 mesas. Borra algunas y vuelve a guardar.',
	area: 'El área de una mesa no es válida. Tócala, luego Cambiar mesa, y elígela de nuevo.',
	idarea_mesa: 'El área de una mesa no es válida. Tócala, luego Cambiar mesa, y elígela de nuevo.',
	no_encontrado: NO_EXISTE,
};
export const errorZonas = e => propio(TEXTO_ZONAS, e && e.codigo) || (e && e.message) || GENERICO;

/**
 * Mesas que se pueden elegir: las del POS ({idsede, lista} de cargarMesasSede) solo si son de la misma sede que la
 * sesion de Cámaras IA (las zonas van a una cámara de esa sede). Otra pestaña pudo cambiar la sede del POS: entonces
 * lista null (se ven las zonas guardadas y no se marca). Sin idsede (PHP sin actualizar) tampoco: no se puede saber.
 */
export function mesasDeLaSede(config, sesion) {
	if (config.idsede == null || String(config.idsede) !== String(sesion.idsede)) { return { lista: null, error: OTRA_SEDE, otraSede: true }; }
	return { lista: config.lista };
}

/* ---------- pantalla ---------- */

export async function render(cont, { api, senal, alSalir }, t, foco) {
	cont.innerHTML = '<p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p>';
	const id = Number(foco);
	if (!Number.isInteger(id) || id <= 0) { pintarFalla(cont, NO_EXISTE); return; }
	const ruta = `camaras/${encodeURIComponent(id)}`;
	// las mesas del POS y la foto pueden faltar: igual se ven las zonas ya guardadas
	const pMesas = Promise.all([cargarMesasSede(), api.sesion()])
		.then(([config, sesion]) => mesasDeLaSede(config, sesion), e => ({ lista: null, error: e.message }));
	const pFoto = bajarFoto(api, ruta, senal);
	let zonas, equipos;
	try {
		[zonas, equipos] = await Promise.all([api.get(ruta + '/zonas'), api.get('equipos')]);
	} catch (e) {
		if (vigente(t) && !senal.aborted) { pintarFalla(cont, e.codigo === 'no_encontrado' ? NO_EXISTE : e.message); }
		return;
	}
	const [mesas, foto] = await Promise.all([pMesas, pFoto]);
	if (!vigente(t) || senal.aborted) { return; }
	const camaras = (equipos.equipos || []).flatMap(e => e.camaras || []);
	const camara = camaras.find(c => c.id === id);
	if (!camara) { pintarFalla(cont, NO_EXISTE); return; }
	// mesas ya marcadas en las otras cámaras que miran mesas (si una no carga, solo falta su aviso)
	const vecinas = camaras.filter(c => c.id !== id && c.mira_mesas);
	const deVecinas = await Promise.allSettled(vecinas.map(c => api.get(`camaras/${encodeURIComponent(c.id)}/zonas`)));
	if (!vigente(t) || senal.aborted) { return; }
	const otras = marcadasEnOtras(vecinas.map((c, i) => ({
		nombre: nombreCamara(c), zonas: deVecinas[i].status === 'fulfilled' ? deVecinas[i].value : null,
	})));

	// estado de esta pantalla (se descarta entero al salir)
	const v = {
		api, senal, cont, ruta, foto,
		zonas: Array.isArray(zonas) ? zonas : [], guardadas: '',
		lista: mesas.lista, errorLista: mesas.error || '', otraSede: !!mesas.otraSede, otras,
		puntos: [], cursor: null, toque: null, elegida: -1, guardando: false, dialogo: false, cuadro: 0, obs: null,
	};
	v.guardadas = firmaZonas(v.zonas);
	cont.innerHTML = tarjeta({
		titulo: 'Marcar mesas · ' + nombreCamara(camara),
		ayuda: `${esc(AYUDA)}<br><i class="fa fa-lightbulb-o"></i> ${esc(CONSEJO)}`,
		acciones: `${volver('equipos')}<a class="btn btn-sm btn-light" href="#" data-ir="probar/${id}"><i class="fa fa-eye"></i>Probar</a><button class="btn btn-sm btn-success" type="button" data-acc="guardar"><i class="fa fa-check"></i>Guardar</button>`,
		// la barra va DEBAJO de la foto: cambia de alto al marcar y, arriba, correria la foto entre un toque y otro
		cuerpo: `${htmlAvisos(v)}
			<div class="cm-lienzo">${foto.img ? '<canvas aria-label="Foto de la cámara con las mesas marcadas"></canvas>' : htmlSinFoto(foto)}</div>
			<p class="cm-foto-txt">${foto.img ? esc(textoTomada(foto.tomada)) : ''}</p>
			<div class="cm-mesas-barra" aria-live="polite"></div>
			<p class="cm-sub">Mesas marcadas en esta cámara</p>
			<div class="cm-zonas"></div>`,
	});
	v.lienzo = cont.querySelector('.cm-lienzo');
	v.canvas = cont.querySelector('.cm-lienzo canvas');
	enlazar(v);
	if (alSalir) { alSalir(() => hayCambios(v), preguntarSalir); }
	senal.addEventListener('abort', () => soltar(v), { once: true });
	actualizar(v);
}

function pintarFalla(cont, texto) {
	cont.innerHTML = tarjeta({
		titulo: 'Marcar mesas',
		acciones: volver('equipos'),
		cuerpo: `<p class="cm-falla"><i class="fa fa-exclamation-circle"></i>${esc(texto)}</p>`,
	});
}

const preguntarSalir = () => confirmar({
	titulo: '¿Salir sin guardar?',
	textoHtml: 'Las mesas que marcaste o cambiaste en esta cámara todavía no se guardaron. Si sales ahora, se pierden.',
	boton: 'Sí, salir sin guardar',
});

function htmlAvisos(v) {
	const textos = [];
	if (v.lista === null) {
		textos.push(v.otraSede ? OTRA_SEDE : `${v.errorLista} Puedes ver las mesas ya marcadas; para marcar nuevas, vuelve a entrar a esta pantalla.`);
	}
	if (v.lista && !v.lista.length) { textos.push(SIN_MESAS); }
	// foto muy chica (ej. 352×240): solo avisa, se marca igual (las zonas van en 0..1)
	const chica = v.foto.img ? avisoFotoChica(v.foto.img.naturalWidth, v.foto.img.naturalHeight) : '';
	if (chica) { textos.push(chica); }
	return textos.map(x => `<p class="cm-alerta"><i class="fa fa-exclamation-triangle"></i>${esc(x)}</p>`).join('');
}

const htmlSinFoto = foto => `<span class="cm-sin-foto"><i class="fa fa-video-camera"></i>${esc(foto.error
	|| 'Esta cámara todavía no tiene foto. Vuelve a Grabadores y cámaras y toca Actualizar foto.')}</span>`;

/** La foto guardada de la cámara como imagen lista para el lienzo: {img, tomada} o {img: null, error}. */
async function bajarFoto(api, ruta, senal) {
	try {
		const { blob, tomada } = await api.blob(ruta + '/foto');
		if (senal.aborted) { return { img: null }; }
		const url = URL.createObjectURL(blob);
		senal.addEventListener('abort', () => URL.revokeObjectURL(url), { once: true });   // se suelta al salir
		const img = new Image();
		await new Promise((ok, mal) => { img.onload = ok; img.onerror = mal; img.src = url; });
		if (!img.naturalWidth || !img.naturalHeight) { throw new Error('foto vacia'); }
		return { img, tomada };
	} catch (e) {
		return { img: null, error: e && e.codigo === 'sin_foto' ? '' : 'No se pudo cargar la foto. Vuelve a entrar a esta pantalla.' };
	}
}

function soltar(v) {
	if (v.obs) { v.obs.disconnect(); v.obs = null; }
	if (v.alRedimensionar) { window.removeEventListener('resize', v.alRedimensionar); }
	if (v.cuadro) { cancelAnimationFrame(v.cuadro); v.cuadro = 0; }
	// la foto (object URL) la suelta bajarFoto; el dialogo abierto se cierra con su propia escucha de la senal
}

const hayCambios = v => v.puntos.length > 0 || firmaZonas(v.zonas) !== v.guardadas;

/** Por que no se puede empezar una mesa nueva ('' = si se puede). */
function motivoNoMarcar(v) {
	if (v.lista === null) { return v.otraSede ? OTRA_SEDE : NO_LEYO; }
	if (!v.lista.length) { return SIN_MESAS; }
	if (v.zonas.length >= MAX_ZONAS) { return `Esta cámara ya tiene ${MAX_ZONAS} mesas marcadas, que es el máximo.`; }
	return '';
}

/* ---------- eventos ---------- */

function enlazar(v) {
	const card = v.cont.querySelector('.inv-card');
	card.addEventListener('click', e => {
		const b = e.target.closest('[data-acc]');
		if (!b || b.disabled || v.dialogo) { return; }
		const acc = b.dataset.acc;
		if (acc === 'guardar') { guardar(v); }
		if (acc === 'cerrar') { cerrarMesa(v); }
		if (acc === 'deshacer') { v.puntos = v.puntos.slice(0, -1); actualizar(v); }
		if (acc === 'descartar') { v.puntos = []; v.cursor = null; actualizar(v); }
		if (acc === 'elegir') { v.elegida = Number(b.dataset.i); actualizar(v); }
		if (acc === 'cambiar') { cambiarMesa(v); }
		if (acc === 'borrar') { borrarMesa(v); }
		if (acc === 'listo') { v.elegida = -1; actualizar(v); }
	});
	if (!v.canvas) { return; }
	const cv = v.canvas;
	// un toque es pointerdown + pointerup en el mismo lugar: si el dedo arrastra (scroll en la tablet) el navegador
	// manda pointercancel y no se marca nada
	cv.addEventListener('pointerdown', e => {
		if (e.button !== 0 || v.dialogo || v.guardando) { return; }
		v.toque = { id: e.pointerId, x: e.clientX, y: e.clientY };
	});
	cv.addEventListener('pointerup', e => {
		const q = v.toque;
		v.toque = null;
		if (q && q.id === e.pointerId && Math.hypot(e.clientX - q.x, e.clientY - q.y) <= 10) { tocar(v, e); }
	});
	cv.addEventListener('pointercancel', () => { v.toque = null; });
	cv.addEventListener('pointermove', e => {
		if (e.pointerType !== 'mouse' || !v.puntos.length) { return; }
		v.cursor = enLienzo(v, e).p;   // linea guia hasta el mouse
		pedirDibujo(v);
	});
	cv.addEventListener('pointerleave', () => { if (v.cursor) { v.cursor = null; pedirDibujo(v); } });
	// redibujar al cambiar el ancho (girar la tablet, abrir el menu del POS)
	if (typeof ResizeObserver === 'function') {
		v.obs = new ResizeObserver(() => pedirDibujo(v));
		v.obs.observe(v.lienzo);
	} else {
		v.alRedimensionar = () => pedirDibujo(v);
		window.addEventListener('resize', v.alRedimensionar);
	}
}

/** Punto del evento: normalizado 0..1 (p) y en pixeles del lienzo (px), con el tamaño del lienzo. */
function enLienzo(v, e) {
	const r = v.canvas.getBoundingClientRect();
	const px = [e.clientX - r.left, e.clientY - r.top];
	return { p: normalizar(px, r.width, r.height), px, ancho: r.width, alto: r.height };
}

const aPixeles = ([x, y], ancho, alto) => [x * ancho, y * alto];
const cerca = (a, b, radio) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= radio;

function tocar(v, e) {
	const { p, px, ancho, alto } = enLienzo(v, e);
	const radio = e.pointerType === 'mouse' ? 12 : 22;   // el dedo es menos preciso
	if (v.puntos.length) {
		if (v.puntos.length >= 3 && cerca(px, aPixeles(v.puntos[0], ancho, alto), radio)) { cerrarMesa(v); return; }
		if (cerca(px, aPixeles(v.puntos.at(-1), ancho, alto), 4)) { return; }   // doble toque: no repetir la esquina
		if (v.puntos.length >= MAX_ESQUINAS) { aviso(`Una mesa puede tener hasta ${MAX_ESQUINAS} esquinas. Toca Cerrar mesa.`, 'error'); return; }
		v.puntos = [...v.puntos, p];
		actualizar(v);
		return;
	}
	// sin dibujo en curso: tocar una mesa la elige (la de arriba si se pisan); fuera de todas, empieza una nueva
	const i = zonaEn(v.zonas, p);
	if (i >= 0) { v.elegida = i; actualizar(v); return; }
	if (v.elegida >= 0) { v.elegida = -1; actualizar(v); return; }
	const falta = motivoNoMarcar(v);
	if (falta) { aviso(falta, 'error'); return; }
	v.puntos = [p];
	actualizar(v);
}

function zonaEn(zonas, p) {
	for (let i = zonas.length - 1; i >= 0; i--) {
		if (puntoEnPoligono(p, zonas[i].poligono)) { return i; }
	}
	return -1;
}

/* ---------- cerrar, cambiar y borrar una mesa ---------- */

async function cerrarMesa(v) {
	if (!poligonoValido(v.puntos) || v.dialogo) { return; }   // de 3 a 30 esquinas, todo dentro de la foto
	const poligono = v.puntos;
	const r = await elegirMesa(v, -1);
	if (!r || v.senal.aborted) { return; }   // Cancelar: el dibujo sigue abierto para corregirlo o borrarlo
	v.zonas = [...v.zonas, zonaNueva(r.mesa, r.sillas, poligono)];
	v.puntos = [];
	v.cursor = null;
	actualizar(v);
}

async function cambiarMesa(v) {
	const i = v.elegida;
	if (i < 0 || !v.lista || v.dialogo) { return; }
	const r = await elegirMesa(v, i);
	if (!r || v.senal.aborted) { return; }
	const nueva = r.mesa ? zonaNueva(r.mesa, r.sillas, v.zonas[i].poligono) : { sillas: r.sillas };
	v.zonas = v.zonas.map((z, j) => (j === i ? { ...z, ...nueva } : z));
	actualizar(v);
}

async function borrarMesa(v) {
	const i = v.elegida;
	const z = v.zonas[i];
	if (!z || v.dialogo) { return; }
	v.dialogo = true;
	const si = await confirmar({
		titulo: `¿Borrar la mesa ${z.mesa}?`,
		textoHtml: 'Se quita de esta cámara cuando toques <b>Guardar</b>.',
		boton: 'Sí, borrar',
	});
	v.dialogo = false;
	if (!si || v.senal.aborted || v.zonas[i] !== z) { return; }
	v.zonas = v.zonas.filter((_, j) => j !== i);
	v.elegida = -1;
	actualizar(v);
}

function htmlOpciones(v, indice) {
	const ops = opcionesMesas(v.lista, v.zonas, indice, v.otras);
	const propia = indice >= 0 ? v.zonas[indice] : null;
	const hayElegida = ops.some(o => o.elegida);
	let html = `<option value=""${hayElegida || propia ? '' : ' selected'}>Elige la mesa</option>`;
	// la mesa que la zona tenia ya no esta en el POS (la sacaron de las areas): se puede dejar como esta
	if (propia && !hayElegida) { html += `<option value="actual" selected>Mesa ${esc(propia.mesa)} (la que tenía)</option>`; }
	let grupo = null;
	for (const o of ops) {
		if (o.area !== grupo) {
			if (grupo) { html += '</optgroup>'; }
			grupo = o.area;
			if (grupo) { html += `<optgroup label="${esc(grupo)}">`; }
		}
		const nota = !o.valida ? ' · no se puede usar' : o.usada ? ' · ya marcada' : o.en.length ? ` · ya está en ${o.en.join(', ')}` : '';
		html += `<option value="${o.i}"${o.usada || !o.valida ? ' disabled' : ''}${o.elegida ? ' selected' : ''}>Mesa ${esc(o.codigo)}${nota}</option>`;
	}
	return { html: html + (grupo ? '</optgroup>' : ''), libres: ops.some(o => !o.usada && o.valida) };
}

/**
 * Dialogo "¿Qué mesa es?" para la zona indice (-1 = la que se acaba de cerrar).
 * Resuelve {mesa (de listaMesas, o null = la que ya tenia), sillas} o null si se cancelo.
 */
function elegirMesa(v, indice) {
	const propia = indice >= 0 ? v.zonas[indice] : null;
	const { html, libres } = htmlOpciones(v, indice);
	const dlg = document.createElement('dialog');
	dlg.className = 'cm-dlg';
	dlg.innerHTML = `<form novalidate>
		<div class="xdlg-head"><h3><i class="fa fa-th-large"></i>${propia ? 'Cambiar mesa' : '¿Qué mesa es?'}</h3>
			<p>Elige el número de mesa como sale en el POS.</p></div>
		<div class="xdlg-body cm-form">
			<label class="inv-field"><span class="inv-label">Mesa</span><select class="inv-select" name="mesa">${html}</select></label>
			<label class="inv-field cm-sillas"><span class="inv-label">Sillas</span>
				<input class="inv-input" type="number" name="sillas" min="1" max="30" step="1" inputmode="numeric" value="${Number(propia ? propia.sillas : SILLAS)}"></label>
			<p class="inv-ayuda cm-nota"><i class="fa fa-info-circle"></i> ${libres || propia
		? 'Las mesas que ya marcaste en esta cámara no se pueden elegir de nuevo. Si una mesa se ve en dos cámaras, márcala en las dos.'
		: 'Todas las mesas del local ya están marcadas en esta cámara.'}</p>
			<p class="cm-dlg-msg mal" role="status" hidden></p>
		</div>
		<div class="xdlg-foot">
			<button class="btn btn-sm btn-light" type="button" data-r="0"><i class="fa fa-times"></i>Cancelar</button>
			<button class="btn btn-sm btn-success" type="submit"><i class="fa fa-check"></i>Listo</button>
		</div>
	</form>`;
	v.cont.appendChild(dlg);   // dentro de la pantalla (.cm-app): si se redibuja, el dialogo se va con ella
	v.dialogo = true;
	const form = dlg.querySelector('form');
	const msg = dlg.querySelector('.cm-dlg-msg');
	const fallo = (texto, campo) => { msg.hidden = false; msg.innerHTML = `<i class="fa fa-exclamation-circle"></i>${esc(texto)}`; campo.focus(); };
	return new Promise(resolver => {
		let r = null;
		const salir = () => dlg.close();
		v.senal.addEventListener('abort', salir, { once: true });
		dlg.addEventListener('close', () => {
			v.senal.removeEventListener('abort', salir);
			dlg.remove();
			v.dialogo = false;
			resolver(r);
		});
		dlg.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
		form.addEventListener('submit', e => {
			e.preventDefault();
			const valor = form.elements.mesa.value;
			if (!valor) { fallo('Elige el número de mesa.', form.elements.mesa); return; }
			const sillas = Number(form.elements.sillas.value);
			if (!Number.isInteger(sillas) || sillas < 1 || sillas > 30) { fallo('Las sillas van de 1 a 30.', form.elements.sillas); return; }
			r = { mesa: valor === 'actual' ? null : v.lista[Number(valor)], sillas };
			dlg.close();
		});
		dlg.showModal();
		form.elements.mesa.focus();
	});
}

/* ---------- guardar ---------- */

async function guardar(v) {
	if (v.guardando) { return; }
	if (v.puntos.length) {
		aviso('Primero termina la mesa que estás marcando: toca Cerrar mesa, o Borrar dibujo.', 'error');
		return;
	}
	v.guardando = true;
	actualizar(v);
	try {
		// responde las zonas como quedaron en el servidor (lo mismo que GET zonas): con ellas se sigue
		const zonas = await v.api.put(v.ruta + '/zonas', cuerpoZonas(v.zonas));
		if (v.senal.aborted) { return; }
		v.zonas = Array.isArray(zonas) ? zonas : await v.api.get(v.ruta + '/zonas');
		if (v.senal.aborted) { return; }
		v.guardadas = firmaZonas(v.zonas);
		v.elegida = -1;
		aviso('Mesas guardadas', 'ok');
	} catch (e) {
		if (!v.senal.aborted) { aviso(errorZonas(e), 'error'); }   // lo dibujado queda en pantalla
	} finally {
		v.guardando = false;
		if (!v.senal.aborted) { actualizar(v); }
	}
}

/* ---------- pintar ---------- */

function actualizar(v) {
	pintarBarra(v);
	pintarZonas(v);
	const btn = v.cont.querySelector('[data-acc="guardar"]');
	if (btn) {
		btn.disabled = v.guardando || !hayCambios(v);
		btn.innerHTML = v.guardando ? '<i class="fa fa-spinner fa-spin"></i>Guardando…' : '<i class="fa fa-check"></i>Guardar';
	}
	dibujar(v);
}

const boton = (acc, icono, texto, clase = 'btn-light', apagado = false) =>
	`<button class="btn btn-sm ${clase}" type="button" data-acc="${acc}"${apagado ? ' disabled' : ''}><i class="fa ${icono}"></i>${texto}</button>`;

const textoSillas = n => `${Number(n)} silla${Number(n) === 1 ? '' : 's'}`;

function pintarBarra(v) {
	const barra = v.cont.querySelector('.cm-mesas-barra');
	if (!barra) { return; }
	const n = v.puntos.length;
	const z = v.zonas[v.elegida];
	if (n) {
		barra.innerHTML = `<p>Marcando una mesa: ${n} esquina${n === 1 ? '' : 's'}. ${n < 3 ? 'Sigue tocando las esquinas.'
			: 'Para terminar, toca la primera esquina (el punto grande) o <b>Cerrar mesa</b>.'}</p>
			<div class="cm-mesas-botones">${boton('cerrar', 'fa-check', 'Cerrar mesa', 'btn-success', n < 3)}
			${boton('deshacer', 'fa-undo', 'Quitar última esquina')}${boton('descartar', 'fa-times', 'Borrar dibujo')}</div>`;
	} else if (z) {
		barra.innerHTML = `<p><b>Mesa ${esc(z.mesa)}</b>${z.area ? ` · ${esc(z.area)}` : ''} · ${textoSillas(z.sillas)}</p>
			<div class="cm-mesas-botones">${boton('cambiar', 'fa-pencil', 'Cambiar mesa', 'btn-primary', !v.lista || !v.lista.length)}
			${boton('borrar', 'fa-trash', 'Borrar', 'btn-danger')}${boton('listo', 'fa-check', 'Listo')}</div>`;
	} else {
		const falta = v.canvas ? motivoNoMarcar(v) : '';
		const texto = !v.canvas ? 'Sin foto no se pueden marcar mesas.'
			: (falta || 'Toca la foto en una esquina de la mesa para empezar. Toca una mesa marcada para cambiarla o borrarla.');
		const pendiente = hayCambios(v) ? ' <b>Tienes cambios sin guardar: toca Guardar.</b>' : '';
		barra.innerHTML = `<p>${esc(texto)}${pendiente}</p>`;
	}
}

function pintarZonas(v) {
	const caja = v.cont.querySelector('.cm-zonas');
	if (!caja) { return; }
	if (!v.zonas.length) {
		caja.innerHTML = '<p class="inv-ayuda cm-nota">Todavía no hay mesas marcadas en esta cámara.</p>';
		return;
	}
	caja.innerHTML = v.zonas.map((z, i) => `<button class="cm-zona${i === v.elegida ? ' activa' : ''}" type="button" data-acc="elegir" data-i="${i}">
		<b>Mesa ${esc(z.mesa)}</b><span>${z.area ? `${esc(z.area)} · ` : ''}${textoSillas(z.sillas)}</span></button>`).join('');
}

function pedirDibujo(v) {
	if (v.cuadro || v.senal.aborted) { return; }
	v.cuadro = requestAnimationFrame(() => { v.cuadro = 0; dibujar(v); });
}

/** Foto a lo ancho (sin deformar), las mesas marcadas y el dibujo en curso. */
function dibujar(v) {
	const cv = v.canvas;
	const img = v.foto.img;
	if (!cv || !img || v.senal.aborted) { return; }
	const ancho = v.lienzo.clientWidth;
	if (!ancho) { return; }
	const alto = Math.round((ancho * img.naturalHeight) / img.naturalWidth);
	const dpr = window.devicePixelRatio || 1;
	const w = Math.round(ancho * dpr);
	const h = Math.round(alto * dpr);
	if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
	cv.style.height = alto + 'px';
	const g = cv.getContext('2d');
	g.setTransform(dpr, 0, 0, dpr, 0, 0);
	g.clearRect(0, 0, ancho, alto);
	g.drawImage(img, 0, 0, ancho, alto);
	v.zonas.forEach((z, i) => dibujarZona(g, z, i === v.elegida, ancho, alto));
	dibujarEnCurso(g, v, ancho, alto);
}

function trazar(g, puntos, ancho, alto, cerrar) {
	g.beginPath();
	puntos.forEach((p, i) => { const [x, y] = aPixeles(p, ancho, alto); if (i) { g.lineTo(x, y); } else { g.moveTo(x, y); } });
	if (cerrar) { g.closePath(); }
}

function dibujarZona(g, z, elegida, ancho, alto) {
	trazar(g, z.poligono, ancho, alto, true);
	g.fillStyle = elegida ? 'rgba(0, 123, 255, .32)' : 'rgba(40, 167, 69, .26)';
	g.fill();
	g.lineWidth = elegida ? 3 : 2;
	g.strokeStyle = elegida ? '#007bff' : '#28a745';
	g.setLineDash([]);
	g.stroke();
	// el numero de la mesa en una etiqueta blanca al centro
	const [cx, cy] = aPixeles(centro(z.poligono), ancho, alto);
	const texto = String(z.mesa);
	g.font = '600 13px -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
	const w = g.measureText(texto).width + 12;
	g.fillStyle = elegida ? '#007bff' : '#fff';
	g.beginPath();
	if (g.roundRect) { g.roundRect(cx - w / 2, cy - 11, w, 22, 11); } else { g.rect(cx - w / 2, cy - 11, w, 22); }
	g.fill();
	g.fillStyle = elegida ? '#fff' : '#14532d';
	g.textAlign = 'center';
	g.textBaseline = 'middle';
	g.fillText(texto, cx, cy + 1);
}

function dibujarEnCurso(g, v, ancho, alto) {
	const n = v.puntos.length;
	if (!n) { return; }
	g.lineWidth = 2;
	g.strokeStyle = '#f59e0b';
	g.setLineDash([]);
	trazar(g, v.puntos, ancho, alto, false);
	g.stroke();
	if (v.cursor) {   // linea guia hasta el mouse
		const [x0, y0] = aPixeles(v.puntos[n - 1], ancho, alto);
		const [x1, y1] = aPixeles(v.cursor, ancho, alto);
		g.setLineDash([6, 4]);
		g.beginPath();
		g.moveTo(x0, y0);
		g.lineTo(x1, y1);
		g.stroke();
		g.setLineDash([]);
	}
	v.puntos.forEach((p, i) => {
		const [x, y] = aPixeles(p, ancho, alto);
		const primera = i === 0 && n >= 3;   // tocarla cierra la mesa: mas grande y verde
		g.beginPath();
		g.arc(x, y, primera ? 9 : 5, 0, Math.PI * 2);
		g.fillStyle = primera ? '#28a745' : '#fff';
		g.fill();
		g.lineWidth = 2;
		g.strokeStyle = primera ? '#fff' : '#f59e0b';
		g.stroke();
	});
}
