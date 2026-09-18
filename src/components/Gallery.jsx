import { useEffect, useRef } from "react";
import { gallery } from "../data/content";
import { useLang } from "../lib/i18n";
import { Placeholder } from "./ui";
import { gsap, prefersReducedMotion } from "../lib/anim";

/** Rejilla de capturas con un parallax suave por tile. */
export default function Gallery() {
  const { tr } = useLang();
  const root = useRef(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      gsap.utils.toArray(".gallery__tile").forEach((tile, i) => {
        gsap.fromTo(
          tile,
          { y: i % 2 ? 40 : 0 },
          {
            y: i % 2 ? -40 : -12,
            ease: "none",
            scrollTrigger: { trigger: tile, start: "top bottom", end: "bottom top", scrub: true },
          }
        );
      });
    }, root);

    return () => ctx.revert();
  }, []);

  return (
    <section className="section" ref={root}>
      <div className="shell">
        <div className="gallery" data-reveal="stagger">
          {gallery.map((g, i) => {
            const caption = tr(g.caption);
            return (
              <figure
                key={g.id}
                className={`gallery__tile${g.wide ? " gallery__tile--wide" : ""}`}
                style={{ margin: 0 }}
              >
                <Placeholder palette={g.palette} seed={i + 1} src={g.src} alt={caption} />
                <figcaption className="gallery__caption">{caption}</figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}
