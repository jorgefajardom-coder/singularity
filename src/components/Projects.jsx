import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { projects, projectCategories, sections, ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { GhostHeading, Placeholder, VideoEmbed } from "./ui";
import { asset } from "../lib/asset";
import { scroller } from "../lib/anim";
import { gpuFallo, perfil } from "../lib/gpu";

// El visor arrastra consigo el stack 3D. Se carga aparte para que no entre en
// el bundle principal de quien nunca abre un proyecto con modelo.
const ModelViewer = lazy(() => import("../three/ModelViewer"));
const ProductViewer = lazy(() => import("../three/ProductViewer"));

// Lo que dura el plegado de una ficha (la transicion de `.proj__panel`).
const PLEGADO_MS = 900;
// Cualquier gesto del visitante suelta la correccion de posicion.
const GESTOS = ["wheel", "touchstart", "pointerdown", "keydown"];

/** El hueco de un visor mientras llega su codigo: mismo alto y lo dice. */
function Espera3D({ tr }) {
  return (
    <div className="modelo escena__espera" role="status">
      <div className="modelo__hueco" />
      <span>{tr(ui.loading3d)}</span>
    </div>
  );
}

/**
 * Un proyecto con modelo Y video los junta en un solo marco con pestanas
 * —montaje 3D o simulacion en video— y lo pone al lado de la descripcion (ver
 * `proj__cabeza--escena`). Uno debajo de otro eran dos bloques enormes y la
 * mitad derecha del texto se quedaba vacia.
 *
 * Solo se monta la pestana activa: pasar al video suelta el 3D.
 */
function Escena({ p, name }) {
  const { tr } = useLang();
  const medios = [
    p.model ? { id: "modelo", label: ui.tabModel } : null,
    p.video ? { id: "video", label: ui.tabVideo } : null,
  ].filter(Boolean);
  const [activo, setActivo] = useState(medios[0].id);

  return (
    <div className="escena">
      <div className="escena__medios">
        {medios.length > 1 ? (
          <div className="escena__tabs" role="group" aria-label={tr(ui.tabsLabel)}>
            {medios.map((m) => (
              <button key={m.id} type="button" className="escena__tab" aria-pressed={activo === m.id}
                onClick={() => setActivo(m.id)}>
                {tr(m.label)}
              </button>
            ))}
          </div>
        ) : null}

        {activo === "modelo" ? (
          // Mientras llega el visor (el .glb pesa megabytes y con red movil
          // tarda), su hueco ya ocupa lo mismo y lo dice: con `null` la ficha
          // se abria con un vacio negro de varios segundos y sin explicacion.
          <Suspense fallback={<Espera3D tr={tr} />}>
            <ModelViewer model={p.model} label={`${name} · ${tr(ui.model3d)}`} hint={tr(ui.modelDrag)} />
          </Suspense>
        ) : (
          <VideoEmbed id={p.video} poster={p.videoPoster} title={name}
            label={tr(ui.playVideo)} note={tr(ui.videoNote)} />
        )}
      </div>
    </div>
  );
}

export default function Projects() {
  const { tr } = useLang();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(0);
  const seccion = useRef(null);

  /**
   * Abrir una fila sin que la pagina salte.
   *
   * Abrir una cierra la que estaba abierta, y si esa quedaba ENCIMA (el dron,
   * que arranca abierto) todo lo de debajo sube lo que medía su ficha: en el
   * movil, al tocar la celda la pagina se iba hasta Formacion y habia que
   * volver a buscarla (video del 25-09-2026). Durante los 0,7 s del plegado
   * se compensa en cada fotograma lo que se ha movido el boton tocado, asi
   * que se queda bajo el dedo.
   */
  const anclar = useRef({ boton: null, antes: 0, hasta: 0, raf: 0 });
  /**
   * La correccion NO compite con el dedo: en cuanto el visitante hace algo
   * (tocar, rueda, teclado) se suelta el ancla y manda el. Antes seguia
   * reescribiendo el scroll durante 0,9 s aunque ya estuviera desplazandose,
   * y el gesto se sentia frenado o daba un tiron hacia atras.
   */
  const soltarAncla = () => {
    const a = anclar.current;
    a.boton = null;
    cancelAnimationFrame(a.raf);
    for (const ev of GESTOS) window.removeEventListener(ev, soltarAncla, true);
  };
  const corregir = () => {
    const a = anclar.current;
    if (!a.boton) return;
    const delta = a.boton.getBoundingClientRect().top - a.antes;
    if (Math.abs(delta) <= 0.5) return;
    // La altura REAL de la ventana, no `lenis.scroll`: con el dedo el scroll
    // es nativo y Lenis no se entera (ahi vale lo que tuviera la ultima vez).
    const destino = window.scrollY + delta;
    const lenis = scroller.current;
    if (lenis) lenis.scrollTo(destino, { immediate: true, force: true });
    else window.scrollTo(0, destino);
  };
  const alternar = (i, boton) => {
    const a = anclar.current;
    cancelAnimationFrame(a.raf);
    a.boton = boton;
    a.antes = boton.getBoundingClientRect().top;
    a.hasta = performance.now() + PLEGADO_MS;
    setOpen((actual) => (actual === i ? -1 : i));
  };
  // Lo que cambia de golpe (el visor 3D de la fila que se cierra se desmonta
  // al instante) se corrige antes de pintar; el plegado animado, fotograma a
  // fotograma hasta que termina o hasta que el visitante toma el mando. Los
  // oyentes se ponen DESPUES del clic que abrio la fila, para no soltarse con
  // su propio evento.
  useLayoutEffect(() => {
    const a = anclar.current;
    if (!a.boton) return undefined;
    corregir();
    for (const ev of GESTOS) window.addEventListener(ev, soltarAncla, { capture: true, passive: true });
    const seguir = () => {
      corregir();
      if (a.boton && performance.now() < a.hasta) a.raf = requestAnimationFrame(seguir);
      else soltarAncla();
    };
    a.raf = requestAnimationFrame(seguir);
    return soltarAncla;
  }, [open]);

  /**
   * Los modelos 3D se bajan en segundo plano en cuanto aparece Areas (la
   * seccion de encima), no cuando abre el proyecto: son megabytes, y esperar a
   * que los pida era ver "Preparando la celda 3D" cada vez. Antes arrancaba a
   * 1500 px de Proyectos; desde Areas se gana todo el rato que se pasa
   * leyendolas. Si alguien salta directo a Proyectos por el menu, el
   * observador de la propia seccion lo cubre.
   *
   * Primero los productos (dron y empaque, ~4 MB) y DESPUES la celda (~15 MB):
   * a la vez se reparten la conexion y el dron, que es el primero de la
   * lista, tardaria lo que tarda la celda.
   *
   * Y con cabeza segun el aparato (ver `perfil` en lib/gpu.js):
   *   - ahorro de datos, 2G/3G o la GPU ya caida: nada sin pedirlo.
   *   - telefono o poca memoria: solo los productos, y solo con Proyectos a
   *     menos de una pantalla. La celda (~15 MB) se baja al abrir su ficha:
   *     en un movil son megas de datos y de memoria grafica para una seccion
   *     que quiza no se abra.
   */
  useEffect(() => {
    const el = seccion.current;
    const contenido = perfil.movil || perfil.memoriaBaja;
    const modelos = contenido ? [] : projects.map((p) => p.model).filter(Boolean);
    const productos = projects.map((p) => p.producto3d?.model).filter(Boolean);
    if (!el || !(modelos.length || productos.length) || typeof IntersectionObserver !== "function") return undefined;
    if (perfil.datosCaros || gpuFallo()) return undefined;
    const precargar = () => {
      obs.disconnect();
      if (gpuFallo()) return;
      import("../three/ProductViewer")
        .then(({ preloadProducto }) => Promise.all(productos.map(preloadProducto)))
        .catch((e) => console.warn("[singularity] precarga de productos 3D", e))
        .then(() => (modelos.length ? import("../three/ModelViewer") : null))
        .then((m) => m && modelos.forEach(m.preloadModel))
        .catch((e) => console.warn("[singularity] precarga de modelos 3D", e));
    };
    const obs = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) precargar();
    }, { rootMargin: contenido ? "0px 0px 100% 0px" : "0px 0px 1500px 0px" });
    const areas = document.getElementById("services");
    if (areas && !contenido) obs.observe(areas);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const visible = useMemo(
    () => (filter === "all" ? projects : projects.filter((p) => p.category === filter)),
    [filter]
  );

  const categoryLabel = (id) => {
    const found = projectCategories.find((c) => c.id === id);
    return found ? tr(found.label) : id;
  };

  return (
    <section id="projects" className="section" ref={seccion}>
      <div className="shell">
        <div className="projects__head">
          <GhostHeading className="display display--lg">
            {tr(sections.projects.heading)}
          </GhostHeading>
        </div>

        {/* Grupo de botones de dos estados, NO pestañas. El patron `tab`
            exige un `tabpanel` al que apuntar y navegacion con flechas, y
            aqui no hay ni una cosa ni la otra: esto filtra una lista. Con
            `role="tab"` puesto, un lector de pantalla anunciaba pestañas que
            no llevan a ningun sitio. */}
        <div className="filters" role="group" aria-label={tr(ui.categories)}>
          <button
            type="button"
            className="filters__btn"
            aria-pressed={filter === "all"}
            onClick={() => {
              setFilter("all");
              setOpen(0);
            }}
          >
            {tr(ui.allProjects)}
            <sup>{projects.length}</sup>
          </button>

          {projectCategories.map((c) => {
            const count = projects.filter((p) => p.category === c.id).length;
            return (
              <button
                key={c.id}
                type="button"
                className="filters__btn"
                aria-pressed={filter === c.id}
                onClick={() => {
                  setFilter(c.id);
                  setOpen(0);
                }}
              >
                {tr(c.label)}
                <sup>{count}</sup>
              </button>
            );
          })}
        </div>

        <div className="proj">
          {visible.map((p, i) => {
            const isOpen = open === i;
            const name = tr(p.name);
            const clips = p.clips || [];
            const escena = Boolean(p.model && p.video);
            // Una sola imagen que acompana al texto, en vez de ir debajo.
            const lado = !escena && p.mediaLado && p.media.length > 0 ? p.media[0] : null;
            // Un producto en 3D (el dron, su empaque) va al lado del texto.
            const producto = !escena && !lado ? p.producto3d : null;
            return (
              <article className="proj__row" key={p.name.en} data-open={isOpen ? "true" : "false"} style={{ "--i": i }}>
                <button
                  type="button"
                  id={`proj-btn-${i}`}
                  className="proj__btn"
                  aria-expanded={isOpen}
                  aria-controls={`proj-panel-${i}`}
                  onClick={(e) => alternar(i, e.currentTarget)}
                >
                  <span className="proj__num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="proj__id">
                    <span className="proj__client">
                      {categoryLabel(p.category)}
                      {p.year ? ` · ${p.year}` : ""}
                    </span>
                    <span className="proj__name">{name}</span>
                  </span>
                  <span className="acc__sign" aria-hidden="true">
                    +
                  </span>
                </button>

                {/* Cerrada, la ficha sigue en el DOM (el plegado se anima),
                    pero `inert` la saca del tabulador y de los lectores: sus
                    enlaces ya no reciben foco estando ocultos. */}
                <div className="proj__panel" id={`proj-panel-${i}`} role="region" aria-labelledby={`proj-btn-${i}`} aria-hidden={!isOpen} inert={!isOpen}>
                  <div>
                    {/* Con modelo y video, o con una imagen que va al lado,
                        la cabecera se parte en dos: texto y medio. */}
                    <div className={escena || lado || producto ? "proj__cabeza proj__cabeza--escena" : "proj__cabeza"}>
                    <div className="proj__body">
                      {/* Una linea en blanco en el texto separa parrafos. */}
                      {tr(p.desc).split("\n\n").map((parrafo, k) => (
                        <p key={k} className="proj__desc">{parrafo}</p>
                      ))}

                      <div className="proj__tags">
                        {p.tags.map((tag) => (
                          <span key={tag.en || tag}>{tr(tag)}</span>
                        ))}
                      </div>

                      {/* El enlace principal y, detras, los documentos que el
                          proyecto tenga que ensenar (p. ej. un plano por pieza),
                          todos en la misma fila. */}
                      {p.href || p.links?.length ? (
                        <div className="proj__links">
                          {p.href ? (
                            <a className="proj__live" href={p.href} target="_blank" rel="noreferrer noopener">
                              {tr(p.hrefLabel || (p.href.includes("github.com") ? ui.viewRepo : ui.viewProject))}
                            </a>
                          ) : null}
                          {(p.links || []).map((l) => (
                            <a key={l.href} className="proj__live" href={asset(l.href)} target="_blank" rel="noreferrer noopener">
                              {tr(l.label)}
                            </a>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    {/* El modelo se monta SOLO con el proyecto desplegado: el
                        .glb pesa megabytes y no se le descarga a quien no lo
                        ha pedido. Al cerrar se desmonta y suelta la memoria. */}
                    {escena && isOpen ? <Escena p={p} name={name} /> : null}
                    {producto && isOpen ? (
                      <Suspense fallback={<Espera3D tr={tr} />}>
                        <ProductViewer model={producto.model} despiece={producto.despiece} colores={producto.colores} giro={producto.giro} vaiven={producto.vaiven}
                          label={`${name} · ${tr(ui.model3d)} · ${tr(ui.dragToRotate)}`} />
                      </Suspense>
                    ) : null}
                    {lado ? (
                      <figure className="proj__lado">
                        <Placeholder src={lado.src} alt={lado.alt ? tr(lado.alt) : name} />
                      </figure>
                    ) : null}
                    </div>

                    {/* El modelo se monta SOLO con el proyecto desplegado: el
                        .glb pesa megabytes y no se le descarga a quien no lo
                        ha pedido. Al cerrar se desmonta y suelta la memoria. */}
                    {!escena && isOpen && (p.model || p.video || clips.length) ? (
                      <div className={`proj__interactive${clips.length > 1 ? " proj__interactive--pares" : ""}`}>
                        {p.model ? (
                          <Suspense fallback={<Espera3D tr={tr} />}>
                            <ModelViewer
                              model={p.model}
                              label={`${name} · ${tr(ui.model3d)}`}
                              hint={tr(ui.modelDrag)}
                            />
                          </Suspense>
                        ) : null}

                        {p.video ? (
                          <VideoEmbed
                            id={p.video}
                            poster={p.videoPoster}
                            title={name}
                            label={tr(ui.playVideo)}
                            note={tr(ui.videoNote)}
                          />
                        ) : null}

                        {clips.map((c) => (
                          <VideoEmbed key={c.src} src={c.src} poster={c.poster} title={tr(c.title)} />
                        ))}
                      </div>
                    ) : null}

                    {p.media.length > 0 && !lado && <div className={`proj__media${p.media.length === 1 ? " proj__media--solo" : ""}`}>
                      {p.media.map((m, j) => (
                        <figure key={j} className={m.fit === "contain" ? "proj__figura--entera" : undefined}>
                          <Placeholder
                            palette={m.palette}
                            seed={i * 3 + j}
                            src={m.src}
                            alt={m.alt ? tr(m.alt) : `${name} ${j + 1}`}
                          />
                        </figure>
                      ))}
                    </div>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
