/**
 * Script para detectar y redirigir al servidor de impresión instalado
 * Soporta 2 versiones:
 * - Nueva versión: Node.js en localhost:3847
 * - Versión antigua: Laragon en ipPrintServerLocal
 */

const PrintServerDetector = {
    NEW_SERVER_URL: 'http://localhost:3847',
    NEW_SERVER_PING: 'http://localhost:3847/api/ping', 
    
    getOrgData: function() {
        const demo = window.location.href.indexOf('demo') > -1 ? 'd' : '';
        return {
            o: typeof xIdOrg !== 'undefined' ? xIdOrg : '',
            s: typeof xIdSede !== 'undefined' ? xIdSede : '',
            d: demo
        };
    },

    getEncodedOrgData: function() {
        return btoa(JSON.stringify(this.getOrgData()));
    },

    getLaragonServerUrl: function() {
        try {
            const datosSede = xm_log_get('datos_org_sede');
            if (datosSede && datosSede[0] && datosSede[0].ip_server_local) {
                return 'http://' + datosSede[0].ip_server_local;
            }
        } catch (e) {
            console.warn('No se pudo obtener ip_server_local:', e);
        }
        return null;
    },

    checkNewServer: async function() {
        console.log('🔍 Verificando servidor nuevo en:', this.NEW_SERVER_PING);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            console.log('🔍 Iniciando fetch...');
            const response = await fetch(this.NEW_SERVER_PING, {
                method: 'GET',
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            console.log('🔍 Fetch completado');
            
            console.log('✅ Servidor nuevo DETECTADO (responde en localhost:3847)');
            return {
                installed: true,
                version: '1.0.0',
                hostname: 'localhost',
                isConfigured: true,
                serverType: 'new'
            };
        } catch (e) {
            console.log('❌ Error al detectar servidor nuevo:', e.name, '-', e.message);
            console.log('❌ Stack:', e.stack);
        }
        console.log('❌ Servidor nuevo NO detectado');
        return { installed: false, serverType: 'new' };
    },

    checkLaragonServer: async function() {
        const baseUrl = this.getLaragonServerUrl();
        if (!baseUrl) {
            return { installed: false, serverType: 'laragon' };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            // Solo verificar si la baseUrl está activa, sin endpoint específico
            const response = await fetch(baseUrl, {
                method: 'GET',
                mode: 'no-cors',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            return {
                installed: true,
                baseUrl: baseUrl,
                serverType: 'laragon'
            };
        } catch (e) {
            console.log('Servidor Laragon no detectado:', e.message);
        }
        return { installed: false, serverType: 'laragon' };
    },

    detectInstalledServer: async function() {
        console.log('🔎 ========== INICIANDO BÚSQUEDA DE SERVIDOR DE IMPRESIÓN ==========');
        
        console.log('🔎 Paso 1: Verificando servidor NUEVO (Node.js)...');
        const newServerResult = await this.checkNewServer();
        console.log('🔎 Resultado servidor nuevo:', newServerResult);
        
        if (newServerResult.installed) {
            console.log('✅ ========== SERVIDOR NUEVO DETECTADO Y SELECCIONADO ==========');
            return newServerResult;
        }

        console.log('🔎 Paso 2: Verificando servidor LARAGON...');
        const laragonResult = await this.checkLaragonServer();
        console.log('🔎 Resultado servidor Laragon:', laragonResult);
        
        if (laragonResult.installed) {
            console.log('✅ ========== SERVIDOR LARAGON DETECTADO Y SELECCIONADO ==========');
            return laragonResult;
        }

        console.log('❌ ========== NO SE DETECTÓ NINGÚN SERVIDOR DE IMPRESIÓN ==========');
        return { installed: false, serverType: 'none' };
    },

    getRedirectUrl: function(serverInfo) {
        const encodedData = this.getEncodedOrgData();

        if (serverInfo.serverType === 'new') {
            return this.NEW_SERVER_URL;
        }

        if (serverInfo.serverType === 'laragon') {
            const versionPath = 'restobar/print/client/index.html';
            return serverInfo.baseUrl + '/' + versionPath + '?o=' + encodedData;
        }

        return null;
    },

    redirectToServer: async function(openInNewWindow = true) {
        console.log('🚀 ========== INICIANDO REDIRECCIÓN AL SERVIDOR ==========');
        const serverInfo = await this.detectInstalledServer();
        console.log('🚀 Información del servidor detectado:', serverInfo);

        if (!serverInfo.installed) {
            console.log('⚠️ No hay servidor instalado, mostrando página de descarga...');
            this.showDownloadPage();
            return { success: false, reason: 'no_server' };
        }

        console.log('✅ Servidor instalado, obteniendo URL de redirección...');
        const redirectUrl = this.getRedirectUrl(serverInfo);
        console.log('🔗 URL de redirección:', redirectUrl);
        
        if (redirectUrl) {
            console.log('🌐 Abriendo servidor de impresión en:', openInNewWindow ? 'nueva ventana' : 'misma ventana');
            if (openInNewWindow) {
                window.open(redirectUrl, 'Servidor de Impresion');
            } else {
                window.location.href = redirectUrl;
            }
            console.log('✅ ========== REDIRECCIÓN EXITOSA ==========');
            return { success: true, serverType: serverInfo.serverType, url: redirectUrl };
        }

        console.log('❌ No se pudo obtener URL de redirección');
        return { success: false, reason: 'no_url' };
    },

    showDownloadPage: function() {
        if (typeof router !== 'undefined') {
            router.go('/print-server');
        } else {
            window.location.hash = '#/print-server';
        }
    },

    updateUIStatus: function(elementId, serverInfo) {
        const element = document.getElementById(elementId);
        if (!element) return;

        if (serverInfo.installed) {
            element.innerHTML = `
                <div class="server-status online">
                    <span class="status-icon">✓</span>
                    <span>Servidor de impresión detectado (${serverInfo.serverType === 'new' ? 'Nueva versión' : 'Laragon'})</span>
                </div>`;
        } else {
            element.innerHTML = `
                <div class="server-status offline">
                    <span class="status-icon">✗</span>
                    <span>No se detectó servidor de impresión</span>
                </div>`;
        }
    }
};

async function searchAndRedirectPrintServer(openInNewWindow = true) {
    return await PrintServerDetector.redirectToServer(openInNewWindow);
}

async function checkPrintServerStatus() {
    return await PrintServerDetector.detectInstalledServer();
}
