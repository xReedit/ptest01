// Datos del editor "Armar salon": bdphp/log_maqueta.php (planos, guardar, activar; solo POST JSON), las areas de
// la sede con el mismo op de log_009.php que usa x-comp-area-mesa (5001) y, del POS, si la sede usa mesas
// alfanumericas y cuantas mesas tiene sin areas (lo mismo que lee x-control-mesas.html en xPintarMesas).
// Sede y usuario salen de la sesion PHP (la cookie del POS: misma pagina de origen).
import { mesasDelArea } from './plano.js?v=20261102m';

// relativo a este archivo (app/maqueta/js/), no a la pagina
const BDPHP = new URL('../../../bdphp/', import.meta.url).href;
// El POS guarda sus datos de sesion en localStorage como JSON en base64 (xm_log_get de app/view/xm_all.js). Se lee
// el de la sede de la sesion PHP (no el de otra sede que opere la pestaña: log_maqueta no pasa por log_pos_op).
const LLAVE_POS = '::app3_woDUS';

/** Error con el codigo del servidor (conflicto, sin_plano, no_session…) o sin_conexion / respuesta_rara. */
export class ErrorMaqueta extends Error {
	constructor(codigo, data = null) {
		super(codigo);
		this.codigo = codigo;
		this.data = data;
	}
}

/** fetch que lee el JSON tambien en 401/403/500 (log_maqueta responde {success, data, error} siempre). */
async function pedir(url, opciones) {
	let res;
	try {
		res = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...opciones });
	} catch (e) {
		throw new ErrorMaqueta('sin_conexion');
	}
	let json = null;
	try { json = JSON.parse(await res.text()); } catch (e) { json = null; }
	if (res.status === 401) { throw new ErrorMaqueta('no_session'); }
	if (!json || typeof json !== 'object') { throw new ErrorMaqueta('respuesta_rara'); }
	return json;
}

async function maqueta(op, cuerpo) {
	const json = await pedir(`${BDPHP}log_maqueta.php?op=${op}`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo),
	});
	if (!json.success) { throw new ErrorMaqueta(json.error || 'error_interno', json.data); }
	return json.data;
}

/** @returns {Promise<{activo: boolean, puedeEditar: boolean, planos: object[]}>} */
export const pedirPlanos = () => maqueta('planos', {});
/** @returns {Promise<{version: number}>} lanza ErrorMaqueta('conflicto', {version}) si otra PC guardo antes */
export const guardarPlano = plano => maqueta('guardar', { plano });
/** lanza ErrorMaqueta('sin_plano') si se quiere prender sin ningun area guardada */
export const activarMaqueta = activo => maqueta('activar', { activo });

/** Areas de la sede (op 5001 de log_009.php): [{title, titulo, desde, hasta, prefijo?}]. */
export async function pedirAreas() {
	const json = await pedir(`${BDPHP}log_009.php`, {
		method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'op=5001',
	});
	if (!json.success || !Array.isArray(json.datos)) { throw new ErrorMaqueta('error_interno'); }
	return json.datos;
}

/**
 * Guarda las areas de la sede como la pestaña AREAS Y MESAS de Configuracion: op 50 (numericas) u op 51 (con
 * prefijo) de log_009.php, que re-insertan todas las areas y marcan el tipo de mesa de la sede.
 * @param {Array<{titulo: string, descripcion: string, desde: number, hasta: number, prefijo: string}>} lista
 */
export async function guardarAreas(lista, alfanumerica) {
	const json = await pedir(`${BDPHP}log_009.php`, {
		method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: alfanumerica ? 51 : 50, listAreas: lista }),
	});
	if (!json.success) { throw new ErrorMaqueta('error_interno'); }
}

/**
 * Lo que el POS sabe de la sede: si usa mesas alfanumericas (sede_otros_datos) y cuantas mesas tiene
 * (datos_org_all_sede, la cuenta que usa Control de pedidos cuando la sede no tiene areas). null si no hay datos
 * (la pagina se abrio sin haber entrado al POS en este navegador).
 */
export function datosSedePOS() {
	try {
		const crudo = window.localStorage.getItem(LLAVE_POS);
		if (!crudo) { return null; }
		const sede = JSON.parse(window.atob(crudo)).sede;
		const otros = sede.otros_datos && sede.otros_datos[0];
		const todos = sede.datos_org_all_sede && sede.datos_org_all_sede[0];
		return { alfanumerica: !!otros && otros.mesas_alfanumerica === '1', mesas: todos ? parseInt(todos.mesas, 10) || 0 : 0 };
	} catch (e) {
		return null;
	}
}

/**
 * Areas que se arman en el editor: [{area, nombre, codigos}]. area = titulo sin espacios (llave de plano_area);
 * nombre = como se ve en la pestaña. Sede sin areas: una sola, area '', con todas sus mesas.
 */
export function areasDelEditor(filas, sede) {
	if (!filas.length) {
		return [{ area: '', nombre: 'Salón', codigos: mesasDelArea({ desde: 1, hasta: sede.mesas }, false) }];
	}
	// con prefijo si la sede lo dice o si el servidor ya manda prefijo (cambio de tipo hecho despues de entrar al POS)
	return filas.map(f => ({ area: String(f.title), nombre: String(f.titulo), codigos: mesasDelArea(f, sede.alfanumerica || f.prefijo != null) }));
}
