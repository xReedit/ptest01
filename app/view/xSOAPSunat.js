// lista documentos no registrados - documnentos que no fueron enviados al servicio api por algun error de conexion
async function xSoapSunat_getArrNoRegistrado() {
    var rpt = [];
    await $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { 'op': '301' } })
        .done(function (rptDate) {
            data_response = $.parseJSON(rptDate);
            if (!data_response.success) { alert(data_response.error); return; }
            rpt = data_response.datos;
        });

    return rpt;
}
// consulta de boletas que fueron registradas pero aun no son aceptadas(por que son nuevas o por algun error de conxion), devuelve fechas no aceptadas
async function xSoapSunat_getArrFechaBoletasNoAceptadas(){
    var rpt = [];
    await $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { 'op': '3' } })
    .done(function (rptDate) {
        rptDate = $.parseJSON(rptDate);
        if (!rptDate.success) { alert(rptDate.error); return; }
        rpt =  rptDate.datos;
    });

    return rpt;
}

// envia el resumen de boletas a la sunat
// fecha == indica la fecha si no se especifica es la fecha actual
async function xSoapSunat_ResumenBoletas(fecha = null) {
    rpt = {'success': false, 'msj': ''}
    // fecha actual del sistema
    if (fecha === null) {
        await $.ajax({ type: 'POST', url: '../../bdphp/log_001.php', data: { 'p_from': 'z' } })
        .done(function (rptDate) {
            rptDate = rptDate.split('|');
            fecha = rptDate[0];
        });
    }
    // arrboletas
    const arrBoletas = await xSoapSunat_GetBoletas(fecha);
    if (arrBoletas === false) { return rpt = { 'success': false, 'msj': 'Error al conectar con el servicio' } }
    if (arrBoletas.length === 0) { return rpt = { 'success': false, 'msj': 'No se encontraron documentos.'}; }

    // json enviar
    const rptEnvio = await xSoapSunat_EnviarResumen(fecha, arrBoletas);
    if (rptEnvio === false) { return rpt = { 'success': false, 'msj': 'Error al conectar con el servicio' } }

    return (rpt = { success: true, msj: "Comprobantes electronicos enviados con exito." }); 

}

// obtiene las boletas
// fecha == indica la fecha si no se especifica es la fecha actual
function xSoapSunat_GetBoletas(fecha = null) {
    let arrResumen;
    // const fechaActual = fecha === null ? new Date().toISOString().slice(0, 10) : fecha;
    const fechaActual = fecha;
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
        arrResumen = data.data;
      },
      error: function(err) {
        console.log(err);
        arrResumen = false;
      }
    });

    return arrResumen;
}

function xSoapSunat_EnviarResumen(fecha, arrBoletas) {
    var res;
    const fechaActual = fecha;
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
    // console.log(xJsonResumen);

    $.ajax({
        type: 'POST',
        url: _url,
        headers: _headers,
        dataType: 'json',
        data: xJsonResumen,
        async: false,
        success: function (data) {
            // console.log(data);
            res = data;
            xSoapSunat_cambiaEstado_resumen("aceptado", "1", fecha, data.id, data.ticket, data.message);
        },
        error: function (err) {
            console.log(err);
            res = false;
        }
    });
    
    return res;

}

// envio individual de factura o boleta // en segundo plano
function xSoapSunat_EnvioIndividual(idexternal) {

    const _url = URL_COMPROBANTE + "/send_xml";    
    const token = "Bearer " + xm_log_get("datos_org_sede")[0].authorization_api_comprobante;
    const xJsonSend = {"external_id": idexternal}
    
    let _headers = HEADERS_COMPROBANTE;
    _headers.Authorization = token;

    $.ajax({
      type: "POST",
      url: _url,
      headers: _headers,
      dataType: "json",
        data: JSON.stringify(xJsonSend),
      async: false,
      success: function(data) {
        // si todo esta bien registra que fue aceptada
        // console.log(data);
        xSoapSunat_cambiaEstado("aceptado", "1", idexternal);
      },
      error: function(err) {
        console.log(err);
        // si hay algun error deja el estado en 0 
      }
    });
}

// esto se utiliza al cierre de caja
// envia al servicio de la api los documentos documentos que no se enviaron por error de conexion u otro
async function xSoapSunat_EnviarDocumentApi(json_xml, idregistro_pago, tipo_documento) {
    const _url = URL_COMPROBANTE + '/documents';
    let _headers = HEADERS_COMPROBANTE;
    _headers.Authorization = "Bearer " + xm_log_get("datos_org_sede")[0].authorization_api_comprobante;


    var rpt = '';
    json_xml = JSON.stringify(json_xml);
    $.ajax({
        type: 'POST',
        url: _url,
        headers: _headers,
        dataType: 'json',
        data: json_xml,
        async: false,
        success: function (data) {// se registro con exito al servicio / api  
            console.log('succes: ', data);
            rpt = { success: true, msj: "ok." };
            // guardar external_id en registro pago;
            const _idexternal = data.data.external_id;
            const _data = { idregistro_pago: idregistro_pago, idexternal: _idexternal, enviado: "1" };
            $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { op: '101', data: _data } })
                .done(function (res) {
                    console.log(res);
                    
                    // envia si es factura
                    if (tipo_documento === '01') { // esto se ejecuta en segundo plano // es decir no espera a que termine
                        xSoapSunat_EnvioIndividual(_idexternal);
                    }
                });


        },
        error: function (err) { // si hay algun problema de conexion con el apí
            //
            console.log(err);
            rpt = { 'success': false, 'msj': 'Error de conexion con el servicio Sunat: Se intentara enviar nuevamente los comprobantes al proximo cierre.' };

        }
    }).fail((jqXHR, textStatus) => {
        console.log(textStatus);
        rpt = { 'success': false, 'msj': 'Error de conexion con el servicio Sunat: se intentara enviar nuevamente al proximo cierre.' };
    });

    return rpt;
}

// cambia estado: para error = 0 o  succes = 1 // aceptada, anulada
function xSoapSunat_cambiaEstado(campo, valor, idexternal) {
    const _data = { idexternal: idexternal, campo: campo, valor: valor}
    $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { op: '2', data: _data } })
    .done( function (data) {
        // console.log(data);
    })
}

// cambia estado: para error = 0 o  succes = 1 // aceptada, anulada
function xSoapSunat_cambiaEstado_resumen(campo, valor, fecha, id, ticket, msj) {
    const _fecha = xSoapSunat_cambiarFormatoFecha(fecha);
    const _data = { fecha: _fecha, campo: campo, valor: valor, id: id, ticket: ticket, msj:msj };
    $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { op: '201', data: _data } })
    .done( function (data) {
        // console.log(data);
    })
}

// cambia el formato de fecha me yyyy-mm-dd a dd/mm/yyyy
function xSoapSunat_cambiarFormatoFecha(input) {
  const pattern = /(\d{4})\-(\d{2})\-(\d{2})/;
  if (!input || !input.match(pattern)) {
    return null;
  }
  return input.replace(pattern, "$3/$2/$1");
}
