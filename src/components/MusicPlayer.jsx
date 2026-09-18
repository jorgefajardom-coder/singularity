import { useEffect, useRef } from "react";
import { useMusic } from "../lib/music";
import { useLang } from "../lib/i18n";

export default function MusicPlayer({ intro, inline }) {
  const { src, title, playing, muted, error, loadFile, togglePlay, toggleMute, sample } = useMusic();
  const { tr } = useLang();
  const input = useRef(null);
  const meter = useRef(null);
  useEffect(() => {
    let frame;
    const update = () => {
      const bands=sample();
      if(meter.current) meter.current.value=Math.max(bands.bass,bands.mid,bands.treble);
      if(playing) frame=requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  },[playing,sample]);
  return <aside className={`music-player ${inline ? "music-player--inline" : ""}`} data-intro={intro} aria-label={tr({es:"Música",en:"Music"})}>
    <input ref={input} type="file" accept="audio/*" hidden aria-label={tr({es:"Archivo de música",en:"Music file"})}
      onChange={e => { loadFile(e.target.files?.[0]); e.target.value=""; }} />
    <div className="music-player__bar">
      <button type="button" className="music-player__track" onClick={() => input.current.click()}
        title={src ? tr({es:"Cambiar música",en:"Change music"}) : undefined}>
        <span className="music-player__icon" aria-hidden="true">♫</span>
        <span>{src ? title : tr({es:"Añadir música",en:"Add music"})}</span>
      </button>
      {src && <button type="button" onClick={togglePlay} aria-label={tr(playing ? {es:"Pausar música",en:"Pause music"} : {es:"Reproducir música",en:"Play music"})}>
        <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
      </button>}
      <button type="button" onClick={toggleMute} className="music-player__mute" aria-pressed={muted}
        aria-label={tr(muted ? {es:"Activar sonido",en:"Unmute"} : {es:"Silenciar música",en:"Mute music"})}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" />
          {muted ? <path d="m17 9 5 6m0-6-5 6" /> : <path d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" />}
        </svg>
        <span>{tr(muted ? {es:"Sin sonido",en:"Muted"} : {es:"Silenciar",en:"Mute"})}</span>
      </button>
    </div>
    {src && <meter ref={meter} className="music-player__level" min="0" max="1" value="0" aria-label={tr({es:"Nivel de música",en:"Music level"})} />}
    {error && <p className="music-player__error" role="status">{tr({es:"No se pudo reproducir. Prueba otro archivo de audio.",en:"Could not play. Try another audio file."})}</p>}
  </aside>;
}
