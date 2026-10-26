// Cliente del servidor de Cámaras IA (papaya-vision, servidor Go). Sin DOM: se prueba en Node con un fetch falso.
// Entrada por SSO: el legacy (bdphp/log.php?op=-4003) da "URL|token" de un solo uso (120 s); se canjea en
// {URL}/api/v1/sso/canje por una sesion propia (60 min) que va como "Authorization: Bearer" en cada pedido.
// Toda respuesta JSON viene en el sobre {success, data, error}: se devuelve data o se lanza ApiError.
// Cada pedido tiene un tope de 20 s (un servidor colgado no deja la pantalla esperando para siempre) y, si es una
// lectura pedida con conSenal(senal), se corta tambien al abortarse esa senal (la de la pantalla: router.js).

// relativo a este archivo (app/camaras/js/), no a la pagina: sirve igual dentro del POS
const URL_SSO = new URL('../../../bdphp/log.php?op=-4003', import.meta.url).href;
const MARGEN_MS = 60e3;   // renueva si a la sesion le falta menos de esto
export const LIMITE_MS = 20e3;   // tope de cada pedido (y de leer su respuesta)

const SIN_RED = 'Sin conexión con el servicio de cámaras. Revisa el internet y vuelve a intentar.';
const SESION_TERMINO = 'Tu sesión terminó. Vuelve a entrar al POS.';
const NO_SE_PUDO_ENTRAR = 'No se pudo entrar a Cámaras IA. Vuelve a entrar al POS y prueba otra vez.';
const GENERICO = 'Algo salió mal. Vuelve a intentar.';
const SEDE_CAMBIADA = 'El POS cambió de sede. Vuelve a abrir Cámaras IA desde el menú.';
const CANCELADO = 'Se dejó de esperar: saliste de la pantalla.';   // las vistas no lo muestran (miran su senal)
// Ningun codigo crudo llega al usuario: lo que no esta aqui sale como GENERICO (el codigo queda en ApiError.codigo).
// Las vistas que esperan un codigo puntual (ej. codigo_invalido al vincular) ponen su propio texto.
const TEXTOS = {
	modulo_no_activo: 'Cámaras IA no está activo para tu organización. Pídelo a Papaya.',
	sin_permiso: 'No tienes permiso para Cámaras IA. Pídelo al administrador del local.',
	no_session: SESION_TERMINO,
	sesion_invalida: SESION_TERMINO,
	sso_invalido: NO_SE_PUDO_ENTRAR,
	vision_secrets_missing: NO_SE_PUDO_ENTRAR,
	demasiados_pedidos: 'Muchos pedidos seguidos. Espera un momento y vuelve a intentar.',
	error_interno: 'El servicio de cámaras tuvo un problema. Vuelve a intentar en un momento.',
};

export class ApiError extends Error {
	/**
	 * codigo: el error del servidor (snake_case), '' si no hubo, o uno del cliente: 'tiempo_agotado' (paso el tope),
	 * 'cancelado' (se aborto la senal de la pantalla), 'sede_cambiada'. status: HTTP (0 = sin red, tope o cancelado;
	 * 409 = sede_cambiada).
	 */
	constructor(mensaje, codigo = '', status = 0) {
		super(mensaje);
		this.codigo = codigo;
		this.status = status;
	}
}

const errorDe = (codigo, status, otro = GENERICO) => new ApiError(TEXTOS[codigo] || otro, codigo || '', status);
const sinRed = () => new ApiError(SIN_RED, '', 0);

/**
 * Corte de un pedido: a los ms o, antes, al abortarse senal (la de la pantalla; opcional).
 * error(): el ApiError si el pedido no llego. La pantalla se fue → 'cancelado' (nadie lo muestra); se paso del tope
 * → el texto de sin conexion con codigo 'tiempo_agotado' (no parece un cancelar); si no, sin conexion.
 */
function limite(ms, senal = null) {
	let signal;
	if (typeof AbortSignal.any === 'function') {
		const tope = AbortSignal.timeout(ms);
		signal = senal ? AbortSignal.any([senal, tope]) : tope;
	} else {   // navegador sin AbortSignal.any: AbortController + setTimeout
		const c = new AbortController();
		const cortar = () => c.abort();
		setTimeout(() => { if (senal) { senal.removeEventListener('abort', cortar); } c.abort(); }, ms);
		if (senal && senal.aborted) { c.abort(); } else if (senal) { senal.addEventListener('abort', cortar, { once: true }); }
		signal = c.signal;
	}
	const error = () => {
		if (senal && senal.aborted) { return new ApiError(CANCELADO, 'cancelado', 0); }
		return signal.aborted ? new ApiError(SIN_RED, 'tiempo_agotado', 0) : sinRed();
	};
	return { signal, error };
}

async function enviar(fetchFn, url, opts, lim) {
	try {
		return await fetchFn(url, { ...opts, signal: lim.signal });
	} catch (e) {
		throw lim.error();
	}
}

/** Lee el cuerpo (text, blob…); si la red se corta a medio camino es "sin conexion" (o el tope, o cancelado). */
async function leer(res, como, lim) {
	try { return await res[como](); } catch (e) { throw lim.error(); }
}

/** Lee el sobre entero ({success, data, error, meta?}) si success; si no, ApiError con el error del servidor. */
async function leerSobreEntero(res, lim) {
	let json;
	try {
		json = JSON.parse(await leer(res, 'text', lim));
	} catch (e) {
		throw e instanceof ApiError ? e : new ApiError(GENERICO, '', res.status);   // no es JSON (ej. un proxy caido)
	}
	if (json && json.success) { return json; }
	throw errorDe(json && json.error, res.status);
}

/** Lee el sobre: data si success, si no ApiError con el error del servidor. */
const leerSobre = async (res, lim) => (await leerSobreEntero(res, lim)).data;

/**
 * SSO por defecto: pide "URL|token" al legacy y lo canjea. Devuelve {base, token, expira, idsede, nombre}.
 * Cada pedido con su tope, sin la senal de una pantalla: el SSO lo esperan todos los pedidos que salen a la vez.
 */
async function ssoLegacy(fetchFn, ms) {
	const lim = limite(ms);
	const res = await enviar(fetchFn, URL_SSO, { method: 'POST', credentials: 'same-origin' }, lim);
	const texto = (await leer(res, 'text', lim)).trim();
	// 401 no_session, 403 modulo_no_activo o sin_permiso (falta E2), 500 vision_secrets_missing; si PHP solto HTML, solo el texto de entrada
	if (!res.ok) { throw errorDe(/^[a-z_]+$/.test(texto) ? texto : '', res.status, NO_SE_PUDO_ENTRAR); }
	const i = texto.indexOf('|');
	const base = texto.slice(0, i).replace(/\/+$/, '');
	if (i < 0 || !/^https?:\/\//.test(base)) { throw new ApiError(NO_SE_PUDO_ENTRAR, '', res.status); }
	const limCanje = limite(ms);
	const canje = await enviar(fetchFn, base + '/api/v1/sso/canje', {
		method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: texto.slice(i + 1) }),
	}, limCanje);
	const d = await leerSobre(canje, limCanje);
	return { base, token: d.token, expira: d.expira, idsede: d.idsede, nombre: d.nombre };
}

/**
 * Cliente con la sesion guardada. ruta es relativa a /api/v1 ("estado" o "/estado").
 * Renueva la sesion si le falta < 60 s o ante un 401 (una sola vez por pedido; el segundo 401 es "Tu sesión terminó").
 * La sesion queda atada a la sede que tenia el POS al entrar: si el POS cambia de sede hay que crear otro cliente.
 * Si al renovar el SSO trae otra sede (el POS cambio de sede en otra pestaña) lanza 'sede_cambiada' y no la usa.
 * limiteMs: tope de cada pedido. conSenal(senal): el mismo cliente (misma sesion) con las lecturas cortadas por senal.
 * @param {{pedirSSO?: () => Promise<{base:string, token:string, expira:string|number, idsede?:number, nombre?:string}>, fetchFn?: Function, ahora?: () => number, limiteMs?: number}} [o]
 */
export function crearCliente({ fetchFn = (...a) => fetch(...a), ahora = Date.now, limiteMs = LIMITE_MS, pedirSSO = () => ssoLegacy(fetchFn, limiteMs) } = {}) {
	let sesion = null;      // {base, token, expira(ms), idsede, nombre}
	let renovando = null;   // pedidos simultaneos esperan el mismo SSO

	function renovar(vieja) {
		if (sesion && sesion !== vieja) { return Promise.resolve(sesion); }   // otro pedido ya renovo
		if (!renovando) {
			renovando = pedirSSO()
				.then(s => {
					// lo que muestra la pantalla (grabadores, mesas) es de la sede con que se entro: no re-ligar en silencio
					if (sesion && String(s.idsede) !== String(sesion.idsede)) { throw new ApiError(SEDE_CAMBIADA, 'sede_cambiada', 409); }
					const exp = typeof s.expira === 'number' ? s.expira : Date.parse(s.expira);
					// reloj de la PC adelantado (o fecha rara): no renovar en cada pedido; el 401 avisa cuando venza de verdad
					sesion = { base: s.base, token: s.token, expira: exp - ahora() > MARGEN_MS ? exp : Infinity, idsede: s.idsede, nombre: s.nombre };
					return sesion;
				})
				.finally(() => { renovando = null; });
		}
		return renovando;
	}

	const vigente = () => (sesion && sesion.expira - ahora() >= MARGEN_MS ? Promise.resolve(sesion) : renovar(sesion));

	/** Pedido con sesion; devuelve {res, lim} (ya reintentado una vez si hubo 401). lim corta tambien la lectura. */
	async function pedir(metodo, ruta, body, senal) {
		const opts = s => {
			const o = { method: metodo, headers: { Authorization: 'Bearer ' + s.token } };
			if (body !== undefined) {
				o.headers['Content-Type'] = 'application/json';
				o.body = JSON.stringify(body);
			}
			return o;
		};
		const url = s => s.base + '/api/v1/' + String(ruta).replace(/^\/+/, '');
		let s = await vigente();
		let lim = limite(limiteMs, senal);
		let res = await enviar(fetchFn, url(s), opts(s), lim);
		if (res.status === 401) {
			s = await renovar(s);
			lim = limite(limiteMs, senal);
			res = await enviar(fetchFn, url(s), opts(s), lim);
			if (res.status === 401) { throw new ApiError(SESION_TERMINO, 'sesion_invalida', 401); }
		}
		return { res, lim };
	}

	// Solo las lecturas (GET y fotos) se cortan con la senal de la pantalla. Un cambio ya pedido (POST/PUT/DELETE: el
	// nombre de una camara que se guarda al salir del campo, vincular…) termina aunque se salga, como siempre: cortarlo
	// a medio camino podria dejarlo a medias en el servidor. El tope de 20 s vale para todos.
	function cliente(senal) {
		const json = async (metodo, ruta, body) => {
			const { res, lim } = await pedir(metodo, ruta, body, metodo === 'GET' ? senal : null);
			return leerSobre(res, lim);
		};
		return {
			get: ruta => json('GET', ruta),
			post: (ruta, body) => json('POST', ruta, body),   // sin body: POST vacio (ej. pedir una foto)
			put: (ruta, body) => json('PUT', ruta, body),
			del: ruta => json('DELETE', ruta),
			/** Lista paginada (GET sesiones, alertas): {data, meta}; meta = {total, cursor_siguiente} o null si no vino. */
			async lista(ruta) {
				const { res, lim } = await pedir('GET', ruta, undefined, senal);
				const sobre = await leerSobreEntero(res, lim);
				return { data: sobre.data, meta: sobre.meta ?? null };
			},
			/** Foto u otro binario (no viene en el sobre; los errores si). tomada = cabecera X-Tomada o null. */
			async blob(ruta) {
				const { res, lim } = await pedir('GET', ruta, undefined, senal);
				if (!res.ok || /json/i.test(res.headers.get('Content-Type') || '')) { await leerSobre(res, lim); throw new ApiError(GENERICO, '', res.status); }
				return { blob: await leer(res, 'blob', lim), tomada: res.headers.get('X-Tomada') };
			},
			/** Sede y usuario de la sesion (del canje): a que sede van los cambios. Entra si hace falta. */
			async sesion() {
				const s = await vigente();
				return { idsede: s.idsede, nombre: s.nombre };
			},
			/** URL del servidor de camaras (null hasta el primer pedido). */
			base: () => (sesion ? sesion.base : null),
			/** El mismo cliente con las lecturas cortadas al abortarse otra (la de la pantalla; router.js lo usa). */
			conSenal: otra => cliente(otra || null),
		};
	}

	return cliente(null);
}
