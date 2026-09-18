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
  },
};

/* ============================================================
   Marquee: las herramientas con las que más trabajo
   ============================================================ */
export const disciplines = [
  { name: t("Automatización industrial", "Industrial automation"), shape: "square" },
  { name: t("Robótica", "Robotics"), shape: "circle" },
  { name: t("IA y visión artificial", "AI & computer vision"), shape: "arc" },
  { name: t("3D y animación", "3D & animation"), shape: "triangle" },
  { name: t("Videojuegos", "Games"), shape: "cross" },
  { name: t("Diseño de PCB", "PCB design"), shape: "square" },
  { name: "Packaging", shape: "drop" },
  { name: t("Diseño web", "Web design"), shape: "square" },
  { name: t("Creación de marca", "Brand creation"), shape: "circle" },
  { name: t("Marketing y contenido", "Marketing & content"), shape: "arc" },
  { name: t("Locución y radio", "Voice & radio"), shape: "drop" },
];

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
      "Ingeniero mecatrónico convertido en Technical Product Manager, trabajando en la intersección entre robótica, automatización industrial e IA. Diseño y llevo a producción sistemas que combinan hardware embebido, software de control y machine learning: desde celdas de manufactura gobernadas por PLC hasta pipelines de visión con IA.",
      "Mechatronics Engineer turned Technical Product Manager, working at the intersection of robotics, industrial automation, and AI. I design and ship systems that combine embedded hardware, control software, and machine learning, from PLC-driven manufacturing cells to AI-powered vision pipelines."
    ),
    // La lista completa de disciplinas ya sale dos veces en la página (la tira
    // del hero y el acordeón de "Qué hago"): aquí va la idea, no el inventario.
    t(
      "Y no me quedo en lo técnico: el mismo producto lo acompaño hasta su lado visible, del render y el prototipo a la marca con la que sale al mercado. Un producto se explica tanto por cómo funciona como por cómo se ve y se cuenta.",
      "And I don't stop at the engineering: I follow the same product through to its visible side, from the render and the prototype to the brand it goes to market with. A product is explained as much by how it looks and is told as by how it works."
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
    group: t("3D, simulación y juego", "3D, Simulation & Games"),
    items: [
      { name: "Blender", color: "#ff6a00" },
      { name: "Unity", color: "#E5E7EB" },
      { name: "Three.js / R3F", color: "#ffcf70" },
      { name: "GSAP", color: "#ff8a1f" },
    ],
  },
  {
    group: t("Diseño, vídeo y contenido", "Design, Video & Content"),
    items: [
      { name: "Canva", color: "#ef4b23" },
      { name: "CapCut", color: "#ffb52e" },
      { name: "Filmora", color: "#c93812" },
    ],
  },
  {
    group: t("CAD y diseño de producto", "CAD & Product Design"),
    items: [
      { name: "Autodesk Inventor", color: "#ff6a00" },
      { name: "Fusion 360", color: "#ffcf70" },
      { name: "Revit", color: "#ff8a1f" },
      { name: "Packaging", color: "#ff6a00" },
    ],
  },
  {
    group: t("Datos y cálculo", "Data & Computing"),
    items: [
      { name: "MATLAB", color: "#ef4b23" },
      { name: "NumPy", color: "#ffb52e" },
      { name: "Pandas", color: "#c93812" },
    ],
  },
  {
    group: t("Producto", "Product"),
    items: [
      { name: "Jira", color: "#ff6a00" },
      { name: "Obsidian", color: "#ffcf70" },
      { name: "Agile · Scrum · Kanban", color: "#8B95A7" },
    ],
  },
];

export const services = [
  {
    title: t("Modelado y visualización 3D", "3D Modeling & Visualization"),
    desc: t(
      "Modelado hard-surface y orgánico en Blender, listo para render o para motor en tiempo real. Iluminación de estudio, materiales físicamente correctos y variantes de color para catálogo o campaña.",
      "Hard-surface and organic modeling in Blender, ready for render or for a real-time engine. Studio lighting, physically correct materials, and color variants for catalog or campaign."
    ),
    tags: ["Blender", "Look dev", "HDRI", "Retopo"],
  },
  {
    title: t("Animación 3D y gemelos digitales", "3D Animation & Digital Twins"),
    desc: t(
      "Animación de cámara, rigging mecánico y simulación física para explicar cómo funciona un mecanismo. Entornos virtuales sincronizados con la planta real para validar antes de desplegar.",
      "Camera animation, mechanical rigging, and physics simulation to explain how a mechanism works. Virtual environments synced with the real plant to validate before deployment."
    ),
    tags: ["Blender", "Unity", "C#", "Rigging"],
  },
  {
    title: t("Web 3D y videojuegos", "Web 3D & Games"),
    desc: t(
      "Experiencias en tiempo real: configuradores, landings inmersivas y videojuegos. Del prototipo jugable a la escena WebGL que también va fluida en móvil.",
      "Real-time experiences: configurators, immersive landing pages, and games. From playable prototype to a WebGL scene that stays smooth on mobile."
    ),
    tags: ["Unity", "C#", "Three.js / R3F", "WebGL"],
  },
  {
    title: t("Diseño y desarrollo web", "Web Design & Development"),
    desc: t(
      "Sitios y landings que cargan rápido y se ven bien en cualquier pantalla. Del diseño de la interfaz al código, sin plantillas genéricas.",
      "Sites and landing pages that load fast and hold up on any screen. From interface design to code, without generic templates."
    ),
    tags: ["React", "Vite", "UI", "Responsive", "SEO"],
  },
  {
    title: t("Diseño de PCB y electrónica", "PCB & Electronics Design"),
    desc: t(
      "Esquemático, ruteo y preparación para fabricación. Del prototipo en protoboard a la placa lista para ensamblar, con la parte embebida incluida.",
      "Schematic, routing, and manufacturing prep. From breadboard prototype to a board ready for assembly, embedded firmware included."
    ),
    tags: ["EasyEDA", "Fritzing", "Arduino", "ESP32"],
  },
  {
    title: t("Packaging y diseño de producto", "Packaging & Product Design"),
    desc: t(
      "Estructura, troquel y acabado del empaque, más el render que lo vende antes de existir físicamente. CAD y 3D trabajando sobre la misma pieza.",
      "Structure, die-cut, and finish of the package, plus the render that sells it before it physically exists. CAD and 3D working on the same piece."
    ),
    tags: ["Fusion 360", "Inventor", "Blender", "Dieline"],
  },
  {
    title: t("Creación de marca", "Brand Creation"),
    desc: t(
      "Identidad visual desde cero: naming, logotipo, sistema de color y tipografía, y el manual para que la marca se sostenga cuando la use otro.",
      "Visual identity from scratch: naming, logo, color and type system, and the guidelines that keep the brand consistent once someone else uses it."
    ),
    tags: ["Identidad", "Naming", "Art direction", "Brand book"],
  },
  {
    title: t("Marketing y contenido", "Marketing & Content"),
    desc: t(
      "Las piezas que ponen la marca a trabajar: campañas, vídeo y contenido para redes, edición y montaje incluidos.",
      "The pieces that put the brand to work: campaigns, video, and social content, editing and assembly included."
    ),
    tags: ["CapCut", "Filmora", "Campañas", "Social"],
  },
  {
    title: t("Locución y radio", "Voice & Radio"),
    desc: t(
      "Locución para radio, podcast y voz en off. Guion, grabación y montaje: la voz que le pone cara a la marca.",
      "Voice work for radio, podcast, and voice-over. Script, recording, and edit: the voice that gives the brand a face."
    ),
    tags: ["Locución", "Radio", "Podcast", "Voz en off"],
  },
  {
    title: t("Automatización industrial", "Industrial Automation"),
    desc: t(
      "Control de celdas de manufactura con PLC: lógica IEC 61131-3, comunicación industrial y puesta en marcha. De la especificación al sistema funcionando en planta.",
      "PLC-driven manufacturing cell control: IEC 61131-3 logic, industrial communication, and commissioning. From spec to a system running on the floor."
    ),
    tags: ["CODESYS", "Ladder Logic", "OPC UA", "Modbus"],
  },
  {
    title: t("Robótica y control de movimiento", "Robotics & Motion Control"),
    desc: t(
      "Arquitecturas modulares de 6 GDL, cinemática, planificación de trayectorias y coordinación entre varios robots que comparten tarea y espacio de trabajo.",
      "Modular 6-DOF architectures, kinematics, trajectory planning, and coordination between multiple robots sharing a task and a workspace."
    ),
    tags: ["Python", "C++", "MATLAB", "Kinematics"],
  },
  {
    title: t("IA aplicada y visión artificial", "Applied AI & Computer Vision"),
    desc: t(
      "Detección, seguimiento y análisis en tiempo real integrados con robots, ajustados para baja latencia en entornos de producción.",
      "Real-time detection, tracking, and analysis integrated with robots, tuned for low latency in production environments."
    ),
    tags: ["OpenCV", "MediaPipe", "TensorFlow", "PyTorch"],
  },
  {
    title: t("Automatización de flujos y CRM", "Workflow Automation & CRM"),
    desc: t(
      "Agentes e integraciones que conectan las herramientas del negocio por API: CRM, bases de datos y procesos internos que dejan de hacerse a mano.",
      "Agents and integrations that connect business tools over APIs: CRM, databases, and internal processes that stop being done by hand."
    ),
    tags: ["n8n", "Make", "HubSpot", "Airtable"],
  },
  {
    title: t("Gestión técnica de producto", "Technical Product Management"),
    desc: t(
      "Traducir necesidad de negocio en especificación técnica, priorizar el roadmap y coordinar hardware, software y manufactura hasta la entrega.",
      "Turning business need into technical spec, prioritizing the roadmap, and coordinating hardware, software, and manufacturing through to delivery."
    ),
    tags: ["Agile", "Scrum", "Jira", "Roadmapping"],
  },
];

export const projectCategories = [
  { id: "robotics", label: t("Robótica y manufactura", "Robotics & Manufacturing") },
  { id: "ai", label: t("IA y automatización", "AI & Automation") },
  { id: "embedded", label: t("Embebidos e IoT", "Embedded & IoT") },
  { id: "tools", label: t("Ingeniería y herramientas", "Engineering & Tools") },
];

export const projects = [
  {
    category: "robotics",
    name: "Autonomous Drone Manufacturing Cell",
    year: "2025",
    href: "",
    desc: t(
      "Celda de manufactura flexible para ensamblaje, inspección, empaquetado y transporte de drones con varios brazos robóticos colaborativos. Arquitectura modular de 6 GDL, control CODESYS (IEC 61131-3), simulación completa en Unity, visión artificial, planificación de trayectorias y coordinación multi-robot para Industria 4.0.",
      "Flexible manufacturing cell for drone assembly, inspection, packaging, and transport using multiple collaborative robotic arms. Modular 6-DOF architecture, CODESYS (IEC 61131-3) control, full Unity simulation, computer vision, trajectory planning, and multi-robot coordination for Industry 4.0."
    ),
    tags: ["Unity", "C#", "CODESYS", "Python", "PLC"],
    media: [{ palette: ["#ff8a1f", "#ff8a1f"] }, { palette: ["#ef4b23", "#0a0a0b"] }],
  },
  {
    category: "robotics",
    name: "Digital Twin Manufacturing System",
    year: "2025",
    href: "",
    desc: t(
      "Gemelo digital de una línea de producción que sincroniza el entorno virtual con los robots físicos para pruebas, monitorización y validación antes del despliegue. Comunicación en tiempo real, visualización 3D, detección de colisiones y optimización de proceso.",
      "Digital twin of a production line that syncs the virtual environment with physical robots for testing, monitoring, and validation before deployment. Real-time communication, 3D visualization, collision detection, and process optimization."
    ),
    tags: ["Unity", "Python", "C#", "Industrial Robotics"],
    media: [{ palette: ["#ffb52e", "#ff8a1f"] }, { palette: ["#ff8a1f", "#131316"] }],
  },
  {
    category: "robotics",
    name: "Multi-Robot Collaborative Platform",
    year: "2024",
    href: "",
    desc: t(
      "Sistema distribuido donde varios robots se coordinan para transportar, ensamblar y manipular objetos. Comunicación distribuida y planificación de tareas, escalable a múltiples agentes.",
      "Distributed system where multiple robots coordinate to transport, assemble, and manipulate objects. Distributed communication and task planning, scalable to multiple agents."
    ),
    tags: ["Python", "C++", "Unity", "Robotics"],
    media: [{ palette: ["#ff6a00", "#ffcf70"] }, { palette: ["#ff8a1f", "#ef4b23"] }],
  },
  {
    category: "robotics",
    name: "Mobile Robot Navigation Platform",
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
    name: "Robotics Control Framework",
    year: "2024",
    href: "",
    desc: t(
      "Framework modular y extensible para controlar múltiples actuadores y sensores, incluido el control sincronizado de varios drivers de servos PCA9685.",
      "Modular, extensible framework for controlling multiple actuators and sensors, including synchronized control across several PCA9685 servo drivers."
    ),
    tags: ["Python", "Arduino", "Embedded Systems"],
    media: [{ palette: ["#c93812", "#131316"] }, { palette: ["#ff8a1f", "#0a0a0b"] }],
  },
  {
    category: "robotics",
    name: "Robotics Simulation Toolkit",
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
    name: "AI Vision System",
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
    name: "AI Workflow Automation",
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
    name: "ESP32 Remote Camera Network",
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
    name: "Industrial IoT Monitoring Platform",
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
    name: "Engineering Design Repository",
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
    name: "Industrial Software Projects",
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
  about: [
    { fallback: "torus", color: "#ef4b23", position: [-0.82, 0.3, 0], scale: 0.55, speed: 1.2 },
    { fallback: "knot", color: "#ffb52e", position: [0.84, -0.15, -0.5], scale: 0.5, speed: 0.9 },
    { fallback: "ico", color: "#f2f2f0", position: [0.62, 0.62, -1.2], scale: 0.32, speed: 1.4 },
  ],
  certs: [
    { fallback: "capsule", color: "#ff6a00", position: [-0.86, 0.45, 0], scale: 0.45, speed: 1.1 },
    { fallback: "blob", color: "#ffb52e", position: [0.86, -0.35, -0.4], scale: 0.5, speed: 0.8 },
  ],
  contact: [
    { fallback: "knot", color: "#ef4b23", position: [-0.82, -0.42, 0], scale: 0.5, speed: 1.0 },
    { fallback: "box", color: "#ff6a00", position: [0.84, 0.5, -0.6], scale: 0.42, speed: 1.3 },
  ],
};
