import { forwardRef, useState } from "react";
import { asset } from "../lib/asset";

/**
 * Una marca de cliente: el logo recortado y, si lleva, su nombre debajo.
 *
 * La comparten la tira de logos (`Companies`, la versión sin movimiento) y las
 * marcas que orbitan el agujero negro (`Orbit`). Las dos pintan exactamente lo
 * mismo: solo cambian la clase que las coloca y, en la tira, que las copias
 * del bucle se esconden de los lectores de pantalla.
 *
 * Los logos vienen ya recortados y en gris claro (ver tools/prepare-logos.py y
 * tools/normalize-logos.py), así que se leen como un conjunto aunque cada marca
 * original tuviera un fondo distinto.
 */
const CompanyMark = forwardRef(function CompanyMark(
  { company, className, style, duplicate = false },
  ref
) {
  const Tag = company.href ? "a" : "div";
  // Si el logo no llega (red movil, bloqueo), nada de icono roto con el alt
  // encima: se retira la imagen y queda el nombre, aunque la marca lo oculte.
  const [roto, setRoto] = useState(false);

  return (
    <Tag
      ref={ref}
      className={className}
      style={style}
      title={company.name}
      {...(company.href
        ? { href: company.href, target: "_blank", rel: "noreferrer noopener" }
        : {})}
    >
      {!roto && <img
        className="company__logo"
        style={{ scale: company.logoScale ?? 1 }}
        src={asset(company.logo)}
        // Solo la primera pasada cuenta para lectores de pantalla.
        alt={duplicate ? "" : company.name}
        // Sin `loading="lazy"`: las marcas de la orbita arrancan escondidas
        // dentro del agujero (escala 0) y en Android el navegador las daba
        // por fuera de pantalla; salian como imagen rota con el alt. Son
        // cinco logos de pocos kB.
        decoding="async"
        onError={() => setRoto(true)}
      />}
      {(roto || !company.hideLabel) && (
        <span className="company__label" aria-hidden="true">
          {company.name}
        </span>
      )}
    </Tag>
  );
});

export default CompanyMark;
