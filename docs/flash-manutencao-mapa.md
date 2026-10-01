# Flash Report Manutenção interativo — mapa do HTML

Onde fica cada parte do Flash interativo (HTML), de onde vêm os dados e como cada bloco
se encaixa no **PCM › Resumo** do INOVE (`src/pages/pcm/PCMResumo.jsx`).

> Linhas conferidas no commit `f71f394` da branch `feat/flash-manutencao-interativo`
> (01/10/2026). Se o arquivo mudar, procure pelo nome da função: os nomes são estáveis.

---

## 1. Arquivos

| Arquivo | O que faz | Linhas |
|---|---|---|
| `flash-report-manutencao/flash_dinamico_template.html` | A página inteira: CSS, esqueleto, toda a lógica JS de cada seção. O Python só injeta os dados no lugar de `/*__DADOS__*/null` | 1019 |
| `flash-report-manutencao/gen_flash_html.py` | Busca intervenções, KM, planos e preventivas; monta o objeto `D` e grava o HTML | 239 |
| `flash-report-manutencao/extras_loaders.py` | Busca regeneração, pneus, SR, GNS/PCM, embarcados, preventivas realizadas e entradas da oficina | 246 |
| `flash-report-manutencao/publicar_flash_html.py` | Gera e publica no storage (`relatorios/manutencao/flash_interativo/`) | 61 |
| `flash-report-manutencao/rodar_flash_html.py` | Runner local (rotina do Claude) + `resumo()` usado no `meta.json` | 125 |
| `flash-report-manutencao/gen_flash_manutencao.py` | Gerador do PDF. O HTML **reaproveita as regras dele** (MKBF, tipo de ocorrência, cluster, embarcados, planos vencidos, feriados) | — |
| `src/pages/intervencoes/FlashManutencao.jsx` | Página do INOVE que mostra o HTML (`/sos-flash` e `/pcm-flash`) | 135 |
| `.github/workflows/bot-flash-manutencao-interativo.yml` | Bot 06h30 e 12h30 BRT que gera e publica | — |

Fluxo: **Supabase → `gen_flash_html.main()` → objeto `D` (JSON) → embutido no template → `atual.html` no storage → iframe no INOVE.**

---

## 2. Esqueleto da página (`flash_dinamico_template.html`)

| Parte | Linhas | Observação |
|---|---|---|
| CSS (tema teal, claro/escuro, mobile) | 7–179 | Tokens em `:root` (cores da marca: `--teal #0d9488`, `--head #0f3d38`) |
| Menu lateral `nav#nav` | 183 | Botões criados em JS a partir de `SECS` |
| Cabeçalho `header.top` | 185 | Título muda com a seção |
| Barra de filtros `.filters` | 190 | Mês (`#fMes`), cluster (`#fCl`), "só válidas" (`#fVal`), abrir carro (`#fBusca`) |
| Área da seção `main#view` | 196 | Cada seção escreve aqui |
| Painel lateral (drawer) `aside#dr` | 201 | Onde abrem todas as listas e o prontuário |
| Script | 207–1019 | Tudo abaixo |

### 2.1 Base do script

| Bloco | Linhas | Conteúdo |
|---|---|---|
| Utilidades | 209–234 | Formatação pt-BR (`fInt`, `f1`, `fR`, `fData`), meses, `addM`, `diffD`, `cnt` (contagem/ranking), `clusterDe` (2216→C8, 2222→C9, 2224→C10, 2425→C11, W→C6) |
| Dados (arrays normalizados) | 236–260 | Ver §3. Também `horasFech`/`mediaFech`/`fH` (tempo de fechamento, 258–260) |
| Estado e filtros | 262–275 | `S` (mês, cluster, válidas, seção); `mesesSel`, `trimestre`, `semestre`, `baseI` (base de intervenções filtrada), `kmPeriodo`, `mkbf`, `kmCarro` |
| Componentes | 277–331 | `hbars` (282, ranking de barras clicável), `vbars` (289, colunas + linha opcional + meta), `kpi`/`card`/`cons` (311–313), `tabela` (317), `ligarTab` (324, liga clique em carro/linha/"mostrar todos") |
| Colunas padrão das listas | 332–346 | `COL_I`/`DET_I` intervenções, `COL_REG` regeneração, `COL_TR` pneus, `COL_SR`, `COL_G` (PCM), `COL_E` (embarcados), `COL_P` (planos), `COL_PR` (preventivas) |
| Drawer | 348–382 | `abrirDrawer`, `fecharDrawer`, pilha com "voltar"; `abrirLista` (359, lista de intervenções com escopo mês/janela) e `abrirTabela` (376, lista genérica com KPIs) |
| Prontuário do carro | 383–423 | `abrirCarro(car)`: KPIs + abas Intervenções, Oficina, Preventivas, Regeneração, SR, GNS/PCM, Pneus, Embarcados |
| CSV | 424–432 | `baixarCsv` (protegido para sandbox) |
| Lista de seções `SECS` | 434 | Ordem e rótulo do menu |
| Navegação | 992–1019 | `RENDER` (mapa id → função), `go`, `renderSec`, filtros |

---

## 3. Dados: de onde vem cada coisa

| Chave em `D` | Array JS (linha) | Loader Python | Fonte Supabase |
|---|---|---|---|
| `interv` | `I` (237) | `gen_flash_html.carregar_intervencoes` (84) | **B** `sos_acionamentos` — inclui revisão vinculada (`dp`, `di`, `rr`, `rt`, `rd`, `rk`) e `fe` (encerramento) |
| `km_dia_cl`, `km_mes_v` | `KMD`, `KMV` (238–239) | `gen_flash_html.carregar_km` (157) | **A** `indicadores_diesel` (`km_transnet`, `combustivel_transnet`) |
| `planos` | `PLANOS` (241) | `gen_flash_html.carregar_planos` (180) | **A** `ultimo_plano` (regra `_plano_vencido` do PDF, sem Concessionária) |
| `regen` | `REG` (242) | `extras_loaders.carregar_regeneracao` (44) | **A** `eventos_regeneracao` |
| `borr.trocas`/`pneus`/`ctrl` | `TROCAS`, `PNEUS`, `CTRL` (243–245) | `extras_loaders.carregar_borracharia` (55) | **B** `pcm_troca_pneus`, `pcm_pneus_transnet_ativos`, `vw_pcm_controle_pneus_central` |
| `sr` | `SR` (246) | `extras_loaders.carregar_sr` (80) | **A** `solicitacao_reparo` (ano + todas as não atendidas) |
| `gns.regs`/`gns.dias` | `GREG`, `GDIAS` (247–248) | `extras_loaders.carregar_gns` (108) | **B** `pcm_diario` + `veiculos_pcm` em aberto por sessão (foto diária) |
| `emb_sr` | `EMB` (249) | `extras_loaders.carregar_embarcados_sr` (152) | **B** `embarcados_solicitacoes_reparo` |
| `prev_real` | `PREV`, `PREVMAP` (250–251) | `extras_loaders.carregar_preventivas_realizadas` (163) | **B** `preventivas` + **A** OS de Revisão Pesada / Inspeção 5.000 do `ultimo_plano` |
| `pcm_ent` | `PCM`, `PCMD` (254–255) | `extras_loaders.carregar_pcm_entradas` (193) | **B** `veiculos_pcm` — **1 linha por entrada física** (colapsa as cópias da virada diária) |
| `prev_func` | `PFUNC` (256) | `gen_flash_html.carregar_preventivas_inove` (66) | **B** `preventivas` (mecânico, eletricista, funilaria, borracharia) |

**A** = Supabase TransNet / IMPORTAÇÃO_DADOS (`ubppprgquekozluvsloo`) · **B** = INOVEQUATAI (`wboelthngddvkgrvwkbu`, o mesmo do app).

---

## 4. Seções

Cada seção é uma função JS que escreve em `#view`. **Id** = âncora (`#s12o`), **Função** = onde está o código.
Nos blocos: `#id` é o elemento clicável ou o container do gráfico/tabela.

### Resumo (capa) — `s00` · `secCapa` (449–491)
- KPIs grandes: MKBF `#c1` → abre seção 01; Aderência preventiva `#c2` → 11; GNS médio `#c3` → 12; Intervenções `#c4` → lista.
- Grade de cartões (um por seção) com o número-chave de cada uma; clique navega.
- Cálculo agregado: `calcResumo` (443).

### 01 · Intervenções — Mês / MKBF — `s01` · `sec01` (494–524)
- Comparativo mês × anterior (intervenções `#r1`, KM, MKBF, meta), aderência à meta, status.
- KPIs: Intervenções `#k1`, KM, MKBF `#k3`, **Tempo médio de fechamento `#k4`**, **Controláveis `#k5`**.
- Tipo de ocorrência (cada número abre a lista) · Evolução histórica do MKBF `#ch1` (clique troca o mês).
- Regra MKBF: KM ÷ intervenções válidas, só dias com KM consolidado (`mkbf`, 274).

### 02 · Dia e projeções — `s02` · `sec02` (526–554)
- Tabela de projeções (média/dia, meta = KM ÷ 7.000, desvio, projeção de fim de mês).
- Dias úteis `#u1` × fim de semana `#u2` · Evolução diária `#ch2` (barras + MKBF do dia) · por dia da semana `#dw` · mapa dia × hora `#hm` (`heatmap`, 555).

### 03 · Linha, horário e cluster — `s03` · `sec03` (565–587) — trimestre
- Linhas `#tl` (mês anterior, mês, variação, trimestre) · carros `#tc` · faixa horária `#ch3` · cluster (3 meses + MKBF) · MKBF por cluster em 6 meses (mapa de calor) · dia × hora.

### 04 · Raio-X de defeitos — `s04` · `sec04` (589–607) — trimestre
- KPIs `#x1`–`#x4` (total, defeito, setor, veículo nº 1) · defeitos `#b1`, setor `#b2`, grupo `#b3` · top 5 linhas · carros ofensores detalhados.

### 05 · Defeitos — evolução mensal — `s05` · `sec05` (610–630) — 6 meses
- KPIs `#e1`–`#e4` (mês, nº 1, maior alta, maior queda) · matriz defeito × mês (cada célula abre a lista; `#mais5` mostra todos).
- Tendência = ritmo do mês reprojetado em 30 dias × média dos meses anteriores.

### 06 · Reincidência (≤ 30 dias) — `s05r` · `secReinc` (886–909) · cálculo `reinc30` (875)
- Regras do `SOS_Resumo`: mesmo carro com nova intervenção em ≤ 30 dias; técnica = mesmo defeito; setorial = mesmo setor.
- KPIs `#ri1`–`#ri6` · taxa por mês `#chr` · linhas `#rl` · defeitos `#rd` · setores `#rs` · detalhe por veículo `#rv`.

### 07 · Regeneração do DPF — `s06` · `sec06` (632–658)
- KPIs eventos `#g1`, custo `#g2`, duração, pior veículo `#g4`, impacto no KM/L · aviso de mês parcial com projeção.
- Top veículos `#tv` · custo por mês `#ch6` · por dia da semana `#rw` · faixas de duração `#rd`.

### 08 · Borracharia — pneus — `s07` · `sec07` (660–688)
- KPIs trocas `#p1`, estoque `#p2`, corretos, divergentes `#p4` · trocas por mês `#ch7` · tipo de troca `#tt` · teste de KM dos pneus novos `#tk` · divergentes `#td` · carros `#tcar` · posições `#tpos`.

### 09 · Intervenções por motorista — `s08` · `sec08` (690–711)
- KPIs `#m1`–`#m3` · procedentes `#mp` · improcedentes do ano `#mi` · improcedentes por mês `#ch8` · **motoristas por volume** `#mv`.

### 10 · Solicitação de reparo — aderência — `s09` · `sec09` (719–738)
- KPIs `#q1`–`#q4` (aderência por competência, SRs no mês, fila de hoje, mais antiga) · aderência mês a mês `#ch9` (meta 94%) · situação A/I/N × mês anterior · envelhecimento `#ch9b` · tabela `#tcomp`.
- Drill: `abrirSR` (716) — lista com grupo e carro.

### 11 · Solicitação de reparo por grupo — `s10` · `sec10` (740–760)
- Abertas por grupo `#ta` · aderência por grupo no trimestre `#tb` · carros com mais SR pendentes `#tcp` (5+ = prioridade).

### 12 · Controle de preventivas — `s11` · `sec11` (762–779)
- KPIs acuracidade, planos ativos `#v2`, em dia, vencidos `#v4` · vencidos por plano `#vp` · lista de vencidos `#vl` · realizadas por mês `#ch11` · realizadas por tipo `#vt`.

### 13 · Revisão × quebra · técnicos — `s11r` · `secRev` (923–947) · cálculo `tecnicos` (914)
- KPIs `#rv1`–`#rv4` (dias após preventiva/inspeção, quebra ≤ 15 dias da revisão, técnicos) · faixas após preventiva `#fp` e inspeção `#fi` · defeitos × tempo `#tdf` · avaliação de técnicos `#ttc`.
- Regras do `SOS_Resumo`: responsável = quem fez a última revisão (preventiva ou inspeção, a mais recente) na função do setor da quebra; ciclo válido inspeção ≤ 25 d / 6 mil km, preventiva ≤ 45 d / 12 mil km; retrabalho precoce ≤ 15 d ou ≤ 3 mil km.

### 14 · GNS — carros parados — `s12` · `sec12` (782–801) · cálculo `gnsMes` (781)
- KPIs GNS médio (dia útil), dias úteis, total parado `#n3`, mais antigo `#n4` · GNS por dia `#ch12` (clique abre a sessão do PCM) · GNS médio por mês `#ch12b` · parados mais antigos `#gp` · setor `#gs` · categoria `#gc`.

### 15 · Oficina · entradas no PCM — `s12o` · `secOficina` (950–982)
- KPIs entradas `#of1`, taxa de resolução `#of2`, entradas GNS e GNS/dia de PCM `#of3`, reentradas `#of4`, backlog hoje `#of5`.
- Aging dos GNS em aberto `#ag` · backlog por motivo `#bm` · turno `#tu` · defeitos `#od` · setor `#os` · categoria `#oc` · entradas GNS/dia mês a mês `#chO` · carros que voltaram `#ore`.

### 16 · Embarcados — câmeras e Vision — `s13` · `sec13` (803–821)
- KPIs `#b1`–`#b4` · solicitações por mês `#ch13` · tipo `#bt` · status `#bs` · críticas em aberto `#bc` · prioridade `#bp` · carros `#bv`.

### 17 · Embarcados na operação — `s14` · `sec14` (823–840)
- KPIs `#o1`–`#o4` · família × tipo de ocorrência (cada número abre) · evolução mensal `#ch14` · veículos `#ov` · problemas `#op`.

### 18 · Oportunidades de melhoria — `s15` · `sec15` (850–873) · cálculo `oportunidades` (842)
- Quebra repetida ≤ 7 dias `#op1` · quebra ≤ 15 dias pós-preventiva `#op2` · fila de SR `#op3` · carros `#orc` · defeitos repetidos `#ord` · defeitos pós-preventiva `#opd`.

### Base completa — `s16` · `sec16` (984–991)
- Busca livre `#tBusca`, tabela `#tbAll`, exportar CSV `#btnCsv`.

### Prontuário do carro — `abrirCarro` (384–423)
- Abre de qualquer carro clicado ou pela busca `#fBusca`. KPIs do carro + gráfico por mês + defeitos + abas.

---

## 5. Encaixe no PCM › Resumo do INOVE

O que o `PCMResumo.jsx` já mostra hoje e onde isso está no HTML:

| Bloco atual do PCM › Resumo | Linha no `PCMResumo.jsx` | Equivalente no HTML | Diferença |
|---|---|---|---|
| Dias com PCM | 764 | `s12o` subtítulo de `#of1` | igual |
| Total lançamentos | 765 | `s12o` `#of1` (Entradas) | **HTML conta cada entrada uma vez** (o Resumo soma as cópias da virada diária) |
| Taxa de resolução | 766 | `s12o` `#of2` | mesma regra, sobre entradas reais |
| Total GNS / % | 767 | `s12o` `#of3` | idem |
| Média GNS/dia | 768 | `s12o` `#of3` (GNS/dia de PCM) e `#chO` | **não confundir** com GNS médio parado (`s12`) |
| Reincidentes (reentradas) | 769 e tabela 851 | `s12o` `#of4` / `#ore` | igual (liberou e voltou) |
| Aging GNS | 192 / 777 | `s12o` `#ag` | igual (0-1, 2-3, 4-7, 8-15, 16+) |
| Raio-X do backlog (observação) | 783 | `s12o` `#bm` | igual |
| Termômetro de defeitos (descrição) | 805 | `s12o` `#od` | igual |
| Entradas por turno | 821 | `s12o` `#tu` | igual |
| Pareto setor / categoria | 902 | `s12o` `#os` / `#oc` | igual |
| Histórico de GNS (18 meses) | 931 | `s12o` `#chO` (janela do relatório) e `s12` `#ch12b` | HTML cobre a janela (jan → hoje) |
| Detalhe da frota (modal) | 317 | `abrirCarro` → aba **Oficina** | o prontuário junta oficina + intervenções + preventivas + SR + pneus |

O que o HTML acrescenta ao PCM › Resumo (não existe lá hoje):

| Bloco do HTML | Seção / função | Por que entra no PCM |
|---|---|---|
| GNS médio por dia útil (foto das sessões) e parados mais antigos | `s12` · `sec12` | é o indicador oficial do Flash; o Resumo só tem fluxo de entradas |
| Controle de preventivas (vencidos, acuracidade, realizadas) | `s11` · `sec11` | hoje fica na aba Resumo de Preventivas |
| Revisão × quebra · técnicos | `s11r` · `secRev` | mede a qualidade da revisão da oficina |
| Borracharia (trocas, estoque, divergências, KM dos novos) | `s07` · `sec07` | hoje fica na aba Resumo de Pneus |
| SR — aderência e por grupo | `s09`, `s10` | fila de reparo que a oficina precisa atender |
| Regeneração do DPF | `s06` · `sec06` | custo de manutenção do pós-tratamento |
| Embarcados — câmeras e Vision | `s13` · `sec13` | SRs de embarcados em aberto |
| Prontuário completo do carro | `abrirCarro` | uma tela por carro em vez de vários modais |

### Sugestão de ordem para o PCM › Resumo

1. Capa (`s00`) — só os cartões de PCM: GNS, Oficina, Preventivas, Revisão × quebra, Pneus, SR.
2. Oficina · entradas (`s12o`) — **substitui** os KPIs, aging, backlog, turno, pareto e reentradas atuais.
3. GNS — carros parados (`s12`) — **substitui** o Histórico de GNS.
4. Controle de preventivas (`s11`) e Revisão × quebra (`s11r`).
5. Borracharia (`s07`).
6. SR — aderência e por grupo (`s09`, `s10`).
7. Regeneração (`s06`) e Embarcados SR (`s13`).

As seções centradas em intervenção (`s01`–`s05`, `s05r`, `s08`, `s14`, `s15`) ficam no **Intervenções › Resumo**.

### Como levar um bloco para o INOVE

- **Do jeito mais rápido (já pronto):** abrir o Flash já numa seção. O iframe usa `srcDoc`, que não tem hash na URL. Então, no `FlashManutencao.jsx`, troque a linha 263 do HTML antes de passar para o `srcDoc`:
  `html.replace('let hash0="";try{hash0=location.hash}catch(e){}', 'let hash0="#s12o";')`
  Com isso o `/pcm-flash` abre direto em Oficina (`#s12o`), e o menu lateral continua navegando para as outras seções.
- **Reescrevendo em React:** a regra de cada bloco está na função indicada acima; as colunas das listas em 332–346; os dados vêm das mesmas tabelas da §3 (as do projeto **B** já são lidas pelo app; as do **A** usam `supabaseDados.js`).

---

## 6. Formato exato dos dados (`D`)

Os arrays são posicionais para o HTML ficar leve. **A ordem importa**: trocar uma posição quebra a seção sem dar erro.
Datas `AAAA-MM-DD`; data/hora `AAAA-MM-DD HH:MM` **já em horário de Brasília** (o loader converte de UTC com `_ts`).

| Chave | Formato |
|---|---|
| `interv[]` (objeto) | `id`, `n` nº SOS, `d` data, `h` hora `HH:MM`, `v` carro, `cl` cluster, `l` linha, `t` tipo normalizado (RECOLHEU, SOS, AVARIA, TROCA, IMPROCEDENTE, SEGUIU VIAGEM, SEM TIPO), `ok` vale p/ MKBF, `st` status, `se` setor, `gr` grupo, `p` defeito (grafia unificada), `rc` reclamação, `so` solução, `ct` controlabilidade, `mo` motorista, `lo` local, `cs` carro substituto, `sr` nº SR, `os` OS corretiva, `em` família de embarcado ou `""`, `fe` data de encerramento, `dp`/`di` dias desde preventiva/inspeção (`null` = sem revisão vinculada), `rt` `P`/`I` (qual revisão foi a última), `rr` técnico responsável, `fn` função (mecanico, eletricista, funilaria, borracharia), `rd` dias desde essa revisão, `rk` km desde essa revisão (`null` se faltar hodômetro) |
| `km_dia_cl[]` | `[data, cluster, km, litros]` |
| `km_mes_v[]` | `[AAAA-MM, carro, km, dias com km]` |
| `planos[]` | `[carro, plano, vencido, por_km, km_para_proxima, dias_vencido]` |
| `regen[]` | `[carro, motorista, início, duração_min, rpm_médio, litros, custo_R$]` |
| `borr.trocas[]` | `[data/hora, tipo_troca, carro, posição, fogo_retirado, fogo_colocado, observações, registrado_por, pneu_conserto]` |
| `borr.pneus[]` | `[nº fogo, vida, localização, km_rodada, marca, medida, posição, dot]` |
| `borr.ctrl[]` | `[carro, posição, fogo_base, fogo_auditado, status, data_auditoria, auditado_por]` |
| `borr.fisico` | estoque físico manual (`REPORT_BORRACHARIA_FISICO`) ou `null` |
| `sr[]` | `[nº SR, data, situação A/I/N, grupo (MAIÚSCULO), fechada_no_prazo, carro, descrição, aberta_por, data_fim]` |
| `gns.regs[]` | `[carro, categoria, setor, descrição, observação, data_entrada, previsão]` |
| `gns.dias[]` | `{d: data da sessão, u: dia útil?, c: [índices em gns.regs]}` |
| `emb_sr[]` | `[carro, tipo, problema, descrição, local, PRIORIDADE, STATUS, solicitante, executado_por, criado_em, fechado_em, obs_execução]` |
| `prev_real[]` | `[carro, data, tipo/plano, OS, fonte INOVE/TransNet]` |
| `pcm_ent.rows[]` | `[carro, setor, categoria, OS, descrição, observação, entrada, saída ("" = em aberto), turno, data da 1ª sessão]` |
| `pcm_ent.dias[]` | datas de sessão do PCM na janela |
| `prev_func[]` | `[data, carro, tipo, OS, mecânico, eletricista, funilaria, borracharia]` (nomes sem a matrícula) |
| `meta_mkbf`, `sr_meta` | 7000 e 94 (vêm de `MKBF_META` e `REPORT_SR_META`) |

---

## 7. Regras que causam erro se reescritas "de cabeça"

1. **MKBF** = KM ÷ intervenções válidas **só nos dias com KM consolidado** (o TransNet atrasa ~2 dias). Contar as intervenções do mês inteiro derruba o MKBF. `mkbf` (274) / `montar_diario_mkbf` do PDF.
2. **Intervenção válida** = tipo não vazio e ≠ SEGUIU VIAGEM (`is_ocorrencia_valida_para_mkbf`). "RA"/"R.A." = RECOLHEU; `NaN` não é tipo (`normalize_tipo`).
3. **Cluster pelo prefixo do carro**, não pela linha: 2216→C8, 2222→C9, 2224→C10, 2425→C11, W→C6.
4. **Defeito**: unificar grafias (caixa, acento, espaços) antes de contar, senão o mesmo defeito vira duas linhas (`_rotulo_defeito_canonico`).
5. **Embarcado**: grupo de manutenção primeiro, depois texto do problema, depois a reclamação; **"catraca de freio" não é embarcado** (`classificar_embarcado`). Na seção Embarcados na operação entram **todas** as ocorrências (inclusive seguiu viagem).
6. **GNS médio** = média de carros em GNS **por dia útil** (seg–sex sem feriado, `_feriados`), contando em cada sessão só quem estava sem saída e já tinha entrado até a data. É diferente de "entradas GNS por dia" da Oficina.
7. **Oficina**: a virada do PCM copia o carro parado para a sessão seguinte com a **mesma `data_entrada`**. Uma entrada = (carro, `data_entrada`); vale o estado da sessão mais recente e a saída preenchida em qualquer cópia (`carregar_pcm_entradas`). Sem isso, setembro dá ~4× mais entradas.
8. **Fuso**: `created_at`, `data_entrada`, `data_saida`, `dt_inicio` vêm em UTC. Converter para America/Sao_Paulo antes de cortar a data, senão eventos depois das 21h caem no dia seguinte.
9. **Planos vencidos**: por km quando `qt_km_intervalo > 0` (`km_para_proxima >= 0`); por tempo só quando não há intervalo de km (`dias_vencido > 0`). Excluir planos de Concessionária e inativos (`cs_ativo = 'N'`). Nunca usar `km_para_proxima` para plano de tempo.
10. **Pneus**: estoque = TransNet com localização contendo BORRACHARIA. **Nunca** usar `pcm_estoque_pneus` (o histórico infla).
11. **SR**: aderência = `status_competencia = 'fechado'` ÷ SRs do mês da reclamação. Fila = situação `N` de qualquer data (não só do ano).
12. **Revisão × quebra**: técnico = quem fez a revisão **vinculada pela OS** (`os_ultima_preventiva`/`os_ultima_inspecao` → `preventivas.numero_os`), na função do setor da quebra. Só conta quebra dentro do ciclo (inspeção ≤ 25 d ou ≤ 6 mil km; preventiva ≤ 45 d ou ≤ 12 mil km). Precoce = ≤ 15 d ou ≤ 3 mil km.
13. **Reincidência**: ≤ 30 dias = seção Reincidência (regra do SOS_Resumo, mês selecionado). ≤ 7 dias = Oportunidades (trimestre). São indicadores diferentes de propósito.
14. **Mês corrente é parcial**: tendências comparam ritmo diário reprojetado em 30 dias, nunca contagem bruta contra mês fechado.
15. **Sandbox**: o HTML roda em iframe isolado. Qualquer `history`, `localStorage`, `location` ou download novo precisa de `try/catch` (já há exemplos em `go`, `lsGet`, `baixarCsv`).

---

## 8. Gabarito de conferência — agosto/2026 (mês fechado, todos os clusters, só válidas)

Use para validar uma reescrita: com o mesmo filtro, o número tem que bater (tolerância de ±1–2 em contagens que dependem de edições posteriores no SOS).

| Indicador | Valor | Onde |
|---|---|---|
| Intervenções no MKBF / KM / MKBF | 167 / 634.696 / **3.801** | `s01` (bate com o PDF oficial de agosto) |
| Tipos: Recolheu / SOS / Troca / Avaria / Improcedente | 77 / 35 / 30 / 24 / 1 | `s01` (bate com o PDF) |
| Tempo médio de fechamento | 82,2 h (3,4 dias) | `s01` `#k4` |
| Controláveis | 114 de 167 | `s01` `#k5` |
| GNS médio / dias úteis | 9,4 / 21 | `s12` |
| Reincidência ≤ 30 d | 46 de 86 carros (53,5%) · 81 retornos · 7 técnicas · 16 setoriais | `s05r` |
| Oficina | 295 entradas · 292 liberadas · 122 GNS · 31 dias de PCM | `s12o` |
| Regeneração | 83 eventos · R$ 1.666 | `s06` |
| Trocas de pneu | 48 | `s07` |
| SR por competência | 523 de 592 (88,3%) | `s09` |
| Embarcados na operação | 57 de 289 ocorrências | `s14` |
| Revisão × quebra | 94 de 167 quebras ≤ 15 d da revisão · 18 técnicos · 97 retrabalhos precoces | `s11r` |
| Oportunidades (trimestre jun–ago) | 471 quebras · 172 repetidas ≤ 7 d · 277 ≤ 15 d pós-preventiva | `s15` |

Indicadores "foto do dia" (planos vencidos, fila de SR, backlog da oficina, estoque de pneus, embarcados em aberto) mudam todo dia e não entram no gabarito: confira contra o HTML publicado no mesmo dia (`relatorios/manutencao/flash_interativo/atual.html`).
