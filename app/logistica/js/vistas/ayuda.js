// Ayuda del modulo. "ayuda/<pantalla>" abre el tema de esa pantalla (boton Ayuda junto a Volver).
// El texto vive en bdphp/abastecimiento/_ayuda.php: es el mismo que usa "Pregúntale a la IA" para responder cómo se usa.
import { api } from '../api.js?v=20261026a';
import { esc, tarjeta, volver } from '../ui.js?v=20261026a';
import { vigente } from '../router.js?v=20261026a';

let temas = null;   // se piden una vez por carga de pagina
const norma = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const IMG = new URL('../../../../images/logistica-ayuda/', import.meta.url).href;
const fotos = xs => xs.map(([f, t]) => `<figure><img src="${IMG + esc(f)}" alt="${esc(t)}" loading="lazy"><figcaption>${esc(t)}</figcaption></figure>`).join('');
const lista = (xs, tag) => xs.length ? `<${tag}>${xs.map(x => `<li>${esc(x)}</li>`).join('')}</${tag}>` : '';

export async function render(cont, sesion, t, foco) {
	temas = temas || await api('ayuda.php');
	if (!vigente(t)) { return; }
	const rol = sesion.rol_logistica === 'sede' ? 'sede' : 'central';
	const mios = temas.filter(x => x.rol === 'todos' || x.rol === rol);
	const abierto = foco ? mios.find(x => x.clave === foco || x.rutas.includes(foco)) : null;
	cont.innerHTML = tarjeta({
		titulo: 'Ayuda del Centro Logístico',
		ayuda: 'Toca un tema para ver qué es y los pasos. También puedes buscar una palabra.',
		acciones: volver(abierto && abierto.clave !== 'diagrama' ? foco : ''),
		cuerpo: `<div class="inv-toolbar"><input class="inv-input" id="ay_q" placeholder="Buscar: pedir, aprobar, chofer…" aria-label="Buscar en la ayuda"></div>
			<div id="ay_lista">${mios.map(x => `<details class="lg-ayuda"${x === abierto ? ' open' : ''}>
				<summary><i class="fa fa-chevron-down"></i>${esc(x.titulo)}</summary>
				${x.texto ? `<p>${esc(x.texto)}</p>` : ''}${fotos(x.imgs.slice(0, 1))}${lista(x.pasos, 'ol')}${fotos(x.imgs.slice(1))}${lista(x.notas, 'ul')}</details>`).join('')}</div>
			<p class="inv-empty" id="ay_nada" hidden>No encontré nada con esa palabra.</p>
			${rol === 'central' ? '<p class="inv-ayuda"><i class="fa fa-comments"></i> ¿No lo encuentras? <a href="#" data-ir="preguntas">Pregúntale a la IA</a>, por ejemplo: "¿cómo apruebo una orden de compra?"</p>' : ''}`,
	});
	const items = [...cont.querySelectorAll('.lg-ayuda')];
	cont.querySelector('#ay_q').addEventListener('input', e => {
		const q = norma(e.target.value.trim());
		items.forEach(d => { const si = !q || norma(d.textContent).includes(q); d.hidden = !si; d.open = q ? si : d.open; });
		cont.querySelector('#ay_nada').hidden = items.some(d => !d.hidden);
	});
	if (abierto) { cont.querySelector('.lg-ayuda[open]').scrollIntoView({ block: 'start' }); }
}
