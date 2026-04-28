# Inventario Codigo x Banco do INOVE_QUATAI

Documento gerado automaticamente a partir do codigo em `src/` para apoiar handoff tecnico, governanca e saneamento.

## Resumo

- Arquivos com touchpoints de banco/storage/auth: 75
- Objetos distintos mapeados: 70
- Tabelas/views distintas: 54
- Buckets distintos: 7
- RPCs distintas: 2
- Metodos de auth distintos: 6

## Flags criticas

- `create_client_local`: 4 arquivo(s)
  - `src/pages/desempenho-diesel/DesempenhoDieselResumo.jsx`
  - `src/routes/premiacaoRoutes.js`
  - `src/supabase.js`
  - `src/supabaseBCNT.js`
- `cross_base_client`: 3 arquivo(s)
  - `src/pages/checklists/ChecklistCentral.jsx`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx`
  - `src/supabaseBCNT.js`
- `github_env_usage`: 4 arquivo(s)
  - `src/components/desempenho/ModalCheckpointAnalise.jsx`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx`
- `github_token_frontend`: 4 arquivo(s)
  - `src/components/desempenho/ModalCheckpointAnalise.jsx`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx`
- `hardcoded_public_storage_url`: 2 arquivo(s)
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx`
- `hardcoded_supabase_url`: 1 arquivo(s)
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx`
- `legacy_password_query`: 6 arquivo(s)
  - `src/components/embarcados/ReparoSolicitacaoDetalhes.jsx`
  - `src/pages/auth/Login.jsx`
  - `src/pages/avarias/AprovacaoAvarias.jsx`
  - `src/pages/avarias/AvariasEmRevisao.jsx`
  - `src/pages/intervencoes/SOS_Resumo.jsx`
  - `src/pages/intervencoes/SOSCentral.jsx`
- `localstorage_session`: 5 arquivo(s)
  - `src/components/Sidebar.jsx`
  - `src/pages/auth/Login.jsx`
  - `src/pages/home/InicioRapido.jsx`
  - `src/pages/portal/PortalSistemas.jsx`
  - `src/utils/auth.js`
- `service_role_in_frontend`: 1 arquivo(s)
  - `src/routes/premiacaoRoutes.js`

## Matriz por arquivo

| Arquivo | Modulo | Clientes | Tabelas/Views | Buckets | RPC/Auth | Flags |
| --- | --- | --- | --- | --- | --- | --- |
| `src/AuthContext.jsx` | `auth_context` | `supabase` | profiles (l.16) | - | getSession (l.30), onAuthStateChange (l.53), signOut (l.68) | `-` |
| `src/components/CampoMotorista.jsx` | `component` | `supabase` | motoristas (l.22) | - | - | `-` |
| `src/components/CampoPrefixo.jsx` | `component` | `supabase` | prefixos (l.22) | - | - | `-` |
| `src/components/ChamadosMotoristasModal.jsx` | `component` | `supabase` | avarias_motoristas_chamados (l.38), avarias_motoristas_chamados (l.100), avarias_motoristas_chamados (l.148), avarias_motoristas_chamados (l.175), avarias_motoristas_chamados (l.202), avarias_motoristas_chamados (l.212) | - | - | `-` |
| `src/components/CobrancaDetalheModal.jsx` | `component` | `supabase` | cobrancas_avarias (l.115), avarias_terceiros (l.126), avarias_terceiros (l.169), avarias_terceiros (l.313), avarias (l.346) | - | - | `-` |
| `src/components/desempenho/AnaliseResumoModal.jsx` | `component` | `supabase` | diesel_acompanhamento_eventos (l.33) | - | - | `-` |
| `src/components/desempenho/HistoricoModal.jsx` | `component` | `supabase` | diesel_acompanhamento_eventos (l.31) | - | - | `-` |
| `src/components/desempenho/ModalCheckpointAnalise.jsx` | `component` | `supabase` | diesel_acompanhamento_eventos (l.228), diesel_acompanhamento_eventos (l.300), diesel_acompanhamentos (l.313), diesel_tratativas (l.389), diesel_tratativas (l.414), diesel_tratativas (l.434), diesel_tratativas_detalhes (l.472), acompanhamento_lotes (l.484), acompanhamento_lote_itens (l.501) | - | - | `github_env_usage, github_token_frontend` |
| `src/components/desempenho/ModalLancamentoIntervencao.jsx` | `component` | `supabase` | diesel_checklist_itens (l.146), diesel_acompanhamentos (l.276), diesel_checklist_respostas (l.283), diesel_checklist_respostas (l.330) | - | - | `-` |
| `src/components/desempenho/ModalProntuarioUnificado.jsx` | `component` | `supabase` | diesel_acompanhamentos (l.163) | - | - | `-` |
| `src/components/desempenho/ResumoAnalise.jsx` | `component` | `supabase` | diesel_acompanhamento_eventos (l.71) | - | - | `-` |
| `src/components/desempenho/ResumoLancamentoInstrutor.jsx` | `component` | `supabase` | diesel_checklist_itens (l.222), diesel_checklist_respostas (l.267) | - | - | `-` |
| `src/components/embarcados/ReparoSolicitacaoDetalhes.jsx` | `component` | `supabase` | usuarios_aprovadores (l.238), embarcados_solicitacoes_reparo (l.266), usuarios_aprovadores (l.307), embarcados_solicitacoes_reparo_eventos (l.356), embarcados_solicitacoes_reparo (l.384), embarcados_solicitacoes_reparo (l.428) | - | - | `legacy_password_query` |
| `src/components/embarcados/ReparoSolicitacaoExecucao.jsx` | `component` | `supabase` | usuarios_aprovadores (l.111), embarcados_solicitacoes_reparo (l.141), embarcados_solicitacoes_reparo_eventos (l.315), embarcados_solicitacoes_reparo (l.349) | - | - | `-` |
| `src/components/embarcados/ReparoSolicitacaoNovaModal.jsx` | `component` | `supabase` | usuarios_aprovadores (l.123), prefixos (l.174), embarcados_solicitacoes_reparo_eventos (l.249), embarcados_solicitacoes_reparo (l.406) | - | - | `-` |
| `src/components/Sidebar.jsx` | `component` | `-` | - | - | - | `localstorage_session` |
| `src/pages/auth/AtualizarPerfil.jsx` | `page` | `supabase` | - | - | sync_profile_after_review (l.55) | `-` |
| `src/pages/auth/AtualizarSenha.jsx` | `page` | `supabase` | - | - | getSession (l.36), onAuthStateChange (l.47), updateUser (l.86), signOut (l.94) | `-` |
| `src/pages/auth/Cadastro.jsx` | `page` | `supabase` | profiles (l.55) | - | signUp (l.40) | `-` |
| `src/pages/auth/Login.jsx` | `page` | `supabase` | usuarios_aprovadores (l.179), usuarios_aprovadores (l.256), usuarios_aprovadores (l.272) | - | - | `legacy_password_query, localstorage_session` |
| `src/pages/auth/Register.jsx` | `page` | `supabase` | usuarios_aprovadores (l.26) | - | - | `-` |
| `src/pages/avarias/AprovacaoAvarias.jsx` | `page` | `supabase` | usuarios_aprovadores (l.18), cobrancas_avarias (l.111), avarias (l.145), avarias (l.152), cobrancas_avarias (l.227), avarias (l.255), avarias (l.267), cobrancas_avarias (l.298), cobrancas_avarias (l.328), avarias (l.365), avarias (l.385), avarias (l.673) | - | - | `legacy_password_query` |
| `src/pages/avarias/Avarias.jsx` | `page` | `supabase` | avarias (l.19), cobrancas_avarias (l.55), avarias (l.67) | - | - | `-` |
| `src/pages/avarias/AvariasEmRevisao.jsx` | `page` | `supabase` | usuarios_aprovadores (l.21), cobrancas_avarias (l.119), cobrancas_avarias (l.187), cobrancas_avarias (l.208), avarias (l.218), cobrancas_avarias (l.252), cobrancas_avarias (l.266), avarias (l.297), avarias (l.551) | - | - | `legacy_password_query` |
| `src/pages/avarias/AvariasResumo.jsx` | `page` | `supabase` | avarias (l.257) | - | - | `-` |
| `src/pages/avarias/CobrancasAvarias.jsx` | `page` | `supabase` | usuarios_aprovadores (l.64), avarias (l.114), avarias (l.152), avarias (l.215), avarias (l.241) | - | getUser (l.56), onAuthStateChange (l.82) | `-` |
| `src/pages/avarias/LancarAvaria.jsx` | `page` | `storage, supabase` | avarias (l.131), avarias (l.137), avarias (l.147), cobrancas_avarias (l.183) | avarias (l.131), avarias (l.137) | - | `-` |
| `src/pages/checklists/ChecklistCentral.jsx` | `page` | `supabaseBCNT` | checklists (l.103), checklists (l.136), checklists (l.141), checklists (l.150) | - | - | `cross_base_client` |
| `src/pages/configuracoes/Usuarios.jsx` | `page` | `supabase` | usuarios_aprovadores (l.14), usuarios_aprovadores (l.34), usuarios_aprovadores (l.51) | - | - | `-` |
| `src/pages/desempenho-diesel/Desempenho_Diesel_Tratativas_Central.jsx` | `page` | `supabase` | diesel_tratativas (l.133), diesel_tratativas (l.142), diesel_tratativas (l.148) | - | - | `-` |
| `src/pages/desempenho-diesel/DesempenhoDieselAcompanhamento.jsx` | `page` | `supabase` | usuarios_aprovadores (l.204), v_diesel_acompanhamentos_ciclo (l.230), diesel_checklist_respostas (l.334), diesel_acompanhamentos (l.339) | - | - | `-` |
| `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx` | `page` | `supabase` | relatorios_gerados (l.834), diesel_analise_gerencial_snapshot (l.845), v_sugestoes_acompanhamento_30d (l.855), diesel_acompanhamentos (l.857), diesel_sugestoes_acompanhamento (l.892), relatorios_gerados (l.964), acompanhamento_lotes (l.1008), acompanhamento_lote_itens (l.1032) | ${bucket} (l.86), ${bucket} (l.89), parcial_meritocracia (l.131) | getSession (l.830) | `cross_base_client, github_env_usage, github_token_frontend, hardcoded_public_storage_url, hardcoded_supabase_url` |
| `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx` | `page` | `supabase` | relatorios_gerados (l.194), diesel_analise_gerencial_snapshot (l.205), v_sugestoes_acompanhamento_30d (l.215), diesel_acompanhamentos (l.217), diesel_sugestoes_acompanhamento (l.256), relatorios_gerados (l.360), acompanhamento_lotes (l.407), acompanhamento_lote_itens (l.431) | ${BUCKET_NAME} (l.53) | getSession (l.190) | `github_env_usage, github_token_frontend, hardcoded_public_storage_url` |
| `src/pages/desempenho-diesel/DesempenhoDieselCheckpoint.jsx` | `page` | `supabase` | diesel_acompanhamentos (l.344), diesel_acompanhamento_eventos (l.399), diesel_checklist_itens (l.415), diesel_metricas_motorista_dia (l.459), diesel_acompanhamento_eventos (l.622), diesel_checklist_respostas (l.641), diesel_acompanhamentos (l.668) | - | - | `-` |
| `src/pages/desempenho-diesel/DesempenhoDieselResumo.jsx` | `page` | `supabase, supabaseA` | premiacao_diaria_atualizada (l.289), funcionarios (l.318), diesel_acompanhamentos (l.337) | - | - | `create_client_local` |
| `src/pages/desempenho-diesel/DesempenhoDieselTratativas.jsx` | `page` | `supabase` | atas_diesel (l.122), atas_diesel_detalhes (l.126), linhas (l.136) | - | - | `-` |
| `src/pages/desempenho-diesel/DesempenhoLancamento.jsx` | `page` | `supabase` | diesel_acompanhamentos (l.141), diesel_tratativas (l.160), diesel_acompanhamentos (l.238), diesel_acompanhamento_eventos (l.248), acompanhamento_lotes (l.256), acompanhamento_lote_itens (l.260), diesel_tratativas (l.267), diesel_tratativas_detalhes (l.278), acompanhamento_lotes (l.286), acompanhamento_lote_itens (l.290) | - | - | `github_env_usage, github_token_frontend` |
| `src/pages/desempenho-diesel/DieselConsultarTratativa.jsx` | `page` | `supabase` | diesel_tratativas (l.157), diesel_tratativas_detalhes (l.166) | - | - | `-` |
| `src/pages/desempenho-diesel/DieselTratarTratativa.jsx` | `page` | `storage, supabase` | diesel_tratativas (l.245), linhas (l.254), motoristas (l.263), diesel_tratativas_detalhes (l.273), diesel_tratativas (l.308), diesel_tratativas (l.313), diesel_tratativas_detalhes (l.322), diesel_tratativas (l.333), diesel_tratativas_detalhes (l.369), diesel_tratativas (l.376) | diesel_tratativas (l.308), diesel_tratativas (l.313) | - | `-` |
| `src/pages/embarcados/Embarcados.jsx` | `page` | `supabase` | prefixos (l.507), embarcados_veiculos (l.530), embarcados_veiculos (l.586), embarcados_veiculos (l.597) | - | - | `-` |
| `src/pages/embarcados/EmbarcadosCentral.jsx` | `page` | `supabase` | v_embarcados_central (l.407), embarcados_movimentacoes (l.411), embarcados (l.496), embarcados (l.513) | - | - | `-` |
| `src/pages/embarcados/EmbarcadosEnvioManutencao.jsx` | `page` | `supabase` | embarcados (l.89), embarcados_envios_manutencao (l.95), embarcados_envios_manutencao (l.99), embarcados_envios_manutencao (l.321), embarcados (l.334), embarcados_movimentacoes (l.345), embarcados_envios_manutencao (l.380), embarcados (l.419), embarcados_movimentacoes (l.430) | - | - | `-` |
| `src/pages/embarcados/EmbarcadosMovimentacoes.jsx` | `page` | `supabase` | prefixos (l.79), embarcados (l.80), embarcados (l.86), prefixos (l.105), embarcados (l.106), embarcados (l.180), embarcados_solicitacoes_reparo (l.186), embarcados_movimentacoes (l.191), embarcados_movimentacoes (l.222), embarcados_instalacoes (l.236), embarcados_instalacoes (l.246), embarcados (l.256), embarcados (l.296), embarcados_movimentacoes (l.323), embarcados_instalacoes (l.337), embarcados_instalacoes (l.348), embarcados (l.359) | - | getSession (l.72) | `-` |
| `src/pages/embarcados/EmbarcadosReparos.jsx` | `page` | `supabase` | embarcados_solicitacoes_reparo (l.111) | - | - | `-` |
| `src/pages/estrutura-fisica/EstruturaFisicaCentral.jsx` | `page` | `supabase` | setores (l.94), v_estrutura_fisica_central (l.108), v_estrutura_fisica_central (l.123) | - | - | `-` |
| `src/pages/estrutura-fisica/EstruturaFisicaConsultar.jsx` | `page` | `supabase` | estrutura_fisica_solicitacoes (l.107), estrutura_fisica_historico (l.116) | - | - | `-` |
| `src/pages/estrutura-fisica/EstruturaFisicaSolicitacao.jsx` | `page` | `storage, supabase` | setores (l.82), estrutura_fisica_solicitacoes (l.97), estrutura_fisica_solicitacoes (l.190), estrutura_fisica (l.225), estrutura_fisica (l.232), estrutura_fisica_solicitacoes (l.239) | estrutura_fisica (l.225), estrutura_fisica (l.232) | - | `-` |
| `src/pages/estrutura-fisica/EstruturaFisicaTratar.jsx` | `page` | `storage, supabase` | estrutura_fisica_solicitacoes (l.56), estrutura_fisica (l.179), estrutura_fisica (l.186), estrutura_fisica_historico (l.198), estrutura_fisica_solicitacoes (l.227), estrutura_fisica_solicitacoes (l.277), estrutura_fisica_solicitacoes (l.331) | estrutura_fisica (l.179), estrutura_fisica (l.186) | - | `-` |
| `src/pages/home/Dashboard.jsx` | `page` | `supabase` | tratativas (l.82), tratativas (l.87), tratativas (l.95), tratativas (l.106), avarias (l.116), tratativas (l.164), avarias (l.167), avarias (l.171), tratativas (l.203), avarias (l.208) | - | - | `-` |
| `src/pages/home/InicioRapido.jsx` | `page` | `-` | - | - | - | `localstorage_session` |
| `src/pages/home/Landing.jsx` | `page` | `supabase` | usuarios_aprovadores (l.26), usuarios_aprovadores (l.35) | - | getUser (l.14) | `-` |
| `src/pages/intervencoes/KMRodado.jsx` | `page` | `supabase` | km_rodado_diario (l.38), km_rodado_diario (l.91), km_rodado_diario (l.113) | - | - | `-` |
| `src/pages/intervencoes/SolicitacaoSOS.jsx` | `page` | `supabase` | linhas (l.60), tabelas_operacionais (l.64), prefixos (l.67), sos_acionamentos (l.77), sos_acionamentos (l.120) | - | - | `-` |
| `src/pages/intervencoes/SOS_Resumo.jsx` | `page` | `supabase` | usuarios_aprovadores (l.448), preventivas (l.503), preventivas (l.507), preventivas (l.519), preventivas (l.520), sos_acionamentos (l.548), sos_acionamentos (l.737) | - | - | `legacy_password_query` |
| `src/pages/intervencoes/SOSCentral.jsx` | `page` | `supabase` | usuarios_aprovadores (l.134), preventivas (l.208), preventivas (l.217), preventivas (l.240), preventivas (l.249), sos_acionamentos (l.284), sos_acionamentos (l.593) | - | - | `legacy_password_query` |
| `src/pages/intervencoes/SOSDashboard.jsx` | `page` | `supabase` | sos_acionamentos (l.105), sos_acionamentos (l.211), km_rodado_diario (l.219), sos_acionamentos (l.240) | - | - | `-` |
| `src/pages/intervencoes/SOSFechamento.jsx` | `page` | `supabase` | sos_acionamentos (l.47), prefixos (l.161), sos_acionamentos (l.175) | - | - | `-` |
| `src/pages/intervencoes/SOSTratamento.jsx` | `page` | `supabase` | sos_acionamentos (l.38), motoristas (l.170), sos_manutencao_catalogo (l.288), preventivas (l.303), preventivas (l.312), sos_acionamentos (l.482) | - | - | `-` |
| `src/pages/pcm/PCM_Preventivas.jsx` | `page` | `supabase` | prefixos (l.51), preventivas (l.57), preventivas (l.144) | - | - | `-` |
| `src/pages/pcm/PCMDiario.jsx` | `page` | `supabase` | pcm_diario (l.344), veiculos_pcm (l.345), prefixos (l.346), veiculos_pcm_historico (l.374), veiculos_pcm (l.388), veiculos_pcm (l.394), veiculos_pcm (l.407), veiculos_pcm (l.419), veiculos_pcm (l.427) | - | - | `-` |
| `src/pages/pcm/PCMInicio.jsx` | `page` | `supabase` | pcm_diario (l.147), pcm_diario (l.160), veiculos_pcm (l.168), veiculos_pcm (l.199), veiculos_pcm (l.212), pcm_diario (l.223), pcm_diario (l.239) | - | - | `-` |
| `src/pages/pcm/PCMResumo.jsx` | `page` | `supabase` | pcm_diario (l.474), veiculos_pcm (l.483), pcm_diario (l.494), pcm_diario (l.520), veiculos_pcm (l.528), veiculos_pcm (l.529), veiculos_pcm (l.530) | - | - | `-` |
| `src/pages/portal/PortalSistemas.jsx` | `page` | `supabase` | usuarios_aprovadores (l.33) | - | - | `localstorage_session` |
| `src/pages/tratativas/CentralTratativas.jsx` | `page` | `supabase` | setores (l.137), tratativas (l.151), tratativas (l.171), tratativas (l.180), tratativas (l.186) | - | - | `-` |
| `src/pages/tratativas/ConsultarTratativa.jsx` | `page` | `supabase` | tratativas (l.129), tratativas_detalhes (l.138), linhas (l.160) | - | - | `-` |
| `src/pages/tratativas/SolicitacaoTratativa.jsx` | `page` | `storage, supabase` | tipos_ocorrencia (l.81), setores (l.82), linhas (l.83), usuarios_aprovadores (l.178), tratativas (l.214), tratativas (l.220), tratativas (l.250) | tratativas (l.214), tratativas (l.220) | - | `-` |
| `src/pages/tratativas/TratarTratativa.jsx` | `page` | `storage, supabase` | tratativas (l.370), linhas (l.392), motoristas (l.403), tratativas (l.419), linhas (l.435), tratativas (l.457), tratativas (l.462), tratativas_detalhes (l.488), tratativas (l.501) | tratativas (l.457), tratativas (l.462) | - | `-` |
| `src/pages/tratativas/TratativasLancarRH.jsx` | `page` | `storage, supabase` | tratativas (l.57), tratativas (l.63), tratativas_rh (l.267) | tratativas (l.57), tratativas (l.63) | - | `-` |
| `src/pages/tratativas/TratativasResumo.jsx` | `page` | `supabase` | tratativas (l.156), tratativas (l.205), tratativas_detalhes (l.252) | - | - | `-` |
| `src/pages/tratativas/TratativasRH.jsx` | `page` | `supabase` | tratativas_detalhes (l.120), tratativas_rh (l.143) | - | - | `-` |
| `src/routes/premiacaoRoutes.js` | `route` | `sb` | premiacao_diaria (l.32) | - | - | `create_client_local, service_role_in_frontend` |
| `src/supabase.js` | `supabase_client` | `-` | - | - | - | `create_client_local` |
| `src/supabaseBCNT.js` | `supabase_client` | `-` | - | - | - | `create_client_local, cross_base_client` |
| `src/utils/auth.js` | `util` | `-` | - | - | - | `localstorage_session` |
| `src/utils/authBridge.js` | `util` | `supabase` | - | - | resolve_auth_account (l.23) | `-` |

## Matriz por objeto

### Tabelas e Views

- `acompanhamento_lote_itens`
  - `src/components/desempenho/ModalCheckpointAnalise.jsx:501` via `supabase` com operacoes `insert`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:1032` via `supabase` com operacoes `insert`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx:431` via `supabase` com operacoes `insert`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx:260` via `supabase` com operacoes `insert`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx:290` via `supabase` com operacoes `insert`

- `acompanhamento_lotes`
  - `src/components/desempenho/ModalCheckpointAnalise.jsx:484` via `supabase` com operacoes `select, insert, single`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:1008` via `supabase` com operacoes `select, insert, single`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx:407` via `supabase` com operacoes `select, insert, single`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx:256` via `supabase` com operacoes `select, insert, single`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx:286` via `supabase` com operacoes `select, insert, single`

- `atas_diesel`
  - `src/pages/desempenho-diesel/DesempenhoDieselTratativas.jsx:122` via `supabase` com operacoes `select, eq, single`

- `atas_diesel_detalhes`
  - `src/pages/desempenho-diesel/DesempenhoDieselTratativas.jsx:126` via `supabase` com operacoes `select, eq`

- `avarias`
  - `src/components/CobrancaDetalheModal.jsx:346` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/AprovacaoAvarias.jsx:145` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/AprovacaoAvarias.jsx:152` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/AprovacaoAvarias.jsx:255` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/AprovacaoAvarias.jsx:267` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/AprovacaoAvarias.jsx:365` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/AprovacaoAvarias.jsx:385` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/AprovacaoAvarias.jsx:673` via `supabase` com operacoes `select, eq`
  - `src/pages/avarias/Avarias.jsx:19` via `supabase` com operacoes `select`
  - `src/pages/avarias/Avarias.jsx:67` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/AvariasEmRevisao.jsx:218` via `supabase` com operacoes `delete, eq`
  - `src/pages/avarias/AvariasEmRevisao.jsx:297` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/AvariasEmRevisao.jsx:551` via `supabase` com operacoes `select, eq`
  - `src/pages/avarias/AvariasResumo.jsx:257` via `supabase` com operacoes `select, eq`
  - `src/pages/avarias/CobrancasAvarias.jsx:114` via `supabase` com operacoes `select, eq`
  - `src/pages/avarias/CobrancasAvarias.jsx:152` via `supabase` com operacoes `select, eq`
  - `src/pages/avarias/CobrancasAvarias.jsx:215` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/CobrancasAvarias.jsx:241` via `supabase` com operacoes `delete, eq`
  - `src/pages/avarias/LancarAvaria.jsx:131` via `storage` com operacoes `unknown`
  - `src/pages/avarias/LancarAvaria.jsx:137` via `storage` com operacoes `unknown`
  - `src/pages/avarias/LancarAvaria.jsx:147` via `supabase` com operacoes `select, insert, single`
  - `src/pages/home/Dashboard.jsx:116` via `supabase` com operacoes `select`
  - `src/pages/home/Dashboard.jsx:167` via `supabase` com operacoes `select`
  - `src/pages/home/Dashboard.jsx:171` via `supabase` com operacoes `select`
  - `src/pages/home/Dashboard.jsx:208` via `supabase` com operacoes `select`

- `avarias_motoristas_chamados`
  - `src/components/ChamadosMotoristasModal.jsx:38` via `supabase` com operacoes `select, eq`
  - `src/components/ChamadosMotoristasModal.jsx:100` via `supabase` com operacoes `delete, eq`
  - `src/components/ChamadosMotoristasModal.jsx:148` via `supabase` com operacoes `update, eq`
  - `src/components/ChamadosMotoristasModal.jsx:175` via `supabase` com operacoes `update, eq`
  - `src/components/ChamadosMotoristasModal.jsx:202` via `supabase` com operacoes `select, insert, single`
  - `src/components/ChamadosMotoristasModal.jsx:212` via `supabase` com operacoes `update, eq`

- `avarias_terceiros`
  - `src/components/CobrancaDetalheModal.jsx:126` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/components/CobrancaDetalheModal.jsx:169` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/components/CobrancaDetalheModal.jsx:313` via `supabase` com operacoes `upsert`

- `checklists`
  - `src/pages/checklists/ChecklistCentral.jsx:103` via `supabaseBCNT` com operacoes `select`
  - `src/pages/checklists/ChecklistCentral.jsx:136` via `supabaseBCNT` com operacoes `select`
  - `src/pages/checklists/ChecklistCentral.jsx:141` via `supabaseBCNT` com operacoes `select`
  - `src/pages/checklists/ChecklistCentral.jsx:150` via `supabaseBCNT` com operacoes `select`

- `cobrancas_avarias`
  - `src/components/CobrancaDetalheModal.jsx:115` via `supabase` com operacoes `select, eq`
  - `src/pages/avarias/AprovacaoAvarias.jsx:111` via `supabase` com operacoes `select, eq`
  - `src/pages/avarias/AprovacaoAvarias.jsx:227` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/AprovacaoAvarias.jsx:298` via `supabase` com operacoes `select, insert, single`
  - `src/pages/avarias/AprovacaoAvarias.jsx:328` via `supabase` com operacoes `delete, eq`
  - `src/pages/avarias/Avarias.jsx:55` via `supabase` com operacoes `insert`
  - `src/pages/avarias/AvariasEmRevisao.jsx:119` via `supabase` com operacoes `select, eq`
  - `src/pages/avarias/AvariasEmRevisao.jsx:187` via `supabase` com operacoes `delete, eq`
  - `src/pages/avarias/AvariasEmRevisao.jsx:208` via `supabase` com operacoes `delete, eq`
  - `src/pages/avarias/AvariasEmRevisao.jsx:252` via `supabase` com operacoes `insert`
  - `src/pages/avarias/AvariasEmRevisao.jsx:266` via `supabase` com operacoes `update, eq`
  - `src/pages/avarias/LancarAvaria.jsx:183` via `supabase` com operacoes `insert`

- `diesel_acompanhamento_eventos`
  - `src/components/desempenho/AnaliseResumoModal.jsx:33` via `supabase` com operacoes `select, eq`
  - `src/components/desempenho/HistoricoModal.jsx:31` via `supabase` com operacoes `select, eq`
  - `src/components/desempenho/ModalCheckpointAnalise.jsx:228` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/components/desempenho/ModalCheckpointAnalise.jsx:300` via `supabase` com operacoes `insert`
  - `src/components/desempenho/ResumoAnalise.jsx:71` via `supabase` com operacoes `select, eq, in`
  - `src/pages/desempenho-diesel/DesempenhoDieselCheckpoint.jsx:399` via `supabase` com operacoes `select, eq`
  - `src/pages/desempenho-diesel/DesempenhoDieselCheckpoint.jsx:622` via `supabase` com operacoes `select, insert, single`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx:248` via `supabase` com operacoes `insert`

- `diesel_acompanhamentos`
  - `src/components/desempenho/ModalCheckpointAnalise.jsx:313` via `supabase` com operacoes `update, eq`
  - `src/components/desempenho/ModalLancamentoIntervencao.jsx:276` via `supabase` com operacoes `update, eq`
  - `src/components/desempenho/ModalProntuarioUnificado.jsx:163` via `supabase` com operacoes `select, eq`
  - `src/pages/desempenho-diesel/DesempenhoDieselAcompanhamento.jsx:339` via `supabase` com operacoes `delete, eq`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:857` via `supabase` com operacoes `select`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx:217` via `supabase` com operacoes `select`
  - `src/pages/desempenho-diesel/DesempenhoDieselCheckpoint.jsx:344` via `supabase` com operacoes `select`
  - `src/pages/desempenho-diesel/DesempenhoDieselCheckpoint.jsx:668` via `supabase` com operacoes `update, eq`
  - `src/pages/desempenho-diesel/DesempenhoDieselResumo.jsx:337` via `supabase` com operacoes `select`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx:141` via `supabase` com operacoes `select, eq, in`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx:238` via `supabase` com operacoes `select, insert, single`

- `diesel_analise_gerencial_snapshot`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:845` via `supabase` com operacoes `select, maybeSingle`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx:205` via `supabase` com operacoes `select, maybeSingle`

- `diesel_checklist_itens`
  - `src/components/desempenho/ModalLancamentoIntervencao.jsx:146` via `supabase` com operacoes `select`
  - `src/components/desempenho/ResumoLancamentoInstrutor.jsx:222` via `supabase` com operacoes `select, eq, in`
  - `src/pages/desempenho-diesel/DesempenhoDieselCheckpoint.jsx:415` via `supabase` com operacoes `select, eq`

- `diesel_checklist_respostas`
  - `src/components/desempenho/ModalLancamentoIntervencao.jsx:283` via `supabase` com operacoes `delete, eq`
  - `src/components/desempenho/ModalLancamentoIntervencao.jsx:330` via `supabase` com operacoes `insert`
  - `src/components/desempenho/ResumoLancamentoInstrutor.jsx:267` via `supabase` com operacoes `select, eq`
  - `src/pages/desempenho-diesel/DesempenhoDieselAcompanhamento.jsx:334` via `supabase` com operacoes `delete, eq`
  - `src/pages/desempenho-diesel/DesempenhoDieselCheckpoint.jsx:641` via `supabase` com operacoes `insert`

- `diesel_metricas_motorista_dia`
  - `src/pages/desempenho-diesel/DesempenhoDieselCheckpoint.jsx:459` via `supabase` com operacoes `select, eq`

- `diesel_sugestoes_acompanhamento`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:892` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx:256` via `supabase` com operacoes `select, eq, maybeSingle`

- `diesel_tratativas`
  - `src/components/desempenho/ModalCheckpointAnalise.jsx:389` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/components/desempenho/ModalCheckpointAnalise.jsx:414` via `supabase` com operacoes `update, eq`
  - `src/components/desempenho/ModalCheckpointAnalise.jsx:434` via `supabase` com operacoes `insert`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx:160` via `supabase` com operacoes `select, eq`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx:267` via `supabase` com operacoes `select, insert, single`
  - `src/pages/desempenho-diesel/Desempenho_Diesel_Tratativas_Central.jsx:133` via `supabase` com operacoes `select`
  - `src/pages/desempenho-diesel/Desempenho_Diesel_Tratativas_Central.jsx:142` via `supabase` com operacoes `select`
  - `src/pages/desempenho-diesel/Desempenho_Diesel_Tratativas_Central.jsx:148` via `supabase` com operacoes `select`
  - `src/pages/desempenho-diesel/DieselConsultarTratativa.jsx:157` via `supabase` com operacoes `select, eq, single`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:245` via `supabase` com operacoes `select, eq, single`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:308` via `storage` com operacoes `unknown`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:313` via `storage` com operacoes `unknown`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:333` via `supabase` com operacoes `update, eq`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:376` via `supabase` com operacoes `delete, eq`

- `diesel_tratativas_detalhes`
  - `src/components/desempenho/ModalCheckpointAnalise.jsx:472` via `supabase` com operacoes `insert`
  - `src/pages/desempenho-diesel/DesempenhoLancamento.jsx:278` via `supabase` com operacoes `insert`
  - `src/pages/desempenho-diesel/DieselConsultarTratativa.jsx:166` via `supabase` com operacoes `select, eq`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:273` via `supabase` com operacoes `select, eq`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:322` via `supabase` com operacoes `insert`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:369` via `supabase` com operacoes `delete, eq`

- `embarcados`
  - `src/pages/embarcados/EmbarcadosCentral.jsx:496` via `supabase` com operacoes `update, eq`
  - `src/pages/embarcados/EmbarcadosCentral.jsx:513` via `supabase` com operacoes `insert`
  - `src/pages/embarcados/EmbarcadosEnvioManutencao.jsx:89` via `supabase` com operacoes `select, eq`
  - `src/pages/embarcados/EmbarcadosEnvioManutencao.jsx:334` via `supabase` com operacoes `update, eq`
  - `src/pages/embarcados/EmbarcadosEnvioManutencao.jsx:419` via `supabase` com operacoes `update, eq`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:80` via `supabase` com operacoes `select, eq, in`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:86` via `supabase` com operacoes `select, eq`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:106` via `supabase` com operacoes `select, eq`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:180` via `supabase` com operacoes `select, eq, in`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:256` via `supabase` com operacoes `update, eq`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:296` via `supabase` com operacoes `select, eq`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:359` via `supabase` com operacoes `update, eq`

- `embarcados_envios_manutencao`
  - `src/pages/embarcados/EmbarcadosEnvioManutencao.jsx:95` via `supabase` com operacoes `select`
  - `src/pages/embarcados/EmbarcadosEnvioManutencao.jsx:99` via `supabase` com operacoes `select`
  - `src/pages/embarcados/EmbarcadosEnvioManutencao.jsx:321` via `supabase` com operacoes `select, insert, single`
  - `src/pages/embarcados/EmbarcadosEnvioManutencao.jsx:380` via `supabase` com operacoes `update, eq`

- `embarcados_instalacoes`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:236` via `supabase` com operacoes `update, eq`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:246` via `supabase` com operacoes `insert`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:337` via `supabase` com operacoes `update, eq`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:348` via `supabase` com operacoes `insert`

- `embarcados_movimentacoes`
  - `src/pages/embarcados/EmbarcadosCentral.jsx:411` via `supabase` com operacoes `select, in`
  - `src/pages/embarcados/EmbarcadosEnvioManutencao.jsx:345` via `supabase` com operacoes `insert`
  - `src/pages/embarcados/EmbarcadosEnvioManutencao.jsx:430` via `supabase` com operacoes `insert`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:191` via `supabase` com operacoes `select`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:222` via `supabase` com operacoes `insert`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:323` via `supabase` com operacoes `insert`

- `embarcados_solicitacoes_reparo`
  - `src/components/embarcados/ReparoSolicitacaoDetalhes.jsx:266` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/components/embarcados/ReparoSolicitacaoDetalhes.jsx:384` via `supabase` com operacoes `update, eq`
  - `src/components/embarcados/ReparoSolicitacaoDetalhes.jsx:428` via `supabase` com operacoes `update, eq`
  - `src/components/embarcados/ReparoSolicitacaoExecucao.jsx:141` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/components/embarcados/ReparoSolicitacaoExecucao.jsx:349` via `supabase` com operacoes `update, eq`
  - `src/components/embarcados/ReparoSolicitacaoNovaModal.jsx:406` via `supabase` com operacoes `select, insert, single`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:186` via `supabase` com operacoes `select, eq, in`
  - `src/pages/embarcados/EmbarcadosReparos.jsx:111` via `supabase` com operacoes `select`

- `embarcados_solicitacoes_reparo_eventos`
  - `src/components/embarcados/ReparoSolicitacaoDetalhes.jsx:356` via `supabase` com operacoes `insert`
  - `src/components/embarcados/ReparoSolicitacaoExecucao.jsx:315` via `supabase` com operacoes `insert`
  - `src/components/embarcados/ReparoSolicitacaoNovaModal.jsx:249` via `supabase` com operacoes `insert`

- `embarcados_veiculos`
  - `src/pages/embarcados/Embarcados.jsx:530` via `supabase` com operacoes `select, eq`
  - `src/pages/embarcados/Embarcados.jsx:586` via `supabase` com operacoes `update, eq`
  - `src/pages/embarcados/Embarcados.jsx:597` via `supabase` com operacoes `insert`

- `estrutura_fisica`
  - `src/pages/estrutura-fisica/EstruturaFisicaSolicitacao.jsx:225` via `storage` com operacoes `unknown`
  - `src/pages/estrutura-fisica/EstruturaFisicaSolicitacao.jsx:232` via `storage` com operacoes `unknown`
  - `src/pages/estrutura-fisica/EstruturaFisicaTratar.jsx:179` via `storage` com operacoes `unknown`
  - `src/pages/estrutura-fisica/EstruturaFisicaTratar.jsx:186` via `storage` com operacoes `unknown`

- `estrutura_fisica_historico`
  - `src/pages/estrutura-fisica/EstruturaFisicaConsultar.jsx:116` via `supabase` com operacoes `select, eq`
  - `src/pages/estrutura-fisica/EstruturaFisicaTratar.jsx:198` via `supabase` com operacoes `insert`

- `estrutura_fisica_solicitacoes`
  - `src/pages/estrutura-fisica/EstruturaFisicaConsultar.jsx:107` via `supabase` com operacoes `select, eq, single`
  - `src/pages/estrutura-fisica/EstruturaFisicaSolicitacao.jsx:97` via `supabase` com operacoes `select, maybeSingle`
  - `src/pages/estrutura-fisica/EstruturaFisicaSolicitacao.jsx:190` via `supabase` com operacoes `insert`
  - `src/pages/estrutura-fisica/EstruturaFisicaSolicitacao.jsx:239` via `supabase` com operacoes `update, eq`
  - `src/pages/estrutura-fisica/EstruturaFisicaTratar.jsx:56` via `supabase` com operacoes `select, eq, single`
  - `src/pages/estrutura-fisica/EstruturaFisicaTratar.jsx:227` via `supabase` com operacoes `update`
  - `src/pages/estrutura-fisica/EstruturaFisicaTratar.jsx:277` via `supabase` com operacoes `update`
  - `src/pages/estrutura-fisica/EstruturaFisicaTratar.jsx:331` via `supabase` com operacoes `update`

- `funcionarios`
  - `src/pages/desempenho-diesel/DesempenhoDieselResumo.jsx:318` via `supabaseA` com operacoes `select`

- `km_rodado_diario`
  - `src/pages/intervencoes/KMRodado.jsx:38` via `supabase` com operacoes `select`
  - `src/pages/intervencoes/KMRodado.jsx:91` via `supabase` com operacoes `upsert`
  - `src/pages/intervencoes/KMRodado.jsx:113` via `supabase` com operacoes `delete, eq`
  - `src/pages/intervencoes/SOSDashboard.jsx:219` via `supabase` com operacoes `select`

- `linhas`
  - `src/pages/desempenho-diesel/DesempenhoDieselTratativas.jsx:136` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:254` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SolicitacaoSOS.jsx:60` via `supabase` com operacoes `select`
  - `src/pages/tratativas/ConsultarTratativa.jsx:160` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/tratativas/SolicitacaoTratativa.jsx:83` via `supabase` com operacoes `select`
  - `src/pages/tratativas/TratarTratativa.jsx:392` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/tratativas/TratarTratativa.jsx:435` via `supabase` com operacoes `select, eq, maybeSingle`

- `motoristas`
  - `src/components/CampoMotorista.jsx:22` via `supabase` com operacoes `select`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:263` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOSTratamento.jsx:170` via `supabase` com operacoes `select`
  - `src/pages/tratativas/TratarTratativa.jsx:403` via `supabase` com operacoes `select, eq, maybeSingle`

- `pcm_diario`
  - `src/pages/pcm/PCMDiario.jsx:344` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/pcm/PCMInicio.jsx:147` via `supabase` com operacoes `select`
  - `src/pages/pcm/PCMInicio.jsx:160` via `supabase` com operacoes `select, eq, single`
  - `src/pages/pcm/PCMInicio.jsx:223` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/pcm/PCMInicio.jsx:239` via `supabase` com operacoes `select, insert, single`
  - `src/pages/pcm/PCMResumo.jsx:474` via `supabase` com operacoes `select`
  - `src/pages/pcm/PCMResumo.jsx:494` via `supabase` com operacoes `select, in`
  - `src/pages/pcm/PCMResumo.jsx:520` via `supabase` com operacoes `select`

- `prefixos`
  - `src/components/CampoPrefixo.jsx:22` via `supabase` com operacoes `select`
  - `src/components/embarcados/ReparoSolicitacaoNovaModal.jsx:174` via `supabase` com operacoes `select`
  - `src/pages/embarcados/Embarcados.jsx:507` via `supabase` com operacoes `select`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:79` via `supabase` com operacoes `select, eq, in`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:105` via `supabase` com operacoes `select, eq`
  - `src/pages/intervencoes/SOSFechamento.jsx:161` via `supabase` com operacoes `select`
  - `src/pages/intervencoes/SolicitacaoSOS.jsx:67` via `supabase` com operacoes `select`
  - `src/pages/pcm/PCMDiario.jsx:346` via `supabase` com operacoes `select`
  - `src/pages/pcm/PCM_Preventivas.jsx:51` via `supabase` com operacoes `select`

- `premiacao_diaria`
  - `src/routes/premiacaoRoutes.js:32` via `sb` com operacoes `select, eq`

- `premiacao_diaria_atualizada`
  - `src/pages/desempenho-diesel/DesempenhoDieselResumo.jsx:289` via `supabaseA` com operacoes `select`

- `preventivas`
  - `src/pages/intervencoes/SOSCentral.jsx:208` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOSCentral.jsx:217` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOSCentral.jsx:240` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOSCentral.jsx:249` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOSTratamento.jsx:303` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOSTratamento.jsx:312` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOS_Resumo.jsx:503` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOS_Resumo.jsx:507` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOS_Resumo.jsx:519` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOS_Resumo.jsx:520` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/pcm/PCM_Preventivas.jsx:57` via `supabase` com operacoes `select`
  - `src/pages/pcm/PCM_Preventivas.jsx:144` via `supabase` com operacoes `insert`

- `profiles`
  - `src/AuthContext.jsx:16` via `supabase` com operacoes `select, eq, single`
  - `src/pages/auth/Cadastro.jsx:55` via `supabase` com operacoes `update, eq`

- `relatorios_gerados`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:834` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:964` via `supabase` com operacoes `select, insert, single`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx:194` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx:360` via `supabase` com operacoes `select, insert, single`

- `setores`
  - `src/pages/estrutura-fisica/EstruturaFisicaCentral.jsx:94` via `supabase` com operacoes `select`
  - `src/pages/estrutura-fisica/EstruturaFisicaSolicitacao.jsx:82` via `supabase` com operacoes `select`
  - `src/pages/tratativas/CentralTratativas.jsx:137` via `supabase` com operacoes `select`
  - `src/pages/tratativas/SolicitacaoTratativa.jsx:82` via `supabase` com operacoes `select`

- `sos_acionamentos`
  - `src/pages/intervencoes/SOSCentral.jsx:284` via `supabase` com operacoes `update, eq`
  - `src/pages/intervencoes/SOSCentral.jsx:593` via `supabase` com operacoes `select`
  - `src/pages/intervencoes/SOSDashboard.jsx:105` via `supabase` com operacoes `select`
  - `src/pages/intervencoes/SOSDashboard.jsx:211` via `supabase` com operacoes `select`
  - `src/pages/intervencoes/SOSDashboard.jsx:240` via `supabase` com operacoes `select, eq`
  - `src/pages/intervencoes/SOSFechamento.jsx:47` via `supabase` com operacoes `select, eq`
  - `src/pages/intervencoes/SOSFechamento.jsx:175` via `supabase` com operacoes `update, eq`
  - `src/pages/intervencoes/SOSTratamento.jsx:38` via `supabase` com operacoes `select, eq`
  - `src/pages/intervencoes/SOSTratamento.jsx:482` via `supabase` com operacoes `update, eq`
  - `src/pages/intervencoes/SOS_Resumo.jsx:548` via `supabase` com operacoes `update, eq`
  - `src/pages/intervencoes/SOS_Resumo.jsx:737` via `supabase` com operacoes `select`
  - `src/pages/intervencoes/SolicitacaoSOS.jsx:77` via `supabase` com operacoes `select, single`
  - `src/pages/intervencoes/SolicitacaoSOS.jsx:120` via `supabase` com operacoes `insert`

- `sos_manutencao_catalogo`
  - `src/pages/intervencoes/SOSTratamento.jsx:288` via `supabase` com operacoes `select`

- `tabelas_operacionais`
  - `src/pages/intervencoes/SolicitacaoSOS.jsx:64` via `supabase` com operacoes `select`

- `tipos_ocorrencia`
  - `src/pages/tratativas/SolicitacaoTratativa.jsx:81` via `supabase` com operacoes `select`

- `tratativas`
  - `src/pages/home/Dashboard.jsx:82` via `supabase` com operacoes `select`
  - `src/pages/home/Dashboard.jsx:87` via `supabase` com operacoes `select`
  - `src/pages/home/Dashboard.jsx:95` via `supabase` com operacoes `select`
  - `src/pages/home/Dashboard.jsx:106` via `supabase` com operacoes `select`
  - `src/pages/home/Dashboard.jsx:164` via `supabase` com operacoes `select`
  - `src/pages/home/Dashboard.jsx:203` via `supabase` com operacoes `select`
  - `src/pages/tratativas/CentralTratativas.jsx:151` via `supabase` com operacoes `select`
  - `src/pages/tratativas/CentralTratativas.jsx:171` via `supabase` com operacoes `select`
  - `src/pages/tratativas/CentralTratativas.jsx:180` via `supabase` com operacoes `select`
  - `src/pages/tratativas/CentralTratativas.jsx:186` via `supabase` com operacoes `select`
  - `src/pages/tratativas/ConsultarTratativa.jsx:129` via `supabase` com operacoes `select, eq, single`
  - `src/pages/tratativas/SolicitacaoTratativa.jsx:214` via `storage` com operacoes `unknown`
  - `src/pages/tratativas/SolicitacaoTratativa.jsx:220` via `storage` com operacoes `unknown`
  - `src/pages/tratativas/SolicitacaoTratativa.jsx:250` via `supabase` com operacoes `insert`
  - `src/pages/tratativas/TratarTratativa.jsx:370` via `supabase` com operacoes `select, eq, single`
  - `src/pages/tratativas/TratarTratativa.jsx:419` via `supabase` com operacoes `update, eq`
  - `src/pages/tratativas/TratarTratativa.jsx:457` via `storage` com operacoes `unknown`
  - `src/pages/tratativas/TratarTratativa.jsx:462` via `storage` com operacoes `unknown`
  - `src/pages/tratativas/TratarTratativa.jsx:501` via `supabase` com operacoes `update, eq`
  - `src/pages/tratativas/TratativasLancarRH.jsx:57` via `storage` com operacoes `unknown`
  - `src/pages/tratativas/TratativasLancarRH.jsx:63` via `storage` com operacoes `unknown`
  - `src/pages/tratativas/TratativasResumo.jsx:156` via `supabase` com operacoes `select`
  - `src/pages/tratativas/TratativasResumo.jsx:205` via `supabase` com operacoes `select`

- `tratativas_detalhes`
  - `src/pages/tratativas/ConsultarTratativa.jsx:138` via `supabase` com operacoes `select, eq`
  - `src/pages/tratativas/TratarTratativa.jsx:488` via `supabase` com operacoes `insert`
  - `src/pages/tratativas/TratativasRH.jsx:120` via `supabase` com operacoes `select`
  - `src/pages/tratativas/TratativasResumo.jsx:252` via `supabase` com operacoes `select, in`

- `tratativas_rh`
  - `src/pages/tratativas/TratativasLancarRH.jsx:267` via `supabase` com operacoes `upsert`
  - `src/pages/tratativas/TratativasRH.jsx:143` via `supabase` com operacoes `select, in`

- `usuarios_aprovadores`
  - `src/components/embarcados/ReparoSolicitacaoDetalhes.jsx:238` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/components/embarcados/ReparoSolicitacaoDetalhes.jsx:307` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/components/embarcados/ReparoSolicitacaoExecucao.jsx:111` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/components/embarcados/ReparoSolicitacaoNovaModal.jsx:123` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/auth/Login.jsx:179` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/auth/Login.jsx:256` via `supabase` com operacoes `select, maybeSingle`
  - `src/pages/auth/Login.jsx:272` via `supabase` com operacoes `insert`
  - `src/pages/auth/Register.jsx:26` via `supabase` com operacoes `insert`
  - `src/pages/avarias/AprovacaoAvarias.jsx:18` via `supabase` com operacoes `select, eq, single`
  - `src/pages/avarias/AvariasEmRevisao.jsx:21` via `supabase` com operacoes `select, eq, single`
  - `src/pages/avarias/CobrancasAvarias.jsx:64` via `supabase` com operacoes `select, maybeSingle`
  - `src/pages/configuracoes/Usuarios.jsx:14` via `supabase` com operacoes `select`
  - `src/pages/configuracoes/Usuarios.jsx:34` via `supabase` com operacoes `update, eq`
  - `src/pages/configuracoes/Usuarios.jsx:51` via `supabase` com operacoes `update, eq`
  - `src/pages/desempenho-diesel/DesempenhoDieselAcompanhamento.jsx:204` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/home/Landing.jsx:26` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/home/Landing.jsx:35` via `supabase` com operacoes `select, eq, maybeSingle`
  - `src/pages/intervencoes/SOSCentral.jsx:134` via `supabase` com operacoes `select, eq, single`
  - `src/pages/intervencoes/SOS_Resumo.jsx:448` via `supabase` com operacoes `select, eq, single`
  - `src/pages/portal/PortalSistemas.jsx:33` via `supabase` com operacoes `select, eq, single`
  - `src/pages/tratativas/SolicitacaoTratativa.jsx:178` via `supabase` com operacoes `select, eq, maybeSingle`

- `v_diesel_acompanhamentos_ciclo`
  - `src/pages/desempenho-diesel/DesempenhoDieselAcompanhamento.jsx:230` via `supabase` com operacoes `select`

- `v_embarcados_central`
  - `src/pages/embarcados/EmbarcadosCentral.jsx:407` via `supabase` com operacoes `select, in`

- `v_estrutura_fisica_central`
  - `src/pages/estrutura-fisica/EstruturaFisicaCentral.jsx:108` via `supabase` com operacoes `select`
  - `src/pages/estrutura-fisica/EstruturaFisicaCentral.jsx:123` via `supabase` com operacoes `select`

- `v_sugestoes_acompanhamento_30d`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:855` via `supabase` com operacoes `select`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx:215` via `supabase` com operacoes `select`

- `veiculos_pcm`
  - `src/pages/pcm/PCMDiario.jsx:345` via `supabase` com operacoes `select, eq`
  - `src/pages/pcm/PCMDiario.jsx:388` via `supabase` com operacoes `select, eq`
  - `src/pages/pcm/PCMDiario.jsx:394` via `supabase` com operacoes `select, insert, single`
  - `src/pages/pcm/PCMDiario.jsx:407` via `supabase` com operacoes `update, eq`
  - `src/pages/pcm/PCMDiario.jsx:419` via `supabase` com operacoes `select, eq`
  - `src/pages/pcm/PCMDiario.jsx:427` via `supabase` com operacoes `update, eq`
  - `src/pages/pcm/PCMInicio.jsx:168` via `supabase` com operacoes `select, eq`
  - `src/pages/pcm/PCMInicio.jsx:199` via `supabase` com operacoes `select, eq`
  - `src/pages/pcm/PCMInicio.jsx:212` via `supabase` com operacoes `insert`
  - `src/pages/pcm/PCMResumo.jsx:483` via `supabase` com operacoes `select, eq`
  - `src/pages/pcm/PCMResumo.jsx:528` via `supabase` com operacoes `select`
  - `src/pages/pcm/PCMResumo.jsx:529` via `supabase` com operacoes `select, in`
  - `src/pages/pcm/PCMResumo.jsx:530` via `supabase` com operacoes `select`

- `veiculos_pcm_historico`
  - `src/pages/pcm/PCMDiario.jsx:374` via `supabase` com operacoes `insert`

### Buckets

- `avarias`
  - `src/pages/avarias/LancarAvaria.jsx:131` via `supabase` com operacoes `upload`
  - `src/pages/avarias/LancarAvaria.jsx:137` via `supabase` com operacoes `getPublicUrl`

- `diesel_tratativas`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:308` via `supabase` com operacoes `upload`
  - `src/pages/desempenho-diesel/DieselTratarTratativa.jsx:313` via `supabase` com operacoes `getPublicUrl`

- `estrutura_fisica`
  - `src/pages/estrutura-fisica/EstruturaFisicaSolicitacao.jsx:225` via `supabase` com operacoes `upload`
  - `src/pages/estrutura-fisica/EstruturaFisicaSolicitacao.jsx:232` via `supabase` com operacoes `getPublicUrl`
  - `src/pages/estrutura-fisica/EstruturaFisicaTratar.jsx:179` via `supabase` com operacoes `upload`
  - `src/pages/estrutura-fisica/EstruturaFisicaTratar.jsx:186` via `supabase` com operacoes `getPublicUrl`

- `tratativas`
  - `src/pages/tratativas/SolicitacaoTratativa.jsx:214` via `supabase` com operacoes `upload`
  - `src/pages/tratativas/SolicitacaoTratativa.jsx:220` via `supabase` com operacoes `getPublicUrl`
  - `src/pages/tratativas/TratarTratativa.jsx:457` via `supabase` com operacoes `upload`
  - `src/pages/tratativas/TratarTratativa.jsx:462` via `supabase` com operacoes `getPublicUrl`
  - `src/pages/tratativas/TratativasLancarRH.jsx:57` via `supabase` com operacoes `upload`
  - `src/pages/tratativas/TratativasLancarRH.jsx:63` via `supabase` com operacoes `getPublicUrl`

### Buckets via URL publica

- `${BUCKET_NAME}`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx:53` via `url_literal` com operacoes `public_url`

- `${bucket}`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:86` via `url_literal` com operacoes `public_url`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:89` via `url_literal` com operacoes `public_url`

- `parcial_meritocracia`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:131` via `url_literal` com operacoes `public_url`

### RPCs

- `resolve_auth_account`
  - `src/utils/authBridge.js:23` via `supabase` com operacoes `unknown`

- `sync_profile_after_review`
  - `src/pages/auth/AtualizarPerfil.jsx:55` via `supabase` com operacoes `unknown`

### Auth

- `getSession`
  - `src/AuthContext.jsx:30` via `supabase` com operacoes `getSession`
  - `src/pages/auth/AtualizarSenha.jsx:36` via `supabase` com operacoes `getSession`
  - `src/pages/desempenho-diesel/DesempenhoDieselAgente.jsx:830` via `supabase` com operacoes `getSession`
  - `src/pages/desempenho-diesel/DesempenhoDieselAnalise.jsx:190` via `supabase` com operacoes `getSession`
  - `src/pages/embarcados/EmbarcadosMovimentacoes.jsx:72` via `supabase` com operacoes `getSession`

- `getUser`
  - `src/pages/avarias/CobrancasAvarias.jsx:56` via `supabase` com operacoes `getUser`
  - `src/pages/home/Landing.jsx:14` via `supabase` com operacoes `getUser`

- `onAuthStateChange`
  - `src/AuthContext.jsx:53` via `supabase` com operacoes `onAuthStateChange`
  - `src/pages/auth/AtualizarSenha.jsx:47` via `supabase` com operacoes `onAuthStateChange`
  - `src/pages/avarias/CobrancasAvarias.jsx:82` via `supabase` com operacoes `onAuthStateChange`

- `signOut`
  - `src/AuthContext.jsx:68` via `supabase` com operacoes `signOut`
  - `src/pages/auth/AtualizarSenha.jsx:94` via `supabase` com operacoes `signOut`

- `signUp`
  - `src/pages/auth/Cadastro.jsx:40` via `supabase` com operacoes `signUp`

- `updateUser`
  - `src/pages/auth/AtualizarSenha.jsx:86` via `supabase` com operacoes `updateUser`

### Realtime/Channels

- `realtime-sos_acionamentos-dashboard`
  - `src/pages/intervencoes/SOSDashboard.jsx:320` via `supabase` com operacoes `channel`
