import { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabase";
import { AuthContext } from "../context/AuthContext";

const acoes = [
  "Orientação", "Advertência", "Suspensão", "Aviso de última oportunidade",
  "Contato Pessoal", "Não aplicada", "Contato via Celular", "Elogiado",
];

function isValidUUID(v) {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v).trim());
}

function pickUserUuid(user) {
  if (isValidUUID(user?.auth_user_id)) return user.auth_user_id;
  if (isValidUUID(user?.id)) return user.id;
  return null;
}

export default function Diesel_Tratativas_tratar() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useContext(AuthContext);

  const [t, setT] = useState(null);
  const [resumo, setResumo] = useState("");
  const [acao, setAcao] = useState("Orientação");
  const [anexoTratativa, setAnexoTratativa] = useState(null);
  const [loading, setLoading] = useState(false);
  const [linhaDescricao, setLinhaDescricao] = useState("");
  const [cargoMotorista, setCargoMotorista] = useState("MOTORISTA");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    tipo_ocorrencia: "", prioridade: "Média", setor_origem: "", linha: "", descricao: "",
  });

  const [diasSusp, setDiasSusp] = useState(1);
  const [dataSuspensao, setDataSuspensao] = useState(() => new Date().toISOString().slice(0, 10));

  const dataPtCompletaUpper = (d = new Date()) => {
    const meses = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO", "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"];
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = meses[d.getMonth()];
    const ano = d.getFullYear();
    return `${dia} de ${mes} de ${ano}`;
  };

  const br = (d) => {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("pt-BR");
  };

  const brDateTime = (d) => {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleString("pt-BR");
  };

  const parseDateLocal = (dateStr) => {
    if (!dateStr) return new Date();
    const [yyyy, mm, dd] = String(dateStr).split("-").map(Number);
    return new Date(yyyy, (mm || 1) - 1, dd || 1);
  };

  const addDaysLocal = (dateOrStr, n) => {
    const base = dateOrStr instanceof Date ? new Date(dateOrStr) : parseDateLocal(dateOrStr);
    base.setDate(base.getDate() + Number(n || 0));
    return base;
  };

  const inicioSusp = useMemo(() => parseDateLocal(dataSuspensao), [dataSuspensao]);
  const fimSusp = useMemo(() => addDaysLocal(inicioSusp, Math.max(Number(diasSusp) - 1, 0)), [inicioSusp, diasSusp]);
  const retornoSusp = useMemo(() => addDaysLocal(inicioSusp, Math.max(Number(diasSusp), 0)), [inicioSusp, diasSusp]);

  const fileNameFromUrl = (u) => {
    try {
      const last = String(u || "").split("#")[0].split("?")[0].split("/").filter(Boolean).pop() || "arquivo";
      return decodeURIComponent(last);
    } catch { return "arquivo"; }
  };

  const isPdf = (fileOrUrl) => {
    if (!fileOrUrl) return false;
    if (typeof fileOrUrl === "string") return fileOrUrl.toLowerCase().includes(".pdf");
    return fileOrUrl.type === "application/pdf" || String(fileOrUrl.name || "").toLowerCase().endsWith(".pdf");
  };

  const isImageUrl = (u) => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(String(u || "").toLowerCase());

  const renderEvidenciasGrid = (urls, label) => {
    const arr = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (arr.length === 0) return null;
    return (
      <div className="mt-3">
        <span className="block text-sm text-gray-600 mb-2">{label}</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {arr.map((u, i) => {
            const pdf = isPdf(u);
            const img = !pdf && isImageUrl(u);
            const name = fileNameFromUrl(u);
            if (img) {
              return (
                <a key={`${u}-${i}`} href={u} target="_blank" rel="noopener noreferrer" className="group rounded-lg border bg-white overflow-hidden hover:shadow-sm" title="Abrir evidência">
                  <div className="relative"><img src={u} alt={name} className="h-24 w-full object-cover group-hover:opacity-95" loading="lazy" /></div>
                  <div className="px-2 py-1.5 text-xs text-gray-700 truncate">{name}</div>
                </a>
              );
            }
            return (
              <a key={`${u}-${i}`} href={u} target="_blank" rel="noopener noreferrer" className="rounded-lg border bg-white p-3 hover:shadow-sm" title="Abrir evidência">
                <div className="flex items-start justify-between gap-2"><span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">{pdf ? "PDF" : "ARQ"}</span></div>
                <div className="mt-2 text-xs text-blue-700 underline break-words">{name}</div>
              </a>
            );
          })}
        </div>
      </div>
    );
  };

  const renderArquivoOuThumb = (url, label) => {
    if (!url) return null;
    const pdf = isPdf(url);
    const img = !pdf && isImageUrl(url);
    const name = fileNameFromUrl(url);
    return (
      <div className="mt-2">
        <span className="block text-sm text-gray-600 mb-2">{label}</span>
        {pdf || !img ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg border bg-white p-3 hover:shadow-sm" title="Abrir arquivo">
            <div className="flex items-center justify-between"><span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">{pdf ? "PDF" : "ARQ"}</span></div>
            <div className="mt-2 text-sm text-blue-700 underline break-words">{name}</div>
          </a>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir imagem" className="inline-block">
            <img src={url} alt={name} className="h-24 w-24 rounded-lg border object-cover hover:opacity-90" loading="lazy" />
          </a>
        )}
      </div>
    );
  };

  const [previewObjUrl, setPreviewObjUrl] = useState(null);
  useEffect(() => {
    if (!anexoTratativa) {
      if (previewObjUrl) URL.revokeObjectURL(previewObjUrl);
      setPreviewObjUrl(null);
      return;
    }
    const url = URL.createObjectURL(anexoTratativa);
    setPreviewObjUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  }, [anexoTratativa]);

  useEffect(() => {
    return () => { if (previewObjUrl) URL.revokeObjectURL(previewObjUrl); };
  }, [previewObjUrl]);

  const renderPreviewSelecionado = () => {
    if (!anexoTratativa) return null;
    const pdf = isPdf(anexoTratativa);
    const name = anexoTratativa.name || "arquivo";
    if (pdf) {
      return (
        <div className="mt-3 rounded-lg border bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">PDF</span>
            <button type="button" onClick={() => setAnexoTratativa(null)} className="text-xs text-gray-500 hover:text-gray-700" title="Remover arquivo">Remover</button>
          </div>
          <div className="mt-2 text-sm text-gray-700 break-words">{name}</div>
        </div>
      );
    }
    return (
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Pré-visualização</span>
          <button type="button" onClick={() => setAnexoTratativa(null)} className="text-xs text-gray-500 hover:text-gray-700" title="Remover arquivo">Remover</button>
        </div>
        <img src={previewObjUrl} alt={name} className="mt-2 h-28 w-28 rounded-lg border object-cover" />
        <div className="mt-1 text-xs text-gray-600 break-words">{name}</div>
      </div>
    );
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("atas_diesel").select("*").eq("id", id).single();
      if (error) { console.error(error); return; }
      setT(data || null);

      setEditForm({
        tipo_ocorrencia: data?.tipo_ocorrencia || "",
        prioridade: data?.prioridade || "Média",
        setor_origem: data?.setor_origem || "",
        linha: data?.linha || "",
        descricao: data?.descricao || "",
      });

      if (data?.linha) {
        const { data: row } = await supabase.from("linhas").select("descricao").eq("codigo", data.linha).maybeSingle();
        setLinhaDescricao(row?.descricao || "");
      } else setLinhaDescricao("");

      if (data?.motorista_chapa) {
        const { data: m } = await supabase.from("motoristas").select("cargo").eq("chapa", data.motorista_chapa).maybeSingle();
        setCargoMotorista((m?.cargo || data?.cargo || "Motorista").toUpperCase());
      } else {
        setCargoMotorista((data?.cargo || "Motorista").toUpperCase());
      }
    })();
  }, [id]);

  async function salvarEdicao() {
    if (!t) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("atas_diesel").update({
        tipo_ocorrencia: editForm.tipo_ocorrencia || null,
        prioridade: editForm.prioridade || null,
        setor_origem: editForm.setor_origem || null,
        linha: editForm.linha || null,
        descricao: editForm.descricao || null,
      }).eq("id", t.id);
      if (error) throw error;

      setT((prev) => (prev ? { ...prev, ...editForm } : prev));

      if (editForm.linha) {
        const { data: row } = await supabase.from("linhas").select("descricao").eq("codigo", editForm.linha).maybeSingle();
        setLinhaDescricao(row?.descricao || "");
      } else setLinhaDescricao("");

      setIsEditing(false);
      alert("Dados atualizados!");
    } catch (e) {
      alert(`Erro ao salvar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function concluir() {
    if (!t) return;
    if (!resumo) {
      alert("Informe o resumo/observações");
      return;
    }

    setLoading(true);
    try {
      let anexo_tratativa_url = null;
      if (anexoTratativa) {
        const safe = `anexo_${Date.now()}_${anexoTratativa.name}`.replace(/\s+/g, "_");
        const up = await supabase.storage.from("atas_diesel").upload(safe, anexoTratativa, { upsert: false, contentType: anexoTratativa.type || undefined });
        if (up.error) throw up.error;
        anexo_tratativa_url = supabase.storage.from("atas_diesel").getPublicUrl(safe).data.publicUrl;
      }

      const tratadoPorId = pickUserUuid(user);
      const tratadoPorLogin = user?.login || user?.email || null;
      const tratadoPorNome = user?.nome_completo || user?.nome || user?.login || user?.email || null;

      const ins = await supabase.from("atas_diesel_detalhes").insert({
        ata_id: t.id,
        acao_aplicada: acao,
        observacoes: resumo,
        anexo_tratativa: anexo_tratativa_url,
        tratado_por_login: tratadoPorLogin,
        tratado_por_nome: tratadoPorNome,
        tratado_por_id: tratadoPorId,
      });
      if (ins.error) throw ins.error;

      const upd = await supabase.from("atas_diesel").update({ status: "Concluída" }).eq("id", t.id);
      if (upd.error) throw upd.error;

      alert("Ata concluída com sucesso!");
      nav("/central");
    } catch (e) {
      alert(`Erro: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  function baseCssCourier() {
    return `
      <style>
        @page { size: A4; margin: 25mm; }
        html, body { height: 100%; }
        body { font-family: "Courier New", Courier, monospace; color:#000; font-size: 14px; line-height: 1.55; margin: 0; }
        .page { min-height: 100vh; display: flex; flex-direction: column; }
        .content { padding: 0; }
        .linha { display:flex; justify-content:space-between; gap:16px; }
        .mt { margin-top: 16px; }
        .center { text-align: center; font-weight: bold; }
        .right { text-align: right; }
        .bl { white-space: pre-wrap; }
        .label { font-weight: bold; }
        .footer-sign { margin-top: auto; }
        .ass-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 28px; }
        .ass { text-align: center; }
        .ass-line { margin-top: 34px; border-top: 1px solid #000; height:1px; }
      </style>
    `;
  }

  function renderSuspensaoHtml({ nome, registro, cargo, ocorrencia, dataOcorr, observ, dataDoc, dias, inicio, fim, retorno }) {
    const brLocal = (d) => {
      const dt = d instanceof Date ? d : new Date(d);
      return Number.isNaN(dt.getTime()) ? "—" : dt.toLocaleDateString("pt-BR");
    };
    const diasFmt = String(dias).padStart(2, "0");
    const rotuloDia = Number(dias) === 1 ? "dia" : "dias";

    return `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4; margin: 25mm; }
        html, body { height: 100%; }
        body { font-family: "Courier New", Courier, monospace; font-size: 14px; line-height: 1.7; color: #000; margin: 0; }
        .page { min-height: 100vh; display: flex; flex-direction: column; }
        .content { max-width: 80ch; margin: 0 auto; }
        .center { text-align: center; font-weight: bold; }
        .right { text-align: right; }
        .linha { display:flex; justify-content:space-between; gap:16px; }
        .mt { margin-top: 18px; }
        .label { font-weight: bold; }
        .bl { white-space: pre-wrap; text-align: left; }
        .nowrap { white-space: nowrap; }
        .footer-sign { margin-top: auto; }
        .ass-grid { display:grid; grid-template-columns: 1fr 1fr; gap: 28px; }
        .ass { text-align:center; }
        .ass-line { margin-top: 36px; border-top:1px solid #000; height:1px; }
      </style>
      <title>SUSPENSÃO DISCIPLINAR - ${nome}</title>
    </head>
    <body>
      <div class="page">
        <div class="content">
          <div class="center">SUSPENSÃO DISCIPLINAR</div>
          <div class="right mt">${dataDoc}</div>
          <div class="linha mt">
            <div>SR(A) <span class="label">${nome}</span> ${registro ? `(REGISTRO: ${registro})` : ""}</div>
            <div><span class="label">Cargo:</span> ${cargo}</div>
          </div>
          <p class="mt bl">Pelo presente, notificamos que, por ter o senhor cometido a falta abaixo descrita, encontra-se suspenso do serviço por <span class="label nowrap">${diasFmt} ${rotuloDia}</span>, <span class="nowrap">a partir de <span class="label">${brLocal(inicio)}</span></span>, devendo, portanto, apresentar-se ao mesmo, no horário usual, <span class="nowrap">no dia <span class="label">${brLocal(retorno)}</span></span>, salvo outra resolução nossa, que lhe daremos parte se for o caso e, assim, pedimos a devolução do presente com o seu “ciente”.</p>
          <div class="mt"><span class="label">Ocorrência:</span> ${ocorrencia}</div>
          <div class="mt"><span class="label">Data da Ocorrência:</span> ${dataOcorr}</div>
          <div class="mt"><span class="label">Período da Suspensão:</span> ${brLocal(inicio)} a ${brLocal(fim)} (retorno: ${brLocal(retorno)})</div>
          <div class="mt"><span class="label">Observação:</span> ${observ}</div>
          <div class="mt"><span class="label">Ciente e Concordo:</span> ________/______/__________</div>
        </div>
        <div class="footer-sign mt">
          <div class="ass-grid">
            <div class="ass"><div class="ass-line"></div>Assinatura do Empregado</div>
            <div class="ass"><div class="ass-line"></div>Assinatura do Empregador</div>
          </div>
          <div class="ass-grid" style="margin-top:20px">
            <div class="ass"><div class="ass-line"></div>Testemunha &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CPF:</div>
            <div class="ass"><div class="ass-line"></div>Testemunha &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CPF:</div>
          </div>
        </div>
      </div>
      <script>window.onload = () => { window.print(); }</script>
    </body>
  </html>
  `;
  }

  function renderGenericHtml({ titulo, intro1, intro2, nome, registro, cargo, ocorrencia, dataOcorr, observ, dataDoc }) {
    return `
      <html>
        <head>
          <meta charset="utf-8" />
          ${baseCssCourier()}
          <title>${titulo} - ${nome}</title>
        </head>
        <body>
          <div class="page">
            <div class="content">
              <div class="center">${titulo}</div>
              <div class="right mt">${dataDoc}</div>
              <div class="linha mt">
                <div>SR(A) <span class="label">${nome}</span> ${registro ? `(REGISTRO: ${registro})` : ""}</div>
                <div><span class="label">Cargo:</span> ${cargo}</div>
              </div>
              <p class="mt bl">${intro1}</p>
              <p class="bl">${intro2}</p>
              <div class="mt"><span class="label">Ocorrência:</span> ${ocorrencia}</div>
              <div class="mt"><span class="label">Data da Ocorrência:</span> ${dataOcorr}</div>
              <div class="mt"><span class="label">Observação:</span> ${observ}</div>
              <div class="mt"><span class="label">Ciente e Concordo:</span> ________/______/__________</div>
            </div>
            <div class="footer-sign mt">
              <div class="ass-grid">
                <div class="ass"><div class="ass-line"></div>Assinatura do Empregado</div>
                <div class="ass"><div class="ass-line"></div>Assinatura do Empregador</div>
              </div>
              <div class="ass-grid" style="margin-top:20px">
                <div class="ass"><div class="ass-line"></div>Testemunha &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CPF:</div>
                <div class="ass"><div class="ass-line"></div>Testemunha &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CPF:</div>
              </div>
            </div>
          </div>
          <script>window.onload = () => { window.print(); }</script>
        </body>
      </html>
    `;
  }

  function gerarOrientacao() {
    if (!t) return;
    if (!resumo.trim()) { alert("Preencha o Resumo / Observações para gerar a medida."); return; }
    const html = renderGenericHtml({
      titulo: "ORIENTAÇÃO DISCIPLINAR",
      intro1: "Vimos pelo presente, aplicar-lhe a pena de orientação disciplinar, em virtude de o(a) senhor(a) ter cometido a falta abaixo descrita.",
      intro2: "Pedimos que tal falta não mais se repita, pois, caso contrário, seremos obrigados a adotar medidas mais severas que nos são facultadas pela lei.",
      nome: (t.motorista_nome || "—").toUpperCase(),
      registro: t.motorista_chapa || "",
      cargo: cargoMotorista,
      ocorrencia: (t.tipo_ocorrencia || "—").toUpperCase(),
      dataOcorr: t.data_ocorrido ? br(t.data_ocorrido) : "—",
      observ: (resumo || t.descricao || "").trim() || "—",
      dataDoc: dataPtCompletaUpper(new Date()),
    });
    const w = window.open("", "_blank"); w.document.write(html); w.document.close();
  }

  function gerarAdvertencia() {
    if (!t) return;
    if (!resumo.trim()) { alert("Preencha o Resumo / Observações para gerar a medida."); return; }
    const html = renderGenericHtml({
      titulo: "ADVERTÊNCIA DISCIPLINAR",
      intro1: "Vimos pelo presente, aplicar-lhe a pena de advertência disciplinar, em virtude de o(a) senhor(a) ter cometido a falta abaixo descrita.",
      intro2: "Pedimos que tal falta não mais se repita, pois, caso contrário, seremos obrigados a adotar medidas mais severas, nos termos da lei.",
      nome: (t.motorista_nome || "—").toUpperCase(),
      registro: t.motorista_chapa || "",
      cargo: cargoMotorista,
      ocorrencia: (t.tipo_ocorrencia || "—").toUpperCase(),
      dataOcorr: t.data_ocorrido ? br(t.data_ocorrido) : "—",
      observ: (resumo || t.descricao || "").trim() || "—",
      dataDoc: dataPtCompletaUpper(new Date()),
    });
    const w = window.open("", "_blank"); w.document.write(html); w.document.close();
  }

  function gerarSuspensao() {
    if (!t) return;
    if (!resumo.trim()) { alert("Preencha o Resumo / Observações para gerar a medida."); return; }
    const html = renderSuspensaoHtml({
      nome: (t.motorista_nome || "—").toUpperCase(),
      registro: t.motorista_chapa || "",
      cargo: cargoMotorista,
      ocorrencia: (t.tipo_ocorrencia || "—").toUpperCase(),
      dataOcorr: t.data_ocorrido ? br(t.data_ocorrido) : "—",
      observ: (resumo || t.descricao || "").trim() || "—",
      dataDoc: dataPtCompletaUpper(new Date()),
      dias: diasSusp,
      inicio: inicioSusp,
      fim: fimSusp,
      retorno: retornoSusp,
    });
    const w = window.open("", "_blank"); w.document.write(html); w.document.close();
  }

  if (!t) return <div className="p-6">Carregando…</div>;

  const evidenciasSolicitacao = Array.isArray(t.evidencias_urls) && t.evidencias_urls.length > 0
    ? t.evidencias_urls
    : t.imagem_url ? [t.imagem_url] : [];

  const criadoPor = t.criado_por_nome || t.criado_por_login || "—";
  const criadoEm = brDateTime(t.created_at);

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold mb-2">Tratar</h1>

      <div className="text-sm text-blue-700 mb-4">
        <span className="font-semibold">Criado por:</span> {criadoPor}{" "}
        <span className="mx-2 text-blue-300">•</span>
        <span className="font-semibold">Data/Hora:</span> {criadoEm}
      </div>

      <p className="text-gray-600 mb-6">Revise os dados, anexe o anexo e gere a medida.</p>

      <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="text-lg font-semibold">Detalhes da ata</h2>
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="rounded-md bg-yellow-500 px-3 py-2 text-white hover:bg-yellow-600">Editar dados</button>
          ) : (
            <div className="flex gap-2">
              <button onClick={salvarEdicao} disabled={loading} className="rounded-md bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:opacity-60">Salvar</button>
              <button onClick={() => { setIsEditing(false); setEditForm({ tipo_ocorrencia: t.tipo_ocorrencia || "", prioridade: t.prioridade || "Média", setor_origem: t.setor_origem || "", linha: t.linha || "", descricao: t.descricao || "" }); }} className="rounded-md bg-gray-400 px-3 py-2 text-white hover:bg-gray-500">Cancelar</button>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Item titulo="Motorista" valor={`${t.motorista_nome || "-"}`} />
          <Item titulo="Registro" valor={t.motorista_chapa || "-"} />
          <Item titulo="Ocorrência" valor={isEditing ? <input className="w-full border rounded px-2 py-1" value={editForm.tipo_ocorrencia} onChange={(e) => setEditForm((s) => ({ ...s, tipo_ocorrencia: e.target.value }))} /> : t.tipo_ocorrencia} />
          <Item titulo="Prioridade" valor={isEditing ? <select className="w-full border rounded px-2 py-1" value={editForm.prioridade} onChange={(e) => setEditForm((s) => ({ ...s, prioridade: e.target.value }))}><option>Baixa</option><option>Média</option><option>Alta</option><option>Gravíssima</option></select> : t.prioridade} />
          <Item titulo="Setor" valor={isEditing ? <input className="w-full border rounded px-2 py-1" value={editForm.setor_origem} onChange={(e) => setEditForm((s) => ({ ...s, setor_origem: e.target.value }))} /> : t.setor_origem} />
          <Item titulo="Linha" valor={isEditing ? <input className="w-full border rounded px-2 py-1" placeholder="Código ex.: 01TR ou NA" value={editForm.linha} onChange={(e) => setEditForm((s) => ({ ...s, linha: e.target.value }))} /> : t.linha ? `${t.linha}${linhaDescricao ? ` - ${linhaDescricao}` : ""}` : "-"} />
          <Item titulo="Status" valor={t.status} />
          <Item titulo="Data/Hora" valor={`${t.data_ocorrido || "-"} ${t.hora_ocorrido || ""}`} />
          <Item className="md:col-span-2" titulo="Descrição" valor={isEditing ? <textarea className="w-full border rounded px-2 py-1" rows={3} value={editForm.descricao} onChange={(e) => setEditForm((s) => ({ ...s, descricao: e.target.value }))} /> : t.descricao || "-"} />
          <div className="md:col-span-2">
            {renderEvidenciasGrid(evidenciasSolicitacao, "Evidências da solicitação (reclamação)")}
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="text-lg font-semibold mb-3">Conclusão</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Ação aplicada</label>
            <select className="w-full rounded-md border px-3 py-2" value={acao} onChange={(e) => setAcao(e.target.value)}>
              {acoes.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {acao === "Suspensão" && (
            <>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Dias de Suspensão</label>
                <select className="w-full rounded-md border px-3 py-2" value={diasSusp} onChange={(e) => setDiasSusp(Number(e.target.value))}>
                  {[1, 3, 5, 7].map((d) => <option key={d} value={d}>{d} dia(s)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Data da Suspensão (emissão)</label>
                <input type="date" className="w-full rounded-md border px-3 py-2" value={dataSuspensao} onChange={(e) => setDataSuspensao(e.target.value)} />
              </div>
              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <Item titulo="Início" valor={br(inicioSusp)} />
                <Item titulo="Fim" valor={br(fimSusp)} />
                <Item titulo="Retorno" valor={br(retornoSusp)} />
              </div>
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-lg border bg-gray-50 p-4">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Resumo / Observações</label>
            <textarea rows={6} className="w-full rounded-md border bg-white px-3 py-2" value={resumo} onChange={(e) => setResumo(e.target.value)} placeholder="Descreva o que foi feito, conclusão, orientações, etc." />
            <p className="text-xs text-gray-500 mt-2">Esse texto vai para <b>atas_diesel_detalhes.observacoes</b>.</p>
          </div>
          <div className="rounded-lg border bg-gray-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <label className="block text-sm font-semibold text-gray-700">Anexo (opcional)</label>
              <span className="text-xs text-gray-500">imagem ou PDF</span>
            </div>
            <div className="mt-3 rounded-lg border-2 border-dashed bg-white p-4">
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setAnexoTratativa(e.target.files?.[0] || null)} className="block w-full text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700" />
              <p className="text-xs text-gray-500 mt-2">Será salvo no histórico como <b>atas_diesel_detalhes.anexo_tratativa</b>.</p>
              {renderPreviewSelecionado()}
            </div>
            {renderArquivoOuThumb(t.anexo_tratativa || null, "Anexo já anexado (se houver)")}
          </div>
        </div>

        <div className="mt-6 flex gap-3 flex-wrap">
          <button onClick={concluir} disabled={loading} className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60">{loading ? "Salvando…" : "Concluir"}</button>
          <button type="button" onClick={() => {
            if (acao === "Orientação") return gerarOrientacao();
            if (acao === "Advertência") return gerarAdvertencia();
            if (acao === "Suspensão") return gerarSuspensao();
            alert('Selecione "Orientação", "Advertência" ou "Suspensão" para gerar o documento.');
          }} className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700" title="Gerar documento conforme a ação selecionada">
            GERAR MEDIDA DISCIPLINAR
          </button>
        </div>
      </div>
    </div>
  );
}

function Item({ titulo, valor, className }) {
  return (
    <div className={className}>
      <dt className="text-sm text-gray-600">{titulo}</dt>
      <dd className="font-medium break-words">{valor}</dd>
    </div>
  );
}
