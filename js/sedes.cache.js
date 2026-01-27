/**
 * Cache de sedes disponibles para evitar consultas repetidas
 * Almacena en sessionStorage la información de sedes de la organización
 */

const SedesCache = (function() {
    const CACHE_KEY = 'sedes_disponibles_cache';
    const CACHE_EXPIRY_KEY = 'sedes_cache_expiry';
    const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos
    
    /**
     * Obtiene las sedes disponibles (desde cache o servidor)
     * @returns {Promise<Array>} Array de sedes disponibles
     */
    async function obtenerSedesDisponibles() {
        // Verificar si hay cache válido
        const cached = obtenerDesdeCache();
        if (cached) {
            console.log('Sedes obtenidas desde cache');
            return cached;
        }
        
        // Si no hay cache, consultar al servidor
        console.log('Consultando sedes al servidor...');
        try {
            const _httpFecht = new httpFecht();
            const rpt = await _httpFecht.postJson('../../bdphp/log_009.php?op=133', {});
            
            if (rpt.success && rpt.datos) {
                // Guardar en cache
                guardarEnCache(rpt.datos);
                return rpt.datos;
            } else {
                return [];
            }
        } catch (error) {
            console.error('Error al obtener sedes:', error);
            return [];
        }
    }
    
    /**
     * Verifica si la organización tiene múltiples sedes
     * @returns {Promise<Boolean>}
     */
    async function tieneMultiplesSedes() {
        const sedes = await obtenerSedesDisponibles();
        return sedes.length > 1;
    }
    
    /**
     * Obtiene datos desde el cache si es válido
     * @returns {Array|null}
     */
    function obtenerDesdeCache() {
        try {
            const expiry = sessionStorage.getItem(CACHE_EXPIRY_KEY);
            const now = new Date().getTime();
            
            // Verificar si el cache ha expirado
            if (!expiry || now > parseInt(expiry)) {
                limpiarCache();
                return null;
            }
            
            const cached = sessionStorage.getItem(CACHE_KEY);
            if (cached) {
                return JSON.parse(cached);
            }
            
            return null;
        } catch (error) {
            console.error('Error al leer cache de sedes:', error);
            return null;
        }
    }
    
    /**
     * Guarda datos en el cache
     * @param {Array} sedes - Array de sedes a guardar
     */
    function guardarEnCache(sedes) {
        try {
            const now = new Date().getTime();
            const expiry = now + CACHE_DURATION;
            
            sessionStorage.setItem(CACHE_KEY, JSON.stringify(sedes));
            sessionStorage.setItem(CACHE_EXPIRY_KEY, expiry.toString());
            
            console.log('Sedes guardadas en cache (válido por 5 minutos)');
        } catch (error) {
            console.error('Error al guardar cache de sedes:', error);
        }
    }
    
    /**
     * Limpia el cache de sedes
     */
    function limpiarCache() {
        try {
            sessionStorage.removeItem(CACHE_KEY);
            sessionStorage.removeItem(CACHE_EXPIRY_KEY);
            console.log('Cache de sedes limpiado');
        } catch (error) {
            console.error('Error al limpiar cache de sedes:', error);
        }
    }
    
    /**
     * Fuerza la recarga de sedes desde el servidor
     * @returns {Promise<Array>}
     */
    async function recargarSedes() {
        limpiarCache();
        return await obtenerSedesDisponibles();
    }
    
    // API pública
    return {
        obtenerSedesDisponibles: obtenerSedesDisponibles,
        tieneMultiplesSedes: tieneMultiplesSedes,
        limpiarCache: limpiarCache,
        recargarSedes: recargarSedes
    };
})();
