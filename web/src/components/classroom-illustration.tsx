export function ClassroomIllustration() {
  return (
    <div className="classroom-art" aria-hidden="true">
      <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
      <svg viewBox="0 0 480 350" className="school-drawing" fill="none">
        <circle cx="389" cy="72" r="35" fill="#F6BA5B" />
        <path d="M379 77q10 12 20 0" stroke="#986322" strokeWidth="3" strokeLinecap="round" />
        <circle cx="379" cy="68" r="2.5" fill="#986322" /><circle cx="399" cy="68" r="2.5" fill="#986322" />
        <path d="M67 98c-23 0-24-29-5-35 2-29 41-30 46-6 24-5 34 12 27 27 15 4 14 19-3 19H67Z" fill="#FFFDF8" />
        <path d="M167 80c-12 0-17-17-3-23 0-17 25-22 32-6 12-4 22 5 19 16 10 2 12 14-2 14l-46-1Z" fill="#FFFDF8" opacity=".7" />
        <ellipse cx="239" cy="299" rx="192" ry="23" fill="#A6CFC0" opacity=".45" />
        <path d="M86 190h110v98H86z" fill="#EBAB67" /><path d="m73 190 68-55 65 55H73Z" fill="#C67442" />
        <path d="M284 190h110v98H284z" fill="#EBAB67" /><path d="m274 190 65-55 68 55H274Z" fill="#C67442" />
        <path d="M170 158h140v135H170z" fill="#FFF4D9" /><path d="m153 158 87-68 87 68H153Z" fill="#247C65" />
        <path d="M231 73V42" stroke="#5E6B53" strokeWidth="5" /><path d="M233 43h34l-10 10 10 10h-34V43Z" fill="#F39E4F" />
        <path d="M225 250h30v43h-30z" fill="#237760" /><path d="M229 250c0-16 22-16 22 0" fill="#237760" />
        <circle cx="241" cy="141" r="15" fill="#FFFDF8" /><path d="M241 131v10l6 4" stroke="#277C65" strokeWidth="3" strokeLinecap="round" />
        <rect x="198" y="171" width="86" height="28" rx="5" fill="#E7F0DA" /><path d="M215 183h50M223 189h35" stroke="#34806A" strokeWidth="3" strokeLinecap="round" />
        {[104, 144, 321, 361].map((x) => <g key={x}><rect x={x} y="212" width="21" height="31" rx="3" fill="#FFF4D9" /><path d={`M${x + 10.5} 212v31M${x} 227h21`} stroke="#D39B62" strokeWidth="2" /></g>)}
        {[194, 262].map((x) => <g key={x}><rect x={x} y="214" width="24" height="27" rx="3" fill="#98C6BB" /><path d={`M${x + 12} 214v27M${x} 227h24`} stroke="#FFF4D9" strokeWidth="2" /></g>)}
        <path d="M216 293h48l9 10h-66l9-10Z" fill="#F5D9AA" />
        <path d="M67 289v-43M413 290v-56" stroke="#806449" strokeWidth="6" strokeLinecap="round" />
        <circle cx="65" cy="234" r="24" fill="#679D7A" /><circle cx="53" cy="244" r="19" fill="#7AAF89" /><circle cx="80" cy="242" r="18" fill="#7AAF89" />
        <circle cx="412" cy="219" r="30" fill="#679D7A" /><circle cx="395" cy="234" r="23" fill="#7AAF89" /><circle cx="429" cy="232" r="22" fill="#7AAF89" />
        <path d="M99 298c0-8 9-8 9 0M116 300c0-9 9-9 9 0M363 298c0-9 9-9 9 0" stroke="#4B9177" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <div className="art-note"><span className="tiny-star">✦</span><span>Mỗi ngày đến lớp,<br /><strong>một ngày vui.</strong></span></div>
      <div className="art-school-label"><span className="label-dot" /> Bắt đầu từ lớp Bốn 12</div>
    </div>
  );
}
