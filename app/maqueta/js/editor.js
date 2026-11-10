// Editor "Armar salon" (spec docs/superpowers/specs/2026-10-31-maqueta-salon-3d-design.md §6, §8): el dueño pone
// las mesas y los adornos de cada area vistos desde arriba, elige colores y sillas, lo mira en 3D, lo guarda y
// prende la maqueta en Control de pedidos. Pagina app/maqueta/index.html?area=<titulo sin espacios>.
// Partes: editor-datos (servidor), editor-piezas (reglas puras), editor-svg (vista y arrastre), editor-3d +
// editor-panel (Ver en 3D / Personalizar), editor-ui (avisos). Aqui: estado por area, historial y botones.
// Sin permiso C1 (puedeEditar false) solo se mira: sin arrastrar, sin Guardar ni el interruptor.
import { validarPlano, ajustesConDefaults, mesasQueNoExisten, huellaDe } from './plano.js?v=20261102m';
import {
	BANDEJA, piezaDeBandeja, mesaPorColocar, lugarLibre, conSillas, SILLAS_MAX, codigosPorColocar, cercaDeAnterior,
	conTamano, armarSalon, conCodigo,
} from './editor-piezas.js?v=20261102m';
import { crearVista, miniatura } from './editor-svg.js?v=20261102m';
import { pedirPlanos, guardarPlano, activarMaqueta, pedirAreas, datosSedePOS, areasDelEditor, guardarAreas } from './editor-datos.js?v=20261102m';
import { editarAreas } from './editor-areas.js?v=20261102m';
import { aviso, dialogo, preguntar, textoDeError } from './editor-ui.js?v=20261102m';
import { abrirVista3D } from './editor-3d.js?v=20261102m';

export { aCuadro } from './editor-svg.js?v=20261102m';

const LIMITE_HISTORIAL = 50;
const AREA_NUEVA = { ancho: 60, fondo: 40 };   // cuadros: lo que mide un area que aun no tiene salon

/**
 * Pila de deshacer/rehacer. hacer(estado) guarda el estado despues de cada cambio (el primero = como se abrio);
 * deshacer() devuelve el anterior y rehacer() el siguiente, o null si no hay. Guarda y devuelve copias.
 * @param {number} [limite=50] estados que recuerda (los mas viejos se olvidan)
 */
export function crearHistorial(limite = LIMITE_HISTORIAL) {
	let pila = [], pos = -1;
	return Object.freeze({
		hacer(estado) {
			pila = [...pila.slice(0, pos + 1), structuredClone(estado)].slice(-limite);
			pos = pila.length - 1;
		},
		deshacer() {
			if (pos <= 0) { return null; }
			pos--;
			return structuredClone(pila[pos]);
		},
		rehacer() {
			if (pos >= pila.length - 1) { return null; }
			pos++;
			return structuredClone(pila[pos]);
		},
		puedeDeshacer: () => pos > 0,
		puedeRehacer: () => pos < pila.length - 1,
	});
}

const PLANTILLA = `
<div class="xMiCard xradius inv-card mqe-card">
	<div class="xEncanezadoCard inv-head">
		<div class="inv-head-top">
			<div>
				<h3>Armar salón</h3>
				<p>Arrastra las mesas y adornos como están en tu local. Así lo verá la caja en Control de pedidos.
					Para mover varias juntas, enciérralas arrastrando desde el piso libre (o Shift+clic en cada una).
					Para agrandar el salón, arrastra las manijas de su borde derecho o de abajo.</p>
			</div>
			<div class="inv-head-acciones">
				<label class="mqe-switch" data-solo-editar title="Apagado: Control de pedidos muestra las tarjetas de siempre">
					<input type="checkbox" id="mqe_activo"><span>Usar la maqueta en Control de pedidos</span>
				</label>
				<button type="button" class="btn btn-sm btn-light" data-accion="ver3d"><i class="fa fa-cube"></i> Ver en 3D</button>
				<button type="button" class="btn btn-sm btn-light" data-accion="personalizar" data-solo-editar><i class="fa fa-paint-brush"></i> Personalizar</button>
				<button type="button" class="btn btn-sm btn-success" data-accion="guardar" data-solo-editar><i class="fa fa-check"></i> Guardar</button>
			</div>
		</div>
	</div>
	<div class="xContentCard mqe-cuerpo">
		<div class="mqe-barra">
			<div class="inv-seg mqe-areas" role="tablist"></div>
			<button type="button" class="btn btn-sm btn-light" data-accion="areas" data-solo-editar title="Agregar áreas, más mesas o cambiar cómo se llaman las mesas"><i class="fa fa-pencil"></i> Áreas y mesas</button>
			<span class="mqe-sep"></span>
			<div class="mqe-grupo" data-solo-editar>
				<button type="button" class="btn btn-sm btn-light" data-accion="deshacer" title="Deshacer (Ctrl+Z)"><i class="fa fa-undo"></i> Deshacer</button>
				<button type="button" class="btn btn-sm btn-light" data-accion="rehacer" title="Rehacer (Ctrl+Y)"><i class="fa fa-repeat"></i> Rehacer</button>
			</div>
			<div class="mqe-grupo mqe-tamano" data-solo-editar>
				<span>Ancho</span><button type="button" class="btn btn-sm btn-light" data-accion="ancho-" title="Más angosto">−</button><b data-ver="ancho"></b><button type="button" class="btn btn-sm btn-light" data-accion="ancho+" title="Más ancho">+</button>
				<span>Fondo</span><button type="button" class="btn btn-sm btn-light" data-accion="fondo-" title="Menos fondo">−</button><b data-ver="fondo"></b><button type="button" class="btn btn-sm btn-light" data-accion="fondo+" title="Más fondo">+</button>
			</div>
			<button type="button" class="btn btn-sm btn-primary" data-accion="armar" data-solo-editar><i class="fa fa-th"></i> Armar con mis mesas</button>
		</div>
		<p class="mqe-nota mqe-nota-roja" data-ver="bloqueo" hidden></p>
		<p class="mqe-nota" data-ver="solo-ver" hidden>Puedes mirar el salón, pero para cambiarlo necesitas el permiso «Datos del sistema». Pídeselo al administrador.</p>
		<p class="mqe-nota mqe-nota-roja" data-ver="no-existen" hidden><span></span>
			<button type="button" class="btn btn-sm btn-light" data-accion="quitar-no-existen">Quitar del salón</button></p>
		<div class="mqe-zona">
			<aside class="mqe-bandeja" data-solo-editar></aside>
			<div class="mqe-escenario">
				<div class="mqe-acciones" hidden></div>
				<div class="mqe-vacio" hidden><div><b></b><p></p>
					<button type="button" class="btn btn-sm btn-primary" data-accion="armar" data-solo-editar><i class="fa fa-th"></i> Armar con mis mesas</button></div></div>
			</div>
			<aside class="mqe-porcolocar" data-solo-editar>
				<h4>Mesas por colocar</h4>
				<p class="mqe-ayuda">Arrástralas al salón o tócalas para ponerlas en un lugar libre.</p>
				<div class="mqe-lista"></div>
			</aside>
		</div>
	</div>
</div>`;

const TEXTO_NO_CABE = {
	choca: 'Ahí no entra: choca con otra pieza. Las mesas necesitan espacio alrededor para sus sillas.',
	fuera: 'Ahí no entra: se sale del salón. Puedes agrandarlo con Ancho y Fondo.',
};
const NO_GIRA = 'No hay lugar para girarla aquí. Muévela a un lugar con más espacio.';
const SIN_LUGAR = 'No queda lugar libre en el salón. Agrándalo con Ancho y Fondo o mueve algunas piezas.';
const PLANO_ROTO = 'Este salón guardado tiene un problema y no se puede abrir; avisa a soporte.';
const NO_ENTRAN = 'No entran todas las mesas ni con el salón al tamaño máximo. Quita algunos adornos e intenta de nuevo.';
// Colores rapidos de la alfombra (el ultimo control de la barrita elige cualquier otro).
// En grises, como el resto de la maqueta: el color fuerte queda para lo que pide accion (mesas ocupadas, alertas).
const COLORES_ALFOMBRA = [
	['#8b8580', 'Gris cálido'], ['#7b7f86', 'Gris'], ['#7f8c78', 'Césped'], ['#66705f', 'Césped oscuro'],
	['#8f7b72', 'Terracota'], ['#7d6a6f', 'Vino'], ['#b5ad9f', 'Beige'], ['#6b7684', 'Azul'],
];
const SIN_MESAS = 'Ya están en el salón todas las mesas de esta área. Para tener más, agrégalas en Configuración, en las áreas de mesas.';

// Un plano vacio y minimo: validarPlano dice si el titulo del area sirve como llave (log_maqueta lo rechazaria).
const PRUEBA_NOMBRE = { ancho: 20, fondo: 20, piezas: [], version: 0 };
const nombreValido = area => validarPlano({ ...PRUEBA_NOMBRE, area }).ok;

/**
 * Por que un area no se puede armar ('' si se puede): su titulo tiene un caracter que el servidor no acepta
 * ("Bar & Grill") o es muy largo, o lo que tiene guardado no pasa validarPlano (Guardar lo borraria).
 */
function bloqueoDe(area, guardado, valido) {
	if (!nombreValido(area)) {
		const malo = [...area].find(c => !nombreValido(c));
		return malo
			? `El nombre del área tiene un carácter que no se permite (${malo}). Cámbialo en Configuración > Áreas.`
			: 'El nombre del área es muy largo (hasta 40 letras sin contar espacios). Cámbialo en Configuración > Áreas.';
	}
	return guardado && !valido.ok ? PLANO_ROTO : '';
}

// Errores de Guardar en los que el plano pudo llegar al servidor sin que lo sepamos.
const SIN_SABER = ['sin_conexion', 'respuesta_rara'];

/**
 * Tras un Guardar fallido: ¿queda la duda de si un guardado llego? (entonces el proximo "conflicto" puede ser el
 * propio). Se marca con un error sin respuesta y no se borra con otros errores: solo al guardar bien o al recargar.
 * @param {boolean} antes la duda que ya habia
 * @param {string} codigo ErrorMaqueta.codigo del fallo
 */
export function quedaSinRespuesta(antes, codigo) {
	return antes || SIN_SABER.includes(codigo);
}

const SEP_BARRITA = 8, BORDE_BARRITA = 4;   // px entre la barrita y la pieza, y hasta el borde del escenario

/**
 * Donde va la barrita de la pieza elegida (px dentro del escenario) sin tapar la pieza ni sus manijas: encima; si no
 * entra, debajo; si no, a la derecha o a la izquierda (a media altura). Si no entra en ningun lado, arriba de todo.
 * @param {{left: number, top: number, right: number, bottom: number}} rect pieza con sus manijas, en el escenario
 * @param {{ancho: number, alto: number}} barra
 * @param {{ancho: number, alto: number}} caja el escenario
 * @returns {{x: number, y: number}}
 */
export function lugarBarrita(rect, barra, caja) {
	const s = SEP_BARRITA, b = BORDE_BARRITA;
	const enX = x => Math.max(b, Math.min(x, caja.ancho - barra.ancho - b));
	const enY = y => Math.max(b, Math.min(y, caja.alto - barra.alto - b));
	const cx = enX((rect.left + rect.right) / 2 - barra.ancho / 2), cy = enY((rect.top + rect.bottom) / 2 - barra.alto / 2);
	const arriba = rect.top - s - barra.alto, abajo = rect.bottom + s;
	const der = rect.right + s, izq = rect.left - s - barra.ancho;
	if (arriba >= b) { return { x: cx, y: arriba }; }
	if (abajo + barra.alto <= caja.alto - b) { return { x: cx, y: abajo }; }
	if (der + barra.ancho <= caja.ancho - b) { return { x: der, y: cy }; }
	if (izq >= b) { return { x: izq, y: cy }; }
	return { x: cx, y: b };
}

/** Lo que cuenta para "hay cambios sin guardar" (la version la lleva la sesion del area, no el historial). */
const firma = p => JSON.stringify([p.ancho, p.fondo, p.piezas, p.ajustes]);

function nodo(tag, clase, texto) {
	const e = document.createElement(tag);
	if (clase) { e.className = clase; }
	if (texto != null) { e.textContent = texto; }
	return e;
}

function botonAccion(accion, texto, titulo) {
	const b = nodo('button', 'btn btn-sm btn-light', texto);
	b.type = 'button';
	b.dataset.accion = accion;
	if (titulo) { b.title = titulo; }
	return b;
}

/** Monta el editor en raiz y carga los datos de la sede. */
export async function montarEditor(raiz) {
	raiz.innerHTML = PLANTILLA;
	const $ = sel => raiz.querySelector(sel);
	// seleccion: la elegida si es una sola (-1 si no); grupo: los indices cuando son varias (entonces seleccion es -1)
	const st = { areas: [], sesiones: new Map(), actual: '', seleccion: -1, grupo: [], activo: false, puedeEditar: false, ocupado: false };
	const elegidas = () => (st.grupo.length ? st.grupo : st.seleccion >= 0 ? [st.seleccion] : []);
	function elegir(indices) {
		const u = [...new Set(indices)];
		st.seleccion = u.length === 1 ? u[0] : -1;
		st.grupo = u.length > 1 ? u : [];
	}
	const vista = crearVista($('.mqe-escenario'), {
		alTocar: (i, sumar = false) => {
			const antes = elegidas();
			elegir(i === null || !editable() ? [] : !sumar ? [i] : antes.includes(i) ? antes.filter(k => k !== i) : [...antes, i]);
			pintar();
		},
		alElegirVarias: (indices, sumar) => { elegir(sumar ? [...elegidas(), ...indices] : indices); pintar(); },
		alMoverVarias: piezas => cambiar({ ...plano(), piezas }, st.grupo),
		alCambiarTamano: (ancho, fondo) => cambiar({ ...plano(), ancho, fondo }, elegidas()),
		alMover: (i, pz) => cambiar(conPieza(i, pz), i),
		alSoltarNueva: pz => agregar(pz),
		alClicNueva: pz => ponerEnLugarLibre(pz),
		alNoCabe: (p, motivo) => aviso(motivo === 'girar' ? NO_GIRA : TEXTO_NO_CABE[p], 'error'),
	});

	const sesion = () => st.sesiones.get(st.actual);
	const area = () => st.areas.find(a => a.area === st.actual);
	const plano = () => sesion().plano;
	const conPieza = (i, pz) => ({ ...plano(), piezas: plano().piezas.map((p, k) => (k === i ? pz : p)) });
	const sinCambios = s => firma(s.plano) === s.guardado;
	/** Se puede cambiar el area elegida: hay permiso C1 y el area no esta bloqueada. */
	const editable = () => st.puedeEditar && !sesion().bloqueo;

	// ------------------------------------------------------------ estado por area

	function nuevaSesion(a, guardado) {
		const valido = guardado ? validarPlano(guardado) : { ok: false };
		const base = valido.ok ? valido.plano : { ...AREA_NUEVA, piezas: [] };
		const p = { area: a.area, ancho: base.ancho, fondo: base.fondo, piezas: base.piezas, ajustes: ajustesConDefaults(base.ajustes) };
		const historial = crearHistorial();
		historial.hacer(p);
		// bloqueo: el area se mira pero no se arma ni se guarda. sinRespuesta: algun Guardar desde el ultimo que salio
		// bien quedo sin respuesta (quedaSinRespuesta).
		return {
			plano: p, historial, version: guardado ? guardado.version : 0, guardado: firma(p),
			bloqueo: bloqueoDe(a.area, guardado, valido), sinRespuesta: false,
		};
	}

	/** seleccion: el indice de la elegida, o la lista de las elegidas (-1 o [] = ninguna). */
	function cambiar(nuevo, seleccion = -1) {
		const s = sesion();
		s.plano = nuevo;
		s.historial.hacer(nuevo);
		elegir(Array.isArray(seleccion) ? seleccion : seleccion >= 0 ? [seleccion] : []);
		pintar();
	}

	const planoParaEnviar = () => ({ ...plano(), version: sesion().version });

	// ------------------------------------------------------------ dibujo

	function pintarAreas() {
		const cont = $('.mqe-areas');
		cont.replaceChildren(...st.areas.map(a => {
			const b = nodo('button', a.area === st.actual ? 'inv-seg-item activa' : 'inv-seg-item', a.nombre);
			b.type = 'button';
			b.setAttribute('role', 'tab');
			b.dataset.area = a.area;
			if (!sinCambios(st.sesiones.get(a.area))) {
				const punto = nodo('span', 'mqe-sin-guardar', '•');
				punto.title = 'Tiene cambios sin guardar';
				b.appendChild(punto);
			}
			return b;
		}));
	}

	function pintarBandeja() {
		const cont = $('.mqe-bandeja');
		const partes = [];
		for (const grupo of ['Mesas', 'Adornos']) {
			partes.push(nodo('h4', '', grupo));
			for (const item of BANDEJA.filter(b => b.grupo === grupo)) {
				const b = nodo('button', 'mqe-item');
				b.append(miniatura(item.pieza, ajustesConDefaults({})), nodo('span', '', item.nombre));
				b.type = 'button';
				b.dataset.bandeja = item.id;
				partes.push(b);
			}
		}
		cont.replaceChildren(...partes);
	}

	function pintarPorColocar() {
		const faltan = codigosPorColocar(plano(), area().codigos);
		const lista = $('.mqe-lista');
		if (!faltan.length) {
			lista.replaceChildren(nodo('p', 'mqe-ayuda', 'Todas las mesas del área ya están en el salón.'));
			return;
		}
		lista.replaceChildren(...faltan.map(c => {
			const b = nodo('button', 'mqe-item mqe-mesa', c);
			b.type = 'button';
			b.dataset.codigo = c;
			b.title = `Mesa ${c}`;
			return b;
		}));
	}

	/** Indices de las mesas del plano cuyo codigo el area ya no tiene. */
	function indicesNoExisten() {
		const fuera = new Set(mesasQueNoExisten(plano(), area().codigos));
		return new Set(plano().piezas.flatMap((pz, i) => (fuera.has(pz) ? [i] : [])));
	}

	function pintarNotas(noExisten) {
		const nota = $('[data-ver="no-existen"]');
		nota.hidden = !noExisten.size || !editable();
		const bloqueo = $('[data-ver="bloqueo"]');
		bloqueo.hidden = !sesion().bloqueo;
		bloqueo.textContent = sesion().bloqueo;
		const codigos = [...noExisten].map(i => plano().piezas[i].codigo).join(', ');
		nota.firstElementChild.textContent = (noExisten.size === 1
			? `La mesa ${codigos} ya no existe en esta área (está en rojo). `
			: `Las mesas ${codigos} ya no existen en esta área (están en rojo). `)
			+ 'En Control de pedidos no se dibujan: bórralas o quítalas todas de una vez.';
		const vacio = $('.mqe-vacio');
		vacio.hidden = plano().piezas.length > 0 || !!sesion().bloqueo;
		vacio.querySelector('b').textContent = editable() ? 'Tu salón está vacío' : 'Esta área todavía no tiene salón';
		vacio.querySelector('p').textContent = editable()
			? `Toca «Armar con mis mesas» para poner tus ${area().codigos.length} mesas en filas, o arrastra piezas desde la izquierda.`
			: 'Cuando el administrador lo arme, se verá aquí.';
	}

	function pintarAcciones() {
		const barra = $('.mqe-acciones');
		const pz = plano().piezas[st.seleccion], varias = st.grupo.length > 0;
		const rect = !editable() ? null : varias ? vista.rectDeVarias(st.grupo) : pz ? vista.rectDePieza(st.seleccion) : null;
		barra.hidden = !rect;
		if (!rect) { return; }
		// girar y el largo se hacen con las manijas de la pieza (editor-svg); aqui queda lo que no es mover ni medir
		const partes = varias ? [nodo('span', 'mqe-et', `${st.grupo.length} elegidas`)] : [botonAccion('copiar', 'Copiar', 'Poner otra igual al lado')];
		if (!varias && pz.t === 'mesa') { partes.push(nodo('span', 'mqe-et', 'Mesa'), selectorNumero(pz)); }
		if (!varias && pz.t === 'alfombra') { partes.push(nodo('span', 'mqe-et', 'Color'), ...coloresAlfombra(pz)); }
		if (!varias && pz.t === 'mesa') {
			partes.push(nodo('span', 'mqe-et', 'Sillas'), botonAccion('sillas-', '−', 'Una silla menos'),
				nodo('b', '', String(pz.sillas ?? 0)), botonAccion('sillas+', '+', 'Una silla más'));
		}
		const borrar = botonAccion('borrar', 'Borrar', 'Quitar del salón (Supr)');
		borrar.classList.add('mqe-borrar');
		partes.push(borrar);
		barra.replaceChildren(...partes);
		const caja = $('.mqe-escenario').getBoundingClientRect();
		const lugar = lugarBarrita(
			{ left: rect.left - caja.left, top: rect.top - caja.top, right: rect.right - caja.left, bottom: rect.bottom - caja.top },
			{ ancho: barra.offsetWidth, alto: barra.offsetHeight }, { ancho: caja.width, alto: caja.height },
		);
		barra.style.left = `${lugar.x}px`;
		barra.style.top = `${lugar.y}px`;
	}

	/** Numero de la mesa: los por colocar y los que ya estan en el salon (esos se cambian con esta). */
	function selectorNumero(pz) {
		const sel = nodo('select', 'form-control form-control-sm mqe-num');
		sel.title = 'Cambiar el número de esta mesa';
		const libres = codigosPorColocar(plano(), area().codigos);
		const puestas = plano().piezas.filter(p => p.t === 'mesa' && p !== pz).map(p => p.codigo);
		const grupo = (titulo, lista) => {
			if (!lista.length) { return; }
			const g = nodo('optgroup');
			g.label = titulo;
			g.append(...lista.map(c => { const o = nodo('option', '', c); o.value = c; return o; }));
			sel.appendChild(g);
		};
		const actual = nodo('option', '', pz.codigo);
		actual.value = pz.codigo;
		sel.appendChild(actual);
		grupo('Por colocar', libres);
		grupo('En el salón (se cambian)', puestas);
		sel.value = pz.codigo;
		return sel;
	}

	function coloresAlfombra(pz) {
		const botones = COLORES_ALFOMBRA.map(([color, nombre]) => {
			const b = botonAccion(`color:${color}`, '', nombre);
			b.className = pz.color === color ? 'mqe-color on' : 'mqe-color';
			b.style.background = color;
			return b;
		});
		const libre = nodo('input', 'mqe-color-libre');
		libre.type = 'color';
		libre.title = 'Otro color';
		libre.value = pz.color || '#8b8580';
		return [...botones, libre];
	}

	function cambiarNumero(codigo) {
		vista.apurar();
		const i = st.seleccion, pz = plano().piezas[i];
		if (!pz || pz.t !== 'mesa' || codigo === pz.codigo) { return; }
		const r = conCodigo(plano(), i, codigo);
		cambiar(r.plano, i);
		aviso(r.otra >= 0 ? `Listo: esta mesa ahora es la ${codigo} y la que era ${codigo} ahora es la ${pz.codigo}.`
			: `Listo: esta mesa ahora es la ${codigo}. La ${pz.codigo} quedó en «Mesas por colocar».`);
	}

	function pintar() {
		const s = sesion(), noExisten = indicesNoExisten();
		raiz.classList.toggle('mqe-bloqueada', !!s.bloqueo);
		vista.pintar(s.plano, { seleccion: st.seleccion, grupo: new Set(st.grupo), noExisten, editable: editable() });
		pintarAreas();
		pintarPorColocar();
		pintarNotas(noExisten);
		$('[data-ver="ancho"]').textContent = String(s.plano.ancho);
		$('[data-ver="fondo"]').textContent = String(s.plano.fondo);
		$('[data-accion="deshacer"]').disabled = !s.historial.puedeDeshacer();
		$('[data-accion="rehacer"]').disabled = !s.historial.puedeRehacer();
		$('#mqe_activo').checked = st.activo;
		pintarAcciones();
	}

	// ------------------------------------------------------------ piezas

	function agregar(pz) {
		cambiar({ ...plano(), piezas: [...plano().piezas, pz] }, plano().piezas.length);
	}

	/** Toque sin arrastrar en la bandeja o en "Mesas por colocar": al primer lugar libre (la mesa junto a su anterior). */
	function ponerEnLugarLibre(pz) {
		const cerca = pz.t === 'mesa' ? cercaDeAnterior(plano(), area().codigos, pz.codigo) : { x: 0, y: 0 };
		const puesta = lugarLibre(plano(), pz, cerca);
		if (puesta) { agregar(puesta); } else { aviso(SIN_LUGAR, 'error'); }
	}

	const siguienteCodigo = () => codigosPorColocar(plano(), area().codigos)[0];

	function copiar(i) {
		const pz = plano().piezas[i];
		const codigo = pz.t === 'mesa' ? siguienteCodigo() : undefined;
		if (pz.t === 'mesa' && !codigo) { aviso(SIN_MESAS, 'error'); return; }
		const copia = codigo ? { ...pz, codigo } : { ...pz };
		const puesta = lugarLibre(plano(), copia, { x: pz.x + huellaDe(pz).ancho, y: pz.y });
		if (puesta) { agregar(puesta); } else { aviso(SIN_LUGAR, 'error'); }
	}

	function accionPieza(accion) {
		if (accion === 'borrar' && st.grupo.length) {
			const fuera = new Set(st.grupo);
			cambiar({ ...plano(), piezas: plano().piezas.filter((_, k) => !fuera.has(k)) });
			return;
		}
		const i = st.seleccion, pz = plano().piezas[i];
		if (!pz) { return; }
		if (accion === 'copiar') { copiar(i); }
		if (accion.startsWith('color:') && pz.t === 'alfombra') { cambiar(conPieza(i, { ...pz, color: accion.slice(6) }), i); }
		if (accion === 'sillas-' || accion === 'sillas+') {
			const n = conSillas(pz, accion === 'sillas+' ? 1 : -1);
			if (n.sillas === pz.sillas) { aviso(n.sillas === 0 ? 'La mesa ya no tiene sillas.' : `Una mesa lleva hasta ${SILLAS_MAX} sillas.`); return; }
			cambiar(conPieza(i, n), i);
		}
		if (accion === 'borrar') { cambiar({ ...plano(), piezas: plano().piezas.filter((_, k) => k !== i) }); }
	}

	function empezarArrastre(e) {
		const deBandeja = e.target.closest('[data-bandeja]');
		const mesa = e.target.closest('.mqe-lista [data-codigo]');
		if (!deBandeja && !mesa) { return; }
		if (mesa) { vista.arrastrarNueva(mesaPorColocar(mesa.dataset.codigo, 0, 0), e); return; }
		const id = deBandeja.dataset.bandeja;
		const esMesa = BANDEJA.find(b => b.id === id).pieza.t === 'mesa';
		const codigo = esMesa ? siguienteCodigo() : undefined;
		if (esMesa && !codigo) { aviso(SIN_MESAS, 'error'); return; }
		vista.arrastrarNueva(piezaDeBandeja(id, 0, 0, codigo), e);
	}

	// ------------------------------------------------------------ area

	function cambiarTamano(lado, delta) {
		const r = conTamano(plano(), lado, delta);
		if (r.plano) { cambiar(r.plano); return; }
		aviso(r.error === 'limite'
			? (delta > 0 ? 'Ese es el tamaño más grande del salón.' : 'Ese es el tamaño más chico del salón.')
			: 'Primero mueve las piezas que están en el borde: si no, quedarían fuera del salón.', 'error');
	}

	async function armar() {
		const codigos = area().codigos;
		if (!codigos.length) { aviso('Esta área no tiene mesas. Agrégalas en Configuración, en las áreas de mesas.', 'error'); return; }
		const hayMesas = plano().piezas.some(pz => pz.t === 'mesa');
		if (hayMesas && !await preguntar('¿Ordenar todas las mesas en filas?',
			'Las mesas vuelven a quedar en filas, con 4 sillas cada una. Las plantas, barras y demás adornos se quedan donde están. Si no te gusta, toca Deshacer.',
			'Sí, ordenar')) { return; }
		const r = armarSalon(plano(), codigos);
		if (r.error) { aviso(NO_ENTRAN, 'error'); return; }
		cambiar(r.plano);
	}

	function quitarNoExisten() {
		const fuera = indicesNoExisten();
		cambiar({ ...plano(), piezas: plano().piezas.filter((_, i) => !fuera.has(i)) });
	}

	function elegirArea(a) {
		if (!st.sesiones.has(a) || a === st.actual) { return; }
		st.actual = a;
		elegir([]);
		const url = new URL(window.location.href);
		url.searchParams.set('area', a);
		window.history.replaceState(null, '', url);
		pintar();
	}

	// ------------------------------------------------------------ servidor

	async function guardar() {
		if (sesion().bloqueo) { aviso(sesion().bloqueo, 'error'); return; }
		const valido = validarPlano(planoParaEnviar());
		if (!valido.ok) { aviso(textoDeError(valido.error), 'error'); return; }
		const s = sesion(), enviado = s.plano;
		try {
			const r = await guardarPlano(valido.plano);
			s.version = r.version;
			s.guardado = firma(enviado);
			s.sinRespuesta = false;
			pintar();
			aviso(st.activo ? 'Salón guardado. Las cajas lo verán al cambiar de área o al recargar Control de pedidos.'
				: 'Salón guardado. Para verlo en Control de pedidos, prende «Usar la maqueta en Control de pedidos».');
		} catch (e) {
			if (e.codigo === 'conflicto') { await avisarConflicto(s.sinRespuesta); return; }
			s.sinRespuesta = quedaSinRespuesta(s.sinRespuesta, e.codigo);
			aviso(textoDeError(e.codigo), 'error');
		}
	}

	async function avisarConflicto(sinRespuesta) {
		const r = await dialogo({
			titulo: sinRespuesta ? 'No sabemos si tu último guardado llegó' : 'Otra persona guardó este salón',
			texto: (sinRespuesta ? 'No sabemos si tu último guardado llegó. Recarga para ver lo que quedó guardado.'
				: 'Otra persona guardó este salón. Recarga para ver sus cambios.')
				+ ' Al recargar se pierde lo que cambiaste aquí desde la última vez que guardaste.',
			botones: [{ texto: 'Cerrar', valor: 'no' }, { texto: 'Recargar', valor: 'si', clase: 'btn-primary' }],
		});
		if (r === 'si') { await recargarArea(); }
	}

	/** Vuelve a leer las areas (y los planos de las que aparecen) despues de cambiarlas; las abiertas siguen igual. */
	async function recargarAreas() {
		const [datos, filas] = await Promise.all([pedirPlanos(), pedirAreas()]);
		st.areas = areasDelEditor(filas, st.sede);
		for (const k of [...st.sesiones.keys()]) { if (!st.areas.some(a => a.area === k)) { st.sesiones.delete(k); } }
		for (const a of st.areas) { if (!st.sesiones.has(a.area)) { st.sesiones.set(a.area, nuevaSesion(a, datos.planos.find(p => p.area === a.area))); } }
		if (!st.areas.some(a => a.area === st.actual)) { st.actual = st.areas[0].area; }
		elegir([]);
	}

	async function editarAreasYMesas() {
		try {
			const filas = await pedirAreas();   // lo guardado ahora (otra PC pudo cambiarlo)
			const alfanumerica = filas.length ? filas.some(f => f.prefijo != null) : st.sede.alfanumerica;
			const conPlano = new Set([...st.sesiones].filter(([, s]) => s.version > 0).map(([a]) => a));
			const r = await editarAreas({ filas, alfanumerica, conPlano });
			if (!r) { return; }
			await guardarAreas(r.lista, r.alfanumerica);
			await recargarAreas();
			aviso(r.cambioTipo ? 'Áreas guardadas. Cierra sesión y vuelve a entrar en cada caja para que usen los nombres nuevos de las mesas.'
				: 'Listo: áreas guardadas. Control de pedidos las verá al recargar.');
		} catch (e) {
			aviso(textoDeError(e.codigo), 'error');
		}
	}

	async function recargarArea() {
		try {
			const datos = await pedirPlanos();
			st.sesiones.set(st.actual, nuevaSesion(area(), datos.planos.find(p => p.area === st.actual)));
			st.activo = datos.activo;
			elegir([]);
			pintar();
			aviso('Listo: ves lo último que se guardó.');
		} catch (e) {
			aviso(textoDeError(e.codigo), 'error');
		}
	}

	async function activar(caja) {
		const quiere = caja.checked;
		caja.disabled = true;
		try {
			await activarMaqueta(quiere);
			st.activo = quiere;
			aviso(quiere ? 'Listo: Control de pedidos mostrará la maqueta (al recargar la página).'
				: 'Listo: Control de pedidos vuelve a mostrar las tarjetas de siempre.');
		} catch (e) {
			caja.checked = !quiere;
			aviso(textoDeError(e.codigo), 'error');
		} finally {
			caja.disabled = false;
			pintar();
		}
	}

	function ver3d(abrirPanel) {
		if (sesion().bloqueo) { aviso(sesion().bloqueo, 'error'); return; }
		const valido = validarPlano(planoParaEnviar());
		if (!valido.ok) { aviso(textoDeError(valido.error), 'error'); return; }
		let pendiente = false;   // se movio un deslizador o el selector de color y aun no se solto
		abrirVista3D({
			plano: valido.plano, nombreArea: area().nombre, editable: editable(), abrirPanel,
			alCambiarAjustes(ajustes, final) {
				const nuevo = { ...plano(), ajustes };
				pendiente = !final;
				if (final) { cambiar(nuevo, elegidas()); } else { sesion().plano = nuevo; }
			},
		}).then(() => {
			// soltado fuera de la ventana no da "change": lo que se veia queda igual en el historial
			if (pendiente) { cambiar(plano(), elegidas()); } else { pintar(); }
		});
	}

	// ------------------------------------------------------------ eventos

	function pasoHistorial(atras) {
		const s = sesion();
		const e = atras ? s.historial.deshacer() : s.historial.rehacer();
		if (e) { s.plano = e; elegir([]); }
	}

	const ACCIONES = {
		guardar, armar,
		areas: editarAreasYMesas,
		ver3d: () => ver3d(false),
		personalizar: () => ver3d(true),
		'quitar-no-existen': quitarNoExisten,
		deshacer: () => pasoHistorial(true),
		rehacer: () => pasoHistorial(false),
		'ancho-': () => cambiarTamano('ancho', -1),
		'ancho+': () => cambiarTamano('ancho', 1),
		'fondo-': () => cambiarTamano('fondo', -1),
		'fondo+': () => cambiarTamano('fondo', 1),
	};

	/** Una accion a la vez (Guardar espera al servidor; Armar, la respuesta del dialogo). */
	async function hacerAccion(accion) {
		// lo que se acaba de soltar y aun se acomoda entra primero (si no, su pintar lo perderia y Deshacer, Guardar o
		// Copiar trabajarian sobre el plano de antes)
		vista.apurar();
		if (st.ocupado) { return; }
		st.ocupado = true;
		try {
			await (ACCIONES[accion] || (() => accionPieza(accion)))();
		} finally {
			st.ocupado = false;
			pintar();
		}
	}

	function alClic(e) {
		const tab = e.target.closest('[data-area]');
		if (tab) { vista.apurar(); elegirArea(tab.dataset.area); return; }
		const b = e.target.closest('[data-accion]');
		if (b && !b.disabled) { hacerAccion(b.dataset.accion); }
	}

	function alTeclear(e) {
		if (!editable() || e.target.closest('input, textarea, select, dialog')) { return; }
		const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
		// Escape primero suelta lo que se esta arrastrando (pieza del salon o nueva) y la deja como estaba; solo si no
		// se arrastraba nada quita la eleccion
		if (e.key === 'Escape' && vista.cancelar()) { e.preventDefault(); return; }
		const tecla = (ctrl && (k === 'z' || k === 'y' || k === 'a')) || e.key === 'Delete' || e.key === 'Escape'
			|| (!ctrl && !e.altKey && k === 'r');
		if (!tecla || (k === 'r' && e.repeat)) { return; }   // R mantenida no gira sin parar
		vista.apurar();   // lo que aun se acomoda entra antes: la eleccion y el historial ya lo incluyen
		let accion = null;
		if (ctrl && k === 'z' && !e.shiftKey) { accion = 'deshacer'; }
		if (ctrl && (k === 'y' || (k === 'z' && e.shiftKey))) { accion = 'rehacer'; }
		if (ctrl && k === 'a') { accion = 'todas'; }
		if (e.key === 'Delete' && elegidas().length) { accion = 'borrar'; }
		if (e.key === 'Escape' && elegidas().length) { accion = 'soltar'; }
		if (!ctrl && !e.altKey && k === 'r' && st.seleccion >= 0) { accion = 'girar'; }
		if (!accion) { return; }
		e.preventDefault();
		if (accion === 'soltar' || accion === 'todas') { elegir(accion === 'todas' ? plano().piezas.map((_, i) => i) : []); pintar(); return; }
		// la vista lo gira con animacion y avisa con alMover (no por hacerAccion: su pintar cortaria la animacion)
		if (accion === 'girar') { if (!st.ocupado) { vista.girar(st.seleccion); } return; }
		hacerAccion(accion);
	}

	function alSalir(e) {
		if ([...st.sesiones.values()].every(sinCambios)) { return; }
		e.preventDefault();
		e.returnValue = '';
	}

	function enganchar() {
		raiz.addEventListener('click', alClic);
		raiz.addEventListener('pointerdown', e => { if (editable()) { empezarArrastre(e); } });
		$('#mqe_activo').addEventListener('change', e => activar(e.target));
		$('.mqe-acciones').addEventListener('change', e => {
			if (!editable()) { return; }
			if (e.target.matches('.mqe-num')) { cambiarNumero(e.target.value); }
			if (e.target.matches('.mqe-color-libre')) { hacerAccion(`color:${e.target.value.toLowerCase()}`); }
		});
		document.addEventListener('keydown', alTeclear);
		window.addEventListener('beforeunload', alSalir);
		window.addEventListener('resize', pintarAcciones);
	}

	// ------------------------------------------------------------ carga

	function errorDeCarga(e) {
		const caja = $('.mqe-escenario');
		const msj = nodo('div', 'mqe-vacio');
		const dentro = nodo('div');
		dentro.append(nodo('b', '', 'No se pudo abrir el salón'), nodo('p', '', textoDeError(e.codigo)));
		const otra = botonAccion('', 'Intentar de nuevo');
		otra.addEventListener('click', () => window.location.reload());
		dentro.appendChild(otra);
		msj.appendChild(dentro);
		caja.replaceChildren(msj);
	}

	try {
		const [datos, filas] = await Promise.all([pedirPlanos(), pedirAreas()]);
		const sede = datosSedePOS();
		st.sede = sede;
		if (!sede) {
			errorDeCarga({ codigo: '' });
			$('.mqe-vacio p').textContent = 'No encontramos los datos de tu local en este navegador. Entra al sistema y abre esta página desde Control de pedidos.';
			return;
		}
		st.areas = areasDelEditor(filas, sede);
		st.activo = datos.activo;
		st.puedeEditar = datos.puedeEditar;
		for (const a of st.areas) { st.sesiones.set(a.area, nuevaSesion(a, datos.planos.find(p => p.area === a.area))); }
		const pedida = new URLSearchParams(window.location.search).get('area');
		st.actual = st.areas.some(a => a.area === pedida) ? pedida : st.areas[0].area;
		raiz.classList.toggle('mqe-solo-ver', !st.puedeEditar);
		$('[data-ver="solo-ver"]').hidden = st.puedeEditar;
		pintarBandeja();
		enganchar();
		pintar();
	} catch (e) {
		if (!(e && e.codigo)) { console.error('maqueta: no se pudo abrir el editor', e); }
		errorDeCarga(e || {});
	}
}

