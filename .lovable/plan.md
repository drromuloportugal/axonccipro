# Plano — Refinamentos clínicos do PASSÔMETRO

Escopo grande. Vou dividir por coluna/área, todas alterações concentradas em frontend + modelo de dados local (`patients.ts`), sem novo backend.

## 1. Coluna 1 (Identificação) + Coluna 3 (Intervenções)
- **Mover** o bloco "Procedimentos e eventos" (timeline procedural) da coluna 3 para o final da coluna 1 (após dados de identificação/CID/alergias), tanto na linha colapsada quanto na expandida.
- Coluna 3 passa a exibir apenas **dispositivos/invasões** (mantém badges de risco e datas).
- Ajustar `PatientPrintView` igualmente.

## 2. Modelo anatômico — filtros de visualização
- Em `AnatomicalMap.tsx` adicionar toolbar com 3 toggles (chips): **Infecções**, **Invasões**, **LPP** (multi-seleção, default: todos ligados).
- Filtrar `markers` por `type` conforme seleção (`infection`, `device`, `lpp`).
- Estado local no componente; sem persistência.

## 3. Coluna 4 (Medicações) — agrupar por classe
Novas classes obrigatórias no modelo `Medication`:
```
"antibiotic" | "pump" | "iv" | "im" | "sc" | "oral" | "inhaled" | "topical"
```
- Adicionar `class` em `Medication` (`patients.ts`); manter compat via `route`/legado como fallback.
- No editor (`PatientEditor.tsx`), campo select "Classe".
- Na coluna 4 (colapsada + expandida), renderizar 8 subseções na ordem pedida com título curto (ATB, Bomba, EV, IM, SC, VO/Enteral, Inal., Tópico) — ocultar seções vazias.
- Bombas continuam sendo puxadas de `pumpInfusions`, mas exibidas dentro do bloco "Bomba".

## 4. Exames de imagem — anexar imagens
- Estender `ImagingStudy` (ou equivalente em `patients.ts`) com `images: { dataUrl: string; caption?: string }[]`.
- No editor: input `<input type="file" accept="image/*" multiple>` → converter para dataURL (base64, mesmo padrão usado no restante do app), listar thumbs com botão remover.
- Na coluna 5 e no print, exibir thumbnails clicáveis (abrem em modal / `<dialog>` simples com imagem maior).

## 5. Coluna 5 — ordem
Reordenar blocos para: **1) Culturas → 2) Laboratoriais → 3) Gasometria → 4) Imagem** na coluna colapsada, expandida e impressão.

## 6. Coluna 6 (Estado atual)
- **Remover** bloco "Focos de infecção".
- Adicionar **Escala de Bristol** (1–7) por evacuação, com legenda visual (cores e descrição resumida). Novo campo em `state` (ex.: `bristol?: 1|2|3|4|5|6|7`, opcional histórico).
- Novo módulo **Balanço hídrico**:
  - Modelo: `state.fluidBalance = { intake: { name; volume; unit }[]; output: { name; volume; unit; type: 'drain'|'diuresis'|'other' }[]; drains: { name; site; volume; date }[] }`.
  - UI compacta: tabela editável de entradas e saídas + lista de drenos configuráveis (nome + sítio + volume por período).
  - Cálculo em tempo real: `Σ entradas − Σ saídas` → exibido como "Balanço: +X / −X ml".
  - Editor completo em `PatientEditor.tsx`, resumo na coluna 6 expandida.

## 7. Coluna 7 (Plano · Condutas)
- Estender `PlanItem` com:
  - `system: "resp"|"cardio"|"neuro"|"renal"|"gi"|"infec"|"metab"|"hemato"|"skin"|"other"`.
  - `subItems: { text: string; done?: boolean }[]`.
- Editor: select de sistema + botão "Adicionar sub-conduta".
- Renderização: cada conduta como caixa colorida por sistema (usar tokens `clinical-*` já existentes; adicionar aliases para sistemas faltantes em `styles.css`). Sub-condutas listadas com bullets internos.
- Legenda de sistemas no topo da coluna expandida.

## Detalhes técnicos
- **Nenhuma dependência nova**. Imagens ficam inline como dataURL no JSON (compatível com o import/export existente).
- Todas as mudanças de schema em `patients.ts` são aditivas e opcionais → dados seed continuam válidos.
- Compat: medicações sem `class` caem em "EV" se `route==="IV"`, "VO/Enteral" se `route==="oral"`, etc.; heurística única em `src/lib/clinical.ts`.
- Impressão (`PatientPrintView`) espelha todas as mudanças visuais (menos filtros do mapa, que serão fixos = tudo).
- Bristol: helper `bristolMeta(n)` com cor/descrição em `src/lib/clinical.ts`.

## Arquivos afetados
- `src/data/patients.ts` — schema (medicação, imagem, bristol, balanço, plano).
- `src/components/PatientEditor.tsx` — novos campos de edição.
- `src/components/PatientRow.tsx` — reorganização colunas 1/3/4/5/6/7.
- `src/components/PatientPrintView.tsx` — espelhar mudanças.
- `src/components/AnatomicalMap.tsx` — filtros infecção/invasão/LPP.
- `src/lib/clinical.ts` — helpers (classe de medicação, bristol, balanço, sistemas do plano).
- `src/styles.css` — pequenos tokens de cor de sistema se faltarem.

Ao confirmar, implemento tudo em sequência, verificando build ao final.
