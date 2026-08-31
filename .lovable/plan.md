# Plano — Aba "Gestão" (Dashboard executivo da UTI)

Novo item no menu hamburger que abre um painel em tela cheia (overlay, mesmo padrão de Exames/Farmácia), com o dashboard executivo do coordenador.

## Fonte dos dados
- **Reais (derivados dos pacientes já cadastrados):** leitos ocupados, ventilação mecânica, drogas vasoativas, gravidade/risco, tempo de internação, aguardando transferência, previsão de alta, alertas.
- **Demonstrativos (séries históricas realistas geradas de forma determinística):** admissões/altas/óbitos por dia, tendências de 24 h / 7 d / 30 d e indicadores de qualidade com meta e período anterior. Total de leitos configurável (padrão 12).

## Estrutura da tela

**1. Cabeçalho**
- Título "Dashboard da UTI", data/hora da última atualização.
- Seletor de período (24 h · 7 d · 30 d), filtro de unidade (quando houver mais de uma), botão Atualizar.

**2. Visão geral de leitos**
- Cards: total, ocupados, disponíveis, taxa de ocupação com indicador circular.
- Cores por faixa: verde < 80 %, amarelo 80–90 %, vermelho > 90 % ou sem leitos.

**3. Fluxo de pacientes**
- Indicadores: admissões, altas, óbitos, previsão de alta, aguardando transferência.
- Gráfico combinado (barras admissões/altas + linha de ocupação) no período escolhido, com tooltips.

**4. Situação clínica e pacientes prioritários**
- Cards: em ventilação mecânica, em droga vasoativa, maior risco, permanência prolongada (> 14 dias).
- Tabela de prioritários: leito/identificador, motivo principal, badge de risco (alto/moderado/baixo com ícone + texto), tempo de internação, situação atual. Clique abre o paciente correspondente no painel principal.

**5. Alertas importantes**
- Ocupação > 90 %, sem leitos, permanência prolongada, transferência pendente > 24 h, piora de indicadores, recurso crítico indisponível.
- Ordenados por criticidade, com ação "marcar como visto" (estado local) e link para o contexto.

**6. Indicadores de qualidade**
- Ocupação, permanência média, mortalidade, reinternação, infecção relacionada à assistência, tempo médio para transferência, % de altas planejadas.
- Cada card: valor atual, meta, variação vs. período anterior com seta de tendência e sparkline.

**7. Tendências**
- Gráficos de linha para ocupação, admissões vs. altas, ventilação mecânica, drogas vasoativas, óbitos e permanência média, respeitando o período selecionado.

## Design
- Fundo claro, cards brancos, bordas finas — mesma linguagem visual atual (Inter, tokens do `styles.css`).
- Azul como cor primária; verde/amarelo/vermelho apenas para status. Contraste adequado, ícone + rótulo em todo status.
- Grid responsivo (desktop e tablet), sem emojis em nenhum texto.

## Detalhes técnicos
- `src/components/ManagementDashboard.tsx` — painel completo (overlay full-screen com botão fechar).
- `src/lib/management.ts` — funções puras: cálculo de ocupação, classificação de risco, detecção de alertas, indicadores de qualidade e geração determinística das séries históricas.
- `src/routes/index.tsx` — novo botão "Gestão" no menu hamburger + estado `managementOpen`; callback de clique em paciente prioritário navega o carrossel até o leito.
- Gráficos com `recharts` (já instalado). Nenhuma dependência nova, nenhuma mudança de banco.
