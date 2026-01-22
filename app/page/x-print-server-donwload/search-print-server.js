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
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000);
            
            const response = await fetch(this.NEW_SERVER_PING, {
                method: 'GET',
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.status === 'online') {
                    return {
                        installed: true,
                        version: data.version || '1.0.0',
                        hostname: data.hostname || '',
                        isConfigured: data.isConfigured || false,
                        serverType: 'new'
                    };
                }
            }
        } catch (e) {
            console.log('Servidor nuevo no detectado:', e.message);
        }
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
            
            const response = await fetch(baseUrl + '/api/test', {
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
        console.log('Buscando servidor de impresión instalado...');
        
        const newServerResult = await this.checkNewServer();
        if (newServerResult.installed) {
            console.log('Servidor NUEVO detectado:', newServerResult);
            return newServerResult;
        }

        const laragonResult = await this.checkLaragonServer();
        if (laragonResult.installed) {
            console.log('Servidor LARAGON detectado:', laragonResult);
            return laragonResult;
        }

        console.log('No se detectó ningún servidor de impresión instalado');
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
        const serverInfo = await this.detectInstalledServer();

        if (!serverInfo.installed) {
            this.showDownloadPage();
            return { success: false, reason: 'no_server' };
        }

        const redirectUrl = this.getRedirectUrl(serverInfo);
        
        if (redirectUrl) {
            if (openInNewWindow) {
                window.open(redirectUrl, 'Servidor de Impresion');
            } else {
                window.location.href = redirectUrl;
            }
            return { success: true, serverType: serverInfo.serverType, url: redirectUrl };
        }

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
