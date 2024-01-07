function setLocalSotrage(key, val) {
    localStorage.setItem(key, val);
}

function getLocalStorage(key) {
    return localStorage.getItem(key);
}

function removeLocalStorage(key) {
    localStorage.removeItem(key);
}

function removeAllLocalStorage() {
    localStorage.clear();
}

function bkLocalStorage() {
    var _bkLocalStorage = [];
    Object.keys(localStorage).forEach(function (key) {
        if (key != '::app3_sys_backup' && key != '::app3_sys_dta_pe') {
            _bkLocalStorage.push({
                id: key,
                content: localStorage.getItem(key)
            });
        }
    });    
    localStorage.setItem('::app3_sys_backup', JSON.stringify(_bkLocalStorage));
    localStorage.setItem('::app3_sys_backup_time', new Date());
}

function resotreLocalSotrage() {
    const _dataRestore = JSON.parse(localStorage.getItem('::app3_sys_backup'));
    _dataRestore.map(x => {
        // if (x.id === '::app3_sys_backup_time') return;
        // if (x.id === '::app3_sys_backup') return;

        if ( !localStorage.getItem(x.id) ) {
            setLocalSotrage(x.id, x.content);
        }
    });
}

// update variable global - cambio de sede y org // para cuando retome conexion no cambie al default
function updateapp3_woDUS_changeSede(o,i) {    
    var _c_xdt_log = window.localStorage.getItem("::app3_woDUS");        
    var _c_xdt_log = window.atob(_c_xdt_log);
    _c_xdt_log = JSON.parse(_c_xdt_log)

    var _data_res = atob(_c_xdt_log.us._sys_sessid).split(':');
    _c_xdt_log.us.idorg = o;
    _c_xdt_log.us.idsede = i;
    _data_res[3] = o;
    _data_res[4] = i;

    _data_res = _data_res.join(':');
    _data_res = btoa(_data_res);
    _c_xdt_log.us._sys_sessid = _data_res;    
    _c_xdt_log = btoa(JSON.stringify(_c_xdt_log));

    window.localStorage.setItem("::app3_woDUS", _c_xdt_log)
}

function getKeyStorageSolicitud(){
    return 'app3_solicitud'
}

function saveStorageSolicitudPermisoRemota(data){
    // recupero el storage
    var saveStorageSolicitud = JSON.parse(localStorage.getItem(getKeyStorageSolicitud()))

    // si no existe lo creo
    if(!saveStorageSolicitud){
        saveStorageSolicitud = []
    }

    // agrego el nuevo dato
    saveStorageSolicitud.push(data)


    // guardo el storage
    localStorage.setItem(getKeyStorageSolicitud(), JSON.stringify(saveStorageSolicitud))
}

function getStorageSolicitudPermisoRemota(){
    return JSON.parse(localStorage.getItem(getKeyStorageSolicitud()))
}

async function findStorageSolicudPermisoRemota(id, tipo_permiso){
    let dataStorageSolicitudRemota = getStorageSolicitudPermisoRemota()
    if (!dataStorageSolicitudRemota) {
        dataStorageSolicitudRemota = await findStorageSolicudPermisoRemotaWithRequest();        
    }

    let findRowSolicitud = findRowStorageSolicudPermisoRemota(id, tipo_permiso, dataStorageSolicitudRemota);
    if ( !findRowSolicitud ) {
        dataStorageSolicitudRemota = await findStorageSolicudPermisoRemotaWithRequest();
        findRowSolicitud = findRowStorageSolicudPermisoRemota(id, tipo_permiso, dataStorageSolicitudRemota);
    }
    
    return findRowSolicitud;

    
}

function findRowStorageSolicudPermisoRemota(id, tipo_permiso, dataStorageSolicitudRemota) {
    // remove producto de la cuenta entonces buscamos por el idpedido_detalle
    const _filterData = dataStorageSolicitudRemota.filter(x => x.data.tipo_permiso === tipo_permiso);
    if (_filterData.length === 0) return false;

    // colocamos el idpermiso_remoto en cada data
    _filterData.flatMap(x => {
        x.data.idpermiso_remoto = x.idpermiso_remoto; 
        return x.data;
    })
    
    if ( tipo_permiso === 1 ) { 
        const _find = _filterData.flatMap(x => x.data).find(x => x.data.idpedido_detalle === id);        
        return _find ? _find : false;        
    }

    if ( tipo_permiso === 2 ) { 
        // buscamos por idpedido si contiene el id        
        const _find = _filterData.flatMap(x => x.data).find(z => z.data.some(y => id.includes(y.idpedidos)));        
        return _find ? _find : false; 
    }

    // tipo 3 es para cambiar metodo pago en registro de pagos
    if ( tipo_permiso === 3 ) {        
        const _find = _filterData.flatMap(x => x.data).find(z => z.data.idregistro_pago_detalle === id);        
        return _find ? _find : false;        
    }

    

    return false;
}

// function que elimina el registro del storage de solicitud de permiso remota
function removeStorageSolicitudPermisoRemota(idpermiso_remoto){    
    let dataStorageSolicitudRemota = getStorageSolicitudPermisoRemota()
    if (dataStorageSolicitudRemota) {        
        
        dataStorageSolicitudRemota = dataStorageSolicitudRemota.filter(x => x.idpermiso_remoto !== idpermiso_remoto);
        localStorage.setItem(getKeyStorageSolicitud(), JSON.stringify(dataStorageSolicitudRemota))
    }

}

// sino hay data de solicitud de permiso remota busca con una petición 
// trae las solicitudes de permiso remota atendidos
async function findStorageSolicudPermisoRemotaWithRequest(){
    // var find = data.find(x => x.id == id)
    const _fetchApi = new httpFecht();
    const _data = await _fetchApi.postJson('../../bdphp/log_009.php?op=4001', null)        
    
    if ( _data.success ){
        _data.datos.map(x => {x.data = JSON.parse(x.data); return x;})
        // guardamos en el storage local
        localStorage.setItem(getKeyStorageSolicitud(), JSON.stringify(_data.datos))  
        return _data.datos;
    } else {
        return [];
    }    
} 