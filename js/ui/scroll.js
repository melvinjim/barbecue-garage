export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const scrollBehavior = () => (reducedMotion() ? 'auto' : 'smooth');

/**
 * Borde inferior (en px de la ventana) de lo que está "pegado" arriba
 * (cabecera y barra de la carta). Sirve para no dejar contenido tapado.
 */
export function stickyBottom() {
  let bottom = 0;
  for (const el of document.querySelectorAll('.site-header, .menu__bar')) {
    const style = getComputedStyle(el);
    if (style.position !== 'sticky') continue;
    const rect = el.getBoundingClientRect();
    if (rect.top <= (parseFloat(style.top) || 0) + 1 && rect.bottom > 0) bottom = Math.max(bottom, rect.bottom);
  }
  return bottom;
}
