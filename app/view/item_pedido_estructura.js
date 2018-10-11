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
