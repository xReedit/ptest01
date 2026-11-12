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

	// Raiz del sistema (este archivo esta en js/): sirve igual desde el login y desde app/page/.
	var SCRIPT = document.currentScript;
	var BASE = SCRIPT ? SCRIPT.src.replace(/js\/x-aviso-suscripcion\.js.*$/, '') : '../../';

	// Copiar el link de pago (el trabajador se lo envia al dueño). El POS corre en http:// (sin
	// navigator.clipboard): se usa execCommand y, si tampoco se puede, se muestra el link para copiarlo a mano.
	function copiarTexto(texto) {
		var a = document.createElement('textarea');
		a.value = texto;
		a.setAttribute('readonly', '');
		a.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
		document.body.appendChild(a);
		a.select();
		var ok = false;
		try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
		a.remove();
		return ok;
	}
	function botonCopiar(link) {
		var b = el('button', 'xsus-copiar', 'Copiar link de pago');
		b.type = 'button';
		b.onclick = function () {
			var listo = function () {
				b.textContent = '¡Link copiado! Envíaselo al dueño';
				setTimeout(function () { b.textContent = 'Copiar link de pago'; }, 3000);
			};
			if (navigator.clipboard && window.isSecureContext) {
				navigator.clipboard.writeText(link).then(listo, function () { if (copiarTexto(link)) { listo(); } else { window.prompt('Copia este link:', link); } });
			} else if (copiarTexto(link)) { listo(); }
			else { window.prompt('Copia este link:', link); }
		};
		return b;
	}

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
			// Con la fecha de suspension ya pasada (la tarea diaria aun no corrio) no se muestra una fecha vieja.
			sub: d.fechaBloqueo && d.fechaBloqueo >= hoy() ? 'Se suspende el ' + fecha(d.fechaBloqueo)
				: (d.fechaBloqueo ? 'Puede suspenderse en cualquier momento · ' : '') + 'Llevas ' + dias(atraso) + ' de atraso',
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
		cuerpo.appendChild(botonCopiar(link));
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

	// Pantalla "servicio suspendido" del login. Solo informa: el bloqueo lo hace el servidor (sin sesion del
	// POS no hay nada que abrir), asi que quitarla desde la consola del navegador no da acceso a nada.
	var CANDADO = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
	function mostrarSuspendido(d, link) {
		if (document.getElementById('xsus_suspendido')) { return; }
		var fondo = el('div', 'xsus-fondo');
		fondo.id = 'xsus_suspendido';
		var card = el('div', 'xsus-card xsus-rojo xsus-centro');
		card.setAttribute('role', 'alertdialog');
		card.setAttribute('aria-modal', 'true');
		card.setAttribute('aria-label', 'Servicio suspendido');

		var cab = el('div', 'xsus-cab');
		var ic = el('div', 'xsus-icon');
		ic.innerHTML = CANDADO; // constante de este archivo
		var tit = el('div', 'xsus-tit');
		tit.appendChild(el('b', '', 'Servicio suspendido'));
		tit.appendChild(el('span', '', 'Por falta de pago' + (d.pagadoHasta ? ' · venció el ' + fecha(d.pagadoHasta) : '')));
		cab.appendChild(ic);
		cab.appendChild(tit);

		var cuerpo = el('div', 'xsus-cuerpo');
		cuerpo.appendChild(el('p', 'xsus-texto', 'Tu sistema está bloqueado y nadie de tu negocio puede ingresar. Paga ahora y apenas se registre tu pago vuelves a trabajar con normalidad.'));
		if (Number(d.reconexion) > 0) {
			cuerpo.appendChild(el('div', 'xsus-reconexion', 'Al pagar se suma ' + soles(d.reconexion) + ' por la reconexión del servicio.'));
		}
		var pagar = el('a', 'xsus-pagar', 'Pagar ahora');
		pagar.href = link;
		pagar.target = '_blank';
		pagar.rel = 'noopener';
		cuerpo.appendChild(pagar);
		cuerpo.appendChild(el('div', 'xsus-medios', 'QR (Plin y bancos) · Yape · Tarjeta'));
		cuerpo.appendChild(botonCopiar(link));
		cuerpo.appendChild(el('div', 'xsus-nota', 'Copia el link y envíalo por WhatsApp a quien hace los pagos.'));
		// "Volver" se habilita a los 10 s: que primero se lea el mensaje.
		var volver = el('button', 'xsus-despues', '');
		volver.type = 'button';
		volver.disabled = true;
		var espera = 10;
		var contar = function () {
			if (espera <= 0) {
				volver.disabled = false;
				volver.textContent = 'Volver al inicio de sesión';
				return;
			}
			volver.textContent = 'Volver al inicio de sesión (' + espera + ')';
			espera--;
			setTimeout(contar, 1000);
		};
		contar();
		volver.onclick = function () { fondo.remove(); };
		cuerpo.appendChild(volver);

		card.appendChild(cab);
		card.appendChild(cuerpo);
		fondo.appendChild(card);
		document.body.appendChild(fondo);
		pagar.focus();

		// Mientras esta abierta se consulta cada 10 s: apenas se registra el pago (la consola desbloquea la sede), sale el agradecimiento.
		var vigilar = setInterval(function () {
			if (!document.body.contains(fondo)) { clearInterval(vigilar); return; }
			consultarSuspendido().then(function (n) {
				if (n === ESPERA) { return; } // freno del servidor o corte de red: se reintenta en 10 s
				if (!n) { clearInterval(vigilar); return; } // pasaron los 30 min: queda la pantalla como esta
				if (n.bloqueado === false) { clearInterval(vigilar); pagoRecibido(fondo, n); }
			});
		}, 10000);
	}

	// Serpentinas de colores cayendo (solo CSS; con "reducir movimiento" no se muestran).
	var COLORES = ['#f03e3e', '#fab005', '#40c057', '#228be6', '#be4bdb', '#fd7e14'];
	function serpentinas(dentro) {
		var capa = el('div', 'xsus-confeti');
		capa.setAttribute('aria-hidden', 'true');
		for (var i = 0; i < 90; i++) {
			var p = el('span', i % 3 === 0 ? 'xsus-tira' : '');
			p.style.left = (Math.random() * 100) + '%';
			p.style.background = COLORES[i % COLORES.length];
			p.style.animationDelay = (Math.random() * 1.2) + 's';
			p.style.animationDuration = (2.6 + Math.random() * 2) + 's';
			p.style.setProperty('--giro', (Math.random() * 720 - 360) + 'deg');
			capa.appendChild(p);
		}
		dentro.appendChild(capa);
	}

	function entrar() {
		var f = document.getElementById('xsus_suspendido');
		if (f) { f.remove(); }
		var ingresar = document.getElementById('bta'); // boton INGRESAR del login (usuario y clave siguen escritos)
		if (ingresar) { ingresar.click(); }
	}
	function pagoRecibido(fondo, d) {
		while (fondo.firstChild) { fondo.removeChild(fondo.firstChild); }
		serpentinas(fondo);
		var card = el('div', 'xsus-card xsus-verde xsus-centro xsus-gracias');
		card.setAttribute('role', 'alertdialog');
		card.setAttribute('aria-label', 'Gracias por tu pago');
		card.appendChild(el('div', 'xsus-gracias-icono', '✓'));
		card.appendChild(el('h2', 'xsus-gracias-tit', '¡Gracias por tu pago!'));
		card.appendChild(el('p', 'xsus-gracias-texto', 'Tu servicio ya está activo. Todo tu equipo puede volver a trabajar.'));
		if (d.pagadoHasta) {
			var vence = el('div', 'xsus-gracias-vence');
			vence.appendChild(el('span', '', 'Tu próximo vencimiento'));
			vence.appendChild(el('b', '', fecha(d.pagadoHasta)));
			card.appendChild(vence);
		}
		var boton = el('button', 'xsus-pagar', 'Ingresar al sistema');
		boton.type = 'button';
		boton.onclick = entrar;
		card.appendChild(boton);
		fondo.appendChild(card);
		boton.focus(); // se entra solo con clic: que lean el mensaje y la fecha
	}

	var ESPERA = 'espera';
	// Datos de la pantalla; null = sin permiso (no paso el login o pasaron 30 min); ESPERA = reintentar luego.
	function consultarSuspendido() {
		return fetch(BASE + 'bdphp/log_suscripcion.php?op=suspendido', { credentials: 'same-origin' })
			.then(function (r) {
				if (r.status === 429) { return ESPERA; }
				return r.json().then(function (j) {
					var d = j && j.success ? j.datos : null;
					return d && d.activa && linkSeguro(d.link) ? d : null;
				});
			})
			.catch(function () { return ESPERA; });
	}
	window.xSuspendido = function () {
		consultarSuspendido().then(function (d) {
			// Sin datos queda el mensaje del login ("Comunícate con Papaya").
			if (d && d !== ESPERA && d.bloqueado !== false) { mostrarSuspendido(d, linkSeguro(d.link)); }
		});
	};

	function iniciar() {
		fetch(BASE + 'bdphp/log_suscripcion.php?op=estado', { credentials: 'same-origin' })
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

	// En el login (data-solo-suspendido) solo se usa xSuspendido(); no hay sesion para el aviso normal.
	if (SCRIPT && SCRIPT.hasAttribute('data-solo-suspendido')) { return; }
	// Un poco despues de cargar, para no competir con la carga inicial del POS.
	if (document.readyState === 'complete') { setTimeout(iniciar, 1500); }
	else { window.addEventListener('load', function () { setTimeout(iniciar, 1500); }); }
})();
