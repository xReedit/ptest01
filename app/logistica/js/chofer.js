// App del chofer (chofer.html): sus rutas como linea de tiempo de paradas; "Como llegar", "Llamar", lo que lleva y
// "Marcar entregado" (hoja inferior: hora + ubicacion GPS + quien recibio + observacion). Entra con su enlace #k=...
const API = '../../bdphp/abastecimiento/chofer_app.php';
const CLAVE = 'lg_chofer_k';
const vista = document.getElementById('ch_vista');
const $ = id => document.getElementById(id);

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = n => Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 });
const nombrePropio = s => String(s || '').toLowerCase().replace(/(^|\s)\S/g, m => m.toUpperCase());

// la clave llega en el enlace (#k=); se guarda en el celular y se quita de la barra (no queda a la vista)
let token = (location.hash.match(/k=([0-9]+\.[a-f0-9]{64})/) || [])[1] || '';
try {
	if (token) { localStorage.setItem(CLAVE, token); } else { token = localStorage.getItem(CLAVE) || ''; }
} catch (e) { /* sin almacenamiento: sirve mientras no cierre la pagina */ }
if (location.hash) { history.replaceState(null, '', location.pathname); }

let avisoT = null;
function aviso(txt) {
	let d = document.querySelector('.aviso');
	if (!d) { d = document.createElement('div'); d.className = 'aviso'; d.setAttribute('role', 'status'); document.body.appendChild(d); }
	d.textContent = txt;
	requestAnimationFrame(() => d.classList.add('ver'));
	clearTimeout(avisoT);
	avisoT = setTimeout(() => d.classList.remove('ver'), 3200);
}

async function api(op, cuerpo) {
	let r;
	try {
		r = await fetch(API + '?op=' + op, {
			method: cuerpo ? 'POST' : 'GET', cache: 'no-store',
			headers: { 'X-Chofer-Token': token, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
			body: cuerpo ? JSON.stringify(cuerpo) : undefined,
		});
	} catch (e) {
		throw new Error('Sin conexión. Revisa tu internet e intenta de nuevo.');   // sin senal: no mostrar "Failed to fetch"
	}
	const j = await r.json().catch(() => ({ success: false, error: 'Sin conexión. Revisa tu internet e intenta de nuevo.' }));
	if (!j.success) { throw new Error(j.error || 'No se pudo. Intenta de nuevo.'); }
	return j.data;
}

function comoLlegar(p) {
	const destino = p.lat && p.lng ? `${Number(p.lat)},${Number(p.lng)}` : [p.direccion, p.ciudad].filter(Boolean).join(', ');
	return destino ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}` : '';
}

let datos = null;
let primera = true;
let recien = 0;   // la que se acaba de entregar: solo ella anima su check
const abiertas = new Set();   // paradas con "Lo que llevas" abierto (se mantiene al refrescar)

function cabecera() {
	const todas = datos.rutas.flatMap(r => r.paradas);
	const hechas = todas.filter(p => p.entregado).length, faltan = todas.length - hechas;
	const nom = nombrePropio(String(datos.chofer).split(' ')[0]);
	$('ch_nombre').textContent = 'Hola, ' + nom;
	$('ch_ini').textContent = String(datos.chofer).split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '·';
	$('ch_resumen').textContent = !todas.length ? 'Sin entregas asignadas' : faltan ? `Te ${faltan === 1 ? 'falta 1 entrega' : `faltan ${faltan} entregas`} de ${todas.length}` : '¡Todo entregado! Buen trabajo';
	$('ch_avance').style.transform = `scaleX(${todas.length ? hechas / todas.length : 0})`;
}

async function cargar() {
	if (!token) {
		vista.innerHTML = '<div class="vacio error"><i class="fa fa-lock"></i><h2>Abre tu enlace</h2>Entra con el enlace que te llegó por WhatsApp.</div>';
		$('ch_resumen').textContent = '';
		return;
	}
	$('ch_act').classList.add('girando');
	try {
		datos = await api('rutas');
		cabecera();
		pintar();
	} catch (err) {
		if (!datos) { vista.innerHTML = `<div class="vacio error"><i class="fa fa-exclamation-triangle"></i><h2>No se pudo abrir</h2>${esc(err.message)}</div>`; $('ch_resumen').textContent = ''; }
		else { aviso(err.message); }
	} finally { $('ch_act').classList.remove('girando'); }
}

function parada(p, varias) {
	const orden = varias ? `<span class="orden">${p.orden_entrega}</span>` : '';
	if (p.entregado) {
		return `<li class="parada hecha" data-id="${p.idtraslado}">
			<div class="cuerpo"><h2>${orden}${esc(p.destino)}</h2><div class="listo"><i class="fa fa-check-circle"></i> Entregado ${esc(p.entregado)}${p.entrega_recibio ? ' a ' + esc(p.entrega_recibio) : ''}</div></div></li>`;
	}
	const mapa = comoLlegar(p), abierta = abiertas.has(p.idtraslado);
	const tel = String(p.telefono || '').replace(/[^\d+]/g, '');
	return `<li class="parada" data-id="${p.idtraslado}">
		<div class="cuerpo">
			<h2>${orden}${esc(p.destino)}</h2>
			<div class="dir">${esc([p.direccion, p.ciudad].filter(Boolean).join(', ') || 'Sin dirección registrada')}</div>
			<div class="acciones">
				${mapa ? `<a class="acc" href="${esc(mapa)}" target="_blank" rel="noopener"><i class="fa fa-location-arrow"></i>Cómo llegar</a>` : ''}
				${tel ? `<a class="acc" href="tel:${esc(tel)}"><i class="fa fa-phone"></i>Llamar</a>` : ''}
				<button class="acc" type="button" data-carga="${p.idtraslado}" aria-expanded="${abierta}"><i class="fa fa-cube"></i>Lleva ${p.items.length}<i class="fa fa-angle-down"></i></button>
			</div>
			<div class="carga" ${abierta ? '' : 'hidden'}>${p.items.map(i => `<div><span>${esc(i.descripcion)}</span><b>${num(i.cantidad)} ${esc(i.unidad)}</b></div>`).join('')}</div>
			<button class="entregar" type="button" data-entregar="${p.idtraslado}"><i class="fa fa-check"></i>Marcar entregado</button>
		</div></li>`;
}

function pintar() {
	// primero las rutas con algo por entregar
	const rutas = datos.rutas.filter(r => r.paradas.length)
		.sort((a, b) => (b.paradas.some(p => !p.entregado) - a.paradas.some(p => !p.entregado)) || b.idruta - a.idruta);
	if (!rutas.length) {
		vista.innerHTML = '<div class="vacio"><i class="fa fa-check-circle"></i><h2>Sin entregas por ahora</h2>Cuando la central te asigne una ruta, aparecerá aquí y te llegará un WhatsApp.</div>';
		return;
	}
	vista.innerHTML = rutas.map(r => {
		const hechas = r.paradas.filter(p => p.entregado).length;
		return `<div class="ruta-cab"><span><b>Ruta ${r.idruta}</b> · salió ${esc(r.salida)}${r.vehiculo ? ' · ' + esc(r.vehiculo) : ''}</span>
			<span class="chip ${hechas === r.paradas.length ? 'ok' : ''}">${hechas} de ${r.paradas.length}</span></div>
			<ol class="paradas">${r.paradas.map(p => parada(p, r.paradas.length > 1)).join('')}</ol>`;
	}).join('');
	// la entrada solo se anima la primera vez (al refrescar cada minuto no salta nada)
	if (!primera) {
		vista.querySelectorAll('.parada').forEach(li => {
			li.style.animation = 'none';
			const ic = li.querySelector('.listo .fa');
			if (ic && Number(li.dataset.id) !== recien) { ic.style.animation = 'none'; }
		});
	}
	primera = false;
	recien = 0;
}

/** Ubicacion del celular; si no la da (permiso negado, sin GPS, pagina sin https) se entrega igual sin ella. */
function ubicacion() {
	return new Promise(resolver => {
		if (!navigator.geolocation) { resolver(null); return; }
		navigator.geolocation.getCurrentPosition(
			pos => resolver({ lat: pos.coords.latitude, lng: pos.coords.longitude, precision: Math.round(pos.coords.accuracy) }),
			() => resolver(null), { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
	});
}

let hojaAbierta = false;
function entregar(idtraslado) {
	const p = datos.rutas.flatMap(r => r.paradas).find(x => x.idtraslado === idtraslado);
	if (!p || hojaAbierta) { return; }
	hojaAbierta = true;
	// la ubicacion se pide al abrir: cuando confirme, ya esta lista
	const gps = ubicacion();
	const h = document.createElement('div');
	h.className = 'hoja';
	h.innerHTML = `<div class="hoja-caja" role="dialog" aria-modal="true" aria-labelledby="hj_t">
		<div class="asa"></div>
		<h3 id="hj_t">Entregar en ${esc(p.destino)}</h3>
		<p class="sub">${p.items.length} producto${p.items.length === 1 ? '' : 's'} · se guarda la hora y dónde estás.</p>
		<div class="gps" id="hj_gps"><i class="fa fa-spinner fa-spin"></i>Buscando tu ubicación…</div>
		<label for="hj_quien">¿Quién recibió? (opcional)</label><input id="hj_quien" maxlength="80" autocomplete="off" placeholder="Ej: Juan, encargado">
		<label for="hj_obs">Observación (opcional)</label><textarea id="hj_obs" maxlength="255" rows="2" placeholder="Ej: dejé en la puerta del almacén"></textarea>
		<div class="hoja-btns"><button class="cancelar" type="button" data-x>Cancelar</button>
			<button class="entregar" type="button" data-ok><i class="fa fa-check"></i>Confirmar entrega</button></div></div>`;
	document.body.appendChild(h);
	requestAnimationFrame(() => h.classList.add('ver'));
	gps.then(g => {
		const e = h.querySelector('#hj_gps');
		if (!e) { return; }
		e.className = 'gps ' + (g ? 'ok' : 'no');
		e.innerHTML = g ? '<i class="fa fa-map-marker"></i>Ubicación lista' : '<i class="fa fa-info-circle"></i>Sin ubicación: se guarda solo la hora';
	});
	const cerrar = () => {
		h.classList.remove('ver');
		hojaAbierta = false;
		document.removeEventListener('keydown', tecla);
		setTimeout(() => h.remove(), 300);
	};
	const tecla = e => { if (e.key === 'Escape') { cerrar(); } };
	document.addEventListener('keydown', tecla);
	h.addEventListener('click', e => { if (e.target === h || e.target.closest('[data-x]')) { cerrar(); } });
	h.querySelector('[data-ok]').addEventListener('click', async e => {
		const b = e.currentTarget;
		b.disabled = true;
		b.innerHTML = '<i class="fa fa-spinner fa-spin"></i>Guardando…';
		try {
			const g = await gps;
			const r = await api('entregar', { idtraslado, ...(g || {}), recibio: h.querySelector('#hj_quien').value, obs: h.querySelector('#hj_obs').value });
			cerrar();
			recien = idtraslado;
			aviso(r.ya ? 'Ya estaba marcada como entregada.' : `Entregado a las ${r.hora}. ¡Gracias!`);
			cargar();
		} catch (err) {
			aviso(err.message);
			b.disabled = false;
			b.innerHTML = '<i class="fa fa-check"></i>Confirmar entrega';
		}
	});
}

vista.addEventListener('click', e => {
	const b = e.target.closest('[data-entregar]');
	if (b) { entregar(Number(b.dataset.entregar)); return; }
	const c = e.target.closest('[data-carga]');
	if (c) {
		const id = Number(c.dataset.carga), lista = c.closest('.cuerpo').querySelector('.carga');
		const abrir = lista.hidden;
		lista.hidden = !abrir;
		c.setAttribute('aria-expanded', String(abrir));
		if (abrir) { abiertas.add(id); } else { abiertas.delete(id); }
	}
});
$('ch_act').addEventListener('click', cargar);
setInterval(() => { if (!document.hidden && !hojaAbierta) { cargar(); } }, 60000);
cargar();
