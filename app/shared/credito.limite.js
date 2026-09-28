// Aviso de limite de credito al vender (plan/CUENTAS-PAGAR-COBRAR-PLAN.md).
// Lo usan x-pago.html y x-pago2.html justo antes de registrar el pago.
// NUNCA bloquea la venta: si el cliente pasa su limite pregunta "¿Vender igual?";
// si no hay limite, no hay credito en el pago o el servidor no responde, sigue sin preguntar.

// listaPagos: items de x-comp-table-forma-pago ({ id: idtipo_pago, importe })
function xCreditoImporte(listaPagos) {
	var CREDITO = 3;
	return (listaPagos || []).reduce(function (s, p) {
		return s + (parseInt(p && p.id) === CREDITO ? (parseFloat(p.importe) || 0) : 0);
	}, 0);
}

// Llama a listo(true) si se sigue con la venta, o listo(false) si el usuario prefiere cambiar la forma de pago.
function xCreditoLimiteVerificar(idcliente, listaPagos, listo) {
	var credito = xCreditoImporte(listaPagos);
	var id = parseInt(idcliente) || 0;
	var hecho = false;
	var fin = function (ok) { if (!hecho) { hecho = true; listo(ok); } };
	var seguir = function () { fin(true); };
	if (!(credito > 0) || !id) { seguir(); return; }
	$.ajax({ type: 'POST', url: '../../bdphp/log_cuentas.php?op=limite-check', data: JSON.stringify({ idcliente: id }),
		contentType: 'application/json', dataType: 'json', timeout: 4000 })
	.done(function (r) {
		if (!r || !r.success || !r.datos || r.datos.limite === null || r.datos.limite === undefined) { seguir(); return; }
		var lim = parseFloat(r.datos.limite) || 0, debe = parseFloat(r.datos.debe) || 0, nueva = debe + credito;
		if (nueva <= lim + 0.009) { seguir(); return; }
		var s = function (n) { return 'S/ ' + (parseFloat(n) || 0).toFixed(2); };
		showAlertSwalHtmlDecision({
			title: 'Este cliente pasa su límite de crédito',
			html: 'Límite: <b>' + s(lim) + '</b><br>Ya debe: <b>' + s(debe) + '</b><br>Con esta venta a crédito (' + s(credito) + ') debería: <b>' + s(nueva) + '</b>' +
				'<br><br>¿Vender a crédito igual?',
			icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, vender igual', cancelButtonText: 'No, cambiar forma de pago'
		}, 1).then(function (res) { fin(!!(res && res.isConfirmed)); });
	})
	.fail(function () { seguir(); }); // sin respuesta: no se frena la venta
}
