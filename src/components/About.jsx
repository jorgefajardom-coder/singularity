import { about, props3d, sections, ui } from "../data/content";
import { PropsView } from "../three/Props3D";
import { useLang } from "../lib/i18n";
import { GhostHeading } from "./ui";
import SplitText from "./SplitText";

export default function About() {
  const { tr } = useLang();

  return (
    <section id="about" className="section about">
      {/* Objetos 3D flotando alrededor del texto */}
      <PropsView className="about__view" items={props3d.about} parallax={0.6} />

      <div className="shell">
        <GhostHeading className="display display--lg">{tr(sections.about.heading)}</GhostHeading>

        {/* El cuerpo se enciende palabra a palabra al ritmo del scroll en
            lugar de aparecer de golpe: guia la lectura. */}
        <div className="about__body">
          {about.body.map((para, i) => (
            <SplitText key={i} variant="scrub">
              {tr(para)}
            </SplitText>
          ))}
        </div>

        <div className="about__cta" data-reveal>
          <a className="btn" href="#contact">
            {tr(ui.workTogether)}
          </a>
        </div>

        <div className="about__stats" data-reveal="stagger">
          {about.stats.map((s) => (
            <div className="about__stat" key={tr(s.label)}>
              <b>{s.value}</b>
              <span>{tr(s.label)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
