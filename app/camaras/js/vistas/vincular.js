// Vincular la PC del local con el codigo de 6 numeros que muestra el programa. El programa abre el POS en
// "#/camaras?vincular=123456": el codigo llega ya escrito y solo hay que tocar Vincular.
import { esc, tarjeta, volver, aviso } from '../ui.js?v=20261020i';
import { ir, vigente, leerCodigoVincular, sinCodigoVincular } from '../router.js?v=20261020i';

const CODIGO_MALO = 'El código no es válido o ya venció. Míralo en la PC del local y vuelve a intentar.';

/**
 * A que sede queda vinculada la PC: la de la sesion del servidor (idsede del canje). Si el POS muestra esa
 * misma sede, su nombre; si no (cambio de sede, otra sede en esta pestaña), el numero de la sede de la sesion.
 */
export function sedeDestino(sedePOS, sesion) {
	return sedePOS && sedePOS.nombre && String(sedePOS.idsede) === String(sesion.idsede)
		? sedePOS.nombre : `la sede N° ${sesion.idsede}`;
}

// ya usado: que recargar la pagina no vuelva a traerlo. replaceState no avisa al router de Polymer (no recarga).
function quitarCodigoDeLaUrl() {
	const limpio = sinCodigoVincular(location.hash);
	if (limpio !== location.hash) { history.replaceState(history.state, '', limpio); }
}

export async function render(cont, { api, sedePOS }, t) {
	cont.innerHTML = '<p class="inv-empty"><i class="fa fa-spinner fa-spin"></i>Cargando…</p>';
	const sesion = await api.sesion();   // entra al servidor: si Cámaras IA no esta activo se ve aqui, antes de escribir
	if (!vigente(t)) { return; }
	const codigo = leerCodigoVincular(location.hash) || '';
	const pos = sedePOS();
	// el POS cambio de sede despues de abrir Camaras IA (o esta pestaña opera otra sede): la sesion sigue en la anterior
	const otraSede = !pos || String(pos.idsede) !== String(sesion.idsede);
	cont.innerHTML = tarjeta({
		titulo: 'Vincular la PC del local',
		ayuda: 'Escribe el código de 6 números que muestra el programa Papaya Cámaras IA en la PC del local.',
		acciones: volver(''),
		cuerpo: `<p class="cm-destino"><i class="fa fa-map-marker"></i>La PC quedará vinculada a <b>${esc(sedeDestino(pos, sesion))}</b></p>
			${otraSede ? '<p class="inv-ayuda cm-nota"><i class="fa fa-exclamation-triangle"></i> El POS tiene puesta otra sede. Para vincular a esa, vuelve a abrir Cámaras IA desde el menú.</p>' : ''}
			<form class="cm-vincular" novalidate>
				<label class="inv-field">
					<span class="inv-label">Código</span>
					<input class="inv-input cm-codigo" name="codigo" inputmode="numeric" autocomplete="off" maxlength="6" placeholder="000000" value="${esc(codigo)}">
				</label>
				<button class="btn btn-success" type="submit"><i class="fa fa-link"></i>Vincular</button>
			</form>
			<p class="inv-ayuda cm-nota"><i class="fa fa-info-circle"></i> El código aparece en la PC al terminar de instalar el programa y vence a los 15 minutos.</p>`,
	});
	const form = cont.querySelector('form');
	const inp = form.querySelector('input');
	const btn = form.querySelector('button');
	inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, 6); });
	form.addEventListener('submit', async e => {
		e.preventDefault();
		const c = inp.value.trim();
		if (!/^\d{6}$/.test(c)) { aviso('El código tiene 6 números. Míralo en la PC del local.', 'error'); inp.focus(); return; }
		btn.disabled = true;
		try {
			await api.post('motores/vincular', { codigo: c });
		} catch (err) {
			if (!vigente(t)) { return; }   // ya salio de la pantalla: nada que avisar
			btn.disabled = false;
			aviso(err.codigo === 'codigo_invalido' ? CODIGO_MALO : err.message, 'error');
			return;
		}
		quitarCodigoDeLaUrl();
		aviso('Listo, la PC quedó vinculada', 'ok');
		if (vigente(t)) { ir(''); }   // si ya se fue a otra pantalla, no lo saca de ahi
	});
	(codigo ? btn : inp).focus();
}
