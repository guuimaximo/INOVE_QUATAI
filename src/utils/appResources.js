// Catálogo de recursos liberáveis dentro do APP (Capacitor).
// Adicione novos itens aqui — eles aparecem automaticamente na tela de Usuários
// e podem ser checados em qualquer página com canUseAppResource(user, key).

export const APP_RESOURCES = [
  // ─── Contagem ───────────────────────────────────────────────
  {
    key: "app.contagem.iniciar",
    label: "Iniciar contagem",
    description: "Botão verde grande na home da Contagem.",
    category: "Contagem",
  },
  {
    key: "app.contagem.diaria",
    label: "Contar como Diária",
    description: "Permite escolher o tipo Diária ao apontar.",
    category: "Contagem",
  },
  {
    key: "app.contagem.semanal",
    label: "Contar como Semanal",
    description: "Permite escolher o tipo Semanal ao apontar.",
    category: "Contagem",
  },
  {
    key: "app.contagem.lubrificantes",
    label: "Contar como Lubrificantes",
    description: "Permite escolher o tipo Lubrificantes ao apontar.",
    category: "Contagem",
  },
  {
    key: "app.contagem.ver_lotes",
    label: "Ver lotes anteriores",
    description: "Mostra a Central de Contagens recentes.",
    category: "Contagem",
  },
  {
    key: "app.contagem.scanner",
    label: "Usar leitor de código de barras",
    description: "Libera o botão da câmera. Sem isso, só digitação manual.",
    category: "Contagem",
  },

  // ─── Troca de Pneus ─────────────────────────────────────────
  {
    key: "app.pneus.abrir",
    label: "Abrir módulo Troca de Pneus",
    description: "Tile da home mobile que entra no módulo.",
    category: "Troca de Pneus",
  },
  {
    key: "app.pneus.auditar",
    label: "Auditar pneus",
    description: "Permite registrar auditorias de pneus em frota.",
    category: "Troca de Pneus",
  },
  {
    key: "app.pneus.trocar",
    label: "Lançar troca",
    description: "Libera o registro de uma troca de pneus.",
    category: "Troca de Pneus",
  },
  {
    key: "app.pneus.estoque",
    label: "Gerenciar estoque",
    description: "Movimentar entradas, saídas e ajustes do estoque de pneus.",
    category: "Troca de Pneus",
  },
  {
    key: "app.pneus.conserto",
    label: "Enviar para conserto",
    description: "Manda pneus para borracharia/conserto externo.",
    category: "Troca de Pneus",
  },

  // ─── Controle de Fichas ─────────────────────────────────────
  {
    key: "app.fichas.abrir",
    label: "Abrir módulo Fichas",
    description: "Tile da home mobile que entra em Controle de Fichas.",
    category: "Controle de Fichas",
  },
  {
    key: "app.fichas.entregar",
    label: "Entregar fichas",
    description: "Permite registrar a entrega de fichas para o supervisor.",
    category: "Controle de Fichas",
  },
  {
    key: "app.fichas.acompanhar",
    label: "Acompanhar até o Transnet",
    description: "Visualiza o histórico de cada ficha até o destino final.",
    category: "Controle de Fichas",
  },

  // ─── Embarcados ─────────────────────────────────────────────
  {
    key: "app.embarcados.abrir",
    label: "Abrir módulo Embarcados",
    description: "Tile da home mobile que entra na Central de Embarcados.",
    category: "Embarcados",
  },
  {
    key: "app.embarcados.movimentacoes",
    label: "Registrar movimentações",
    description: "Lançar instalação, troca, retirada e remanejo de equipamento.",
    category: "Embarcados",
  },
  {
    key: "app.embarcados.reparos",
    label: "Abrir / acompanhar reparos",
    description: "Solicitar reparo e atualizar execução dos equipamentos.",
    category: "Embarcados",
  },
  {
    key: "app.embarcados.envio_manutencao",
    label: "Enviar para manutenção",
    description: "Despachar embarcados para a oficina externa.",
    category: "Embarcados",
  },
];

export const APP_RESOURCES_POR_CATEGORIA = APP_RESOURCES.reduce((acc, r) => {
  if (!acc[r.category]) acc[r.category] = [];
  acc[r.category].push(r);
  return acc;
}, {});

// Atalhos pré-definidos pra facilitar o setup
export const APP_RESOURCE_PRESETS = [
  {
    key: "todos",
    label: "Tudo (operador completo)",
    recursos: APP_RESOURCES.map((r) => r.key),
  },
  {
    key: "contador_simples",
    label: "Contador básico",
    recursos: [
      "app.contagem.iniciar",
      "app.contagem.diaria",
      "app.contagem.scanner",
      "app.contagem.ver_lotes",
    ],
  },
  {
    key: "borracheiro_basico",
    label: "Borracheiro",
    recursos: [
      "app.pneus.abrir",
      "app.pneus.auditar",
      "app.pneus.trocar",
      "app.pneus.estoque",
      "app.pneus.conserto",
    ],
  },
  {
    key: "fichas_supervisor",
    label: "Supervisor de fichas",
    recursos: [
      "app.fichas.abrir",
      "app.fichas.entregar",
      "app.fichas.acompanhar",
    ],
  },
  {
    key: "embarcados_completo",
    label: "Embarcados completo",
    recursos: [
      "app.embarcados.abrir",
      "app.embarcados.movimentacoes",
      "app.embarcados.reparos",
      "app.embarcados.envio_manutencao",
    ],
  },
  {
    key: "nenhum",
    label: "Nenhum (bloqueado)",
    recursos: [],
  },
];

export function canUseAppResource(user, key) {
  if (!user) return false;
  // Administrador libera tudo
  const nivel = String(user.nivel || "").trim().toLowerCase();
  if (nivel === "administrador" || nivel === "admin") return true;
  const recursos = Array.isArray(user.app_recursos) ? user.app_recursos : [];
  return recursos.includes(key);
}
