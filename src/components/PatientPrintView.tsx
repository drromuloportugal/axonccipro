import type { Patient, Severity, Medication } from "@/data/patients";
import { PrintAnatomicalMap } from "@/components/PrintAnatomicalMap";
import {
  examInsight, bucketBadge, trendBadge, generateEstadoAtual,
  computeAge, computeBMI,
  antibioticProgress, atbAlertBadge, detectAntibiotic,
  deviceRisk, formatDeviceDays,
  medClassOf, MEDICATION_CLASS_META, MEDICATION_CLASS_ORDER,
  bristolMeta, computeFluidBalance, CONDUCT_SYSTEM_META, ANNOTATION_COLOR_META, formatDateBR,
  organDonationLabel, directiveLabel,
} from "@/lib/clinical";
import { assessVitals, formatVitalValue, levelLabel } from "@/lib/vitals";
import { summarizeLPP, STAGE_META } from "@/lib/lpp";
import { DEVICE_CATEGORIES, deviceTypeByCode } from "@/data/devices";

const kindClass: Record<string, string> = {
  resp: "text-clinical-resp",
  stable: "text-clinical-stable",
  attention: "text-clinical-attention",
  device: "text-clinical-device",
  critical: "text-clinical-critical",
  neuro: "text-clinical-neuro",
  nutri: "text-clinical-nutri",
  neutral: "text-clinical-neutral",
};

const sevLabel: Record<Severity, string> = {
  stable: "Estável",
  attention: "Atenção",
  critical: "Crítico",
};

function Col({ title, idx, children }: { title: string; idx: number; children: React.ReactNode }) {
  return (
 <div className="border-l border-gray-200 pl-2.5 first:border-l-0 first:pl-0">
 <div className="mb-1.5 flex items-baseline gap-1.5 border-b border-gray-300 pb-1">
 <span className="font-mono text-[9px] font-semibold text-gray-400">{String(idx).padStart(2, "0")}</span>
 <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-800">{title}</span>
 </div>
 <div className="text-[10.5px] leading-[1.35]">{children}</div>
 </div> );
}

export function PatientPrintView({ patient }: { patient: Patient }) {
  const computed = generateEstadoAtual(patient);
  const conductsDone = patient.conducts.filter((c) => c.done).length;
  const bmi = computeBMI(patient.weight, patient.height);
  const age = computeAge(patient.birthDate) ?? patient.age;
  const activeDevices = (patient.devices ?? []).filter((d) => !d.removedAt);
  const vitals = assessVitals({
    fcMax: patient.state.fcMax,
    fr: patient.state.fr,
    pam: patient.state.pam,
    tempMax: patient.state.tempMax ?? patient.state.temp,
    spo2: patient.state.spo2,
    glicemia: patient.state.glicemia,
    diureseHoraria: patient.state.diureseHoraria,
    balancoHidrico: patient.state.balancoHidrico,
    weightKg: patient.weight,
  });
  const lppSummary = summarizeLPP(patient.lpp);
  const bristol = bristolMeta(patient.state.bristol);
  const fluidBalance = computeFluidBalance(patient.state.fluidBalance);
  const isGaso = (code?: string, label?: string) => /pH|PaO2|PaCO2|HCO3|SatO2/i.test(code ?? label ?? "");
  const labExams = patient.exams.filter((e) => !isGaso(e.code, e.label));
  const gasoExams = patient.exams.filter((e) => isGaso(e.code, e.label));
  const medsByClass = new Map<string, Medication[]>();
  for (const m of patient.medications) {
    const cls = medClassOf(m);
    if (!medsByClass.has(cls)) medsByClass.set(cls, []);
    medsByClass.get(cls)!.push(m);
  }

  return (
 <div className="bg-white p-4 text-black">
 <div className="mb-3 flex items-end justify-between border-b-[2.5px] border-black pb-2">
 <div>
 <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-gray-600">PASSÔMETRO · UTI</div>
 <h1 className="mt-0.5 text-[19px] font-bold leading-tight tracking-tight"> {patient.name}
 </h1>
 <div className="mt-0.5 text-[11px] text-gray-700">
 <span className="font-mono font-semibold">{patient.bed}</span>
 <span className="text-gray-400"> · </span> {age}a {patient.sex}
 <span className="text-gray-400"> · </span> {patient.weight}kg{patient.height ? `/${patient.height}cm` : ""}
            {bmi ? <><span className="text-gray-400"> · </span>IMC <span className="font-mono">{bmi.value}</span> ({bmi.label})</> : null}
 </div>
 <div className="text-[10.5px] text-gray-700"> UTI <span className="font-mono">D{patient.daysICU}</span>
 <span className="text-gray-400"> · </span> Hosp <span className="font-mono">D{patient.daysHosp}</span>
 <span className="text-gray-400"> · </span> Equipe {patient.team}
 <span className="text-gray-400"> · </span> {patient.attending}
 </div> {patient.origin && (
 <div className="text-[10px] text-gray-600">
 <b>Origem:</b> {[patient.origin.name ?? patient.origin.type, patient.origin.unit, patient.origin.city, patient.origin.state]
                .filter(Boolean).join(" · ")}
 </div> )}
 </div>
 <div className="text-right text-[10px] text-gray-700">
 <div className="inline-block rounded border border-gray-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"> {sevLabel[patient.severity]}
 </div>
 <div className="mt-1 text-[9px] text-gray-500">Impresso: {new Date().toLocaleString("pt-BR")}</div>
 </div>
 </div>



 <div className="grid grid-cols-7 gap-2">
 <Col title="Identificação" idx={1}>
 <ul className="space-y-0.5"> {patient.birthDate && <li><b>Nasc:</b> {new Date(patient.birthDate).toLocaleDateString("pt-BR")} ({age}a)</li>}
 <li><b>Adm Hosp:</b> {patient.admissionHosp}</li>
 <li><b>Adm UTI:</b> {patient.admissionICU}</li>
 <li><b>Alergias:</b> {patient.allergies.join(", ") || "—"}</li> {(patient.legalRepresentative?.name || patient.legalRepresentative?.phone) && (
 <li><b>Repr. legal:</b> {patient.legalRepresentative.name ?? "—"}
                {patient.legalRepresentative.relation ? ` (${patient.legalRepresentative.relation})` : ""}
                {patient.legalRepresentative.phone ? ` · ${patient.legalRepresentative.phone}` : ""}</li> )}
            {(patient.legalRepresentative2?.name || patient.legalRepresentative2?.phone) && (
 <li><b>Repr. legal 2:</b> {patient.legalRepresentative2.name ?? "—"}
                {patient.legalRepresentative2.relation ? ` (${patient.legalRepresentative2.relation})` : ""}
                {patient.legalRepresentative2.phone ? ` · ${patient.legalRepresentative2.phone}` : ""}</li> )}
            {patient.advanceDirective && (patient.advanceDirective.intubation !== "unknown" || patient.advanceDirective.resuscitation !== "unknown") && (
 <li><b>Diretivas:</b> {directiveLabel(patient.advanceDirective.intubation, "Entubar")} · {directiveLabel(patient.advanceDirective.resuscitation, "RCP")}
                {patient.advanceDirective.notes ? ` — ${patient.advanceDirective.notes}` : ""}</li> )}
            {patient.organDonation && patient.organDonation !== "unknown" && (
 <li><b>Doação de órgãos:</b> {organDonationLabel[patient.organDonation]}</li> )}
            {patient.social.tabagismo && <li>Tabagismo: {patient.social.tabagismo}</li>}
            {patient.social.ocupacao && <li>Ocup: {patient.social.ocupacao}</li>}
            {patient.social.dependencia && <li>Funcional: {patient.social.dependencia}</li>}
 </ul> {patient.procedures.length > 0 && (
 <>
 <div className="mt-2 font-bold text-gray-700">Procedimentos & eventos</div>
 <ul className="space-y-0.5"> {patient.procedures.map((p, i) => (
 <li key={i}>
 <span className="text-gray-500">{p.date}</span>{" "}
 <span className={kindClass[p.kind]}>{p.label}</span> {p.detail && <span className="text-gray-600"> — {p.detail}</span>}
 </li> ))}
 </ul>
 </> )}
 </Col>

 <Col title="História" idx={2}>
 <ul className="space-y-0.5"> {patient.diagnoses.map((d, i) => (
 <li key={i}>
 <span className="text-gray-500">{d.date}</span>{" "}
 <span className={kindClass[d.kind]}>{d.label}</span>
 </li> ))}
 </ul>
 </Col>

 <Col title="Dispositivos invasivos" idx={3}> {activeDevices.length === 0 && <div className="text-gray-500">Nenhum dispositivo ativo.</div>}
          {DEVICE_CATEGORIES.map((cat) => {
            const list = activeDevices.filter((d) => d.category === cat.code);
            if (!list.length) return null;
            return (
 <div key={cat.code} className="mb-1">
 <div className="text-[9px] font-bold text-gray-600">{cat.icon} {cat.label}</div>
 <ul className="ml-2"> {list.map((d) => {
                    const t = deviceTypeByCode(d.typeCode);
                    const r = deviceRisk(d);
                    return (
 <li key={d.id}> {r.icon} {t?.label}
                        {d.site ? ` · ${d.site}` : ""}
                        {d.lumens ? ` · ${d.lumens}L` : ""}
                        {d.size ? ` · ${d.size}` : ""}
 <span className="text-gray-600"> ({formatDeviceDays(d)}/max {r.max}d)</span>
 </li> );
                  })}
 </ul>
 </div> );
          })}
 </Col>

 <Col title="Medicações por classe" idx={4}> {MEDICATION_CLASS_ORDER.map((cls) => {
            const list = medsByClass.get(cls);
            if (!list || !list.length) return null;
            const meta = MEDICATION_CLASS_META[cls];
            return (
 <div key={cls} className="mb-1">
 <div className={`text-[9px] font-bold uppercase tracking-wider ${meta.className}`}>{meta.icon} {meta.label} ({list.length})</div>
 <ul className="ml-2 space-y-0.5"> {list.map((m, i) => {
                    const isAtb = m.isAntibiotic ?? detectAntibiotic(m.name);
                    const prog = isAtb ? antibioticProgress(m) : null;
                    const alert = prog ? atbAlertBadge(prog.alert) : null;
                    return (
 <li key={i}>
 <span className={`font-semibold ${kindClass[m.kind]}`}>{m.name}</span> {m.active === false && <span className="text-gray-500"> (susp.)</span>}
 <div className="font-mono text-[9px] text-gray-700">{m.dose} · {m.route} · {m.freq}</div> {m.mlPerHour !== undefined && <div className="font-mono text-[9px] text-gray-700">BIC {m.mlPerHour.toFixed(1)} mL/h</div>}
                        {prog && (
 <div className="text-[9px] text-gray-700"> D{prog.currentDay}/{prog.totalDays}
                            {alert && <span className="font-bold text-red-700"> · {alert.icon} {alert.label}</span>}
 </div> )}
 </li> );
                  })}
 </ul>
 </div> );
          })}
 </Col>

 <Col title="Culturas · Lab · Gaso · Imagem" idx={5}> {/* 1) Culturas */}
          {(patient.cultures?.length ?? 0) > 0 && (
 <div className="mb-1.5">
 <div className="text-[9px] font-bold uppercase tracking-wider text-gray-700"> Culturas</div>
 <ul className="space-y-0.5"> {patient.cultures!.map((c) => (
 <li key={c.id}>
 <span className="text-gray-500">{new Date(c.collectedAt).toLocaleDateString("pt-BR")}</span>{" "}
 <b>{c.source}</b> {c.organism ? <> — <i>{c.organism}</i></> : c.result === "negativa" ? " — negativa" : " — em andamento"}
                    {c.resistanceProfile && c.resistanceProfile !== "pendente" && <> · {c.resistanceProfile}</>}
 </li> ))}
 </ul>
 </div> )}
          {/* 2) Laboratoriais */}
          {labExams.length > 0 && (
 <div className="mb-1.5">
 <div className="text-[9px] font-bold uppercase tracking-wider text-gray-700"> Laboratoriais</div>
 <table className="w-full">
 <tbody>{labExams.map((e, i) => {
                    const ins = examInsight(e, patient.sex);
                    const b = ins.bucket ? bucketBadge(ins.bucket) : null;
                    const t = trendBadge(ins.trend);
                    return (
 <tr key={i} className="border-b border-gray-200">
 <td className="py-0.5 text-gray-600">{e.label}</td>
 <td className="py-0.5 text-right font-mono">{b?.icon} {e.value} {e.unit ?? ""}</td>
 <td className="py-0.5 pl-1 text-right text-gray-500">{ins.trend !== "flat" ? t.icon : "→"}</td>
 </tr> );
                  })}
 </tbody>
 </table>
 </div> )}
          {/* 3) Gasometria */}
          {gasoExams.length > 0 && (
 <div className="mb-1.5">
 <div className="text-[9px] font-bold uppercase tracking-wider text-gray-700"> Gasometria</div>
 <table className="w-full">
 <tbody>{gasoExams.map((e, i) => {
                    const ins = examInsight(e, patient.sex);
                    const b = ins.bucket ? bucketBadge(ins.bucket) : null;
                    return (
 <tr key={i} className="border-b border-gray-200">
 <td className="py-0.5 text-gray-600">{e.label}</td>
 <td className="py-0.5 text-right font-mono">{b?.icon} {e.value} {e.unit ?? ""}</td>
 </tr> );
                  })}
 </tbody>
 </table>
 </div> )}
          {/* 4) Imagem */}
          {(patient.imaging?.length ?? 0) > 0 && (
 <div>
 <div className="text-[9px] font-bold uppercase tracking-wider text-gray-700"> Imagem</div>
 <ul className="space-y-0.5"> {patient.imaging!.map((im) => {
                  const icon = im.conclusion === "critico" ? "" : im.conclusion === "alterado" ? "" : im.conclusion === "normal" ? "" : "";
                  return (
 <li key={im.id}>
 <span className="text-gray-500">{formatDateBR(im.performedAt)}</span>{" "}
 <b>{icon} {im.modality}</b> {im.region}
                      {im.summary && <span className="text-gray-700"> — {im.summary}</span>}
                      {im.images && im.images.length > 0 && (
 <div className="mt-0.5 flex flex-wrap gap-1"> {im.images.map((img) => (
 <img key={img.id} src={img.dataUrl} alt={img.caption ?? "imagem"} className="h-16 w-16 border border-gray-300 object-cover" /> ))}
 </div> )}
 </li> );
                })}
 </ul>
 </div> )}
 </Col>

 <Col title="Estado · Vitais · BH · Bristol" idx={6}>
 <ul className="space-y-1"> {computed.map((c, i) => (
 <li key={i}>
 <div className={`text-[9px] font-bold uppercase tracking-wider ${kindClass[c.kind]}`}>{c.icon} {c.sys}</div>
 <div className={c.flag ? "font-bold text-red-700" : ""}>{c.text}</div>
 </li> ))}
 </ul> {vitals.length > 0 && (
 <>
 <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-gray-700"> Parâmetros vitais</div>
 <table className="w-full">
 <tbody>{vitals.map((v) => {
                    const cls = v.level === "critical" ? "font-bold text-red-700"
                      : v.level === "attention" ? "font-bold text-amber-700"
                      : "text-gray-800";
                    return (
 <tr key={v.key} className="border-b border-gray-200">
 <td className="py-0.5 text-gray-700">{v.label}</td>
 <td className={`py-0.5 text-right font-mono ${cls}`}>{formatVitalValue(v)} {v.unit}</td>
 <td className="py-0.5 pl-1 text-right text-[9px] text-gray-500">{levelLabel(v.level)}</td>
 </tr> );
                  })}
 </tbody>
 </table>
 </> )}

          {bristol && (
 <>
 <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-gray-700"> Bristol</div>
 <div><b>Tipo {bristol.value}</b> — {bristol.hint}</div>
 </> )}

          {patient.state.fluidBalance && (fluidBalance.totalIntake || fluidBalance.totalOutput || fluidBalance.totalDrains) && (
 <>
 <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-gray-700"> Balanço hídrico</div>
 <div className="font-mono"> Entr. +{fluidBalance.totalIntake} · Saíd. −{fluidBalance.totalOutput} · Dren. −{fluidBalance.totalDrains}
 </div>
 <div className={`font-mono font-bold ${fluidBalance.balance < -500 ? "text-red-700" : fluidBalance.balance > 500 ? "text-amber-700" : ""}`}> BH: {fluidBalance.balance >= 0 ? "+" : ""}{fluidBalance.balance} mL
 </div> {(patient.state.fluidBalance?.drains?.length ?? 0) > 0 && (
 <ul className="ml-2"> {patient.state.fluidBalance!.drains!.map((d) => (
 <li key={d.id}><b>{d.name}</b>{d.site ? ` · ${d.site}` : ""}: {d.volumeMl} mL</li> ))}
 </ul> )}
 </> )}

          {lppSummary.totalActive > 0 && (
 <>
 <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-gray-700"> Lesões por pressão</div>
 <ul className="space-y-0.5"> {(patient.lpp ?? []).filter((l) => !l.resolvedAt).map((l) => {
                  const meta = STAGE_META[l.stage];
                  return (
 <li key={l.id}>
 <b>{meta?.label ?? l.stage}</b> · {l.siteLabel ?? l.site}
                      {l.notes && <span className="text-gray-600"> — {l.notes}</span>}
 </li> );
                })}
 </ul>
 </> )}
 </Col>

 <Col title="Plano · Sistemas" idx={7}>
 <div className="mb-1 text-[9px] text-gray-600">{conductsDone}/{patient.conducts.length} concluídas</div>
 <ul className="space-y-1"> {patient.conducts.map((c, i) => {
              const meta = c.system ? CONDUCT_SYSTEM_META[c.system] : null;
              return (
 <li key={i}>
 <div className="flex gap-1">
 <span>{c.done ? "☑" : "☐"}</span>
 <span> {meta && <span className={`mr-1 text-[9px] font-bold uppercase tracking-wider ${meta.className}`}>{meta.icon} {meta.short}</span>}
 <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">{c.team} </span> {c.text}
 </span>
 </div> {c.subItems && c.subItems.length > 0 && (
 <ul className="ml-4 border-l border-gray-300 pl-2"> {c.subItems.map((sub, si) => (
 <li key={si} className="flex gap-1">
 <span>{sub.done ? "☑" : "☐"}</span>
 <span>{sub.text}</span>
 </li> ))}
 </ul> )}
 </li> );
            })}
 </ul>
 <div className="mt-2 text-[9px] font-bold uppercase tracking-wider text-gray-700">Metas</div>
 <ul className="space-y-0.5"> {patient.goals.map((g, i) => (
 <li key={i} className="flex gap-1">
 <span>{g.met ? "✔" : "✗"}</span>
 <span className={g.met ? "" : "text-red-700"}>{g.text}</span>
 </li> ))}
 </ul>
 </Col>
 </div>


 <PrintAnatomicalMap patient={patient} />


 <div className="mt-3 border-t border-gray-300 pt-1 text-[8px] text-gray-500"> Documento gerado pelo PASSÔMETRO — uso interno para passagem de plantão.
 </div>
 </div> );
}
