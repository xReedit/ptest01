// Contador de la org en la pantalla de Usuarios (pestaña Contador). Backend: bdphp/log_contador_sede.php
// Solo declaraciones de funciones en nivel superior (la pagina puede cargarse dos veces). Estado en window.xCtr*.

function xCtrPost(op, body) {
	return $.ajax({ type: 'POST', url: '../../bdphp/log_contador_sede.php?op=' + op, contentType: 'application/json',
		data: JSON.stringify(body || {}), dataType: 'json' });
}

function xCtrEsc(t) {
	return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
		return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
	});
}

function xCtrAviso(texto, icono) {
	if (icono === 'success' && typeof showToastSwal === 'function') { showToastSwal('success', texto); return; }
	if (typeof showAlertSwalOk === 'function') { showAlertSwalOk(icono || 'warning', '', texto, 'Entendido', 1); }
}

function xCtrConfirmar(html, titulo, boton) {
	return showAlertSwalHtmlDecision({ title: titulo, html: html, icon: 'question', showCancelButton: true,
		confirmButtonText: boton, cancelButtonText: 'Cancelar' }, 1).then(function (r) { return !!(r && r.isConfirmed); });
}

function xCtrCargar() {
	xCtrCss();
	var $l = $('#xct_lista');
	if (!$l.length) { return; }
	$l.html('<p class="inv-empty">Cargando...</p>');
	xCtrRecargar().fail(function () { $l.html('<p class="inv-empty">No se pudo cargar. Revise su conexion.</p>'); });
}

function xCtrRecargar() {
	return xCtrPost('listar').then(function (r) {
		if (!r || !r.success) { $('#xct_lista').html('<p class="inv-empty">' + xCtrEsc(r && r.error || 'No se pudo cargar.') + '</p>'); return; }
		window.xCtrDatos = r.datos;
		xCtrPintar();
	});
}

function xCtrSede(idsede) {
	return (window.xCtrDatos.sedes || []).filter(function (s) { return s.idsede === idsede; })[0];
}

function xCtrContador(id) {
	return (window.xCtrDatos.contadores || []).filter(function (c) { return c.idus_cpc === id; })[0];
}

function xCtrLibres() {
	return (window.xCtrDatos.sedes || []).filter(function (s) { return !s.idus_cpc && s.emite; });
}

function xCtrPintar() {
	var d = window.xCtrDatos, html = '';
	(d.contadores || []).forEach(function (c) {
		var sedes = c.sedes.map(function (ids) {
			var s = xCtrSede(ids);
			return s ? '<li><b>' + xCtrEsc(s.nombre) + '</b> <span class="inv-muted">· comprobantes desde ' + xCtrEsc(s.mes_inicio) + '</span></li>' : '';
		}).join('');
		html += '<div class="xct-card">' +
			'<div class="xct-card-info">' +
				'<div class="xct-nombre"><i class="fa fa-user-circle-o"></i>' + xCtrEsc(c.nombre) + '</div>' +
				'<div class="xct-datos"><span class="xct-chip">Usuario: ' + xCtrEsc(c.usuario) + '</span>' +
					(c.telefono ? '<span class="inv-muted"><i class="fa fa-whatsapp"></i>' + xCtrEsc(c.telefono) + '</span>' : '') + '</div>' +
				'<div class="inv-label xct-tit-sedes">REVISA ESTAS SEDES</div><ul class="xct-sedes">' + sedes + '</ul>' +
				(c.propio ? '' : '<p class="xct-nota"><i class="fa fa-info-circle"></i>Este contador tambien lleva otros negocios, por eso aqui solo puedes ver sus datos y copiar su acceso.</p>') +
			'</div>' +
			'<div><button type="button" class="btn btn-sm btn-primary" onclick="xCtrAbrir(' + c.idus_cpc + ')"><i class="fa fa-pencil"></i>Ver o editar</button></div>' +
			'</div>';
	});
	var libres = xCtrLibres();
	if (!d.contadores.length) {
		html += '<div class="inv-empty"><b><i class="fa fa-calculator"></i>Aun no tienes contador</b><br>' +
			(libres.length ? 'Toca <b>+ Agregar contador</b>, escribe su nombre y marca las sedes que llevara.'
				: 'Ninguna de tus sedes emite comprobantes electronicos todavia.') + '</div>';
	} else if (libres.length) {
		html += '<p class="xct-libres"><i class="fa fa-exclamation-circle"></i>Sedes sin contador: <b>' +
			libres.map(function (s) { return xCtrEsc(s.nombre); }).join(', ') + '</b>. Puedes agregarlas a un contador o crear uno nuevo.</p>';
	}
	$('#xct_lista').html(html);
	if ($('#xus_seg .inv-seg-item.activa').attr('data-tab') === 'contador') { $('#xus_btn_nuevo').toggle(libres.length > 0); }
}

// id=0 nuevo contador; si no, ver/editar uno existente. claveNueva: true justo despues de crear o restablecer.
function xCtrAbrir(id, claveNueva) {
	var c = id ? xCtrContador(id) : null;
	var edita = !c || c.propio;
	window.xCtrEditando = id || 0;
	window.xCtrClaveNueva = !!claveNueva;
	$('#xct_titulo').text(c ? c.nombre : 'Nuevo contador');
	$('#xct_bajada').text(c ? 'Usuario ' + c.usuario + (edita ? ' · cambia sus datos, sus sedes o restablece su clave' : ' · solo lectura')
		: 'Crea el usuario de tu contador para que revise y descargue tus comprobantes electronicos.');
	$('#xct_nombre').val(c ? c.nombre : '').prop('disabled', !edita);
	$('#xct_telefono').val(c ? c.telefono : '').prop('disabled', !edita);
	$('#xct_sedes').html(xCtrSedesHtml(c, id, edita));
	$('#xct_acceso').toggle(!!c);
	$('#xct_creado').toggle(!!claveNueva);
	if (c) { xCtrPintarAcceso(c); }
	$('#xct_btn_reset').toggle(!!c && c.propio);
	$('#xct_guardar').toggle(edita).text(c ? 'Guardar cambios' : 'Crear contador');
	$('#xct_cancelar').text(claveNueva ? 'Listo' : (edita ? 'Cancelar' : 'Cerrar'));
	if (!dialog_contador.opened) { dialog_contador.open(); }
}

function xCtrSedesHtml(c, id, edita) {
	return (window.xCtrDatos.sedes || []).map(function (s) {
		var otro = s.idus_cpc && s.idus_cpc !== id ? xCtrContador(s.idus_cpc) : null;
		var motivo = !s.emite ? 'No emite comprobantes electronicos' : (otro ? 'Ya la revisa ' + otro.nombre + ' (' + otro.usuario + ')' : '');
		var marcada = c ? c.sedes.indexOf(s.idsede) >= 0 : !motivo;
		var off = motivo || !edita;
		return '<label class="xct-sede' + (motivo ? ' xct-off' : '') + '">' +
			'<input type="checkbox" class="xct-chk" value="' + s.idsede + '"' + (marcada ? ' checked' : '') + (off ? ' disabled' : '') + '>' +
			'<span><b>' + xCtrEsc(s.nombre) + '</b> <span class="inv-muted">' + xCtrEsc(s.ciudad) + '</span>' +
			'<span class="inv-sub">' + xCtrEsc(motivo || 'Vera los comprobantes desde ' + s.mes_inicio + ' (fecha de inicio de la sede)') + '</span></span></label>';
	}).join('');
}

function xCtrPintarAcceso(c) {
	var nueva = window.xCtrClaveNueva;
	$('#xct_ac_link').text(location.origin);
	$('#xct_ac_usuario').text(c.usuario);
	$('#xct_ac_clave').html(nueva ? '<b>123456</b> <span class="inv-sub">Al entrar por primera vez el sistema le pedira crear su propia clave.</span>'
		: '<span class="inv-muted">La que creo en su primer ingreso (la inicial es 123456).</span>' +
		  (c.propio ? '<span class="inv-sub">Si la olvido, toca <b>Restablecer clave</b>.</span>' : ''));
	var tel = String(c.telefono || '').replace(/\D/g, '');
	if (tel.length === 9) { tel = '51' + tel; }
	$('#xct_wsp').toggle(tel.length >= 11).attr('href', 'https://wa.me/' + tel + '?text=' + encodeURIComponent(xCtrTexto(c)));
}

function xCtrGuardar() {
	var body = {
		idus_cpc: window.xCtrEditando || 0,
		nombre: $.trim($('#xct_nombre').val()),
		telefono: $.trim($('#xct_telefono').val()),
		sedes: $('#xct_sedes .xct-chk:checked:not(:disabled)').map(function () { return Number(this.value); }).get()
	};
	if (!body.nombre) { xCtrAviso('Escribe el nombre de tu contador o de su estudio contable.'); return; }
	if (!body.sedes.length) { xCtrAviso('Marca al menos una sede para que tu contador pueda revisarla.'); return; }
	var $b = $('#xct_guardar').prop('disabled', true);
	xCtrPost('guardar', body).then(function (r) {
		if (!r || !r.success) { xCtrAviso(r && r.error || 'No se pudo guardar.'); return; }
		return xCtrRecargar().then(function () {
			if (r.datos.pass) { xCtrAbrir(r.datos.idus_cpc, true); return; } // recien creado: mostrar su acceso
			dialog_contador.close();
			xCtrAviso('Cambios guardados', 'success');
		});
	}, function () {
		xCtrAviso('No se pudo guardar. Revise su conexion.');
	}).always(function () { $b.prop('disabled', false); });
}

function xCtrResetear() {
	var c = xCtrContador(window.xCtrEditando);
	if (!c) { return; }
	dialog_contador.close(); // el aviso de SweetAlert queda detras del paper-dialog si este sigue abierto
	xCtrConfirmar('Su clave volvera a ser <b>123456</b> y la que usa ahora dejara de servir. Al entrar, el sistema le pedira crear una nueva.',
		'Restablecer la clave de ' + xCtrEsc(c.usuario) + '?', 'Si, restablecer').then(function (ok) {
		if (!ok) { xCtrAbrir(c.idus_cpc); return; }
		xCtrPost('resetear', { idus_cpc: c.idus_cpc }).then(function (r) {
			if (!r || !r.success) { xCtrAviso(r && r.error || 'No se pudo restablecer la clave.'); return; }
			xCtrAbrir(c.idus_cpc, true);
		}, function () {
			xCtrAviso('No se pudo restablecer la clave. Revise su conexion.');
		});
	});
}

function xCtrTexto(c) {
	var sedes = c.sedes.map(function (ids) {
		var s = xCtrSede(ids);
		return s ? '- ' + s.nombre + ' (desde ' + s.mes_inicio + ')' : '';
	}).filter(Boolean).join('\n');
	var clave = window.xCtrClaveNueva
		? 'Clave: 123456\n\nLa primera vez que ingreses, el sistema te pedira crear tu propia clave.'
		: 'Clave: la que creaste en tu primer ingreso. Si no la recuerdas, avisame para restablecerla.';
	return 'Hola ' + c.nombre + ', te comparto tu acceso al sistema para revisar y descargar nuestros comprobantes electronicos:\n' +
		sedes + '\n\n' +
		'Link: ' + location.origin + '\n' +
		'Usuario: ' + c.usuario + '\n' + clave;
}

function xCtrCopiarCred() {
	var c = xCtrContador(window.xCtrEditando);
	if (c) { xCtrCopiar(xCtrTexto(c)); }
}

// navigator.clipboard solo existe en https; en http se usa el textarea
function xCtrCopiar(texto) {
	var ok = function () { xCtrAviso('Copiado. Pegalo en WhatsApp para enviarselo a tu contador.', 'success'); };
	if (navigator.clipboard && window.isSecureContext) {
		navigator.clipboard.writeText(texto).then(ok, function () { if (xCtrCopiarViejo(texto)) { ok(); } });
		return;
	}
	if (xCtrCopiarViejo(texto)) { ok(); } else { xCtrAviso('No se pudo copiar; selecciona el texto y copialo a mano.'); }
}

function xCtrCopiarViejo(texto) {
	var t = document.createElement('textarea');
	t.value = texto;
	t.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
	// dentro del dialogo: paper-dialog atrapa el foco y un textarea fuera de el no se puede seleccionar
	(document.getElementById('dialog_contador') || document.body).appendChild(t);
	t.select();
	var ok = false;
	try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
	t.parentNode.removeChild(t);
	return ok;
}

function xCtrCss() {
	if (document.getElementById('xct_css')) { return; }
	var st = document.createElement('style');
	st.id = 'xct_css';
	st.textContent =
		'.xct-intro{display:flex;gap:12px;align-items:flex-start;background:#f5f8ff;border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:12px;color:#344054}' +
		'.xct-intro .fa{font-size:20px;color:#4a6fd1;margin-top:2px}' +
		'.xct-intro p{margin:0}.xct-intro p+p{margin-top:4px;color:#6c757d}' +
		'.xct-card{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;border:1px solid #e5e7eb;border-radius:10px;padding:14px 16px;margin-bottom:12px;background:#fff}' +
		'.xct-card-info{flex:1 1 320px;min-width:0}' +
		'.xct-nombre{font-size:14px;font-weight:600;color:#212529}.xct-nombre .fa{color:#6c757d;margin-right:8px}' +
		'.xct-datos{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin:6px 0 10px;font-size:12px}.xct-datos .fa{margin-right:4px}' +
		'.xct-chip{background:#edf2ff;color:#1f4fa8;border-radius:10px;padding:2px 10px;font-weight:600;font-size:11px}' +
		'.xct-tit-sedes{text-transform:uppercase;letter-spacing:.4px}' +
		'.xct-sedes{margin:4px 0 0;padding-left:18px;font-size:12px}.xct-sedes li{margin:2px 0}' +
		'.xct-nota{margin:10px 0 0;font-size:11px;color:#7a5b00;background:#fff8e6;border-radius:6px;padding:6px 10px}.xct-nota .fa{margin-right:6px}' +
		'.xct-libres{font-size:12px;color:#7a5b00;margin:4px 0 0}.xct-libres .fa{margin-right:6px}' +
		'.inv-empty b>.fa{margin-right:6px}.xct-card .btn>.fa{margin-right:6px}' +
		'#dialog_contador{width:520px;max-width:calc(100vw - 32px)}' +
		'#dialog_contador .inv-input{width:100%;margin-bottom:12px}' +
		'#dialog_contador .btn{height:31px;padding:0 12px;font-size:12px;font-weight:600;line-height:29px;border-radius:6px;white-space:nowrap}' +
		'#dialog_contador .btn>.fa{margin-right:6px}' +
		'.xct-sec{font-size:12px;font-weight:600;color:#212529;margin:0 0 8px}' +
		'.xct-creado{background:#eef9f3;color:#0f5132;border-radius:8px;padding:10px 12px;font-size:12px;margin-bottom:12px}.xct-creado .fa{margin-right:6px}' +
		'.xct-acceso{background:#f7f8fa;border-radius:8px;padding:12px 14px;margin-bottom:16px}' +
		'.xct-ac-fila{display:flex;gap:10px;font-size:12px;padding:4px 0}.xct-ac-fila>span:first-child{width:62px;flex:0 0 62px;color:#6c757d}' +
		'.xct-ac-btns{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}' +
		'#xct_wsp{background:#25d366;border-color:#25d366;color:#fff;text-decoration:none}' +
		'.xct-sedes-box{max-height:34vh;overflow:auto;border:1px solid #edf0f2;border-radius:8px;padding:2px 10px}' +
		'.xct-sede{display:flex;gap:10px;align-items:flex-start;padding:9px 0;border-bottom:1px solid #f2f2f2;cursor:pointer;margin:0;font-size:12px;font-weight:400}' +
		'.xct-sede:last-child{border-bottom:0}' +
		'.xct-sede input{margin-top:2px;width:16px;height:16px;flex:0 0 16px}' +
		'.xct-off{opacity:.55;cursor:default}';
	document.head.appendChild(st);
}
