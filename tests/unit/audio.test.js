import { describe, expect, it } from "vitest";
import { audioBands } from "../../src/lib/audioAnalysis.js";

describe("bandas de audio", () => {
  const fft = 2048;
  const rate = 48000;
  const bins = (fn) => Uint8Array.from({ length: fft / 2 }, (_, i) => fn(i * rate / fft));

  it("silencio da cero en las tres bandas", () => {
    expect(audioBands(bins(() => 0), rate, fft)).toEqual({ bass: 0, mid: 0, treble: 0 });
  });

  it("todo a tope da uno en las tres", () => {
    const b = audioBands(bins(() => 255), rate, fft);
    expect(b.bass).toBeCloseTo(1);
    expect(b.mid).toBeCloseTo(1);
    expect(b.treble).toBeCloseTo(1);
  });

  it("un grave solo sube los graves", () => {
    const b = audioBands(bins((hz) => (hz >= 30 && hz <= 180 ? 255 : 0)), rate, fft);
    expect(b.bass).toBeGreaterThan(0.6);
    expect(b.mid).toBeLessThan(0.05);
    expect(b.treble).toBe(0);
  });

  it("no depende de la frecuencia de muestreo", () => {
    const a = audioBands(Uint8Array.from({ length: 1024 }, () => 128), 44100, 2048);
    const b = audioBands(Uint8Array.from({ length: 1024 }, () => 128), 48000, 2048);
    expect(a.mid).toBeCloseTo(b.mid, 5);
  });
});
