async function loadCuponesActivos() {
    const http = new httpFecht();
    const rpt =  await http.axiosExecuteJSON({
                    url: '../../bdphp/log_009.php?op=6004',
                    method: 'GET'                    
                });

    // colocarlo en localstore
    if (rpt.datos.length > 0) {
        window.localStorage.setItem('::app3_sys_cupones_activos', JSON.stringify(rpt.datos));
    } else {
        // remover localstore
        window.localStorage.removeItem('::app3_sys_cupones_activos');
    }
}

// funcion verica si hay cupones activos y los manda a imprimir
function checkCuponesActivos(datosCliente) {
    const cupones = window.localStorage.getItem('::app3_sys_cupones_activos');
    if (cupones) {
        const cuponesJson = JSON.parse(cupones);        
        cuponesJson.forEach(async(cupon) => {            
            await printerCupon(cupon, datosCliente.cliente);
        });
    }
}

async function generarCuponAutomatico(idcupon) {
    const http = new httpFecht();
    const rpt =  await http.axiosExecuteJSON({
                    url: '../../bdphp/log_009.php?op=6005',
                    method: 'POST',                    
                    data: {idcupon}
                });

    console.log('rpt cuppnes automaticos', rpt);
    return rpt.codigo;
}

async function printerCupon(cupon, cliente) {
    const isPrint = xgetComprobanteImpresora(-2);    
    let printer = isPrint ? xImpresoraPrint[0] : {};
    let impresora = isPrint ? {
        des_sede: printer.des_sede,
        ciudad: printer.ciudad,
        ip_print: printer.ip_print        
    } : {};
    
    const isClienteTelefono = cliente.telefono !== '';

    // si hay impresora y el cliente tiene telefono entonces genera el cupon
    if (isPrint || isClienteTelefono) {
        let codigoCupon = cupon.cupon_manual;
        if ( cupon.is_automatico === '1') {
            codigoCupon = await generarCuponAutomatico(cupon.idcupon);
        }

        const dataSede = xm_log_get('sede_generales')[0];

        cupon.codigo = codigoCupon;       
        let maxCanjes = cupon.cantidad_maxima == '0' ? 'No hay límite de canjes' : `Los primeros ${cupon.cantidad_maxima} cupones pueden ser canjeados`;
        let cuponBody = `*${cupon.titulo}* \n ${cupon.descripcion} \n *Fecha de canje: ${cupon.fecha_inicio} al ${cupon.fecha_termina}*. \n ${maxCanjes}.`;
        
        let _cupon = {
            sede: {
                nombre: dataSede.des_sede,                
                ciudad: dataSede.ciudad
            },
            codigo: codigoCupon,
            body: cuponBody,            
        }

        let _data = {
            cupon: _cupon,            
            Array_print: [impresora]
        };
        if (isPrint) {
            xSendDataPrintServer(_data, 3, 'cupon');
        }

        if (isClienteTelefono) {
            _data.telefono = cliente.telefono;
            _data.msj = `*CUPÓN DE DESCUENTO* \n\n ${_cupon.sede.nombre} ${_cupon.sede.ciudad} \n ${_cupon.body} \n\n *Código:* ${_cupon.codigo} \n\n *Gracias por preferirnos.*`;
            _cpSocketCuponWhatsApp(_data);
        }

        // set cupon como emitido
        const http = new httpFecht();
        http.axiosExecuteJSON({
            url: '../../bdphp/log_009.php?op=6008',
            method: 'POST',
            data: {                
                idcupon: cupon.idcupon,
            }
        });
        
    }    
}

async function validarCodigoCupon(codigo) {
    const cupones = window.localStorage.getItem('::app3_sys_cupones_activos');
    if (cupones) {
        const cuponesJson = JSON.parse(cupones);

        
        let cupon = cuponesJson.find(c => c.cupon_manual === codigo);
        if (cupon) {
            cupon.idcupon_codigo = null;
            cupon.activado = '0';
            return cupon;
        } else {
            // busca en cupon_codigo
            const http = new httpFecht();
            const rpt =  await http.axiosExecuteJSON({
                            url: '../../bdphp/log_009.php?op=6006',
                            method: 'POST',                    
                            data: {codigo},                            
                        });
            if ( rpt.datos.length > 0) {
                console.log('¿rpt.datos', rpt.datos);
                let idcupon = rpt.datos[0].idcupon  ;
                cupon = cuponesJson.find(c => c.idcupon === idcupon);
                if ( cupon ) {
                    cupon.idcupon_codigo = rpt.datos[0].idcupon_codigo;
                    cupon.activado = rpt.datos[0].activado;
                    return cupon;
                } else {
                    return  false;
                }
            } else {
                return false;
            }

        }
    }
    return false;
}

function getAllItemsCuentaPedido(nomTablePedido) {
    const _nomTablePedido = `#${nomTablePedido}`;
    const _idTdImporte = nomTablePedido=='tb_det_pedidos' ? '#td_importe' : '#ptotal';
    let listPedido = [];
    $(_nomTablePedido).find('.row').each(function(index, element) {
        const procede = $(element).data('procede');
        let rowAdd = {
            iditem: $(element).data('iditem'),
            idseccion: $(element).data('idseccion'),
            idproducto_stock: procede !=0 ? $(element).data('idproducto_stock') || 0 : 0,
            procede: $(element).data('procede'),
            ptotal: $(element).data('ptotal'),
            rowImporte: $(element).find(_idTdImporte) // esto para mostrar los cambios en la tabla
        }
        listPedido.push(rowAdd);
    })

    console.log('listPedido ==== ', listPedido);  
    return listPedido;
    
}

function showMsjCuponNoAplica() {
    const _swalAlertValues = paramsSwalAlert;
    _swalAlertValues.html = `<div class="p-1" style="overflow: hidden;"><i class="fa fa-ticket fa-2x text-danger" aria-hidden="true"></i>
                                <p class="mt-1">No hay productos en la compra actual que apliquen para este cupón.</p>
                            </div>`;
    showAlertSwalHtml(_swalAlertValues)
}

function showMsjCuponCanjeado() {
    const _swalAlertValues = paramsSwalAlert;
    _swalAlertValues.html = `<div class="p-1" style="overflow: hidden;"><i class="fa fa-meh-o fa-2x text-danger" aria-hidden="true"></i>
                                <p class="mt-1">Este cupón ya ha sido utilizado en una compra anterior y no puede ser canjeado nuevamente.</p>
                            </div>`;
    showAlertSwalHtml(_swalAlertValues)
}

async function aplicarCuponDsct(codigo, nomTablePedido = 'tb_det_pedidos') {
    const cupon = await validarCodigoCupon(codigo);
    let isAplica = false;
    let rptDsc = 0;
    let idcupon = 0;    
    if (cupon) {

        if ( cupon.activado == '1' ) {
            showMsjCuponCanjeado();
            return {
                aplica: false,
                importeDsct: 0,
                cupon: null
            };
        }
        // procemos a verificar en 
        let listDetalleProductosCupon = JSON.parse(cupon.cupon_detalle)
        listDetalleProductosCupon.map(x => {
            x.idproducto_stock = x.idproducto_stock == 0 ? null : x.idproducto_stock;
            x.idseccion = x.idseccion == 0 ? null : x.idseccion;
            x.iditem = x.iditem == 0 ? null : x.iditem;        
        })

        console.log('lsitDetalleProductos', listDetalleProductosCupon);        
        let listProductosPedido = getAllItemsCuentaPedido(nomTablePedido);
        console.log('listPedido', listProductosPedido);

        // buscar los productos que estan en el cupon
        
        let productosCupon = listDetalleProductosCupon.filter( p => {
            const productosAplican = listProductosPedido.filter(l => l.idproducto_stock == p.idproducto_stock || l.idseccion == p.idseccion || l.iditem == p.iditem)
            if (productosAplican.length > 0) {
                isAplica = true;
                console.log('productosAplican', productosAplican);

                // aplicar descuento
                productosAplican.forEach(productoAplica => {
                    // si es porcentaje
                    if (p.tipo_dsct == '0') {
                        let importe = parseFloat(productoAplica.ptotal);
                        let dsct = parseFloat(p.dsct);
                        let importeDsct = (importe * dsct) / 100;
                        let nuevoImporte = importe - importeDsct;
                        rptDsc += importeDsct;                        
                        productoAplica.rowImporte.html(`<s style="color: red;">${importe.toFixed(2)}</s> <span id="importe_descuento" class="text-success fw-600 animate__animated animate__flash">${nuevoImporte.toFixed(2)}</span>`);
                    } else {
                        let importe = parseFloat(productoAplica.ptotal);
                        let dsct = parseFloat(p.dsct);
                        let nuevoImporte = importe - dsct;                        
                        rptDsc += importeDsct;
                        productoAplica.rowImporte.html(`<s style="color: red;">${importe.toFixed(2)}</s> <span id="importe_descuento" class="text-success fw-600 animate__animated animate__flash">${nuevoImporte.toFixed(2)}</span>`);
                        // productoAplica.rowImporte.text(nuevoImporte.toFixed(2));
                    }
                });
            }
        });

        console.log('productosCupon == ', productosCupon);
        if ( !isAplica ) {
            // no hay productos que aplican al cupon
            showMsjCuponNoAplica();
        }         
    } 

    return {
        aplica: isAplica,
        importeDsct: rptDsc,
        cupon: cupon
    };
}

function removeCuponDsct(nomTablePedido) {
    // removemos el elemento de importe de descuento creado al momento de validar el cupon
    const _nomTablePedido = `#${nomTablePedido}`;
    const _idTdImporte = nomTablePedido=='tb_det_pedidos' ? '#td_importe' : '#ptotal';
    $(_nomTablePedido).find('.row').each(function(index, element) {
        let elementDsct = $(element).find('#importe_descuento')
        if ( elementDsct.length > 0 ) {
            $(element).find('#importe_descuento').remove();            
            const valImporte = $(element).find('s').text();
            $(element).find('s').remove();        
            $(element).find(_idTdImporte).text(valImporte);
        }        
    })
}

async function setCountCuponCanjeado(cupon) {
    console.log('cupon canjeado ==== ', cupon);
    const http = new httpFecht();
    await http.axiosExecuteJSON({
        url: '../../bdphp/log_009.php?op=6007',
        method: 'POST',
        data: {
            idcupon_codigo: cupon.idcupon_codigo,
            idcupon: cupon.idcupon,
        }
    });
}