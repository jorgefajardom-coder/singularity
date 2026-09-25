/**
 * ÚNICO ARCHIVO QUE TIENES QUE EDITAR PARA CAMBIAR EL CONTENIDO.
 *
 * El sitio es bilingüe. Cada texto se escribe con el helper `t(es, en)`:
 *
 *     titulo: t("Proyectos", "Projects")
 *
 * Los componentes lo resuelven con `tr()` según el idioma activo.
 * Los nombres propios (Unity, MATLAB, HubSpot...) y los títulos de proyecto
 * se dejan en inglés en ambos idiomas, para que coincidan con tu GitHub.
 *
 * Los títulos y las notas de cada sección están todos en `sections`, y `nav`
 * se construye a partir de ahí: renombrar una sección la renombra también en
 * la barra superior y en el pie.
 */

/** Crea un texto bilingüe. */
export const t = (es, en) => ({ es, en });

// Añade la pista definitiva en public/audio y su ruta aquí. También se puede
// probar un archivo local desde el botón de música, sin subirlo a un servidor.
export const music = { src: "", title: "Orbit" };

export const site = {
  name: "Jorge Andres Fajardo Mora",
  // Version corta para la barra superior, donde el nombre completo ocupa demasiado
  short: t("Ing. J.A.F.M", "Eng. J.A.F.M"),
  // NO se toca (Jorge, 25-09-2026): ni el "Hola, soy Jorge" ni este rol. El
  // enfoque en gestion de proyectos se cuenta a partir de aqui, en la frase de
  // debajo y en el resto de la pagina.
  role: t(
    "Technical Product Manager · Ingeniero mecatrónico",
    "Technical Product Manager · Mechatronics Engineer"
  ),
  email: "j.andres.f.mora@gmail.com",
  // TODO: confirma o cambia la ciudad; la puse yo, no venía en tu README.
  location: t("Bogotá, Colombia", "Bogotá, Colombia"),

  hero: {
    line1: t("Hola,", "Hi,"),
    line2: t("soy Jorge", "I'm Jorge"),
    lede: t(
      "He pasado por todas las fases de un proyecto: lo inicio, lo planifico, lo ejecuto, lo controlo y lo cierro.",
      "I've been through every phase of a project: I start it, plan it, run it, track it and close it."
    ),
  },
};

/* ============================================================
   Secciones
   El título y la nota de cada sección se escriben AQUÍ una sola vez.
   `nav` se construye con estos mismos textos, así que renombrar una
   sección la renombra también en la barra y en el pie.
   - `heading`: el titular grande que se ve dentro de la sección.
   - `nav`: solo si la barra necesita una etiqueta más corta.
   - `note`: el texto de apoyo bajo el titular, si la sección lo lleva.
   ============================================================ */
export const sections = {
  about: {
    id: "about",
    nav: t("Sobre mí", "About"),
    heading: t("Sobre mí", "About me"),
  },
  stack: {
    id: "stack",
    heading: t("Stack", "Stack"),
  },
  services: {
    id: "services",
    heading: t("Qué hago", "What I do"),
    note: t(
      "Gestiono el proyecto de principio a fin, y cuando hace falta también ejecuto la parte técnica.",
      "I manage the project end to end, and when it's needed I build the technical side too."
    ),
  },
  projects: {
    id: "projects",
    heading: t("Proyectos", "Projects"),
  },
  certifications: {
    id: "certifications",
    heading: t("Formación", "Education"),
    // Burbuja al pie de las constelaciones: lleva al LinkedIn de `socials`.
    more: t("¿Quieres profundizar más?", "Want to dig deeper?"),
  },
  companies: {
    // Sin `heading`: la órbita de marcas se presenta sola, con la nota.
    id: "companies",
    note: t(
      "Marcas y organizaciones con las que he trabajado.",
      "Brands and organizations I have worked with."
    ),
  },
  meditation: {
    // Sin `heading` ni `id`: no entra en el nav, es una pausa visual. El
    // rotulo solo lo oyen los lectores de pantalla.
    label: t("El universo entre mis manos", "The universe in my hands"),
  },
  contact: {
    id: "contact",
    nav: t("Contacto", "Contact"),
    heading: t("Hablemos", "Let's talk"),
    note: t(
      "Abierto a liderar proyectos de principio a fin: robótica, automatización industrial, IA aplicada y producto digital. LinkedIn o correo es la vía más rápida.",
      "Open to leading projects end to end: robotics, industrial automation, applied AI and digital product. LinkedIn or email is the fastest way to reach me."
    ),
  },
};

/** Orden de la barra superior y del pie. */
const NAV_ORDER = ["about", "stack", "services", "projects", "contact"];

export const nav = NAV_ORDER.map((key) => ({
  label: sections[key].nav ?? sections[key].heading,
  href: `#${sections[key].id}`,
}));

export const ui = {
  contactCta: t("Contáctame", "Get in touch"),
  workTogether: t("Trabajemos juntos", "Let's work together"),
  scroll: t("Scroll", "Scroll"),
  viewProject: t("Ver proyecto", "View project"),
  // Cuando el proyecto enlaza a su repositorio, el boton lo dice: no es lo
  // mismo prometer "el proyecto" que llevar al codigo.
  viewRepo: t("Ver el repositorio", "View the repository"),
  send: t("Enviar", "Send"),
  formName: t("Nombre", "Name"),
  formEmail: t("Email", "Email"),
  formMessage: t("Cuéntame del proyecto", "Tell me about the project"),
  navigation: t("Navegación", "Navigation"),
  social: t("Redes", "Social"),
  contact: t("Contacto", "Contact"),

  // Filtro de proyectos
  stackPrev: t("Pósters anteriores", "Previous posters"),
  stackNext: t("Pósters siguientes", "Next posters"),
  categories: t("Categorías", "Categories"),
  allProjects: t("Todos", "All"),

  // Visor 3D de un proyecto
  model3d: t("Modelo 3D", "3D model"),
  dragToRotate: t("Arrastra para girar", "Drag to rotate"),
  modelDrag: t("Arrastra para girar", "Drag to rotate"),
  playVideo: t("Ver la simulación", "Watch the simulation"),
  tabModel: t("Montaje 3D", "3D assembly"),
  tabVideo: t("Simulación", "Simulation"),
  tabsLabel: t("Qué ver", "What to show"),
  videoNote: t("Vídeo en YouTube", "Video on YouTube"),

  // Reproductor de música
  player: {
    label: t("Música", "Music"),
    file: t("Archivo de música", "Music file"),
    add: t("Añadir música", "Add music"),
    change: t("Cambiar música", "Change music"),
    play: t("Reproducir música", "Play music"),
    pause: t("Pausar música", "Pause music"),
    mute: t("Silenciar música", "Mute music"),
    unmute: t("Activar sonido", "Unmute"),
    muteShort: t("Silenciar", "Mute"),
    mutedShort: t("Sin sonido", "Muted"),
    level: t("Nivel de música", "Music level"),
    error: t(
      "No se pudo reproducir. Prueba otro archivo de audio.",
      "Could not play. Try another audio file."
    ),
  },

  // Descripciones para lectores de pantalla de lo que solo se ve en 3D
  a11y: {
    blackHole: t(
      "Agujero negro interactivo. Mueve el puntero para inclinarlo y mantén pulsado o presiona espacio para acelerar.",
      "Interactive black hole. Move the pointer to tilt and hold down or press space to accelerate."
    ),
    meditationImage: t(
      "Astronauta con los ojos cerrados, sosteniendo un agujero negro entre las manos.",
      "Astronaut with closed eyes, holding a black hole between their hands."
    ),
  },
};

// La rejilla de capturas ya no se pinta: la seccion se quito de App.jsx y su
// componente se borro. Sigue en el historial —`git log --diff-filter=D -- // src/components/Gallery.jsx` da el commit del que sacarlo—, y estos datos se
// quedan aqui por si vuelve.
export const gallery = [
  {
    id: "g1",
    caption: t("Celda de manufactura", "Manufacturing cell"),
    palette: ["#ff8a1f", "#ef4b23"],
    wide: true,
  },
  { id: "g2", caption: t("Gemelo digital", "Digital twin"), palette: ["#ef4b23", "#ffb52e"] },
  { id: "g3", caption: t("Diseño de PCB", "PCB design"), palette: ["#c93812", "#ff8a1f"] },
  { id: "g4", caption: t("Packaging", "Packaging"), palette: ["#ff6a00", "#ffcf70"] },
  { id: "g5", caption: t("Identidad de marca", "Brand identity"), palette: ["#ff8a1f", "#ef4b23"] },
  {
    id: "g6",
    caption: t("Render y animación 3D", "3D render & animation"),
    palette: ["#ef4b23", "#ff8a1f"],
    wide: true,
  },
];

export const about = {
  // El titular está en `sections.about.heading`.
  // Un elemento por párrafo. Añade o quita los que quieras.
  body: [
    t(
      "Technical Product Manager e ingeniero mecatrónico. He llevado proyectos por todas sus fases (inicio, planificación, ejecución, seguimiento y cierre) en robótica, automatización industrial, IA, 3D y marca, y sé lo que exige cada etapa porque las he trabajado desde dentro.",
      "Technical Product Manager and mechatronics engineer. I've taken projects through every phase (initiation, planning, execution, monitoring and closing) in robotics, industrial automation, AI, 3D and branding, and I know what each stage demands because I've worked them from the inside."
    ),
    // La ingenieria es la ventaja del gestor, no una nota al pie: va afirmada.
    t(
      "Por eso coordino equipos técnicos y creativos hablando su idioma: traduzco la necesidad del negocio en alcance, cronograma y entregables, y acompaño el proyecto hasta que llega a producción y al mercado.",
      "That's why I lead technical and creative teams speaking their language: I turn business needs into scope, schedule and deliverables, and I see the project through to production and to market."
    ),
  ],
  // TODO: estas cifras las puse yo de relleno. Ajústalas o bórralas.
  stats: [
    { value: "12+", label: t("Proyectos", "Projects") },
    { value: "14", label: t("Áreas de trabajo", "Focus areas") },
    { value: "50+", label: t("Herramientas", "Tools") },
  ],
};

export const stack = [
  // La primera tras la portada: la pagina va enfocada a la gestion.
  {
    key: "producto",
    group: t("Producto", "Product"),
    items: [
      { name: "Jira", color: "#ff6a00" },
      { name: "Obsidian", color: "#ffcf70" },
      { name: "Agile · Scrum · Kanban", color: "#8B95A7" },
    ],
  },
  {
    key: "dev",
    group: t("Desarrollo", "Development"),
    items: [
      { name: "Python", color: "#ffb52e" },
      { name: "C#", color: "#c93812" },
      { name: "C++", color: "#ff6a00" },
      { name: "Java", color: "#ffcf70" },
      { name: "Node.js", color: "#ff8a1f" },
      { name: "Git", color: "#ef4b23" },
      { name: "GitHub Actions", color: "#ffb52e" },
      { name: "Docker", color: "#c93812" },
      { name: "Linux", color: "#ff6a00" },
      { name: "VS Code", color: "#ffcf70" },
      { name: "LaTeX", color: "#ff8a1f" },
    ],
  },
  {
    key: "ia",
    group: t("Inteligencia artificial", "Artificial Intelligence"),
    items: [
      { name: "Claude Code", color: "#ef4b23" },
      { name: "ChatGPT", color: "#ffb52e" },
      { name: "OpenAI Codex", color: "#c93812" },
      { name: "Gemini", color: "#ff6a00" },
      { name: "DeepSeek", color: "#ffcf70" },
      { name: "TensorFlow", color: "#ff8a1f" },
      { name: "PyTorch", color: "#ef4b23" },
      { name: "OpenCV", color: "#ffb52e" },
      { name: "MediaPipe", color: "#c93812" },
    ],
  },
  {
    key: "integra",
    group: t("Automatización e integración", "Automation & Integration"),
    items: [
      { name: "n8n", color: "#ff6a00" },
      { name: "Make", color: "#ffcf70" },
      { name: "HubSpot", color: "#ff8a1f" },
      { name: "Airtable", color: "#ef4b23" },
      { name: "REST APIs", color: "#ffb52e" },
      { name: "Webhooks", color: "#8B95A7" },
    ],
  },
  {
    key: "industrial",
    group: t("Automatización industrial", "Industrial Automation"),
    items: [
      { name: "CODESYS", color: "#8B95A7" },
      { name: "Modbus", color: "#6B7280" },
      { name: "OPC UA", color: "#ffb52e" },
      { name: "OpenPLC", color: "#ff8a1f" },
      { name: "Ladder Logic", color: "#c93812" },
      { name: "FluidSIM", color: "#ff6a00" },
    ],
  },
  {
    key: "electronica",
    group: t("Electrónica, embebidos y redes", "Electronics, Embedded & Networking"),
    items: [
      { name: "Arduino", color: "#ffcf70" },
      { name: "ESP32", color: "#ff8a1f" },
      { name: "Raspberry Pi", color: "#ef4b23" },
      { name: "EasyEDA", color: "#c93812" },
      { name: "Fritzing", color: "#ffb52e" },
      { name: "Cisco Packet Tracer", color: "#c93812" },
    ],
  },
  {
    key: "tresd",
    group: t("3D, simulación y experiencias interactivas", "3D, Simulation & Interactive Experiences"),
    items: [
      { name: "Blender", color: "#ff6a00" },
      { name: "Unity", color: "#E5E7EB" },
      { name: "Three.js / R3F", color: "#ffcf70" },
      { name: "GSAP", color: "#ff8a1f" },
    ],
  },
  {
    key: "diseno",
    group: t("Diseño, vídeo y contenido", "Design, Video & Content"),
    items: [
      { name: "Canva", color: "#ef4b23" },
      { name: "CapCut", color: "#ffb52e" },
      { name: "Filmora", color: "#c93812" },
      { name: "Higgsfield", color: "#ff6a00" },
    ],
  },
  {
    key: "cad",
    group: t("CAD y diseño de producto", "CAD & Product Design"),
    items: [
      { name: "Autodesk Inventor", color: "#ff6a00" },
      { name: "Fusion 360", color: "#ffcf70" },
      { name: "Revit", color: "#ff8a1f" },
      { name: "Packaging", color: "#ff6a00" },
    ],
  },
  {
    key: "datos",
    group: t("Datos y cálculo", "Data & Computing"),
    items: [
      { name: "MATLAB", color: "#ef4b23" },
      { name: "NumPy", color: "#ffb52e" },
      { name: "Pandas", color: "#c93812" },
    ],
  },
];

/**
 * Las areas de trabajo, que son los servicios contados en grande.
 *
 * Catorce servicios son demasiados para leerlos de un vistazo girando
 * alrededor de una cabeza: los rotulos se pisaban entre si. Asi que se
 * agrupan en CINCO areas. Esto NO quita ninguno: la seccion Servicios los
 * sigue mostrando los catorce, y aqui cada area solo apunta a ellos por su
 * `id`, de modo que anadir un servicio alla lo mete en su area sin tocar
 * nada mas. La lista de cada area se lee al entrar a su cuerpo.
 *
 * Cada area es un CUERPO del sistema que orbita al personaje en la seccion
 * de meditacion (ver Halo.jsx). `size` es el diametro en unidades del viewBox
 * del halo y es el MISMO en las seis: son seis areas, no una jerarquia, y con
 * tamanos distintos las mas grandes se leian como las importantes. `ring` el anillo en el que va y `start` el angulo, en grados
 * desde arriba y en el sentido del reloj.
 *
 * Cada area tiene su PROPIO anillo y no lo comparte con nadie, que es lo que
 * hace que se lean como seis cuerpos en seis orbitas y no como un monton.
 *
 * Ningun cuerpo puede ir arriba del todo en un anillo largo: la barra del
 * menu ocupa los primeros 78 px y el cuerpo de un anillo de 0.95 cae siempre
 * dentro de ellos, en CUALQUIER alto de pantalla (de 500 a 1080 px sale entre
 * y=11 e y=23). Por eso Producto y diseno, que va centrado arriba, esta en el
 * anillo 2: de 0.52 para abajo libra la barra en todas.
 *
 * Y por eso Programacion salio de la vertical. Dos cuerpos apilados en el
 * mismo eje necesitan 94 px de diferencia de radio para no montarse —es lo que
 * miden—, y ahi arriba la barra no deja tanto radio. Una de las dos cosas
 * tenia que ceder.
 *
 * Programacion acabo a la derecha y no a la izquierda porque ahi si cabe: las
 * cajas de los cuerpos son CUADRADAS, no redondas, asi que dos se tocan en
 * cuanto su distancia en X y en Y son las dos menores que 94. A la izquierda
 * quedaba a 81 de IA en los dos ejes y se montaban; medido, 13 px a 1536 y
 * 22 px a 1920.
 *
 * Los angulos NO estan repartidos a partes iguales. Se probo —48 grados
 * justos entre uno y el siguiente— y quedaba peor: lo que se lee bien es este
 * reparto, con dos cuerpos en la vertical de la cabeza, dos a media altura a
 * los lados y dos abajo. Dos pares van ademas alineados a proposito:
 * Producto y Programacion comparten la vertical, y 3D e Ingenieria la
 * horizontal.
 *
 * Y `color` es lo unico que cambia de un cuerpo a otro, porque cada cuerpo ES
 * el agujero negro del astronauta clonado: el mismo shader, con el tono del
 * disco girado hasta ese color (ver `uHue` en BlackHole.jsx). Los seis tonos
 * se reparten por la rueda a proposito y con distancia entre ellos: el giro
 * conserva la luminancia, asi que dos colores a veinticinco grados uno de otro
 * dan dos agujeros que no se distinguen.
 */
export const workAreas = [
  {
    id: "visual",
    name: t("3D y visualización", "3D & Visualization"),
    services: ["modelado-3d", "animacion-3d", "web3d-juegos"],
    color: "#2fe0cf",
    size: 16.0,
    ring: 2,
    start: 296,
  },
  {
    id: "codigo",
    name: t("Programación y datos", "Programming & Data"),
    services: ["web"],
    color: "#9ae02f",
    size: 16.0,
    ring: 1,
    start: 0,
  },
  {
    id: "producto",
    name: t("Producto y diseño", "Product & Design"),
    services: ["packaging", "producto"],
    color: "#c04fff",
    size: 16.0,
    ring: 6,
    start: 0,
  },
  {
    id: "hardware",
    name: t("Ingeniería y hardware", "Engineering & Hardware"),
    services: ["electronica", "industrial", "robotica"],
    color: "#2fe04f",
    size: 16.0,
    ring: 3,
    start: 69,
  },
  {
    id: "inteligencia",
    name: t("IA y automatización", "AI & Automation"),
    services: ["ia", "flujos-crm"],
    color: "#3f7dff",
    size: 16.0,
    ring: 4,
    start: 248,
  },
  {
    id: "marca",
    name: t("Marca y contenido", "Brand & Content"),
    services: ["marca", "marketing", "locucion"],
    color: "#ff2f5e",
    size: 16.0,
    ring: 5,
    start: 105,
  },
];

export const services = [
  // Primera y abierta por defecto: es el foco de la pagina.
  {
    id: "producto",
    title: t("Gestión de proyectos y producto", "Project & Product Management"),
    desc: t(
      "Llevo el proyecto por todas sus fases: defino el alcance con el negocio, planifico cronograma y recursos, coordino a los equipos de hardware, software, 3D y marca, controlo avance y riesgos, y cierro con la entrega.",
      "I take the project through every phase: I define scope with the business, plan schedule and resources, coordinate hardware, software, 3D and brand teams, track progress and risk, and close with delivery."
    ),
    tags: [
      t("Inicio", "Initiation"),
      t("Planificación", "Planning"),
      t("Ejecución", "Execution"),
      t("Seguimiento", "Monitoring"),
      t("Cierre", "Closing"),
      "Agile · Scrum",
      "Jira",
    ],
  },
  {
    id: "modelado-3d",
    title: t("Modelado y visualización 3D", "3D Modeling & Visualization"),
    desc: t(
      "Modelado hard-surface y orgánico en Blender, listo para render o para motor en tiempo real. Iluminación de estudio, materiales físicamente correctos y variantes de color para catálogo o campaña.",
      "Hard-surface and organic modeling in Blender, ready for render or for a real-time engine. Studio lighting, physically correct materials, and color variants for catalog or campaign."
    ),
    tags: ["Blender", "Look dev", "HDRI", t("Retopología", "Retopology")],
  },
  {
    id: "animacion-3d",
    title: t("Animación 3D y gemelos digitales", "3D Animation & Digital Twins"),
    desc: t(
      "Animación de cámara, rigging mecánico y simulación física para explicar cómo funciona un mecanismo. Entornos virtuales sincronizados con la planta real para validar antes de desplegar.",
      "Camera animation, mechanical rigging, and physics simulation to explain how a mechanism works. Virtual environments synced with the real plant to validate before deployment."
    ),
    tags: ["Blender", "Unity", "C#", "Rigging"],
  },
  {
    id: "web3d-juegos",
    title: t("Web 3D y videojuegos", "Web 3D & Games"),
    desc: t(
      "Experiencias en tiempo real: configuradores, landings inmersivas y videojuegos. Del prototipo jugable a la escena WebGL que también va fluida en móvil.",
      "Real-time experiences: configurators, immersive landing pages, and games. From playable prototype to a WebGL scene that stays smooth on mobile."
    ),
    tags: ["Unity", "C#", "Three.js / R3F", "WebGL"],
  },
  {
    id: "web",
    title: t("Diseño y desarrollo web", "Web Design & Development"),
    desc: t(
      "Sitios y landings que cargan rápido y se ven bien en cualquier pantalla. Del diseño de la interfaz al código, sin plantillas genéricas.",
      "Sites and landing pages that load fast and hold up on any screen. From interface design to code, without generic templates."
    ),
    tags: ["React", "Vite", "UI", "Responsive", "SEO"],
  },
  {
    id: "electronica",
    title: t("Diseño de PCB y electrónica", "PCB & Electronics Design"),
    desc: t(
      "Esquemático, ruteo y preparación para fabricación. Del prototipo en protoboard a la placa lista para ensamblar, con la parte embebida incluida.",
      "Schematic, routing, and manufacturing prep. From breadboard prototype to a board ready for assembly, embedded firmware included."
    ),
    tags: ["EasyEDA", "Fritzing", "Arduino", "ESP32"],
  },
  {
    id: "packaging",
    title: t("Packaging y diseño de producto", "Packaging & Product Design"),
    desc: t(
      "Estructura, troquel y acabado del empaque, más el render que lo vende antes de existir físicamente. CAD y 3D trabajando sobre la misma pieza.",
      "Structure, die-cut, and finish of the package, plus the render that sells it before it physically exists. CAD and 3D working on the same piece."
    ),
    tags: ["Fusion 360", "Inventor", "Blender", t("Troquel", "Dieline")],
  },
  {
    id: "marca",
    title: t("Creación de marca", "Brand Creation"),
    desc: t(
      "Identidad visual desde cero: naming, logotipo, sistema de color y tipografía, y el manual para que la marca se sostenga cuando la use otro.",
      "Visual identity from scratch: naming, logo, color and type system, and the guidelines that keep the brand consistent once someone else uses it."
    ),
    tags: [t("Identidad", "Identity"), "Naming", t("Dirección de arte", "Art direction"), t("Manual de marca", "Brand book")],
  },
  {
    id: "marketing",
    title: t("Marketing y contenido", "Marketing & Content"),
    desc: t(
      "Las piezas que ponen la marca a trabajar: campañas, vídeo y contenido para redes, edición y montaje incluidos.",
      "The pieces that put the brand to work: campaigns, video, and social content, editing and assembly included."
    ),
    tags: ["CapCut", "Filmora", t("Campañas", "Campaigns"), t("Redes sociales", "Social media")],
  },
  {
    id: "locucion",
    title: t("Locución y radio", "Voice & Radio"),
    desc: t(
      "Locución para radio, podcast y voz en off. Guion, grabación y montaje: la voz que le pone cara a la marca.",
      "Voice work for radio, podcast, and voice-over. Script, recording, and edit: the voice that gives the brand a face."
    ),
    tags: [t("Locución", "Voice acting"), "Radio", "Podcast", t("Voz en off", "Voice-over")],
  },
  {
    id: "industrial",
    title: t("Automatización industrial", "Industrial Automation"),
    desc: t(
      "Control de celdas de manufactura con PLC: lógica IEC 61131-3, comunicación industrial y puesta en marcha. De la especificación al sistema funcionando en planta.",
      "PLC-driven manufacturing cell control: IEC 61131-3 logic, industrial communication, and commissioning. From spec to a system running on the floor."
    ),
    tags: ["CODESYS", "Ladder Logic", "OPC UA", "Modbus"],
  },
  {
    id: "robotica",
    title: t("Robótica y control de movimiento", "Robotics & Motion Control"),
    desc: t(
      "Arquitecturas modulares de 6 GDL, cinemática, planificación de trayectorias y coordinación entre varios robots que comparten tarea y espacio de trabajo.",
      "Modular 6-DOF architectures, kinematics, trajectory planning, and coordination between multiple robots sharing a task and a workspace."
    ),
    tags: ["Python", "C++", "MATLAB", t("Cinemática", "Kinematics")],
  },
  {
    id: "ia",
    title: t("IA aplicada y visión artificial", "Applied AI & Computer Vision"),
    desc: t(
      "Detección, seguimiento y análisis en tiempo real integrados con robots, ajustados para baja latencia en entornos de producción.",
      "Real-time detection, tracking, and analysis integrated with robots, tuned for low latency in production environments."
    ),
    tags: ["OpenCV", "MediaPipe", "TensorFlow", "PyTorch"],
  },
  {
    id: "flujos-crm",
    title: t("Automatización de flujos y CRM", "Workflow Automation & CRM"),
    desc: t(
      "Agentes e integraciones que conectan las herramientas del negocio por API: CRM, bases de datos y procesos internos que dejan de hacerse a mano.",
      "Agents and integrations that connect business tools over APIs: CRM, databases, and internal processes that stop being done by hand."
    ),
    tags: ["n8n", "Make", "HubSpot", "Airtable"],
  },
];

export const projectCategories = [
  { id: "design", label: t("Diseño de producto y packaging", "Product Design & Packaging") },
  { id: "robotics", label: t("Robótica y manufactura", "Robotics & Manufacturing") },
  { id: "ai", label: t("IA y automatización", "AI & Automation") },
];

export const projects = [
  {
    category: "design",
    name: t("Dron cuadricóptero modular", "Modular Quadcopter Drone"),
    year: "2025",
    desc: t(
      "Cuadricóptero de pequeño formato diseñado desde cero, con geometría en X para repartir por igual las cargas de los cuatro motores. Diez piezas organizadas en subsistemas —propulsión, estructura, electrónica y soporte— que encajan a presión, sin tornillos ni fijaciones adicionales. La PCB gobierna los motores directamente por PWM, sin variadores externos, y está modelada componente a componente. Carcasa en ABS, placa en FR-4 y batería LiPo.",
      "Small-format quadcopter designed from scratch, with an X geometry that spreads the load of the four motors evenly. Ten parts organized into subsystems — propulsion, structure, electronics and support — that snap together with no screws or extra fasteners. The PCB drives the motors directly over PWM, with no external speed controllers, and is modeled component by component. ABS shell, FR-4 board and LiPo battery."
    ),
    tags: ["Fusion 360", "Inventor", "CAD", t("Diseño para ensamblaje", "Design for Assembly"), "PCB"],
    // El dron de Fusion, reducido para la web (tools/exportar-dron.py). Flota
    // al lado del texto, sin recuadro, y se despieza (ver ProductViewer.jsx).
    producto3d: {
      model: "/models/dron.glb",
      despiece: [
        // Orden de salida: primero las helices y despues la tapa; al montar
        // se invierte (vuelve la tapa y luego las helices).
        // Las cuatro helices a la vez, en un solo turno.
        { prefijo: "helice", y: 0.62, radial: 0.1, juntas: true },
        { prefijo: "carcasa_superior", y: 0.34 },
        // Cada motor se abre en sus componentes, de abajo arriba: anillo,
        // rodamientos, base, bobinado, imanes, campana y eje (ver
        // tools/exportar-dron.py). Un motor por turno.
        {
          prefijo: "motor", y: 0.12, radial: 0.12, porGrupo: true,
          partes: { anillo: -0.05, rodamiento: -0.025, base: 0, bobinado: 0.06, imanes: 0.13, campana: 0.2, eje: 0.3 },
        },
        { prefijo: "pcb", y: 0.14 },
        // Los 89 componentes soldados suben con la placa y despues se
        // separan de ella: los de arriba hacia arriba y los de abajo hacia abajo.
        { prefijo: "pcbc", y: 0.07, sigue: "pcb", juntas: true, lados: true },
        { prefijo: "carcasa_inferior", y: -0.16 },
      ],
      // Fusion exporta sin metal. La placa (la parte sin material) en verde
      // metalizado y el cuerpo de los motores en dorado metalizado.
      colores: [
        { prefijo: "pcb", materiales: [""], color: "#1f7a3d", metal: 0.7, rugosidad: 0.35 },
        { prefijo: "motor", materiales: ["Steel - Satin", "Aluminum - Anodized Glossy (Blue)"], color: "#d4a53c", metal: 1, rugosidad: 0.3 },
      ],
    },
    media: [],
  },
  {
    category: "design",
    name: t("Sistema de empaque protector para drones", "Protective Drone Packaging System"),
    href: "https://uniagustiniana17.autodesk360.com/g/shares/SH90d2dQT28d5b6028117e820082acb8bb2b",
    hrefLabel: t("Explorar modelo 3D en Autodesk", "Explore 3D model in Autodesk"),
    desc: t(
      "Empaque completo para el dron, presentado con dos animaciones de producto. La caja se pliega del desarrollo plano al volumen final y aloja el dron y sus accesorios en un inserto de espuma; el estuche de hélices organiza las cuatro en alojamientos individuales. El modelo compartido en Autodesk permite explorar la disposición interior.",
      "Complete packaging for the drone, presented through two product animations. The box folds from its flat layout into the final volume and holds the drone and its accessories in a foam insert; the propeller case arranges all four in individual compartments. The shared Autodesk model lets visitors explore the interior layout."
    ),
    tags: [t("Empaque", "Packaging"), "Autodesk Fusion", "3D", t("Animación de producto", "Product Animation")],
    // Dos videos propios, servidos desde /videos. Van lado a lado en
    // escritorio y uno encima del otro en movil.
    clips: [
      { src: "/videos/drone-box-animation.mp4", title: t("Caja plegable con inserto de espuma", "Folding box with foam insert") },
      { src: "/videos/packaging-box.mp4", title: t("Estuche de hélices", "Propeller case") },
    ],
    media: [],
  },
  {
    category: "robotics",
    name: t("Celda autónoma de manufactura de drones", "Autonomous Drone Manufacturing Cell"),
    year: "2025",
    href: "https://github.com/jorgefajardom-coder/drone-packaging-simulation-unity",
    desc: t(
      // Los parrafos se separan con una linea en blanco (ver Projects.jsx).
      "Celda automatizada para el ensamblaje y paletizado de drones cuadricópteros, compuesta por cuatro manipuladores coordinados en paralelo.\n\nDos robots de 6 GDL realizan el montaje de motores y hélices, mientras un tercer manipulador con ventosa instala la PCB y la carcasa y ejecuta la transferencia del producto. El sistema se completa con un robot paletizador sobre plataforma omnidireccional con ruedas Mecanum.\n\nLa secuencia de operación es gestionada mediante PLC en CODESYS, con lógica desarrollada en Structured Text para coordinar manipuladores, actuadores y condiciones de parada. La celda incorpora sectorización de zonas de trabajo para reducir interferencias entre robots y tres niveles de seguridad definidos bajo criterios de ISO 10218-2, supervisados mediante visión artificial.",
      "Automated cell for the assembly and palletizing of quadcopter drones, made up of four manipulators coordinated in parallel.\n\nTwo 6-DOF robots mount the motors and propellers, while a third manipulator with a suction cup installs the PCB and the shell and carries out the product transfer. The system is completed by a palletizing robot on an omnidirectional Mecanum-wheel platform.\n\nThe operating sequence is managed by a CODESYS PLC, with logic written in Structured Text to coordinate manipulators, actuators and stop conditions. The cell includes work-zone sectorization to reduce interference between robots and three safety levels defined under ISO 10218-2 criteria, monitored through computer vision."
    ),
    // Lenguajes, de los que detecta GitHub en el repositorio: C# (Unity), HLSL
    // (shaders), Python (vision) y C++ (firmware). Fuera HTML, que es marcado
    // (el informe), y ShaderLab, el envoltorio declarativo de Unity para los
    // shaders. Structured Text no lo detecta GitHub porque el PLC no esta en
    // el repositorio, pero es el lenguaje de la logica de la celda.
    tags: ["Unity", "C#", "Structured Text", "Python", "C++", "HLSL", "CODESYS", "IEC 61131-3", "FluidSIM", "OPC", "MediaPipe", "ESP32-CAM"],
    // La coautora del proyecto.
    links: [
      { href: "https://www.linkedin.com/in/laura-vanesa-castro-sierra-b35148208/", label: t("Coautora · Laura Vanesa Castro Sierra", "Co-author · Laura Vanesa Castro Sierra") },
    ],
    // La celda de verdad, la que se simulo en Unity. Se abre al desplegar el
    // proyecto y no antes: son megabytes. Ver ModelViewer.jsx.
    model: "/models/celda-pieces.glb?v=individual-3",
    // La simulacion en marcha, del repositorio del proyecto. Solo el ID: el
    // iframe no se monta hasta que lo piden (ver VideoEmbed en ui.jsx).
    video: "MrMugpJ7UEQ",
    // La miniatura, bajada una vez y servida desde aqui: asi la vista previa
    // no le cuesta al visitante una peticion a los servidores de Google.
    videoPoster: "/images/celda-video.webp",
    media: [],
  },
  {
    category: "ai",
    name: t("Sistema de seguridad por visión con ESP32-CAM", "ESP32-CAM Vision Safety System"),
    year: "2026",
    href: "https://github.com/jorgefajardom-coder/esp32cam-hand-detection-safety-system",
    desc: t(
      "Capa de seguridad que detecta manos en la zona de trabajo de un robot en tiempo real. Una ESP32-CAM transmite vídeo JPEG a 800 × 600 por WebSocket; un cliente en Python lo procesa con MediaPipe Hands —hasta dos manos a la vez— y, en cuanto ve una, marca la imagen con un aviso de STOP y lanza alertas por voz, correo y Telegram, con 15 segundos de espera entre ráfagas para no saturar a nadie. El firmware se reconecta solo si cae el Wi-Fi e indica su estado con el LED de la placa, y las credenciales viven fuera del código.",
      "Safety layer that detects hands in a robot's work area in real time. An ESP32-CAM streams 800 × 600 JPEG video over WebSocket; a Python client runs it through MediaPipe Hands — up to two hands at once — and as soon as it sees one, it stamps a STOP warning on the frame and fires voice, email and Telegram alerts, with a 15-second cooldown between bursts so nobody gets flooded. The firmware reconnects on its own when Wi-Fi drops and signals its state with the board's LED, and credentials live outside the code."
    ),
    tags: ["ESP32-CAM", "Arduino", "Python", "MediaPipe", "OpenCV", "WebSocket", "Telegram API"],
    links: [
      { href: "https://www.linkedin.com/in/laura-vanesa-castro-sierra-b35148208/", label: t("Coautora · Laura Vanesa Castro Sierra", "Co-author · Laura Vanesa Castro Sierra") },
    ],
    // La foto va al lado del texto, no debajo (ver `mediaLado` en Projects.jsx).
    mediaLado: true,
    media: [{
      src: "/images/esp32cam-seguridad.webp",
      alt: t("Módulo ESP32-CAM AI Thinker con su cámara OV2640", "ESP32-CAM AI Thinker module with its OV2640 camera"),
    }],
  },
];

/* ============================================================
   Empresas
   Los logos van en /public/images/clients. Sin `logo`, la tarjeta
   muestra el nombre como marca tipográfica.
   ============================================================ */
export const companies = {
  // El texto de apoyo está en `sections.companies.note`.
  items: [
    { name: "Team Icon Official", logo: "/images/clients/be-an-icon.webp", href: "https://www.instagram.com/team_icon_official/" },
    { name: "MiuTab", logo: "/images/clients/miutab.webp", logoScale: 1.4, hideLabel: true, href: "https://www.linkedin.com/company/miutab/posts/?feedView=all" },
    { name: "Uniagustiniana", logo: "/images/clients/uniagustiniana.webp", logoScale: 1.35, href: "https://www.instagram.com/uniagustoficial/" },
    { name: "Franco's Photography Col", logo: "/images/clients/francos-photography.webp", href: "https://www.instagram.com/francosfotografiacol/" },
    { name: "Khronos Ink", logo: "/images/clients/khronos-ink.webp", href: "" },
  ],
};

/* ============================================================
   Certificaciones y formación
   Una estrella por título, unidas en este orden. Sin fechas (lo
   decidió Jorge). `lead` + `points` salen en una tarjeta al pasar
   por la línea; `href` la vuelve enlace al certificado; `tags` van a
   la vista bajo el título.
   ============================================================ */
export const certifications = {
  // El titular está en `sections.certifications`. Dos constelaciones en el
  // mismo cielo: los títulos y diplomas por un lado, las certificaciones por
  // otro (lo pidió Jorge, 25-09-2026). Cada lista va en ORDEN CRONOLÓGICO,
  // del más antiguo al más reciente: la constelación lo dibuja sin fechas.
  groups: [
    {
      label: t("Títulos y diplomas", "Degrees and diplomas"),
      figure: "birrete",
      items: [
        {
          title: t("Bachiller Académico", "Academic High School Diploma"),
          issuer: t("Gimnasio Campestre Cristiano", "Gimnasio Campestre Cristiano"),
        },
        {
          title: t(
            "Diploma con profundización en Teología y Estudios Bíblicos",
            "Diploma with emphasis in Theology and Biblical Studies"
          ),
          issuer: t("Gimnasio Campestre Cristiano", "Gimnasio Campestre Cristiano"),
        },
        {
          title: t("Diplomado en Programación en Java", "Diploma in Java Programming"),
          issuer: t("Politécnico de Colombia", "Politécnico de Colombia"),
          // Puntos clave: `k` va resaltado y `v` completa la frase.
          points: [
            { k: t("Lógica de programación", "Programming logic"), v: t("y resolución de problemas algorítmicos", "and algorithmic problem solving") },
            { k: t("Programación orientada a objetos", "Object-oriented programming"), v: t("en Java", "in Java") },
            { k: t("Estructuras de datos", "Data structures"), v: t("básicas y fundamentos de desarrollo", "and software fundamentals") },
          ],
        },
        {
          title: t(
            "Diplomado en Automatización Industrial con enfoque en la Industria 4.0",
            "Diploma in Industrial Automation with a focus on Industry 4.0"
          ),
          issuer: t("Universitaria Agustiniana", "Universitaria Agustiniana"),
          tags: [t("Metodologías ágiles", "Agile methodologies")],
          lead: t("Diseño, implementación y optimización de sistemas automatizados.", "Design, implementation and optimization of automated systems."),
          points: [
            { k: t("PLC avanzado,", "Advanced PLC,"), v: t("sensores inteligentes y SCADA", "smart sensors and SCADA") },
            { k: t("IoT, IA", "IoT, AI"), v: t("y analítica de datos para la automatización", "and data analytics for automation") },
            { k: t("Redes industriales:", "Industrial networks:"), v: t("WiFi, Bluetooth, Zigbee, LoRa, NB-IoT y Modbus/TCP", "WiFi, Bluetooth, Zigbee, LoRa, NB-IoT and Modbus/TCP") },
            { k: t("Celdas flexibles", "Flexible cells"), v: t("y robótica colaborativa", "and collaborative robotics") },
            { k: t("Gemelos digitales", "Digital twins"), v: t("en realidad virtual", "in virtual reality") },
            { k: t("Metodologías ágiles", "Agile methodologies"), v: t("en proyectos reales", "on real projects") },
          ],
        },
        {
          title: t(
            "Ingeniería Mecatrónica, Robótica y Automatización",
            "Mechatronics, Robotics and Automation Engineering"
          ),
          issuer: t("Universitaria Agustiniana · Pregrado", "Universitaria Agustiniana · Bachelor's degree"),
        },
      ],
    },
    {
      label: t("Certificaciones", "Certifications"),
      figure: "medalla",
      items: [
        {
          title: t("Español C2", "Spanish C2"),
          issuer: t("Lengua materna", "Native language"),
        },
        {
          title: t("Certificación FESTO FACT", "FESTO FACT Center Certification"),
          issuer: t("Festo Didactic · Uniagustiniana", "Festo Didactic · Uniagustiniana"),
          tags: [t("Metodologías ágiles", "Agile methodologies")],
          lead: t("Formación práctica en el FACT Center de Festo Didactic, sobre escenarios industriales reales.", "Hands-on training at the Festo Didactic FACT Center, on real industrial scenarios."),
          points: [
            { k: t("Neumática y electroneumática", "Pneumatics and electro-pneumatics"), v: t("industrial", "for industry") },
            { k: t("Automatización industrial", "Industrial automation"), v: t("y programación avanzada de PLC", "and advanced PLC programming") },
            { k: t("Manufactura flexible", "Flexible manufacturing"), v: t("y celdas de producción automatizadas", "and automated production cells") },
            { k: t("Industria 4.0 e IIoT,", "Industry 4.0 and IIoT,"), v: t("con redes industriales inalámbricas", "with industrial wireless networks") },
            { k: t("Integración, diagnóstico", "System integration, diagnostics"), v: t("y optimización de sistemas", "and optimization") },
            { k: t("Metodologías ágiles", "Agile methodologies"), v: t("aplicadas al proyecto", "applied to the project") },
          ],
        },
        {
          title: t("Aptis General · Inglés C1", "Aptis General · English C1"),
          issuer: t("British Council", "British Council"),
        },
        {
          title: t("MATLAB Onramp", "MATLAB Onramp"),
          issuer: t("MathWorks", "MathWorks"),
          href: "https://matlabacademy.mathworks.com/progress/share/certificate.html?id=34b26b0a-037d-44df-98b7-54308746dc96&",
        },
      ],
    },
  ],
};

export const socials = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/jorge-andres-fajardo-mora-486912267",
  },
  { label: "GitHub", href: "https://github.com/jorgefajardom-coder" },
  { label: "YouTube", href: "https://www.youtube.com/@JorgeAndr%C3%A9sFajardoMora" },
];

/* ============================================================
   Objetos 3D que flotan sobre las secciones.
   - `model`: ruta a un .glb dentro de /public/models (exportado de Blender).
     Si el archivo no existe, se dibuja `fallback` automáticamente.
   - `fallback`: primitiva procedural — blob | knot | torus | capsule | ico | box
   - `position`: [x, y, profundidad]. x e y van de -1 a 1 y son RELATIVOS al
     hueco de la sección, así que el objeto nunca se sale del encuadre.
   - `scale`, `speed` (flotación) y `spin` (giro) son opcionales.
   ============================================================ */
export const props3d = {
  // El hero no lleva objetos: ahí manda el agujero negro (ver Stage.jsx).
  // Todo lo que flota es de temática espacial: planetas con anillo, lunas
  // facetadas y sondas. Van pegados a los bordes y con profundidad negativa
  // para no cruzarse con el texto, que ademas va por encima del lienzo.
  about: [
    { fallback: "planet", color: "#ef4b23", position: [-0.94, 0.42, -0.6], scale: 0.42, speed: 1.2 },
    { fallback: "moon", color: "#d8d4cc", position: [0.96, -0.32, -1.1], scale: 0.26, speed: 0.9 },
    { fallback: "satellite", color: "#ffb52e", position: [0.9, 0.6, -1.3], scale: 0.46, speed: 1.4 },
  ],
  certs: [
    // Abajo, en el hueco bajo las figuras: arriba tapaban los rotulos y la
    // leyenda de la carta.
    { fallback: "moon", color: "#e6e2da", position: [-0.94, -0.7, -0.8], scale: 0.3, speed: 1.1 },
    { fallback: "planet", color: "#ffb52e", position: [0.95, -0.8, -1.0], scale: 0.38, speed: 0.8 },
  ],
  contact: [
    { fallback: "satellite", color: "#ef4b23", position: [-0.93, -0.48, -0.7], scale: 0.48, speed: 1.0 },
    { fallback: "planet", color: "#ff6a00", position: [0.94, 0.55, -1.2], scale: 0.34, speed: 1.3 },
  ],
};
