/**
 * vr_tab_storage.js
 *
 * Multi-venta: cada pestaña del POS guarda su propio pedido en curso y su costo de entrega.
 *
 * Antes las pestañas compartían estas claves de localStorage: "Nuevo pedido" en una pestaña devolvía
 * el stock del pedido de la otra, y el costo de entrega de un delivery se sumaba en la venta de la otra.
 * Aquí las claves de CLAVES se guardan con el id de la pestaña (clave + '::' + id); el resto del código
 * sigue usando localStorage igual que siempre.
 *
 * - F5 conserva el id (sessionStorage) y la pestaña recupera su pedido.
 * - "Duplicar pestaña" / window.open copian sessionStorage: si el id ya lo usa otra pestaña viva, se crea otro.
 * - Pestaña cerrada con venta a medias: la próxima pestaña de esa sede la recupera (vrTab.adoptar()).
 *
 * Sin dependencias (corre antes que jQuery). Solo lo carga m_panel.html.
 */
window.vrTab = window.vrTab || (function () {
    var PEDIDO = '::app3_sys_dta_pe_sk';
    // ::app3_listSubItem = opciones precargadas con la carta: si fuera compartida, la carta de una pestaña borraria la de otra
    var CLAVES = { '::app3_sys_dta_pe_sk': 1, '::app3_woDUS::cxe': 1, '::app3_listSubItem': 1 };
    var REG = '::app3_vr_tab::';        // REG + id = { ts, sede, fin }  (ts 0 = pestaña cerrada)
    var LATIDO_MS = 20000;
    var VIVA_MS = 3 * 60000;            // Chrome espacia los timers de pestañas en segundo plano hasta 1/min
    var VENCIDA_MS = 12 * 3600000;      // sin cierre registrado (se colgó el navegador): se da por cerrada

    var ls, ss, id;
    try { ls = window.localStorage; ss = window.sessionStorage; } catch (e) { return null; }

    var proto = Storage.prototype, get = proto.getItem, set = proto.setItem, rem = proto.removeItem;

    function leerReg(tab) {
        try { return JSON.parse(get.call(ls, REG + tab)); } catch (e) { return null; }
    }
    function escribirReg(ts) {
        var r = { ts: ts, sede: sedeActual() };
        if (!ts) { r.fin = Date.now(); }
        try { set.call(ls, REG + id, JSON.stringify(r)); } catch (e) {}
    }
    function viva(r) { return !!(r && r.ts > 0 && Date.now() - r.ts < VIVA_MS); }
    function cerrada(r) { return !!(r && (r.ts === 0 || Date.now() - r.ts > VENCIDA_MS)); }
    function sedeActual() {
        try { return typeof opSede !== 'undefined' ? (parseInt(opSede.get().idsede, 10) || 0) : 0; } catch (e) { return 0; }
    }
    function nuevoId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

    id = ss.getItem('::vr_tab');
    if (!id || viva(leerReg(id))) {
        id = nuevoId();
        ss.setItem('::vr_tab', id);
    }
    // abierta con "+ Otra venta" (xOtraVentaVR): trae copia del sessionStorage de la otra, pero el nombre de esa venta no es suyo
    if (String(window.name).indexOf('vr_otra_venta_') === 0) {
        ss.removeItem('::vr_tab_nombre');
        window.name = '';
    }

    function clave(store, k) { return (store === ls && CLAVES[k]) ? k + '::' + id : k; }
    proto.getItem = function (k) { return get.call(this, clave(this, k)); };
    proto.setItem = function (k, v) { return set.call(this, clave(this, k), v); };
    proto.removeItem = function (k) { return rem.call(this, clave(this, k)); };

    // pasa la venta de otra pestaña (o la de antes de este cambio, sufijo '') a esta
    function mover(sufijo) {
        Object.keys(CLAVES).forEach(function (k) {
            var origen = sufijo ? k + '::' + sufijo : k;
            var v = get.call(ls, origen);
            if (v !== null) { set.call(ls, k + '::' + id, v); }
            rem.call(ls, origen);
        });
        if (sufijo) { rem.call(ls, REG + sufijo); }
    }
    function borrar(tab) {
        Object.keys(CLAVES).forEach(function (k) { rem.call(ls, k + '::' + tab); });
        rem.call(ls, REG + tab);
    }

    /**
     * Al abrir la venta rápida: si esta pestaña no tiene venta, recupera la de una pestaña cerrada de la misma sede
     * (la más reciente). Limpia de paso los registros de pestañas cerradas sin venta.
     * ponytail: dos pestañas que abren la venta rápida en el mismo instante podrían recuperar la misma venta.
     */
    function adoptar() {
        var sede = sedeActual();
        var elegida = null, fin = -1, tabs = [];
        for (var i = 0; i < ls.length; i++) {
            var k = ls.key(i);
            if (k && k.indexOf(REG) === 0) { tabs.push(k.slice(REG.length)); }
        }
        tabs.forEach(function (tab) {
            if (tab === id) { return; }
            var r = leerReg(tab);
            if (!cerrada(r)) { return; }
            if (get.call(ls, PEDIDO + '::' + tab) === null) { borrar(tab); return; }
            if (sede && r.sede === sede && (r.fin || 0) > fin) { elegida = tab; fin = r.fin || 0; }
        });
        if (get.call(ls, PEDIDO + '::' + id) !== null) { return; }
        var urlSede = parseInt((window.location.search.match(/[?&]op_sede=(\d+)/) || [])[1], 10) || 0;
        if (urlSede && urlSede !== sede) { return; } // la pestaña va a cambiar de sede: recupera al llegar
        if (elegida) { mover(elegida); return; }
        if (get.call(ls, PEDIDO) !== null) { mover(''); }
    }

    // pestañas del POS abiertas ahora (con latido reciente), esta incluida
    function abiertas() {
        var n = 0;
        for (var i = 0; i < ls.length; i++) {
            var k = ls.key(i);
            if (k && k.indexOf(REG) === 0 && viva(leerReg(k.slice(REG.length)))) { n++; }
        }
        return n;
    }

    escribirReg(Date.now());
    setInterval(function () { escribirReg(Date.now()); }, LATIDO_MS);
    window.addEventListener('pagehide', function () { escribirReg(0); });
    window.addEventListener('pageshow', function () { escribirReg(Date.now()); });

    return { id: id, adoptar: adoptar, abiertas: abiertas };
})();
