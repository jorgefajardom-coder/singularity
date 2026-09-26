/**
 * Las esferas de la orbita sin WebGL.
 *
 * Misma interfaz que `createOrbitSpheres` (three/OrbitSpheres.js): resize,
 * update, render y dispose. La usa el telefono, donde un WebGLRenderer propio
 * para cinco bolas blancas era un contexto mas —y el tope de contextos en
 * movil es lo que tumbaba al agujero del hero—, y cualquier visita en la que la
 * GPU ya haya fallado. Una bola blanca con brillo propio se dibuja igual de
 * bien con un degradado radial; el cuerpo y el halo van en la misma capa.
 */
export function createOrbitSpheresCss(host, count) {
  const balls = Array.from({ length: count }, () => {
    const el = document.createElement("span");
    el.className = "orbit__esfera";
    el.style.opacity = "0";
    host.appendChild(el);
    return { el, visible: false };
  });
  return {
    resize() {},
    update(i, { x, y, radius, opacity }) {
      const ball = balls[i];
      const visible = opacity > 0.001;
      if (visible !== ball.visible) {
        ball.visible = visible;
        ball.el.style.visibility = visible ? "visible" : "hidden";
      }
      if (!visible) return;
      // El halo del WebGL mide 3,1 radios: la caja lleva ese margen y el
      // degradado pone el cuerpo en el centro (ver `.orbit__esfera`).
      const d = radius * 2 * 3.1;
      ball.el.style.width = `${d.toFixed(1)}px`;
      ball.el.style.height = `${d.toFixed(1)}px`;
      ball.el.style.transform = `translate3d(${(x - d / 2).toFixed(1)}px, ${(y - d / 2).toFixed(1)}px, 0)`;
      ball.el.style.opacity = opacity.toFixed(3);
    },
    render() {},
    dispose() {
      balls.forEach(({ el }) => el.remove());
    },
  };
}
