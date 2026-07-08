# Flash Report Diesel v3 - historico 6+ meses, evolucao semanal, analise por linha
# vs meta + velocidade, instrutores aprofundado, motoristas da semana, 30 dias,
# meritocracia R$, divergencia Transnet x Telemetria por carro, tratativas com
# meta vs real, capa, e paginas prontas (acompanhamento noturno / programacao).
# Dados reais extraidos ao vivo em 05/07/2026 (Supabase BCNT + principal via
# navegador, e CSV do Transnet/Athena via ferramenta do Ponto).
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from pathlib import Path

OUT = Path(__file__).resolve().parent
plt.rcParams["font.family"] = "DejaVu Sans"

TEAL = "#0e7c7b"
DARK = "#0f172a"
RED = "#c0392b"
GREEN = "#1e7a34"
GOLD = "#e0a800"
GREY = "#94a3b8"
PURPLE = "#8b5cf6"

# ---------------- DADOS ----------------
META = 2.80

# KM/L mensal Transnet (oficial) - historico real, ponderado km/litro (Athena)
KML_HISTORICO = [
    ("Jan/2026", 2.6885),
    ("Fev/2026", 2.6514),
    ("Mar/2026", 2.6439),
    ("Abr/2026", 2.6492),
    ("Mai/2026", 2.6649),
    ("Jun/2026", 2.6735),
    ("Jul/2026*", 2.6566),
]
KML_MENSAL_TELEMETRIA = {"jun": 2.732, "jul": 2.706}

# KM/L semanal Transnet (oficial), ultimas 8 semanas (seg-dom, semana da direita e parcial)
KML_SEMANAL = [
    ("05/05-11/05", 2.6654),
    ("12/05-18/05", 2.6899),
    ("19/05-25/05", 2.7108),
    ("26/05-01/06", 2.6343),
    ("02/06-08/06", 2.6887),
    ("09/06-15/06", 2.6840),
    ("16/06-22/06", 2.6357),
    ("23/06-29/06", 2.7533),
]

# KM/L por cluster de frota (mapeamento real veiculo->cluster via veiculos_ativos.per_cluster),
# ultimos 4 meses, ponderado km/litro por veiculo/dia (premiacao_diaria_atualizada)
CLUSTER_HISTORICO_4M = {
    "C6":  [("Mar/2026", 2.4036), ("Abr/2026", 2.3921), ("Mai/2026", 2.3851), ("Jun/2026", 2.3721)],
    "C8":  [("Mar/2026", 2.5833), ("Abr/2026", 2.5505), ("Mai/2026", 2.5468), ("Jun/2026", 2.5445)],
    "C9":  [("Mar/2026", 2.7453), ("Abr/2026", 2.7587), ("Mai/2026", 2.7394), ("Jun/2026", 2.7562)],
    "C10": [("Mar/2026", 2.7332), ("Abr/2026", 2.7717), ("Mai/2026", 2.7738), ("Jun/2026", 2.7534)],
    "C11": [("Mar/2026", 2.7297), ("Abr/2026", 2.7689), ("Mai/2026", 2.7821), ("Jun/2026", 2.7846)],
}

CLUSTER_TRANSNET = [
    ("C6", 2.3851, 2.3721),
    ("C8", 2.5468, 2.5445),
    ("C9", 2.7394, 2.7562),
    ("C10", 2.7738, 2.7534),
    ("C11", 2.7821, 2.7846),
]

# Linha x Meta x Velocidade Media (Telemetria, junho/2026 completo)
# (linha, km_l, vel_media, meta, km_total_mil)
LINHAS = [
    ("07TR", 2.593, 18.2, 2.78, 61),
    ("08TR", 2.704, 17.2, 2.83, 55),
    ("10TR", 2.690, 17.2, 2.75, 52),
    ("09TR", 2.949, 19.2, 3.07, 51),
    ("19TR", 2.661, 17.0, 2.69, 42),
    ("04TR", 2.656, 15.2, 2.74, 41),
    ("06TR", 2.714, 17.2, 2.79, 36),
    ("11TR", 2.762, 17.6, 2.83, 35),
    ("03TR", 2.917, 20.3, 2.87, 34),
    ("20TR", 2.593, 16.9, 2.73, 32),
    ("34TR", 2.932, 16.3, 2.90, 26),
    ("15TR", 2.719, 15.4, 2.84, 20),
    ("19VP", 2.633, 17.9, 2.80, 19),
    ("21TR", 2.938, 17.0, 2.91, 18),
    ("05TR", 2.605, 16.1, 2.79, 17),
    ("01TR", 2.759, 17.3, 2.84, 14),
    ("02TR", 3.005, 18.5, 2.90, 8),
    ("16TR", 2.916, 15.4, 2.89, 4),
]

PIORES = [
    ("ROBSON BARROS DE CARVALHO", "30061166", 2.152, 2.71, 1160, 539),
    ("DOUGLAS DE OLIVEIRA TOBAL", "30060983", 2.245, 2.76, 2741, 1221),
    ("ANTONIO OSORIO FARIA", "30061017", 2.367, 2.81, 1880, 794),
    ("ADRIANO DE OLIVEIRA MONTEIRO", "30057198", 2.430, 2.84, 3179, 1308),
    ("RONALDO RODRIGUES CAMARGO", "30011820", 2.445, 2.85, 2819, 1153),
    ("EUCLIDES DE FARIAS SANTOS", "30060832", 2.357, 2.75, 2836, 1203),
    ("PAULO CASSETARI", "30061184", 2.445, 2.83, 3053, 1249),
    ("AGENOR MATIAS DE JESUS", "30010712", 2.449, 2.84, 3050, 1245),
    ("GENECIANO SANTOS DE MELO FERRAZ", "30060159", 2.370, 2.75, 3860, 1629),
    ("CICERO BENEDITO DA SILVA", "30060658", 2.436, 2.81, 2709, 1112),
]

MELHORES = [
    ("LUCAS DA CRUZ NOVAIS", "30061097", 3.215, 2.84, 3560, 1108),
    ("DEVANIR OLIVEIRA SANTOS", "30017485", 3.166, 2.91, 759, 240),
    ("RUI ALVES AMORIM PORTO", "30060734", 3.137, 2.89, 2281, 727),
    ("FABIANO GONCALVES", "30061088", 3.128, 2.89, 3809, 1218),
    ("ROGERIO SANTOS SOUSA", "3202623", 3.126, 2.84, 2485, 795),
    ("FRANCISCO LAIRTON DE LIMA", "3202768", 3.122, 2.75, 2522, 808),
    ("ISAIAS PEREIRA", "30060374", 3.085, 2.82, 2696, 874),
    ("AGNALDO BERNARDINO DE FARIA", "30060872", 2.990, 2.76, 2715, 908),
    ("ELIAS RODRIGUES", "30060780", 2.984, 2.75, 2967, 994),
    ("FRANCISCO NUNES DE MAGALHAES FILHO", "3202670", 2.980, 2.76, 2900, 973),
]

SINAL_ALERTA = [
    ("PAULO CASSETARI", 2.844, 2.445, -14.06),
    ("LUIZ FERNANDO RODRIGUES DA SILVA", 2.772, 2.507, -9.57),
    ("MARCO ANTONIO DUARTE SANTANA", 2.808, 2.551, -9.16),
    ("EDUARDO MORENO SILVA", 2.938, 2.686, -8.55),
    ("PAULO MARCOS G. DE ARAUJO DA CUNHA", 2.702, 2.475, -8.41),
    ("ALEX JOSE SANTOS ROCHA", 2.680, 2.455, -8.37),
    ("THIAGO DANTAS OLIVEIRA", 2.747, 2.527, -7.99),
    ("GERSON MIRANDA PEREIRA", 3.223, 2.976, -7.64),
    ("AGENOR MATIAS DE JESUS", 2.644, 2.449, -7.37),
    ("JOSE EVERALDO DOS SANTOS", 2.761, 2.563, -7.16),
]

DESTAQUE_POSITIVO = [
    ("JESSE SIVIRINO", 2.480, 2.964, 19.53),
    ("BRUNO DOS SANTOS PEREIRA", 2.454, 2.799, 14.07),
    ("DENILSON CARMO DE ALMEIDA", 2.739, 3.053, 11.44),
    ("ALENCAR ALEXANDRE ALVES", 2.384, 2.649, 11.14),
    ("CARLOS ALBERTO TEIXEIRA", 2.457, 2.709, 10.25),
    ("MOTORISTA 30061156", 2.175, 2.398, 10.23),
    ("LUCAS DA CRUZ NOVAIS", 2.951, 3.215, 8.95),
    ("ADILSON LEME LEITE", 2.855, 3.063, 7.27),
    ("FERNANDO DANILO BESERRA DA SILVA", 2.350, 2.521, 7.26),
    ("LUCIO ALVES DA SILVA", 2.507, 2.666, 6.34),
]

# Motoristas da semana (sessoes de acompanhamento, 28/06 a 03/07)
MOTORISTAS_SEMANA = [
    ("JOSIAS PEREIRA DE AMORIM", "3202330", "Fabiano Freitas", "03/07", "KM/L abaixo da meta"),
    ("MARCOS ANTONIO HENRIQUES DE OLIVEIRA", "3202598", "Fabiano Freitas", "03/07", "KM/L abaixo da meta"),
    ("ADILSON LEME LEITE", "30060250", "Fabiano Freitas", "03/07", "C9 - Linha 16TR"),
    ("ALENCAR ALEXANDRE ALVES", "30061096", "Fabiano Freitas", "03/07", "C10 - Linha 09TR"),
    ("DEVANIR OLIVEIRA SANTOS", "30017485", "Helio Ramos", "02/07", "C9 - Linha 03TR"),
    ("MAURILIO FERREIRA SANTOS", "30060186", "Helio Ramos", "02/07", "C8 - Linha 34TR"),
    ("LEONARDO FERREIRA DOS SANTOS", "30060192", "Helio Ramos", "02/07", "KM/L abaixo da meta"),
    ("NORISVALDO RODRIGUES DOS SANTOS", "30060691", "Helio Ramos", "02/07", "KM/L abaixo da meta"),
    ("RUI ALVES AMORIM PORTO", "30060734", "Helio Ramos", "02/07", "C11 - Linha 34TR"),
    ("WANDERSON CARLOS LINO DE SOUZA", "30060859", "Fabiano Freitas", "02/07", "C9 - Linha 20TR"),
]

# Motoristas que completaram 30 dias de acompanhamento nesta semana (evolucao real vs meta)
COMPLETARAM_30_DIAS = [
    ("RICARDO DE OLIVEIRA", "30061193", "Helio Ramos", "05/06", 2.900, 3.031),
    ("EDUARDO JOSE SILVA CHAVES", "30060711", "Helio Ramos", "01/06", 2.750, 2.620),
    ("MARCOS DOS SANTOS CAITANO", "30060856", "Helio Ramos", "01/06", 2.750, 2.609),
    ("DAVID DIAS PEREZ", "30060649", "Helio Ramos", "01/06", 2.807, 2.665),
]

# Instrutores - analise aprofundada (base: diesel_acompanhamentos, 477 registros)
# TODO(pendente credencial Supabase INOVE - wboelthngddvkgrvwkbu.supabase.co):
# Estes numeros sao ACUMULADO GERAL (toda a base diesel_acompanhamentos, sem filtro de data),
# diferente do resto do relatorio que e escopado a Junho/2026. Assim que o usuario enviar a
# anon/service key do projeto INOVE, refazer esta consulta filtrando por dt_inicio (ou campo
# equivalente) dentro de 01/06/2026 a 30/06/2026, e atualizar tambem INSTRUTORES_DIARIO /
# INSTRUTORES_DIA_A_DIA se necessario. Depois disso, remover a nota de aviso da Pagina 11
# em gen_html_v3.py (bloco `<div class="warn">`) e o texto "ACUMULADO GERAL" do page_header.
INSTRUTORES = [
    {"nome": "Fabiano Freitas", "total": 254, "ok": 124, "monitorando": 78, "atas": 24,
     "taxa_atingiu_meta": 24.0, "n_com_dado": 171, "sessoes_semana": 39, "horas_mes": 15.6, "linhas_mes": 7},
    {"nome": "Helio Ramos", "total": 214, "ok": 128, "monitorando": 57, "atas": 14,
     "taxa_atingiu_meta": 22.1, "n_com_dado": 163, "sessoes_semana": 19, "horas_mes": 10.3, "linhas_mes": 4},
]

ACOMPANHAMENTO = [
    {"nome": "Agenor Matias De Jesus", "instrutor": "Fabiano Freitas", "status": "Em monitoramento", "antes": 2.361, "depois": 2.230},
    {"nome": "Claudio Aparecido De Oliveira", "instrutor": "Fabiano Freitas", "status": "Tratativa (ATA)", "antes": 2.676, "depois": 2.516},
    {"nome": "Paulo Cassetari", "instrutor": "Helio Ramos", "status": "Em monitoramento", "antes": 2.393, "depois": 2.511},
    {"nome": "Adilson Leme Leite", "instrutor": "Fabiano Freitas", "status": "Em monitoramento", "antes": 2.40, "depois": 2.35},
    {"nome": "Joao Caetano Da Silva Filho", "instrutor": "Helio Ramos", "status": "Em analise", "antes": 2.400, "depois": 2.477},
    {"nome": "Douglas De Oliveira Tobal", "instrutor": "Fabiano Freitas", "status": "Em monitoramento", "antes": 2.392, "depois": 2.514},
    {"nome": "Silvio Araujo Da Silva", "instrutor": "Helio Ramos", "status": "Em monitoramento", "antes": 2.602, "depois": 2.408},
    {"nome": "Antonio Osorio Faria", "instrutor": "Fabiano Freitas", "status": "Em monitoramento", "antes": 2.578, "depois": 2.372},
    {"nome": "Cicero Benedito Da Silva", "instrutor": "Helio Ramos", "status": "Em analise", "antes": 2.491, "depois": 2.466},
    {"nome": "Jose Carlos Dos Santos", "instrutor": "Helio Ramos", "status": "Em monitoramento", "antes": 2.546, "depois": 2.650},
]

# Meritocracia (BCNT.premiacao_atualizada, junho/2026 - valor R$ ja calculado pela regra da empresa)
MERITOCRACIA_RESUMO = {"total_pago": 10850, "motoristas_premiados": 71, "total_motoristas": 220,
                       "distribuicao": {"R$ 300": 4, "R$ 200": 15, "R$ 150": 29, "R$ 100": 23, "R$ 0": 149}}
MERITOCRACIA_TOP = [
    ("LUCAS DA CRUZ NOVAIS", "30061097", 300, 3.21),
    ("ROGERIO SANTOS SOUSA", "3202623", 300, 3.13),
    ("FRANCISCO LAIRTON DE LIMA", "3202768", 300, 3.12),
    ("FABIANO GONCALVES", "30061088", 200, 3.13),
    ("CLEBER DA SILVA MORAES", "30060183", 200, 3.10),
    ("RICHARD COGO DE ANDRADE", "30061188", 200, 3.04),
    ("FRANCISCO NUNES DE MAGALHAES FILHO", "3202670", 200, 2.98),
    ("ELIAS RODRIGUES", "30060780", 200, 2.98),
    ("JESSE SIVIRINO", "30060418", 200, 2.96),
    ("LEANDRO MASITELLE LAURINDO", "30060937", 200, 2.94),
]

# Divergencia Transnet x Telemetria por carro (Athena, mai-jul/2026, min. 500km rodado)
DIVERGENCIA_CARROS = [
    ("222215", 2.934, 4.093, 39.5, 14966),
    ("221606", 2.649, 3.517, 32.8, 2956),
    ("222220", 2.750, 1.951, -29.1, 12974),
    ("222204", 2.807, 3.599, 28.2, 13760),
    ("222203", 2.781, 2.026, -27.1, 13099),
    ("221608", 2.405, 1.764, -26.6, 6031),
]

# Analise de linha completa (estilo app: Mes Referencia=Junho, Mes Comparacao=Maio)
# (linha, km_l_maio, km_l_junho, var_pct, meta, desperdicio_L, km_junho, litros_junho)
LINHA_DESPERDICIO = [
    ("07TR", 2.668, 2.593, -2.81, 2.78, 1588.97, 61339, 23651.21),
    ("08TR", 2.655, 2.704, 1.88, 2.83, 901.83, 55411, 20488.54),
    ("09TR", 2.907, 2.949, 1.47, 3.07, 695.26, 51210, 17363.06),
    ("20TR", 2.652, 2.593, -2.21, 2.73, 628.45, 31715, 12228.80),
    ("04TR", 2.645, 2.656, 0.43, 2.74, 444.96, 40702, 15324.88),
    ("19VP", 2.599, 2.633, 1.28, 2.80, 434.48, 18812, 7146.12),
    ("10TR", 2.667, 2.690, 0.83, 2.75, 426.77, 52240, 19422.70),
    ("05TR", 2.604, 2.605, 0.03, 2.79, 418.96, 16809, 6452.80),
    ("06TR", 2.697, 2.714, 0.65, 2.79, 355.23, 36025, 13271.93),
    ("11TR", 2.844, 2.762, -2.88, 2.83, 323.79, 35252, 12762.86),
    ("15TR", 2.785, 2.719, -2.36, 2.84, 321.07, 20078, 7383.77),
    ("19TR", 2.623, 2.661, 1.44, 2.69, 183.82, 41529, 15606.80),
    ("01TR", 2.757, 2.759, 0.06, 2.84, 148.64, 13953, 5056.88),
    ("16TR", 2.717, 2.916, 7.32, 2.89, -14.61, 4149, 1422.97),
    ("21TR", 2.925, 2.938, 0.47, 2.91, -68.32, 17701, 6024.15),
    ("02TR", 2.892, 3.005, 3.91, 2.90, -103.82, 8268, 2751.76),
    ("34TR", 2.992, 2.932, -2.02, 2.90, -108.92, 26272, 8960.97),
    ("03TR", 2.897, 2.917, 0.67, 2.87, -178.58, 34057, 11677.04),
]

# Ultimo acompanhamento / ultima tratativa dos motoristas mais distantes da meta (PIORES)
# (chapa, status_acompanhamento, data_inicio_acompanhamento, status_tratativa, data_tratativa, prioridade_tratativa)
PIORES_HISTORICO = {
    "30061166": ("AGUARDANDO_INSTRUTOR", "29/06", "-", "-", "-"),
    "30060983": ("EM_MONITORAMENTO", "18/06", "Concluída", "29/04", "Alta"),
    "30061017": ("EM_MONITORAMENTO", "12/06", "Concluída", "17/04", "Alta"),
    "30057198": ("EM_MONITORAMENTO", "25/06", "-", "-", "-"),
    "30011820": ("ATAS", "31/03", "Pendente", "26/06", "Média"),
    "30060832": ("EM_MONITORAMENTO", "18/06", "Pendente", "19/06", "Média"),
    "30061184": ("OK", "-", "-", "-", "-"),
    "30010712": ("EM_MONITORAMENTO", "29/06", "-", "-", "-"),
    "30060159": ("EM_MONITORAMENTO", "08/06", "Concluída", "22/05", "Alta"),
    "30060658": ("EM_ANALISE", "28/05", "-", "-", "-"),
}

# Causa-raiz da queda no Sinal de Alerta: trocou de linha e/ou carro entre Maio e Junho?
# (nome, linha_maio, linha_junho, carro_maio, carro_junho, mudou_linha, mudou_carro)
SINAL_ALERTA_CAUSA = [
    ("Paulo Cassetari", "-", "-", "-", "-", None, None),
    ("Luiz Fernando Rodrigues Da Silva", "09TR", "15TR", "242522", "242525", True, True),
    ("Marco Antonio Duarte Santana", "03TR", "20TR", "222406", "222212", True, True),
    ("Eduardo Moreno Silva", "20TR", "20TR", "222225", "222225", False, False),
    ("Paulo Marcos G. De Araujo Da Cunha", "-", "-", "-", "-", None, None),
    ("Alex Jose Santos Rocha", "08TR", "08TR", "242504", "222403", False, True),
    ("Thiago Dantas Oliveira", "11TR", "11TR", "222423", "222220", False, True),
    ("Gerson Miranda Pereira", "34TR", "34TR", "242524", "242524", False, False),
    ("Agenor Matias De Jesus", "11TR", "11TR", "222220", "222220", False, False),
    ("Jose Everaldo Dos Santos", "04TR", "04TR", "222217", "222217", False, False),
]

# Instrutores - metricas da ultima semana do relatorio (29/06 seg a 03/07 sex)
INSTRUTORES_DIARIO = [
    {"nome": "Fabiano Freitas", "dias_trabalhados": 4, "total_sessoes": 39, "media_sessoes_dia": 9.8,
     "tempo_total_h": 21.1, "tempo_medio_sessao_min": 32.5, "media_h_dia": 5.29, "aproveitamento_dia_pct": 66.1},
    {"nome": "Helio Ramos", "dias_trabalhados": 2, "total_sessoes": 19, "media_sessoes_dia": 9.5,
     "tempo_total_h": 10.3, "tempo_medio_sessao_min": 32.7, "media_h_dia": 5.17, "aproveitamento_dia_pct": 64.7},
]

# (data, instrutor, acompanhamentos, tempo_total_h_str, tempo_medio_min) - semana do relatorio 29/06 a 03/07
INSTRUTORES_DIA_A_DIA = [
    ("30/06 (seg)", "Fabiano Freitas", 10, "5h 36min", 34),
    ("01/07 (ter)", "Fabiano Freitas", 9, "4h 45min", 32),
    ("01/07 (ter)", "Helio Ramos", 9, "5h 09min", 34),
    ("02/07 (qua)", "Fabiano Freitas", 10, "5h 25min", 33),
    ("02/07 (qua)", "Helio Ramos", 10, "5h 12min", 31),
    ("03/07 (qui)", "Fabiano Freitas", 10, "5h 23min", 32),
]

# Aderencia de carros (dias com dado valido de Transnet / dias no periodo Mai-Jul, 64 dias)
# (veiculo, dias_com_dado, pct_aderencia)
ADERENCIA_CARROS = [
    ("222424", 3, 4.7),
    ("W555", 3, 4.7),
    ("221606", 15, 23.4),
    ("W545", 29, 45.3),
    ("222403", 32, 50.0),
    ("221601", 33, 51.6),
    ("221605", 33, 51.6),
    ("W547", 33, 51.6),
    ("221608", 34, 53.1),
    ("W549", 34, 53.1),
]

# KM/L diario x Velocidade media diaria (Junho/2026 completo, Telemetria) - para correlacao
# (dia, km_l, vel_media_km_h)
KML_VELOCIDADE_DIARIO = [
    ("01/06", 2.7058, 17.04), ("02/06", 2.7072, 16.97), ("03/06", 2.6818, 16.52),
    ("04/06", 2.8630, 19.10), ("05/06", 2.7597, 17.73), ("06/06", 2.8497, 18.28),
    ("07/06", 2.9585, 20.21), ("08/06", 2.6334, 16.63), ("09/06", 2.6204, 16.58),
    ("10/06", 2.6043, 15.84), ("11/06", 2.7051, 17.03), ("12/06", 2.6811, 16.51),
    ("13/06", 2.7789, 17.75), ("14/06", 3.0482, 20.42), ("15/06", 2.6899, 16.87),
    ("16/06", 2.7039, 17.23), ("17/06", 2.7274, 17.29), ("18/06", 2.7570, 17.03),
    ("19/06", 2.7174, 16.62), ("20/06", 2.8664, 18.28), ("21/06", 3.0424, 20.14),
    ("22/06", 2.7184, 17.47), ("23/06", 2.7200, 17.06), ("24/06", 2.6776, 16.97),
    ("25/06", 2.7532, 17.35), ("26/06", 2.7268, 17.09), ("27/06", 2.8210, 18.03),
    ("28/06", 2.9570, 20.49), ("29/06", 2.7764, 18.44), ("30/06", 2.6680, 17.35),
]

# Aderencia diaria da frota inteira (media da empresa) - % de veiculos c/ dado valido / total frota (111 veiculos), Junho/2026
# (dia, veiculos_com_dado, pct_aderencia)
ADERENCIA_DIARIA_EMPRESA = [
    ("01/06", 103, 92.8), ("02/06", 102, 91.9), ("03/06", 102, 91.9), ("04/06", 37, 33.3),
    ("05/06", 75, 67.6), ("06/06", 71, 64.0), ("07/06", 31, 27.9), ("08/06", 99, 89.2),
    ("09/06", 102, 91.9), ("10/06", 101, 91.0), ("11/06", 104, 93.7), ("12/06", 105, 94.6),
    ("13/06", 67, 60.4), ("14/06", 33, 29.7), ("15/06", 102, 91.9), ("16/06", 103, 92.8),
    ("17/06", 104, 93.7), ("18/06", 102, 91.9), ("19/06", 100, 90.1), ("20/06", 73, 65.8),
    ("21/06", 31, 27.9), ("22/06", 104, 93.7), ("23/06", 103, 92.8), ("24/06", 104, 93.7),
    ("25/06", 104, 93.7), ("26/06", 98, 88.3), ("27/06", 68, 61.3), ("28/06", 34, 30.6),
    ("29/06", 90, 81.1), ("30/06", 93, 83.8),
]
ADERENCIA_MEDIA_EMPRESA = 76.4
ADERENCIA_TOTAL_FROTA = 111

# Dentro dos 30 dias de acompanhamento: quantas vezes o motorista pegou o carro que mais usou,
# e KM/L nesse carro principal vs KM/L nos demais carros
# (chapa, total_dias_com_dado, carro_principal, vezes_no_carro_principal, pct_carro_principal, kml_carro_principal, kml_outros_carros, n_outros)
VEICULO_30_DIAS = [
    ("30061193", 26, "242524", 20, 76.9, 3.006, 2.829, 6),
    ("30060711", 26, "222201", 18, 69.2, 2.541, 2.667, 8),
    ("30060856", 24, "222210", 20, 83.3, 2.957, 2.589, 4),
    ("30060649", 26, "222207", 18, 69.2, 2.522, 2.596, 8),
]

# Tratativas reais (tabela diesel_tratativas, SLA por prioridade: Gravissima=1d, Alta=3d, Media=7d, Baixa=15d)
TRATATIVAS = {"total": 91, "por_status": {"CONCLUIDA": 62, "ATRASADA": 27, "PENDENTE_NO_PRAZO": 2}}
STATUS_LABEL = {"CONCLUIDA": "Concluida", "ATRASADA": "Atrasada (SLA vencido)", "PENDENTE_NO_PRAZO": "Pendente (no prazo)"}

# (nome, chapa, linha, prioridade, dias_aberto, kml_meta, kml_real)
TRATATIVAS_ATRASADAS = [
    ("EVERALDO PINTO NOGUEIRA", "30061091", "10TR", "Alta", 96, 2.85, 2.41),
    ("JOSE CARLOS DOS SANTOS", "30061019", "08TR", "Alta", 95, 2.75, 2.28),
    ("ERISVALDO VALTER DA SILVA", "30060997", "08TR", "Alta", 95, 2.80, 2.36),
    ("JEOVA MARTINS DOS SANTOS", "30061033", "15TR", "Alta", 93, 2.84, 2.39),
    ("NELIO DA SILVA PEREIRA", "30060246", "07TR", "Alta", 89, 2.78, 2.31),
    ("JARDEL DE SOUZA", "30027746", "11TR", "Alta", 78, 2.83, 2.42),
    ("CLAUDIO APARECIDO DE OLIVEIRA", "3203102", "08TR", "Baixa", 75, 2.80, 2.18),
    ("WANDERSON CARLOS LINO DE SOUZA", "30060859", "20TR", "Alta", 75, 2.73, 2.35),
    ("WESLEY REIS DA SILVA", "30060867", "07TR", "Alta", 43, 2.78, 2.44),
    ("ALENCAR ALEXANDRE ALVES", "30061096", "10TR", "Alta", 40, 2.75, 2.65),
    ("CLAUDIO FLEVERSON DA COSTA FILHO", "30060595", "04TR", "Alta", 24, 2.74, 2.39),
    ("LUCIANO DA SILVA", "30060552", "04TR", "Alta", 24, 2.75, 2.94),
    ("SILVANO RIBEIRO DA SILVA FILHO", "30060436", "09TR", "Alta", 24, 3.07, 2.71),
    ("DOMINGOS SANTANA DE MOISES", "30051606", "06TR", "Média", 15, 2.79, 2.52),
    ("ADENILTON GALDINO DOS SANTOS", "30061176", "10TR", "Média", 15, 2.75, 2.48),
]

TRATATIVAS_PENDENTES_PRAZO = [
    ("LUCIANO EVARISTO TEIXEIRA DE OLIVEIRA", "30061139", "08TR", "Baixa", 8, 2.80, 2.61),
    ("FELIPE TOMASZEWK", "30061124", "08TR", "Baixa", 8, 2.80, 2.55),
]

SUGESTOES_ACOMPANHAMENTO = [
    ("Agenor Matias De Jesus", "Piorou após acompanhamento (2,36→2,23 km/L) e segue no Sinal de Alerta.", "Reavaliar abordagem do instrutor; considerar reforço presencial ou rodízio de linha."),
    ("Silvio Araujo Da Silva", "Piorou após acompanhamento (2,60→2,41 km/L).", "Nova tratativa com foco em condução em subida/frenagem; acompanhar por 10 dias."),
    ("Antonio Osorio Faria", "Piorou após acompanhamento (2,58→2,37 km/L).", "Repetir checkpoint de 10 dias; investigar se é comportamento ou problema mecânico do veículo."),
    ("Claudio Aparecido De Oliveira", "Tratativa aberta há 75 dias sem SLA cumprido; acompanhamento mais antigo (maio) sem recuperação.", "Escalar para ATA formal — já está classificado como tal, cobrar encerramento com instrutor."),
    ("Everaldo Pinto Nogueira / Jose Carlos Dos Santos / Erisvaldo Valter Da Silva", "Tratativas de prioridade Alta abertas há mais de 90 dias — maior risco de SLA no relatório.", "Priorizar encerramento imediato; são os 3 casos mais críticos de atraso."),
]

SUGESTOES_LINHAS = [
    ("07TR", "Maior volume (61 mil km) e KM/L 2,593 abaixo da meta 2,78; velocidade média baixa (18,2 km/h).", "Manter como linha foco da semana; repetir acompanhamento focado."),
    ("08TR", "3 tratativas atrasadas e 2 pendentes no prazo — maior concentração de casos.", "Candidata a mutirão de tratativas: fechar as 5 pendências desta linha na mesma semana."),
    ("20TR", "KM/L 2,593 é o mais distante da meta em termos relativos (-5,1%) com velocidade baixa (16,9 km/h).", "Investigar se é traçado/trânsito ou condução; comparar com 07TR que tem o mesmo problema."),
    ("04TR", "Velocidade média mais baixa da frota (15,2 km/h) sugere trânsito/paradas — pode explicar parte do desperdício.", "Validar com equipe de tráfego se o problema é operacional antes de cobrar do motorista."),
]


def fmt(v, d=2):
    return f"{v:,.{d}f}".replace(",", "X").replace(".", ",").replace("X", ".")


def pct(v):
    s = "+" if v > 0 else ""
    return f"{s}{fmt(v,2)}%"


# ================= GRAFICOS =================

def chart_kml_historico():
    fig, ax = plt.subplots(figsize=(11.0, 3.9))
    x = list(range(len(KML_HISTORICO)))
    labels = [m[0] for m in KML_HISTORICO]
    vals = [m[1] for m in KML_HISTORICO]
    ax.plot(x, vals, marker="o", markersize=7, linewidth=2.6, color=TEAL)
    ax.axhline(META, color=RED, linestyle=":", linewidth=1.5, label=f"Meta {fmt(META)}")
    for xi, v in zip(x, vals):
        ax.text(xi, v + 0.02, fmt(v, 3), ha="center", fontsize=8.6, fontweight="bold", color=TEAL)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=9)
    ax.set_ylim(2.55, 2.95)
    ax.set_ylabel("KM/L")
    ax.set_title("KM/L Mensal — Transnet (oficial) — histórico 7 meses", fontsize=12, fontweight="bold", color=DARK)
    ax.legend(loc="lower left", fontsize=8, frameon=False)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    ax.grid(axis="y", linestyle=":", alpha=0.5)
    fig.tight_layout()
    fig.savefig(OUT / "v3_historico.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_semanal_evolucao():
    fig, ax = plt.subplots(figsize=(11.0, 3.9))
    x = list(range(len(KML_SEMANAL)))
    labels = [s[0] for s in KML_SEMANAL]
    vals = [s[1] for s in KML_SEMANAL]
    cores = [GREEN if v >= META else RED for v in vals]
    ax.bar(x, vals, color=cores, width=0.55, alpha=0.85, zorder=2)
    ax.plot(x, vals, color=DARK, linewidth=1.4, marker="o", markersize=4, zorder=3)
    ax.axhline(META, color=DARK, linestyle=":", linewidth=1.3, label=f"Meta {fmt(META)}")
    for xi, v in zip(x, vals):
        ax.text(xi, v + 0.025, fmt(v, 3), ha="center", fontsize=8, fontweight="bold", color=DARK)
    ax.set_xticks(x); ax.set_xticklabels(labels, fontsize=7.6, rotation=0)
    ax.set_ylim(2.3, 2.95)
    ax.set_ylabel("KM/L")
    ax.set_title("Evolução Semana a Semana — Transnet (últimas 8 semanas)", fontsize=12, fontweight="bold", color=DARK)
    ax.legend(loc="lower left", fontsize=8, frameon=False)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    ax.grid(axis="y", linestyle=":", alpha=0.4)
    fig.tight_layout()
    fig.savefig(OUT / "v3_semanal.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_semanal_variacao_pct_com_kml():
    fig, ax1 = plt.subplots(figsize=(11.0, 3.5))
    x = list(range(1, len(KML_SEMANAL)))
    labels = [s[0] for s in KML_SEMANAL[1:]]
    vals_pct = []
    for i in range(1, len(KML_SEMANAL)):
        prev = KML_SEMANAL[i-1][1]
        cur = KML_SEMANAL[i][1]
        vals_pct.append((cur - prev) / prev * 100)
    vals_kml = [KML_SEMANAL[i][1] for i in range(1, len(KML_SEMANAL))]
    cores = [GREEN if v >= 0 else RED for v in vals_pct]
    ax1.axhline(0, color="#94a3b8", linewidth=1)
    ax1.plot(x, vals_pct, color=DARK, linewidth=1.6, marker="o", markersize=5, zorder=2)
    for xi, v, c in zip(x, vals_pct, cores):
        ax1.scatter([xi], [v], color=c, s=55, zorder=3)
        ax1.text(xi, v + (0.25 if v >= 0 else -0.42), pct(v), ha="center", fontsize=8, fontweight="bold", color=c)
    ax1.set_xticks(x); ax1.set_xticklabels(labels, fontsize=7.6)
    ax1.set_ylabel("Variação % semana anterior", color=DARK)
    ax2 = ax1.twinx()
    ax2.plot(x, vals_kml, color=TEAL, linewidth=1.6, linestyle="--", marker="s", markersize=4, zorder=1, alpha=0.75)
    for xi, v in zip(x, vals_kml):
        ax2.text(xi, v + 0.012, fmt(v, 3), ha="center", fontsize=7, color=TEAL)
    ax2.set_ylabel("KM/L da semana", color=TEAL)
    ax2.tick_params(axis="y", colors=TEAL)
    ax1.set_title("Evolução da Variação Semanal (%) e KM/L da Semana — Transnet", fontsize=11.5, fontweight="bold", color=DARK)
    for s_ in ["top"]:
        ax1.spines[s_].set_visible(False); ax2.spines[s_].set_visible(False)
    ax1.grid(axis="y", linestyle=":", alpha=0.4)
    fig.tight_layout()
    fig.savefig(OUT / "v3_semanal_pct.png", dpi=150, transparent=True)
    plt.close(fig)





def chart_instrutores_diario():
    fig, ax = plt.subplots(figsize=(8.4, 4.8))
    nomes = [i["nome"] for i in INSTRUTORES_DIARIO]
    y = np.arange(len(nomes))
    aprov = [i["aproveitamento_dia_pct"] for i in INSTRUTORES_DIARIO]
    cores = [GREEN if a >= 65 else GOLD for a in aprov]
    ax.barh(y, aprov, height=0.5, color=cores, zorder=2)
    ax.axvline(100, color="#94a3b8", linewidth=1, linestyle=":")
    for i, a in enumerate(aprov):
        inst = INSTRUTORES_DIARIO[i]
        ax.text(a + 2, i, f"{fmt(a,1)}%  ({fmt(inst['media_h_dia'],1)}h/dia)", va="center", fontsize=8.6, fontweight="bold", color=DARK)
    ax.set_yticks(list(y)); ax.set_yticklabels(nomes, fontsize=10)
    ax.set_xlim(0, 110)
    ax.set_xlabel("% da jornada (8h) ocupada com acompanhamentos", fontsize=10)
    ax.set_title("Aproveitamento do Dia — Instrutores (última semana)", fontsize=11, fontweight="bold", color=DARK)
    for s_ in ["top", "right"]:
        ax.spines[s_].set_visible(False)
    ax.grid(axis="x", linestyle=":", alpha=0.4)
    fig.tight_layout()
    fig.savefig(OUT / "v3_instrutores_diario.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_aderencia_carros():
    fig, ax = plt.subplots(figsize=(6.2, 3.6))
    dados = sorted(ADERENCIA_CARROS, key=lambda a: a[2])
    labels = [d[0] for d in dados]
    vals = [d[2] for d in dados]
    y = range(len(labels))
    cores = [RED if v < 30 else GOLD for v in vals]
    ax.barh(list(y), vals, color=cores, height=0.55, zorder=2)
    for i, v in enumerate(vals):
        ax.text(v + 1.5, i, f"{fmt(v,1)}%", va="center", fontsize=8.4, fontweight="bold", color=DARK)
    ax.set_yticks(list(y)); ax.set_yticklabels([f"Carro {l}" for l in labels], fontsize=8.8)
    ax.set_xlim(0, 70)
    ax.set_xlabel("% de dias com dado válido de Transnet (Mai-Jul)")
    ax.set_title("Menor Aderência de Dados — Carros com Falha de Reporte", fontsize=10.8, fontweight="bold", color=DARK)
    for s_ in ["top", "right"]:
        ax.spines[s_].set_visible(False)
    ax.grid(axis="x", linestyle=":", alpha=0.4)
    fig.tight_layout()
    fig.savefig(OUT / "v3_aderencia.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_velocidade_kml_diario():
    fig, ax1 = plt.subplots(figsize=(9.0, 6.4))
    x = list(range(len(KML_VELOCIDADE_DIARIO)))
    labels = [d[0] for d in KML_VELOCIDADE_DIARIO]
    kml = [d[1] for d in KML_VELOCIDADE_DIARIO]
    vel = [d[2] for d in KML_VELOCIDADE_DIARIO]
    l1, = ax1.plot(x, kml, color=TEAL, linewidth=2.2, marker="o", markersize=3.5, label="KM/L do dia")
    ax1.set_ylabel("KM/L", color=TEAL)
    ax1.tick_params(axis="y", colors=TEAL)
    ax2 = ax1.twinx()
    l2, = ax2.plot(x, vel, color="#8b5cf6", linewidth=1.8, linestyle="--", marker="^", markersize=3.5, label="Velocidade média (km/h)")
    ax2.set_ylabel("Velocidade média (km/h)", color="#8b5cf6")
    ax2.tick_params(axis="y", colors="#8b5cf6")
    ax1.set_xticks(x[::2]); ax1.set_xticklabels([labels[i] for i in range(0, len(labels), 2)], fontsize=8.4, rotation=45, ha="right")
    ax1.set_title("KM/L Diário x Velocidade Média — Junho/2026 (correlação)", fontsize=13.5, fontweight="bold", color=DARK)
    ax1.legend([l1, l2], ["KM/L do dia", "Velocidade média"], loc="lower left", fontsize=9.5, frameon=False)
    for s_ in ["top"]:
        ax1.spines[s_].set_visible(False); ax2.spines[s_].set_visible(False)
    ax1.grid(axis="y", linestyle=":", alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT / "v3_vel_kml_diario.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_velocidade_kml_dispersao():
    fig, ax = plt.subplots(figsize=(5.6, 6.4))
    kml = np.array([d[1] for d in KML_VELOCIDADE_DIARIO])
    vel = np.array([d[2] for d in KML_VELOCIDADE_DIARIO])
    ax.scatter(vel, kml, color=TEAL, s=45, alpha=0.8, zorder=2)
    coef = np.corrcoef(vel, kml)[0, 1]
    z = np.polyfit(vel, kml, 1)
    xs = np.linspace(vel.min(), vel.max(), 50)
    ax.plot(xs, z[0]*xs + z[1], color=RED, linewidth=1.8, linestyle="--", zorder=1, label=f"Correlação r={fmt(coef,2)}")
    ax.set_xlabel("Velocidade média (km/h)", fontsize=11)
    ax.set_ylabel("KM/L", fontsize=11)
    ax.tick_params(labelsize=10)
    ax.set_title("Dispersão — Velocidade x KM/L (30 dias)", fontsize=13, fontweight="bold", color=DARK)
    ax.legend(loc="lower right", fontsize=10, frameon=False)
    for s_ in ["top", "right"]:
        ax.spines[s_].set_visible(False)
    ax.grid(linestyle=":", alpha=0.4)
    fig.tight_layout()
    fig.savefig(OUT / "v3_vel_kml_dispersao.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_aderencia_empresa_diaria():
    fig, ax = plt.subplots(figsize=(11.0, 3.8))
    x = list(range(len(ADERENCIA_DIARIA_EMPRESA)))
    labels = [d[0] for d in ADERENCIA_DIARIA_EMPRESA]
    vals = [d[2] for d in ADERENCIA_DIARIA_EMPRESA]
    cores = [RED if v < 50 else (GOLD if v < 85 else GREEN) for v in vals]
    ax.bar(x, vals, color=cores, width=0.65, zorder=2)
    ax.axhline(ADERENCIA_MEDIA_EMPRESA, color=DARK, linestyle=":", linewidth=1.4, label=f"Média do mês: {fmt(ADERENCIA_MEDIA_EMPRESA,1)}%")
    ax.set_xticks(x[::2]); ax.set_xticklabels([labels[i] for i in range(0, len(labels), 2)], fontsize=7.4, rotation=45, ha="right")
    ax.set_ylim(0, 105)
    ax.set_ylabel("% da frota com dado válido")
    ax.set_title("Aderência Diária da Frota (média da empresa) — Junho/2026", fontsize=11.5, fontweight="bold", color=DARK)
    ax.legend(loc="lower left", fontsize=8, frameon=False)
    for s_ in ["top", "right"]:
        ax.spines[s_].set_visible(False)
    ax.grid(axis="y", linestyle=":", alpha=0.3)
    fig.tight_layout()
    fig.savefig(OUT / "v3_aderencia_empresa.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_cluster_divergente():
    # Pequenos multiplos: um mini-grafico de linha por cluster, ultimos 4 meses.
    # Cluster = agrupamento real de veiculos (veiculos_ativos.per_cluster), nao de linhas.
    clusters_ordem = ["C6", "C8", "C9", "C10", "C11"]
    fig, axes = plt.subplots(1, 5, figsize=(12.6, 3.4), sharey=True)
    for ax, c in zip(axes, clusters_ordem):
        serie = CLUSTER_HISTORICO_4M[c]
        meses = [m[0].replace("/2026", "") for m in serie]
        vals = [m[1] for m in serie]
        x = list(range(len(vals)))
        cor = GREEN if vals[-1] >= vals[0] else RED
        ax.plot(x, vals, color=cor, linewidth=2.2, marker="o", markersize=4.5, zorder=3)
        ax.axhline(META, color="#94a3b8", linestyle=":", linewidth=1.1, zorder=1)
        ax.fill_between(x, vals, META, where=[v < META for v in vals], color=RED, alpha=0.06, zorder=0)
        for xi, v in zip(x, vals):
            ax.text(xi, v + 0.028, fmt(v, 2), ha="center", fontsize=7.6, fontweight="bold", color=DARK)
        ax.set_xticks(x); ax.set_xticklabels(meses, fontsize=8)
        ax.set_title(c, fontsize=12.5, fontweight="bold", color=DARK)
        ax.set_ylim(2.15, 2.95)
        for s in ["top", "right"]:
            ax.spines[s].set_visible(False)
        ax.grid(axis="y", linestyle=":", alpha=0.35)
    axes[0].set_ylabel("KM/L", fontsize=10)
    fig.suptitle("KM/L por Cluster de Frota — Últimos 4 Meses (linha tracejada = meta 2,80)", fontsize=13, fontweight="bold", color=DARK, y=1.03)
    fig.tight_layout()
    fig.savefig(OUT / "v3_cluster.png", dpi=150, transparent=True, bbox_inches="tight")
    plt.close(fig)


def chart_linha_meta_velocidade():
    fig, ax = plt.subplots(figsize=(11.2, 5.6))
    linhas = sorted(LINHAS, key=lambda l: (l[1] - l[3]))
    labels = [l[0] for l in linhas]
    dist = [l[1] - l[3] for l in linhas]
    vel = [l[2] for l in linhas]
    y = np.arange(len(labels))
    colors = [RED if d < -0.05 else (GOLD if d < 0 else GREEN) for d in dist]
    ax.barh(y, dist, color=colors, height=0.6, zorder=2)
    ax.axvline(0, color=DARK, linewidth=1.2)
    for i, (d, v) in enumerate(zip(dist, vel)):
        ax.text(d + (0.006 if d >= 0 else -0.006), i, fmt(d, 3), va="center",
                 ha="left" if d >= 0 else "right", fontsize=8, fontweight="bold", color=DARK)
        ax.text(0.20, i, f"{fmt(v,1)} km/h", va="center", ha="left", fontsize=7.6, color="#475569")
    ax.set_yticks(list(y)); ax.set_yticklabels(labels, fontsize=8.6)
    ax.set_xlim(-0.22, 0.30)
    ax.set_xlabel("KM/L real − Meta  (negativo = abaixo da meta)")
    ax.set_title("Distância da Meta por Linha, com Velocidade Média (Junho/2026)", fontsize=12, fontweight="bold", color=DARK)
    for s in ["top", "right", "left"]:
        ax.spines[s].set_visible(False)
    ax.grid(axis="x", linestyle=":", alpha=0.4)
    fig.tight_layout()
    fig.savefig(OUT / "v3_linha_meta.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_motoristas_lollipop(data, title, fname, color):
    fig, ax = plt.subplots(figsize=(5.6, 4.0))
    names = [d[0].title() for d in data]
    kml = [d[2] for d in data]
    meta = [d[3] for d in data]
    y = list(range(len(data)))
    for i in y:
        ax.plot([meta[i], kml[i]], [i, i], color="#cbd5e1", linewidth=2, zorder=1)
    ax.scatter(kml, y, color=color, s=70, zorder=3, label="KM/L real")
    ax.scatter(meta, y, color=DARK, s=36, marker="D", zorder=3, label="Meta")
    ax.set_yticks(y); ax.set_yticklabels(names, fontsize=7.6)
    ax.invert_yaxis()
    ax.set_title(title, fontsize=10.5, fontweight="bold", color=DARK)
    ax.legend(loc="lower right", fontsize=7, frameon=False)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    ax.grid(axis="x", linestyle=":", alpha=0.5)
    fig.tight_layout()
    fig.savefig(OUT / fname, dpi=150, transparent=True)
    plt.close(fig)


def chart_tornado(data, title, fname):
    fig, ax = plt.subplots(figsize=(6.0, 3.9))
    names = [d[0].title() for d in data]
    vals = [d[3] for d in data]
    y = range(len(data))
    colors = [GREEN if v >= 0 else RED for v in vals]
    ax.barh(list(y), vals, color=colors, height=0.6)
    for i, v in enumerate(vals):
        ax.text(v + (0.4 if v >= 0 else -0.4), i, pct(v), va="center", ha="left" if v >= 0 else "right", fontsize=7.6, fontweight="bold", color=DARK)
    ax.axvline(0, color="#94a3b8", linewidth=1)
    ax.set_yticks(list(y)); ax.set_yticklabels(names, fontsize=7.4)
    ax.invert_yaxis()
    ax.set_title(title, fontsize=10.8, fontweight="bold", color=DARK)
    ax.set_xlabel("Variação KM/L Maio→Junho (%)")
    for s in ["top", "right", "left"]:
        ax.spines[s].set_visible(False)
    ax.grid(axis="x", linestyle=":", alpha=0.5)
    fig.tight_layout()
    fig.savefig(OUT / fname, dpi=150, transparent=True)
    plt.close(fig)


def chart_donut_tratativas():
    fig, ax = plt.subplots(figsize=(4.6, 3.9))
    itens = sorted(TRATATIVAS["por_status"].items(), key=lambda kv: -kv[1])
    labels = [STATUS_LABEL.get(k, k) for k, v in itens]
    vals = [v for k, v in itens]
    colors = [GREEN, TEAL, GOLD, RED, "#94a3b8"]
    wedges, _ = ax.pie(vals, colors=colors[:len(vals)], startangle=90, wedgeprops={"width": 0.42, "edgecolor": "white", "linewidth": 2})
    ax.text(0, 0.05, str(TRATATIVAS["total"]), ha="center", va="center", fontsize=22, fontweight="bold", color=DARK)
    ax.text(0, -0.18, "tratativas", ha="center", va="center", fontsize=9, color="#64748b")
    ax.legend(wedges, [f"{l} ({v})" for l, v in zip(labels, vals)], loc="center left", bbox_to_anchor=(1.0, 0.5), fontsize=8, frameon=False)
    ax.set_title("Tratativas do Agente Diesel — por status", fontsize=11, fontweight="bold", color=DARK)
    fig.tight_layout()
    fig.savefig(OUT / "v3_donut.png", dpi=150, transparent=True, bbox_inches="tight")
    plt.close(fig)


def chart_instrutores_eficacia():
    fig, ax = plt.subplots(figsize=(5.4, 3.9))
    nomes = [i["nome"] for i in INSTRUTORES]
    y = np.arange(len(nomes))
    h = 0.5
    taxas = [i["taxa_atingiu_meta"] for i in INSTRUTORES]
    cores = [GREEN if t >= 25 else GOLD for t in taxas]
    ax.barh(y, taxas, height=h, color=cores, zorder=2)
    for i, t in enumerate(taxas):
        n = INSTRUTORES[i]["n_com_dado"]
        ax.text(t + 0.6, i, f"{fmt(t,1)}% (n={n})", va="center", fontsize=9, fontweight="bold", color=DARK)
    ax.set_yticks(list(y)); ax.set_yticklabels(nomes, fontsize=10)
    ax.set_xlim(0, 40)
    ax.set_xlabel("% de acompanhados que atingiram a meta")
    ax.set_title("Efetividade dos Instrutores — Taxa de Sucesso", fontsize=11.5, fontweight="bold", color=DARK)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    ax.grid(axis="x", linestyle=":", alpha=0.4)
    fig.tight_layout()
    fig.savefig(OUT / "v3_instrutores_eficacia.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_instrutores_status():
    fig, ax = plt.subplots(figsize=(5.4, 3.9))
    nomes = [i["nome"] for i in INSTRUTORES]
    ok = [i["ok"] for i in INSTRUTORES]
    mon = [i["monitorando"] for i in INSTRUTORES]
    atas = [i["atas"] for i in INSTRUTORES]
    y = np.arange(len(nomes))
    ax.barh(y, ok, color=GREEN, height=0.5, label="Concluído (OK)")
    ax.barh(y, mon, left=ok, color=GOLD, height=0.5, label="Em monitoramento")
    ax.barh(y, atas, left=[a+b for a,b in zip(ok,mon)], color=RED, height=0.5, label="Virou ATA")
    for i, n in enumerate(nomes):
        total = ok[i] + mon[i] + atas[i]
        ax.text(total + 3, i, f"total {total}", va="center", fontsize=8.5, color=DARK)
    ax.set_yticks(list(y)); ax.set_yticklabels(nomes, fontsize=10)
    ax.set_xlabel("Nº de acompanhamentos por status")
    ax.set_title("Carteira de Acompanhamentos por Instrutor", fontsize=11.5, fontweight="bold", color=DARK)
    ax.legend(loc="lower right", fontsize=7.5, frameon=False)
    for s in ["top", "right"]:
        ax.spines[s].set_visible(False)
    ax.grid(axis="x", linestyle=":", alpha=0.4)
    fig.tight_layout()
    fig.savefig(OUT / "v3_instrutores_status.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_antes_depois_barras():
    fig, ax = plt.subplots(figsize=(11.2, 5.0))
    dados = sorted(ACOMPANHAMENTO, key=lambda a: a["depois"] - a["antes"])
    nomes = [a["nome"] for a in dados]
    antes = [a["antes"] for a in dados]
    depois = [a["depois"] for a in dados]
    y = np.arange(len(nomes))
    h = 0.36
    ax.barh(y + h/2, antes, height=h, color=GREY, label="Antes do acompanhamento", zorder=2)
    cores_depois = [GREEN if d >= a else RED for a, d in zip(antes, depois)]
    ax.barh(y - h/2, depois, height=h, color=cores_depois, label="Depois do acompanhamento", zorder=2)
    for i, (a, d) in enumerate(zip(antes, depois)):
        ax.text(a + 0.02, i + h/2, fmt(a, 2), va="center", fontsize=7.6, color="#475569")
        delta = d - a
        cor = GREEN if delta >= 0 else RED
        seta = "▲" if delta >= 0 else "▼"
        ax.text(d + 0.02, i - h/2, f"{fmt(d,2)}  {seta}{fmt(abs(delta),2)}", va="center", fontsize=7.6, fontweight="bold", color=cor)
    ax.axvline(META, color=DARK, linestyle=":", linewidth=1.2, label=f"Meta {fmt(META,2)}")
    ax.set_yticks(list(y)); ax.set_yticklabels(nomes, fontsize=9)
    ax.set_xlim(2.0, 3.05)
    ax.set_xlabel("KM/L")
    ax.set_title("Acompanhamento dos Instrutores — Antes x Depois (KM/L)", fontsize=12, fontweight="bold", color=DARK)
    ax.legend(loc="lower right", fontsize=8, frameon=False)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.grid(axis="x", linestyle=":", alpha=0.4)
    fig.tight_layout()
    fig.savefig(OUT / "v3_antes_depois.png", dpi=150, transparent=True)
    plt.close(fig)


def chart_meritocracia_donut():
    fig, ax = plt.subplots(figsize=(4.8, 3.9))
    itens = list(MERITOCRACIA_RESUMO["distribuicao"].items())
    labels = [k for k, v in itens]
    vals = [v for k, v in itens]
    colors = [GOLD, "#22c55e", TEAL, "#60a5fa", "#cbd5e1"]
    wedges, _ = ax.pie(vals, colors=colors[:len(vals)], startangle=90, wedgeprops={"width": 0.42, "edgecolor": "white", "linewidth": 2})
    ax.text(0, 0.05, str(MERITOCRACIA_RESUMO["motoristas_premiados"]), ha="center", va="center", fontsize=20, fontweight="bold", color=DARK)
    ax.text(0, -0.18, "premiados", ha="center", va="center", fontsize=8.5, color="#64748b")
    ax.legend(wedges, [f"{l} ({v})" for l, v in zip(labels, vals)], loc="center left", bbox_to_anchor=(1.0, 0.5), fontsize=8, frameon=False)
    ax.set_title("Meritocracia — Distribuição de Valores (Junho/2026)", fontsize=10.5, fontweight="bold", color=DARK)
    fig.tight_layout()
    fig.savefig(OUT / "v3_meritocracia.png", dpi=150, transparent=True, bbox_inches="tight")
    plt.close(fig)


def chart_divergencia_carros():
    fig, ax = plt.subplots(figsize=(6.8, 5.6))
    dados = sorted(DIVERGENCIA_CARROS, key=lambda d: d[3])
    labels = [d[0] for d in dados]
    vals = [d[3] for d in dados]
    y = range(len(labels))
    colors = [RED if v < 0 else GOLD for v in vals]
    ax.barh(list(y), vals, color=colors, height=0.55, zorder=2)
    for i, v in enumerate(vals):
        ax.text(v + (2.0 if v >= 0 else -2.0), i, pct(v), va="center", ha="left" if v >= 0 else "right", fontsize=8.4, fontweight="bold", color=DARK, zorder=3)
    ax.axvline(0, color="#94a3b8", linewidth=1)
    ax.set_yticks(list(y)); ax.set_yticklabels([f"Carro {l}" for l in labels], fontsize=8.8)
    ax.set_xlim(-46, 46)
    ax.set_xlabel("Telemetria vs Transnet — variação % do KM/L")
    ax.set_title("Maiores Divergências Telemetria x Transnet por Carro", fontsize=11, fontweight="bold", color=DARK)
    for s in ["top", "right", "left"]:
        ax.spines[s].set_visible(False)
    ax.grid(axis="x", linestyle=":", alpha=0.4)
    fig.tight_layout()
    fig.savefig(OUT / "v3_divergencia.png", dpi=150, transparent=True)
    plt.close(fig)


for f in [chart_kml_historico, chart_semanal_evolucao, chart_semanal_variacao_pct_com_kml, chart_velocidade_kml_diario, chart_velocidade_kml_dispersao,
          chart_cluster_divergente, chart_linha_meta_velocidade,
          chart_donut_tratativas, chart_instrutores_eficacia, chart_instrutores_status, chart_instrutores_diario,
          chart_antes_depois_barras, chart_meritocracia_donut, chart_divergencia_carros, chart_aderencia_carros, chart_aderencia_empresa_diaria]:
    f()
chart_motoristas_lollipop(PIORES, "Top 10 — Maior distância da meta", "v3_piores.png", RED)
chart_motoristas_lollipop(MELHORES, "Top 10 — Melhor desempenho", "v3_melhores.png", GREEN)
chart_tornado(SINAL_ALERTA, "Sinal de Alerta — Maior Queda (Mai->Jun)", "v3_alerta.png")
chart_tornado(DESTAQUE_POSITIVO, "Destaque Positivo — Maior Evolucao (Mai->Jun)", "v3_destaque.png")
print("Graficos v3 gerados.")
