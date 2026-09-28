// Rangos en Hz: el tamaño de FFT y la frecuencia de muestreo pueden variar.
export function audioBands(bins, sampleRate, fftSize) {
  const average = (low, high) => {
    const first = Math.max(1, Math.floor(low * fftSize / sampleRate));
    const last = Math.min(bins.length - 1, Math.ceil(high * fftSize / sampleRate));
    if (first > last) return 0;
    let total = 0;
    for (let i = first; i <= last; i++) total += bins[i];
    return total / ((last - first + 1) * 255);
  };
  // `kick`: la banda del bombo, sin el cuerpo del bajo (ver BlackHole.jsx).
  return { bass: average(30, 180), kick: average(40, 110), mid: average(180, 2000), treble: average(2000, 8000) };
}
