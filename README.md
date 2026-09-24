# Axon Pro

Criar um sistema web responsivo chamado PASSÔMETRO para acompanhamento de pacientes críticos em UTI através de um painel dividido em 7 colunas. O sistema deve funcionar como uma evolução digital da folha de passagem de plantão, permitindo rápida compreensão da história clínica, estado atual, intervenções realizadas e próximas condutas.



DESIGN E EXPERIÊNCIA VISUAL



FILOSOFIA DE DESIGN



O sistema deve transmitir sensação de centro de comando clínico moderno.



A aparência deve ser:



- Minimalista

- Profissional

- Limpa

- Altamente legível

- Baixa fadiga visual

- Otimizada para monitor de computador



Evitar aparência de prontuário tradicional.



Evitar excesso de caixas, bordas e elementos decorativos.



A prioridade é velocidade cognitiva.



O usuário deve identificar problemas em menos de 3 segundos apenas observando as cores e indicadores.



LAYOUT



O sistema será utilizado principalmente em:



- Monitores Full HD

- Monitores Ultrawide

- Estações médicas

- Centrais de monitorização



Estrutura:



Topo:

- Indicadores gerais da UTI

- Número de pacientes

- Leitos disponíveis

- Pacientes críticos

- Alertas



Centro:

- Painel principal de pacientes



Cada paciente aparece como um cartão horizontal expansível.



As 7 colunas permanecem visualmente alinhadas.



Ao expandir o paciente surgem detalhes sem abrir novas telas.



COLORIMETRIA INTELIGENTE



O sistema deve utilizar poucas cores.



Cada cor possui significado clínico fixo.



Cinza Escuro



Representa:

- Informações administrativas

- Dados demográficos

- Campos neutros



Azul



Representa:

- Sistema respiratório

- Ventilação mecânica

- Oxigenoterapia

- Vias aéreas



Verde



Representa:

- Estabilidade clínica

- Metas atingidas

- Evolução favorável



Amarelo



Representa:

- Atenção

- Alterações moderadas

- Pendências



Laranja



Representa:

- Dispositivos

- Sondas

- Cateteres

- Procedimentos recentes



Vermelho



Representa:

- Gravidade

- Instabilidade

- Choque

- Sepse

- Alertas críticos



Roxo



Representa:

- Neurologia

- Neurocirurgia

- DVE

- PIC

- EEG



Turquesa



Representa:

- Nutrição

- Metabolismo

- Terapias complementares



MAPA VISUAL DA UTI



Ao olhar a tela o médico deve conseguir identificar:



Muito vermelho:

Paciente instável.



Muito amarelo:

Paciente com pendências.



Muito verde:

Paciente em evolução favorável.



Muito roxo:

Paciente neurológico complexo.



Muito azul:

Paciente dependente de suporte respiratório.



INDICADORES VISUAIS



Utilizar:



- Barras horizontais discretas

- Etiquetas coloridas

- Ícones simples

- Setas de tendência



Evitar:



- Animações excessivas

- Efeitos chamativos

- Piscadas

- Pop-ups frequentes



DASHBOARD EXECUTIVO



Visão geral da unidade:



Pacientes críticos:

■ 4



Pacientes estáveis:

■ 10



VM:

■ 6



DVA:

■ 3



Hemodiálise:

■ 2



Infecção ativa:

■ 5



Alta prevista:

■ 3



Todos representados por gráficos simples e discretos.



MODO NOTURNO



Criar tema escuro como padrão.



Fundo:

Cinza grafite profundo



Texto:

Branco suave



Cores clínicas preservadas.



Reduzir fadiga visual durante plantões noturnos.



EXPERIÊNCIA DE USO



O médico deve conseguir:



- Entender o paciente em menos de 15 segundos.

- Encontrar qualquer exame em menos de 5 segundos.

- Localizar uma pendência em menos de 3 segundos.

- Realizar passagem de plantão sem abrir múltiplas telas.





O sistema deve parecer mais próximo de um painel de monitoramento aeronáutico ou centro de comando hospitalar do que de um prontuário eletrônico tradicional.



PRINCÍPIOS DO SISTEMA



Visualização completa do paciente em menos de 15 segundos.

Organização temporal dos eventos.

Atualização contínua.

Otimização para desktop, tablet e smartphone.

Dashboard simplificado para visão geral da unidade.

Registro detalhado acessível por expansão.





COLUNA 1 - IDENTIFICAÇÃO



Exibir:



Nome completo

Leito

Idade

Sexo

Peso

Data de admissão hospitalar

Data de admissão na UTI

Dias de internação hospitalar

Dias de internação na UTI

Médico responsável

Equipe assistente





Exibir selo de gravidade:



Verde = estável

Amarelo = atenção

Vermelho = crítico



COLUNA 2 - HISTÓRIA CLÍNICA E DIAGNÓSTICOS



Apresentação em formato temporal.



Permitir registrar:



História da doença atual

Diagnóstico principal

Diagnósticos secundários

Comorbidades

HPP

Alergias

História familiar





História social:



Tabagismo

Etilismo

Drogas ilícitas

Ocupação

Grau de dependência funcional





Linha temporal exemplo:



2026

↓

HAS

↓

DM2

↓

Tabagismo 40 maços/ano

↓

AVC isquêmico

↓

Pneumonia associada à VM

↓

Sepse



Possibilidade de reorganizar diagnósticos por data de surgimento.



COLUNA 3 - INTERVENÇÕES E PROCEDIMENTOS



Timeline colorida.



Categorias:



Azul:



Intubação

Extubação

Traqueostomia

Ventilação mecânica





Verde:



Cateter venoso central

PICC

Swan-Ganz

DVE





Laranja:



Sondas

SNE

SNG

Gastrostomia

Cistostomia

SVD





Vermelho:



Cirurgias

Reoperações

PCR

ECMO





Roxo:



Hemodiálise

CRRT





Todos os procedimentos devem conter:



Data

Hora

Profissional responsável

Observações





COLUNA 4 - MEDICAÇÕES E SUPORTES



Cadastro inteligente de protocolos.



Cada medicamento deve possuir:



Nome

Dose

Via

Frequência

Data de início

Data prevista de término





Modo avançado:



Perfil de diluição



Exemplo:



Noradrenalina:



Diluição padrão UTI Neuro

Diluição padrão UTI Geral

Diluição padrão UTI Cardiológica





Permitir configurar:



Concentração

Volume final

Solução utilizada

Velocidade de infusão

Dose por peso

Conversão automática mcg/kg/min





Biblioteca institucional de protocolos:



Sedação

Analgesia

Sepse

Status epilepticus

Neuroproteção

Insulinoterapia

Anticoagulação





COLUNA 5 - EXAMES



Armazenamento temporal completo.



Categorias:



Laboratório

Imagem

Microbiologia

Gasometrias

ECG

EEG



Todos os resultados ficam armazenados cronologicamente.



Exemplo:



15/06

Hb 10,2

Leuco 14.000

PCR 12



16/06

Hb 9,8

Leuco 18.000

PCR 22



Dashboard simplificado:



Mostrar apenas:



Último valor

Tendência

Valor crítico





Indicadores:



↑ piorando

↓ melhorando

→ estável



Permitir gráficos temporais automáticos.



COLUNA 6 - ESTADO ATUAL



Resumo do momento atual.



Neurológico

Respiratório

Hemodinâmico

Renal

Infeccioso

Nutricional



Exemplo:



Glasgow 10

RASS -2

PAM 75

Sem DVA

VM PSV

FiO2 30%

Diurese 1,1 ml/kg/h

Afebril

Dieta plena



Atualização diária.



COLUNA 7 - PLANO TERAPÊUTICO E CONDUTAS



Dividir por equipe.



Equipe Médica:



Ajustar antibiótico

Solicitar tomografia

Iniciar desmame ventilatório





Enfermagem:



Troca de curativo

Controle glicêmico

Balanço hídrico





Fisioterapia:



Mobilização

Treino muscular respiratório

Higiene brônquica





Nutrição:



Ajuste calórico

Avaliação proteica





Fonoaudiologia:



Avaliação de deglutição





Psicologia:



Avaliação familiar





Metas do dia:



PAM > 65

SatO2 > 92%

Diurese > 0,5 ml/kg/h

Lactato em queda



Mostrar checklist de execução e percentual de conclusão das condutas.



RECURSOS AVANÇADOS



Dashboard geral da UTI.

Busca rápida de pacientes.

Filtros por gravidade.

Modo escuro.

Linha do tempo interativa.

Resumo automático de passagem de plantão.

Geração automática de evolução médica.

Geração automática de evolução multiprofissional.

Alertas de pendências.

Alertas de exames críticos.

Alertas de vencimento de antibióticos.

Alertas de troca de dispositivos.

Integração futura com prontuário eletrônico.A única alteração estrutural que eu faria seria transformar a Coluna 6 em um verdadeiro “Estado Atual” automático, calculado a partir das outras colunas. Assim o médico não precisa reler todo o histórico para saber como o paciente está naquele momento. É como ter um “resumo executivo da UTI” atualizado em tempo real.


## Desenvolvimento

Este projeto é mantido de forma independente. Para executá-lo localmente, instale as dependências e use os comandos definidos em `package.json`.

```sh
bun install
bun run dev
```
