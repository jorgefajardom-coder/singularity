import { useEffect, useMemo, useRef, useState } from "react";
import { projects, projectCategories, sections, ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { GhostHeading, Placeholder, RollText } from "./ui";
import { gsap, prefersReducedMotion } from "../lib/anim";

export default function Projects() {
  const { tr } = useLang();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(0);
  const listRef = useRef(null);

  const visible = useMemo(
    () => (filter === "all" ? projects : projects.filter((p) => p.category === filter)),
    [filter]
  );

  // Al cambiar de filtro, las filas entran escalonadas
  useEffect(() => {
    if (prefersReducedMotion() || !listRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".proj__row",
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", stagger: 0.05, overwrite: "auto" }
      );
    }, listRef);
    return () => ctx.revert();
  }, [filter]);

  const categoryLabel = (id) => {
    const found = projectCategories.find((c) => c.id === id);
    return found ? tr(found.label) : id;
  };

  return (
    <section id="projects" className="section">
      <div className="shell">
        <div className="projects__head">
          <GhostHeading className="display display--lg">
            {tr(sections.projects.heading)}
          </GhostHeading>
        </div>

        <div className="filters" role="tablist" aria-label={tr(ui.categories)}>
          <button
            role="tab"
            className="filters__btn"
            aria-selected={filter === "all"}
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
                role="tab"
                className="filters__btn"
                aria-selected={filter === c.id}
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

        <div className="proj" ref={listRef}>
          {visible.map((p, i) => {
            const isOpen = open === i;
            return (
              <article className="proj__row" key={p.name} data-open={isOpen ? "true" : "false"}>
                <button
                  className="proj__btn"
                  aria-expanded={isOpen}
                  onClick={() => setOpen(isOpen ? -1 : i)}
                >
                  <span className="proj__num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="proj__id">
                    <span className="proj__client">
                      {categoryLabel(p.category)}
                      {p.year ? ` · ${p.year}` : ""}
                    </span>
                    <span className="proj__name">
                      <RollText>{p.name}</RollText>
                    </span>
                  </span>
                  <span className="acc__sign" aria-hidden="true">
                    +
                  </span>
                </button>

                <div className="proj__panel">
                  <div>
                    <div className="proj__body">
                      <p className="proj__desc">{tr(p.desc)}</p>

                      <div className="proj__tags">
                        {p.tags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>

                      {p.href ? (
                        <a
                          className="proj__live"
                          href={p.href}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          {tr(ui.viewProject)}
                        </a>
                      ) : null}
                    </div>

                    <div className="proj__media">
                      {p.media.map((m, j) => (
                        <figure key={j}>
                          <Placeholder
                            palette={m.palette}
                            seed={i * 3 + j}
                            src={m.src}
                            alt={`${p.name} ${j + 1}`}
                          />
                        </figure>
                      ))}
                    </div>
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
