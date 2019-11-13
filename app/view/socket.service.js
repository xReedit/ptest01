var socketMonitoreo;

/// monitoreo de stock ///
function _monitoreoSocketOpen() {    
    isSocket = parseInt(xm_log_get('datos_org_sede')[0].pwa) === 0 ? false : true;
    if (!isSocket) { return; }

    const dtUs = xm_log_get('app3_us');
    var dataSocket = {
        idorg: dtUs.ido,
        idsede: dtUs.idsede,
        idusuario: dtUs.idus,
        isFromApp: 0
    }

    socketMonitoreo = io.connect(URL_SOCKET, {
        query: dataSocket
    });


    socketMonitoreo.on('itemModificado', (item) => {    
        console.log('itemModificado');
        _monitoreoStockItemModificado(item);
    });

    socketMonitoreo.on('nuevoPedido', (pedido) => {        
        console.log('nuevoPedido');
        _monitoreoStockNuevoPedido();
    });

}

function _monitoreoSocketIsConnect() {
    isSocket = parseInt(xm_log_get('datos_org_sede')[0].pwa) === 0 ? false : true;
    if (!isSocket) { return; }
    this._monitoreoSocketOpen();
    // if (!socketMonitoreo.connected) {
    //     socketMonitoreo = io.connect('http://localhost:5819', {
    //         query: dataSocket
    //     });
    // }
}

function _monitoreoSocketEmitNewItemInCarta(item) {
    if (!isSocket) { return; }
    socketMonitoreo.emit('nuevoItemAddInCarta', item);
}

function _monitoreoSocketEmitItemModificado(item) {
    if (!isSocket) { return; }
    item.sumar = 0; // suma completo // sino es true : false
    socketMonitoreo.emit('itemModificado', item);
}

function _monitoreoSocketEmitItemModificadoFromSubItems(item) {
    if (!isSocket) { return; }
    // item.sumar = 0; // suma completo // sino es true : false
    socketMonitoreo.emit('itemModificadoFromMonitorSubItems', item);
}

function _monitoreoSocketClose() {
    if (!isSocket) { return; }
    try {        
        socketMonitoreo.disconnect(true);
    } catch (error) {        
    }
}

/// monitoreo de stock ///