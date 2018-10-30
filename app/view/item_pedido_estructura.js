// xArrayTpC=[], //ini en xLoadMipedidoBD tambien para formar array o estructura de  impresion en precuenta o factura, estructura de pedido={tipo consumo > seccion > items}

// tranforma un array pedido plano a una estructura de impresion {tipo consumo > seccion > items}
// devuelve la estructura de pedidos para impresion, {tipo consumo > seccion > items}
// _SubItems
// > precuenta > factura
function xCargarDatosAEstructuraImpresion (_SubItems) {
    var _arrEstructura = xm_log_get('estructura_pedido'); // get estructura_pedido
    var _arrRpt=[];

    // enumero los id desde segun el idtipoconsumo
    _arrEstructura.forEach(element => {
        _arrRpt[element.idtipo_consumo]=element
    });
    // _arrRpt=_arrEstructura.slice();
	_arrRpt=JSON.parse(JSON.stringify(_arrRpt).replace(/descripcion/g,'des'));
    
    for (b in _arrEstructura) {
        for (var i in _SubItems) {
            if(_arrEstructura[b].idtipo_consumo==_SubItems[i].idtipo_consumo){
                    //fue juntado
                    if(_SubItems[i].visible==1){continue;}
                    if(_arrEstructura[b]==null){continue}
                    _SubItems[i].precio_print=_SubItems[i].ptotal;//coloca precio para impresion
                    _SubItems[i].precio_total=_SubItems[i].ptotal;
                    _SubItems[i].des=_SubItems[i].descripcion;
                    _arrRpt[_arrEstructura[b].idtipo_consumo][i]=_SubItems[i];
            }
        }
    };

    return _arrRpt;

}



/// cocina datos a la estructura de items para impresion de comprobante
/// junta o agrupa por items en 2 secciones: items y servicios adicionales (si hubiera {taper, delivery etc}) 
/// _SubItems = xArrayCuerpo; items que se envian en el formato anterior 
function xEstructuraItemsJsonComprobante(_SubItems){

    let itemsObj = [];
    
    // items en una sola lista
    _SubItems
        .filter(x => x !== null)
        .map(items => {
            
            Object.keys(items).map(x=>{
                if ( typeof items[x] === 'object' ) { 
                    const item = items[x]; 
                    item.grupo = item.iditem;
                    itemsObj.push(item); 
                }
            })
        });
    
    // agrupa y suma
    const group = itemsObj
        .filter(x => x.grupo) 
        .reduce((rv, x) => {
            grupo = x.grupo;
            if (!rv[grupo]) {
                rv[grupo] = {cantidad: x.cantidad, des: x.des, precio_total: parseFloat(x.precio_total).toFixed(2), seccion: x.des_seccion}
                return rv
            }

            rv[grupo].cantidad += x.cantidad;
            rv[grupo].precio_total += parseFloat(x.precio_total).toFixed(2);
            return rv;
        }, []);

    
    // ordena
    group
        .sort((a, b) => (a.des > b.des) - (a.des < b.des) )
        .sort((a, b) => (a.seccion > b.seccion) - (a.seccion < b.seccion) );
    
    
    // agreagar adicionales si los hay
    
    
    

    
    console.log(group);
}
