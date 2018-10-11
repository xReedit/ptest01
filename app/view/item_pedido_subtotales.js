/// calcula los subtotales desde el total de la mesa
/// se utiliza en dashboard
var xLocal_xDtSubTotales;
function xArmarSubtotalesFromTotal(itemMesa) {
	if (!itemMesa) return;
	
	var dtDetalle = itemMesa.secciones.split(',');
	var arrDt = [];

	dtDetalle.map((d,index) => {
		var _d = d.split(':');
		arrDt.push({'tipoconsumo':_d[0], 'seccion': _d[1], 'cantidad': _d[2]});		
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
    
    for (var i = 0; i < xarr_data_pedido.length; i++) {
		if(xarr_data_pedido[i]==null){continue;}
		$.map(xarr_data_pedido[i], function(n, z) {
			if (typeof n=="object"){
				arrDt.push({'tipoconsumo':n.idtipo_consumo, 'seccion': n.idseccion, 'cantidad':n.cantidad});		
			}
		})
	}
       
    return xCalcTotalSubArray(arrDt,xLocal_TotalImporte);
}

 
function xCalcTotalSubArray(arrDt, importeTotal) {
	var xCartaSubtotales=xm_log_get('carta_subtotales'),
		arrTipoConsumo = arrDt || [];
	
	xLocal_xDtSubTotales=[]; // variable global

    xLocal_xDtSubTotales.push({'descripcion':'Sub Total', 'importe':xMoneda(importeTotal), 'visible':true}); 

	// procentajes servicio | igv | etc
    xSumTotalPorcentaje = 0;
	xCartaSubtotales
		.filter(c => c.tipo==='p')
		.map(c => {
			porcentaje=parseFloat(parseFloat(c.monto)/100).toFixed(2);		
			porcentaje=parseFloat(parseFloat(importeTotal)*parseFloat(porcentaje)).toFixed(2)
            xSumTotalPorcentaje += parseFloat(porcentaje);
            
            xLocal_xDtSubTotales.push({'descripcion':c.descripcion, 'importe':xMoneda(porcentaje), 'visible':true}); 
		})

	
	// adicionales taper | deliver | etc
	if ( arrTipoConsumo.length === 0 ) return;
	xSumCantImporte = 0

	// var xarr_reduce = arrTipoConsumo.reduce((rv,x) => {
	// 	(rv[x['tipoconsumo']] = rv[x['tipoconsumo']] || []).push(x);
	// 	return rv;
	// });

	// var key = "tipoconsumo";
	// var xarr_reduce = groupBy(arrTipoConsumo, 'tipoconsumo')

	// se agrupa la data y se suma las cantidades
	var arrCocinada = arrTipoConsumo				
	.map(x => { 
		x.grupo = x.tipoconsumo+x.seccion;
		return x;
	 })		
	.reduce((obj,val) => {
		const grupo = val.grupo;
		if (obj[grupo]) {
			obj[grupo].grupo = val.grupo;
			obj[grupo].cantidad = parseFloat(obj[grupo].cantidad) + parseFloat(val.cantidad)
		} else {
			obj[grupo] = [];
			obj[grupo].grupo = val.grupo;
			obj[grupo].cantidad = val.cantidad 
		}
		return obj;
	}, []);

	xCartaSubtotales
		.filter(c => c.tipo==='a')		
		.map(c => {c.grupo = c.idtipo_consumo+c.idseccion; return c;})
		.map(c => {			
			arrCocinada
				.filter(x => x.grupo===c.grupo)
				.map(x => {
					const xSumAdicional= (parseFloat((x.cantidad) * parseFloat(c.monto)));
					xLocal_xDtSubTotales.push({'descripcion':c.descripcion, 'importe':xMoneda(xSumAdicional), 'visible':true}); 
					xSumCantImporte += parseFloat(xSumAdicional)
				})
        })
    

    xSumCantImporte = parseFloat(importeTotal) + parseFloat(xSumCantImporte) + parseFloat(xSumTotalPorcentaje);
    if(xLocal_xDtSubTotales.length==1){xLocal_xDtSubTotales=[];}
    xLocal_xDtSubTotales.push({'descripcion':'Total', 'importe':xMoneda(xSumCantImporte), 'visible':true});

	// retorna el importe total + subtotales(igv,servio,taper)
	return xSumCantImporte;
}

var groupBy = function(xs, key) {
	return xs.reduce(function(rv, x) {
	  (rv[x[key]] = rv[x[key]] || []).push(x);
	  return rv;
	}, {});
  };

