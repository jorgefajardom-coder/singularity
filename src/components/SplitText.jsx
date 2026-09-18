import { useLayoutEffect, useRef } from "react";
import { gsap, prefersReducedMotion } from "../lib/anim";

/**
 * Texto partido en palabras o letras para animarlo pieza a pieza.
 *
 * El corte se hace en JSX (no manipulando el DOM a posteriori) para que al
 * cambiar de idioma React vuelva a montar las piezas solo. El texto real se
 * esconde de los lectores de pantalla y se expone entero en `aria-label`:
 * de otro modo un `chars` se leería letra por letra.
 *
 *   <SplitText variant="rise">Texto</SplitText>
 *
 * variantes:
 *   rise   palabras que suben desde una máscara      (titulares, ledes)
 *   chars  letra a letra desde la máscara            (frases cortas)
 *   blur   palabras que entran desenfocadas          (notas, apoyos)
 *   scrub  palabras que se encienden con el scroll   (párrafos largos)
 */

const VARIANTS = {
  rise: {
    unit: "word",
    mask: true,
    from: { yPercent: 116 },
    to: { yPercent: 0, duration: 0.95, ease: "power4.out" },
    stagger: 0.045,
  },
  chars: {
    unit: "char",
    mask: true,
    from: { yPercent: 112 },
    to: { yPercent: 0, duration: 0.8, ease: "power4.out" },
    stagger: 0.022,
  },
  blur: {
    unit: "word",
    mask: false,
    from: { opacity: 0, y: 16, filter: "blur(10px)" },
    to: { opacity: 1, y: 0, filter: "blur(0px)", duration: 1, ease: "power2.out" },
    stagger: 0.05,
  },
  scrub: {
    unit: "word",
    mask: false,
    from: { opacity: 0.16 },
    to: { opacity: 1, ease: "none" },
    stagger: 0.4,
  },
};

/** Parte en palabras conservando los espacios: así el texto sigue fluyendo. */
const toWords = (text) => String(text).split(/(\s+)/).filter(Boolean);

export default function SplitText({
  children,
  as: Tag = "p",
  className = "",
  variant = "rise",
  // "scroll" espera a que el bloque entre en pantalla; "mount" arranca solo.
  trigger = "scroll",
  delay = 0,
  stagger,
  dimOpacity = 0.16,
  start = "top 85%",
  end = "bottom 60%",
  ...rest
}) {
  const ref = useRef(null);
  const text = String(children ?? "");
  const spec = VARIANTS[variant] ?? VARIANTS.rise;

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const pieces = el.querySelectorAll(".split__move");
    if (!pieces.length) return;

    if (prefersReducedMotion()) {
      gsap.set(pieces, { opacity: 1, y: 0, yPercent: 0, rotateX: 0, filter: "none" });
      return;
    }

    const ctx = gsap.context(() => {
      const scrubbed = variant === "scrub";
      gsap.fromTo(pieces, scrubbed ? { ...spec.from, opacity: dimOpacity } : spec.from, {
        ...spec.to,
        delay: scrubbed ? 0 : delay,
        stagger: stagger ?? spec.stagger,
        scrollTrigger:
          trigger === "mount"
            ? undefined
            : {
                trigger: el,
                start,
                end: scrubbed ? end : undefined,
                scrub: scrubbed ? 0.5 : false,
                // Sin `once`: al volver a subir el texto se repliega y puede
                // entrar de nuevo, en cualquiera de los dos idiomas.
                toggleActions: scrubbed ? undefined : "play none none reverse",
              },
      });
    }, el);

    return () => ctx.revert();
    // `text` en las dependencias: al cambiar de idioma hay piezas nuevas.
  }, [text, variant, trigger, delay, stagger, start, end, dimOpacity]);

  const pieces = toWords(text).map((word, i) => {
    // Los espacios viajan sueltos, sin animar: son el aire entre palabras.
    if (!word.trim()) return <span key={i}> </span>;

    const move = (content, key) => (
      <span className={spec.mask ? "split__mask" : "split__plain"} key={key}>
        <span className="split__move">{content}</span>
      </span>
    );

    if (spec.unit === "char") {
      return (
        <span className="split__word" key={i}>
          {[...word].map((char, j) => move(char, j))}
        </span>
      );
    }

    return <span className="split__word" key={i}>{move(word, "w")}</span>;
  });

  return (
    <Tag
      ref={ref}
      className={`split split--${variant} ${className}`.trim()}
      aria-label={text}
      {...rest}
    >
      <span aria-hidden="true">{pieces}</span>
    </Tag>
  );
}
