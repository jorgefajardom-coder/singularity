import { Component } from "react";

/**
 * Error Boundary. Un fallo en una seccion (un shader que no compila, un
 * modelo corrupto, un dato mal formado) ya no desmonta la pagina entera:
 * se queda en su caja con `fallback` y el resto sigue funcionando.
 *
 * `onError` avisa a quien lo necesite (el agujero negro, por ejemplo, pasa a
 * su respaldo y devuelve el titular al DOM).
 */
export default class Aislado extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[singularity] fallo aislado en ${this.props.nombre || "una seccion"}`, error, info?.componentStack);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.error) return this.props.fallback ?? null;
    return this.props.children;
  }
}

/**
 * El respaldo de la aplicacion entera: si algo rompe por encima de todas las
 * secciones, el visitante sigue teniendo el nombre y la forma de contactar.
 */
export function RespaldoGlobal({ nombre, correo }) {
  return (
    <main className="respaldo-global">
      <h1>{nombre}</h1>
      <p>
        <span lang="es">La pagina no pudo cargarse completa. </span>
        <span lang="en">The page could not fully load.</span>
      </p>
      {correo ? <p><a href={`mailto:${correo}`}>{correo}</a></p> : null}
      <p><button type="button" onClick={() => window.location.reload()}>Recargar · Reload</button></p>
    </main>
  );
}
