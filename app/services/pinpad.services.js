//URL_PINPAD esta en config.const.js
const httpClient = new httpFecht();
const checkPinPad = async (pinPadSN) => {
    const url = `${URL_PINPAD}/check`;
    const params = { pinPadSN, xIdSede };    
    return await httpClient.postJson(url, params);   
}

const setUserPinPad = async (pinPadSN) => {
    const url = `${URL_PINPAD}/setuser`;
    const params = { pinPadSN, xIdSede };
    return await httpClient.postJson(url, params);   
}

const loginPinPad = async (pinPadSN) => {
    const url = `${URL_PINPAD}/login`;
    const params = { pinPadSN, xIdSede };
    return await httpClient.postJson(url, params);   
}

const testConnectionPinPad = async (pinPadSN) => {
    const url = `${URL_PINPAD}/test`;
    const params = { pinPadSN, xIdSede };
    let rptTest = await httpClient.postJson(url, params);  

    console.log('rptTest', rptTest);
    if ( rptTest.success ) {
        return rptTest;
    }

    await setUserPinPad(pinPadSN);
    await loginPinPad(pinPadSN);
    
    // intentar realizar la prueba de conexion nuevamente
    rptTest = await httpClient.postJson(url, params);
    console.log('rptTest 2', rptTest);
    return rptTest;

}

const sendTransactionPinPad = async (transaction, currency) => {
    const _currency = currency || 'PEN';
    transaction.currency = _currency;

    const pinPadSN = localStorage.getItem('::app3_pinpad_sn');
    const url = `${URL_PINPAD}/transaccion`;
    const params = { pinPadSN, xIdSede, transaction };
    const rptTransaction = await httpClient.postJson(url, params); 
    
    if ( rptTransaction.success ) {
        sendPrinterPinPad(rptTransaction.data.print_data);
    }

    return rptTransaction;    
}

const getReportePinPad = async (op) => {
    const operaciones = {
        'detallado': '09',
        'totales': '10',
        'lote': '12'
    }
    const operation = operaciones[op] || '09';    
    
    const transaction = {
        operation
    }    
    const rpt = await sendTransactionPinPad(transaction);
    printRptTransaccionPinPad(rpt);
    return rpt;
}

const runPorcesoCierreLotePinPad = async () => {        
    try {
        const rptReporteDetallado = await getReportePinPad('detallado');
        if (!rptReporteDetallado.success) {
            return { success: false, message: 'Pinpad - Error en reporte detallado', error: rptReporteDetallado };
        }
        
        const rptReporteTotales = await getReportePinPad('totales');
        if (!rptReporteTotales.success) {
            return { success: false, message: 'Pinpad - Error en reporte de totales', error: rptReporteTotales };
        }
        
        const rptCierreLote = await getReportePinPad('lote');
        if (!rptCierreLote.success) {
            return { success: false, message: 'Pinpad - Error en cierre de lote', error: rptCierreLote };
        }
        
        return { success: true, message: 'Pinpad - Cierre de lote realizado correctamente' };
    } catch (error) {
        return { success: false, message: 'Pinpad - Error inesperado', error };
    }
};

const sendReimpresionLotePinPad = async (data_adicional) => {
    const transaction = {
        operation: '25',
        ecr_data_adicional2: data_adicional
    }    
    const rpt = await sendTransactionPinPad(transaction);
    printRptTransaccionPinPad(rpt);
    return rpt;
}

const saveTransactionPinPad = async (idregistro_pago, xtipoPago, response_pinpad) => {
    if ( xtipoPago[0].id != 12 ) return;
    const params = { idregistro_pago, response_pinpad };
    $.ajax({
        url: '../../bdphp/log_010.php?op=save-transaccion-pinpad',
        type: 'POST',
        data: JSON.stringify(params)
    })
    .done(function (data) {
        console.log('data', data);
    })

}

const sendRemovePinPad = async (transaccion, currency) => {
    const transaction = {
        ...transaccion,
        operation: '06',
        currency: currency || 'PEN'        
    }

    const url = `${URL_PINPAD}/remove`;
    const pinPadSN = localStorage.getItem('::app3_pinpad_sn');
    const params = { pinPadSN, xIdSede, transaction };
    console.log('params', params);
    const rptRemove = await httpClient.postJson(url, params);
    if (rptRemove.success) {
        saveRemovePinPad(transaction)
    }

    return rptRemove;    
    console.log('rptRemove', rptRemove);
}

const saveRemovePinPad = async (transaction) => {
    const params = { idregistro_pago: transaction.idregistro_pago, motivo: transaction.motivo_anular };
    $.ajax({
        url: '../../bdphp/log_010.php?op=save-remove-pinpad',
        type: 'POST',
        data: JSON.stringify(params)
    })
    .done(function (data) {
        console.log('data', data);
    })
}

const reemprimirVoucherPinPad = async (num_ref) => {
    const transaction = {
        operation: '11',
        data_adicional: num_ref        
    }

    const pinPadSN = localStorage.getItem('::app3_pinpad_sn');
    const url = `${URL_PINPAD}/transaccion`;
    const params = { pinPadSN, xIdSede, transaction };
    const rptPrint = await httpClient.postJson(url, params);   

    if ( rptPrint.success ) {
        sendPrinterPinPad(rptPrint.data.print_data);
    }

    return rptPrint;
}

const extractRefFromPrintData = (printData) => {
    const refMatch = printData.match(/REF:(\d+)/);
    return refMatch ? refMatch[1] : null;
}

const printRptTransaccionPinPad = async (rpt) => {
    if ( rpt.success ) {
        sendPrinterPinPad(rpt.data.print_data);
    }        
}

const sendPrinterPinPad = async (printData) => {
    if (!printData) {
        console.error('No print data provided');
        return;
    }

    const printer = xgetImpresora(-2);
    const dataSendPrint = {
        impresora: printer,
        lista: printData,
        subtotales: [],
        encabezado: [],
    }

    xImprimirCualquierLista(dataSendPrint, 11, 'pos');
}
