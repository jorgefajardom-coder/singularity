import {
  ACESFilmicToneMapping, AdditiveBlending, AmbientLight, DirectionalLight, Group, Mesh,
  MeshStandardMaterial, OrthographicCamera, Scene, ShaderMaterial,
  SphereGeometry, WebGLRenderer,
} from "three";

// Una sola escena para todas las esferas. Las coordenadas en píxeles permiten
// compartir exactamente la trayectoria de los logos sin transformar el canvas.
export function createOrbitSpheres(host, count) {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  host.appendChild(renderer.domElement);
  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 4000);
  camera.position.z = 2000;
  scene.add(new AmbientLight(0xffffff, 0.25));
  const key = new DirectionalLight(0xffffff, 2.4);
  key.position.set(-600, 800, 500);
  scene.add(key);
  const fill = new DirectionalLight(0xcad9ff, 0.3);
  fill.position.set(500, -200, 400);
  scene.add(fill);

  const geometry = new SphereGeometry(1, 40, 28);
  const balls = Array.from({ length: count }, () => {
    const group = new Group();
    // Blanco que emite por si mismo: sobre el negro del espacio y contra el
    // naranja del disco, una esfera que solo refleja se apaga. El `emissive`
    // la mantiene encendida aunque la luz clave no le de.
    const material = new MeshStandardMaterial({
      color: 0xffffff, roughness: 0.18, metalness: 0.04,
      emissive: 0xffffff, emissiveIntensity: 0.55,
      transparent: true, opacity: 0,
    });
    const body = new Mesh(geometry, material);
    group.add(body);
    // Halo sobre geometría esférica, con caída suave hacia su silueta.
    const glowMaterial = new ShaderMaterial({
      transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { opacity: { value: 0 } },
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        uniform float opacity;
        void main() {
          // Caida mas suave y blanco puro: el halo se lee como luz propia,
          // no como un reflejo azulado.
          float falloff = pow(max(normalize(vNormal).z, 0.0), 2.6);
          gl_FragColor = vec4(1.0, 1.0, 1.0, falloff * opacity * 0.5);
        }
      `,
    });
    const glow = new Mesh(geometry, glowMaterial);
    glow.scale.setScalar(3.1);
    group.add(glow);
    scene.add(group);
    return { group, material, glowMaterial };
  });
  let width = 0, height = 0;
  return {
    resize(w, h) {
      if (width === w && height === h) return;
      width = w; height = h;
      renderer.setSize(w, h);
      camera.left = -w / 2; camera.right = w / 2;
      camera.top = h / 2; camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
    },
    update(i, { x, y, z, radius, opacity }) {
      const ball = balls[i];
      ball.group.visible = opacity > 0.001;
      ball.group.position.set(x - width / 2, height / 2 - y, z);
      // Escala uniforme: el giro de la órbita nunca aplasta la esfera.
      ball.group.scale.setScalar(radius);
      ball.material.opacity = opacity;
      ball.glowMaterial.uniforms.opacity.value = opacity;
    },
    render() { renderer.render(scene, camera); },
    /** El lienzo, para vigilar si pierde el contexto (ver Orbit.jsx). */
    canvas: renderer.domElement,
    dispose() {
      geometry.dispose();
      balls.forEach(({ material, glowMaterial }) => {
        material.dispose(); glowMaterial.dispose();
      });
      renderer.dispose();
      // `dispose` suelta los recursos pero NO el contexto: el navegador lo
      // mantiene vivo hasta que el recolector pase, y mientras cuenta para
      // el tope de contextos. Se suelta a mano.
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
