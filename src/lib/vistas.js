import { useEffect, useSyncExternalStore } from "react";

/**
 * QUE VISTAS 3D HAY CERCA Y CUALES SE VEN.
 *
 * El lienzo compartido (three/ViewCanvas.jsx) pinta todos los <View> del
 * sitio, pero la mayor parte del recorrido no hay ninguno en pantalla: el
 * lienzo seguia limpiando la pantalla entera y midiendo cada hueco en cada
 * fotograma. Cada visor apunta aqui su caja y el lienzo pregunta:
 *
 *   `cerca`    alguna vista a menos de una pantalla: el lienzo tiene que
 *              existir (en el telefono no se crea el contexto hasta entonces).
 *   `visibles` alguna vista en pantalla: el lienzo pinta en bucle. Si no hay
 *              ninguna, pinta solo cuando se le pide.
 *   `nitidas`  vistas en pantalla que piden mas densidad (la celda): en el
 *              telefono el lienzo sube de densidad solo mientras se ven.
 */
const estado = { cerca: 0, visibles: 0, nitidas: 0 };
let foto = { ...estado };
const oyentes = new Set();
const avisar = () => { foto = { ...estado }; oyentes.forEach((f) => f()); };
const suscribir = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
const leer = () => foto;

export function useVistas() {
  return useSyncExternalStore(suscribir, leer, leer);
}

/**
 * Apunta la caja `ref` como vista 3D mientras el componente este montado.
 * `nitida`: mientras este en pantalla, el lienzo del telefono sube de densidad.
 */
export function useRegistrarVista(ref, { nitida = false } = {}) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver !== "function") {
      estado.cerca++; estado.visibles++; avisar();
      return () => { estado.cerca--; estado.visibles--; avisar(); };
    }
    let cerca = false;
    let visible = false;
    const oCerca = new IntersectionObserver(([e]) => {
      if (e.isIntersecting === cerca) return;
      cerca = e.isIntersecting;
      estado.cerca += cerca ? 1 : -1;
      avisar();
    }, { rootMargin: "200% 0px 200% 0px" });
    const oVisible = new IntersectionObserver(([e]) => {
      if (e.isIntersecting === visible) return;
      visible = e.isIntersecting;
      estado.visibles += visible ? 1 : -1;
      if (nitida) estado.nitidas += visible ? 1 : -1;
      avisar();
    // Margen de una pantalla entera: con un scroll brusco el visor entraba
    // antes de que el lienzo volviera a pintar en bucle, y el modelo se
    // quedaba atras, "despegado" de su hueco (video de Jorge, 26-09-2026).
    }, { rootMargin: "100% 0px 100% 0px" });
    oCerca.observe(el);
    oVisible.observe(el);
    return () => {
      oCerca.disconnect();
      oVisible.disconnect();
      if (cerca) estado.cerca--;
      if (visible) estado.visibles--;
      if (visible && nitida) estado.nitidas--;
      avisar();
    };
  }, [ref, nitida]);
}
