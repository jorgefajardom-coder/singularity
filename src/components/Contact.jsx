import { Suspense, lazy, useState } from "react";
import { site, props3d, sections, ui } from "../data/content";

const PropsView = lazy(() =>
  import("../three/Props3D").then((m) => ({ default: m.PropsView }))
);
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";
import SplitText from "./SplitText";
import { enlaceCorreo } from "../lib/correo";

/** El mismo mensaje ya escrito, para el enlace de respaldo. */
function comoCorreo(data) {
  const phone = String(data.get("phone") || "").trim();
  return enlaceCorreo(site.email, {
    asunto: `Portfolio: ${data.get("name") || ""}`,
    cuerpo: `${data.get("name") || ""}\n${data.get("email") || ""}${phone ? `\n${phone}` : ""}\n\n${data.get("message") || ""}`,
  });
}

/**
 * El formulario envia a un Google Apps Script de Jorge (`site.formEndpoint`),
 * que manda el mensaje a su Gmail: gratis y sin servidor propio.
 *
 * Va como `application/x-www-form-urlencoded`, que es una peticion "simple":
 * sin preflight CORS, que Apps Script no contesta. El script responde
 * `{ ok, error }` con `Access-Control-Allow-Origin: *`, asi que se puede leer.
 *
 * Si falla (sin red, el script caido, el limite de envios), el mensaje no se
 * pierde: aparece el correo como enlace (Gmail en computador, la app de
 * correo en el telefono, ver lib/correo.js) que ya lleva lo escrito.
 */
export default function Contact() {
  const { tr } = useLang();
  // "listo" | "enviando" | "enviado" | "error" | "limite"
  const [estado, setEstado] = useState("listo");
  const [respaldo, setRespaldo] = useState(() => enlaceCorreo(site.email));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (estado === "enviando") return;
    const form = e.currentTarget;
    const data = new FormData(form);
    setRespaldo(comoCorreo(data));
    // Campo trampa: una persona no lo ve ni lo rellena.
    if (String(data.get("sitio") || "")) {
      setEstado("enviado");
      form.reset();
      return;
    }
    setEstado("enviando");
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 20000);
    try {
      const r = await fetch(site.formEndpoint, {
        method: "POST",
        body: new URLSearchParams(data),
        signal: corte.signal,
      });
      const json = await r.json().catch(() => ({}));
      if (r.ok && json.ok) {
        setEstado("enviado");
        form.reset();
      } else if (json.error === "limite") {
        setEstado("limite");
      } else {
        console.error("[singularity] el formulario no se envio", r.status, json);
        setEstado("error");
      }
    } catch (error) {
      console.error("[singularity] el formulario no se envio", error);
      setEstado("error");
    } finally {
      clearTimeout(reloj);
    }
  };

  // Al volver a escribir, el aviso anterior se retira.
  const onInput = () => {
    if (estado !== "enviando" && estado !== "listo") setEstado("listo");
  };

  return (
    <section id="contact" className="section">
      <div className="shell">
        <div className="panel panel--paper contact">
          <Suspense fallback={null}>
            <PropsView className="contact__view" items={props3d.contact} parallax={0.3} />
          </Suspense>

          <div className="contact__left">
            <GhostHeading className="display display--md">
              {tr(sections.contact.heading)}
            </GhostHeading>

            <a className="contact__mail" {...enlaceCorreo(site.email)}>
              {site.email}
            </a>

            <SplitText className="contact__note" variant="scrub">
              {tr(sections.contact.note)}
            </SplitText>
          </div>

          <form className="contact__form" onSubmit={onSubmit} onInput={onInput} aria-busy={estado === "enviando"}>
            {/* Trampa para bots: fuera de la vista, del tabulador y de los
                lectores de pantalla. Si llega rellena, no se envia nada. */}
            <div className="contact__trampa" aria-hidden="true">
              <label htmlFor="sitio">Sitio web</label>
              <input id="sitio" name="sitio" type="text" tabIndex={-1} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="name">{tr(ui.formName)}</label>
              <input id="name" name="name" type="text" required autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="email">{tr(ui.formEmail)}</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="phone">{tr(ui.formPhone)}</label>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel"
                pattern="[0-9+\(\)\-\s]{7,20}" title={tr({ es: "Solo números, espacios y + ( ) -", en: "Digits, spaces and + ( ) - only" })} />
            </div>
            <div className="field">
              <label htmlFor="message">{tr(ui.formMessage)}</label>
              <textarea id="message" name="message" rows={4} required />
            </div>
            <button className="btn btn--ink" type="submit" disabled={estado === "enviando"}>
              {tr(estado === "enviando" ? ui.sending : ui.send)}
            </button>
            <p className="contact__estado" role="status" aria-live="polite" data-estado={estado}>
              {estado === "enviado" ? tr(ui.sent) : null}
              {estado === "error" || estado === "limite" ? (
                <>
                  {tr(estado === "limite" ? ui.sendLimit : ui.sendError)}{" "}
                  <a {...respaldo}>{site.email}</a>
                </>
              ) : null}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
