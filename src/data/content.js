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
  name: "Jorge Andrés Fajardo Mora",
  // Version corta para la barra superior, donde el nombre completo ocupa demasiado
  short: t("Ing. J.A.F.M", "Eng. J.A.F.M"),
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
      "Llevo productos de la idea a la planta, y de la planta a la pantalla: ingeniería, 3D y marca en el mismo sitio.",
      "I take products from idea to factory floor, and from the floor to the screen: engineering, 3D, and brand in one place."
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
      "Del PLC en planta al agente que integra las herramientas del negocio.",
      "From the PLC on the floor to the agent that wires your business tools together."
    ),
  },
  projects: {
    id: "projects",
    heading: t("Proyectos", "Projects"),
  },
  certifications: {
    id: "certifications",
    heading: t("Certificaciones", "Certifications"),
    note: t(
      "Formación y credenciales verificables.",
      "Training and verifiable credentials."
    ),
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
      "Abierto a colaborar en robótica, automatización industrial e IA aplicada. LinkedIn o correo es la vía más rápida.",
      "Open to collaboration on robotics, industrial automation, and applied AI projects. LinkedIn or email is the fastest way to reach me."
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
  builtWith: t(
    "Hecho con React Three Fiber · Modelos en Blender",
    "Built with React Three Fiber · Models in Blender"
  ),

  // Filtro de proyectos
  categories: t("Categorías", "Categories"),
  allProjects: t("Todos", "All"),

  // Visor 3D de un proyecto
  model3d: t("Modelo 3D", "3D model"),
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
      "Ingeniero mecatrónico convertido en Technical Product Manager. Diseño y llevo a producción sistemas donde se cruzan la robótica, la automatización industrial y la IA: del PLC que gobierna una celda al pipeline de visión que la inspecciona.",
      "Mechatronics engineer turned Technical Product Manager. I design and ship systems where robotics, industrial automation and AI meet: from the PLC that runs a cell to the vision pipeline that inspects it."
    ),
    // Antes esto empezaba disculpandose ("no me quedo en lo tecnico"). Es la
    // ventaja, no una nota al pie: va afirmada.
    t(
      "Y sigo con el producto hasta su cara visible: el render, el prototipo, la marca con la que sale al mercado. Cómo funciona y cómo se entiende son la misma pieza de diseño.",
      "And I stay with the product through to its visible side: the render, the prototype, the brand it goes to market with. How it works and how it reads are one design problem."
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
    group: t("3D, simulación y juego", "3D, Simulation & Games"),
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
  {
    key: "producto",
    group: t("Producto", "Product"),
    items: [
      { name: "Jira", color: "#ff6a00" },
      { name: "Obsidian", color: "#ffcf70" },
      { name: "Agile · Scrum · Kanban", color: "#8B95A7" },
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
  {
    id: "producto",
    title: t("Gestión técnica de producto", "Technical Product Management"),
    desc: t(
      "Traducir necesidad de negocio en especificación técnica, priorizar el roadmap y coordinar hardware, software y manufactura hasta la entrega.",
      "Turning business need into technical spec, prioritizing the roadmap, and coordinating hardware, software, and manufacturing through to delivery."
    ),
    tags: ["Agile", "Scrum", "Jira", t("Hojas de ruta", "Roadmapping")],
  },
];

export const projectCategories = [
  { id: "design", label: t("Diseño de producto y packaging", "Product Design & Packaging") },
  { id: "robotics", label: t("Robótica y manufactura", "Robotics & Manufacturing") },
  { id: "ai", label: t("IA y automatización", "AI & Automation") },
  { id: "embedded", label: t("Embebidos e IoT", "Embedded & IoT") },
  { id: "tools", label: t("Ingeniería y herramientas", "Engineering & Tools") },
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
    // Los planos viven en el Drive del proyecto; cada pieza es su PDF.
    links: [
      { href: "https://drive.google.com/file/d/1EltxCHivTzSWGPLcv4SQB_HtRVR36VPm/view", label: t("Plano de la PCB", "PCB drawing") },
      { href: "https://drive.google.com/file/d/1I_7pa9GrhQLrT7MeBej3YFSA0SMtyjue/view", label: t("Plano de la carcasa", "Shell drawing") },
      { href: "https://drive.google.com/file/d/1xIW4Nni1rmdh1LIiR_ETocOjDJ9jX--8/view", label: t("Plano de la base", "Base drawing") },
    ],
    media: [{
      src: "/images/dron-explosionado.webp",
      fit: "contain",
      alt: t(
        "Vista explosionada del dron: hélices, motores, brazos del chasis, carcasa superior, PCB, carcasa inferior, uniones a presión y tren de aterrizaje",
        "Exploded view of the drone: propellers, motors, frame arms, top shell, PCB, bottom shell, snap-fit joints and landing gear"
      ),
    }],
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
      "Celda robótica que ensambla y paletiza drones cuadricópteros, validada entera en simulación antes de invertir en hardware. Cuatro manipuladores trabajan en paralelo en un espacio de 3,5 × 3,5 m: Alpha y Beta, de 6 GDL con pinza, montan motores y hélices por pares diagonales; Omega, con ventosa, coloca la PCB y la carcasa y traslada el dron terminado; y un paletizador sobre plataforma omnidireccional con ruedas Mecanum lo deja en su caja, alternando entre dos carros de cuatro posiciones. La lógica corre en un PLC virtual de CODESYS —una secuencia de doce etapas en texto estructurado— que se comunica con Unity por TCP y con el circuito neumático de FluidSIM por OPC: una parada o una emergencia del PLC congela la celda al instante. Los brazos fijos se reparten cuadrantes de 90° para no cruzarse sin necesidad de detectar colisiones, y la celda define tres zonas de seguridad según ISO 10218-2, vigiladas con visión MediaPipe sobre una ESP32-CAM.",
      "Robotic cell that assembles and palletizes quadcopter drones, validated entirely in simulation before investing in hardware. Four manipulators work in parallel in a 3.5 × 3.5 m space: Alpha and Beta, 6-DOF arms with grippers, fit motors and propellers in diagonal pairs; Omega, with a suction cup, places the PCB and shell and carries the finished drone; and a palletizer on an omnidirectional Mecanum-wheel platform drops it into its box, alternating between two four-slot carts. The logic runs on a CODESYS virtual PLC — a twelve-stage sequence in Structured Text — that talks to Unity over TCP and to the FluidSIM pneumatic circuit over OPC: a stop or emergency from the PLC freezes the cell instantly. The fixed arms split the space into 90° quadrants so they never cross paths without collision detection, and the cell defines three safety zones per ISO 10218-2, monitored with MediaPipe vision on an ESP32-CAM."
    ),
    tags: ["Unity", "C#", "CODESYS", "IEC 61131-3", "FluidSIM", "OPC", "MediaPipe", "ESP32-CAM"],
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
    category: "robotics",
    name: t("Gemelo digital de manufactura", "Digital Twin Manufacturing System"),
    year: "2025",
    href: "",
    desc: t(
      "Gemelo digital de una línea de producción que sincroniza el entorno virtual con los robots físicos para pruebas, monitorización y validación antes del despliegue. Comunicación en tiempo real, visualización 3D, detección de colisiones y optimización de proceso.",
      "Digital twin of a production line that syncs the virtual environment with physical robots for testing, monitoring, and validation before deployment. Real-time communication, 3D visualization, collision detection, and process optimization."
    ),
    tags: ["Unity", "Python", "C#", t("Robótica industrial", "Industrial Robotics")],
    media: [{ palette: ["#ffb52e", "#ff8a1f"] }, { palette: ["#ff8a1f", "#131316"] }],
  },
  {
    category: "robotics",
    name: t("Plataforma colaborativa multirrobot", "Multi-Robot Collaborative Platform"),
    year: "2024",
    href: "",
    desc: t(
      "Sistema distribuido donde varios robots se coordinan para transportar, ensamblar y manipular objetos. Comunicación distribuida y planificación de tareas, escalable a múltiples agentes.",
      "Distributed system where multiple robots coordinate to transport, assemble, and manipulate objects. Distributed communication and task planning, scalable to multiple agents."
    ),
    tags: ["Python", "C++", "Unity", t("Robótica", "Robotics")],
    media: [{ palette: ["#ff6a00", "#ffcf70"] }, { palette: ["#ff8a1f", "#ef4b23"] }],
  },
  {
    category: "robotics",
    name: t("Plataforma de navegación para robot móvil", "Mobile Robot Navigation Platform"),
    year: "2024",
    href: "",
    desc: t(
      "Robot móvil omnidireccional con ruedas Mecanum, IMU, sensores de línea QTR y ultrasonidos, construido para navegación autónoma y seguimiento de línea.",
      "Omnidirectional mobile robot with Mecanum wheels, IMU, QTR line sensors, and ultrasonic sensing, built for autonomous navigation and line following."
    ),
    tags: ["Arduino", "Python", "C++"],
    media: [{ palette: ["#ffb52e", "#0a0a0b"] }, { palette: ["#ff8a1f", "#ef4b23"] }],
  },
  {
    category: "robotics",
    name: t("Framework de control robótico", "Robotics Control Framework"),
    year: "2024",
    href: "",
    desc: t(
      "Framework modular y extensible para controlar múltiples actuadores y sensores, incluido el control sincronizado de varios drivers de servos PCA9685.",
      "Modular, extensible framework for controlling multiple actuators and sensors, including synchronized control across several PCA9685 servo drivers."
    ),
    tags: ["Python", "Arduino", t("Sistemas embebidos", "Embedded Systems")],
    media: [{ palette: ["#c93812", "#131316"] }, { palette: ["#ff8a1f", "#0a0a0b"] }],
  },
  {
    category: "robotics",
    name: t("Herramientas de simulación robótica", "Robotics Simulation Toolkit"),
    year: "2024",
    href: "",
    desc: t(
      "Conjunto de herramientas para simular robots industriales, cinemática y trayectorias, pensado para pruebas virtuales y visualización 3D antes de la implementación física.",
      "Collection of tools for simulating industrial robots, kinematics, and trajectories, for virtual testing and 3D visualization before physical implementation."
    ),
    tags: ["Unity", "C#"],
    media: [{ palette: ["#e5e7eb", "#ef4b23"] }, { palette: ["#0a0a0b", "#ff8a1f"] }],
  },
  {
    category: "ai",
    name: t("Sistema de visión con IA", "AI Vision System"),
    year: "2025",
    href: "",
    desc: t(
      "Visión artificial en tiempo real para detección, seguimiento y análisis de objetos mediante cámaras y modelos de IA. Integrado con robots y ajustado para baja latencia.",
      "Real-time computer vision for object detection, tracking, and analysis via cameras and AI models. Integrated with robots, tuned for low latency."
    ),
    tags: ["Python", "OpenCV", "MediaPipe", "TensorFlow"],
    media: [{ palette: ["#ffb52e", "#ff8a1f"] }, { palette: ["#c93812", "#0a0a0b"] }],
  },
  {
    category: "ai",
    name: t("Automatización de flujos con IA", "AI Workflow Automation"),
    year: "2025",
    href: "",
    desc: t(
      "Automatización de procesos con agentes de IA que integran múltiples herramientas y servicios a través de APIs.",
      "Process automation using AI agents that integrate multiple tools and services through APIs."
    ),
    tags: ["Python", "n8n", "Make", "HubSpot", "Airtable", "LLMs"],
    media: [{ palette: ["#ff6a00", "#ef4b23"] }, { palette: ["#ff8a1f", "#131316"] }],
  },
  {
    category: "embedded",
    name: t("Red de cámaras remotas ESP32", "ESP32 Remote Camera Network"),
    year: "2024",
    href: "",
    desc: t(
      "Infraestructura ESP32-CAM para monitorización remota y streaming de vídeo de baja latencia (MJPEG sobre WebSockets), con control remoto e integración de IA.",
      "ESP32-CAM infrastructure for remote monitoring and low-latency video streaming (MJPEG over WebSockets), with remote control and AI integration."
    ),
    tags: ["ESP32", "Arduino", "Python", "OpenCV"],
    media: [{ palette: ["#ff8a1f", "#131316"] }, { palette: ["#ff6a00", "#0a0a0b"] }],
  },
  {
    category: "embedded",
    name: t("Plataforma de monitorización IoT industrial", "Industrial IoT Monitoring Platform"),
    year: "2024",
    href: "",
    desc: t(
      "Adquisición en tiempo real, cuadros de mando y monitorización remota de datos de sensores industriales, integrada con PLCs.",
      "Real-time acquisition, dashboarding, and remote monitoring of industrial sensor data, integrated with PLCs."
    ),
    tags: ["Python", "IoT", "PLC", "OPC UA"],
    media: [{ palette: ["#ff8a1f", "#0a0a0b"] }, { palette: ["#ffb52e", "#131316"] }],
  },
  {
    category: "tools",
    name: t("Repositorio de diseño de ingeniería", "Engineering Design Repository"),
    year: "2024",
    href: "",
    desc: t(
      "Diseños mecánicos y electrónicos para proyectos de automatización y robótica: diseño de PCB, CAD, modelado 3D, planos mecánicos y esquemas eléctricos.",
      "Mechanical and electronic designs for automation and robotics projects: PCB design, CAD, 3D modeling, mechanical drawings, and electrical diagrams."
    ),
    tags: ["Fusion 360", "Inventor", "EasyEDA", "Fritzing"],
    media: [{ palette: ["#ffcf70", "#131316"] }, { palette: ["#ff6a00", "#0a0a0b"] }],
  },
  {
    category: "tools",
    name: t("Proyectos de software industrial", "Industrial Software Projects"),
    year: "2024",
    href: "",
    desc: t(
      "Colección de aplicaciones industriales para automatización, monitorización y control, incluidas interfaces HMI e integración con hardware.",
      "Collection of industrial applications for automation, monitoring, and control, including HMI interfaces and hardware integration."
    ),
    tags: ["C#", "Java", "Python"],
    media: [{ palette: ["#c93812", "#ff8a1f"] }, { palette: ["#ffcf70", "#0a0a0b"] }],
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
    { name: "Team Icon Official", logo: "/images/clients/be-an-icon.png", href: "https://www.instagram.com/team_icon_official/" },
    { name: "MiuTab", logo: "/images/clients/miutab.png", logoScale: 1.4, hideLabel: true, href: "https://www.linkedin.com/company/miutab/posts/?feedView=all" },
    { name: "Uniagustiniana", logo: "/images/clients/uniagustiniana.png", logoScale: 1.35, href: "https://www.instagram.com/uniagustoficial/" },
    { name: "Franco's Photography Col", logo: "/images/clients/francos-photography.png", href: "https://www.instagram.com/francosfotografiacol/" },
    { name: "Khronos Ink", logo: "/images/clients/khronos-ink.png", href: "" },
  ],
};

/* ============================================================
   Certificaciones y formación
   TODO: esto es una plantilla. Pásame tu lista real (nombre,
   entidad, año y enlace del certificado) y la relleno.
   ============================================================ */
export const certifications = {
  // El titular y la nota están en `sections.certifications`.
  items: [
    {
      title: t("Ingeniería mecatrónica", "Mechatronics Engineering"),
      issuer: t("Pregrado", "Bachelor's degree"),
      year: "",
      href: "",
    },
    // Añade aquí las demás:
    // { title: t("Nombre ES", "Name EN"), issuer: "Coursera", year: "2024", href: "https://..." },
  ],
};

export const socials = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/in/jorge-andr%C3%A9s-fajardo-mora-486912267",
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
    { fallback: "moon", color: "#e6e2da", position: [-0.95, 0.5, -0.8], scale: 0.3, speed: 1.1 },
    { fallback: "planet", color: "#ffb52e", position: [0.95, -0.4, -1.0], scale: 0.38, speed: 0.8 },
  ],
  contact: [
    { fallback: "satellite", color: "#ef4b23", position: [-0.93, -0.48, -0.7], scale: 0.48, speed: 1.0 },
    { fallback: "planet", color: "#ff6a00", position: [0.94, 0.55, -1.2], scale: 0.34, speed: 1.3 },
  ],
};
