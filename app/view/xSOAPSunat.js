// envia el resumen de boletas a la sunat
async function xSoapSunat_ResumenBoletas() {
    debugger
    rpt = {'success': false, 'msj': ''}
    // arrboletas
    const arrBoletas = await xSoapSunat_GetBoletas();
    if (arrBoletas === false) { return rpt = { 'success': false, 'msj': 'Error al conectar con el servicio' } }

    // json enviar
    const rptEnvio = await xSoapSunat_EnviarResumen(arrBoletas);
    if (rptEnvio === false) { return rpt = { 'success': false, 'msj': 'Error al conectar con el servicio' } }

}

// obtiene las boletas del dia
function xSoapSunat_GetBoletas() {
    let arrResumen;
    const fechaActual = new Date().toISOString().slice(0, 10);
    const id_api_comprobante = xm_log_get("datos_org_sede")[0].id_api_comprobante;
    const token = "Bearer " + xm_log_get("datos_org_sede")[0].authorization_api_comprobante;
    
    let _headers = HEADERS_COMPROBANTE_ONLY_AUTH;
    _headers.Authorization = token;
    
    let data = new FormData();
    data.append("date_of_reference", fechaActual);
    data.append("user_id", id_api_comprobante);

    const _url = URL_COMPROBANTE + "/summaries/getdocuments";

    $.ajax({
      type: "POST",
      url: _url,
      headers: _headers,
      data: data,
      processData: false,
      contentType: false,
      dataType: "json",
      async: false,
      success: function(data) {
        console.log("succes: ", data);
        arrResumen = data.data;
      },
      error: function(err) {
        console.log(err);
        arrResumen = false;
      }
    });

    return arrResumen;
}

function xSoapSunat_EnviarResumen(arrBoletas) {
    var res;
    const fechaActual = new Date().toISOString().slice(0, 10);
    const id_api_comprobante = xm_log_get("datos_org_sede")[0].id_api_comprobante;
    const token = "Bearer " + xm_log_get("datos_org_sede")[0].authorization_api_comprobante;

    let _headers = HEADERS_COMPROBANTE;
    _headers.Authorization = token;

    const _url = URL_COMPROBANTE + "/summaries/resumen";

    let xJsonResumen = {
        "date_of_issue": fechaActual,
        "date_of_reference": fechaActual,
        "documents": arrBoletas,
        "id": "null",
        "type": "1",
        "user_id": id_api_comprobante
    }

    xJsonResumen = JSON.stringify(xJsonResumen);
    console.log(xJsonResumen);

    $.ajax({
        type: 'POST',
        url: _url,
        headers: _headers,
        dataType: 'json',
        data: xJsonResumen,
        async: false,
        success: function (data) {
            console.log(data);
            res = data;
        },
        error: function (err) {
            console.log(err);
            res = false;
        }
    });
    
    return res;

}