import { useEffect, useRef, useState } from "react";
import { sections, stack, ui } from "../data/content";
import { useLang } from "../lib/i18n";
import { ScrollTrigger, gsap, prefersReducedMotion, scroller } from "../lib/anim";
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
export default function Stack({ sequence }) {
  const { tr } = useLang();
  const fila = useRef(null);
  const seccion = useRef(null);
  const [bordes, setBordes] = useState({ inicio: true, fin: false });
  const reduced = prefersReducedMotion();

  // Se reparten como una mano de cartas: salen de debajo de la primera, una
  // detras de otra, y se abren hasta su sitio. El scroll solo lleva el
  // estampado del agujero en la portada; en cuanto termina, la baraja se
  // reparte SOLA (por tiempo), y al volver a subir se recoge sola. Solo en horizontal: la fila es `overflow-x` y recorta
  // en vertical. Van por `translate`/`rotate`/`scale` sueltos para no pisar el
  // `transform` del CSS, que es el de flotar y el de inclinarse al pasar.
  useEffect(() => {
    const el = fila.current;
    if (reduced || !el || !seccion.current) return undefined;
    const cartas = [...el.querySelectorAll(".poster")];
    const repartir = (p) => {
      const n = cartas.length;
      const base = cartas[0].offsetLeft;
      cartas.forEach((carta, i) => {
        const retraso = n > 1 ? (i / (n - 1)) * 0.5 : 0;
        const t = Math.min(1, Math.max(0, (p - retraso) / 0.5));
        const e = t * t * (3 - 2 * t);
        if (i === 0) {
          carta.style.zIndex = String(n + 1);
          return;
        }
        if (e >= 1) {
          carta.style.translate = carta.style.rotate = carta.style.scale = carta.style.zIndex = "";
          return;
        }
        const dx = (base - carta.offsetLeft) * (1 - e);
        carta.style.translate = `${dx}px 0`;
        carta.style.rotate = `${(1 - e) * (i % 2 ? 5 : -4)}deg`;
        carta.style.scale = String(0.94 + 0.06 * e);
        carta.style.zIndex = String(n - i);
      });
    };
    const reparto = { d: 0, meta: 0 };
    let tween = null;
    let vuelta = null;
    // Mientras se reparten, la pagina no se mueve: que se vea la baraja
    // abrirse entera antes de seguir. Mismo cerrojo que el de la aureola
    // (Halo.jsx): se para Lenis y ademas se devuelve a su sitio cualquier
    // desplazamiento por codigo (un enlace del menu), porque la seccion esta
    // fijada y si la pagina se corre las cartas se irian de la pantalla.
    let anclaje = null;
    const sujetar = () => { if (anclaje !== null && Math.abs(window.scrollY - anclaje) > 1) window.scrollTo(0, anclaje); };
    // Solo con la barra de la fila ya entera en pantalla: bloquear antes
    // dejaba la pagina parada con la barra todavia entrando por abajo.
    const barraVisible = () => el.getBoundingClientRect().bottom <= window.innerHeight + 1;
    const bloquear = () => {
      if (anclaje !== null || !barraVisible()) return;
      anclaje = window.scrollY;
      scroller.current?.stop();
      window.addEventListener("scroll", sujetar, { passive: true });
    };
    const soltar = () => {
      if (anclaje === null) return;
      anclaje = null;
      window.removeEventListener("scroll", sujetar);
      scroller.current?.start();
    };
    const ir = (meta) => {
      if (reparto.meta === meta) return;
      reparto.meta = meta;
      tween?.kill();
      vuelta?.kill();
      // La baraja se recoge y se reparte desde la PRIMERA carta. Si la fila se
      // habia corrido, al volver a subir se recogia fuera de la pantalla y al
      // bajar la fila aparecia vacia. Al recogerse, la fila vuelve al
      // principio a la vez que las cartas; al repartir, se asegura.
      if (meta) el.scrollLeft = 0;
      else if (el.scrollLeft > 0) vuelta = gsap.to(el, { scrollLeft: 0, duration: 0.8, ease: "power2.inOut" });
      if (meta) bloquear();
      else soltar();
      tween = gsap.to(reparto, {
        d: meta,
        duration: meta ? 1.4 : 0.8,
        ease: meta ? "power2.out" : "power2.inOut",
        onUpdate: () => {
          repartir(reparto.d);
          // Si arranco con la barra aun entrando, se bloquea en cuanto asome.
          if (meta && reparto.d < 0.9) bloquear();
        },
        onComplete: soltar,
      });
    };
    // El fijado solo cubre ya el estampado. `sequence` (que lee Stage.jsx
    // para el agujero) va a la mitad del progreso para que el estampado ocupe
    // el mismo recorrido de scroll que cuando el fijado medía 110 %.
    const pasar = (p) => {
      if (sequence) sequence.current = Math.min(1, p * 0.5);
      // El estampado acaba en p = 0.4 (sequence 0.2): en ese instante se
      // reparten, sin pedir mas scroll. Algo de margen para recogerlas, para
      // que no tiemblen si el scroll se para justo en el borde.
      if (p >= 0.4) ir(1);
      else if (p < 0.34) ir(0);
    };
    const st = ScrollTrigger.create({
      trigger: seccion.current,
      start: "bottom bottom",
      end: "+=55%",
      pin: true,
      anticipatePin: 1,
      scrub: true,
      onUpdate: (self) => pasar(self.progress),
      // Al cambiar el tamano de la ventana las posiciones de la baraja (en px)
      // se quedaban viejas y las cartas apiladas salian desalineadas.
      onRefresh: (self) => { pasar(self.progress); repartir(reparto.d); },
    });
    repartir(0);
    pasar(st.progress);
    return () => {
      tween?.kill();
      vuelta?.kill();
      soltar();
      st.kill();
      cartas.forEach((c) => { c.style.translate = c.style.rotate = c.style.scale = c.style.zIndex = ""; });
    };
  }, [reduced, sequence]);

  // Al pasar por encima, la carta se levanta y se inclina hacia el puntero,
  // como si se la tuviera en la mano.
  useEffect(() => {
    const el = fila.current;
    if (reduced || !el || !window.matchMedia("(hover: hover)").matches) return undefined;
    const mover = (e) => {
      const carta = e.target.closest(".poster");
      if (!carta || el.classList.contains("is-arrastrando")) return;
      const r = carta.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      carta.style.setProperty("--ry", `${(x * 10).toFixed(2)}deg`);
      carta.style.setProperty("--rx", `${(-y * 8).toFixed(2)}deg`);
    };
    const soltar = (e) => {
      const carta = e.target.closest?.(".poster");
      if (carta && !carta.contains(e.relatedTarget)) {
        carta.style.removeProperty("--rx");
        carta.style.removeProperty("--ry");
      }
    };
    el.addEventListener("pointermove", mover);
    el.addEventListener("pointerout", soltar);
    return () => { el.removeEventListener("pointermove", mover); el.removeEventListener("pointerout", soltar); };
  }, [reduced]);

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
      // Sobre la barra de desplazamiento manda la barra. Si no, las dos
      // movian la fila a la vez y en sentidos contrarios (arrastrar la barra a
      // la derecha empujaba las cartas a la izquierda) y la barra "saltaba".
      const caja = el.getBoundingClientRect();
      if (e.clientY > caja.top + el.clientTop + el.clientHeight) return;
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
    <section id="stack" className="section stack" ref={seccion}>
      <div className="shell stack__head">
        {/* El STACK grande ya no se ve: lo dice la carta de portada. Se queda
            el titulo para lectores de pantalla, que la seccion lo necesita. */}
        <h2 className="sr-only">{tr(sections.stack.heading)}</h2>
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
        data-lenis-prevent-horizontal="" data-fin={bordes.fin ? "true" : "false"}>
        <article className="poster poster--cover" style={{ "--i": 0 }} aria-label={tr({ es: "Portada del stack", en: "Stack cover" })}>
          <div className="poster__cover-art">
            <img src={`${import.meta.env.BASE_URL}images/stack-astronaut-cover.webp`} alt={tr({ es: "Astronauta de traje blanco y naranja entre órbitas", en: "Astronaut in a white and orange suit surrounded by orbits" })} width="1024" height="1536" decoding="async" />
            <h3 className="poster__cover-title">STACK</h3>
            <div className="poster__cover-hole" aria-hidden="true">
              {/* Un fotograma del propio agujero negro del sitio (el shader, de canto,
                  con fondo transparente), no un dibujo: es el mismo que llega
                  viajando y se estampa aqui. */}
              <img className="poster__stamp" src={`${import.meta.env.BASE_URL}images/stack-hole.webp`} width="720" height="218"
                alt="" decoding="async" style={reduced ? { opacity: 1, transform: "none" } : undefined} />
              <span className="poster__impact-ring" />
            </div>
          </div>
        </article>
        {stack.map((g, i) => (
          <article className="poster" key={g.key} data-area={g.key} style={{ "--i": i + 1 }}>
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
