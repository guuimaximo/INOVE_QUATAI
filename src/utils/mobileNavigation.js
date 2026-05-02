function baseHome() {
  return { key: "home", label: "Inicio", path: "/" };
}

export function getMobileNavItems(nivel) {
  switch (nivel) {
    case "Administrador":
    case "Gestor":
      return [
        baseHome(),
        { key: "tratativas", label: "Central", path: "/central" },
        { key: "avarias", label: "Avarias", path: "/avarias-resumo" },
      ];
    case "RH":
      return [
        baseHome(),
        { key: "tratativas", label: "Central", path: "/central" },
        { key: "cobrancas", label: "Cobrancas", path: "/cobrancas" },
      ];
    case "Tratativa":
      return [
        baseHome(),
        { key: "tratativas", label: "Central", path: "/central" },
        { key: "cobrancas", label: "Cobrancas", path: "/cobrancas" },
      ];
    case "Manutencao":
    case "Manutenção":
      return [
        baseHome(),
        { key: "avarias", label: "Avarias", path: "/lancar-avaria" },
        { key: "sos", label: "SOS", path: "/sos-resumo" },
      ];
    case "CCO":
      return [
        baseHome(),
        { key: "sos", label: "SOS", path: "/sos-solicitacao" },
        { key: "km", label: "KM", path: "/km-rodado" },
      ];
    case "Instrutor":
      return [
        baseHome(),
        { key: "diesel", label: "Diesel", path: "/desempenho-diesel-resumo" },
        { key: "tratativas", label: "Central", path: "/diesel-tratativas" },
      ];
    case "Embarcados":
      return [
        baseHome(),
        { key: "embarcados", label: "Central", path: "/embarcados-central" },
        { key: "reparos", label: "Reparos", path: "/embarcados-reparos" },
      ];
    default:
      return [
        baseHome(),
        { key: "tratativas", label: "Central", path: "/central" },
        { key: "sos", label: "SOS", path: "/sos-resumo" },
      ];
  }
}

export function getMobileQuickLinks(nivel) {
  switch (nivel) {
    case "Administrador":
    case "Gestor":
      return [
        {
          key: "painel",
          title: "Painel de gestao",
          description: "Abra o dashboard completo quando precisar de visao executiva.",
          path: "/painel",
        },
        {
          key: "tratativas",
          title: "Central de tratativas",
          description: "Acompanhe solicitacoes, pendencias e tratativas em andamento.",
          path: "/central",
        },
        {
          key: "avarias",
          title: "Resumo de avarias",
          description: "Consulte aprovacoes, revisoes e cobrancas em um unico lugar.",
          path: "/avarias-resumo",
        },
        {
          key: "sos",
          title: "Resumo de intervencoes",
          description: "Veja o panorama operacional de SOS e acionamentos do dia.",
          path: "/sos-resumo",
        },
      ];
    case "RH":
    case "Tratativa":
      return [
        {
          key: "tratativas",
          title: "Central de tratativas",
          description: "Entre direto na fila principal para acompanhar os registros.",
          path: "/central",
        },
        {
          key: "cobrancas",
          title: "Cobrancas",
          description: "Revise cobrancas pendentes e historico financeiro relacionado.",
          path: "/cobrancas",
        },
      ];
    case "Manutencao":
    case "Manutenção":
      return [
        {
          key: "avarias",
          title: "Lancamento de avarias",
          description: "Abra um novo registro rapidamente e siga o fluxo oficial.",
          path: "/lancar-avaria",
        },
        {
          key: "sos",
          title: "Intervencoes",
          description: "Acesse o resumo e os atendimentos que exigem resposta imediata.",
          path: "/sos-resumo",
        },
        {
          key: "pcm",
          title: "PCM",
          description: "Consulte o resumo e acompanhe as rotinas do dia.",
          path: "/pcm-resumo",
        },
      ];
    case "CCO":
      return [
        {
          key: "sos",
          title: "Solicitacao SOS",
          description: "Abra um chamado de forma rapida quando houver urgencia operacional.",
          path: "/sos-solicitacao",
        },
        {
          key: "km",
          title: "KM rodado",
          description: "Consulte e atualize o acompanhamento do dia.",
          path: "/km-rodado",
        },
      ];
    case "Instrutor":
      return [
        {
          key: "diesel",
          title: "Resumo de diesel",
          description: "Acompanhe o desempenho consolidado e os indicadores atuais.",
          path: "/desempenho-diesel-resumo",
        },
        {
          key: "tratativas",
          title: "Tratativas de diesel",
          description: "Entre na central para analisar as ocorrencias em aberto.",
          path: "/diesel-tratativas",
        },
      ];
    case "Embarcados":
      return [
        {
          key: "embarcados",
          title: "Central de embarcados",
          description: "Veja os registros principais e o andamento do setor.",
          path: "/embarcados-central",
        },
        {
          key: "reparos",
          title: "Reparos",
          description: "Acesse rapidamente os itens em manutencao e execucao.",
          path: "/embarcados-reparos",
        },
      ];
    default:
      return [
        {
          key: "tratativas",
          title: "Central",
          description: "Entre direto no fluxo principal do seu setor.",
          path: "/central",
        },
      ];
  }
}
