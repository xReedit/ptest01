/**
 * op_sede.service.js
 *
 * Servicio de "sede operativa" por pestaña para el POS multi-sede.
 *
 * Un usuario con el permiso A27 ("Permitir ventas en otra sede") puede operar
 * desde una pestaña del POS en una sede distinta a su sede de pertenencia.
 * El estado vive en sessionStorage (aislado por pestaña), por lo que dos
 * pestañas del mismo navegador pueden estar operando sedes diferentes a la
 * vez sin colisionar.
 *
 * Requiere xm_log_get() de app/view/xm_all.js.
 */
var opSede = (function () {
  var KEY = 'op_sede';
  var PERM_CODE = 'A27';

  function _us() {
    try {
      var dt = xm_log_get('app3_us');
      if (!dt) return null;
      return Array.isArray(dt) ? dt[0] : dt;
    } catch (e) {
      return null;
    }
  }

  function getPertenencia() {
    var us = _us();
    if (!us) return { idorg: 0, idsede: 0 };
    return { idorg: parseInt(us.ido, 10) || 0, idsede: parseInt(us.idsede, 10) || 0 };
  }

  function get() {
    var raw = window.sessionStorage.getItem(KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* corrupto */ }
    }
    var per = getPertenencia();
    return { idorg: per.idorg, idsede: per.idsede, nombre: '', ciudad: '', direccion: '' };
  }

  function set(sede) {
    if (!sede || !sede.idsede) return;
    window.sessionStorage.setItem(KEY, JSON.stringify({
      idorg:     parseInt(sede.idorg, 10)  || 0,
      idsede:    parseInt(sede.idsede, 10) || 0,
      nombre:    sede.nombre    || '',
      ciudad:    sede.ciudad    || '',
      direccion: sede.direccion || ''
    }));
  }

  function clear() {
    window.sessionStorage.removeItem(KEY);
  }

  function isOverride() {
    var cur = get();
    var per = getPertenencia();
    return cur.idsede > 0 && per.idsede > 0 && cur.idsede !== per.idsede;
  }

  function tienePermiso() {
    var us = _us();
    if (!us) return false;
    var acc = us.acc || '';
    if (parseInt(us.rol, 10) === 1) return true;
    return acc.indexOf(PERM_CODE + ',') >= 0 ||
           acc.indexOf(',' + PERM_CODE) >= 0 ||
           acc === PERM_CODE;
  }

  function ajaxParams() {
    var s = get();
    return { _op_org: s.idorg, _op_sede: s.idsede };
  }

  /** Lee ?op_sede= de search o del hash (#/ruta?op_sede=N). */
  function readOpSedeFromUrl() {
    var raw = null;
    try {
      raw = new URLSearchParams(window.location.search).get('op_sede');
    } catch (e) { /* ignore */ }
    if (!raw && window.location.hash) {
      var q = window.location.hash.indexOf('?');
      if (q >= 0) {
        try {
          raw = new URLSearchParams(window.location.hash.slice(q + 1)).get('op_sede');
        } catch (e) { /* ignore */ }
      }
    }
    var n = parseInt(raw, 10);
    return n > 0 ? n : 0;
  }

  function clearOpSedeFromUrl() {
    try {
      var url = new URL(window.location.href);
      url.searchParams.delete('op_sede');
      var hash = url.hash || '';
      var qi = hash.indexOf('?');
      if (qi >= 0) {
        var hp = new URLSearchParams(hash.slice(qi + 1));
        hp.delete('op_sede');
        var path = hash.slice(0, qi);
        var rest = hp.toString();
        url.hash = rest ? (path + '?' + rest) : path;
      }
      history.replaceState({}, document.title, url.pathname + url.search + url.hash);
    } catch (e) { /* ignore */ }
  }

  /**
   * Envia una request al backend respetando el override por pestaña.
   *
   *   posAjax({
   *     url:    '../../bdphp/log.php',      // archivo PHP destino
   *     posOp:  205,                          // valor de ?op= si aplica
   *     data:   { idcategoria: 3 },
   *     type:   'POST',
   *     success: function (rpt) { ... }
   *   });
   *
   * Si la pestaña esta operando en otra sede, redirige a log_pos_op.php y
   * agrega _op_org / _op_sede / _op_dest. Si no, llama al endpoint original
   * sin cambios (comportamiento identico al sistema actual).
   */
  function posAjax(opts) {
    opts = opts || {};
    opts.data = opts.data || {};
    opts.type = opts.type || 'POST';

    var url = opts.url || '';

    // Si trae posOp y la URL no lleva ?op=, se agrega cuando se llama al
    // endpoint original. Si va por log_pos_op.php, posOp viaja en POST.
    if (isOverride()) {
      var fname = url.split('/').pop().replace('.php', '');
      // Solo enrutamos los destinos soportados por log_pos_op.php.
      var destinosValidos = ['log', 'log_001', 'log_componentes', 'log_010'];
      if (destinosValidos.indexOf(fname) >= 0) {
        opts.url = url.replace(fname + '.php', 'log_pos_op.php');
        // Limpia querystring residual de ?op= y la pasa por POST.
        opts.url = opts.url.split('?')[0];
        opts.data._op_dest = fname;
        if (opts.posOp != null && opts.data.op == null) {
          opts.data.op = opts.posOp;
        }
        var params = ajaxParams();
        opts.data._op_org  = params._op_org;
        opts.data._op_sede = params._op_sede;
      } else if (opts.posOp != null && url.indexOf('?op=') < 0) {
        opts.url = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'op=' + encodeURIComponent(opts.posOp);
      }
    } else if (opts.posOp != null && url.indexOf('?op=') < 0) {
      opts.url = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'op=' + encodeURIComponent(opts.posOp);
    }

    // posOp no es un campo nativo de $.ajax; lo removemos.
    if (opts.posOp != null) {
      try { delete opts.posOp; } catch (e) { opts.posOp = undefined; }
    }

    return $.ajax(opts);
  }

  return {
    get: get,
    set: set,
    clear: clear,
    isOverride: isOverride,
    tienePermiso: tienePermiso,
    getPertenencia: getPertenencia,
    ajaxParams: ajaxParams,
    posAjax: posAjax,
    readOpSedeFromUrl: readOpSedeFromUrl,
    clearOpSedeFromUrl: clearOpSedeFromUrl
  };
})();

// Convencia: tambien expuesto como funcion global.
function posAjax(opts) { return opSede.posAjax(opts); }

/**
 * Prefilter automatico: cuando la pestaña esta operando en otra sede,
 * cualquier $.ajax dirigido a log.php / log_001.php / log_componentes.php /
 * log_010.php se reescribe transparentemente a log_pos_op.php agregando
 * _op_dest, _op_org y _op_sede. Asi no se necesita reemplazar cada $.ajax
 * existente del POS — funciona en el mismo flujo de hoy.
 *
 * Solo activo cuando opSede.isOverride() es true. Cuando no hay override,
 * el comportamiento es identico al sistema sin esta capa.
 */
(function () {
    if (typeof jQuery === 'undefined' || !jQuery.ajaxPrefilter) {
        return;
    }
    var DESTINOS = /\/bdphp\/(log_001|log_componentes|log_010|log)\.php(\?[^#]*)?$/;

    jQuery.ajaxPrefilter(function (options, originalOptions, jqXHR) {
        try {
            if (!opSede.isOverride()) return;
        } catch (e) { return; }

        var url = options.url || '';
        var m = url.match(DESTINOS);
        if (!m) return;

        var dest = m[1]; // 'log' | 'log_001' | 'log_componentes' | 'log_010'

        // Recuperar ?op= de la URL si esta y pasarlo a POST.
        var opVal = null;
        var qs = (m[2] || '').replace(/^\?/, '');
        if (qs) {
            var pairs = qs.split('&');
            for (var i = 0; i < pairs.length; i++) {
                var kv = pairs[i].split('=');
                if (kv[0] === 'op') { opVal = decodeURIComponent(kv[1] || ''); }
            }
        }

        // Reescribir URL al proxy.
        options.url = url.replace(DESTINOS, '/bdphp/log_pos_op.php');
        options.type = options.type || originalOptions.type || 'POST';

        var params = opSede.ajaxParams();

        if (options.data instanceof FormData) {
            options.data.append('_op_dest', dest);
            options.data.append('_op_org',  params._op_org);
            options.data.append('_op_sede', params._op_sede);
            if (opVal != null && !options.data.has('op')) {
                options.data.append('op', opVal);
            }
        } else {
            // En este punto jQuery YA serializo options.data a string (o es undefined),
            // porque ajaxPrefilter corre DESPUES de la conversion jQuery.param().
            // Debe quedar como STRING: si lo dejamos como objeto, jQuery hace
            // options.data.replace(...) mas adelante y revienta
            // ("v.data.replace is not a function"), rompiendo la carta/promos.
            var prev = (typeof options.data === 'string') ? options.data : '';
            var extra = '_op_dest=' + encodeURIComponent(dest) +
                        '&_op_org=' + encodeURIComponent(params._op_org) +
                        '&_op_sede=' + encodeURIComponent(params._op_sede);
            if (opVal != null && prev.indexOf('op=') < 0) {
                extra += '&op=' + encodeURIComponent(opVal);
            }
            options.data = prev ? (prev + '&' + extra) : extra;
        }
    });
})();

/**
 * Mismo override para httpFecht/axios. Componentes como x-comp-find-card cargan
 * via axios (httpFecht), que NO pasa por el jQuery.ajaxPrefilter de arriba, asi
 * que sin esto las cartas/categorias de esos componentes ignoran el override y
 * siempre muestran la sede de pertenencia. Este interceptor espeja el prefilter.
 */
(function () {
    var DESTINOS = /\/bdphp\/(log_001|log_componentes|log_010|log)\.php(\?[^#]*)?$/;
    var intentos = 0;

    function registrar() {
        if (typeof axios === 'undefined' || !axios.interceptors) {
            if (++intentos < 50) { setTimeout(registrar, 200); } // esperar a que cargue axios
            return;
        }
        axios.interceptors.request.use(function (config) {
            try {
                if (!opSede.isOverride()) { return config; }
            } catch (e) { return config; }

            var url = config.url || '';
            var m = url.match(DESTINOS);
            if (!m) { return config; }

            var dest = m[1];
            var opVal = null;
            var qs = (m[2] || '').replace(/^\?/, '');
            if (qs) {
                var pairs = qs.split('&');
                for (var i = 0; i < pairs.length; i++) {
                    var kv = pairs[i].split('=');
                    if (kv[0] === 'op') { opVal = decodeURIComponent(kv[1] || ''); }
                }
            }

            config.url = url.replace(DESTINOS, '/bdphp/log_pos_op.php');
            config.method = config.method || 'post';

            var params = opSede.ajaxParams();

            // Cuerpo JSON (httpFecht/axiosExecute con isHeadersJson=true): fusionar
            // _op_* dentro del objeto. NO convertir a form-urlencoded vacio.
            if (config.data && typeof config.data === 'object' && !(config.data instanceof FormData)) {
                config.data = Object.assign({}, config.data, {
                    _op_dest: dest,
                    _op_org:  params._op_org,
                    _op_sede: params._op_sede
                });
                if (opVal != null && config.data.op == null) {
                    config.data.op = opVal;
                }
                config.url = url.replace(DESTINOS, '/bdphp/log_pos_op.php');
                return config;
            }

            var prev = (typeof config.data === 'string') ? config.data : '';
            var extra = '_op_dest=' + encodeURIComponent(dest) +
                        '&_op_org=' + encodeURIComponent(params._op_org) +
                        '&_op_sede=' + encodeURIComponent(params._op_sede);
            if (opVal != null && prev.indexOf('op=') < 0) {
                extra += '&op=' + encodeURIComponent(opVal);
            }
            config.data = prev ? (prev + '&' + extra) : extra;
            config.headers = config.headers || {};
            config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            return config;
        });
    }

    registrar();
})();

