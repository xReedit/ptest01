// "🧾 Solo comprobante" de un delivery desde el panel Llevar · Delivery de la maqueta: emite la boleta o factura SIN
// registrar el pago. Es el mismo flujo que "Facturar" de Control de Delivery (x-control-delivery.html:
// xCDOpenEmitirComprobante + xCDGoEmitirComprobante), con las mismas funciones globales del POS y los mismos
// endpoints:
//   x-pago en modo solo comprobante → log_001.php {p_from:'fe'} (correlativo) → xCocinarImprimirComprobante(…, 0, -2)
//   → log_002.php op 12 (guarda num_comprobante en el json del pedido).
// Por que no se llama a xCDOpenEmitirComprobante tal cual: lee el pedido de la fila <tr> de la tabla de Control de
// Delivery (xThisCDelivery.listDeliveryPedido, que solo se llena al abrir la pestaña Delivery) y su dialogo vive
// dentro de esa vista, que en Pedidos | Local esta oculta (display:none): no se veria y, sin la fila en esa lista,
// xCDGoEmitirComprobante falla DESPUES de imprimir, sin guardar el numero. Aqui el pedido viene del panel (op=7) y
// el dialogo se arma dentro de la pantalla completa.
// Como en Control de Delivery, solo puede haber un x-pago a la vez (usa globales): mientras el dialogo esta abierto
// se vacia #div_pago (el del cobro de Control de pedidos) y al cerrarlo se pone otro igual al de la pagina.

const URL_CORRELATIVO = '../../bdphp/log_001.php';
const URL_GUARDAR = '../../bdphp/log_002.php';
const ESPERA_PAGO_MS = 5000, PASO_MS = 100, RESTAURAR_MS = 500, ESPERA_INICIAL_MS = 500;
const GLOBALES = ['xm_all_SetResponseLog_001', 'xCeroIzqNumComprobante', 'xCocinarImprimirComprobante', 'xEstructuraItemsJsonPedidoDelivery'];

const copia = o => JSON.parse(JSON.stringify(o));
const moneda = (g, n) => (typeof g.xMoneda === 'function' ? g.xMoneda(n) : (Number(n) || 0).toFixed(2));

function alerta(g, icono, titulo, texto) {
	if (typeof g.showAlertSwalOk === 'function') { g.showAlertSwalOk(icono, titulo, texto); } else { g.console.warn(`maqueta: ${titulo} ${texto}`); }
}
function cargando(g, si) {
	try {
		const p = g.xPopupLoad;
		if (p && typeof p.xopen === 'function') { if (si) { p.xopen(); } else { p.xclose(); } }
	} catch (e) { /* solo el aviso de carga */ }
}

/** El x-pago ya mejorado por Polymer (como el setTimeout de 500 ms de xCDOpenEmitirComprobante, pero sin adivinar). */
function esperarPago(g, pago, dlg) {
	return new Promise((listo, falla) => {
		const desde = Date.now();
		const mirar = () => {
			if (typeof pago.setModoSoloComprobante === 'function' && typeof dlg.open === 'function') { listo(); return; }
			if (Date.now() - desde > ESPERA_PAGO_MS) { falla(new Error('x-pago no cargo')); return; }
			g.setTimeout(mirar, PASO_MS);
		};
		mirar();
	});
}

/**
 * Abre el dialogo de comprobante del pedido. Resuelve con el numero de comprobante emitido (B001-123) o null si se
 * cerro sin emitir. Nunca rechaza: los errores van en un SweetAlert del POS.
 * @param {{doc: Document, global: Window, contenedor: Element|null, pedido: {id: string, n: string, imp: number,
 *   tel: string, json: {p_body: object, p_subtotales: object[]}}}} o
 */
export function emitirSoloComprobante({ doc, global: g, contenedor, pedido }) {
	return new Promise(resolver => {
		const $ = g.jQuery;
		if (!$ || typeof $.ajax !== 'function' || GLOBALES.some(f => typeof g[f] !== 'function') || !pedido || !pedido.json) {
			alerta(g, 'warning', 'No se puede emitir aquí', 'Emite el comprobante desde Control de Delivery, botón "Facturar".');
			resolver(null);
			return;
		}
		let rpts = null, emitido = null, emitiendo = false, cerrado = false;
		const divPago = doc.getElementById('div_pago');
		if (divPago) { $(divPago).empty(); }   // un solo x-pago en la pagina (como xCDOpenEmitirComprobante)

		const dlg = doc.createElement('paper-dialog');
		dlg.id = 'maq_dialog_comprobante';
		dlg.className = 'dialog_redondo';
		// el fondo oscuro de paper-dialog (iron-overlay-backdrop) vive en el body y en pantalla completa no se ve: la
		// sombra gigante oscurece la maqueta y el panel como en Control de Delivery
		// display:none hasta dlg.open(): mientras x-pago carga, el paper-dialog aun cerrado se pintaba debajo de la maqueta
		dlg.setAttribute('style', 'display:none; min-width:320px; box-shadow:0 0 0 100vmax rgba(0,0,0,.6);');
		for (const [k, v] of [['entry-animation', 'scale-up-animation'], ['exit-animation', 'fade-out-animation'], ['with-backdrop', '']]) { dlg.setAttribute(k, v); }
		const caja = doc.createElement('div');
		caja.className = 'xContent';
		caja.setAttribute('style', 'padding: 0px 20px 0px 5px;');
		const pago = doc.createElement('x-pago');
		pago.id = 'maq_pago_comprobante';
		caja.appendChild(pago);
		dlg.appendChild(caja);
		const fs = doc.fullscreenElement;
		(contenedor && fs && fs === contenedor ? contenedor : doc.body).appendChild(dlg);
		g.xbuscar_mesa = true;

		const cerrar = () => { try { if (typeof dlg.close === 'function') { dlg.close(); } else { alCerrar({ target: dlg }); } } catch (e) { alCerrar({ target: dlg }); } };
		function alCerrar(e) {
			if (cerrado || (e && e.target && e.target !== dlg)) { return; }   // los desplegables de x-pago tambien emiten iron-overlay-closed
			cerrado = true;
			g.xbuscar_mesa = false;
			dlg.remove();
			g.setTimeout(() => {   // como xCDRestaurarXPagoCP: el x-pago del cobro vuelve, igual al de la pagina
				const div = doc.getElementById('div_pago');
				if (div && !div.querySelector('x-pago')) {
					const nuevo = doc.createElement('x-pago');
					nuevo.id = 'component_pago';
					nuevo.setAttribute('permitehotel', '');
					div.appendChild(nuevo);
				}
			}, RESTAURAR_MS);
			resolver(emitido);
		}
		dlg.addEventListener('iron-overlay-closed', alCerrar);

		function emitir() {
			if (emitiendo || emitido) { return; }
			const r = Array.isArray(rpts) && rpts[0] ? rpts[0] : null;
			// NINGUNO (idtipo_comprobante 0) no genera correlativo: sin esto se guardaba "N0-0" como numero del pedido
			if (!r || !r.comprobante || String(r.comprobante.idtipo_comprobante) === '0') { alerta(g, 'warning', 'Falta el comprobante', 'Elige boleta o factura y completa los datos del cliente.'); return; }
			emitiendo = true;
			const arrCliente = r.cliente, arrComprobante = r.comprobante;
			const items = g.xEstructuraItemsJsonPedidoDelivery(copia(pedido.json.p_body));
			const subtotales = copia(pedido.json.p_subtotales);
			cargando(g, true);
			// f = genera el correlativo (igual que xCDGoEmitirComprobante)
			$.ajax({ type: 'POST', url: URL_CORRELATIVO, data: { p_from: 'fe', p_comprobante: arrComprobante, idregistro_pago: '0' } })
				.done(respuesta => {
					try {
						const rpt = g.xm_all_SetResponseLog_001(respuesta);
						if (!rpt || rpt.correlativo_comprobante == null || rpt.correlativo_comprobante === '') { throw new Error('sin correlativo'); }
						arrComprobante.correlativo = g.xCeroIzqNumComprobante(rpt.correlativo_comprobante);
						Promise.resolve(g.xCocinarImprimirComprobante(items, subtotales, arrComprobante, arrCliente, 0, -2))
							.then(null, e => g.console.warn('maqueta: imprimir comprobante', e));
						const des = String(arrComprobante.descripcion || '');
						emitido = `${des.substr(0, 1).toUpperCase()}${arrComprobante.serie}-${rpt.correlativo_comprobante}`;
						// guarda el numero en el json del pedido
						$.ajax({ type: 'POST', url: URL_GUARDAR, data: { op: '12', id: pedido.id, num_comprobante: emitido } })
							.fail(e => g.console.warn('maqueta: no se guardo el numero de comprobante', pedido.id, e));
						cargando(g, false);
						cerrar();
					} catch (e) {
						g.console.warn('maqueta: emitir comprobante', e);
						cargando(g, false);
						if (emitido) { cerrar(); return; }   // ya se mando a emitir: nunca otra vez desde este dialogo
						emitiendo = false;
						alerta(g, 'error', 'No se pudo emitir el comprobante', 'Inténtalo de nuevo o emítelo desde Control de Delivery.');
					}
				})
				.fail(e => {
					g.console.warn('maqueta: log_001 comprobante', e);
					emitiendo = false;
					cargando(g, false);
					alerta(g, 'error', 'No se pudo emitir el comprobante', 'Revisa la conexión e inténtalo de nuevo.');
				});
		}

		const noAbrio = e => {
			cargando(g, false);
			g.console.warn('maqueta: dialogo de comprobante', e);
			alerta(g, 'warning', 'No se pudo abrir el comprobante', 'Emite el comprobante desde Control de Delivery, botón "Facturar".');
			alCerrar({ target: dlg });   // vuelve el x-pago del cobro
		};
		// x-pago recien creado aun no tiene listos sus selectores (setVal lanza "requiere_cliente"): Control de Delivery
		// espera 500 ms; aqui se espera eso y se reintenta hasta ESPERA_PAGO_MS.
		const desde = Date.now();
		const preparar = () => {
			if (cerrado) { cargando(g, false); return; }
			try {
				pago.setVal(moneda(g, parseFloat(pedido.imp)));
			} catch (e) {
				if (Date.now() - desde > ESPERA_PAGO_MS) { noAbrio(e); } else { g.setTimeout(preparar, PASO_MS * 2); }
				return;
			}
			try {
				if (typeof pago.setTelefonoCliente === 'function') { pago.setTelefonoCliente(pedido.tel || ''); }
				pago.setModoSoloComprobante();
				// el boton azul y F10 de x-pago usan la global xThisPago (el ultimo x-pago conectado) y su modoSoloComprobante:
				// si otro x-pago de la pagina la tomo, "Listo" pasaba al metodo de pago. Antes de cada clic/tecla se fija este.
				const fijar = () => { if (!cerrado) { g.xThisPago = pago; if (!pago.modoSoloComprobante) { pago.setModoSoloComprobante(); } } };
				pago.addEventListener('click', fijar, true);
				// captura en document: corre antes que el F10 de x-pago ($(window).on('keydown'), en burbujeo)
				doc.addEventListener('keydown', fijar, true);
				dlg.addEventListener('iron-overlay-closed', e => { if (e.target === dlg) { doc.removeEventListener('keydown', fijar, true); } });
				pago.addEventListener('xSend', e => { rpts = e && e.detail ? e.detail.xRpts : null; });
				pago.addEventListener('xCancelarCerrar', cerrar);
				pago.addEventListener('xListoRegistraPago', emitir);
				const centrar = () => { if (typeof dlg.center === 'function') { dlg.center(); } };
				pago.addEventListener('xSelectTipoComprobante', centrar);
				pago.addEventListener('xFormClienteValid', centrar);
				cargando(g, false);
				dlg.style.display = '';
				dlg.open();
			} catch (e) {
				noAbrio(e);
			}
		};
		cargando(g, true);
		esperarPago(g, pago, dlg).then(() => g.setTimeout(preparar, ESPERA_INICIAL_MS), noAbrio);
	});
}
