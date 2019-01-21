async function xCocinarResumenBoletas() {

    var rptSoap = '';
    
    // verifica si hay facturacion electronica
    var _arrSedes = xm_log_get('datos_org_sede');
    const isFacturacionElectronica = _arrSedes[0].facturacion_e_activo === "0" ? false : true; // si se emiten comprobantes electronicos    

    if (!isFacturacionElectronica) {
        return rptSoap;
    }

    // cocinar registro faltantes - enviar documnentos que no fueron enviados al servicio api por algun error de conexion
    // estado_api = 1; //no se subieron al api
    const arrDocNoRegistrado = await xSoapSunat_getArrNoRegistrado();
    let error = false;
    for (const i in arrDocNoRegistrado) {
        const jsonxml = JSON.parse(arrDocNoRegistrado[i].json_xml.replace('"{', '{').replace('}"', '}'))
        // const rpt = await xSoapSunat_EnviarDocumentApi(jsonxml, arrDocNoRegistrado[i].idregistro_pago, arrDocNoRegistrado[i].codsunat);
        const rpt = await xSoapSunat_EnviarDocumentApi(jsonxml, arrDocNoRegistrado[i].idce);
        if (!rpt.ok) { 
            $("#xTituloRpt").append('<p style="color: red">' + rpt.msj + "</p>"); 
            error = true; 
            dialog_enviando_sunat.close();
            return; }
    };
    
    if ( error ) return;

    
    // cocinar resumen
    const arrFechas = await xSoapSunat_getArrFechaBoletasNoAceptadas();
    for (const f in arrFechas) {
        const rpt = await xSoapSunat_ResumenDiario(arrFechas[f].fecha);
        rptSoap = rpt.msj;
        console.log(rpt);        
    }
    
    $("#xTituloRpt").append('<p style="color: blue">' + rptSoap +'</p>');

    setTimeout(() => {
        dialog_enviando_sunat.close();
    }, 1000);
}

