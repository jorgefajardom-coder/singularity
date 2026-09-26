/**
 * EL AVISO DE CARGA DE LOS VISORES 3D, UNO SOLO.
 *
 * Lo usan la celda (ModelViewer), el dron (ProductViewer) y el hueco que
 * espera al codigo del visor (Projects, mientras baja el chunk de three). Antes
 * cada uno tenia el suyo: la celda con texto y barra, el dron con otro texto y
 * sin barra, y el chunk con un tercero. Vive fuera de `three/` a proposito:
 * Projects lo pinta antes de que exista three.js, y aqui no se importa nada
 * de el.
 *
 * `fallo` cambia el aviso por el error y, si se da `reintentar`, un boton.
 */
export default function Carga3D({ texto, fallo = false, reintentar, textoReintentar }) {
  return (
    <div className="carga3d" role="status" data-testid="loader-3d" data-estado={fallo ? "fallo" : "cargando"}>
      <span>{texto}</span>
      {fallo ? (
        reintentar ? (
          <button type="button" className="carga3d__reintentar" onPointerDown={(e) => e.stopPropagation()} onClick={reintentar}>
            {textoReintentar}
          </button>
        ) : null
      ) : (
        <span className="modelo__progreso" aria-hidden="true" />
      )}
    </div>
  );
}
