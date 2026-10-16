// Llamadas al backend (bdphp/abastecimiento/*.php). Respuesta esperada: {success, data, error}.
// relativo a este archivo (app/logistica/js/), no a la pagina: sirve dentro del POS y en la pagina suelta
const BASE = new URL('../../../bdphp/abastecimiento/', import.meta.url).href;

export class ApiError extends Error {
	constructor(mensaje, status) {
		super(mensaje);
		this.status = status;
	}
}

// Loader en el boton que disparo la accion: se recuerda el ultimo .btn clicado (el "Sí" de un confirmar renueva el plazo
// del boton que abrio la pregunta) y, si un POST arranca poco despues, el boton gira hasta que responde. Vale para todas las vistas.
let ultimo = null, cuando = 0;
document.addEventListener('click', e => {
	const b = e.target.closest('.btn');
	if (!b) { return; }
	// confirmar(): "Si" renueva el plazo del boton que abrio la pregunta; "No" no hace nada. Otros dialogos (Producir, Guardar) giran ellos
	if (b.dataset.r !== undefined) { if (b.dataset.r === '1') { cuando = Date.now(); } return; }
	ultimo = b; cuando = Date.now();
}, true);

function cargando() {
	const b = ultimo;
	if (!b || !b.isConnected || Date.now() - cuando > 1500 || b.querySelector('.fa-spin')) { return () => {}; }
	ultimo = null;
	const deshab = b.disabled;
	b.classList.add('lg-cargando');
	b.disabled = true;
	return () => { b.classList.remove('lg-cargando'); if (!deshab) { b.disabled = false; } };
}

/**
 * @param {string} archivo ej. 'sesion.php'
 * @param {object} [body] si viene, se envia POST JSON
 */
export async function api(archivo, body) {
	const opts = body === undefined
		? { credentials: 'same-origin' }
		: { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
	const listo = body === undefined ? () => {} : cargando();
	try { return await pedir(archivo, opts); } finally { listo(); }
}

async function pedir(archivo, opts) {
	let res;
	try {
		res = await fetch(BASE + archivo, opts);
	} catch (e) {
		throw new ApiError('Sin conexión con el servidor. Revisa tu internet.', 0);
	}
	if (res.status === 401) { throw new ApiError('Tu sesión terminó. Vuelve a entrar al sistema.', 401); }
	let json;
	try { json = await res.json(); } catch (e) { throw new ApiError('El servidor respondió algo inesperado.', res.status); }
	if (!res.ok || !json.success) { throw new ApiError(json.error || 'No se pudo completar la operación.', res.status); }
	return json.data;
}

/**
 * Sube un archivo a un endpoint legacy del POS (ej. 'log_compras.php?op=factura-leer', que responde {success, datos, error}).
 * @param {string} rutaBdphp relativa a bdphp/
 */
export async function subirLegacy(rutaBdphp, campo, archivo) {
	const fd = new FormData();
	fd.append(campo, archivo);
	let res;
	try {
		res = await fetch(new URL('../../../bdphp/' + rutaBdphp, import.meta.url).href, { method: 'POST', credentials: 'same-origin', body: fd });
	} catch (e) {
		throw new ApiError('Sin conexión con el servidor. Revisa tu internet.', 0);
	}
	let json;
	try { json = await res.json(); } catch (e) { throw new ApiError('El servidor respondió algo inesperado.', res.status); }
	if (!json.success) { throw new ApiError(json.error || 'No se pudo leer el archivo.', res.status); }
	return json.datos;
}
