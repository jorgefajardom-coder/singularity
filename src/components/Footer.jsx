import { site, socials, nav, ui } from "../data/content";
import { useLang } from "../lib/i18n";

const SHAPES = [
  { clip: "polygon(50% 0, 100% 100%, 0 100%)", color: "#a82405" },
  { clip: "circle(50% at 50% 50%)", color: "#db3208" },
  { clip: "polygon(0 0, 100% 0, 100% 100%)", color: "#ff8224" },
  { clip: "ellipse(50% 32% at 50% 50%)", color: "#ff9a3c" },
  { clip: "polygon(0 100%, 50% 0, 100% 100%)", color: "#ff6a12" },
  { clip: "circle(50% at 50% 50%)", color: "#ffb066" },
];

export default function Footer() {
  const { tr } = useLang();

  return (
    <footer className="footer">
      <div className="shell">
        <h2 className="display display--lg footer__name ghost">
          <span className="ghost__outline">{site.name}</span>
        </h2>

        <div className="footer__cols">
          <div className="footer__col">
            <h4>{tr(ui.navigation)}</h4>
            {nav.map((n) => (
              <a key={n.href} href={n.href}>
                {tr(n.label)}
              </a>
            ))}
          </div>

          <div className="footer__col">
            <h4>{tr(ui.social)}</h4>
            {socials.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer noopener">
                {s.label}
              </a>
            ))}
          </div>

          <div className="footer__col">
            <h4>{tr(ui.contact)}</h4>
            <a href={`mailto:${site.email}`}>{site.email}</a>
            <span>{tr(site.location)}</span>
            <span>{tr(site.role)}</span>
          </div>
        </div>

        <div className="footer__shapes" aria-hidden="true">
          {SHAPES.map((s, i) => (
            <i key={i} style={{ background: s.color, clipPath: s.clip }} />
          ))}
        </div>

        <div className="footer__legal">
          <span>
            © {new Date().getFullYear()} {site.fullName}
          </span>
          <span>{tr(ui.builtWith)}</span>
        </div>
      </div>
    </footer>
  );
}
