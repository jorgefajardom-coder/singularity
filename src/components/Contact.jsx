import { site, props3d, ui } from "../data/content";
import { PropsView } from "../three/Props3D";
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";
import SplitText from "./SplitText";

/**
 * El formulario NO tiene backend: abre el cliente de correo.
 * Si quieres recibirlos en tu bandeja sin servidor, crea un form en
 * Formspree / Basin y cambia esto por un `action` con su URL y method="post".
 */
export default function Contact() {
  const { tr } = useLang();

  const onSubmit = (e) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const subject = encodeURIComponent(`Portfolio: ${data.get("name") || ""}`);
    const body = encodeURIComponent(
      `${data.get("name") || ""}\n${data.get("email") || ""}\n\n${data.get("message") || ""}`
    );
    window.location.href = `mailto:${site.email}?subject=${subject}&body=${body}`;
  };

  return (
    <section id="contact" className="section">
      <div className="shell">
        <div className="panel panel--paper contact">
          <PropsView className="contact__view" items={props3d.contact} parallax={0.3} />

          <div className="contact__left">
            <GhostHeading className="display display--md">
              {tr({ es: "Hablemos", en: "Let's talk" })}
            </GhostHeading>

            <a className="contact__mail" href={`mailto:${site.email}`}>
              {site.email}
            </a>

            <SplitText className="contact__note" variant="scrub">
              {tr({
                es: "Abierto a colaborar en robótica, automatización industrial e IA aplicada. LinkedIn o correo es la vía más rápida.",
                en: "Open to collaboration on robotics, industrial automation, and applied AI projects. LinkedIn or email is the fastest way to reach me.",
              })}
            </SplitText>
          </div>

          <form className="contact__form" onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="name">{tr(ui.formName)}</label>
              <input id="name" name="name" type="text" required autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="email">{tr(ui.formEmail)}</label>
              <input id="email" name="email" type="email" required autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="message">{tr(ui.formMessage)}</label>
              <textarea id="message" name="message" rows={4} required />
            </div>
            <button className="btn btn--ink" type="submit">
              {tr(ui.send)}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
