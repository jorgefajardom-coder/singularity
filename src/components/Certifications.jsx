import { Suspense, lazy } from "react";
import { certifications, props3d, sections } from "../data/content";

const PropsView = lazy(() =>
  import("../three/Props3D").then((m) => ({ default: m.PropsView }))
);
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";
import SplitText from "./SplitText";

/**
 * Certificaciones y formación.
 * La lista vive en `certifications.items` dentro de src/data/content.js.
 * Si un item trae `href`, la tarjeta se vuelve un enlace al certificado.
 */
export default function Certifications() {
  const { tr } = useLang();
  const items = certifications.items ?? [];

  if (!items.length) return null;

  return (
    <section id="certifications" className="section certs">
      <Suspense fallback={null}>
        <PropsView className="certs__view" items={props3d.certs} parallax={-0.4} />
      </Suspense>

      <div className="shell" style={{ textAlign: "center" }}>
        <GhostHeading className="display display--md">{tr(sections.certifications.heading)}</GhostHeading>
        <SplitText className="certs__note" variant="blur">
          {tr(sections.certifications.note)}
        </SplitText>
      </div>

      <div className="shell">
        <div className="certs__grid" data-reveal="stagger">
          {items.map((c, i) => {
            const title = tr(c.title);
            const Tag = c.href ? "a" : "div";

            return (
              <Tag
                className="cert"
                key={`${title}-${i}`}
                {...(c.href
                  ? { href: c.href, target: "_blank", rel: "noreferrer noopener" }
                  : {})}
              >
                <span className="cert__year">{c.year || ""}</span>
                <h3 className="cert__title">{title}</h3>
                <p className="cert__issuer">{tr(c.issuer)}</p>
                {c.href ? (
                  <span className="cert__link" aria-hidden="true">
                    ↗
                  </span>
                ) : null}
              </Tag>
            );
          })}
        </div>
      </div>
    </section>
  );
}
