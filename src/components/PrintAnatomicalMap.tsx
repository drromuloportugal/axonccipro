// Print-only compact anatomical map: anterior + posterior silhouettes with
// device markers (colored by dwell-time) and LPP markers (colored by stage),
// followed by a printed legend. Designed to fit at the bottom of one A4 page.

import type { Patient } from "@/data/patients";
import { deviceMarkers, deviceTimeColor } from "@/lib/anatomical";
import { STAGE_META, LPP_SITE_BY_KEY } from "@/lib/lpp";
import type { LPPStage } from "@/data/patients";

const HALF =
 "M100,12 C 116,12 124,22 124,40 C 124,54 120,62 116,66 L 113,72 L 112,84 " +
 "C 124,86 138,90 150,100 C 156,108 158,118 156,128 L 142,128 " +
 "C 144,150 142,178 138,200 C 134,220 130,232 128,244 " +
 "C 136,250 142,260 144,278 L 108,294 L 100,294 Z";
const ARM =
 "M152,108 C 160,128 164,150 166,180 C 168,210 170,238 172,262 " +
 "C 174,278 172,288 168,292 C 162,294 158,288 156,278 " +
 "C 154,260 152,238 150,212 C 148,188 146,160 144,134 Z";
const LEG =
 "M108,296 L142,296 C 142,330 138,360 134,390 C 132,420 128,450 124,478 " +
 "C 124,486 120,492 114,490 L 108,488 L 108,460 " +
 "C 108,420 110,380 110,340 Z";

function Body({ posterior }: { posterior?: boolean }) {
  const stroke = "#444";
  const fill = "#f4f4f5";
  return (
 <g>
 <g fill={fill} stroke={stroke} strokeWidth={1} strokeLinejoin="round">
 <path d={HALF} />
 <path d={HALF} transform="matrix(-1 0 0 1 200 0)" />
 <path d={ARM} />
 <path d={ARM} transform="matrix(-1 0 0 1 200 0)" />
 <path d={LEG} />
 <path d={LEG} transform="matrix(-1 0 0 1 200 0)" />
 </g>
 <g stroke="#888" strokeWidth={0.6} fill="none" opacity={0.6} strokeLinecap="round">
        {posterior ? (
 <>
 <line x1="100" y1="86" x2="100" y2="292" strokeDasharray="3 3" />
 <path d="M80,256 Q100,266 120,256" />
 <path d="M82,308 Q100,316 118,308" />
 </>
        ) : (
 <>
 <path d="M88,90 Q100,98 112,90" />
 <line x1="100" y1="100" x2="100" y2="160" strokeDasharray="2 3" />
 <circle cx="100" cy="222" r="1.2" fill="#888" />
 </>
        )}
 </g>
 </g>
  );
}

export function PrintAnatomicalMap({ patient }: { patient: Patient }) {
  const devices = (patient.devices ?? []).filter((d) => !d.removedAt);
  const lpp = patient.lpp ?? [];

  const renderView = (view: "anterior" | "posterior", label: string) => {
    const lppHere = lpp.filter((l) => l.view === view);
    return (
 <div className="flex flex-col items-center">
 <div className="mb-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-gray-700">{label}</div>
 <svg viewBox="0 0 200 510" className="block h-[210px]">
 <Body posterior={view === "posterior"} />
          {/* Device markers */}
          {devices.flatMap((d) => {
            const ms = deviceMarkers(d, view);
            const tc = deviceTimeColor(d);
            return ms.map((m, i) => (
 <g key={`${d.id}-${i}`}>
                {m.shape === "circle" && <circle cx={m.x} cy={m.y} r={6} fill={tc.color} stroke="white" strokeWidth={1} />}
                {m.shape === "ring" && <circle cx={m.x} cy={m.y} r={7} fill="none" stroke={tc.color} strokeWidth={2} />}
                {m.shape === "square" && <rect x={m.x - 5} y={m.y - 5} width={10} height={10} fill={tc.color} stroke="white" strokeWidth={1} />}
                {m.shape === "diamond" && <rect x={m.x - 5} y={m.y - 5} width={10} height={10} transform={`rotate(45 ${m.x} ${m.y})`} fill={tc.color} stroke="white" strokeWidth={1} />}
                {m.shape === "triangle" && <polygon points={`${m.x},${m.y - 7} ${m.x - 6},${m.y + 5} ${m.x + 6},${m.y + 5}`} fill={tc.color} stroke="white" strokeWidth={1} />}
 </g>
            ));
          })}
          {/* LPP markers */}
          {lppHere.map((l) => {
            const meta = STAGE_META[l.stage];
            const def = LPP_SITE_BY_KEY[l.site];
            const x = l.x ?? def?.x ?? 100;
            const y = l.y ?? def?.y ?? 100;
            return (
 <g key={`lpp-${l.id}`}>
 <circle cx={x} cy={y} r={8} fill={meta.color} fillOpacity={l.resolvedAt ? 0.25 : 0.9}
                        stroke="white" strokeWidth={1.2} />
 <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight="700" fill="white">
                  {meta.short}
 </text>
 </g>
            );
          })}
 </svg>
 </div>
    );
  };

  return (
 <div className="mt-3 break-inside-avoid border-t-[1.5px] border-gray-400 pt-2">
 <div className="mb-1.5 flex items-baseline justify-between">
 <div className="flex items-baseline gap-1.5">
 <span className="font-mono text-[9px] font-semibold text-gray-400">08</span>
 <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-800">
            Mapa anatômico · Dispositivos & Lesões por pressão
 </span>
 </div>
 <div className="text-[9.5px] text-gray-600">
          {devices.length} dispositivo(s) · {lpp.filter((l) => !l.resolvedAt).length} LPP ativa(s)
 </div>
 </div>

 <div className="grid grid-cols-[1fr_1fr_1.4fr] items-start gap-3">
        {renderView("anterior", "Anterior")}
        {renderView("posterior", "Posterior")}

        {/* Legend */}
 <div className="text-[9.5px] text-gray-800">
 <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.1em] text-gray-700">Permanência (dispositivos)</div>
 <ul className="mb-2 grid grid-cols-2 gap-x-2 gap-y-0.5">
 <LegendDot color="hsl(142 70% 45%)" label="0–3 dias" />
 <LegendDot color="hsl(45 95% 55%)" label="4–7 dias" />
 <LegendDot color="hsl(25 90% 55%)" label="8–10 dias" />
 <LegendDot color="hsl(0 80% 55%)" label=">10 dias" />
 <LegendDot color="hsl(280 60% 60%)" label="Sem revisão" />
 </ul>
 <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.1em] text-gray-700">Tipo de marcador</div>
 <ul className="mb-2 grid grid-cols-2 gap-x-2 gap-y-0.5">
 <li><span className="inline-block w-3 text-center">●</span> CVC/PICC</li>
 <li><span className="inline-block w-3 text-center">▲</span> PAI/PVP</li>
 <li><span className="inline-block w-3 text-center">■</span> Dreno/SVD</li>
 <li><span className="inline-block w-3 text-center">◆</span> DVE/DLE</li>
 <li><span className="inline-block w-3 text-center">○</span> Estomia/TQT</li>
 </ul>
 <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.1em] text-gray-700">Estágio LPP</div>
 <ul className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {(["1", "2", "3", "4", "NC", "LTP"] as LPPStage[]).map((s) => (
 <li key={s} className="flex items-center gap-1">
 <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: STAGE_META[s].color }} />
 <span><b>{STAGE_META[s].short}</b> — {STAGE_META[s].label.replace(/^Estágio \d+ — /, "").replace(/^Lesão tissular profunda/, "LTP")}</span>
 </li>
            ))}
 </ul>
 </div>
 </div>

      {/* LPP list (compact) */}
      {lpp.length > 0 && (
 <div className="mt-2">
 <div className="mb-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-700">
            Lesões registradas
 </div>
 <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[10px]">
            {lpp.map((l) => {
              const meta = STAGE_META[l.stage];
              return (
 <li key={l.id} className={l.resolvedAt ? "text-gray-500 line-through" : ""}>
 <span style={{ color: meta.color }} className="font-bold">{meta.short}</span>{" "}
                  {l.siteLabel ?? LPP_SITE_BY_KEY[l.site]?.label ?? l.site}
                  {l.count > 1 && ` ×${l.count}`}
 <span className="text-gray-600">
                    {" — "}
                    {new Date(l.identifiedAt).toLocaleDateString("pt-BR")} · {l.professional}
 </span>
 </li>
              );
            })}
 </ul>
 </div>
      )}
 </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
 <li className="flex items-center gap-1">
 <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
 <span>{label}</span>
 </li>
  );
}
