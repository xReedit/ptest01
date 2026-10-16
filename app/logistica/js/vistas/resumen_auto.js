// Resumen automatico por WhatsApp (va en Configurar): todos los dias, a la hora elegida, le llega al dueno o
// administrador el resumen de lo pendiente. Lo dispara resumen_auto.php (reloj de backend-pedidos).
import { api } from '../api.js?v=20261015i';
import { esc, aviso, tarjeta } from '../ui.js?v=20261015i';

const hora = h => `${h > 12 ? h - 12 : h}:00 ${h < 12 ? 'a.m.' : 'p.m.'}`;

// Envio automatico por el WhatsApp del POS (el mismo por donde salen los comprobantes). Se guarda al cambiar.
export function tarjetaAuto(d) {
	const a = d.auto;
	return tarjeta({
		titulo: '¿Quieres este resumen en tu WhatsApp cada mañana?',
		ayuda: 'Para el dueño o el administrador: sin entrar al sistema, le llega un mensaje con lo pendiente del día, a la hora que elijas.',
		cuerpo: `<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-start">
			<div style="flex:1;min-width:240px">
				<div class="inv-form-row"><label style="font-weight:600;cursor:pointer;font-size:14px"><input type="checkbox" id="ra_on" ${a.activo ? 'checked' : ''}> Sí, mandarlo todos los días</label></div>
				<div class="inv-form-row"><span class="inv-label">A qué hora</span>
					<select class="inv-input" id="ra_hora">${Array.from({ length: 18 }, (_, i) => i + 5).map(h => `<option value="${h}" ${h === a.hora ? 'selected' : ''}>${hora(h)}</option>`).join('')}</select></div>
				<div class="inv-form-row"><span class="inv-label">Celular que lo recibe</span>
					<input class="inv-input" id="ra_tel" inputmode="tel" maxlength="15" value="${esc(d.telefono || '')}" placeholder="Ej: 987654321"></div>
				<div class="inv-form-row"><button class="btn btn-sm btn-success" id="ra_probar"><i class="fa fa-paper-plane"></i>Mandar uno de prueba ahora</button>
					<span class="inv-sub" id="ra_estado">${a.resultado ? 'Último envío: ' + esc(a.resultado) : ''}</span></div>
				<p class="inv-sub">Sale del WhatsApp que tienen vinculado en la PC de la central (el mismo que manda los comprobantes). Si esa PC está apagada, se vuelve a intentar en las siguientes 3 horas.</p>
			</div>
			<div class="lg-wsp-ejemplo"><span class="inv-label">Así se ve el mensaje</span>
				<div><b>Resumen de logística</b><br>• 2 envíos sin confirmar hace más de 24 h: AYCHA, EL BRASAS<br>• 1 orden de compra atrasada (Backus)<br>
				• 3 pedidos de sedes por atender<br>• 5 lotes vencen en 7 días<br><br>Recomendación: llama hoy a AYCHA para que confirme lo que recibió.</div></div>
		</div>`,
	});
}

export function activarAuto(cont) {
	const on = cont.querySelector('#ra_on'), hr = cont.querySelector('#ra_hora'), tel = cont.querySelector('#ra_tel');
	const guardar = async () => {
		try {
			await api('resumen.php?op=auto', { activo: on.checked, hora: Number(hr.value), telefono: tel.value });
			aviso(on.checked ? `Listo: el resumen llegará todos los días a las ${hora(Number(hr.value))}.` : 'Envío automático apagado.');
		} catch (err) {
			aviso(err.message, 'error');
			if (on.checked && tel.value.replace(/\D/g, '').length < 9) { on.checked = false; tel.focus(); }
		}
	};
	[on, hr, tel].forEach(el => el.addEventListener('change', guardar));
	cont.querySelector('#ra_probar').addEventListener('click', async e => {
		const btn = e.currentTarget;
		if (tel.value.replace(/\D/g, '').length < 9) { aviso('Escribe el WhatsApp de quien recibe el resumen (9 dígitos).', 'error'); tel.focus(); return; }
		btn.disabled = true;
		btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>Enviando…';
		try {
			await api('resumen.php?op=telefono', { telefono: tel.value });
			await api('resumen.php?op=enviar_ahora', {});
			aviso('Resumen enviado por WhatsApp. Revisa el celular.');
			cont.querySelector('#ra_estado').textContent = 'Último envío: recién enviado';
		} catch (err) {
			aviso(err.message, 'error');
			cont.querySelector('#ra_estado').textContent = 'Último intento: ' + err.message;
		} finally {
			btn.disabled = false;
			btn.innerHTML = '<i class="fa fa-paper-plane"></i>Probar ahora';
		}
	});
}

