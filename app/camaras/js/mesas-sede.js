// Mesas de la sede tal como las numera el POS. Sin DOM: se prueba en Node con un fetch falso.
// El codigo de cada mesa es el MISMO que arma x-anfitrion.html (xAnfListaMesas + xAnfPad): las zonas que se marcan
// sobre la foto se cruzan despues con pedido.nummesa, asi que un "5" en vez de "05" o un prefijo distinto
// separaria la mesa de sus pedidos. Las areas y el numero de mesas salen de log_anfitrion.php?op=config.

// relativo a este archivo (app/camaras/js/), no a la pagina: sirve igual dentro del POS
const URL_CONFIG = new URL('../../../bdphp/log_anfitrion.php?op=config', import.meta.url).href;
const NO_SE_PUDO = 'No se pudo leer las mesas del local. Vuelve a entrar a esta pantalla.';
const FORMATO = /^[A-Za-z0-9-]{1,10}$/;   // el que acepta el servidor (PUT zonas)

/** xAnfPad: a 2 digitos ("5" → "05"; "12" y "100" quedan igual). */
const dos = n => { const s = String(n); return s.length < 2 ? '0' + s : s; };

/**
 * Lista de mesas de la sede (igual que xAnfListaMesas): por areas desde-hasta, con el prefijo del area si la sede
 * usa mesas alfanumericas; sin areas, 01..cfg.mesas. idarea es texto ('' sin areas), como en x-anfitrion.
 * @param {{mesas?: number, alfanumerica?: boolean, areas?: Array<{idarea_mesa, titulo, desde, hasta, prefijo}>}|null} cfg
 * @returns {Array<{codigo: string, idarea: string, area: string}>}
 */
export function listaMesas(cfg) {
	if (!cfg) { return []; }
	const lista = [];
	if (cfg.areas && cfg.areas.length) {
		for (const a of cfg.areas) {
			for (let i = parseInt(a.desde, 10); i <= parseInt(a.hasta, 10); i++) {
				const codigo = cfg.alfanumerica && a.prefijo ? a.prefijo + dos(i) : dos(i);
				lista.push({ codigo, idarea: String(a.idarea_mesa), area: a.titulo });
			}
		}
		return lista;
	}
	for (let j = 1; j <= cfg.mesas; j++) { lista.push({ codigo: dos(j), idarea: '', area: '' }); }
	return lista;
}

/**
 * Clave de la mesa, igual que protocolo.ClaveMesa del servidor: sin espacios; si son solo digitos, sin ceros a la
 * izquierda ("05" → "5", "000" → "0"); si no, en mayusculas. Dos codigos con la misma clave son la misma mesa.
 */
export function claveMesa(codigo) {
	const c = String(codigo ?? '').replace(/\s+/g, '');
	if (!/^\d+$/.test(c)) { return c.toUpperCase(); }
	return c.replace(/^0+/, '') || '0';
}

/** true si el servidor acepta el codigo: letras, numeros y guion, de 1 a 10. */
export const codigoValido = codigo => FORMATO.test(String(codigo ?? ''));

/**
 * Pide la configuracion de mesas de la sede del POS (la sede sale de la sesion PHP). Devuelve {idsede, lista}:
 * idsede es la sede de ESA sesion (otra pestaña del POS pudo cambiarla; null si el PHP no la manda) y lista,
 * listaMesas. Lanza Error con un texto simple si no se pudo (sin red, sesion vencida, PHP caido).
 */
export async function cargarMesasSede(fetchFn = (...a) => fetch(...a)) {
	let json = null;
	try {
		const res = await fetchFn(URL_CONFIG, {
			method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}',
		});
		json = JSON.parse(await res.text());
	} catch (e) {
		throw new Error(NO_SE_PUDO);   // sin red o no es JSON (ej. el HTML de un error de PHP)
	}
	if (json && json.success && json.data) { return { idsede: Number(json.data.idsede) || null, lista: listaMesas(json.data) }; }
	throw new Error(json && typeof json.error === 'string' && json.error ? json.error : NO_SE_PUDO);
}
