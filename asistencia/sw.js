// Service worker del marcador de asistencia.
//
// Existe por un solo motivo: Chrome/Edge/Android exigen un service worker con
// manejador de fetch para ofrecer "Instalar app". No cachea nada a proposito.
//
// Cachear seria contraproducente aqui: el codigo del QR cambia cada 30 segundos
// y una respuesta vieja servida desde cache haria que nadie pudiera fichar. Es
// mas honesto mostrar "sin conexion" que un codigo que ya vencio.

self.addEventListener('install', function (e) { self.skipWaiting(); });

self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function (e) {
	// Passthrough puro: la red manda siempre.
	e.respondWith(fetch(e.request));
});
