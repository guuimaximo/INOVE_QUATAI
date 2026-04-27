# Pages

As telas do sistema ficam organizadas por modulo, seguindo a mesma logica do menu lateral.

- `auth`: login, cadastro e fluxos de acesso.
- `home`: telas iniciais e dashboards principais.
- `desempenho-diesel`: desempenho, agente, acompanhamento e tratativas de diesel.
- `pcm`: telas do modulo PCM.
- `embarcados`: central, movimentacoes e reparos de embarcados.
- `estrutura-fisica`: solicitacao, central, consulta e tratamento.
- `tratativas`: tratativas gerais e RH.
- `avarias`: lancamento, revisao, aprovacao, cobrancas e resumo.
- `intervencoes`: SOS, KM rodado e paineis de intervencoes.
- `checklists`: central de checklists.
- `configuracoes`: telas administrativas.
- `portal`: telas de portal e integracoes.

Ao mover uma pagina, mantenha a rota publica no `src/App.jsx` sempre igual para nao quebrar links existentes.
