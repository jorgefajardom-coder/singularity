import { useEffect, useRef } from "react";
import { site, disciplines, ui } from "../data/content";
import { ShapeIcon } from "./ui";
import SplitText from "./SplitText";
import { useLang } from "../lib/i18n";
import { gsap, prefersReducedMotion } from "../lib/anim";

/**
 * El agujero negro ya no vive aqui: lo monta Stage, que lo mantiene pegado al
 * viewport para que pueda viajar hasta la orbita. El hero solo aporta el
 * titular que el shader lensea (`copyRef`) y su propio texto.
 */
export default function Hero({ entered, copyRef, lensed }) {
  const { tr } = useLang();
  const root = useRef(null);

  useEffect(() => {
    if (!entered || prefersReducedMotion()) return;

    const ctx = gsap.context(() => {
      // El bloque de texto ya se anima palabra a palabra (SplitText), asi que
      // aqui solo entra el indicador de scroll.
      gsap.from(".hero__scroll", {
        opacity: 0,
        y: 24,
        duration: 0.9,
        ease: "power3.out",
        delay: 1.5,
      });
    }, root);

    return () => ctx.revert();
  }, [entered]);

  return (
    <section
      id="top"
      className={`hero hero--singularity ${lensed ? "hero--lensed" : ""}`}
      ref={root}
    >
      <div className="shell hero__inner" ref={copyRef}>
        <h1 className="display display--xl hero__title">
          <span className="hero__mask">
            <span className="hero__line" data-lens-line data-lens-group="title" data-lens-fill="#ffffff">{tr(site.hero.line1)}</span>
          </span>
          <span className="hero__mask">
            <span className="hero__line" data-lens-line data-lens-group="title" data-lens-fill="#ffffff">{tr(site.hero.line2)}</span>
          </span>
        </h1>

        <div className="hero__meta">
          {/* `key={entered}` remonta el bloque al entrar: si no, la animacion
              de montaje se gastaria detras del cargador. */}
          <div key={String(entered)}>
            <SplitText
              className="hero__role"
              variant="chars"
              trigger="mount"
              delay={0.75}
            >
              {tr(site.role)}
            </SplitText>
            <SplitText
              className="hero__lede"
              variant="rise"
              trigger="mount"
              delay={0.95}
            >
              {tr(site.hero.lede)}
            </SplitText>
          </div>
          <div className="hero__scroll">
            <i />
            {tr(ui.scroll)}
          </div>
        </div>
      </div>

      <Marquee />
    </section>
  );
}

/** Tira infinita con las disciplinas. Las herramientas van en la sección Stack. */
function Marquee() {
  const { tr } = useLang();
  // Duplicamos la lista para que el bucle sea continuo
  const items = [...disciplines, ...disciplines];

  return (
    <div className="marquee">
      <div className="marquee__track">
        {items.map((d, i) => (
          <span className="marquee__item" key={i} aria-hidden={i >= disciplines.length}>
            <ShapeIcon shape={d.shape} />
            {tr(d.name)}
          </span>
        ))}
      </div>
    </div>
  );
}
