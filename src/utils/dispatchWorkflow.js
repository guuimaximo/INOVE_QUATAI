const GH_USER = String(import.meta.env.VITE_GITHUB_USER || "").trim();
const GH_REPO = String(import.meta.env.VITE_GITHUB_REPO || "").trim();
const GH_TOKEN = String(import.meta.env.VITE_GITHUB_TOKEN || "").trim();
const GH_REF = String(import.meta.env.VITE_GITHUB_REF || "main").trim();

function assertWorkflowConfig() {
  const missing = [];
  if (!GH_USER) missing.push("VITE_GITHUB_USER");
  if (!GH_REPO) missing.push("VITE_GITHUB_REPO");
  if (!GH_TOKEN) missing.push("VITE_GITHUB_TOKEN");

  if (missing.length) {
    throw new Error(
      `Configuracao do GitHub ausente para disparar workflows: ${missing.join(", ")}.`
    );
  }
}

export async function dispatchWorkflow(workflowFile, inputs = {}) {
  assertWorkflowConfig();

  const response = await fetch(
    `https://api.github.com/repos/${GH_USER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${GH_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ref: GH_REF,
        inputs,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Falha ao disparar workflow ${workflowFile}: ${response.status} ${text}`);
  }

  return true;
}
