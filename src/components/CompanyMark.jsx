import { forwardRef } from "react";

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
      <img
        className="company__logo"
        style={{ scale: company.logoScale ?? 1 }}
        src={company.logo}
        // Solo la primera pasada cuenta para lectores de pantalla.
        alt={duplicate ? "" : company.name}
        loading="lazy"
      />
      {!company.hideLabel && (
        <span className="company__label" aria-hidden="true">
          {company.name}
        </span>
      )}
    </Tag>
  );
});

export default CompanyMark;
