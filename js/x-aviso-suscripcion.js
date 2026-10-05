/* Aviso de pago de la suscripcion (restobar-consola F9).
 * Solo para el ADMINISTRADOR. Tarjeta flotante NO modal (abajo a la izquierda): el POS puede estar
 * a mitad de una venta, asi que nunca bloquea la caja ni obliga a esperar.
 * "Despues" la oculta hasta el dia siguiente. Tambien agrega "Mi suscripcion" al menu del usuario.
 * El backend (bdphp/log_suscripcion.php) decide todo; si la consola no esta activa no se muestra nada. */
(function () {
	'use strict';

	// Color de la cabecera por nivel (clase fija; nada de esto viene del servidor).
	var NIVELES = {
		aviso: { icono: 'fa-calendar', clase: '' },
		vencido: { icono: 'fa-exclamation-circle', clase: 'xsus-rojo' },
		urgente: { icono: 'fa-exclamation-triangle', clase: 'xsus-rojo' }
	};
	var MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

	function fecha(iso) {
		// 'YYYY-MM-DD' -> '30 sep 26' (mismo formato que la consola; sin Date: evita corrimientos de zona horaria)
		var p = String(iso || '').split('-');
		return p.length === 3 ? p[2] + ' ' + MESES[Number(p[1]) - 1] + ' ' + p[0].slice(2) : '';
	}
	function soles(monto) {
		var n = Number(monto);
		return isFinite(n) ? 'S/ ' + n.toFixed(2) : ''; // espacio duro: "S/" no queda solo al final de una linea
	}
	function dias(n) { return n === 1 ? '1 día' : n + ' días'; }
	function hoy() {
		var d = new Date();
		return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
	}
	function leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
	function guardar(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* modo privado */ } }
	function linkSeguro(u) { return /^https?:\/\//.test(String(u || '')) ? u : null; }

	// titulo (grande, en la cabecera de color), sub (debajo del titulo), cuerpo (por que pagar ahora).
	function textos(d) {
		var atraso = Math.abs(Number(d.dias) || 0);
		if (d.problemaTarjeta === 'rechazada') {
			return { titulo: 'No pudimos cobrar tu tarjeta', sub: 'La renovación automática no se completó', cuerpo: 'Paga ahora con otra tarjeta, Yape o QR para no perder el acceso a tu sistema.' };
		}
		if (d.problemaTarjeta === 'vencida') {
			return { titulo: 'Tu tarjeta guardada venció', sub: 'La renovación automática no podrá cobrarse', cuerpo: 'Paga ahora con una tarjeta vigente y la renovación automática seguirá funcionando.' };
		}
		if (d.nivel === 'aviso') {
			return {
				titulo: d.dias === 0 ? 'Tu plan vence HOY' : 'Tu plan vence en ' + dias(d.dias),
				sub: 'Vence el ' + fecha(d.pagadoHasta),
				cuerpo: 'Renueva ahora en 1 minuto y sigue vendiendo sin cortes.'
			};
		}
		if (d.nivel === 'vencido') {
			return {
				titulo: 'Tu plan está vencido',
				sub: 'Venció el ' + fecha(d.pagadoHasta) + (atraso ? ' · hace ' + dias(atraso) : ''),
				cuerpo: 'Paga hoy para no perder el acceso a tu sistema.'
			};
		}
		return {
			titulo: 'Tu servicio se suspenderá',
			sub: d.fechaBloqueo ? 'Se suspende el ' + fecha(d.fechaBloqueo) : 'Llevas ' + dias(atraso) + ' de atraso',
			cuerpo: 'Evita la suspensión: paga ahora y sigue trabajando con normalidad.'
		};
	}

	function agregarAlMenu(link) {
		// Junto a "Cerrar Sesion" del dialogo de usuario (dialog_us).
		var cont = document.getElementById('datosGeneralesUs');
		if (!cont || document.getElementById('xsus_menu')) { return; }
		var a = document.createElement('a');
		a.id = 'xsus_menu';
		a.href = link;
		a.target = '_blank';
		a.rel = 'noopener';
		a.className = 'xfont12 xpadingLateralDe';
		a.textContent = 'Mi suscripción';
		cont.appendChild(a);
	}

	function el(tag, clase, texto) {
		var e = document.createElement(tag);
		if (clase) { e.className = clase; }
		if (texto) { e.textContent = texto; } // siempre textContent: nada del servidor entra como HTML
		return e;
	}

	function mostrarTarjeta(d, link) {
		var cfg = d.problemaTarjeta ? NIVELES.urgente : NIVELES[d.nivel];
		var t = textos(d);
		var claveCierre = '::app3_sus_cerrado_' + d.nivel + '_' + d.pagadoHasta;
		if (leer(claveCierre) === hoy()) { return; }

		var card = el('div', ('xsus-card ' + cfg.clase).trim());
		card.setAttribute('role', 'alertdialog');
		card.setAttribute('aria-label', t.titulo);

		// Cabecera de color: lo primero que se ve.
		var cab = el('div', 'xsus-cab');
		var ic = el('div', 'xsus-icon');
		ic.innerHTML = '<i class="fa ' + cfg.icono + '"></i>'; // clase fija del mapa NIVELES
		var tit = el('div', 'xsus-tit');
		tit.appendChild(el('b', '', t.titulo));
		tit.appendChild(el('span', '', t.sub));
		cab.appendChild(ic);
		cab.appendChild(tit);

		var cuerpo = el('div', 'xsus-cuerpo');
		cuerpo.appendChild(el('p', 'xsus-texto', t.cuerpo));
		if (Number(d.reconexion) > 0 && cfg.clase === 'xsus-rojo') {
			// En rojo (vencido / por suspenderse / tarjeta con problema) el costo de reconexion va resaltado ANTES del boton.
			cuerpo.appendChild(el('div', 'xsus-reconexion', 'Si se suspende el servicio, reconectarlo te costará ' + soles(d.reconexion) + ' adicionales. Paga hoy y evítalo.'));
		}
		if (d.monto) {
			var monto = el('div', 'xsus-monto');
			monto.appendChild(el('span', '', 'Total a pagar'));
			monto.appendChild(el('b', '', soles(d.monto)));
			cuerpo.appendChild(monto);
		}
		var pagar = el('a', 'xsus-pagar', d.monto ? 'Pagar ' + soles(d.monto) + ' ahora' : 'Pagar ahora');
		pagar.href = link;
		pagar.target = '_blank';
		pagar.rel = 'noopener';
		cuerpo.appendChild(pagar);
		cuerpo.appendChild(el('div', 'xsus-medios', 'QR (Plin y bancos) · Yape · Tarjeta'));
		if (Number(d.reconexion) > 0 && cfg.clase !== 'xsus-rojo') {
			cuerpo.appendChild(el('div', 'xsus-nota', 'Si el servicio se suspende, reconectarlo cuesta ' + soles(d.reconexion) + '.'));
		}
		var despues = el('button', 'xsus-despues', 'Recordarme mañana');
		despues.type = 'button';
		despues.onclick = function () {
			guardar(claveCierre, hoy());
			card.classList.add('xsus-saliendo');
			setTimeout(function () { card.remove(); }, 220);
		};
		cuerpo.appendChild(despues);

		card.appendChild(cab);
		card.appendChild(cuerpo);
		document.body.appendChild(card);
	}

	function iniciar() {
		fetch('../../bdphp/log_suscripcion.php?op=estado', { credentials: 'same-origin' })
			.then(function (r) { return r.json(); })
			.then(function (r) {
				var d = r && r.success ? r.datos : null;
				if (!d || !d.activa || !d.esAdmin) { return; }
				var link = linkSeguro(d.link);
				if (!link) { return; }
				agregarAlMenu(link);
				if (NIVELES[d.nivel]) { mostrarTarjeta(d, link); }
			})
			.catch(function () { /* sin aviso: nunca interrumpe el POS */ });
	}

	// Un poco despues de cargar, para no competir con la carga inicial del POS.
	if (document.readyState === 'complete') { setTimeout(iniciar, 1500); }
	else { window.addEventListener('load', function () { setTimeout(iniciar, 1500); }); }
})();
