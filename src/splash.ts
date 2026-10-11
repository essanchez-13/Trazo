// La pantalla de carga está en index.html para que aparezca al instante.
// Se quita cuando la biblioteca ya cargó, dejando terminar la animación de la sonrisa.
const MIN_VISIBLE_MS = 1500

let hidden = false

export function hideSplash() {
  if (hidden) return
  hidden = true
  const el = document.getElementById('splash')
  if (!el) return
  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now())
  setTimeout(() => {
    el.classList.add('hide')
    setTimeout(() => el.remove(), 500)
  }, wait)
}
