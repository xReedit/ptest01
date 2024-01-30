// imprimir otros documentos --- -1 precuenta - -2 factura
// xArrayCuerpo debe tener estructura de mod impresion, (como sub pedido ::app3_sys_dta_pe)
// xArraySubTotales ya esta calculado los subtotales
// xArrayComprobante datos del comprobante : tipodoc , serie correlativo id's
// xArrayCliente datos del cliente nombre dni ruc direccion


var xImpresoraPrint, _numIntCorrelativoBD;
// idregistro_pago = para manda a guardar el id_externo_comprobante electronico en la tabla registro_pago
// showPrint = true; es false si lo mando desde facturador.
async function xCocinarImprimirComprobante(xArrayCuerpo, xArraySubTotales, xArrayComprobante, xArrayCliente, idregistro_pago, xidDoc, showPrint = true){
	let rptPrint = {}
	if ( !!xArrayComprobante ) {
		if (xArrayComprobante.idtipo_comprobante === "0") { rptPrint.imprime = false; return rptPrint;} // ninguno no imprime
	} else {
		rptPrint.imprime = false; return rptPrint;
	}
	
	// busca impresora donde imprimir
	if (showPrint) {
		if (!xgetComprobanteImpresora(xidDoc)) {
			rptPrint.imprime = false;			
			// return rptPrint;
		}
	}
	// si no viene datos return false

    if(xArrayCuerpo.length==0){
		rptPrint.imprime = false;
		rptPrint.ok = false;
		rptPrint.msj = 'Los datos del comprobante no son correctos.';
		return rptPrint;
	}

    // array encabezado org sede
	var xArrayEncabezado = xm_log_get('datos_org_sede');    
	
	// escribir el importe total en letras
	// siempre ultimo es es el total

	// cambio para sumar los costos negativos, si es que es delivery y el comercio paga
	xArraySubTotales = darFormatoSubTotalesParaFacturacion(xArraySubTotales, false);

	const index_total = xArraySubTotales.length-1;
	const total_pagar = parseFloat(xArraySubTotales[index_total].importe);
	xArraySubTotales[index_total].importe_letras = numeroALetras(total_pagar);

	//comprobante electronico // ponemos el pie de pagina para el comprobante
	if (showPrint) { xArrayComprobante.pie_pagina_comprobante = xImpresoraPrint[0].pie_pagina_comprobante; }	

	//310721
	// obtenemos el numero del comprobante / para que no demore en esperar repuesta
	// console.log('paso F');

	// si es diferente a ticket
	if ( xArrayComprobante.codsunat !== "0" ) {
		xm_all_xToastOpen("Conectando con Sunat...");
	}
	

	const _viene_facturador = typeof idregistro_pago === "object" ? true : false;

	// console.log('xArrayComprobante.correlativo A', xArrayComprobante.correlativo);

	// || xArrayComprobante.correlativo === '#' cuando viene del facturador
	_numIntCorrelativoBD = parseInt(xArrayComprobante.correlativo);
	const _isNotIntNumComprobante = isNaN(_numIntCorrelativoBD);
	if ( !xArrayComprobante.correlativo || xArrayComprobante.correlativo === '' || _viene_facturador || xArrayComprobante.correlativo === '#' || _isNotIntNumComprobante || _numIntCorrelativoBD == 0) {
		// estas lineas lo eliminaremos
		const numComprobante = await xGetCorrelativoComprobante(xArrayComprobante);
		xArrayComprobante.correlativo = numComprobante; 
		_numIntCorrelativoBD = numComprobante;
	}
	
	// console.log('xArrayComprobante.correlativo B', xArrayComprobante.correlativo);	
	
	// si es comprobante de consumo
	// 211223 comprobante por consumo   
	xArrayCuerpo = isComprobanteConsumo(xArrayComprobante, xArraySubTotales, xArrayCuerpo);

	// console.log('paso H');
	rptPrint = await xJsonSunatCocinarDatos(xArrayCuerpo, xArraySubTotales, xArrayComprobante, xArrayCliente, idregistro_pago);
	if (!rptPrint.ok) { // si el documento electronico no es valido		
		alert(rptPrint.msj_error + ". Mande a imprimir el comprobante desde Registro de pagos");
		xPopupLoad.close;
		return rptPrint;
	}

	// console.log(rptPrint);
	xArrayEncabezado[0].hash = rptPrint.hash; // que es realidad el qr
	xArrayEncabezado[0].external_id = rptPrint.external_id;
	// correlativo comprobante;	
	xArrayComprobante.correlativo = rptPrint.correlativo_comprobante || xArrayComprobante.correlativo;
	xArrayComprobante.facturacion_correlativo_api = rptPrint.facturacion_correlativo_api || xArrayComprobante.facturacion_correlativo_api;
	
	
	// return true; // temporal probamos facturacion electronica
	//
	if (!showPrint) {
		return xArrayEncabezado;
	}

	// si se chequea imprimir comprobante esta activado
	let _isPrinterCpeVal = parseInt(localStorage.getItem('::app3_sys_print_cpe'));
	_isPrinterCpeVal = isNaN(_isPrinterCpeVal) ? 1 : _isPrinterCpeVal;

	if ( _isPrinterCpeVal === 0 ) {
		return xArrayEncabezado;
	}
	

    xImprimirComprobanteAhora(xArrayEncabezado,xArrayCuerpo,xArraySubTotales,xArrayComprobante,xArrayCliente,function(rpt_print){
		if(rpt_print==false){return false;}
		// xPopupLoad.titulo="Imprimiendo...";
		// xPopupLoad.xopen();
        // setTimeout(function(){ xPopupLoad.xclose()}, 3000);
        return true;
	});
}

// aca
function xImprimirComprobanteAhora(xArrayEncabezado,xArrayCuerpo,xArraySubtotal,xArrayComprobante,xArrayCliente,callback){
	// xPopupLoad.titulo="Imprimiendo...";	

	// console.log('paso REGISTRAR PRINT_COMPROBANTE');
	// formato de impresion items comprobante donde no se tiene en cuenta el tipo de consumo solo seccion e items
	let _arrBodyComprobante = xEstructuraItemsJsonComprobante(xArrayCuerpo, xArraySubtotal, true); // cpe = true subtotal + adicional
	_arrBodyComprobante = xEstructuraItemsAgruparPrintJsonComprobante(_arrBodyComprobante);


	const _sys_local = parseInt(xm_log_get('datos_org_sede')[0].sys_local);
	xArrayEncabezado[0].nom_us = xm_log_get('app3_us').nomus;


	comprobarNumCorrelativoComprobante(xArrayComprobante);

	// console.log('xarr_tipo_pago ====> ', xarr_tipo_pago);
	var xArrayTPC;
	try {		
		if ( xarr_tipo_pago ) {
			xArrayTPC = [];
			xarr_tipo_pago.map(tp => {
				let _vuleto = parseFloat(tp.importe_recibido) - parseFloat(tp.importe)
				const _importe_recibido = _vuleto < 0 ? tp.importe : tp.importe_recibido;
				_vuleto = _vuleto < 0 ? 0 : _vuleto;
				const _rowTPC = {
					'id': tp.id || '1',
					'des_tp': tp.des_tp || 'Efectivo',
					'importe': tp.importe,
					'importe_recibido': _importe_recibido,
					'importe_vuelto': _vuleto,
				}
				xArrayTPC.push(_rowTPC);
			});
		}
	} catch (error) {
			
	}

	const _data = {
		Array_enca: xArrayEncabezado,
		Array_print: xImpresoraPrint,
		ArrayItem: _arrBodyComprobante, // xArrayCuerpo 
		ArraySubTotales: xArraySubtotal,
		ArrayComprobante: xArrayComprobante,
		ArrayCliente: xArrayCliente,
		ArrayTipoPago: xArrayTPC // viene de xcontrol pedido // imprimir importe recibido
	}

	if (_sys_local === 1) {
		xPopupLoad.xopen();
		xSendDataPrintServer(_data, 2, 'comprobante');
		setTimeout(() => {
			xPopupLoad.xclose();
			callback(false);
		}, 1000);
		return;
	}


	$.ajax({type: 'POST', url: '../../print/print5.php', 
			data:{
				Array_enca: xArrayEncabezado, 
				Array_print: xImpresoraPrint, 
				ArrayItem: _arrBodyComprobante, // xArrayCuerpo 
				ArraySubTotales: xArraySubtotal,
				ArrayComprobante: xArrayComprobante,
				ArrayCliente: xArrayCliente				
			}
		})
	.done( function (dtPbd) {
		//xPopupLoad.xclose();
		if(dtPbd.indexOf('Error')!=-1){
			xPopupLoad.xclose();
			$("#print_error").text(dtPbd);
			xErrorPrint=true;
			dialog_erro_print.open();
		}else{
			//xPopupLoad.titulo='Exito!';
			xErrorPrint=false;
			xPopupLoad.titulo="Imprimiendo...";
			xPopupLoad.xopen();
			setTimeout(function(){ xPopupLoad.xclose()}, 3000);
		}
		return callback(xErrorPrint);
	});
}

/// imprimir comprobante con impresora preseleccionada | desde: facturador
function xImprimirComprobanteAhoraPrintPreSelect(xArrayEncabezado, xArrayCuerpo, xArraySubtotal, xArrayComprobante, xArrayCliente, xArrImpresora, callback) {
	xPopupLoad.titulo = "Imprimiendo...";

	const _sys_local = parseInt(xm_log_get('datos_org_sede')[0].sys_local);	
	xArrayEncabezado[0].nom_us = xm_log_get('app3_us').nomus;

	comprobarNumCorrelativoComprobante(xArrayComprobante);

	const _data = {
		Array_enca: xArrayEncabezado,
		Array_print: xArrImpresora,
		ArrayItem: xArrayCuerpo, // xArrayCuerpo 
		ArraySubTotales: xArraySubtotal,
		ArrayComprobante: xArrayComprobante,
		ArrayCliente: xArrayCliente
	}

	if (_sys_local === 1) {
		xPopupLoad.xopen();
		xSendDataPrintServer(_data, 2, 'comprobante');
		setTimeout(() => {
			xPopupLoad.xclose();
			callback(false);
		}, 1000);
		return;
	}

	// formato de impresion items comprobante donde no se tiene en cuenta el tipo de consumo solo seccion e items
	// let _arrBodyComprobante = xEstructuraItemsJsonComprobante(xArrayCuerpo, xArraySubtotal, true); // cpe = true subtotal + adicional
	// _arrBodyComprobante = xEstructuraItemsAgruparPrintJsonComprobante(_arrBodyComprobante);

	$.ajax({
		type: 'POST', url: '../../print/print5.php',
		data: {
			Array_enca: xArrayEncabezado,
			Array_print: xArrImpresora,
			ArrayItem: xArrayCuerpo, // xArrayCuerpo 
			ArraySubTotales: xArraySubtotal,
			ArrayComprobante: xArrayComprobante,
			ArrayCliente: xArrayCliente
		}
	})
		.done(function (dtPbd) {
			//xPopupLoad.xclose();
			if (dtPbd.indexOf('Error') != -1) {
				xPopupLoad.xclose();
				$("#print_error").text(dtPbd);
				xErrorPrint = true;
				dialog_erro_print.open();
			} else {
				//xPopupLoad.titulo='Exito!';
				xErrorPrint = false;
				xPopupLoad.titulo = "Imprimiendo...";
				xPopupLoad.xopen();
				setTimeout(function () { xPopupLoad.xclose() }, 3000);
			}
			return callback(xErrorPrint);
		});
}


// impresora donde se va a imprimir
// retorna boolean si encontro impresora donde imprimir
function xgetComprobanteImpresora(xidDoc) {
    var xArrayImpresoras=xm_log_get('app3_woIpPrint'); //JSON.parse(window.localStorage.getItem("::app3_woIpPrint"));
    var xDtTipoDoc=xm_log_get('app3_woIpPrintO');//JSON.parse(window.localStorage.getItem("::app3_woIpPrintO"));
    var xPrintLocal=window.localStorage.getItem("::app3_woIpPrintLo");
	xImpresoraPrint = xm_log_get("sede_generales");
	
	const num_copias_all = xImpresoraPrint[0].num_copias; // numero de copias para las demas impresoras -local


    var xIpPrintDoc=xidDoc;
	var xpasePrint=false;

	for (var i = 0; i < xDtTipoDoc.length; i++) {
		//pre-cuenta
		// if(xDtTipoDoc[i].idtipo_otro==-1){xIpPrintDoc=xDtTipoDoc[i].idimpresora; break;}
		if (xDtTipoDoc[i].idtipo_otro == xidDoc){xIpPrintDoc=xDtTipoDoc[i].idimpresora; break;}
	};
	//si existe impresora local // imprime todos los otros documentos en esta impresora local.
	if(xPrintLocal!=undefined && xPrintLocal!=''){
		xPrintLocal=$.parseJSON(xPrintLocal);
		xImpresoraPrint[0].ip_print=xPrintLocal.ip;
		xImpresoraPrint[0].var_margen_iz=xPrintLocal.var_margen_iz;
		xImpresoraPrint[0].var_size_font=xPrintLocal.var_size_font
		xImpresoraPrint[0].local = 1;
		xImpresoraPrint[0].num_copias = xPrintLocal.num_copias;
		xImpresoraPrint[0].copia_local = xPrintLocal.copia_local;
		xImpresoraPrint[0].img64 = xPrintLocal.img64;
		xImpresoraPrint[0].papel_size = xPrintLocal.papel_size;
		xpasePrint=true;
	}else{
		for (var i = 0; i < xArrayImpresoras.length; i++) {
			if(xArrayImpresoras[i].idimpresora==xIpPrintDoc){
				xpasePrint=true;
				xIpPrintDoc=xArrayImpresoras[i].ip; 
				xImpresoraPrint[0].ip_print=xIpPrintDoc;
				xImpresoraPrint[0].var_margen_iz=xArrayImpresoras[i].var_margen_iz;
				xImpresoraPrint[0].var_size_font=xArrayImpresoras[i].var_size_font;
				xImpresoraPrint[0].local = 0;
				xImpresoraPrint[0].num_copias = xArrayImpresoras[i].num_copias;
				xImpresoraPrint[0].copia_local = 0; // no imprime // solo para impresora local 
				xImpresoraPrint[0].img64 = xArrayImpresoras[i].img64; // ya no manda la img en base64 si no esta activo img64
				xImpresoraPrint[0].papel_size = xArrayImpresoras[i].papel_size;
				break;
			}
		}
    }

    // si existe impresora donde imprimir
    return xpasePrint; 
}

// devuelve una impresora segun idoc
function xgetImpresora(xidDoc) {
	var xArrayImpresoras = xm_log_get('app3_woIpPrint'); //JSON.parse(window.localStorage.getItem("::app3_woIpPrint"));
	var xDtTipoDoc = xm_log_get('app3_woIpPrintO');//JSON.parse(window.localStorage.getItem("::app3_woIpPrintO"));
	var xPrintLocal = window.localStorage.getItem("::app3_woIpPrintLo");
	xImpresoraPrint = xm_log_get("sede_generales");

	const num_copias_all = xImpresoraPrint[0].num_copias; // numero de copias para las demas impresoras -local
	const papel_size = xImpresoraPrint[0].papel_size; // numero de copias para las demas impresoras -local


	var xIpPrintDoc = xidDoc;
	var xpasePrint = false;

	for (var i = 0; i < xDtTipoDoc.length; i++) {
		//pre-cuenta
		// if (xDtTipoDoc[i].idtipo_otro == -1) { xIpPrintDoc = xDtTipoDoc[i].idimpresora; break; }
		if (xDtTipoDoc[i].idtipo_otro == xidDoc) { xIpPrintDoc = xDtTipoDoc[i].idimpresora; break; }
	};
	//si existe impresora local // imprime todos los otros documentos en esta impresora local.
	if (xPrintLocal != undefined && xPrintLocal != '') {
		xPrintLocal = $.parseJSON(xPrintLocal);
		xImpresoraPrint[0].ip_print = xPrintLocal.ip;
		xImpresoraPrint[0].var_margen_iz = xPrintLocal.var_margen_iz;
		xImpresoraPrint[0].var_size_font = xPrintLocal.var_size_font
		xImpresoraPrint[0].local = 1;
		xImpresoraPrint[0].num_copias = xPrintLocal.num_copias;
		xImpresoraPrint[0].copia_local = xPrintLocal.copia_local;
		xImpresoraPrint[0].img64 = xPrintLocal.img64;
		xImpresoraPrint[0].papel_size = xPrintLocal.papel_size;
		xpasePrint = true;
	} else {
		for (var i = 0; i < xArrayImpresoras.length; i++) {
			if (xArrayImpresoras[i].idimpresora == xIpPrintDoc) {
				xpasePrint = true;
				xIpPrintDoc = xArrayImpresoras[i].ip;
				xImpresoraPrint[0].ip_print = xIpPrintDoc;
				xImpresoraPrint[0].var_margen_iz = xArrayImpresoras[i].var_margen_iz;
				xImpresoraPrint[0].var_size_font = xArrayImpresoras[i].var_size_font;
				xImpresoraPrint[0].local = 0;
				xImpresoraPrint[0].num_copias = xArrayImpresoras[i].num_copias;;
				xImpresoraPrint[0].copia_local = 0; // no imprime // solo para impresora local 
				xImpresoraPrint[0].img64 = xArrayImpresoras[i].img64; // ya no manda la img en base64 si no esta activo img64
				xImpresoraPrint[0].papel_size = xArrayImpresoras[i].papel_size;
				break;
			}
		}
	}

	const print_return = xpasePrint ? xImpresoraPrint : null;
	return print_return;
}


// devuelve una impresora segun id
function xgetImpresoraById(xIdPrintSearch) {
	var xArrayImpresoras = xm_log_get('app3_woIpPrint'); //JSON.parse(window.localStorage.getItem("::app3_woIpPrint"));
	var xDtTipoDoc = xm_log_get('app3_woIpPrintO');//JSON.parse(window.localStorage.getItem("::app3_woIpPrintO"));
	var xPrintLocal = window.localStorage.getItem("::app3_woIpPrintLo");
	xImpresoraPrint = xm_log_get("sede_generales");

	const num_copias_all = xImpresoraPrint[0].num_copias; // numero de copias para las demas impresoras -local
	const papel_size = xImpresoraPrint[0].papel_size; // numero de copias para las demas impresoras -local
	const var_size_font_tall_comanda = xImpresoraPrint[0].var_size_font_tall_comanda;


	// var xIpPrintDoc = xIdPrintSearch;
	var xpasePrint = false;

	//si existe impresora local // imprime todos los otros documentos en esta impresora local.
	if (xPrintLocal != undefined && xPrintLocal != '') {
		xPrintLocal = $.parseJSON(xPrintLocal);
		xImpresoraPrint[0].ip_print = xPrintLocal.ip;
		xImpresoraPrint[0].var_margen_iz = xPrintLocal.var_margen_iz;
		xImpresoraPrint[0].var_size_font = xPrintLocal.var_size_font
		xImpresoraPrint[0].local = 1;
		xImpresoraPrint[0].num_copias = xPrintLocal.num_copias;
		xImpresoraPrint[0].copia_local = xPrintLocal.copia_local;
		xImpresoraPrint[0].img64 = xPrintLocal.img64;
		xImpresoraPrint[0].papel_size = xPrintLocal.papel_size;
		xpasePrint = true;
	} else {
		

		const _xArrayImpresoras = xArrayImpresoras.filter(pp => parseInt(pp.idimpresora) == xIdPrintSearch)[0];

		if (_xArrayImpresoras) { 
			xpasePrint = true; 
			xImpresoraPrint[0].ip_print=_xArrayImpresoras.ip;
			xImpresoraPrint[0].var_margen_iz=_xArrayImpresoras.var_margen_iz;
			xImpresoraPrint[0].var_size_font=_xArrayImpresoras.var_size_font;
			xImpresoraPrint[0].local = 0;
			xImpresoraPrint[0].num_copias = _xArrayImpresoras.num_copias;
			xImpresoraPrint[0].var_size_font_tall_comanda = var_size_font_tall_comanda;
			xImpresoraPrint[0].copia_local = 0; // no imprime // solo para impresora local 
			xImpresoraPrint[0].img64 = '';
			xImpresoraPrint[0].papel_size = _xArrayImpresoras.papel_size;		
		}
	}

	const print_return = xpasePrint ? xImpresoraPrint : null;
	return print_return;
}


////////////////////////////////////////////////////
///////  COMANDA   ///////////////
/// para imprimir comanda se requier xArrayPedidoObj como  xArrayCuerpo
// con este array se crea los nuevos pedidos

// function xCocinarImprimirComanda(xArrayEnca, xArrayCuerpo, xArraySubTotales, responde) {
// 	if (xArrayCuerpo.length ===0 ) return;

// 	xgetComprobanteImpresoraComanda(xArrayEnca, xArrayCuerpo, xArraySubTotales, (rpt)=>{
// 		responde(rpt);
// 	})
// }

function xCocinarImprimirComanda(xArrayEnca, xArrayCuerpo, xArraySubTotales, callback) {
	if (xArrayCuerpo.length ===0 ) return;

	var xArrayImpresoras=xm_log_get('app3_woIpPrint'); //JSON.parse(window.localStorage.getItem("::app3_woIpPrint"));
    var xDtTipoDoc=xm_log_get('app3_woIpPrintO');//JSON.parse(window.localStorage.getItem("::app3_woIpPrintO"));
	var xPrintLocal=window.localStorage.getItem("::app3_woIpPrintLo");
	var xImpresoraPrint=xm_log_get('sede_generales');
	var xcuentaSeccionesImpresas = 0;
	var xCuentaImpresorasEvaluadas = 0;
	const num_copias_all = xImpresoraPrint[0].num_copias; // numero de copias para las demas impresoras -local
	const var_size_font_tall_comanda = xImpresoraPrint[0].var_size_font_tall_comanda;
	const isPrintPedidoDeliveryCompleto = xImpresoraPrint[0].isprint_all_delivery.toString() === '1';

	// colocar en encabezado si va a imprimir subtotales
	xArrayEnca.is_print_subtotales = xImpresoraPrint[0].isprint_subtotales_comanda;
	// colocar en encabezado si va a imprimir la copia en formato corto
	xArrayEnca.isprint_copy_short = xImpresoraPrint[0].isprint_copy_short;	
	xArrayEnca.isprint_all_short = xImpresoraPrint[0].isprint_all_short;
	
	xArrayCuerpo = xArrayCuerpo.filter(x => x);
	//si existe impresora local // saca una copia de todo el pedido
	if(xPrintLocal!=undefined && xPrintLocal!=''){
		xPrintLocal=$.parseJSON(xPrintLocal);
		xArmarSubtotalesArray(xArrayCuerpo,xImpresoraPrint)
		xImpresoraPrint[0].ip_print=xPrintLocal.ip;
		xImpresoraPrint[0].var_margen_iz=xPrintLocal.var_margen_iz;
		xImpresoraPrint[0].var_size_font=xPrintLocal.var_size_font;
		xImpresoraPrint[0].local = 1;
		xImpresoraPrint[0].num_copias = xPrintLocal.num_copias;
		xImpresoraPrint[0].copia_local = xPrintLocal.copia_local;
		xImpresoraPrint[0].img64 = xPrintLocal.img64;
		xImpresoraPrint[0].papel_size = xPrintLocal.papel_size;
		if (xPrintLocal.img64 === "0") { xImpresoraPrint[0].logo64 = ''; } // ya no manda la img en base64 si no esta activo img64

		if (parseInt(xPrintLocal.num_copias) != 0 || parseInt(xPrintLocal.copia_local) != 0 ){ //
			xImprimirComandaAhora(xArrayEnca,xImpresoraPrint,xArrayCuerpo,xArraySubTotales,(res)=>{
				callback(res);
				// if(rpt_print==false){callback(rpt_print); return;}
				// xPopupLoad.titulo="Imprimiendo...";
				// xPopupLoad.xopen();
				// setTimeout(function(){ xPopupLoad.xclose()}, 3000);
			});
		}
	}

	// 041052022
	// si el tipo de consumo tiene un impresora especifica
	// ej: todo delivery se imprime en una impresora x
	let isTpcPrinter = false;
	let listTPCPrinter = xm_log_get('estructura_pedido');
	listTPCPrinter = listTPCPrinter.filter(p => p.idimpresora !== '0');
	isTpcPrinter = listTPCPrinter.length > 0;

	if ( isTpcPrinter ) {
		listTPCPrinter.map(p => {
			const _tpcPrint = p.idtipo_consumo;
			xIdPrint=p.idimpresora;
			xArrayBodyPrint=[];
			for (var i = 0; i < xArrayCuerpo.length; i++) {
				if(xArrayCuerpo[i]==null){continue;}
				if(parseInt(_tpcPrint) == parseInt(xArrayCuerpo[i].id)) {															
					$.map(xArrayCuerpo[i], function(xn_p, z) {
						if (typeof xn_p=="object"){
							// if(_tpcPrint==xn_p.idtipo_consumo){					
								if(xArrayBodyPrint[i]===undefined) {
									xArrayBodyPrint[i]={'des':xArrayCuerpo[i].des, 'id':xArrayCuerpo[i].id, 'titlo':xArrayCuerpo[i].titulo};
								}
								
								xArrayBodyPrint[i][xn_p.iditem]=xn_p;
								xArrayCuerpo[i].flag_add_tpc = true; // marca que ya se agrego en esta impresora
								
							// }
						}
					});
				}
			}

			if(xArrayBodyPrint.length==0){return; }
			xcuentaSeccionesImpresas++;
			xArmarSubtotalesArray(xArrayBodyPrint,xImpresoraPrint)

			// buscamos la impresora en xArrayImpresoras;
			const _xArrayImpresoras = xArrayImpresoras.filter(pp => parseInt(pp.idimpresora) == xIdPrint)[0];

			xImpresoraPrint[0].ip_print=_xArrayImpresoras.ip;
			xImpresoraPrint[0].var_margen_iz=_xArrayImpresoras.var_margen_iz;
			xImpresoraPrint[0].var_size_font=_xArrayImpresoras.var_size_font;
			xImpresoraPrint[0].local = 0;
			xImpresoraPrint[0].num_copias = _xArrayImpresoras.num_copias;
			xImpresoraPrint[0].var_size_font_tall_comanda = var_size_font_tall_comanda;
			xImpresoraPrint[0].copia_local = 0; // no imprime // solo para impresora local 
			xImpresoraPrint[0].img64 = _xArrayImpresoras.img64;
			xImpresoraPrint[0].papel_size = _xArrayImpresoras.papel_size;
			if (_xArrayImpresoras.img64 === "0") { xImpresoraPrint[0].logo64 = '';}
			
			xImprimirComandaAhora(xArrayEnca,xImpresoraPrint,xArrayBodyPrint,xArraySubTotales,function(rpt_print_tpc){
				callback(rpt_print_tpc);				
			});

		});
	}

	/// ------------------->


	//evalua impresoras y secciones, despachos o areas, la seccion en que impresora se imprime
	// console.log('xArrayCuerpo =========================>', xArrayCuerpo);
	for (var z = 0; z < xArrayImpresoras.length; z++) {
		xIdPrint=xArrayImpresoras[z].idimpresora;
		xArrayBodyPrint=[];
		xCuentaImpresorasEvaluadas++;
		for (var i = 0; i < xArrayCuerpo.length; i++) {
			//xCuentaItemsEvaluados++;
			if(xArrayCuerpo[i]==null){continue;}
			$.map(xArrayCuerpo[i], function(xn_p, z) {
				const isPedidoDelivery = xArrayCuerpo[i].des.toLowerCase() === 'delivery'; // 110322 // para imprimir el pedido completo

				// si tipo consumo tiene impresora asignada
				if (typeof xn_p=="object"){	
					if ( xArrayCuerpo[i].flag_add_tpc ) return; // si ya imprimio en tpc asignada				
					if (xn_p.imprimir_comanda==='0') return;// si no se muestra en comanda
					if(xIdPrint==xn_p.idimpresora){
						if(xArrayBodyPrint[i]===undefined){
							xArrayBodyPrint[i]={'des':xArrayCuerpo[i].des, 'id':xArrayCuerpo[i].id, 'titlo':xArrayCuerpo[i].titulo};
						}
						
						if (isPedidoDelivery && isPrintPedidoDeliveryCompleto) {
							// si es delivery
							Object.values(xArrayCuerpo[i]).filter(x => typeof x === 'object').map(x => xArrayBodyPrint[i][x.iditem]=x);
						} else {
							xArrayBodyPrint[i][xn_p.iditem]=xn_p;							
						}
					}

					// una seccion puede imprimir en varias impresoras
					if(xIdPrint.toString() == xn_p.idimpresora_otro.toString()){
						if(xArrayBodyPrint[i]===undefined){
							xArrayBodyPrint[i]={'des':xArrayCuerpo[i].des, 'id':xArrayCuerpo[i].id, 'titlo':xArrayCuerpo[i].titulo};
						}
						// xArrayBodyPrint[i][xn_p.iditem]=xn_p;
						if (isPedidoDelivery && isPrintPedidoDeliveryCompleto) {
							// si es delivery
							Object.values(xArrayCuerpo[i]).filter(x => typeof x === 'object').map(x => xArrayBodyPrint[i][x.iditem]=x);
						} else {
							xArrayBodyPrint[i][xn_p.iditem]=xn_p;							
						}
					}
				}
			})
		}
		if(xArrayBodyPrint.length==0){continue}
		xcuentaSeccionesImpresas++;
		xArmarSubtotalesArray(xArrayBodyPrint,xImpresoraPrint)
		xImpresoraPrint[0].ip_print=xArrayImpresoras[z].ip;
		xImpresoraPrint[0].var_margen_iz=xArrayImpresoras[z].var_margen_iz;
		xImpresoraPrint[0].var_size_font=xArrayImpresoras[z].var_size_font;
		xImpresoraPrint[0].local = 0;		
		xImpresoraPrint[0].num_copias = xArrayImpresoras[z].num_copias;
		xImpresoraPrint[0].var_size_font_tall_comanda = var_size_font_tall_comanda;
		xImpresoraPrint[0].copia_local = 0; // no imprime // solo para impresora local 
		xImpresoraPrint[0].img64 = xArrayImpresoras[z].img64;
		xImpresoraPrint[0].papel_size = xArrayImpresoras[z].papel_size;
		if (xArrayImpresoras[z].img64 === "0") { xImpresoraPrint[0].logo64 = '';}
		
		xImprimirComandaAhora(xArrayEnca,xImpresoraPrint,xArrayBodyPrint,xArraySubTotales,function(rpt_print){
			if(xArrayImpresoras.length==xCuentaImpresorasEvaluadas && rpt_print==false){//si todas las impresoras fueron evaluadas y no presentaron error termina la funcion
				// setTimeout( function(){try{xNuevoPedidoMP();}catch(err){return false;}}, 2700); //nuevo pedido en mipedido
				if(callback){
					callback(false); //falso = no hjay error
				};
			}
			else{
				if(callback){callback(true);} 
			}
		});
	};

	// si no encuentra ninguna impresora pasa como false = no hay error
	if(xcuentaSeccionesImpresas === 0){if(callback){callback(false)};}
}


function xImprimirComandaAhora(xArrayEncabezado,xImpresoraPrint,xArrayCuerpo,xArraySubtotal,callback){
	xPopupLoad.titulo="Imprimiendo...";

	const _sys_local = parseInt(xm_log_get('datos_org_sede')[0].sys_local);
	xArrayEncabezado.nom_us = xm_log_get('app3_us').nomus;

	const _data = {
		Array_enca: xArrayEncabezado,
		Array_print: xImpresoraPrint,
		ArrayItem: xArrayCuerpo.filter(x => !null), //xArrayCuerpo, para borrar los null
		ArraySubTotales: xArraySubtotal	
	}

	if (_sys_local === 1) {
		xSendDataPrintServer(_data,1,'comanda');
		setTimeout(() => {			
			callback(false);
		}, 300);
		return;
	}


	$.ajax({type: 'POST', url: '../../print/print3.php', 
			data:{
				Array_enca:xArrayEncabezado, 
				Array_print:xImpresoraPrint, 
				ArrayItem:xArrayCuerpo, 
				ArraySubTotales:xArraySubtotal				
			},
			success: function(dtPbd){
				if (dtPbd.indexOf('Error') != -1) {
					xPopupLoad.xclose();
					$("#print_error").text(dtPbd);
					xErrorPrint = true;
					// dialog_erro_print.open();
				} else {
					//xPopupLoad.titulo='Exito!';
					xErrorPrint = false;
					xPopupLoad.titulo = "Imprimiendo...";
					xPopupLoad.xopen();
					setTimeout(function () { xPopupLoad.xclose() }, 3000);
				}

				callback(xErrorPrint);
			},
			error: function (XMLHttpRequest, textStatus, errorThrown) {
				console.log(errorThrown);				
				xPopupLoad.xclose();
				$("#print_error").text("Error, Verifique que la ticketera este prendida y que tenga papel.");
				xErrorPrint = true;
				callback(xErrorPrint);
			}
		});	
}

// imprimir cualquier lista
function xImprimirCualquierLista(dataToPrinter, idestructura = 5, nomfile = 'listado') {
	xPopupLoad.titulo="Imprimiendo...";
	xPopupLoad.xopen();

	// const _sys_local = parseInt(xm_log_get('datos_org_sede')[0].sys_local);
	dataToPrinter.encabezado.nom_us = xm_log_get('app3_us').nomus;

	const _data = {
		Array_enca: dataToPrinter.encabezado,
		Array_print: dataToPrinter.impresora,
		ArrayItem: dataToPrinter.lista, //xArrayCuerpo, para borrar los null
		ArraySubTotales: dataToPrinter.subtotales	
	}

	// if (_sys_local === 1) {
	xSendDataPrintServer(_data, idestructura, nomfile);
		setTimeout(() => {			
			// callback(false);
			xPopupLoad.xclose();
		}, 300);
		// return;
	// }
}

/// enviar a print server
function xSendDataPrintServer(_data, _idprint_server_estructura, _tipo){
	// _data = JSON.stringify(JSON.stringify(_data)); si no es prueba

	switch (_idprint_server_estructura) {
		case 3: //pruebas
			break;
		case 4: // cuadre de caja
			if (_data.Array_enca[0].ip_print === '') return;
			break;
		default:
			try {				
				if (_data.Array_print[0].ip_print === '') return;
				_data.Array_print[0].logo64 = '';
				_data.Array_print[0].logo = '';
			} catch (error) {
				
			}
			break;
	}
	
	_data = JSON.stringify(_data);	
	_tipo = _tipo === 'pre cuenta' ? 'comanda' : _tipo;

	$.ajax({
		url: '../../bdphp/log_003.php?op=1',
		type: 'POST',		
		data: {
			datos: _data,
			idprint_server_estructura: _idprint_server_estructura,
			tipo: _tipo
		}
	})
	.done((UltimoIdPrint)=> {	
		// var _isSocket = isSocket ? isSocket : false;
		// if ( _isSocket ) {
			var dataSend = {
				detalle_json: _data,
				idprint_server_estructura: _idprint_server_estructura,
				tipo: _tipo,
				descripcion_doc: _tipo,
				nom_documento: _tipo,
				idprint_server_detalle: UltimoIdPrint
			}
	
			_cpSocketEmitPrinterOnly(dataSend);
			// return;
		// }

		// console.log(x);
		
		// quitamos esperar respuesta // para que no sobrecargue
		// // esperar respuesta // si hay algun error
		// setTimeout(() => {		
		// 	$.ajax({
		// 		url: '../../bdphp/log_003.php?op=101',
		// 		type: 'POST',
		// 		data: {id: UltimoIdPrint}
		// 	})
		// 	.done((x) => {
		// 		if ( parseInt(x) === 1 ) {
		// 			alert('Error con la impresora: Verifique el ip, que este prendida y que tenga papel');
		// 		}
		// 	})
		// }, 2500);
	}).fail(function(e) {
		alert( "error", e );
		console.log('error', e);
	  });	
}

function xReturnCorrelativoComprobante(_obj) {	
	let _rpt;
	if ( _obj.codsunat === '0' ) {  // para ticktes y otros
		_rpt = parseInt(_obj.correlativo) + 1;
		_rpt = xCeroIzq(_rpt, 7); // 7 ceros a la izq

		// suma correlativo  otro comprobante no declarado
		$.ajax({
			type: 'POST',
			url: '../../bdphp/log_002.php',
			data: {
				op: '103',
				i: _obj.idtipo_comprobante_serie
			}
		});

	} else {
		const tomaDelApi = parseInt(_obj.facturacion_correlativo_api) === 0 ? false : true;
		_rpt = tomaDelApi ? '#' : parseInt(_obj.correlativo) + 1;
		if (!tomaDelApi) {
			_obj.facturacion_correlativo_api = 1;		
		}
	}

	return _rpt;
}


function xUpdatePrintPrecuentaPedido(_id) {
	$.ajax({
		url: '../../bdphp/log_003.php?op=6',
		type: 'POST',		
		data: {
			id: _id			
		}
	});
}


async function xGetCorrelativoComprobante(_obj){
	const result = await $.ajax({
		type: 'POST',
		url: '../../bdphp/log_002.php',
		data: {
			op: '103001',
			i: _obj.idtipo_comprobante_serie,
			obj: _obj
		}
	})

	const rpt = JSON.parse(result)
	if ( rpt.success ) {		
		return rpt.datos[0].num;
	} else {
		return '#';
	}
	
}

function comprobarNumCorrelativoComprobante(xArrayComprobante) {
	// console.log('numero en comprobancion A', xArrayComprobante.correlativo);
	const _numIntCorrelativo = parseInt(xArrayComprobante.correlativo);
    const _isNotIntNumComprobante = isNaN(_numIntCorrelativoBD);
    if ( _isNotIntNumComprobante ) { // si viene con B001-00
        xArrayComprobante.correlativo = _numIntCorrelativoBD;
		// console.log('numero en comprobancion B', xArrayComprobante.correlativo)
    }
}

// impresora por tipo de consumo
function getImpresoraByTpc(idtipo_consumo) {
	const listTPCPrinter = xm_log_get('estructura_pedido');
	let xArrayImpresoras = xm_log_get('app3_woIpPrint')
	let printSelected = null
	const _tpcPrint = listTPCPrinter.filter(p => parseInt(p.idtipo_consumo) == idtipo_consumo)[0];
	if (_tpcPrint) {
		if (_tpcPrint.idimpresora !== '0') {
			printSelected = xArrayImpresoras.filter(p => parseInt(p.idimpresora) == _tpcPrint.idimpresora)[0];
		}
	}
	return printSelected ? printSelected : false;
}

// impresora por idseccion
function getImpresoraByIdImpresoraSeccion(idimpresora_seccion) {	
	let xArrayImpresoras = xm_log_get('app3_woIpPrint')
	const printSelected = xArrayImpresoras.filter(p => parseInt(p.idimpresora) == parseInt(idimpresora_seccion))[0];
	return printSelected ? printSelected : false;
}


function cocinarImpresionAnulacionOne(dataItem, usuarioSupervisor, usuarioCaja, infoDataPedido) {
	// console.log('dataItem', dataItem);

	// chequear si el tipo de consumo tiene impresora donde imprime
	let printer;	
	printer = getImpresoraByTpc(dataItem.idtipoconsumo);

	// console.log('printer', printer);

	// sino tiene, buscamos la impresora de la seccion
	if (!printer ) {
		printer = getImpresoraByIdImpresoraSeccion(dataItem.idimpresora_seccion);
	}

	// sino existe impresora salimos
	if (!printer) return;

	// obtenemos el item de dataItem	
	let _listaItemAnulados = [];	
	const des_tpc = dataItem.des_tp.toUpperCase();
	const des_item = dataItem.descripcion.toUpperCase();
	const des_mesa = infoDataPedido.nummesa === "0" ? `PEDIDO ${infoDataPedido.numpedido}` : `MESA ${infoDataPedido.nummesa}`;	
	const infoUsuario = `Caja: ${usuarioCaja} - Supervisor: ${usuarioSupervisor}`;
			
	_listaItemAnulados.push({
		descripcion: des_item.toUpperCase(),
		cantidad: '01',
	});
	

	printer.ip_print = printer.ip;

	const _dataPrintD = {
		lista: _listaItemAnulados,
		impresora: [printer],		
		subtotales: [],
		encabezado: {
			titulo: 'ANULACION',
			tipo_consumo: des_tpc,									
			mesa: des_mesa,
			correlativo_lista:0,
			usuario: infoUsuario,
			motivo: ''
		}
	}

	// console.log('lista anulacion', _dataPrintD);

	xImprimirCualquierLista(_dataPrintD);
}

function cocinarImpresionAnulacionList(listItemsAnular, usuarioSupervisor, usuarioCaja, infoDataPedido, motivoAnulacion) {
	let listItemAgrupados = []

	// verficamos si hay impresoras segun el tipo de consumo
	listItemsAnular.map(x => {
		// chequear si el tipo de consumo tiene impresora donde imprime
		let printer;	
		printer = getImpresoraByTpc(x.idtipoconsumo);
		// sino existe impresora salimos
		if (!printer) return;

		printer.ip_print = printer.ip;

		// de lo contrario buscamos si ya existe el tipo de consumo el la lista resumen
		const _isTpc = listItemAgrupados.filter(p => p.idtipoconsumo === x.idtipoconsumo)[0];
		if (_isTpc ) {
			const rowAdd = {
				descripcion: x.descripcion,
				cantidad: xCeroIzq(x.cant_item, 2),
			}

			_isTpc.items.push(rowAdd);
		} else {
			let listAdd = []
			const rowAdd = {
				descripcion: x.descripcion,
				cantidad: xCeroIzq(x.cant_item, 2),
			}

			listAdd.push(rowAdd)

			listItemAgrupados.push({
				idtipoconsumo: x.idtipoconsumo,
				idseccion: x.idseccion,
				des_tpc: x.des_tp,
				printer: printer,
				items: listAdd
			})
		}

		x.chekPrint = true;
		
	})

	

	// si no ha impresora por tipo de consumo buscamos por seccion	
	listItemsAnular.map(x => {
		if ( x.chekPrint ) return false // si ya se marco arriba para imprimer con tipo de consumo
		// chequear si el tipo de consumo tiene impresora donde imprime
		let printer;	
		printer = getImpresoraByIdImpresoraSeccion(x.idimpresora_seccion);
		// sino existe impresora salimos
		if (!printer) return;

		printer.ip_print = printer.ip;
		// de lo contrario buscamos si ya existe el tipo de consumo el la lista resumen
		const _isTpc = listItemAgrupados.filter(p => p.idtipoconsumo === x.idtipoconsumo)[0];
		if (_isTpc ) {
			const rowAdd = {
				descripcion: x.descripcion,
				cantidad: xCeroIzq(x.cant_item, 2),
			}
			_isTpc.items.push(rowAdd);
		} else {
			let listAdd = []
			const rowAdd = {
				descripcion: x.descripcion,
				cantidad: xCeroIzq(x.cant_item,2)
			}
			listAdd.push(rowAdd)
			listItemAgrupados.push({
				idtipoconsumo: x.idtipoconsumo,
				idseccion: x.idseccion,
				des_tpc: x.des_tp,			
				printer: printer,
				items: listAdd
			})
		}
		
	})
	
	
	
	if (listItemAgrupados.length === 0) return false;	


	const des_mesa = infoDataPedido.nummesa === "0" ? `PEDIDO ${infoDataPedido.numpedido}` : `MESA ${infoDataPedido.nummesa}`;	
	const infoUsuario = `Caja: ${usuarioCaja} - Supervisor: ${usuarioSupervisor}`;

	listItemAgrupados.map(x => {
		const _dataPrintD = {
			lista: x.items,
			impresora: [x.printer],
			subtotales: [],
			encabezado: {
				titulo: 'ANULACION',
				tipo_consumo: x.des_tpc,
				mesa: des_mesa,
				correlativo_lista: 0,
				usuario: infoUsuario,
				motivo: motivoAnulacion.toUpperCase()
			}
		}

		// console.log('lista anulacion', _dataPrintD);

		xImprimirCualquierLista(_dataPrintD);
	})



}

// funcion que evalua si el comprobante es por consumo
function isComprobanteConsumo(xArrayComprobante, xArraySubTotales, xArrayCuerpo) {
	// 211223 comprobante por consumo    
    if ( xArrayComprobante?.modo.id == 2 ) { 
		let _xArrayCuerpoTMP = {...xArrayCuerpo};
		try {			
			const _id = Date.now().toString().slice(-6); // number random
			const arrEstructura = xm_log_get('estructura_pedido');
			const _IdTpConsumo = arrEstructura[0].idtipo_consumo;
	
			// el precio total lo sacamos de subtotales
			const _importeTotalComprobante = xArraySubTotales.filter(x => x.descripcion.toLowerCase() === 'total')[0].importe;
			const des_item = xArrayComprobante.modo.modo_title.trim() === '' ?  'POR CONSUMO' : xArrayComprobante.modo.modo_title;
	
			const item = {  'id': _id, 
							'iditem': _id, 
							'idtipo_consumo': _IdTpConsumo,
							'des_seccion': 'ITEMS',
							'cantidad': 1, 
							'descripcion': des_item, 
							'punitario': _importeTotalComprobante, 
							'precio': _importeTotalComprobante,
							'ptotal': _importeTotalComprobante,
							'precio_total_calc': _importeTotalComprobante
						};
	
			const _listItem = [item];
			_xArrayCuerpoTMP = xCargarDatosAEstructuraImpresion(_listItem, xArraySubTotales, false);

			if (_xArrayCuerpoTMP.length === 0) return xArrayCuerpo;

			xArrayCuerpo = _xArrayCuerpoTMP;

		} catch (error) {
			console.error('error en comprobante por consumo', error);			
		}
    } 

	return xArrayCuerpo;
}