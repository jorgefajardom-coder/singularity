import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { projects, projectCategories, sections, ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { GhostHeading, Placeholder, VideoEmbed } from "./ui";
import { asset } from "../lib/asset";

// El visor arrastra consigo el stack 3D. Se carga aparte para que no entre en
// el bundle principal de quien nunca abre un proyecto con modelo.
const ModelViewer = lazy(() => import("../three/ModelViewer"));
const ProductViewer = lazy(() => import("../three/ProductViewer"));

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
          <Suspense fallback={null}>
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
   * Los modelos 3D se bajan en segundo plano cuando el visitante se ACERCA a
   * la seccion, no cuando abre el proyecto: son megabytes, y esperar a que
   * los pida era ver "Preparando la celda 3D" cada vez. Quien tiene activado
   * el ahorro de datos o va por 2G no se lleva la descarga sin pedirla.
   */
  useEffect(() => {
    const el = seccion.current;
    const modelos = projects.map((p) => p.model).filter(Boolean);
    const productos = projects.map((p) => p.producto3d?.model).filter(Boolean);
    if (!el || !modelos.length || typeof IntersectionObserver !== "function") return undefined;
    const red = navigator.connection;
    if (red && (red.saveData || /2g/.test(red.effectiveType || ""))) return undefined;
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      import("../three/ModelViewer").then(({ preloadModel }) => modelos.forEach(preloadModel));
      import("../three/ProductViewer").then(({ preloadProducto }) => productos.forEach(preloadProducto));
    }, { rootMargin: "1500px 0px" });
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
              <article className="proj__row" key={p.name.en} data-open={isOpen ? "true" : "false"}>
                <button
                  type="button"
                  id={`proj-btn-${i}`}
                  className="proj__btn"
                  aria-expanded={isOpen}
                  aria-controls={`proj-panel-${i}`}
                  onClick={() => setOpen(isOpen ? -1 : i)}
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

                <div className="proj__panel" id={`proj-panel-${i}`} role="region" aria-labelledby={`proj-btn-${i}`} aria-hidden={!isOpen}>
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
                      <Suspense fallback={null}>
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
                          <Suspense fallback={null}>
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
                          <VideoEmbed key={c.src} src={c.src} title={tr(c.title)} />
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
