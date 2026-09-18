import { useState } from "react";
import { sections, services } from "../data/content";
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";
import SplitText from "./SplitText";

/** Panel claro que sube sobre el fondo oscuro, con acordeón numerado. */
export default function Services() {
  const { tr } = useLang();
  const [open, setOpen] = useState(0);

  return (
    <section id="services" className="section">
      <div className="shell">
        <div className="panel panel--paper services">
          <div className="services__head">
            <GhostHeading className="display display--lg">
              {tr(sections.services.heading)}
            </GhostHeading>
            <SplitText className="services__note" variant="blur">
              {tr(sections.services.note)}
            </SplitText>
          </div>

          <div className="acc">
            {services.map((s, i) => {
              const isOpen = open === i;
              const title = tr(s.title);
              return (
                <div className="acc__row" key={title} data-open={isOpen ? "true" : "false"}>
                  <button
                    className="acc__btn"
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    <span className="acc__num">{String(i + 1).padStart(2, "0")}</span>
                    <span className="acc__title">{title}</span>
                    <span className="acc__sign" aria-hidden="true">
                      +
                    </span>
                  </button>

                  <div className="acc__panel">
                    <div>
                      <div className="acc__content">
                        <p className="acc__desc">{tr(s.desc)}</p>
                        <div className="acc__tags">
                          {s.tags.map((tag) => (
                            <span key={tag}>{tag}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
