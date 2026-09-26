import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { music } from "../data/content";
import { audioBands } from "./audioAnalysis";
import { asset } from "./asset";

const MusicContext = createContext(null);
const SILENCE = { bass: 0, mid: 0, treble: 0 };

export function MusicProvider({ children, active }) {
  const audio = useRef(null);
  const graph = useRef(null);
  const objectUrl = useRef(null);
  const [src, setSrc] = useState(asset(music.src));
  const [title, setTitle] = useState(music.title);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState(false);
  const [muted, setMuted] = useState(() => {
    try { return localStorage.getItem("portfolio-muted") === "true"; } catch { return false; }
  });
  const mutedRef = useRef(muted);
  const requestId = useRef(0);
  const playbackIntent = useRef(Boolean(music.src));

  const ensureGraph = useCallback(async () => {
    if (!graph.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error("Audio analysis unavailable");
      const context = new AudioContext();
      const source = context.createMediaElementSource(audio.current);
      const analyser = context.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.72;
      const gain = context.createGain();
      gain.gain.value = mutedRef.current ? 0 : 0.55;
      // Analizar antes del volumen permite silenciar sin perder la reacción visual.
      source.connect(analyser); analyser.connect(gain); gain.connect(context.destination);
      graph.current = { context, source, analyser, gain, bins: new Uint8Array(analyser.frequencyBinCount) };
    }
    await graph.current.context.resume();
  }, []);

  const play = useCallback(async () => {
    const id = ++requestId.current;
    setError(false);
    try {
      await ensureGraph();
      if (id !== requestId.current) return;
      await audio.current.play();
    } catch {
      if (id === requestId.current) { setError(true); setPlaying(false); }
    }
  }, [ensureGraph]);

  // Preparar el contexto con el gesto de elegir idioma, pero sin reproducir
  // todavía. La pista empieza cuando las partículas completan el horizonte.
  const prepare = useCallback(async () => {
    if (!audio.current?.getAttribute("src")) return;
    try { await ensureGraph(); } catch { /* El botón de reproducción permite reintentar. */ }
  },[ensureGraph]);

  useEffect(() => {
    if(active && playbackIntent.current && audio.current?.getAttribute("src")) {
      void play();
    } else if(!active) {
      requestId.current++;
      audio.current?.pause();
    }
  },[active,play]);

  const loadFile = useCallback((file) => {
    if (!file) return;
    if (file.type && !file.type.startsWith("audio/")) { setError(true); return; }
    requestId.current++;
    audio.current.pause();
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = URL.createObjectURL(file);
    audio.current.src = objectUrl.current;
    audio.current.load();
    setSrc(objectUrl.current);
    setTitle(file.name.replace(/\.[^.]+$/, ""));
    playbackIntent.current=true;
    void play();
  }, [play]);

  const togglePlay = useCallback(() => {
    if (audio.current.paused) { playbackIntent.current=true; void play(); }
    else { playbackIntent.current=false; requestId.current++; audio.current.pause(); }
  }, [play]);

  useEffect(() => {
    mutedRef.current = muted;
    const g = graph.current;
    if (g) g.gain.gain.setTargetAtTime(muted ? 0 : 0.55, g.context.currentTime, 0.025);
    try { localStorage.setItem("portfolio-muted", String(muted)); } catch { /* Almacenamiento opcional. */ }
  }, [muted]);

  useEffect(() => () => {
    requestId.current++;
    graph.current?.source.disconnect();
    graph.current?.analyser.disconnect();
    graph.current?.gain.disconnect();
    void graph.current?.context.close();
    graph.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
  }, []);

  // Un solo analisis por fotograma. Lo piden el agujero negro (en su bucle de
  // r3f) y el medidor del reproductor (en el suyo), y cada peticion era una
  // FFT de 1024 bandas: dentro del mismo fotograma se devuelve la ultima.
  const ultimo = useRef({ t: -1, bandas: SILENCE });
  const sample = useCallback(() => {
    const g = graph.current;
    if (!g || audio.current?.paused || g.context.state !== "running") return SILENCE;
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

  return <MusicContext.Provider value={api}>
    <audio ref={audio} src={src || undefined} crossOrigin="anonymous" preload="none" loop
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onError={() => { setError(true); setPlaying(false); }} />
    {children}
  </MusicContext.Provider>;
}

export const useMusic = () => useContext(MusicContext);
