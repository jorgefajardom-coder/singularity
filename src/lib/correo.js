import { perfil } from "./gpu";

/**
 * Enlace para escribir a un correo.
 *
 * En computador abre la ventana de Redactar de Gmail en una pestaña nueva
 * (Jorge, 26-09-2026: el `mailto:` abria Outlook). En el telefono se queda en
 * `mailto:`: abre la app de correo del aparato, que en Android casi siempre es
 * Gmail, y la web de Gmail en el movil va peor que la app.
 *
 * Devuelve las props del <a>: `href` y, para Gmail, pestaña nueva.
 */
export function enlaceCorreo(para, { asunto = "", cuerpo = "" } = {}) {
  if (perfil.movil) {
    const q = new URLSearchParams();
    if (asunto) q.set("subject", asunto);
    if (cuerpo) q.set("body", cuerpo);
    // `mailto:` quiere los espacios como %20, no como "+".
    const extra = q.toString().replace(/\+/g, "%20");
    return { href: `mailto:${para}${extra ? `?${extra}` : ""}` };
  }
  const q = new URLSearchParams({ view: "cm", fs: "1", to: para });
  if (asunto) q.set("su", asunto);
  if (cuerpo) q.set("body", cuerpo);
  return {
    href: `https://mail.google.com/mail/?${q.toString()}`,
    target: "_blank",
    rel: "noopener noreferrer",
  };
}
