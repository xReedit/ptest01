// imprimir otros documentos --- -1 precuenta - -2 factura
// xArrayCuerpo debe tener estructura de mod impresion, (como sub pedido ::app3_sys_dta_pe)
// xArraySubTotales ya esta calculado los subtotales
// xArrayComprobante datos del comprobante : tipodoc , serie correlativo id's
// xArrayCliente datos del cliente nombre dni ruc direccion


var xImpresoraPrint;

function xCocinarImprimirComprobante(xArrayCuerpo, xArraySubTotales, xArrayComprobante, xArrayCliente,xidDoc){
	
	if (xArrayComprobante.idtipo_comprobante === "0") {return;} // ninguno no imprime
	
    // busca impresora donde imprimir
    if (!xgetComprobanteImpresora(xidDoc)) return false; 
	// si no viene datos return false

    if(xArrayCuerpo.length==0){return false}

    // array encabezado org sede
	var xArrayEncabezado = xm_log_get('datos_org_sede');    
	
	// escribir el importe total en letras
	// siempre ultimo es es el total
	const index_total = xArraySubTotales.length-1;
	const total_pagar = xArraySubTotales[index_total].importe;
	xArraySubTotales[index_total].importe_letras = numeroALetras(total_pagar);
	
    xImprimirComprobanteAhora(xArrayEncabezado,xArrayCuerpo,xArraySubTotales,xArrayComprobante,xArrayCliente,function(rpt_print){
		if(rpt_print==false){return false;}
		xPopupLoad.titulo="Imprimiendo...";
		xPopupLoad.xopen();
        setTimeout(function(){ xPopupLoad.xclose()}, 3000);
        return true;
	});
}

function xImprimirComprobanteAhora(xArrayEncabezado,xArrayCuerpo,xArraySubtotal,xArrayComprobante,xArrayCliente,callback){
	xPopupLoad.titulo="Imprimiendo...";

	

	$.ajax({type: 'POST', url: '../../print/print5.php', 
			data:{
				Array_enca:xArrayEncabezado, 
				Array_print:xImpresoraPrint, 
				ArrayItem:xArrayCuerpo, 
				ArraySubTotales:xArraySubtotal,
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


// impresora donde se va a imprimir
// retorna boolean si encontro impresora donde imprimir
function xgetComprobanteImpresora(xidDoc) {
    var xArrayImpresoras=xm_log_get('app3_woIpPrint'); //JSON.parse(window.localStorage.getItem("::app3_woIpPrint"));
    var xDtTipoDoc=xm_log_get('app3_woIpPrintO');//JSON.parse(window.localStorage.getItem("::app3_woIpPrintO"));
    var xPrintLocal=window.localStorage.getItem("::app3_woIpPrintLo");
    xImpresoraPrint=xm_log_get('sede_generales');


    var xIpPrintDoc=xidDoc;
	var xpasePrint=false;

	for (var i = 0; i < xDtTipoDoc.length; i++) {
		//pre-cuenta
		if(xDtTipoDoc[i].idtipo_otro==-1){xIpPrintDoc=xDtTipoDoc[i].idimpresora; break;}
	};
	//si existe impresora local // imprime todos los otros documentos en esta impresora local.
	if(xPrintLocal!=undefined && xPrintLocal!=''){
		xPrintLocal=$.parseJSON(xPrintLocal);
		xImpresoraPrint[0].ip_print=xPrintLocal.ip;
		xImpresoraPrint[0].var_margen_iz=xPrintLocal.var_margen_iz;
		xImpresoraPrint[0].var_size_font=xPrintLocal.var_size_font
		xImpresoraPrint[0].local = 1;
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
				break;
			}
		}
    }

    // si existe impresora donde imprimir
    return xpasePrint; 
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
	
	//si existe impresora local // saca una copia de todo el pedido
	if(xPrintLocal!=undefined && xPrintLocal!=''){
		xPrintLocal=$.parseJSON(xPrintLocal);
		xArmarSubtotalesArray(xArrayCuerpo,xImpresoraPrint)
		xImpresoraPrint[0].ip_print=xPrintLocal.ip;
		xImpresoraPrint[0].var_margen_iz=xPrintLocal.var_margen_iz;
		xImpresoraPrint[0].var_size_font=xPrintLocal.var_size_font;
		xImpresoraPrint[0].local = 1;

		xImprimirComandaAhora(xArrayEnca,xImpresoraPrint,xArrayCuerpo,xArraySubTotales,(res)=>{
			callback(res);
			// if(rpt_print==false){callback(rpt_print); return;}
			// xPopupLoad.titulo="Imprimiendo...";
			// xPopupLoad.xopen();
			// setTimeout(function(){ xPopupLoad.xclose()}, 3000);
		});
	}

	//evalua impresoras y secciones, despachos o areas, la seccion en que impresora se imprime
	for (var z = 0; z < xArrayImpresoras.length; z++) {
		xIdPrint=xArrayImpresoras[z].idimpresora;
		xArrayBodyPrint=[];
		xCuentaImpresorasEvaluadas++;
		for (var i = 0; i < xArrayCuerpo.length; i++) {
			//xCuentaItemsEvaluados++;
			if(xArrayCuerpo[i]==null){continue;}
			$.map(xArrayCuerpo[i], function(xn_p, z) {
				if (typeof xn_p=="object"){
					if(xIdPrint==xn_p.idimpresora){
						//if(xArrayBodyPrint.length==0){
						if(xArrayBodyPrint[i]===undefined){
							xArrayBodyPrint[i]={'des':xArrayCuerpo[i].des, 'id':xArrayCuerpo[i].id, 'titlo':xArrayCuerpo[i].titulo};
						}
						//try {xArrayBodyPrint[i][xn_p.iditem]=xn_p;}
						//catch(err) {console.log(err);}
						xArrayBodyPrint[i][xn_p.iditem]=xn_p;
					}
				}
			})
		}
		if(xArrayBodyPrint.length==0){continue}
		xcuentaSeccionesImpresas++;
		xArmarSubtotalesArray(xArrayBodyPrint,xImpresoraPrint)
		//xImpresoraPrint[0].ip_print='192.168.1.80';
		xImpresoraPrint[0].ip_print=xArrayImpresoras[z].ip;
		xImpresoraPrint[0].var_margen_iz=xArrayImpresoras[z].var_margen_iz;
		xImpresoraPrint[0].var_size_font=xArrayImpresoras[z].var_size_font;
		xImpresoraPrint[0].local = 0;
		xImprimirComandaAhora(xArrayEncabezado,xImpresoraPrint,xArrayBodyPrint,xArraySubTotales,function(rpt_print){
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

	// if(xcuentaSeccionesImpresas==0){if(callback){callback(true)};}
}


function xImprimirComandaAhora(xArrayEncabezado,xImpresoraPrint,xArrayCuerpo,xArraySubtotal,callback){
	xPopupLoad.titulo="Imprimiendo...";
	$.ajax({type: 'POST', url: '../../print/print3.php', 
			data:{
				Array_enca:xArrayEncabezado, 
				Array_print:xImpresoraPrint, 
				ArrayItem:xArrayCuerpo, 
				ArraySubTotales:xArraySubtotal				
			}
		})
	.done( function (dtPbd) {
		//xPopupLoad.xclose();
		if(dtPbd.indexOf('Error')!=-1){
			xPopupLoad.xclose();
			$("#print_error").text(dtPbd);
			xErrorPrint=true;
			// dialog_erro_print.open();
		}else{
			//xPopupLoad.titulo='Exito!';
			xErrorPrint=false;
			xPopupLoad.titulo="Imprimiendo...";
			xPopupLoad.xopen();
			setTimeout(function(){ xPopupLoad.xclose()}, 3000);
		}
		
		callback(xErrorPrint);
	});
}


function xLoadSerieCorrelativoComprobante(){

}