# Ativar a voz do NETO Live

A chave da OpenAI já está guardada com segurança. O código da voz já existe; falta ligar e validar de ponta a ponta.

## O que será feito

1. Confirmar que o servidor consegue abrir uma sessão de voz com a chave salva (teste real da chamada, sem expor a chave no navegador).
2. Ajustar o nome do modelo de voz se a resposta da OpenAI indicar outro, e corrigir a negociação de áudio caso a API responda com formato diferente do esperado.
3. Verificar no preview: pedir permissão do microfone, ouvir, falar, interromper a fala do NETO e encerrar.
4. Testar duas perguntas clínicas reais faladas ("analise o paciente" e "qual o SOFA dele?") para confirmar que a voz usa o Motor Clínico e não inventa dados.
5. Conferir que cada consulta e cada ferramenta ficam registradas na auditoria (apenas texto, nunca áudio).
6. Manter o comportamento de segurança: nada é prescrito automaticamente e registrar reavaliação só depois da sua confirmação na tela.
7. Corrigir um aviso de tela que aparece ao carregar a página de acesso.

## Se algo falhar

Se a OpenAI recusar a chave ou o áudio não conectar, o NETO continua respondendo por escrito e eu informo exatamente qual foi a recusa.

## Detalhes técnicos

- `src/lib/live/live.functions.ts`: valida `POST /v1/realtime/client_secrets`, retorno do token efêmero e gravação em `realtime_sessions`.
- `src/lib/live/tools.ts`: revisar `NETO_LIVE_MODEL` contra o modelo realtime disponível na conta.
- `src/lib/live/useNetoLive.ts`: confirmar handshake SDP em `/v1/realtime/calls`, eventos de transcrição, barge-in e reconexão.
- `src/components/NetoLivePanel.tsx`: apenas ajustes de estado/erro se necessário.
- Auditoria em `realtime_tool_calls`, `voice_interactions`, `clinical_audit_events` (RLS por usuário já ativa).
- `src/routes/auth.tsx`: resolver a divergência de hidratação SSR/cliente.
- Validação: `bunx tsgo --noEmit`, `bunx vitest run src/lib/live` e checagem no preview via Playwright.
