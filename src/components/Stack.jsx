import { useEffect, useRef, useState } from "react";
import { sections, stack, ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";
import StackArt from "./StackArt";

/**
 * Stack como una pared de posteres: uno por area, quietos y legibles a la
 * vez, en una fila que se recorre en horizontal (rueda o gesto lateral,
 * arrastre con el raton, flechas o el dedo).
 *
 * Sustituye a los dos carriles de tarjetas que se desplazaban solos: lucian,
 * pero el texto nunca estaba quieto y en una pantalla baja la segunda fila
 * quedaba cortada. Un stack se consulta buscando algo ("¿sabe CODESYS?"), asi
 * que todo tiene que poder leerse sin esperar a que pase.
 *
 * Cada poster es una lamina de exploracion espacial con ilustracion retro.
 */
export default function Stack() {
  const { tr } = useLang();
  const fila = useRef(null);
  const [bordes, setBordes] = useState({ inicio: true, fin: false });

  // Observar la ilustracion (no toda la tarjeta) tambien funciona en pantallas bajas.
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        target.closest(".poster").classList.toggle("is-art-visible", isIntersecting);
      });
    }, { threshold: 0.55 });
    fila.current?.querySelectorAll(".poster__arte").forEach((art) => observer.observe(art));
    return () => observer.disconnect();
  }, []);

  // Estado de las flechas: apagadas en los extremos.
  useEffect(() => {
    const el = fila.current;
    if (!el) return undefined;
    const medir = () => setBordes({
      inicio: el.scrollLeft <= 4,
      fin: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
    });
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => { el.removeEventListener("scroll", medir); window.removeEventListener("resize", medir); };
  }, []);

  // Arrastrar con el raton, como se haria con el dedo. Solo raton: en tactil
  // el desplazamiento nativo ya lo hace, y mejor.
  useEffect(() => {
    const el = fila.current;
    if (!el) return undefined;
    let x0 = 0, s0 = 0, arrastrando = false;
    const abajo = (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      arrastrando = true;
      x0 = e.clientX;
      s0 = el.scrollLeft;
      el.classList.add("is-arrastrando");
    };
    const mueve = (e) => { if (arrastrando) el.scrollLeft = s0 - (e.clientX - x0); };
    const suelta = () => { arrastrando = false; el.classList.remove("is-arrastrando"); };
    el.addEventListener("pointerdown", abajo);
    window.addEventListener("pointermove", mueve);
    window.addEventListener("pointerup", suelta);
    return () => {
      el.removeEventListener("pointerdown", abajo);
      window.removeEventListener("pointermove", mueve);
      window.removeEventListener("pointerup", suelta);
    };
  }, []);

  const pasar = (sentido) => {
    const el = fila.current;
    const poster = el?.querySelector(".poster");
    if (!el || !poster) return;
    const paso = poster.getBoundingClientRect().width + parseFloat(getComputedStyle(el).columnGap || 0);
    el.scrollBy({ left: sentido * paso * 2, behavior: "smooth" });
  };

  return (
    <section id="stack" className="section stack">
      <div className="shell stack__head">
        <GhostHeading className="display display--lg">{tr(sections.stack.heading)}</GhostHeading>
        <div className="stack__nav">
          <button type="button" className="stack__flecha" onClick={() => pasar(-1)} disabled={bordes.inicio}
            aria-label={tr(ui.stackPrev)}>←</button>
          <button type="button" className="stack__flecha" onClick={() => pasar(1)} disabled={bordes.fin}
            aria-label={tr(ui.stackNext)}>→</button>
        </div>
      </div>

      {/* `data-lenis-prevent-horizontal`: el gesto lateral del trackpad lo
          lleva el navegador sobre la fila; el vertical sigue siendo de Lenis
          y mueve la pagina, no se lo come la fila. */}
      <div className="posters" ref={fila} tabIndex={0} role="region" aria-label={tr(sections.stack.heading)}
        data-lenis-prevent-horizontal="">
        {stack.map((g, i) => (
          <article className="poster" key={g.key} data-area={g.key}>
            <div className="poster__arte" aria-hidden="true">
              <StackArt area={g.key} />
              <span className="poster__destellos"><i /><i /><i /></span>
            </div>
            <header className="poster__cabeza">
              <h3 className="poster__titulo">{tr(g.group)}</h3>
            </header>
            <ul className={`poster__lista${g.items.length > 6 ? " poster__lista--dos" : ""}`}>
              {g.items.map((item) => <li key={item.name}>{item.name}</li>)}
            </ul>
            <footer className="poster__pie" aria-hidden="true">
              <span>VOL. {String(i + 1).padStart(2, "0")}</span>
              <span className="poster__estrellas">✦ ✦ ✦</span>
              <span>{String(g.items.length).padStart(2, "0")} / {tr({ es: "HERRAMIENTAS", en: "TOOLS" })}</span>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}
