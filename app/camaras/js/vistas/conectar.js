// Dialogo "Conectar grabador": usuario y clave del grabador (y, si se agrega a mano, su IP, puerto y marca).
// La clave solo pasa por el campo y el pedido: no se guarda ni se registra, y el campo se vacia al enviar.
// El campo clave es type="text" enmascarado por CSS (.cm-clave, -webkit-text-security): sin type="password" en el
// form, Chrome no lo toma por un login ni ofrece guardar la clave del grabador como clave del POS.
// Despues espera a la PC del local (GET comandos/{id}, cada 2 s hasta 60 s): si conecto → listo(equipo_id); si no,
// el mensaje simple del servidor (ej. "Usuario o clave del grabador incorrectos") y se puede reintentar.
// Cancelar, Esc o salir de la pantalla cortan la espera.
import { esc } from '../ui.js?v=20261020i';
import { esperarComando, falloComando } from '../espera.js?v=20261020i';

export const MARCAS = { dahua: 'Dahua', hikvision: 'Hikvision' };

const AYUDA_CLAVE = 'Es el usuario y la clave con que entras al grabador. Te recomendamos crear uno solo para ver en vivo.';
const ESPERANDO = 'Conectando con el grabador… Puede tardar hasta un minuto.';
const propio = (mapa, k) => (Object.prototype.hasOwnProperty.call(mapa, k) ? mapa[k] : '');

/** "Grabador Dahua en 192.168.1.20" (el puerto solo si no es el 80). */
export function nombreGrabador({ marca, ip, puerto }) {
	const m = propio(MARCAS, marca);
	const p = Number(puerto);
	return `Grabador${m ? ' ' + m : ''} en ${ip}${p && p !== 80 ? `, puerto ${p}` : ''}`;
}

const OCTETO = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTETO}(\\.${OCTETO}){3}$`);

/** El primer dato del grabador que está mal: 'ip', 'puerto', 'marca' o '' si están bien. */
export function campoMalo({ ip, puerto, marca }) {
	if (!IPV4.test(String(ip ?? '').trim())) { return 'ip'; }
	const p = String(puerto ?? '').trim();
	if (!/^\d{1,5}$/.test(p) || Number(p) < 1 || Number(p) > 65535) { return 'puerto'; }
	return propio(MARCAS, marca) ? '' : 'marca';
}

const TEXTO_FALTA = {
	ip: 'Escribe la IP del grabador, por ejemplo 192.168.1.20.',
	puerto: 'El puerto es un número del 1 al 65535. Si no lo sabes, deja 80.',
	marca: 'Elige la marca del grabador.',
	usuario: 'Escribe el usuario del grabador.',
	clave: 'Escribe la clave del grabador.',
};

/** Revisa IP, puerto y marca del grabador: '' si están bien, o qué corregir. */
export const revisarManual = g => propio(TEXTO_FALTA, campoMalo(g));

// POST equipos responde 400 con el nombre del primer campo malo, o 404 si el motor ya no está activo
const TEXTO_CONECTAR = {
	ip: 'La IP del grabador no es válida. Escríbela como 192.168.1.20.',
	puerto: 'El puerto es un número del 1 al 65535. Si no lo sabes, deja 80.',
	marca: 'Elige la marca del grabador.',
	usuario: 'Escribe el usuario del grabador (hasta 64 letras).',
	clave: 'Escribe la clave del grabador (hasta 128 letras).',
	no_encontrado: 'La PC del local ya no está vinculada. Vuelve al inicio y revisa.',
};
export const errorConectar = e => propio(TEXTO_CONECTAR, e.codigo) || e.message;

function htmlMarca(marca) {
	const op = Object.entries(MARCAS).map(([k, n]) => `<option value="${k}"${k === marca ? ' selected' : ''}>${n}</option>`).join('');
	return `<label class="inv-field"><span class="inv-label">Marca</span>
		<select class="inv-select" name="marca"><option value="">Elige la marca</option>${op}</select></label>`;
}

export function htmlDialogo(g) {
	const subtitulo = g.aMano ? 'Escribe los datos del grabador. La IP sale en el menú de red del grabador.' : nombreGrabador(g);
	const red = g.aMano ? `<div class="cm-form-fila">
			<label class="inv-field cm-ip"><span class="inv-label">IP del grabador</span>
				<input class="inv-input" name="ip" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="192.168.1.20" value="${esc(g.ip)}"></label>
			<label class="inv-field cm-puerto"><span class="inv-label">Puerto</span>
				<input class="inv-input" name="puerto" inputmode="numeric" autocomplete="off" maxlength="5" value="${esc(g.puerto)}"></label>
		</div>` : '';
	return `<form novalidate>
		<div class="xdlg-head"><h3><i class="fa fa-plug"></i>${g.aMano ? 'Agregar grabador a mano' : 'Conectar grabador'}</h3><p>${esc(subtitulo)}</p></div>
		<div class="xdlg-body cm-form">
			${red}
			${g.aMano || !g.marca ? htmlMarca(g.marca) : ''}
			<label class="inv-field"><span class="inv-label">Usuario del grabador</span>
				<input class="inv-input" name="usuario" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="64"></label>
			<label class="inv-field"><span class="inv-label">Clave del grabador</span>
				<input class="inv-input cm-clave" type="text" name="clave" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="128"></label>
			<p class="inv-ayuda cm-nota"><i class="fa fa-info-circle"></i> ${esc(AYUDA_CLAVE)}</p>
			<p class="cm-dlg-msg" role="status" hidden></p>
		</div>
		<div class="xdlg-foot">
			<button class="btn btn-sm btn-light" type="button" data-r="0"><i class="fa fa-times"></i>Cancelar</button>
			<button class="btn btn-sm btn-success" type="submit"><i class="fa fa-plug"></i>Conectar</button>
		</div>
	</form>`;
}

const campo = (form, n) => (form.elements[n] ? form.elements[n].value.trim() : null);

function mensaje(dlg, texto, clase) {
	const p = dlg.querySelector('.cm-dlg-msg');
	p.hidden = !texto;
	p.className = 'cm-dlg-msg ' + clase;
	p.innerHTML = texto ? `<i class="fa ${clase === 'espera' ? 'fa-spinner fa-spin' : 'fa-exclamation-circle'}"></i>${esc(texto)}` : '';
}

function ocupado(o, si) {
	o.estado.ocupado = si;
	for (const el of o.form.querySelectorAll('input, select, button[type="submit"]')) { el.disabled = si; }
	mensaje(o.dlg, si ? ESPERANDO : '', 'espera');
}

function fallo(o, texto) {
	ocupado(o, false);
	mensaje(o.dlg, texto, 'mal');
	o.form.elements.clave.focus();
}

async function enviar(o) {
	const { form } = o;
	const g = { ip: campo(form, 'ip') ?? o.base.ip, puerto: campo(form, 'puerto') ?? String(o.base.puerto), marca: campo(form, 'marca') ?? o.base.marca };
	const usuario = campo(form, 'usuario');
	const donde = campoMalo(g) || (usuario ? '' : 'usuario') || (form.elements.clave.value ? '' : 'clave');
	if (donde) {
		mensaje(o.dlg, TEXTO_FALTA[donde], 'mal');
		(form.elements[donde] || form.elements.usuario).focus();
		return;
	}
	const cuerpo = { motor_id: o.motorId, ip: g.ip, puerto: Number(g.puerto), marca: g.marca, usuario, clave: form.elements.clave.value };
	form.elements.clave.value = '';   // la clave no queda en la pantalla: para reintentar se escribe de nuevo
	ocupado(o, true);
	o.estado.enviado = true;   // desde aqui el grabador puede quedar en la lista de la sede aunque se cancele
	try {
		const res = await o.api.post('equipos', cuerpo);
		const r = await esperarComando(o.api, res.comando_id, o.senal);
		if (r.estado === 'cancelado') { return; }
		const falla = falloComando(r);
		if (falla) { fallo(o, falla); return; }
		o.estado.conectado = true;
		o.dlg.close();
		o.listo(res.equipo_id);
	} catch (e) {
		if (!o.senal.aborted) { fallo(o, errorConectar(e)); }
	}
}

/**
 * Abre el dialogo dentro de `dentro` (el contenedor de la pantalla: si se redibuja, el dialogo se va con ella).
 * grabador: {ip, puerto, marca} de uno encontrado o ya agregado, o {aMano: true}.
 * listo(equipoId): conecto. cancelado(): se cerro sin conectar despues de enviar (el grabador pudo quedar en la lista).
 */
export function abrirConectar({ api, senal, dentro, motorId, grabador, listo, cancelado }) {
	const base = { ip: grabador.ip || '', puerto: grabador.puerto || 80, marca: propio(MARCAS, grabador.marca) ? grabador.marca : '', aMano: !!grabador.aMano };
	const dlg = document.createElement('dialog');
	dlg.className = 'cm-dlg';
	dlg.innerHTML = htmlDialogo(base);
	dentro.appendChild(dlg);
	const corte = new AbortController();   // al cerrar el dialogo o al salir de la pantalla
	const estado = { enviado: false, conectado: false, ocupado: false };
	const form = dlg.querySelector('form');
	const o = { api, motorId, base, dlg, form, estado, senal: corte.signal, listo };
	const salir = () => { corte.abort(); dlg.close(); };
	senal.addEventListener('abort', salir, { once: true });
	dlg.addEventListener('close', () => {
		senal.removeEventListener('abort', salir);
		corte.abort();
		dlg.remove();
		if (estado.enviado && !estado.conectado && !senal.aborted) { cancelado(); }
	});
	dlg.querySelector('[data-r="0"]').addEventListener('click', () => dlg.close());
	form.addEventListener('submit', e => {
		e.preventDefault();
		if (!estado.ocupado) { enviar(o); }
	});
	dlg.showModal();
	([...form.querySelectorAll('input, select')].find(el => !el.value) || form.elements.usuario).focus();
}
