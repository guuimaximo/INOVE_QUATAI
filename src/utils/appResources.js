// Catálogo de recursos liberáveis dentro do APP (Capacitor).
// Adicione novos itens aqui — eles aparecem automaticamente na tela de Usuários.

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
