# Voz do NETO sem depender da conta OpenAI

Hoje a voz do NETO usa a conversa em tempo real da OpenAI, que está travada por falta de créditos na sua conta. O plano troca isso por voz apoiada no Gemini, já incluída no seu app (sem chave nem cartão à parte), mantendo tudo o que o NETO já faz.

## Como vai funcionar

1. Você toca no microfone e fala normalmente.
2. Ao parar de falar, o trecho é transcrito pelo Gemini e aparece no chat como sua pergunta.
3. O NETO responde usando exatamente o mesmo Motor Clínico e as mesmas 18 ferramentas clínicas de hoje (SOFA, FASTHUG-MAIDENS, ventilação, antibióticos, plano de 12h, dados faltantes...).
4. A resposta aparece escrita e é falada em voz alta em português.
5. Você pode interromper a fala do NETO a qualquer momento e falar de novo.

Diferença honesta em relação ao modo atual: a conversa passa a ser por turnos (você fala, o NETO responde) em vez de fluxo contínuo com corte no meio da frase. A troca de turno é rápida, e todas as regras de segurança continuam: nada é inventado, dado ausente segue como "não informado", e registrar reavaliação continua exigindo sua confirmação na tela.

## O que muda na tela

- O painel "NETO Live" continua no mesmo lugar, com o mesmo visual e as mesmas ações rápidas.
- Estados: desligado, ouvindo, transcrevendo, pensando, falando, erro.
- Botões para parar de gravar, parar a fala e desligar a voz.
- Um seletor discreto de voz (masculina/feminina) e a opção de desligar só a fala, mantendo o texto.
- Se a voz falhar por qualquer motivo, o chat de texto continua funcionando com a mensagem do motivo.

## Detalhes técnicos

- Captura no navegador via Web Audio com envio de WAV completo (16 kHz mono), evitando fragmentos que a transcrição rejeita.
- Novas funções de servidor em `src/lib/live/voice.functions.ts`:
  - transcrição: `POST /v1/audio/transcriptions` do Lovable AI Gateway com `google/gemini-3.5-transcribe`;
  - resposta clínica: reutiliza `runNetoLiveTool` e `runClinicalEngine` já existentes, com o modelo de chat `openai/gpt-6-astra` apenas para redigir a fala em camadas (prioridade, resumo, achados, recomendação, pendências, fonte);
  - fala: `POST /v1/audio/speech` (`openai/gpt-4o-mini-tts`), com áudio transmitido em streaming.
- Novo hook `src/lib/live/useNetoVoice.ts` substituindo o WebRTC no painel; `src/lib/live/useNetoLive.ts` e `live.functions.ts` permanecem no projeto como modo opcional, reativável se você colocar créditos na OpenAI.
- `NetoLivePanel.tsx` passa a usar o novo hook e ganha o seletor de voz; nenhuma ação rápida é removida.
- Auditoria continua nas tabelas existentes (`realtime_sessions`, `voice_interactions`, `realtime_tool_calls`, `clinical_audit_events`); só texto é gravado, nunca o áudio.
- Testes: transcrição de uma frase real sintetizada, execução de ferramenta por voz, microfone negado, gravação vazia, confirmação obrigatória e ausência de chave no código do navegador.
- Validação final no preview com um paciente real do passômetro, mais Prettier, checagem de tipos e testes.
