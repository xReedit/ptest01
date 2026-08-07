<?php
// =============================================================================
// Secretos del modulo de almacen v2 — NO commitear.
// Consumido por bdphp/log.php (case -4000) para emitir tokens SSO firmados.
// Los mismos valores viven en v2/.env para que SvelteKit verifique.
// =============================================================================

/**
 * Secreto compartido HMAC-SHA256 entre este PHP y v2/apps/almacen (/sso).
 * Debe ser identico a ALM2_SHARED_SECRET en v2/.env.
 * Rotar coordinadamente en ambos lados.
 */
const ALM2_SHARED_SECRET = '4abde2d87339dc92b51c2e954e76dab7c33d0baeed42da9d13985cd8df8e65bc0627d76bcc7ae463432b685ebb9cdf61';

/**
 * URL publica del modulo v2 (donde corre SvelteKit).
 * Dev: http://localhost:5173 | Prod: http(s)://<host>:<port>
 */
const ALM2_URL = 'http://localhost:5173';
