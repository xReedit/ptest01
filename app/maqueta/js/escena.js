// Escena 3D de la maqueta del salon (spec docs/superpowers/specs/2026-10-31-maqueta-salon-3d-design.md §5.4-§5.6),
// la misma para el editor ("Ver en 3D") y la vista en vivo de Control de pedidos. Portada del prototipo aprobado
// (docs/superpowers/specs/2026-10-31-maqueta-salon-3d-prototipo.html); la geometria esta en piezas3d.js.
// Rendimiento como el prototipo: geometria junta por material, sombras calculadas una vez, se dibuja solo cuando
// algo cambia y la calidad baja sola en PCs lentas. Los rotulos (HTML) no van aqui: proyectar() y alCambiarVista().
import * as THREE from '../vendor/three-0.170.0/build/three.module.js';
import { OrbitControls } from '../vendor/three-0.170.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from '../vendor/three-0.170.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three-0.170.0/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from '../vendor/three-0.170.0/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from '../vendor/three-0.170.0/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from '../vendor/three-0.170.0/examples/jsm/environments/RoomEnvironment.js';
import { ajustesConDefaults, claveMesa, validarPlano } from './plano.js?v=20261102m';
import {
	CUADRO, MATERIAL_DE_AJUSTE, crearMateriales, materialAlfombra, crearArmador, armarSala, armarSillas, armarOcupantes, mesaDePieza,
	mesaSinUbicar, juntarPorMaterial, juntarPorClase, hashTexto,
} from './piezas3d.js?v=20261102m';
import { crearActor } from './actores3d.js?v=20261102m';

const LENTO_MS = 180;            // 2 cuadros de alta calidad seguidos asi de lentos → baja un nivel
const RAPIDO_MS = 90;            // 5 seguidos mas rapidos que esto → sube un nivel
const GIGANTE_MS = 4 * LENTO_MS; // el primer cuadro (compila shaders) no cuenta, salvo que tarde esto o mas
const LENTOS_PARA_BAJAR = 2, RAPIDOS_PARA_SUBIR = 5;
const NIVELES = ['baja', 'media', 'alta'];
const SOMBRA = { baja: 1024, otra: 2048 };   // lado del mapa de sombras (se recalcula con cada cambio de mesa)
const QUIETO_MS = 220;           // tras soltar, un cuadro de alta calidad
// Personas animadas (avisos de la carta): cuadros por segundo segun la calidad que midio esta PC (la de siempre:
// decidirCalidad). Gestos lentos: 20 se ven fluidos; una PC justa no gasta su tarjeta de video en la animacion.
const ANIMACION_MS = { alta: 50, media: 66, baja: 100 };
const VIAJE_MS = 650;            // irA
const RADIO_ACTOR = 30;          // esfera que envuelve a una persona animada con el brazo arriba (para ver si esta a la vista)
const LLAVE_CALIDAD = 'maq-calidad', LLAVE_TECHO = 'maq-calidad-techo';
const ALERTAS_ROJAS = ['sin_atencion', 'cuenta_abierta'];
const TINTE = { rojo: '#efc9c9', naranja: '#f1d9bb' };   // piso bajo la mesa: alerta de camara / precuenta
const NADA = Object.freeze({ gente: 0, platos: 0, cartel: false, cuenta: false, botella: false, tinte: '', contorno: false });
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- reglas (puras)

/**
 * Personas de una mesa: las que cuenta la camara; si no, las que dicen sus platos de fondo (p, personasPorPlatos);
 * si tampoco, 2 a 4 fijas por mesa (no cambian entre redibujos).
 */
function personasDe(c, clave, p) {
	if (c && Number.isInteger(c.personas) && c.personas > 0) { return c.personas; }
	return Number.isInteger(p) && p > 0 ? p : 2 + (hashTexto(clave) % 3);
}

/**
 * Que se dibuja en una mesa (§5.4). Pedido → personas con plato y vaso cada una; la camara ve gente sin pedido →
 * personas sin platos; se fueron con la cuenta abierta o por limpiar → platos sin personas; reserva → cartelito;
 * libre → nada. Piso rojo con alerta de camara, naranja con precuenta. Sin ubicar: solo el contorno.
 * @param {{m: EstadoMesa|null, c: Camara|null}|null} e
 * @param {{clave: string, sillas: number, sinUbicar: boolean}} mesa
 */
export function dibujoDe(e, mesa) {
	const m = (e && e.m) || null, c = (e && e.c) || null;
	const tinte = c && ALERTAS_ROJAS.includes(c.alerta) ? 'rojo' : m && m.precuenta ? 'naranja' : '';
	if (mesa.sinUbicar) { return { ...NADA, contorno: true, tinte }; }
	const pedido = !!m && m.ocupada && !m.reserva;
	const seFueron = !!c && (c.alerta === 'cuenta_abierta' || c.alerta === 'por_limpiar' || c.estado === 'por_limpiar');
	const genteCamara = !!c && (c.alerta === 'sin_atencion' || (c.estado === 'ocupada' && !pedido));
	const n = personasDe(c, mesa.clave, e && e.p);
	const gente = !seFueron && (pedido || genteCamara) ? Math.min(n, mesa.sillas) : 0;
	const platos = seFueron || pedido ? (mesa.sillas ? Math.min(n, mesa.sillas) : n) : 0;
	return {
		gente, platos, tinte, contorno: false,
		cartel: !!m && m.reserva,
		cuenta: platos > 0 && !!m && m.precuenta,   // portacuenta
		botella: pedido && !seFueron && hashTexto(mesa.clave) % 2 === 0,
	};
}

/** Texto corto que cambia solo si cambia lo dibujado: la mesa se rearma solo si su firma cambia. */
export function firmaDe(d) {
	return [d.gente, d.platos, +d.cartel, +d.cuenta, +d.botella, d.tinte, +d.contorno, +!!d.actor].join('|');
}

/**
 * Calidad automatica tras medir un cuadro de alta calidad: baja un nivel con 2 cuadros lentos seguidos (≥ 180 ms)
 * y sube uno con 5 rapidos seguidos (< 90 ms); un cuadro intermedio corta las dos rachas. Un solo cuadro lento
 * (p. ej. compilar shaders) no alcanza. techo: el nivel mas alto que se puede subir solo; al bajar por lento, el
 * techo queda en el nivel nuevo (que un nivel menor vaya rapido no dice nada del de arriba: sin esto oscilaria).
 * @param {{nivel: 'alta'|'media'|'baja', techo: 'alta'|'media'|'baja', lentos: number, rapidos: number}} estado
 * @returns {{nivel: string, techo: string, lentos: number, rapidos: number}} estado nuevo (no toca el recibido)
 */
export function decidirCalidad(estado, ms) {
	const lentos = ms >= LENTO_MS ? estado.lentos + 1 : 0, rapidos = ms < RAPIDO_MS ? estado.rapidos + 1 : 0;
	const i = NIVELES.indexOf(estado.nivel), puedeSubir = i < NIVELES.indexOf(estado.techo);
	if (lentos >= LENTOS_PARA_BAJAR) {
		const nivel = NIVELES[Math.max(0, i - 1)];
		return { nivel, techo: nivel, lentos: 0, rapidos: 0 };
	}
	if (puedeSubir && rapidos >= RAPIDOS_PARA_SUBIR) { return { nivel: NIVELES[i + 1], techo: estado.techo, lentos: 0, rapidos: 0 }; }
	return { nivel: estado.nivel, techo: estado.techo, lentos, rapidos: puedeSubir ? rapidos : 0 };
}

/**
 * Calidad al abrir, con lo recordado por la PC (localStorage; null o basura = nada recordado): sin techo, 'alta';
 * sin nivel, el techo; nunca por encima del techo.
 * @returns {{nivel: string, techo: string, lentos: 0, rapidos: 0}}
 */
export function calidadInicial(recordada, techoRecordado) {
	const techo = NIVELES.includes(techoRecordado) ? techoRecordado : 'alta';
	const nivel = NIVELES.includes(recordada) ? recordada : techo;
	return { nivel: NIVELES[Math.min(NIVELES.indexOf(nivel), NIVELES.indexOf(techo))], techo, lentos: 0, rapidos: 0 };
}

/**
 * Mide cuanto tarda el GPU en terminar un cuadro sin bloquear la pagina (gl.finish() en Chrome no espera; readPixels
 * si, pero congela la pantalla de cobro lo que tarde el cuadro): una cerca de WebGL 2 (fenceSync) que se consulta en
 * cada vuelta del bucle de eventos. Un cuadro nuevo descarta la medicion pendiente: dos cuadros solapados no se miden.
 * Sin cerca (fenceSync da null) o con el contexto perdido, no hay medicion.
 * @param {WebGL2RenderingContext} gl
 * @param {{esperar?: (fn: Function) => void, ahora?: () => number}} [reloj] para las pruebas
 */
export function crearMedidor(gl, { esperar = fn => setTimeout(fn, 0), ahora = () => performance.now() } = {}) {
	let turno = 0;
	return {
		/** Empieza un cuadro: lo que estaba esperando ya no vale. */
		descartar() { turno++; },
		/** Recien dibujado el cuadro que empezo en desde (ms de ahora()): alMedir(ms) cuando el GPU lo termine. */
		medir(desde, alMedir) {
			const mio = ++turno;
			const cerca = gl.isContextLost() ? null : gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
			if (!cerca) { return; }
			gl.flush();   // sin flush la cerca podria no llegar nunca al GPU
			const sondear = () => {
				if (mio !== turno || gl.isContextLost()) { gl.deleteSync(cerca); return; }
				if (gl.getSyncParameter(cerca, gl.SYNC_STATUS) !== gl.SIGNALED) { esperar(sondear); return; }
				gl.deleteSync(cerca);
				alMedir(ahora() - desde);
			};
			esperar(sondear);
		},
	};
}

// ---------------------------------------------------------------- apoyo

// failIfMajorPerformanceCaveat: sin tarjeta de video activa (chrome://gpu "Software only") el navegador no da contexto y
// la caja se queda con las tarjetas; dibujar por software traba toda la pagina en cada cuadro.
export function contextoWebGL(canvas) {
	try {
		return canvas.getContext('webgl2', { antialias: true, powerPreference: 'low-power', alpha: false, stencil: false, failIfMajorPerformanceCaveat: true });
	} catch {
		return null;
	}
}

function leerGuardado(llave) {
	try { return localStorage.getItem(llave); } catch { return null; }
}
function guardar(llave, nivel) {
	try { localStorage.setItem(llave, nivel); } catch { /* sin localStorage: se vuelve a medir en la proxima carga */ }
}

// Piso con baldosas muy tenues: gris claro sobre blanco, el color del piso las tiñe.
function texturaBaldosas(PW, PD) {
	const c = document.createElement('canvas');
	c.width = c.height = 256;
	const g = c.getContext('2d');
	g.fillStyle = '#fff';
	g.fillRect(0, 0, 256, 256);
	g.strokeStyle = 'rgba(0,0,0,.07)';
	g.lineWidth = 2;
	g.strokeRect(1, 1, 254, 254);
	const t = new THREE.CanvasTexture(c);
	t.wrapS = t.wrapT = THREE.RepeatWrapping;
	t.repeat.set(PW / 40, PD / 40);
	t.anisotropy = 8;
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
// Mancha redonda que se desvanece hacia el borde (piso de color bajo la mesa).
function texturaMancha() {
	const c = document.createElement('canvas');
	c.width = c.height = 128;
	const g = c.getContext('2d');
	const r = g.createRadialGradient(64, 64, 10, 64, 64, 64);
	r.addColorStop(0, 'rgba(255,255,255,.5)');
	r.addColorStop(0.6, 'rgba(255,255,255,.26)');
	r.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = r;
	g.fillRect(0, 0, 128, 128);
	return new THREE.CanvasTexture(c);
}

function crearLuces(scene, PW, PD) {
	const hemi = new THREE.HemisphereLight('#ffffff', '#e3e6ea', 2.3);
	const sol = new THREE.DirectionalLight('#fffaf2', 1.5);
	sol.castShadow = true;
	sol.shadow.mapSize.set(SOMBRA.otra, SOMBRA.otra);
	Object.assign(sol.shadow.camera, { left: -(PW / 2 + 240), right: PW / 2 + 240, top: PD / 2 + 260, bottom: -(PD / 2 + 260), near: 10, far: 3000 });
	sol.shadow.camera.updateProjectionMatrix();
	sol.shadow.blurSamples = 16;
	sol.shadow.bias = -0.0004;
	sol.shadow.normalBias = 0.4;
	scene.add(hemi, sol);
	// Sombras: "definidas" = sol mas fuerte y borde nitido; "largas" = sol mas bajo.
	function aplicar(a) {
		const t = a.sombraNitida / 100, l = a.sombraLargo / 100;
		sol.intensity = lerp(1.7, 3.0, t);
		hemi.intensity = lerp(1.1, 0.55, t);
		sol.shadow.intensity = lerp(0.65, 0.95, t);
		sol.shadow.radius = lerp(9, 1.5, t);
		const ang = lerp(0.12, 0.75, l);   // inclinacion del sol respecto a la vertical
		sol.position.set(-Math.sin(ang) * 700, Math.cos(ang) * 1000, Math.sin(ang) * 520);
	}
	// Lado del mapa de sombras: true si cambio (el renderer arma el mapa nuevo en el proximo calculo de sombras).
	function tamanoSombra(lado) {
		if (sol.shadow.mapSize.x === lado) { return false; }
		sol.shadow.dispose();
		sol.shadow.map = null;
		sol.shadow.mapPass = null;   // el de VSM tambien: se rearma con el tamaño nuevo
		sol.shadow.mapSize.set(lado, lado);
		return true;
	}
	return { aplicar, tamanoSombra, liberar: () => sol.shadow.dispose() };
}

/**
 * Suavizado (MSAA) dentro de la cadena de efectos, mas el sombreado de contacto (GTAO). null si la PC no puede.
 * Solo lleva MSAA el target donde dibuja RenderPass (readBuffer: needsSwap=false); el otro solo recibe copias del
 * GTAO, sin muestras (menos memoria de video). Ver dibujarConEfectos.
 */
function crearComposer(renderer, scene, camera) {
	try {
		const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }));
		composer.readBuffer.samples = 4;   // la copia (renderTarget2): se arma en la GPU al primer uso, ya con muestras
		composer.addPass(new RenderPass(scene, camera));
		const ao = new GTAOPass(scene, camera, 1, 1);
		ao.updateGtaoMaterial({ radius: 7, distanceExponent: 2, thickness: 4, scale: 1.15, samples: 16 });
		ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
		composer.addPass(ao);
		composer.addPass(new OutputPass());
		return composer;
	} catch (e) {
		console.warn('maqueta: sin sombreado de contacto', e);
		return null;
	}
}

// Velo: una cupula blanca translucida "apaga" cada mesa fuera del filtro; las del filtro llevan un recorte que
// escribe profundidad al frente (sin color) para que ningun velo las tape.
function crearMaterialesVelo() {
	const velo = new THREE.MeshBasicMaterial({ color: '#f4f5f7', transparent: true, opacity: 0.72, depthWrite: false });
	const recorte = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true, depthTest: false, transparent: true });
	recorte.onBeforeCompile = sh => {
		sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  gl_Position.z = -gl_Position.w;');
	};
	return { velo, recorte };
}

function vaciar(grupo, compartidas) {
	for (const o of grupo.children) {
		if (o.geometry && !compartidas.has(o.geometry)) { o.geometry.dispose(); }
	}
	grupo.clear();
}

// ---------------------------------------------------------------- escena

/**
 * Arma la escena del plano dentro de host (se agrega un canvas al principio). null si la PC no tiene WebGL 2 o no
 * se pudo crear el contexto: no crea nada y quien llama muestra las tarjetas de siempre.
 * soloVista: vista previa del editor, sin datos (pintarEstados y setVelo no hacen nada, codigoEn da null).
 * Si despues se pierde el contexto (driver, falta de memoria), avisa a quien se suscribio con alPerderContexto
 * (el evento 'webglcontextlost' no burbujea: se escucha en el canvas, no en host). destruir() no avisa.
 * @param {HTMLElement} host contenedor con tamaño (position relativa si lleva rotulos encima)
 * @param {object} plano Plano (constraints.md); se valida con validarPlano
 * @param {{soloVista?: boolean}} [opts]
 * @returns {object|null} Escena
 */
export function crearEscena(host, plano, opts = {}) {
	const valido = validarPlano(plano);
	if (!valido.ok) { throw new TypeError(`maqueta: plano invalido (${valido.error})`); }
	const canvas = document.createElement('canvas');
	const gl = contextoWebGL(canvas);
	if (!gl) { return null; }
	let renderer;
	try {
		renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true });
	} catch (e) {
		console.warn('maqueta: no se pudo crear el dibujo 3D', e);
		return null;
	}
	return montar(host, valido.plano, renderer, !!(opts && opts.soloVista));
}

// plano → mundo (x, z): el centro del salon queda en el origen
const aMundo = plano => (x, y) => [x - (plano.ancho * CUADRO) / 2, y - (plano.fondo * CUADRO) / 2];

// Renderer como el prototipo (sombras VSM calculadas a pedido, tono neutro) y la escena con su luz de estudio.
function prepararEscena(host, renderer) {
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.VSMShadowMap;   // sombras difusas, como luz de techo
	renderer.shadowMap.autoUpdate = false;          // solo si cambia algo del salon, no al mover la camara
	renderer.toneMapping = THREE.NeutralToneMapping;
	renderer.toneMappingExposure = 1.05;
	renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
	host.prepend(renderer.domElement);
	const scene = new THREE.Scene();
	scene.background = new THREE.Color('#f6f7f9');
	const pmrem = new THREE.PMREMGenerator(renderer), ambiente = new RoomEnvironment();
	const luzAmbiente = pmrem.fromScene(ambiente, 0.04);   // render target: se libera en destruir
	scene.environment = luzAmbiente.texture;
	ambiente.dispose();
	pmrem.dispose();
	scene.environmentIntensity = 0.35;
	return { scene, luzAmbiente };
}

// Materiales, texturas y geometrias que se reutilizan, y su liberacion.
function crearRecursos(plano) {
	const baldosas = texturaBaldosas(plano.ancho * CUADRO, plano.fondo * CUADRO), mancha = texturaMancha();
	const R = {
		MAT: crearMateriales(baldosas),
		OCUP: {   // lo de las mesas lleva el color en los vertices (juntarPorClase)
			mate: new THREE.MeshStandardMaterial({ roughness: 0.85, vertexColors: true }),
			brillo: new THREE.MeshStandardMaterial({ roughness: 0.35, vertexColors: true }),
			vidrio: new THREE.MeshStandardMaterial({ roughness: 0.1, vertexColors: true, transparent: true, opacity: 0.55 }),
		},
		TINTES: Object.fromEntries(Object.entries(TINTE).map(([k, color]) => [k,
			new THREE.MeshStandardMaterial({ color, roughness: 1, alphaMap: mancha, transparent: true, depthWrite: false })])),
		VELO: crearMaterialesVelo(),
		INVISIBLE: new THREE.MeshBasicMaterial(),
		DISCO: new THREE.CircleGeometry(1, 48),
		CILINDRO: new THREE.CylinderGeometry(1, 1, 1, 32),
		CAJA: new THREE.BoxGeometry(1, 1, 1),
	};
	R.compartidas = new Set([R.DISCO, R.CILINDRO, R.CAJA]);
	R.liberar = () => {
		for (const g of R.compartidas) { g.dispose(); }
		const materiales = [...Object.values(R.MAT), ...Object.values(R.OCUP), ...Object.values(R.TINTES), R.VELO.velo, R.VELO.recorte, R.INVISIBLE];
		for (const m of materiales) { m.dispose(); }
		baldosas.dispose();
		mancha.dispose();
	};
	return R;
}

// Pone mallas (una por material o por clase) en el grupo.
function agregar(grupo, piezas, materialDe) {
	for (const { mat, clase, geo } of piezas) {
		const malla = new THREE.Mesh(geo, materialDe(mat || clase));
		malla.castShadow = mat !== 'floor';
		malla.receiveShadow = true;
		grupo.add(malla);
	}
}

/**
 * El salon: lo fijo (junto por material), las sillas (aparte, para cambiar el modelo) y por cada mesa lo que cambia
 * con su estado (se rearma solo si cambia su firma), las mesas sin ubicar, el velo y los volumenes para el raton.
 */
function crearSalon(plano, scene, R, sombrasSucias) {
	const W = aMundo(plano), arm = crearArmador(plano.ancho * CUADRO, plano.fondo * CUADRO);
	const estatico = new THREE.Group(), sillas = new THREE.Group(), ocupantes = new THREE.Group(), velo = new THREE.Group();
	scene.add(estatico, sillas, ocupantes, velo);
	const registro = new Map();   // clave → { mesa, golpe, grupo, firma, lugar }
	const actores = new Map(), conActores = new THREE.Group();   // clave → persona animada (actores3d.js)
	const vista = new THREE.Frustum(), matrizVista = new THREE.Matrix4(), esfera = new THREE.Sphere();
	scene.add(conActores);
	let ultimaLista = [];
	const entradaDe = (mesa, lugar = '') => {
		const golpe = new THREE.Mesh(R.CAJA, R.INVISIBLE);   // volumen invisible del tablero, para codigoEn
		const [wx, wz] = W(mesa.cx, mesa.cy);
		golpe.position.set(wx, mesa.alto / 2, wz);
		golpe.scale.set(mesa.w, mesa.alto, mesa.d);
		golpe.updateMatrixWorld();
		golpe.userData.clave = mesa.clave;
		return { mesa, golpe, grupo: null, firma: firmaDe(NADA), lugar };
	};
	for (const pz of plano.piezas.filter(p => p.t === 'mesa')) {
		const mesa = mesaDePieza(pz);
		registro.set(mesa.clave, entradaDe(mesa));
	}
	const mesasFijas = () => [...registro.values()].filter(e => !e.mesa.sinUbicar).map(e => e.mesa);
	armarSala(arm, plano, mesasFijas());
	// cada color de alfombra es un material mas (se libera con los demas de R.MAT)
	agregar(estatico, juntarPorMaterial(arm.tomar()), k => R.MAT[k] || (R.MAT[k] = materialAlfombra(k)));

	function armarTodasLasSillas(modelo) {
		vaciar(sillas, R.compartidas);
		armarSillas(arm, mesasFijas(), modelo);
		agregar(sillas, juntarPorMaterial(arm.tomar()), k => R.MAT[k]);
		sombrasSucias();
	}

	function quitarOcupantes(ent) {
		if (!ent.grupo) { return; }
		vaciar(ent.grupo, R.compartidas);
		ocupantes.remove(ent.grupo);
		ent.grupo = null;
	}
	function rearmar(ent, dibujo) {
		quitarOcupantes(ent);
		const g = new THREE.Group(), { mesa } = ent;
		armarOcupantes(arm, mesa, dibujo);
		agregar(g, juntarPorClase(arm.tomar(), R.MAT), k => R.OCUP[k]);
		if (dibujo.tinte) {
			const disco = new THREE.Mesh(R.DISCO, R.TINTES[dibujo.tinte]);
			const [wx, wz] = W(mesa.cx, mesa.cy);
			disco.rotation.x = -Math.PI / 2;
			disco.position.set(wx, 0.15, wz);
			disco.scale.set(mesa.w / 2 + 18, mesa.d / 2 + 18, 1);
			disco.receiveShadow = true;
			g.add(disco);
		}
		if (g.children.length) { ocupantes.add(g); ent.grupo = g; }
	}

	// Mesas sin ubicar (§6.3): llegan en cada pintarEstados; se agregan, se mueven o se quitan del registro.
	const enArea = (x, y) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < plano.ancho && y < plano.fondo;
	function ponerSinUbicar(porClave) {
		let cambio = false;
		for (const [clave, ent] of registro) {
			const e = porClave.get(clave);
			if (ent.mesa.sinUbicar && !(e && e.sinUbicar && ent.lugar === `${e.x},${e.y}`)) {
				quitarOcupantes(ent);
				registro.delete(clave);
				cambio = true;
			}
		}
		for (const [clave, e] of porClave) {
			if (!e.sinUbicar || registro.has(clave) || !enArea(e.x, e.y)) { continue; }
			registro.set(clave, entradaDe(mesaSinUbicar(codigoDe(e), e.x, e.y), `${e.x},${e.y}`));
			cambio = true;
		}
		return cambio;
	}

	// Velo de los filtros: cupula sobre las mesas de afuera, recorte sobre las de adentro.
	let visibles = null;
	function pintarVelo() {
		velo.clear();
		if (!visibles) { return; }
		for (const { mesa } of registro.values()) {
			const dentro = visibles.has(mesa.clave);
			const v = new THREE.Mesh(R.CILINDRO, dentro ? R.VELO.recorte : R.VELO.velo);
			const borde = dentro ? 21 : 25, alto = mesa.alto + 21;   // cubre sillas y personas
			const [wx, wz] = W(mesa.cx, mesa.cy);
			v.renderOrder = dentro ? 1 : 2;   // primero los recortes, despues los velos
			v.scale.set(mesa.w / 2 + borde, alto, mesa.d / 2 + borde);
			v.position.set(wx, alto / 2, wz);
			velo.add(v);
		}
	}

	/** true si algo cambio. */
	function pintar(lista) {
		ultimaLista = lista;
		const porClave = new Map();
		for (const e of lista) {
			const codigo = codigoDe(e);
			if (codigo) { porClave.set(claveMesa(codigo), e); }
		}
		const movidas = ponerSinUbicar(porClave);
		let cambio = movidas;
		for (const [clave, ent] of registro) {
			const base = dibujoDe(porClave.get(clave) || null, { clave, sillas: ent.mesa.puestos.length, sinUbicar: ent.mesa.sinUbicar });
			const dibujo = actores.has(clave) ? { ...base, actor: true } : base;
			const firma = firmaDe(dibujo);
			if (firma === ent.firma) { continue; }
			rearmar(ent, dibujo);
			ent.firma = firma;
			cambio = true;
		}
		if (movidas && visibles) { pintarVelo(); }
		if (cambio) { sombrasSucias(); }
		return cambio;
	}

	/**
	 * Personas animadas: [{codigo, tipo}] (avisos de la carta). Cambia solo lo que cambio; la mesa con persona animada
	 * se rearma sin su persona fija del puesto 0. true si algo cambio.
	 */
	function setActores(lista) {
		const quiero = new Map();
		for (const a of Array.isArray(lista) ? lista : []) {
			const ent = a && registro.get(claveMesa(a.codigo));
			if (ent && !ent.mesa.sinUbicar && !quiero.has(ent.mesa.clave)) { quiero.set(ent.mesa.clave, a.tipo); }
		}
		let cambio = false;
		for (const [clave, act] of actores) {
			if (quiero.get(clave) === act.tipo) { continue; }
			act.liberar();
			actores.delete(clave);
			cambio = true;
		}
		for (const [clave, tipo] of quiero) {
			if (actores.has(clave)) { continue; }
			const act = crearActor(registro.get(clave).mesa, tipo, R, W);
			if (!act) { continue; }
			conActores.add(act.grupo);
			actores.set(clave, act);
			cambio = true;
		}
		if (cambio) { pintar(ultimaLista); sombrasSucias(); }
		return cambio;
	}

	return {
		pintar,
		setActores,
		hayActores: () => actores.size > 0,
		hayActorVisible(camera) {
			camera.updateMatrixWorld();
			vista.setFromProjectionMatrix(matrizVista.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
			for (const act of actores.values()) {
				esfera.center.copy(act.grupo.position).y += RADIO_ACTOR;   // de la silla a la mano en alto
				esfera.radius = RADIO_ACTOR;
				if (vista.intersectsSphere(esfera)) { return true; }
			}
			return false;
		},
		animarActores: t => { for (const act of actores.values()) { act.animar(t); } },
		armarSillas: armarTodasLasSillas,
		setVelo(v) { visibles = v instanceof Set ? new Set([...v].map(claveMesa)) : null; pintarVelo(); },
		hayVelo: () => !!visibles,
		mesa: codigo => { const ent = registro.get(claveMesa(codigo)); return ent ? ent.mesa : null; },
		golpes: () => [...registro.values()].map(e => e.golpe),
		codigoDeGolpe: obj => registro.get(obj.userData.clave).mesa.codigo,
		triangulos() {
			let n = 0;
			for (const g of [estatico, sillas, ocupantes]) { g.traverse(o => { if (o.isMesh) { n += o.geometry.attributes.position.count / 3; } }); }
			return n;
		},
		liberar() {
			for (const act of actores.values()) { act.liberar(); }
			actores.clear();
			scene.traverse(o => { if (o.isMesh && !R.compartidas.has(o.geometry)) { o.geometry.dispose(); } });
			registro.clear();
		},
	};
}

/** Agrega fn a la lista; devuelve la funcion que la quita. */
function suscribir(lista, fn) {
	if (typeof fn !== 'function') { return () => {}; }
	lista.push(fn);
	return () => { const i = lista.indexOf(fn); if (i >= 0) { lista.splice(i, 1); } };
}

/**
 * El tono neutro de three (NeutralToneMapping, el de renderer.toneMapping) sobre un color lineal [r, g, b]. El cuadro
 * de alta calidad pasa todo por OutputPass, fondo incluido; el cuadro rapido pinta el fondo sin tono. Para que el
 * fondo no parpadee al mover y soltar, el cuadro rapido usa el fondo ya con este tono.
 */
export function tonoNeutro([r0, g0, b0], exposicion = 1) {
	const inicio = 0.8 - 0.04, desaturar = 0.15;
	let c = [r0, g0, b0].map(v => v * exposicion);
	const x = Math.min(...c), corrimiento = x < 0.08 ? x - 6.25 * x * x : 0.04;
	c = c.map(v => v - corrimiento);
	const pico = Math.max(...c);
	if (pico < inicio) { return c; }
	const d = 1 - inicio, nuevo = 1 - (d * d) / (pico + d - inicio);
	c = c.map(v => (v * nuevo) / pico);
	const k = 1 - 1 / (desaturar * (pico - nuevo) + 1);
	return c.map(v => v + (nuevo - v) * k);
}

// RenderPass dibuja en readBuffer, el unico target con MSAA (crearComposer). GTAO y OutputPass intercambian los
// buffers una vez cada uno, asi que cada cuadro empieza igual; si la cadena cambiara, aqui se vuelve a poner.
function dibujarConEfectos(composer) {
	if (!composer.readBuffer.samples) { composer.swapBuffers(); }
	composer.render();
}

/**
 * Dibujo a pedido (nada de 60 fps). Mientras se mueve: resolucion normal sin sombreado de contacto; QUIETO_MS despues
 * de soltar, un cuadro de alta calidad (MSAA + GTAO + resolucion ×1,5). La calidad se ajusta sola con decidirCalidad
 * (baja: primero la resolucion, luego el sombreado; sube cuando sobra, hasta el techo) y se recuerda por PC.
 * El cuadro alto se mide con crearMedidor (sin bloquear); alCambiarNivel(nivel) avisa cada cambio de nivel.
 */
function crearDibujo(host, renderer, scene, camera, composer, conVelo, alCambiarNivel) {
	const oyentes = [], medidor = crearMedidor(renderer.getContext());
	const LO = Math.min(devicePixelRatio, 1.25), MAXIMO = Math.max(LO, Math.min(devicePixelRatio * 1.5, 1.5));
	const HI_DE = { alta: MAXIMO, media: LO, baja: LO };   // media: GTAO sin subir la resolucion; baja: sin GTAO
	let calidad = calidadInicial(leerGuardado(LLAVE_CALIDAD), leerGuardado(LLAVE_TECHO));
	let ratio = 0, espera = 0, alta = false, encolado = 0, detenido = false, medible = false;
	const hi = () => HI_DE[calidad.nivel];
	// el mismo fondo en los dos caminos (tonoNeutro): sin esto parpadea mas claro al mover y vuelve al soltar
	const fondo = scene.background, fondoConTono = new THREE.Color().fromArray(tonoNeutro(fondo.toArray(), renderer.toneMappingExposure));
	// El composer solo dibuja los cuadros altos: sus buffers quedan siempre a la resolucion HI (no se rearman al mover).
	if (composer) { composer.setPixelRatio(hi()); }

	// El primer cuadro alto tras crear, redimensionar o cambiar de nivel compila shaders y arma buffers: no cuenta,
	// salvo que sea gigante (la PC no da ni para eso: cuenta como lento).
	function alMedir(ms, calentando) {
		if (detenido || (calentando && ms < GIGANTE_MS)) { return; }
		const antes = calidad;
		calidad = decidirCalidad(antes, ms);
		if (calidad.techo !== antes.techo) { guardar(LLAVE_TECHO, calidad.techo); }
		if (calidad.nivel === antes.nivel) { return; }
		medible = false;
		if (composer) { composer.setPixelRatio(hi()); }
		guardar(LLAVE_CALIDAD, calidad.nivel);
		alCambiarNivel(calidad.nivel);
	}
	function ajustarTamano() {
		const w = host.clientWidth, h = host.clientHeight;
		if (!w || !h) { return; }
		renderer.setSize(w, h, false);
		if (composer) { composer.setSize(w, h); }
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
		medible = false;
	}
	function setRatio(r) {
		if (r === ratio) { return; }
		ratio = r;
		renderer.setPixelRatio(r);   // solo el canvas
	}
	function cuadro() {
		encolado = 0;
		medidor.descartar();   // la medicion del cuadro anterior se solaparia con este
		const t0 = performance.now();
		const conComposer = alta && calidad.nivel !== 'baja' && composer && !conVelo();   // sin GTAO con velo
		scene.background = conComposer ? fondo : fondoConTono;
		if (conComposer) { dibujarConEfectos(composer); } else { renderer.render(scene, camera); }
		if (alta) {
			const calentando = !medible;
			medible = true;
			medidor.medir(t0, ms => alMedir(ms, calentando));
		}
		for (const fn of [...oyentes]) { fn(); }
	}
	// Un cuadro de las personas animadas: como el ultimo dibujado (misma calidad), sin medir ni avisar a los rotulos
	// (la camara no se movio). Si ya hay un cuadro en cola, ese lo dibuja.
	function cuadroAnimado() {
		if (detenido || encolado || !host.clientWidth || !host.clientHeight) { return; }
		const conComposer = alta && calidad.nivel !== 'baja' && composer && !conVelo();
		scene.background = conComposer ? fondo : fondoConTono;
		if (conComposer) { dibujarConEfectos(composer); } else { renderer.render(scene, camera); }
	}
	function dibujar(quieto = false) {
		if (detenido) { return; }
		clearTimeout(espera);
		if (!quieto) {
			alta = false;
			setRatio(LO);
			espera = setTimeout(() => { alta = true; setRatio(hi()); dibujar(true); }, QUIETO_MS);
		}
		if (!encolado) { encolado = requestAnimationFrame(cuadro); }
	}
	// En este mismo cuadro, sin esperar requestAnimationFrame: al cambiar de tamaño el canvas queda borrado (negro)
	// hasta el siguiente cuadro, y se ve al abrir o cerrar el menu lateral.
	function dibujarYa() {
		dibujar();
		if (detenido || !encolado || !host.clientWidth || !host.clientHeight) { return; }
		cancelAnimationFrame(encolado);
		cuadro();
	}
	return {
		dibujar,
		dibujarYa,
		cuadroAnimado,
		ajustarTamano,
		calidad: () => calidad.nivel,
		alCambiar: fn => suscribir(oyentes, fn),
		detener() { detenido = true; medidor.descartar(); clearTimeout(espera); cancelAnimationFrame(encolado); oyentes.length = 0; },
	};
}

/** Camara: controles (arrastrar mueve, rueda acerca, giro limitado), encuadre, viajes, vista guardada y raton. */
function crearCamara(host, canvas, camera, plano, salon, dibujar) {
	const PW = plano.ancho * CUADRO, PD = plano.fondo * CUADRO, W = aMundo(plano);
	const controls = new OrbitControls(camera, canvas);
	controls.enableDamping = false;
	controls.minPolarAngle = 0.35;
	controls.maxPolarAngle = 1.05;
	// giro libre alrededor del salon: clic derecho, Ctrl/Shift + arrastrar (OrbitControls cambia mover ↔ girar) o el
	// modo "girar" de la barra (setModo)
	controls.screenSpacePanning = true;
	controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
	controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
	controls.addEventListener('change', () => dibujar());
	// Lo mas lejos que se puede alejar: el salon entero siempre queda antes de far.
	const lejos = Math.max(3000, 4 * Math.max(PW, PD));
	camera.far = lejos * 2;
	camera.updateProjectionMatrix();
	controls.minDistance = 120;   // una mesa llena la vista
	controls.maxDistance = lejos;
	let pendiente = false, viaje = 0, finViaje = null;

	// Vista inclinada (~53°) de frente: la camara mas cerca desde la que entra todo el salon.
	function encuadrar() {
		if (!host.clientWidth || !host.clientHeight) { pendiente = true; return; }   // al tener tamaño
		pendiente = false;
		const inclinacion = 0.92;
		controls.target.set(0, 0, 30);
		const esquinas = [[-PW / 2, 0, -PD / 2], [PW / 2, 0, -PD / 2], [PW / 2, 0, PD / 2 + 8], [-PW / 2, 0, PD / 2 + 8], [-PW / 2, 40, -PD / 2], [PW / 2, 40, -PD / 2]]
			.map(p => new THREE.Vector3(...p));
		const poner = d => {
			camera.position.set(0, Math.sin(inclinacion) * d, Math.cos(inclinacion) * d + 18);
			camera.lookAt(controls.target);
			camera.updateMatrixWorld();
		};
		const fuera = () => esquinas.some(c => { const p = c.clone().project(camera); return Math.abs(p.x) > 0.97 || p.y > 0.95 || p.y < -0.97; });
		let d = lejos;
		for (; d > 300; d -= 10) {
			poner(d);
			if (fuera()) { d += 10; break; }
		}
		poner(d);
		controls.update();
		dibujar();
	}

	function terminarViaje() {
		cancelAnimationFrame(viaje);
		viaje = 0;
		if (finViaje) { const fin = finViaje; finViaje = null; fin(); }
	}
	// Viaja a la mesa: se acerca a ella y sus vecinas con la misma inclinacion.
	function irA(codigo) {
		const mesa = salon.mesa(codigo);
		if (!mesa) { return Promise.resolve(); }
		terminarViaje();
		const [wx, wz] = W(mesa.cx, mesa.cy);
		const t0 = controls.target.clone(), p0 = camera.position.clone();
		const t1 = new THREE.Vector3(wx, 0, wz + 10);
		const p1 = t1.clone().add(p0.clone().sub(t0).setLength(300));
		const inicio = performance.now();
		return new Promise(resolve => {
			finViaje = resolve;
			const paso = ahora => {
				const k = Math.min(1, (ahora - inicio) / VIAJE_MS), ez = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
				controls.target.lerpVectors(t0, t1, ez);
				camera.position.lerpVectors(p0, p1, ez);
				controls.update();
				if (k < 1) { viaje = requestAnimationFrame(paso); } else { terminarViaje(); }
			};
			viaje = requestAnimationFrame(paso);
		});
	}

	/** Que hace arrastrar con el boton izquierdo (o un dedo): 'mover' el salon o 'girar' la vista. Con Ctrl, lo otro. */
	function setModo(modo) {
		const girar = modo === 'girar';
		controls.mouseButtons.LEFT = girar ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
		controls.touches.ONE = girar ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
	}

	function zoom(f) {
		if (!Number.isFinite(f) || f <= 0) { return; }
		const desde = camera.position.clone().sub(controls.target);
		const d = Math.min(controls.maxDistance, Math.max(controls.minDistance, desde.length() * f));
		camera.position.copy(controls.target).add(desde.setLength(d));
		controls.update();
	}

	const tresNumeros = v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite);
	function setVista(v) {
		if (!v || !tresNumeros(v.p) || !tresNumeros(v.t)) { encuadrar(); return; }
		pendiente = false;   // una vista guardada manda sobre el encuadre que esperaba tamaño
		camera.position.fromArray(v.p);
		controls.target.fromArray(v.t);
		controls.update();
		dibujar();
	}

	/** Centro del tablero en pixeles de host y lo que mide la mesa a lo ancho en pantalla. null si no esta o queda detras. */
	function proyectar(codigo) {
		const mesa = salon.mesa(codigo);
		if (!mesa) { return null; }
		const w = host.clientWidth, h = host.clientHeight, [wx, wz] = W(mesa.cx, mesa.cy);
		camera.updateMatrixWorld();
		const en = x => new THREE.Vector3(x, mesa.alto, wz).project(camera);
		const c = en(wx);
		if (c.z > 1 || c.z < -1) { return null; }
		const izq = en(wx - mesa.w / 2), der = en(wx + mesa.w / 2);
		return { x: ((c.x + 1) / 2) * w, y: ((1 - c.y) / 2) * h, px: Math.hypot(((der.x - izq.x) / 2) * w, ((der.y - izq.y) / 2) * h) };
	}

	const rayo = new THREE.Raycaster(), puntero = new THREE.Vector2();
	function codigoEn(clientX, clientY) {
		const r = canvas.getBoundingClientRect();
		if (!r.width || !r.height || clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) { return null; }
		puntero.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
		camera.updateMatrixWorld();
		rayo.setFromCamera(puntero, camera);
		const golpe = rayo.intersectObjects(salon.golpes(), false)[0];
		return golpe ? salon.codigoDeGolpe(golpe.object) : null;
	}

	return {
		encuadrar, irA, setModo, zoom, setVista, proyectar, codigoEn,
		vista: () => ({ p: camera.position.toArray(), t: controls.target.toArray() }),
		alCambiarTamano() { if (pendiente) { encuadrar(); } else { dibujar(); } },
		detener() { terminarViaje(); controls.dispose(); },
	};
}

function montar(host, plano, renderer, soloVista) {
	const { scene, luzAmbiente } = prepararEscena(host, renderer);
	const camera = new THREE.PerspectiveCamera(26, 1, 10, 6000);
	const luces = crearLuces(scene, plano.ancho * CUADRO, plano.fondo * CUADRO);
	const composer = crearComposer(renderer, scene, camera);
	const R = crearRecursos(plano);
	const sombrasSucias = () => { renderer.shadowMap.needsUpdate = true; };
	const salon = crearSalon(plano, scene, R, sombrasSucias);
	// En 'baja' las sombras (se recalculan con cada cambio de mesa) van con un mapa de 1024 en vez de 2048.
	const sombraDe = nivel => { if (luces.tamanoSombra(nivel === 'baja' ? SOMBRA.baja : SOMBRA.otra)) { sombrasSucias(); } };
	const dib = crearDibujo(host, renderer, scene, camera, composer, salon.hayVelo, sombraDe);
	sombraDe(dib.calidad());
	const cam = crearCamara(host, renderer.domElement, camera, plano, salon, dib.dibujar);
	let ajustes = null, destruida = false, animando = 0, ultimoCuadro = 0;
	const perdidas = [];
	// Mientras haya personas animadas: ~25 cuadros por segundo (se detiene solo cuando no queda ninguna).
	function paso(ms) {
		animando = 0;
		if (destruida || !salon.hayActores()) { return; }
		if (ms - ultimoCuadro >= (ANIMACION_MS[dib.calidad()] || ANIMACION_MS.baja)) {
			ultimoCuadro = ms;
			// ninguna persona animada a la vista (la camara mira otra parte del salon): no se dibuja nada
			if (salon.hayActorVisible(camera)) {
				salon.animarActores(ms / 1000);
				dib.cuadroAnimado();
			}
		}
		animando = requestAnimationFrame(paso);
	}
	const alPerder = () => { if (!destruida) { for (const fn of [...perdidas]) { fn(); } } };
	renderer.domElement.addEventListener('webglcontextlost', alPerder);

	// Colores al instante; el modelo de silla rearma solo las sillas; las sombras se recalculan una vez.
	function setAjustes(a) {
		if (destruida) { return; }
		const nuevo = ajustesConDefaults(a);
		for (const [llave, mat] of Object.entries(MATERIAL_DE_AJUSTE)) { R.MAT[mat].color.set(nuevo[llave]); }
		if (!ajustes || nuevo.modelo !== ajustes.modelo) { salon.armarSillas(nuevo.modelo); }
		if (!ajustes || nuevo.sombraNitida !== ajustes.sombraNitida || nuevo.sombraLargo !== ajustes.sombraLargo) {
			luces.aplicar(nuevo);
			sombrasSucias();
		}
		ajustes = nuevo;
		dib.dibujar();
	}

	const ro = new ResizeObserver(() => { dib.ajustarTamano(); cam.alCambiarTamano(); dib.dibujarYa(); });
	function destruir() {
		if (destruida) { return; }
		destruida = true;
		cancelAnimationFrame(animando);
		renderer.domElement.removeEventListener('webglcontextlost', alPerder);
		ro.disconnect();
		dib.detener();
		cam.detener();
		salon.liberar();
		R.liberar();
		luces.liberar();
		luzAmbiente.dispose();
		if (composer) {
			for (const p of composer.passes) { if (p.dispose) { p.dispose(); } }
			composer.dispose();
		}
		renderer.dispose();
		renderer.forceContextLoss();
		renderer.domElement.remove();
	}

	dib.ajustarTamano();
	setAjustes(plano.ajustes);
	cam.encuadrar();
	ro.observe(host);
	return Object.freeze({
		pintarEstados(lista) {
			if (soloVista || destruida || !Array.isArray(lista)) { return; }
			if (salon.pintar(lista)) { dib.dibujar(); }
		},
		setAjustes,
		/** Personas animadas de los avisos de la carta: [{codigo, tipo: 'llamado'|'pedido'|'confirmar'|'pago'}]. */
		setActores(lista) {
			if (soloVista || destruida) { return; }
			if (salon.setActores(lista)) { dib.dibujar(); }
			if (salon.hayActores() && !animando) { animando = requestAnimationFrame(paso); }
		},
		setVelo(v) {
			if (soloVista || destruida) { return; }
			salon.setVelo(v);
			dib.dibujar();
		},
		proyectar: codigo => (destruida ? null : cam.proyectar(codigo)),
		codigoEn: (x, y) => (soloVista || destruida ? null : cam.codigoEn(x, y)),
		irA: codigo => (destruida ? Promise.resolve() : cam.irA(codigo)),
		zoom: f => { if (!destruida) { cam.zoom(f); } },
		setModo: m => { if (!destruida) { cam.setModo(m); } },
		encuadrar: () => { if (!destruida) { cam.encuadrar(); } },
		vista: cam.vista,
		setVista: v => { if (!destruida) { cam.setVista(v); } },
		alCambiarVista: dib.alCambiar,   // devuelve la funcion para dejar de escuchar
		alPerderContexto: fn => suscribir(perdidas, fn),   // la PC perdio el 3D: volver a las tarjetas
		calidad: dib.calidad,
		triangulos: salon.triangulos,
		destruir,
	});
}

/** Codigo de mesa de una entrada de pintarEstados: el suyo o el de su tarjeta. '' si no trae. */
function codigoDe(e) {
	if (!e || typeof e !== 'object') { return ''; }
	const c = e.codigo != null ? e.codigo : e.m && e.m.codigo;
	return typeof c === 'string' ? c : '';
}
