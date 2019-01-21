// lista documentos no registrados - documnentos que no fueron enviados al servicio api por algun error de conexion
// ok
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

// resumen diario de boletas - ok
async function xSoapSunat_ResumenDiario(fecha) {
    const _fecha = xSoapSunat_cambiarFormatoFechaString(fecha);    
    const jsonResumen = {
        "fecha_de_emision_de_documentos": _fecha,
        "codigo_tipo_proceso": "1"
    }
    
    const _url = URL_COMPROBANTE + "/summaries";
    let _headers = HEADERS_COMPROBANTE;
    _headers.Authorization = "Bearer " + xm_log_get("datos_org_sede")[0].authorization_api_comprobante;
    const _jsonResumen = JSON.stringify(jsonResumen); 
    
    let rpt={};
    let dataRes = {};
    dataRes.fecha_resumen = _fecha;

    await fetch(_url, {
        method: 'POST',
        headers: _headers,
        body: _jsonResumen,
    }).then(function (response) {
        return response.json();
    }).then(function (res) {
        console.log(res);
        if (res.success) {
            rpt.ok = true;            
            dataRes.external_id = res.data.external_id;
            dataRes.ticket = res.data.ticket;
            dataRes.estado_sunat = 0;
            dataRes.msj='Resumen enviado.';

            CpeInterno_SaveResumenDiario(dataRes);

        } else {
            // resumen no aceptado probablemente la fecha sea incorrecta
            rpt.ok = false;
            rpt.error = 'Error al ingresar los datos';
            rpt.msj_error = res.message;

            dataRes.estado_sunat = 1;
            dataRes.msj = res.message;            
            
            CpeInterno_SaveResumenDiario(dataRes);

        }
    }).catch(function (error) { // error de conexion        
        rpt.ok = false;
        rpt.msj = "Error de conexion con el servicio Sunat: se intentara enviar nuevamente al proximo cierre.";        
    });
    
    return rpt;

}
// consulta de boletas que fueron registradas pero aun no son aceptadas(por que son nuevas o por algun error de conxion), devuelve fechas no aceptadas
async function xSoapSunat_getArrFechaBoletasNoAceptadas() {
    var rpt = [];
    await $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { 'op': '3' } })
        .done(function (rptDate) {
            rptDate = $.parseJSON(rptDate);
            if (!rptDate.success) { alert(rptDate.error); return; }
            rpt = rptDate.datos;
        });

    return rpt;
}


// esto se utiliza al cierre de caja
// envia al servicio de la api los documentos documentos que no se enviaron por error de conexion u otro
async function xSoapSunat_EnviarDocumentApi(json_xml, idce) {

    const _url = URL_COMPROBANTE + '/documents';
    let _headers = HEADERS_COMPROBANTE;
    _headers.Authorization = "Bearer " + xm_log_get("datos_org_sede")[0].authorization_api_comprobante;

    var rpt = {};
    const numero_comp = json_xml.serie_documento + "-" + json_xml.numero_documento;
    json_xml = JSON.stringify(json_xml);


    await fetch(_url, {
        method: 'POST',
        headers: _headers,
        body: json_xml,
    }).then(function (response) {
        return response.json();
    }).then(function (res) {
        console.log(res);
        if (res.success) {
            rpt.ok = true;

            let data = {};
            data.idce = idce;
            data.estado_api = 0; // se registro correctamente
            data.estado_sunat = 1; // aun no se envia ( si es boleta va en resumen)
            data.msj = "Registrado";
            data.numero = numero_comp;
            data.external_id = res.data.external_id;

            if (res.response.length != 0) {
                data.estado_sunat = res.response.code;
                data.msj = res.response.description;
            }

            CpeInterno_UpdateRegistro(data);

        } else {
            // error de ingreso de datos / anula comprobante
            rpt.ok = false;
            rpt.error = 'Error al ingresar los datos';
            rpt.msj_error = res.message;

            const data = {
                idce: idce,
                numero: numero_comp,
                external_id: '',
                estado_api: 0,
                estado_sunat: 1,
                anulado: 1,
                msj: res.message,
            }

            // el api registra pero la sunat lo devuelve = validacion - datos no cumplen con lo establecido
            CpeInterno_UpdateRegistro(data);

        }
    }).catch(function (error) { // error de conexion
        rpt.ok = false;
        rpt.msj = "Error de conexion con el servicio Sunat: se intentara enviar nuevamente al proximo cierre.";
    });

    return rpt;
}

// envia el resumen de boletas a la sunat
// fecha == indica la fecha si no se especifica es la fecha actual
// async function xSoapSunat_ResumenBoletas(fecha = null) {
//     rpt = {'success': false, 'msj': ''}
//     // fecha actual del sistema
//     // if (fecha === null) {
//     //     await $.ajax({ type: 'POST', url: '../../bdphp/log_001.php', data: { 'p_from': 'z' } })
//     //     .done(function (rptDate) {
//     //         rptDate = rptDate.split('|');
//     //         fecha = rptDate[0];
//     //     });
//     // }
//     // arrboletas
//     const arrBoletas = await xSoapSunat_GetBoletas(fecha);
//     if (arrBoletas === false) { return rpt = { 'success': false, 'msj': 'Error al conectar con el servicio' } }
//     if (arrBoletas.length === 0) { return rpt = { 'success': false, 'msj': 'No se encontraron documentos.'}; }

//     // json enviar
//     const rptEnvio = await xSoapSunat_EnviarResumen(fecha, arrBoletas);
//     if (rptEnvio === false) { return rpt = { 'success': false, 'msj': 'Error al conectar con el servicio' } }

//     return (rpt = { success: true, msj: "Comprobantes electronicos enviados con exito." }); 

// }

// obtiene las boletas
// fecha == indica la fecha si no se especifica es la fecha actual
// function xSoapSunat_GetBoletas(fecha = null) {
//     let arrResumen;
//     // const fechaActual = fecha === null ? new Date().toISOString().slice(0, 10) : fecha;
//     const fechaActual = fecha;
//     const id_api_comprobante = xm_log_get("datos_org_sede")[0].id_api_comprobante;
//     const token = "Bearer " + xm_log_get("datos_org_sede")[0].authorization_api_comprobante;
    
//     let _headers = HEADERS_COMPROBANTE_ONLY_AUTH;
//     _headers.Authorization = token;
    
//     let data = new FormData();
//     data.append("date_of_reference", fechaActual);
//     data.append("user_id", id_api_comprobante);

//     const _url = URL_COMPROBANTE + "/summaries/getdocuments";

//     $.ajax({
//       type: "POST",
//       url: _url,
//       headers: _headers,
//       data: data,
//       processData: false,
//       contentType: false,
//       dataType: "json",
//       async: false,
//       success: function(data) {
//         arrResumen = data.data;
//       },
//       error: function(err) {
//         console.log(err);
//         arrResumen = false;
//       }
//     });

//     return arrResumen;
// }

// function xSoapSunat_EnviarResumen(fecha, arrBoletas) {
//     var res;
//     const fechaActual = fecha;
//     const id_api_comprobante = xm_log_get("datos_org_sede")[0].id_api_comprobante;
//     const token = "Bearer " + xm_log_get("datos_org_sede")[0].authorization_api_comprobante;

//     let _headers = HEADERS_COMPROBANTE;
//     _headers.Authorization = token;

//     const _url = URL_COMPROBANTE + "/summaries/resumen";

//     let xJsonResumen = {
//         "date_of_issue": fechaActual,
//         "date_of_reference": fechaActual,
//         "documents": arrBoletas,
//         "id": "null",
//         "type": "1",
//         "user_id": id_api_comprobante
//     }

//     xJsonResumen = JSON.stringify(xJsonResumen);
//     // console.log(xJsonResumen);

//     $.ajax({
//         type: 'POST',
//         url: _url,
//         headers: _headers,
//         dataType: 'json',
//         data: xJsonResumen,
//         async: false,
//         success: function (data) {
//             // console.log(data);
//             res = data;
//             xSoapSunat_cambiaEstado_resumen("aceptado", "1", fecha, data.id, data.ticket, data.message);
//         },
//         error: function (err) {
//             console.log(err);
//             res = false;
//         }
//     });
    
//     return res;

// }

// envio individual de factura o boleta // en segundo plano
// function xSoapSunat_EnvioIndividual(idexternal) {

//     const _url = URL_COMPROBANTE + "/send_xml";    
//     const token = "Bearer " + xm_log_get("datos_org_sede")[0].authorization_api_comprobante;
//     const xJsonSend = {"external_id": idexternal}
    
//     let _headers = HEADERS_COMPROBANTE;
//     _headers.Authorization = token;

//     $.ajax({
//       type: "POST",
//       url: _url,
//       headers: _headers,
//       dataType: "json",
//         data: JSON.stringify(xJsonSend),
//       async: false,
//       success: function(data) {
//         // si todo esta bien registra que fue aceptada
//         // console.log(data);
//         xSoapSunat_cambiaEstado("aceptado", "1", idexternal);
//       },
//       error: function(err) {
//         console.log(err);
//         // si hay algun error deja el estado en 0 
//       }
//     });
// }


// cambia estado: para error = 0 o  succes = 1 // aceptada, anulada
// function xSoapSunat_cambiaEstado(campo, valor, idexternal) {
//     const _data = { idexternal: idexternal, campo: campo, valor: valor}
//     $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { op: '2', data: _data } })
//     .done( function (data) {
//         // console.log(data);
//     })
// }

// cambia estado: para error = 0 o  succes = 1 // aceptada, anulada
// function xSoapSunat_cambiaEstado_resumen(campo, valor, fecha, id, ticket, msj) {
//     const _fecha = xSoapSunat_cambiarFormatoFecha(fecha);
//     const _data = { fecha: _fecha, campo: campo, valor: valor, id: id, ticket: ticket, msj:msj };
//     $.ajax({ type: 'POST', url: '../../bdphp/log_002.php', data: { op: '201', data: _data } })
//     .done( function (data) {
//         // console.log(data);
//     })
// }

// cambia el formato de fecha me yyyy-mm-dd a dd/mm/yyyy
function xSoapSunat_cambiarFormatoFecha(input) {
  const pattern = /(\d{4})\-(\d{2})\-(\d{2})/;
  if (!input || !input.match(pattern)) {
    return null;
  }
  return input.replace(pattern, "$3/$2/$1");
}

// cambia el formato de fecha dd/mm/yyyy - yyyy-mm-dd
function xSoapSunat_cambiarFormatoFechaString(sfecha) {    
    return sfecha.split("/").reverse().join("-");
}



/////////// consultas

function xSoapSunat_DownloadFile(tipo, id) {
    const _url = `${URL_COMPROBANTE_DOWNLOAD_FILE}/${tipo}/${id}`;
    window.open(_url, "_blank");
}