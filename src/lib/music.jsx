import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { music } from "../data/content";
import { audioBands } from "./audioAnalysis";
import { asset } from "./asset";

const MusicContext = createContext(null);

/**
 * La pista de fondo bajada y decodificada DURANTE LA CARGA (la pide el
 * cargador, ver `hitos` en Loader.jsx), para que al pulsar la cinta suene sin
 * esperar. Se decodifica con un OfflineAudioContext: un AudioBuffer no
 * pertenece a ningun contexto y lo reproduce luego el de verdad, que solo
 * puede crearse con el gesto del visitante.
 */
let pistaPrecargada = null;
export function precargarPista() {
  if (!music.src || !music.bucle) return Promise.resolve(null);
  if (!pistaPrecargada) {
    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    pistaPrecargada = fetch(asset(music.src))
      .then((r) => { if (!r.ok) throw new Error(`pista ${r.status}`); return r.arrayBuffer(); })
      .then((datos) => (Offline ? new Offline(2, 1, 44100).decodeAudioData(datos) : null))
      .catch((e) => { pistaPrecargada = null; throw e; });
  }
  return pistaPrecargada;
}
const SILENCE = { bass: 0, mid: 0, treble: 0 };
// Volumen de lo que sube el visitante: no se sabe como viene masterizado.
const VOLUMEN_ARCHIVO = 0.55;

/**
 * DOS FORMAS DE SONAR.
 *
 * La pista de fondo (`music.src` con `music.bucle`) va por Web Audio, con un
 * AudioBufferSourceNode y sus puntos de bucle: es la unica manera de cerrar el
 * bucle a la muestra. Un `<audio loop>` con MP3 deja un hueco en cada vuelta
 * (el relleno del codificador), y saltar con `currentTime` otro de ~50-100 ms.
 * Pausar es suspender el contexto, que congela el bucle donde esta.
 *
 * Lo que sube el visitante sigue por el `<audio>`: puede ser cualquier cosa y
 * no hay puntos de bucle que respetar.
 *
 * Los dos pasan por el mismo analizador (el agujero negro y el medidor leen de
 * ahi) y por la misma ganancia (silenciar y volumen).
 */
export function MusicProvider({ children, active }) {
  const audio = useRef(null);
  const graph = useRef(null);
  const objectUrl = useRef(null);
  const conBucle = Boolean(music.src && music.bucle);
  // "pista": la de fondo por Web Audio. "archivo": el <audio>.
  const modo = useRef(conBucle ? "pista" : "archivo");
  const pista = useRef({ buffer: null, cargando: null, fuente: null });
  const [src, setSrc] = useState(asset(music.src));
  // Lo que suena por el <audio>: con la pista de fondo, nada hasta que el
  // visitante suba un archivo.
  const [srcAudio, setSrcAudio] = useState(conBucle ? null : asset(music.src));
  const [title, setTitle] = useState(music.title);
  const [playing, setPlaying] = useState(false);
  const playingRef = useRef(false);
  const [error, setError] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("portfolio-muted") === "true"; } catch { return false; }
  });
  const mutedRef = useRef(muted);
  const requestId = useRef(0);
  const playbackIntent = useRef(Boolean(music.src));

  const sonando = useCallback((v) => { playingRef.current = v; setPlaying(v); }, []);
  const volumen = () => (modo.current === "pista" ? music.volumen ?? VOLUMEN_ARCHIVO : VOLUMEN_ARCHIVO);

  const ensureGraph = useCallback(async () => {
    if (!graph.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("Audio analysis unavailable");
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.72;
      const gain = context.createGain();
      gain.gain.value = mutedRef.current ? 0 : volumen();
      // Analizar antes del volumen permite silenciar sin perder la reacción visual.
      analyser.connect(gain); gain.connect(context.destination);
      graph.current = { context, source: null, analyser, gain, bins: new Uint8Array(analyser.frequencyBinCount) };
    }
    await graph.current.context.resume();
  }, []);

  // El <audio> se engancha al grafo solo cuando hace falta (un archivo del
  // visitante), y una sola vez: createMediaElementSource no admite dos.
  const engancharElemento = useCallback(() => {
    const g = graph.current;
    if (!g.source) {
      g.source = g.context.createMediaElementSource(audio.current);
      g.source.connect(g.analyser);
    }
  }, []);

  // Baja y decodifica la pista una vez; se pide al elegir idioma.
  const cargarPista = useCallback(() => {
    const p = pista.current;
    if (p.buffer) return Promise.resolve(p.buffer);
    if (!p.cargando) {
      // Normalmente ya viene decodificada de la carga (`precargarPista`).
      p.cargando = precargarPista()
        .then((buffer) => buffer || fetch(asset(music.src))
          .then((r) => r.arrayBuffer())
          .then((datos) => graph.current.context.decodeAudioData(datos)))
        .then((buffer) => { p.buffer = buffer; return buffer; })
        .catch((e) => { p.cargando = null; throw e; });
    }
    return p.cargando;
  }, []);

  const pararPista = useCallback(() => {
    const f = pista.current.fuente;
    if (!f) return;
    try { f.stop(); } catch { /* ya parada */ }
    f.disconnect();
    pista.current.fuente = null;
  }, []);

  const play = useCallback(async () => {
    const id = ++requestId.current;
    setError(false);
    try {
      await ensureGraph();
      if (id !== requestId.current) return;
      if (modo.current === "pista") {
        const buffer = await cargarPista();
        if (id !== requestId.current) return;
        const g = graph.current;
        if (!pista.current.fuente) {
          const f = g.context.createBufferSource();
          f.buffer = buffer;
          f.loop = true;
          f.loopStart = music.bucle.inicio;
          f.loopEnd = music.bucle.fin;
          f.connect(g.analyser);
          f.start(0, music.bucle.arranque);
          pista.current.fuente = f;
        }
        await g.context.resume();
        if (id === requestId.current) sonando(true);
      } else {
        engancharElemento();
        await audio.current.play();
      }
    } catch {
      if (id === requestId.current) { setError(true); sonando(false); }
    }
  }, [ensureGraph, cargarPista, engancharElemento, sonando]);

  const pause = useCallback(() => {
    requestId.current++;
    if (modo.current === "pista") {
      if (graph.current && pista.current.fuente) void graph.current.context.suspend();
      sonando(false);
    } else {
      audio.current?.pause();
    }
  }, [sonando]);

  // Preparar el contexto con el gesto de elegir idioma, pero sin reproducir
  // todavía: la pista empieza cuando el agujero ya esta pintado. De paso se
  // baja y decodifica la pista, para que al llegar ese momento no espere.
  const prepare = useCallback(async () => {
    const hay = modo.current === "pista" || audio.current?.getAttribute("src");
    if (!hay) return;
    try {
      await ensureGraph();
      if (modo.current === "pista") void cargarPista().catch(() => {});
    } catch { /* El botón de reproducción permite reintentar. */ }
  }, [ensureGraph, cargarPista]);

  useEffect(() => {
    const hay = modo.current === "pista" || audio.current?.getAttribute("src");
    if (active && playbackIntent.current && hay) void play();
    else if (!active) pause();
  }, [active, play, pause]);

  const loadFile = useCallback((file) => {
    if (!file) return;
    if (file.type && !file.type.startsWith("audio/")) { setError(true); return; }
    requestId.current++;
    // Del bucle de fondo al archivo del visitante.
    pararPista();
    modo.current = "archivo";
    if (graph.current) graph.current.gain.gain.value = mutedRef.current ? 0 : volumen();
    audio.current.pause();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    audio.current.src = objectUrl.current;
    audio.current.load();
    setSrc(objectUrl.current);
    setSrcAudio(objectUrl.current);
    setTitle(file.name.replace(/\.[^.]+$/, ""));
    playbackIntent.current = true;
    void play();
  }, [play, pararPista]);

  const togglePlay = useCallback(() => {
    const parado = modo.current === "pista" ? !playingRef.current : audio.current.paused;
    if (parado) { playbackIntent.current = true; void play(); }
    else { playbackIntent.current = false; pause(); }
  }, [play, pause]);

  useEffect(() => {
    mutedRef.current = muted;
    const g = graph.current;
    if (g) g.gain.gain.setTargetAtTime(muted ? 0 : volumen(), g.context.currentTime, 0.025);
    try { localStorage.setItem("portfolio-muted", String(muted)); } catch { /* Almacenamiento opcional. */ }
  }, [muted]);

  useEffect(() => () => {
    requestId.current++;
    pararPista();
    graph.current?.source?.disconnect();
    graph.current?.analyser.disconnect();
    graph.current?.gain.disconnect();
    void graph.current?.context.close();
    graph.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, [pararPista]);

  // Un solo analisis por fotograma. Lo piden el agujero negro (en su bucle de
  // r3f) y el medidor del reproductor (en el suyo), y cada peticion era una
  // FFT de 1024 bandas: dentro del mismo fotograma se devuelve la ultima.
  const ultimo = useRef({ t: -1, bandas: SILENCE });
  const sample = useCallback(() => {
    const g = graph.current;
    const parado = modo.current === "pista" ? !playingRef.current : audio.current?.paused;
    if (!g || parado || g.context.state !== "running") return SILENCE;
    const ahora = performance.now();
    const u = ultimo.current;
    if (ahora - u.t < 12) return u.bandas;
    g.analyser.getByteFrequencyData(g.bins);
    u.t = ahora;
    u.bandas = audioBands(g.bins, g.context.sampleRate, g.analyser.fftSize);
    return u.bandas;
  }, []);
  const api = useMemo(() => ({src, title, playing, muted, error, loadFile, togglePlay,
    toggleMute: () => setMuted(v => !v), sample, prepare}), [src,title,playing,muted,error,loadFile,togglePlay,sample,prepare]);

  // Con la pista de fondo el <audio> empieza vacio: solo lo usa un archivo
  // que suba el visitante.
  return <MusicContext.Provider value={api}>
    <audio ref={audio} src={srcAudio || undefined} crossOrigin="anonymous" preload="none" loop
      onPlay={() => sonando(true)} onPause={() => sonando(false)}
      onError={() => { if (modo.current === "archivo") { setError(true); sonando(false); } }} />
    {children}
  </MusicContext.Provider>;
}

export const useMusic = () => useContext(MusicContext);
