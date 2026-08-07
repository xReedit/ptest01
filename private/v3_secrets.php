<?php
// =============================================================================
// Secretos de la UI v3 (Svelte + Bun) — NO commitear.
// Consumido por bdphp/log.php (case -4001) para emitir tokens SSO firmados.
// Los mismos valores viven en D:\Projects\proyectos svelte\restobar-v3\.env
// para que SvelteKit verifique.
// =============================================================================

/**
 * Secret compartido HMAC-SHA256 entre este PHP y restobar-v3/apps/panel (/sso).
 * Debe ser identico a V3_SHARED_SECRET en restobar-v3/.env.
 * Rotar coordinadamente en ambos lados.
 */
const V3_SHARED_SECRET = 'dev_v3_shared_secret_change_before_prod_b8f2e5a9c1d4f7e3';

/**
 * URL publica del panel v3 (donde corre Bun + SvelteKit).
 * Dev: http://localhost:5174 (asume browser en la misma maquina del dev server)
 * LAN dev: http://<ip-maquina-dev>:5174
 * Prod: http(s)://<host>:<port>
 */
const V3_URL = 'http://localhost:5177';
