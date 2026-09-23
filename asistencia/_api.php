<?php
	// Utilidades de las paginas publicas de asistencia (enrolar, marcar).
	//
	// Estas paginas las abre el CELULAR del trabajador, no el POS. No tienen
	// sesion, y por eso NO pueden pasar por SecurityGuard::verificarAcceso(),
	// que exige Referer del host propio y sesion iniciada.
	//
	// Lo que autoriza cada operacion es el codigo que viaja en la URL o el body
	// (la invitacion, el codigo del kiosko): de un solo uso y con caducidad
	// corta. El token que se firma aqui solo prueba que la llamada sale de un
	// servidor del POS, y no lleva empresa ni sede: esas se deducen del codigo.

	date_default_timezone_set('America/Lima');

	$rutaSecrets = __DIR__ . '/../private/asistencia_secrets.php';
	if (!file_exists($rutaSecrets)) {
		http_response_code(500);
		exit('El modulo de asistencia no esta configurado en este servidor.');
	}
	require_once $rutaSecrets;
	require_once __DIR__ . '/../bdphp/JWT.php';

	/** Token publico: prueba el origen, no la identidad. Vida corta. */
	function asisTokenPublico() {
		$ahora = time();
		return \Firebase\JWT\JWT::encode(
			array('pub' => 1, 'iat' => $ahora, 'exp' => $ahora + 120),
			ASISTENCIA_API_SECRET, 'HS256'
		);
	}

	/**
	 * Llama a la API central. Devuelve array('ok'=>bool, 'datos'=>..., 'error'=>string).
	 * No lanza excepciones: estas paginas las ve un trabajador apurado en la
	 * puerta del local, asi que todo camino termina en un mensaje legible.
	 */
	function asisApiPublica($ruta, $cuerpo) {
		$ch = curl_init(ASISTENCIA_API_URL . '/asistencia/publico' . $ruta);
		curl_setopt_array($ch, array(
			CURLOPT_RETURNTRANSFER => true,
			CURLOPT_POST           => true,
			CURLOPT_POSTFIELDS     => json_encode($cuerpo),
			CURLOPT_TIMEOUT        => ASISTENCIA_API_TIMEOUT,
			CURLOPT_CONNECTTIMEOUT => 5,
			CURLOPT_HTTPHEADER     => array(
				'Content-Type: application/json',
				'Authorization: Bearer ' . asisTokenPublico()
			)
		));
		$resp = curl_exec($ch);
		$http = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
		curl_close($ch);

		if ($resp === false) {
			return array('ok' => false, 'datos' => null,
				'error' => 'No hay conexion con el servidor. Avisa al administrador.');
		}
		$json = json_decode($resp, true);
		if (!is_array($json)) {
			return array('ok' => false, 'datos' => null, 'error' => 'Respuesta inesperada del servidor.');
		}
		if ($http >= 400 || empty($json['success'])) {
			// Los datos viajan tambien en el rechazo: un "no" puede traer que
			// hacer al respecto (por ejemplo, que este dia se puede habilitar).
			return array('ok' => false, 'datos' => isset($json['datos']) ? $json['datos'] : null,
				'error' => !empty($json['error']) ? $json['error'] : 'No se pudo completar la operacion.');
		}
		return array('ok' => true, 'datos' => isset($json['datos']) ? $json['datos'] : null, 'error' => '');
	}

	/** true si la pagina se esta sirviendo por HTTPS (mirando tambien el proxy). */
	function asisEsHttps() {
		if (!empty($_SERVER['HTTPS']) && strtolower($_SERVER['HTTPS']) !== 'off') { return true; }
		if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower($_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') { return true; }
		return false;
	}

	/**
	 * Guarda el token del celular como cookie.
	 * HttpOnly: el JavaScript de la pagina no puede leerla, asi que un XSS en
	 * cualquier parte del POS no se lleva la identidad del trabajador.
	 */
	function asisGuardarCookie($token, $dias) {
		$opciones = array(
			'expires'  => time() + ($dias * 86400),
			'path'     => '/',
			'httponly' => true,
			'samesite' => 'Lax',
			'secure'   => asisEsHttps()
		);
		if (PHP_VERSION_ID >= 70300) {
			setcookie('asis_dev', $token, $opciones);
		} else {
			// PHP < 7.3 no acepta el array; el samesite se cuela por el path
			setcookie('asis_dev', $token, $opciones['expires'], '/; SameSite=Lax', '', $opciones['secure'], true);
		}
	}

	function asisEsc($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
