// var socketCP;
// var socketCP = socketCP ? socketCP : new socketService();
var socketCP = socketService.getInstance(); 

function _cpSocketOpen() { 
    // if (isSocket) {
        // isSocket = parseInt(xm_log_get('datos_org_sede')[0].pwa) === 0 ? false : true;
        
        
        if ( !this.socketCP._socket) {            
            console.log('socket connect new');
            this.socketCP.connectSocket();
            this.listenSocketP();         
            
        } else {
            console.log('socket exist');
            if ( !this.socketCP._socket.connected ) {
                console.log('socket desconetacdo');
                this.socketCP.disconnectSocket();
                setTimeout(() => {                 
                    console.log('socket conectado');   
                    this.socketCP.connectSocket();
                    this.listenSocketP();
                }, 2000);
            }
        }

    // }
}


function listenSocketP() {
    console.log('listenSocketP ==== ');

    // console.log('this.socketCP', this.socketCP);
    /// guardar conexion sede
    setTimeout(() => {    
        $.ajax({ type: 'POST', url: '../../bdphp/log_005.php?op=14', data: { socketId:  this.socketCP._socket.id}})        
    }, 1200);

    // restore si hay
    this.socketCP.listen('nuevoPedido').subscribe(res => {
        // console.log('nuevoPedido msocket', res);
        try {                
            _cpSocketPintarPedido(res);           

            if(res.p_header.delivery.toString() == '1') {                
                xCDAddItemRow(res);
            }
        } catch (error) {}            
    });


    // cliente ha pagado desde el aplicativo
    // this.socketCP.listen('notificar-pago-pwa').subscribe(res => {
    //     try {                
    //         _cpSocketPintarPedido(res);
    //     } catch (error) {}            
    // });

    this.socketCP.listen('itemModificado').subscribe(res => {
        try { // puede venir de zona de despacho             
            _cpStockItemModificado(res);
        } catch (error) {}
    });

    this.socketCP.listen('itemResetCant').subscribe(res => {
        try { // puede venir de zona de despacho             
            _cpStockItemModificado(res);
        } catch (error) {}
    });

    this.socketCP.listen('printerOnly').subscribe(res => {
        try { // puede venir de zona de despacho        
            _cpSocketPintarPedido(res);

            if(res.delivery.toString() == '1') {
                xCDAddItemRow(res);
            }

        } catch (error) {}
    });

    // NOTIFICAR PAGO CLIENTE FROM APP
    this.socketCP.listen('notificar-pago-pwa').subscribe(res => {
        try { // puede venir de zona de despacho                             
            // console.log('notifica pago', res);
            if ( !res.isdelivery ) { // pago en mesa
                _cpSocketPintarPedido(null);
            }

            _cpSocketPintarNumerosPagosNotificados();
            pNotificaPago(res);
        } catch (error) {}
    });


    // NOTIFICAR LLAMADO DEL CLIENTE SOLICITANDO ATENCION
    this.socketCP.listen('notificar-cliente-llamado').subscribe(res => {
        try {
            pNotificaPersonal(res);            
        } catch (error) {}
    });

    // NOTIFICAR QUE SE IMPRIMIO PRECUENTA DE MESA
    this.socketCP.listen('notifica-impresion-precuenta').subscribe(res => {
        // console.log('listen notifica-impresion-precuenta');
        try {
            _cpSocketPintarPedido(null);
        } catch (error) {}
    });


    // NOTIFICAR QUE SE IMPRIMIO comanda del pedido para poner el flag
    // 170521 quitamos esta accion - no es necesario
    this.socketCP.listen('notifica-impresion-comanda').subscribe(pedido => {
        // console.log('notifica-impresion-comanda', pedido);
        // try {
        //     _cpSocketPintarFlagPedidoImpreso(pedido);
        // } catch (error) {}
    });


    this.socketCP.listen('restobar-notifica-pay-pedido-res').subscribe(res => {
        try {
            xRefreshPedidoPaySocket(res); // control de pedidos
        } catch (error) {}
    });


    this.socketCP.listen('restobar-permiso-cierre-remoto-respuesta').subscribe(res => {
        try {
            // console.log('restobar-notifica-pay-pedido-res', res);            
            xCajaResPermisoRemoto(res); // control de pedidos
        } catch (error) {}
    });    


    this.socketCP.listen('restobar-venta-registrada-res').subscribe(res => {
        this.socketCP.isRegistroVentaSource.next(true);        
    });

    // notifica a control de delivery que el repartidor acepto pedido
    this.socketCP.listen('repartidor-notifica-cliente-acepto-pedido-res').subscribe(res => {  
        xCDUpdateViewItem('repartidor', res);
    });


    this.socketCP.listen('repartidor-notifica-fin-pedido').subscribe(res => {
        const _res = {idpedido: res};
        xCDUpdateViewItem('repartidor-entregado', _res);
    });

    // escuchar los permisos de las solicitudes otorgados por el administrador
    // producto en mesa
    this.socketCP._listen('restobar-permiso-remove-producto-mesa', res => {        
        xCPAddClassItemPermissionDelete(res.idpedido_detalle); // control de pedidos
        pNotificaSolicitudAceptada(res);

        // guardamos en el storage para poder consular luego
        saveStorageSolicitudPermisoRemota(res);
    });

    // pedidos 
    this.socketCP._listen('restobar-permiso-remove-pedido-mesa', res => {        
        xCPAddClassItemPermissionAnularPedido(res.idpedido); // control de pedidos
        pNotificaSolicitudAceptada(res);

        saveStorageSolicitudPermisoRemota(res);
    });


    // notifica cambio de metodo de pago a registro de pagos
    this.socketCP._listen('restobar-permiso-change-metodo-pago', res => {        
        xRPRemoverPuntoFlotanteVerde(res.data.data.idregistro_pago_detalle); // control de pedidos
        pNotificaSolicitudAceptada(res);

        saveStorageSolicitudPermisoRemota(res);
    });

    // notifica cerrar caja
    this.socketCP._listen('restobar-permiso-cerrar-caja', res => {
        console.log('restobar-permiso-cerrar-caja', res);              
        pNotificaSolicitudAceptada(res);

        res.idusuario_solicita = res.data.idusuario_solicita;
        res.importe_sistema = res.data.data.importe_2;
        res.diferencia = (parseFloat(res.data.data.importe_1) - parseFloat(res.data.data.importe_2)).toFixed(2);
        res.diferecia_color = res.diferencia < 0 ? 'red' : 'green';
        xCajaResPermisoRemoto(res);
    });

    

}

// function _cpSocketIsConnect() {
//     isSocket = parseInt(xm_log_get('datos_org_sede')[0].pwa) === 0 ? false : true;
//     if (!isSocket) { return; }

//     try {
//         if (!socketCP.connected) {
//             _cpSocketOpen();
//         }   
//     } catch (error) {
//         // socketCP = io.connect(URL_SOCKET, {
//         //     query: dataSocket
//         // });
//         _cpSocketOpen();
//     }    
// }

// notifica nuevo pedido
function _cpSocketprinterOnly(pedido) {
    // if (!isSocket) { return; }
    this.socketCP.emit('printerOnly', pedido);
}

function _cpSocketEmitItemModificado(item) {
    // if (!isSocket) { return; }
    const checkIsUpdateStockAfter = getVariableSede('update_stock_after');
				
    console.log('item', item);
    // descuenta al agregar producto
	if ( !checkIsUpdateStockAfter ) {
        this.socketCP.emit('itemModificado', item);
	} else {
        // modificamos la cantidad del stock solo local en la vista
        // item.cantidad = item.sumar ? item.cantidad - item.cantidad_seleccionada : item.cantidad + item.cantidad_seleccionada ; 
        // item.cantidad_seleccionada = 0;
        if ( item.isporcion != 'ND' ) {
            _cpStockItemModificado(item);
        }
    }
}

// 23122023  actualiza stock de los productos despues de la venta
function _cpSocketEmitItemAllModificado(listItems) {
    // if (!isSocket) { return; }
    this.socketCP.emit('itemAllModificado', listItems);
}

function _cpSocketEmitPrinterOnly(item) {
    // if (!isSocket) { return; }
    this.socketCP.emit('printerOnly', item);
}

function _cpSocketEmitPrinterPrecuenta(item) {
    // if (!isSocket) { return; }
    this.socketCP.emit('notificar-impresion-precuenta', item);
}

function _cpSocketClose() {
    try {
        if (!isSocket) { return; }        
    } catch (error) {}
    try {        
        this.socketCP.disconnectSocket();
    } catch (error) {        
    }
    // this.socketCP.disconnectSocket();
}

// notifica al repartidor pedido desde el comercio
function _cpSocketNoiticaRepartidorFromComercio(pedido) {
    // if (!isSocket) { return; }
    this.socketCP.emit('set-repartidor-pedido-asigna-comercio', pedido);
}

// notifica al cliente repartidor asignado
function _cpSocketNoiticaClienteRepartidorAsignado(repartidor) {
    // if (!isSocket) { return; }
    this.socketCP.emit('repartidor-notifica-cliente-acepto-pedido', repartidor);
}

 

// notifica para llamar al repartidor de papaya
function _cpSocketComercioLLamaRepartidorPapaya() {
    // if (!isSocket) { return; }
    this.socketCP.emit('set-solicitar-repartidor-papaya', null);
}

// cuando se paga la cuenta en caja
// requiere idcliente
function _cpSocketEmitPedidoPagoCliente(listIdCliente) {
    // if (!isSocket) { return; }
    // console.log('listIdCliente', listIdCliente);
    this.socketCP.emit('pedido-pagado-cliente', listIdCliente);
}

function _cpSocketSavePedidoStorage(pedido) {
    if (!isSocket) { return; }
    localStorage.setItem('::app3_sys_dta_pe_sk', JSON.stringify(pedido));
}


function _cpSocketComprobanteWhatApp(payload) {
    // if (!isSocket) { return; }
    // localStorage.setItem('::app3_sys_dta_pe_sk', JSON.stringify(pedido));
    this.socketCP.emit('restobar-send-comprobante-url-ws', payload);    
}

function _cpSocketSendWhatAppPermisoAdmin(payload) {
    // if (!isSocket) { return; }
    // localStorage.setItem('::app3_sys_dta_pe_sk', JSON.stringify(pedido));
    this.socketCP.emit('restobar-send-msj-ws-solicitud-permiso', payload);    
}





// solo para el caso de nuevo pedido en venta rapida o al cerrar panel lateral
function _cpSocketRestoreFromPedidoStorage() {
    const checkIsUpdateStockAfter = getVariableSede('update_stock_after');
    if ( checkIsUpdateStockAfter ) { return; } // si se guarda luego entonces en backend no hubo ningun cambio 
    if (!isSocket) { return; }

    var pedido = localStorage.getItem('::app3_sys_dta_pe_sk') ? JSON.parse(localStorage.getItem('::app3_sys_dta_pe_sk')) : null;
    var pedidoSend = [], _subItemView = [];
    if ( pedido ) {
        pedido.filter(x => x !== null).map(x => {
            _subItemView = [];
            Object.values(x).filter(a => typeof a === 'object')
                .map(item => {
                    if ( item.isporcion != 'ND' ) {
                        item.idcarta_lista = item.iditem;
                        item.cantidad_seleccionada = item.cantidad;
                        item.isalmacen = item.procede.toString() === '0' ? 1 : 0;
                        item.isporcion = item.isporcion != 'SP' ? item.cantidad : item.isporcion;                     
                        item.subitems_view = JSON.parse(JSON.stringify(item.subitems_view));                     
                        // console.log('resetPedido item', JSON.stringify(item));
                        pedidoSend.push(item);
                    }
                });
        });
    }    

    if ( pedidoSend.length > 0 ) {
        this.socketCP.emit('resetPedido', pedidoSend);
    }
    
    localStorage.removeItem('::app3_sys_dta_pe_sk');
    pedidoSend = [];
}

function _cpSocketClearStorage() {
    if (!isSocket) { return; }
    localStorage.removeItem('::app3_sys_dta_pe_sk');
}


function _cpASocketNotifyPayPedido(payload) {
    // payload // idusuario // num pedido or num mesa // importe
    this.socketCP.emit('restobar-notifica-pay-pedido', payload);
    payload.idpedido = payload.num_pedido;
    xCDRemoveItemRow(payload); // quita de la lista de pendientes
}


// vine de caja
// function _cpSocketPermisoCierreRemoto(payload) {
//     // payload // idusuario // num pedido or num mesa // importe
//     this.socketCP.emit('restobar-permiso-cierre-remoto', payload);
// }

function _cpSocketPermisoCierreRemotoEnviarRpt(payload) {
    // payload // idusuario // num pedido or num mesa // importe
    this.socketCP.emit('restobar-permiso-cierre-remoto-respuesta', payload);
}


function _cpSocketVentaRegistrado() {
    // payload // idusuario // num pedido or num mesa // importe
    this.socketCP.emit('restobar-venta-registrada');
    this.socketCP.isRegistroVentaSource.next(true);
}

