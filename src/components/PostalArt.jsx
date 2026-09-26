// Postales de viaje del pie: mismos colores que las laminas del Stack
// (StackArt.jsx), pero con cielo propio, matasellos y cada una con su lugar.
// Las piezas `art-*` se animan una vez al entrar en pantalla (Footer.jsx).
const paper = "var(--paper)", red = "var(--accent-c)", orange = "var(--accent-a)", ink = "var(--ink)";
const ember = "var(--ember)", deep = "var(--ember-deep)", flame = "var(--accent-b)";

const HOJA_ARCE = "M0 -30 L6 -18 L13 -21 L10 -6 L22 -12 L19 -4 L28 0 L14 10 L16 16 L2 13 L2 28 L-2 28 L-2 13 L-16 16 L-14 10 L-28 0 L-19 -4 L-22 -12 L-10 -6 L-13 -21 L-6 -18Z";

// Cielo de noche que se calienta hacia el horizonte.
function Cielo({ id, horizonte, abajo = ember }) {
  return <>
    <defs>
      <linearGradient id={`cielo-${id}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: "var(--ink)" }} />
        <stop offset=".55" style={{ stopColor: "var(--ember-deep)" }} />
        <stop offset="1" style={{ stopColor: abajo }} />
      </linearGradient>
    </defs>
    <rect width="300" height={horizonte} fill={`url(#cielo-${id})`} stroke="none" />
    <rect y={horizonte} width="300" height={300 - horizonte} fill={ink} stroke="none" />
    {Array.from({ length: 40 }, (_, i) => {
      const y = (i * 47 + 19) % 300;
      return y < horizonte - 40 && <circle key={i} cx={(i * 73 + 13) % 300} cy={y} r={i % 4 === 0 ? 1.4 : .6} fill={paper} stroke="none" opacity={i % 3 ? .45 : .8} />;
    })}
  </>;
}

// Matasellos de la esquina: doble anillo con el codigo y las ondas.
function Matasellos({ codigo }) {
  return <g opacity=".6" stroke={paper}>
    <path d="M150 38 q8 -5 16 0 t16 0 t16 0 t12 0 M150 50 q8 -5 16 0 t16 0 t16 0 t12 0 M150 62 q8 -5 16 0 t16 0 t16 0 t12 0" strokeWidth="1.5" />
    <circle cx="248" cy="50" r="27" fill={ink} fillOpacity=".55" strokeWidth="1.8" />
    <circle cx="248" cy="50" r="21" strokeWidth="1" strokeDasharray="2 3" />
    <text x="248" y="55" textAnchor="middle" fill={paper} stroke="none" fontFamily="var(--font)" fontSize="14" fontWeight="800" letterSpacing="1">{codigo}</text>
  </g>;
}

function Pino({ x, base, h }) {
  const w = h * 0.3;
  return <path d={`M${x} ${base - h} L${x - w * .55} ${base - h * .55} H${x - w * .3} L${x - w} ${base - h * .12} H${x - w * .45} L${x - w * 1.2} ${base} H${x + w * 1.2} L${x + w * .45} ${base - h * .12} H${x + w} L${x + w * .3} ${base - h * .55} H${x + w * .55}Z`}
    fill={ink} stroke={orange} strokeWidth="1.2" />;
}

function Palmera({ tronco, x, y, s = 1 }) {
  return <>
    <path d={tronco} stroke={ink} strokeWidth={9 * s} />
    <path d={tronco} stroke={paper} strokeWidth={5 * s} strokeDasharray={`${2 * s} ${5 * s}`} strokeLinecap="butt" />
    <g transform={`translate(${x} ${y}) scale(${s})`} fill={ink} stroke={paper} strokeWidth="2">
      <path d="M0 0 Q-24 -16 -46 4 Q-26 -6 0 0Z M0 0 Q-16 -30 -42 -24 Q-18 -20 0 0Z M0 0 Q4 -34 30 -36 Q10 -26 0 0Z M0 0 Q28 -16 46 6 Q24 -6 0 0Z M0 0 Q-4 -22 -12 -40 Q2 -24 0 0Z" />
      <circle cx="-2" cy="4" r="3" fill={orange} stroke="none" /><circle cx="3" cy="5" r="3" fill={orange} stroke="none" />
    </g>
  </>;
}

function Lugar({ lugar }) {
  switch (lugar) {
    case "canada": {
      const onda = (x) => 92 + 18 * Math.sin(x / 38);
      return <>
        <Cielo id="canada" horizonte={222} abajo={red} />
        {/* Aurora: una cinta y las cortinas que cuelgan de ella. */}
        <path className="art-pulse" d="M-10 96 Q60 50 130 92 T300 74" stroke={orange} strokeWidth="14" strokeOpacity=".35" />
        {Array.from({ length: 24 }, (_, i) => {
          const x = 8 + i * 12;
          return <path key={x} className="art-pulse" style={{ "--delay": `${(i % 6) * .15}s` }} d={`M${x} ${onda(x) - 6} v${34 + (i % 3) * 10}`} stroke={i % 2 ? orange : flame} strokeWidth="3" strokeOpacity=".3" />;
        })}
        <path d="M-10 122 Q80 84 160 114 T310 102" stroke={red} strokeWidth="6" opacity=".4" />
        <path d="M0 222 V178 L40 150 L68 168 L112 128 L150 160 L196 112 L236 150 L262 138 L300 164 V222Z" fill={ember} stroke="none" />
        <path d="M0 222 V196 L58 132 L96 176 L150 108 L204 176 L240 156 L300 196 V222Z" fill={red} stroke="none" />
        <path d="M150 108 L131 130 L141 127 L150 136 L159 125 L169 129Z M58 132 L45 147 L54 144 L60 151 L67 142 L73 146Z" fill={paper} stroke="none" />
        <path d="M150 108 L169 129 L159 125 L204 176 Z" fill={ember} stroke="none" opacity=".35" />
        {/* El lago devuelve la cordillera, apagada. */}
        <path d="M0 222 V248 L58 312 L96 268 L150 336 L204 268 L240 288 L300 248 V222Z" fill={red} stroke="none" opacity=".18" />
        {[234, 246, 258, 272, 286].map((y, i) => <path key={y} d={`M${30 + i * 20} ${y} H${270 - i * 26}`} stroke={paper} strokeOpacity={.3 - i * .04} strokeWidth="1.5" />)}
        <path d="M122 262 Q150 274 178 262 Q150 268 122 262Z" fill={orange} stroke="none" />
        <path d="M150 262 v-10 M146 256 l10 10" stroke={paper} strokeWidth="2" /><circle cx="150" cy="249" r="2.5" fill={paper} stroke="none" />
        {[[16, 50], [36, 38], [52, 28], [238, 30], [256, 44], [278, 54]].map(([x, h]) => <Pino key={x} x={x} base={224} h={h} />)}
        <path d={HOJA_ARCE} transform="translate(44 48) scale(.8)" fill={orange} stroke={ink} strokeWidth="1.5" />
        <Matasellos codigo="CA" />
      </>;
    }
    case "miami": return <>
      <Cielo id="miami" horizonte={214} abajo={red} />
      <defs>
        <linearGradient id="sol-miami" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--accent-a)" }} />
          <stop offset="1" style={{ stopColor: "var(--accent-b)" }} />
        </linearGradient>
      </defs>
      <circle cx="150" cy="168" r="80" fill={orange} opacity=".12" stroke="none" />
      <circle cx="150" cy="168" r="66" fill="url(#sol-miami)" stroke="none" />
      {[[168, 3], [181, 5], [194, 7], [206, 9]].map(([y, h]) => <rect key={y} x="70" y={y} width="160" height={h} fill={red} stroke="none" />)}
      {/* Ocean Drive: torres y un hotel art deco con su letrero. */}
      <path d="M92 214 V188 H104 V176 H114 V194 H124 V160 H132 V150 H140 V160 H146 V200 H158 V182 H170 V170 H180 V182 H190 V196 H204 V214Z" fill={ink} stroke="none" />
      {[[127, 168], [135, 168], [127, 178], [135, 186], [173, 188], [161, 204], [107, 184], [95, 198]].map(([x, y], i) =>
        <rect key={i} className="art-pulse" style={{ "--delay": `${i * .18}s` }} x={x} y={y} width="3" height="4" fill={orange} stroke="none" />)}
      <path className="art-draw" pathLength="1" d="M160 188 H188" stroke={orange} strokeWidth="2" />
      <rect y="214" width="300" height="86" fill={deep} stroke="none" />
      <path d="M0 214 H300" stroke={orange} strokeWidth="1.5" opacity=".7" />
      {[224, 236, 249, 263, 278].map((y, i) => <path key={y} className="art-pulse" style={{ "--delay": `${i * .2}s` }}
        d={`M${120 - i * 14} ${y} H${180 + i * 14}`} stroke={orange} strokeOpacity={.8 - i * .14} strokeWidth="3" strokeDasharray={`${18 + i * 6} 7`} />)}
      <path d="M0 286 Q40 276 80 286 T160 286 T240 286 T320 286 V300 H0Z" fill={ink} stroke="none" />
      <Palmera tronco="M58 300 Q46 232 70 156" x={70} y={156} />
      {/* Flamenco en el agua. */}
      <g className="art-task" fill={orange} stroke={orange}>
        <ellipse cx="226" cy="246" rx="15" ry="8" stroke="none" />
        <path d="M212 244 L204 238 L214 247Z" stroke="none" />
        <path d="M237 242 Q248 230 240 220 Q234 212 242 206" fill="none" strokeWidth="3.5" />
        <circle cx="243" cy="206" r="3.5" stroke="none" />
        <path d="M246 206 L252 212 L247 210Z" fill={ink} stroke={ink} strokeWidth="1" />
        <path d="M226 253 V276 M230 253 L236 264 L228 266" fill="none" strokeWidth="1.6" />
      </g>
      <Palmera tronco="M276 300 Q284 250 264 198" x={264} y={198} s={0.75} />
      <Matasellos codigo="MIA" />
    </>;
    case "florida": return <>
      <Cielo id="florida" horizonte={250} abajo={red} />
      <path d="M52 40 A22 22 0 1 0 74 72 A17 17 0 1 1 52 40Z" fill={paper} stroke="none" opacity=".9" />
      {/* Trayectoria de otras misiones, punteada hacia la orbita. */}
      <path className="art-flow" d="M140 60 Q170 -20 300 20" stroke={orange} strokeWidth="1.5" opacity=".6" strokeDasharray="4 6" />
      <path d="M0 250 H300" stroke={orange} strokeWidth="1.5" opacity=".6" />
      {/* Torre de lanzamiento con brazo de acceso. */}
      <path d="M186 250 V88 H206 V250 M186 88 L206 116 L186 144 L206 172 L186 200 L206 228 M206 88 L186 116 L206 144 L186 172 L206 200 L186 228" stroke={orange} strokeWidth="2.2" />
      <path d="M184 88 H208 M196 88 V76" stroke={orange} strokeWidth="2.2" /><circle className="art-pulse" cx="196" cy="74" r="3" fill={red} stroke="none" />
      <path d="M186 124 H156 M186 170 H156" stroke={orange} strokeWidth="3" />
      {/* El cohete. */}
      <path d="M140 52 Q156 72 156 100 V200 H124 V100 Q124 72 140 52Z" fill={paper} stroke={ink} strokeWidth="1.5" />
      <path d="M140 52 Q151 64 154 84 H126 Q129 64 140 52Z" fill={red} stroke="none" />
      <path d="M146 100 V196" stroke={ink} strokeOpacity=".18" strokeWidth="6" />
      <circle cx="140" cy="108" r="6" fill={ink} stroke={orange} strokeWidth="2" />
      <path d="M124 136 H156 M124 144 H156" stroke={ink} strokeWidth="3" />
      <path d="M124 170 L104 206 H124Z M156 170 L176 206 H156Z" fill={red} stroke={ink} strokeWidth="1.5" />
      <path d="M134 176 V206 H146 V176Z" fill={ember} stroke="none" />
      <g className="art-pulse">
        <path d="M126 202 Q140 290 154 202Z" fill={orange} stroke="none" />
        <path d="M132 202 Q140 250 148 202Z" fill={paper} stroke="none" />
      </g>
      {/* Nubes de la ignicion, con sombra. */}
      {[[62, 262, 20], [86, 252, 26], [112, 244, 26], [168, 244, 26], [194, 252, 26], [220, 262, 20], [240, 272, 16], [40, 274, 16], [140, 256, 24]].map(([x, y, r]) =>
        <g key={x}><circle cx={x} cy={y} r={r} fill={paper} stroke="none" /><path d={`M${x - r * .7} ${y + r * .45} Q${x} ${y + r * .95} ${x + r * .7} ${y + r * .45}`} stroke={ink} strokeOpacity=".25" strokeWidth="2" /></g>)}
      <rect y="280" width="300" height="20" fill={ink} stroke="none" />
      <Matasellos codigo="KSC" />
    </>;
    case "china": {
      const cresta = [[0, 204], [40, 182], [80, 198], [122, 160], [162, 178], [204, 140], [244, 162], [300, 132]];
      const linea = cresta.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
      return <>
        <Cielo id="china" horizonte={236} abajo={red} />
        <circle cx="160" cy="86" r="40" fill={orange} opacity=".14" stroke="none" />
        <circle cx="160" cy="86" r="28" fill={paper} stroke="none" />
        {[[150, 78, 6], [170, 96, 4], [166, 74, 3], [152, 98, 3]].map(([x, y, r]) => <circle key={x + y} cx={x} cy={y} r={r} fill={ember} fillOpacity=".16" stroke="none" />)}
        {/* Picos lejanos entre la niebla. */}
        <path d="M0 176 L28 120 L52 150 L84 104 L118 150 L150 128 L188 166 L226 112 L262 146 L300 118 V240 H0Z" fill={ember} stroke="none" />
        <ellipse className="art-pulse" cx="110" cy="170" rx="110" ry="9" fill={paper} stroke="none" fillOpacity=".16" />
        {/* La Gran Muralla sobre la cresta, con almenas y torres. */}
        <path d={`${linea} V300 H0Z`} fill={red} stroke="none" />
        {[22, 46, 72].map((dy, i) => <path key={dy} d={linea} transform={`translate(0 ${dy})`} stroke={ember} strokeOpacity={.4 - i * .1} strokeWidth="2" />)}
        <path d={linea} stroke={orange} strokeWidth="8" strokeLinejoin="miter" />
        <path d={linea} transform="translate(0 -6)" stroke={orange} strokeWidth="4" strokeDasharray="3 3" strokeLinecap="butt" />
        {[cresta[1], cresta[3], cresta[5]].map(([x, y]) => <g key={x}>
          <path d={`M${x - 8} ${y + 2} V${y - 18} h3 v-4 h4 v4 h2 v-4 h4 v4 h3 V${y + 2}Z`} fill={orange} stroke="none" />
          <path d={`M${x - 2} ${y - 4} v-6 a2 2 0 0 1 4 0 v6Z`} fill={ink} stroke="none" />
        </g>)}
        <path d="M0 262 Q80 232 160 256 T300 244 V300 H0Z" fill={ink} stroke="none" />
        <path d="M0 262 Q80 232 160 256 T300 244" stroke={orange} strokeWidth="2" />
        {/* Pagoda en la loma de delante. */}
        <g fill={ink} stroke={orange} strokeWidth="1.5">
          {[0, 1, 2].map((k) => {
            const y = 252 - k * 17, w = 22 - k * 5;
            return <g key={k}>
              <rect x={234 - w + 5} y={y - 11} width={(w - 5) * 2} height="11" />
              <path d={`M${234 - w - 5} ${y - 9} L${234 - w + 3} ${y - 16} H${234 + w - 3} L${234 + w + 5} ${y - 9}Z`} />
            </g>;
          })}
          <path d="M234 201 V190" /><circle cx="234" cy="188" r="2" fill={orange} stroke="none" />
          <rect className="art-pulse" x="231" y="244" width="6" height="8" fill={orange} stroke="none" />
        </g>
        {/* Faroles rojos colgando. */}
        {[[40, 58, 0], [84, 38, 1]].map(([x, y, i]) => <g key={x} className="art-task" style={{ "--delay": `${i * .4}s` }}>
          <path d={`M${x} 0 V${y - 14}`} stroke={paper} strokeWidth="1.2" opacity=".7" />
          <rect x={x - 6} y={y - 16} width="12" height="4" fill={orange} stroke="none" />
          <ellipse cx={x} cy={y} rx="16" ry="13" fill={red} stroke="none" />
          <path d={`M${x} ${y - 13} V${y + 13} M${x - 8} ${y - 11} Q${x - 13} ${y} ${x - 8} ${y + 11} M${x + 8} ${y - 11} Q${x + 13} ${y} ${x + 8} ${y + 11}`} stroke={orange} strokeWidth="1.2" />
          <rect x={x - 6} y={y + 12} width="12" height="4" fill={orange} stroke="none" />
          <path d={`M${x} ${y + 16} v12 M${x - 3} ${y + 18} v8 M${x + 3} ${y + 18} v8`} stroke={orange} strokeWidth="1.2" />
        </g>)}
        <Matasellos codigo="CN" />
      </>;
    }
    // La postal en blanco del final: un hueco con silueta punteada para quien
    // mira, centrado.
    case "tu": return <>
      <Cielo id="tu" horizonte={300} abajo={deep} />
      <rect x="65" y="84" width="170" height="190" rx="10" fill={ink} fillOpacity=".45" stroke={paper} strokeOpacity=".7" strokeWidth="2" strokeDasharray="7 6" />
      <g stroke={orange} strokeWidth="2.5" strokeDasharray="6 5">
        <circle cx="150" cy="152" r="34" />
        <path d="M90 274 V258 Q90 204 150 204 Q210 204 210 258 V274" />
      </g>
      <text className="art-pulse" x="150" y="166" textAnchor="middle" fill={orange} stroke="none" fontFamily="var(--font)" fontSize="44" fontWeight="800">?</text>
      {[[81, 100], [221, 120], [213, 250]].map(([x, y], i) =>
        <path key={x} className="art-pulse" style={{ "--delay": `${i * .3}s` }} d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2}Z`} fill={paper} stroke="none" />)}
      <Matasellos codigo="???" />
    </>;
    default: return null;
  }
}

export default function PostalArt({ lugar }) {
  return <svg className="poster__vector" viewBox="0 0 300 300" fill="none" stroke={paper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <Lugar lugar={lugar} />
  </svg>;
}
