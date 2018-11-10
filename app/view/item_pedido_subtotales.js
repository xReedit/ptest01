/// calcula los subtotales desde el total de la mesa
/// se utiliza en dashboard - control de pedidos
var xLocal_xDtSubTotales;
var xLocal_SubTotal_Quitados = "";
var arrVerifySubTotalTachados = []; // para tachar a todo o no
function xArmarSubtotalesFromTotal(itemMesa) {
	if (!itemMesa) return;
	
	var dtDetalle = itemMesa.secciones.split(',');
	var subtotales_tachados_bd = itemMesa.subtotales_tachados; 
	var arrDt = [];

	dtDetalle.map((d,index) => {
		var _d = d.split(':');
		arrDt.push({'tipoconsumo':_d[0], 'seccion': _d[1], 'cantidad': _d[2], 'subtotales_tachados': subtotales_tachados_bd});		
    });
    
    return xCalcTotalSubArray(arrDt,itemMesa.importe);
}

//Armar subtotales del array a imprimir
function xArmarSubtotalesArray(xarr_data_pedido=null, total=0){
	var xLocal_TotalImporte=0, arrDt=[];

	// si data_pedido es null es decir no indican, es por que viene de nuevo pedido
	// xmipedido, control mesa o venta rapida 
	// en ese caso toma xArrayPedidoObj que es la variable global donde se almacena el nuevo pedido  
	xarr_data_pedido = xarr_data_pedido || xArrayPedidoObj;
	
	xLocal_TotalImporte = total===0 ? xSumaCantArray(xarr_data_pedido) : total;
	
	// estructuramos para calcular
    for (var i = 0; i < xarr_data_pedido.length; i++) {
		if(xarr_data_pedido[i]==null){continue;}
		$.map(xarr_data_pedido[i], function(n, z) {
			if (typeof n=="object"){
				const  subtotales_tachados = n.subtotales_tachados !== undefined ? n.subtotales_tachados : xLocal_SubTotal_Quitados;
				const  idpedido = n.idpedido ? n.idpedido : 0;
				arrDt.push({'tipoconsumo':n.idtipo_consumo, 'seccion': n.idseccion, 'cantidad':n.cantidad, 'subtotales_tachados': subtotales_tachados, 'idpedido': idpedido});
			}
		})
	}
       
    return xCalcTotalSubArray(arrDt,xLocal_TotalImporte);
}

 
function xCalcTotalSubArray(arrDt, importeTotal) {
	var xCartaSubtotales=xm_log_get('carta_subtotales'),
		arrTipoConsumo = arrDt || [];
	
	xLocal_xDtSubTotales=[]; // variable global
	var arrSuma = [];

	xLocal_xDtSubTotales.push({'descripcion':'Sub Total', 'importe':xMoneda(importeTotal), 'visible':true , 'quitar': false}); 
	arrSuma.push({'descripcion':'Sub Total', 'importe':xMoneda(importeTotal), 'visible':true , 'quitar': false}); 

	
	xSumTotalPorcentaje = 0;
	xSumCantImporte = 0; // suma totales
	// arrVerifySubTotalTachados = []; // para tachar a todo o no
	const countPedidos = arrTipoConsumo.length; 

	
	// adicionales taper | deliver | etc
	if ( arrTipoConsumo.length === 0  || arrTipoConsumo[0].subtotales_tachados === undefined ) return;



	// var aa = [];
	
	// arrTipoConsumo.map(x => {
	// 	const ee = x.subtotales_tachados.split(',');
	// 	ee.map(e => {
	// 		if ( e && e !== ''){
	// 			aa[e] = !aa[e] ? {'cant': 1, 'tachado': false} : {'cant': parseInt(aa[e].cant) + 1, 'tachado': false};
	// 			aa[e].tachado = aa[e] === countPedidos;				
	// 		}
	// 	})
	// })

	// arrVerifySubTotalTachados = aa;
	// xSumCantImporte = 0

	// var xarr_reduce = arrTipoConsumo.reduce((rv,x) => {
	// 	(rv[x['tipoconsumo']] = rv[x['tipoconsumo']] || []).push(x);
	// 	return rv;
	// });

	// var key = "tipoconsumo";
	// var xarr_reduce = groupBy(arrTipoConsumo, 'tipoconsumo')


	// agrupar por idpedido para habilitar tachado
	// const arrGroupByIdPedido = groupBy(arrTipoConsumo,'idpedido');
	// var arrSubtotalesIds = [];
	// arrGroupByIdPedido.map(x => {
	// 	x.forEach((element, index) => {
	// 		if ( index > 1 ) {return;}
	// 		const arrIdSubtotal = element.subtotales_tachados.split(',')
	// 		arrIdSubtotal.filter(t => t!=='').map(x => {
	// 			arrSubtotalesIds[t] = arrSubtotalesIds[t] ? arrSubtotalesIds[t] : 0;
	// 			arrSubtotalesIds[t] += 1 ; 
	// 		})
	// 	});
	// })
	// console.log('arrGroupByIdPedido ', arrSubtotalesIds);

	// se agrupa la data y se suma las cantidades	
	var arrCocinada = arrTipoConsumo				
	.map(x => { 
		x.grupo = x.tipoconsumo+x.seccion;
		// x.grupoTipoconsumo = x.tipoconsumo
		return x;
	 })		
	.reduce((obj,val) => {
		const grupo = val.grupo;
		if (obj[grupo]) {
			obj[grupo].grupo = val.grupo;
			obj[grupo].grupoTipoconsumo = val.tipoconsumo;
			obj[grupo].cantidad = parseFloat(obj[grupo].cantidad) + parseFloat(val.cantidad)
			obj[grupo].subtotales_tachados = !obj[grupo].subtotales_tachados ? val.subtotales_tachados : obj[grupo].subtotales_tachados + val.subtotales_tachados;
		} else {
			obj[grupo] = [];
			obj[grupo].grupo = val.grupo;
			obj[grupo].grupoTipoconsumo = val.tipoconsumo;
			obj[grupo].cantidad = val.cantidad
			obj[grupo].subtotales_tachados = !obj[grupo].subtotales_tachados ? val.subtotales_tachados : obj[grupo].subtotales_tachados + val.subtotales_tachados;
		}
		return obj;
	}, []);

	var all_subtotales_tachados = '';
	arrCocinada.map( x => {
		all_subtotales_tachados += x.subtotales_tachados
	})

	arrCocinada.all_subtotales_tachados = all_subtotales_tachados;


	// var arrGroupPedido = arrTipoConsumo
	// 	.reduce((obj, val) => {
	// 		const grupo = val.idpedido;			
	// 		if (!obj[grupo]) { obj[grupo] = []; }
	// 		obj[grupo].subtotales_tachados = !obj[grupo].subtotales_tachados ? val.subtotales_tachados : obj[grupo].subtotales_tachados + val.subtotales_tachados;
	// 	})



	// CALCULAR RECORRIENDO CADA ITEM UNO X UNO
	
	xCartaSubtotales
		// .filter(c => c.tipo==='a')// todos los que son adicionales
		.map(c => {c.grupo = c.idtipo_consumo+c.idseccion; return c;})
		.map(c => {		
			switch (c.tipo) {
				case 'a': // todos los que son adicionales
					arrTipoConsumo // arr que contiene todos los items
						// .filter(x => x.grupo===c.grupo)				
						.map(x => {
							
							const id = c.tipo+c.id; // para quitar												
							const nivel = parseInt(c.nivel);										
							let sumItem = 0;
							let importe_tachado = 0;
							let subtotales_tachados_local = '';
							let cantidadItemPedido = 0;
							
							// arrCocinada[x.grupo].subtotales_tachados = evalua el grupo
							xLocal_SubTotal_Quitados = arrCocinada[x.grupo].subtotales_tachados != '' ? arrCocinada[x.grupo].subtotales_tachados : xLocal_SubTotal_Quitados;
		
							if ( nivel === 0){ // nivel item x item							
								if (x.grupo !== c.grupo) {return}
								sumItem = parseFloat(x.cantidad) * parseFloat(c.monto);
								if ( sumItem === 0) { return; }//no tiene esta seccion
							} else { // nivel pedido
								if (x.tipoconsumo !== c.idtipo_consumo) {return}
								sumItem = parseFloat(c.monto);						
							}
		
							// si esta para tachar al item no suma
							// evalua uno por uno
							importe_tachado = sumItem ;

							// if ( x.subtotales_tachados === "" ){ // quiere decir que no hay para procesar o que viene de venta rapida
							// 	subtotales_tachados_local = xLocal_SubTotal_Quitados;
							// 	cantidadItemPedido = 1;
							// } else {
								subtotales_tachados_local = x.subtotales_tachados;
								cantidadItemPedido = arrCocinada[x.grupo].cantidad
							// }


							subtotales_tachados_local.indexOf(id) >=0 ? sumItem = 0 : importe_tachado = 0;

							const tachado = checkSubTotalQuitado(cantidadItemPedido, id, sumItem);
		
							var IdExite;
							arrSuma.map((z, index) => {if (z.id === id) {IdExite = index; return;}} );
							if (IdExite) {
								const importeItem = parseFloat(arrSuma[IdExite].importe);
								const importeTachadoItem = parseFloat(arrSuma[IdExite].importe_tachado);
								arrSuma[IdExite].importe = nivel === 0 ? parseFloat( importeItem + parseFloat(sumItem)).toFixed(2) : parseFloat(sumItem).toFixed(2);
								arrSuma[IdExite].importe_tachado = nivel === 0 ? parseFloat(importeTachadoItem + parseFloat(importe_tachado)).toFixed(2) : parseFloat(importe_tachado).toFixed(2);
							} else {
								arrSuma.push({'id': id, 'descripcion':c.descripcion, 'importe_tachado':xMoneda(importe_tachado), 'importe':xMoneda(sumItem), 'esImpuesto': 0, 'visible':true, 'quitar': true, 'tachado': tachado}); 
							}
		
						});
					break;

				case 'p': // todos los porcentajes // que se añaden al total de la cuentas y NO SON QUITABLES
					const id = c.tipo+c.id;
					const esImpuesto = c.es_impuesto;					
					let porcentaje = parseFloat(parseFloat(c.monto)/100).toFixed(2);		
					porcentaje = parseFloat(parseFloat(importeTotal)*parseFloat(porcentaje)).toFixed(2)
					
					arrSuma.push({'id': id, 'descripcion':c.descripcion, 'importe':xMoneda(porcentaje), 'esImpuesto': esImpuesto, 'visible':true, 'quitar': false, 'tachado': false}); 
					break;
			}	
		});


	

	// // ADICIONALES POR ITEM
	// xCartaSubtotales
	// 	.filter(c => c.tipo==='a' && parseInt(c.nivel)===0)		
	// 	.map(c => {c.grupo = c.idtipo_consumo+c.idseccion; return c;})
	// 	.map(c => {			
	// 		arrCocinada
	// 			.filter(x => x.grupo===c.grupo)				
	// 			.map(x => {
	// 				const id = c.tipo+c.id; // para quitar					
	// 				// xSumCantImporte += parseFloat(xSumAdicional);
										
	// 				//x.subtotales_tachados.toLowerCase().split("").sort().join("").match(/(.)\1+/g).length;
	// 				// si el requerimiento viene de control de pedidos cada item tendra "subtotales_tachados"
	// 				xLocal_SubTotal_Quitados = x.subtotales_tachados != '' ? x.subtotales_tachados : xLocal_SubTotal_Quitados;

	// 				const CountIdTacahdos = xLocal_SubTotal_Quitados.toLowerCase().split(",").sort().filter(x => x===id).length;
	// 				const xSumAdicional= ((parseFloat((x.cantidad) - parseFloat(CountIdTacahdos)) * parseFloat(c.monto)));

	// 				const tachado = checkSubTotalQuitado(countPedidos, id, xSumAdicional);
					
	// 				xLocal_xDtSubTotales.push({'id': id, 'descripcion':c.descripcion, 'importe':xMoneda(xSumAdicional), 'visible':true, 'quitar': true, 'tachado': tachado}); 
	// 			})
	// 	});
	
	// // ADICIONALES POR PEDIDO	// COMO SERVICIO DELIVERY 
	// var tipoConsumoAdd = 0;
	// xCartaSubtotales
	// 	.filter(c => c.tipo==='a' && parseInt(c.nivel)===1)		
	// 	.map(c => {c.grupo = c.idtipo_consumo; return c;}) // solo mira seccion
	// 	.map(c => {
	// 		arrCocinada
	// 			.filter(x => x.grupoTipoconsumo===c.grupo)
	// 			.map(x => {
	// 				const id = c.tipo+c.id; // para quitar
	// 				if ( tipoConsumoAdd === x.grupoTipoconsumo ) { return;}

	// 				const xSumCantImportePorPedio = parseFloat(c.monto);

	// 				// si el requerimiento viene de control de pedidos cada item tendra "subtotales_tachados"
	// 				xLocal_SubTotal_Quitados = x.subtotales_tachados != '' ? x.subtotales_tachados : xLocal_SubTotal_Quitados;
	// 				const tachado = checkSubTotalQuitado(countPedidos, id, xSumCantImportePorPedio);
					
	// 				xLocal_xDtSubTotales.push({'id': id, 'descripcion':c.descripcion, 'importe':xMoneda(xSumCantImportePorPedio), 'visible':true, 'quitar': true, 'tachado': tachado}); 
					
	// 				tipoConsumoAdd = x.grupoTipoconsumo; // solo una vez
	// 			})
	// 	});


	// // lo ponemos aca para que tenga en cuenta los subtotales_tachados que pueden venir con los items
	// // procentajes impuestos o servicios | igv | etc
	// xCartaSubtotales
	// 	.filter(c => c.tipo==='p')
	// 	.map(c => {
	// 		const id = c.tipo+c.id; // para quitar			

	// 		porcentaje=parseFloat(parseFloat(c.monto)/100).toFixed(2);		
	// 		porcentaje=parseFloat(parseFloat(importeTotal)*parseFloat(porcentaje)).toFixed(2)
			
	// 		// si es impuesto
	// 		var esImpuesto=false, opQuitar=false, tachado = false;
	// 		if ( parseInt(c.es_impuesto) === 1 ) {
	// 			xSumCantImporte += parseFloat(porcentaje);
	// 			esImpuesto = true;		
	// 			opQuitar=false;
	// 		} else {
	// 			opQuitar=true;								
	// 			//xLocal_SubTotal_Quitados = x.subtotales_tachados != '' ? x.subtotales_tachados : xLocal_SubTotal_Quitados;
	// 			tachado = checkSubTotalQuitado(countPedidos, id, porcentaje);
	// 		}			
            
    //         xLocal_xDtSubTotales.push({'id': id, 'descripcion':c.descripcion, 'importe':xMoneda(porcentaje), 'visible':true, 'quitar': opQuitar, 'tachado': tachado}); 
	// 	});
		

    // xSumCantImporte = parseFloat(importeTotal) + parseFloat(xSumCantImporte) + parseFloat(xSumTotalPorcentaje);
    // if(xLocal_xDtSubTotales.length==1){xLocal_xDtSubTotales=[];}
    // xLocal_xDtSubTotales.push({'descripcion':'Total', 'importe':xMoneda(xSumCantImporte), 'visible':true});

	 
	const sumTotal = Object.keys(arrSuma).map(x => arrSuma[x].importe).reduce((a, b) => parseFloat(a) + parseFloat(b));
	if(arrSuma.length==1){arrSuma=[];}
	arrSuma.push({'descripcion':'Total', 'importe':xMoneda(sumTotal), 'visible':true});

	xLocal_xDtSubTotales = arrSuma;
	xSumCantImporte = sumTotal;
	// retorna el importe total + subtotales(igv,servio,taper)

	return xSumCantImporte;
}

// cheque si el subtotal fue quitaodo o marcado como no cobrar
// val = valor a sumar si no esta quitado
// x = grupo analizado que trae el subtotales_tachados
// countPedidos == cantidad de items
function checkSubTotalQuitado(countPedidos, id , val) {	
	var rpt = false;
	if (!xLocal_SubTotal_Quitados) { return; }	

	const CountIdTacahdos = xLocal_SubTotal_Quitados.toLowerCase().split(",").sort().filter(x => x===id).length;
	const hbilitarTachado =  parseInt(CountIdTacahdos) >= parseFloat(countPedidos);

	rpt = xLocal_SubTotal_Quitados.indexOf(id) >=0 ? true : false;
	if (!rpt) {xSumCantImporte += parseFloat(val);}
	
	
	// responde false = no tachar si al menos una coicidencia es false; 
	//es decir si tengo 2 pedidos que en uno se tacha taper y en otro no, en la suma total en control de pedidos no tachara, caso contario si tachara
	// if ( arrVerifySubTotalTachados[id] && arrVerifySubTotalTachados[id].tachado === false ) {
	// 	return arrVerifySubTotalTachados[id].tachado;
	// }


	return hbilitarTachado ? rpt : false; 
}

var groupBy = function(xs, key) {
	return xs.reduce(function(rv, x) {
	  (rv[x[key]] = rv[x[key]] || []).push(x);
	  return rv;
	}, {});
  };

