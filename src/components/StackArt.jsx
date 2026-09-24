// Colores compartidos con el agujero negro y los paneles del sitio.
const paper = "var(--paper)", ember = "var(--accent-c)", orange = "var(--accent-a)", ink = "var(--ink)";

function Gear({ x = 150, y = 145, r = 42 }) {
  return <g transform={`translate(${x} ${y})`}><g className="art-spin">
    {Array.from({ length: 8 }, (_, i) => <rect key={i} x="-9" y={-r - 9} width="18" height="20" fill={paper} stroke="none" transform={`rotate(${i * 45})`} />)}
    <circle r={r} fill={paper} /><circle r={r * .4} fill={ink} stroke={ember} strokeWidth="7" />
  </g></g>;
}

function Subject({ area }) {
  switch (area) {
    case "dev": return <>
      <rect x="48" y="62" width="204" height="150" rx="9" fill={orange} />
      <rect x="57" y="72" width="186" height="130" rx="3" fill={ink} />
      <path d="M115 99 L94 118 L115 137 M185 99 L206 118 L185 137 M162 94 L143 143" strokeWidth="7" />
      {[0, 1, 2].map(i => <path key={i} className="art-draw" style={{ "--delay": `${i * .2}s` }} pathLength="1" d={`M78 ${161 + i * 12} h${112 - i * 22}`} stroke={i === 1 ? ember : orange} strokeWidth="5" />)}
      <path d="M48 212 L27 235 Q150 251 273 235 L252 212Z" fill={paper} /><path d="M121 224 H179" stroke={ink} />
      <path d="M64 85 H235 M70 96 V190" stroke={paper} strokeOpacity=".25" strokeWidth="1" />
      {[75,84,93].map(x => <circle key={x} cx={x} cy="79" r="2" fill={ember} stroke="none" />)}
      {/* Clawd pixelado, sin el marco de la segunda pantalla. */}
      <g transform="translate(201 170)">
        <g className="art-task" stroke="none" shapeRendering="crispEdges">
          <path d="M10 6 H54 V12 H60 V18 H66 V34 H58 V28 H54 V42 H48 V54 H40 V42 H24 V54 H16 V42 H10 V28 H6 V34 H-2 V18 H4 V12 H10Z" fill={orange} />
          <path d="M10 36 H54 V42 H48 V48 H40 V42 H24 V48 H16 V42 H10Z" fill={ember} />
          <path d="M18 18 H24 V29 H18Z M40 18 H46 V29 H40Z" fill={ink} />
        </g>
      </g>
      <path d="M41 46 H89 M41 41 V51 M89 41 V51" stroke={orange} strokeWidth="1" />
    </>;
    case "ia": return <>
      <path d="M145 65 C113 41 79 62 82 88 C50 96 53 125 64 139 C40 166 63 199 84 199 C85 230 117 242 145 225Z" fill={ember} />
      <path d="M155 65 C187 41 221 62 218 88 C250 96 247 125 236 139 C260 166 237 199 216 199 C215 230 183 242 155 225Z" fill={orange} />
      <path d="M103 88 Q130 82 126 111 Q92 104 87 132 M75 157 Q115 137 129 162 L124 207 M96 182 Q76 209 112 221" />
      {[90, 123, 156, 189].map((y, i) => <g key={y} strokeWidth="1.8"><path d={`M169 ${y + 16} H${181 + i * 3} V${y} H201`} /><circle className="art-pulse" style={{ "--delay": `${i * .3}s` }} cx="201" cy={y} r="5" fill={paper} stroke="none" /></g>)}
      <path d="M92 109 Q107 122 99 142 M108 64 Q97 79 111 91 M73 177 Q93 163 104 177 M117 189 Q140 193 135 217" stroke={ink} strokeOpacity=".55" />
      <path className="art-flow" d="M150 234 V253 M150 253 H98 M150 253 H202" stroke={orange} />
      {[98,150,202].map((x,i) => <g key={x}><rect x={x-12} y="251" width="24" height="17" rx="3" fill={ink} stroke={orange} /><circle className="art-pulse" style={{"--delay":`${i*.25}s`}} cx={x} cy="259" r="3" fill={orange} /></g>)}
    </>;
    case "integra": return <>
      <path className="art-flow" d="M150 60 V99 M109 145 H60 V208 M191 145 H240 V208 M150 189 V220" stroke={orange} strokeWidth="5" />
      <Gear />
      {[[125, 30], [35, 211], [125, 220], [215, 211]].map(([x,y],i) => <rect key={i} x={x} y={y} width="50" height="35" rx="7" fill={i % 2 ? orange : ember} />)}
      <path d="M140 40 L134 47 L140 54 M160 40 L166 47 L160 54 M153 39 L147 56" stroke={ink} />
      <path d="M48 236 H72 Q80 224 70 224 Q67 214 59 221 Q48 218 47 227 Q41 229 48 236Z" fill={ink} stroke="none" />
      <ellipse cx="150" cy="230" rx="12" ry="4" fill={ink} stroke={ink} /><path d="M138 230 V243 Q150 251 162 243 V230 M139 237 Q150 243 161 237" stroke={ink} />
      <path d="M228 236 L242 222 L253 236 M228 236 H253" stroke={ink} /><circle cx="242" cy="222" r="3" fill={ink} />
      <path d="M65 107 V80 H111 M189 80 H238 V107" stroke={paper} strokeOpacity=".3" />
    </>;
    case "industrial": return <>
      <rect x="35" y="220" width="230" height="30" rx="14" fill={orange} />
      {[55, 90, 125, 160, 195, 230].map(x => <circle key={x} cx={x} cy="235" r="7" fill={ink} />)}
      <path d="M70 216 V165 L112 156 L127 216Z" fill={ember} />
      <rect x="34" y="122" width="34" height="83" rx="3" fill={ink} stroke={orange} />
      <rect x="41" y="130" width="20" height="19" rx="2" fill={orange} />
      {[161,172,183].map(y => <path key={y} d={`M41 ${y} H60`} strokeWidth="2" />)}
      <path d="M132 260 H260 M152 254 L146 265 M174 254 L168 265 M196 254 L190 265 M218 254 L212 265" stroke={orange} strokeWidth="1" />
      <g className="art-arm" style={{ transformOrigin: "92px 169px" }}>
        <path d="M78 164 L104 81 L127 91 L107 174Z" fill={ember} />
        <path d="M110 75 L215 97 L210 119 L109 101Z" fill={paper} />
        <circle cx="115" cy="87" r="15" fill={orange} /><circle cx="93" cy="169" r="14" fill={orange} />
        <circle cx="115" cy="87" r="7" fill={ink} /><circle cx="93" cy="169" r="6" fill={ink} />
        <path d="M104 98 L86 148 M130 87 L196 103" stroke={ink} strokeWidth="4" />
        <path d="M105 71 Q79 69 72 95 L60 161" stroke={orange} strokeWidth="3" />
        <path d="M212 117 V138 M212 138 L194 151 V172 M212 138 L230 151 V172" strokeWidth="7" />
        <rect x="201" y="168" width="23" height="23" fill={paper} />
      </g>
    </>;
    case "electronica": return <>
      {/* Cuatro laminas separadas: señales exteriores y planos interiores. */}
      {[3,2,1,0].map(layer => <g key={layer}>
        <path d={`M38 ${100+layer*39} L150 ${151+layer*39} L262 ${100+layer*39} V${106+layer*39} L150 ${157+layer*39} L38 ${106+layer*39}Z`} fill="var(--ember)" stroke={orange} strokeWidth="1" />
        <g transform={`matrix(.7 .32 -.7 .32 150 ${100+layer*39})`} strokeWidth="2">
          <rect x="-80" y="-80" width="160" height="160" rx="4" fill={layer%2 ? "var(--ember-deep)" : "var(--ink-3)"} stroke={orange} />
          {layer===1 || layer===2
            ? <>
              <path d="M-62 -62 H62 V62 H-62Z M-48 -48 V48 H48 V-48Z" fill={layer===1 ? orange : ember} fillOpacity=".35" stroke={orange} />
              <path d="M-61 -24 H-31 V26 H-61 M61 24 H30 V-28 H61" stroke={paper} strokeOpacity=".5" />
            </>
            : <g className="art-pulse" style={{"--delay": `${layer*.2}s`}} stroke={orange}>
              <path d="M-22 -15 H-46 V-57 H-65 M-22 0 H-62 M-22 16 H-41 V58 H-62 M22 -16 H42 V-59 H64 M22 0 H61 M22 15 H45 V56 H65 M-12 -22 V-64 M12 22 V62" fill="none" strokeWidth="3" />
              {[[-65,-57],[-62,0],[-62,58],[64,-59],[61,0],[65,56]].map(([x,y]) => <circle key={`${x}:${y}`} cx={x} cy={y} r="4" fill={ink} />)}
            </g>}
          {[[-66,-66],[66,-66],[-66,66],[66,66]].map(([x,y]) => <g key={`${x}:${y}`}><circle cx={x} cy={y} r="6" fill={paper} stroke="none" /><circle cx={x} cy={y} r="3" fill={ink} stroke="none" /></g>)}
        </g>
      </g>)}
      {/* Guias de las vias pasantes, visibles entre las capas. */}
      {[57.6,242.4].map(x => <path key={x} d={`M${x} 100 V217`} stroke={paper} strokeOpacity=".6" strokeDasharray="3 5" strokeWidth="1" />)}
      <path d="M150 82 V94 M150 143 V260" stroke={paper} strokeOpacity=".45" strokeDasharray="3 5" strokeWidth="1" />
      <g transform="matrix(.7 .32 -.7 .32 150 93)">
        {[-21,-7,7,21].map(v => <path key={v} d={`M-39 ${v} H-28 M28 ${v} H39 M${v} -39 V-28 M${v} 28 V39`} stroke={paper} strokeWidth="5" />)}
        <rect x="-29" y="-29" width="58" height="58" rx="3" fill={ink} stroke={paper} strokeWidth="3" />
        <rect x="-19" y="-19" width="38" height="38" fill="var(--ember-deep)" stroke={orange} />
        <path className="art-draw" pathLength="1" d="M-11 8 V-7 H0 V8 H11 V-7" stroke={orange} strokeWidth="3" />
      </g>
    </>;
    case "tresd": return <g className="art-cube">
      <path d="M150 58 L232 105 L150 152 L68 105Z" fill={orange} />
      <path d="M68 105 L150 152 V246 L68 199Z" fill="var(--ember-deep)" />
      <path d="M150 152 L232 105 V199 L150 246Z" fill={ember} />
      {[.25, .5, .75].map(t => <g key={t} stroke={paper} strokeWidth="1" strokeOpacity=".5">
        <path d={`M${150+82*t} ${58+47*t} L${68+82*t} ${105+47*t} M${150-82*t} ${58+47*t} L${232-82*t} ${105+47*t}`} />
        <path d={`M${68+82*t} ${105+47*t} V${199+47*t} M68 ${105+94*t} L150 ${152+94*t}`} />
        <path d={`M${150+82*t} ${152-47*t} V${246-47*t} M150 ${152+94*t} L232 ${105+94*t}`} />
      </g>)}
    </g>;
    case "diseno": return <>
      {/* Mesa de trabajo: curva editable, pluma y linea de tiempo de video. */}
      <rect x="39" y="56" width="218" height="178" rx="10" fill={ink} />
      <path d="M39 84 H257" stroke={orange} />
      {[54, 65, 76].map((x) => <circle key={x} cx={x} cy="70" r="2.5" fill={orange} stroke="none" />)}
      <path d="M54 101 H185 V190 H54Z" stroke={paper} strokeOpacity=".25" strokeDasharray="3 5" />
      <path d="M68 171 L86 113 M172 116 L155 175" stroke={paper} strokeOpacity=".5" />
      <path className="art-draw" pathLength="1" d="M68 171 C86 113 155 175 172 116" stroke={orange} strokeWidth="5" />
      {[[68,171],[172,116]].map(([x,y]) => <rect key={x} x={x-4} y={y-4} width="8" height="8" fill={ink} stroke={orange} />)}
      {[[86,113],[155,175]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="3" fill={paper} />)}
      <g className="art-pen">
        <path d="M220 93 L245 147 L220 180 L195 147Z" fill={orange} />
        <path d="M220 94 V144" stroke={ink} strokeWidth="3" />
        <circle cx="220" cy="146" r="6" fill={ink} stroke="none" />
        <path d="M206 184 H234 V195 H206Z" fill={ember} />
      </g>
      <path d="M40 204 H256" stroke={paper} strokeOpacity=".4" />
      <path d="M55 213 L55 225 L65 219Z" fill={paper} stroke="none" />
      <rect x="78" y="214" width="56" height="10" rx="2" fill={ember} stroke="none" />
      <rect x="138" y="214" width="44" height="10" rx="2" fill={orange} stroke="none" />
      <rect x="186" y="214" width="54" height="10" rx="2" fill={paper} stroke="none" />
      <g className="art-playhead"><path d="M90 209 V230" stroke={paper} /><path d="M86 208 H94 L90 212Z" fill={paper} stroke="none" /></g>
      {[paper, orange, ember].map((color,i) => <rect key={color} x={101+i*35} y="249" width="24" height="12" rx="3" fill={color} stroke="none" />)}
    </>;
    case "cad": return <>
      <path d="M49 56 H251 M49 48 V66 M251 48 V66 M40 75 V229 M32 75 H48 M32 229 H48" stroke={orange} />
      <path d="M76 158 V179 Q150 240 224 179 V158" fill="var(--ember)" />
      <ellipse cx="150" cy="158" rx="74" ry="35" fill={ink} stroke={orange} />
      <ellipse cx="150" cy="158" rx="27" ry="13" fill="var(--ember-deep)" />
      <g className="art-task">
        <path d="M115 109 V141 Q150 162 185 141 V109" fill={paper} />
        <ellipse cx="150" cy="109" rx="35" ry="17" fill={orange} /><ellipse cx="150" cy="109" rx="17" ry="8" fill={ink} />
      </g>
      {[[93,153],[207,153],[150,184]].map(([x,y]) => <g key={x}><ellipse cx={x} cy={y} rx="7" ry="4" fill={ink} /><path d={`M${x} ${y-24} v-26`} stroke={orange} strokeWidth="5" /><path d={`M${x-6} ${y-50} h12`} strokeWidth="4" /></g>)}
      <path d="M150 73 V226 M65 159 H239" stroke={ember} strokeDasharray="5 6" strokeWidth="1" />
      <path d="M66 253 H247 V271 H66Z" fill={paper} />{[85,105,125,145,165,185,205,225].map(x => <path key={x} d={`M${x} 253 V262`} stroke={ink} />)}
    </>;
    case "datos": return <>
      {[86,125,164,203].map(y => <path key={y} d={`M49 ${y} H260`} stroke={paper} strokeOpacity=".13" strokeWidth="1" />)}
      <path d="M48 54 V244 H261" />
      {[65, 102, 139, 176, 213].map((x,i) => <rect key={x} className="art-bar" style={{ "--delay": `${i * .12}s` }} x={x} y={205-i*26} width="25" height={38+i*26} fill={i%2 ? paper : ember} stroke="none" />)}
      <path className="art-draw" pathLength="1" d="M70 174 L110 135 L150 149 L190 87 L246 56" stroke={orange} strokeWidth="6" />
      {[[70,174],[110,135],[150,149],[190,87],[246,56]].map(([x,y]) => <circle key={x} cx={x} cy={y} r="4" fill={ink} stroke={orange} />)}
      <g transform="translate(74 82)"><circle r="24" stroke="var(--ember)" strokeWidth="9" /><path className="art-draw" pathLength="1" d="M0 -24 A24 24 0 0 1 24 0" stroke={orange} strokeWidth="9" /><circle r="3" fill={paper} /></g>
      <path d="M65 262 H101 M112 262 H148 M159 262 H195" stroke={orange} strokeWidth="3" />
    </>;
    default: return <>
      <rect x="40" y="65" width="220" height="165" rx="8" fill={ink} />
      {[54, 124, 194].map((x,i) => <g key={x}><rect x={x} y="80" width="52" height="15" rx="3" fill={i===1 ? ember : orange} />{[110,163].map((y,j) => <g key={y} className="art-task" style={{ "--delay": `${(i+j)*.2}s` }}><rect x={x} y={y} width="52" height="42" rx="3" fill={paper} /><path d={`M${x+10} ${y+22} l8 8 l22 -20`} stroke={orange} strokeWidth="4" /></g>)}</g>)}
      <path className="art-flow" d="M48 254 H251" stroke={ember} strokeWidth="4" />
      {[63,119,185,240].map((x,i) => <g key={x}><circle cx={x} cy="254" r="6" fill={i===3 ? orange : ink} stroke={orange} /><path d={`M${x} 263 v7`} strokeWidth="1" /></g>)}
      <path d="M56 47 H144 M56 40 V54 M144 40 V54" stroke={orange} strokeWidth="1" />
    </>;
  }
}

export default function StackArt({ area }) {
  return <svg className="poster__vector" viewBox="0 0 300 300" fill="none" stroke={paper} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="300" height="300" fill={ink} stroke="none" />
    <circle cx="255" cy="28" r="69" fill={ember} opacity=".25" stroke="none" />
    <ellipse cx="150" cy="156" rx="143" ry="92" transform="rotate(-35 150 156)" stroke={orange} opacity=".4" />
    {Array.from({length: 54}, (_,i) => <circle key={i} cx={(i * 73 + 13) % 300} cy={(i * 47 + 19) % 300} r={i%4===0 ? 1.4 : .6} fill={paper} stroke="none" opacity=".6" />)}
    <Subject area={area} />
  </svg>;
}
