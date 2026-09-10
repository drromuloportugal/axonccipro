# Corrigir o JSON do Call Axon

## Objetivo
Garantir que o arquivo exportado contenha, de forma explícita e facilmente localizável, todos os dados exibidos na coluna 5 e ensine a IA a interpretar as cores das condutas da coluna 7.

## Implementação

1. **Exportar integralmente a coluna 5 por paciente**
   - Manter as coleções globais `microbiology` e `imaging`.
   - Adicionar ao registro de cada paciente referências e resumos explícitos da coluna 5, evitando que a IA dependa apenas das listas globais.
   - Culturas: amostra, local, data, estado/resultado, microrganismo, perfil de resistência, sensibilidades, resistências, antibiograma, observações e vínculos clínicos.
   - Imagem: modalidade, região, data, situação, conclusão, classificação do resultado, laudo/resumo e metadados dos anexos.
   - Preservar registros sem data e marcar campos ausentes, em vez de descartá-los.

2. **Tornar os registros consultáveis e rastreáveis**
   - Incluir culturas e imagens nos índices por paciente e nas referências do perfil clínico.
   - Adicionar identificadores e entradas no `source_map` para cada registro.
   - Incluir contagens e validações específicas no relatório de qualidade, deixando evidente quando um paciente não possui registros na coluna 5.
   - Atualizar o resumo exibido pelo Call Axon com as contagens exportadas.

3. **Exportar as condutas da coluna 7 com sua cor**
   - Criar uma seção estruturada de condutas por paciente, preservando sistema, equipe, texto, visibilidade, data e código da cor de cada anotação.
   - Associar cada conduta à sua origem para que a IA consiga justificar a leitura.

4. **Adicionar tutorial dentro do próprio JSON**
   - Incluir um guia explícito nas instruções para IA:
     - verde: bom resultado;
     - amarelo: atenção;
     - laranja: mantém conduta;
     - vermelho: sinal de alerta;
     - roxo: conduta nova.
   - Orientar que a cor é um marcador institucional de interpretação e não substitui o texto nem autoriza inferências.
   - Informar como localizar `microbiology`, `imaging`, condutas e respectivos registros por `PATIENT_ID`.

5. **Validar a exportação real**
   - Gerar um pacote com os pacientes atuais.
   - Confirmar que cada cultura e exame de imagem da coluna 5 aparece no JSON correto, vinculado ao paciente.
   - Confirmar que as condutas coloridas aparecem com código e significado corretos.
   - Executar formatação, verificação de tipos e teste direcionado do gerador.

## Detalhes técnicos
A coluna 5 usa atualmente `patient.cultures` e `patient.imaging`. O gerador já cria listas globais com esses nomes, mas o perfil individual não expõe referências diretas e as condutas coloridas ainda não formam uma coleção clínica própria. A correção reforçará essa ligação sem alterar a tela nem os dados existentes.
