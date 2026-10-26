// Esperas del modulo: lo que se le pide a la PC del local (buscar grabadores, conectar, sacar una foto) tarda unos
// segundos y se consulta cada 2 s hasta 60 s. Sin DOM: se prueba en Node con timers falsos.
// Todo se corta con la senal de la pantalla (ctx.senal del router): al salir no queda ningun timer ni pedido nuevo.

const CADA_MS = 2000;
const HASTA_MS = 60000;
const TERMINADO = new Set(['ok', 'error', 'expirado', 'cancelado']);   // estados finales de GET comandos/{id}
const TARDA = 'La PC del local está tardando en responder. Revisa que esté prendida y vuelve a intentar.';
const NO_SALIO = 'No se pudo completar, vuelve a intentar.';

/** Espera ms. Resuelve true si se cumplio, false si la senal se aborto antes (y el timer se limpia). */
export function dormir(ms, senal = null) {
	return new Promise(resolver => {
		if (senal && senal.aborted) { resolver(false); return; }
		const cortar = () => { clearTimeout(id); resolver(false); };
		const id = setTimeout(() => {
			if (senal) { senal.removeEventListener('abort', cortar); }
			resolver(true);
		}, ms);
		if (senal) { senal.addEventListener('abort', cortar, { once: true }); }
	});
}

/** Un corte de red, 429 o 5xx no corta la espera: se vuelve a consultar en la proxima vuelta. */
const pasajero = e => !!e && (e.status === 0 || e.status === 429 || e.status >= 500);

/**
 * Llama consultar() enseguida y luego cada `cada` ms hasta que listo(valor) o pasen `hasta` ms.
 * Devuelve {estado:'listo', valor} | {estado:'vencido', valor (el ultimo)} | {estado:'cancelado'} (senal abortada).
 * Otro error de consultar() se lanza; uno pasajero que sigue al vencer, tambien.
 */
export async function sondear(consultar, { listo, cada = CADA_MS, hasta = HASTA_MS, senal = null, ahora = () => Date.now() } = {}) {
	const fin = ahora() + hasta;
	const cancelado = () => !!senal && senal.aborted;
	let valor;
	for (;;) {
		if (cancelado()) { return { estado: 'cancelado' }; }
		let falla = null;
		try {
			valor = await consultar();
		} catch (e) {
			if (!pasajero(e)) { throw e; }
			falla = e;
		}
		if (cancelado()) { return { estado: 'cancelado' }; }
		if (!falla && listo(valor)) { return { estado: 'listo', valor }; }
		if (ahora() + cada > fin) {
			if (falla) { throw falla; }
			return { estado: 'vencido', valor };
		}
		if (!(await dormir(cada, senal))) { return { estado: 'cancelado' }; }
	}
}

/** Espera un pedido a la PC del local (comando_id de descubrir, equipos o foto) hasta un estado final. */
export const esperarComando = (api, id, senal = null) =>
	sondear(() => api.get(`comandos/${encodeURIComponent(id)}`), { listo: c => !!c && TERMINADO.has(c.estado), senal });

/**
 * Texto para el usuario si el pedido no salio, '' si salio. El servidor ya manda `error` en palabras simples
 * ("Usuario o clave del grabador incorrectos", "La cámara no respondió"…). Un 'cancelado' de sondear se revisa antes.
 */
export function falloComando(r) {
	if (r.estado === 'vencido') { return TARDA; }
	if (r.estado !== 'listo' || r.valor.estado === 'ok') { return ''; }
	return r.valor.error || NO_SALIO;
}
