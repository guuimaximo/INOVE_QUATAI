import { useEffect, useMemo, useState, useContext } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../supabase";
import { AuthContext } from "../../context/AuthContext";
import {
  FaGavel,
  FaUser,
  FaIdBadge,
  FaExclamationTriangle,
  FaFlag,
  FaBuilding,
  FaBus,
  FaInfoCircle,
  FaCalendarAlt,
  FaClipboardList,
  FaSave,
  FaEdit,
  FaArrowLeft,
} from "react-icons/fa";

const acoes = [
  "Orientação",
  "Advertência",
  "Suspensão",
  "Aviso de última oportunidade",
  "Contato Pessoal",
  "Não aplicada",
  "Contato via Celular",
  "Elogiado",
];

function isValidUUID(v) {
  if (!v) return false;
  const s = String(v).trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s
  );
}

function pickUserUuid(user) {
  if (isValidUUID(user?.auth_user_id)) return user.auth_user_id;
  if (isValidUUID(user?.id)) return user.id;
  return null;
}

function norm(v) {
  return String(v || "").trim();
}

export default function TratarTratativa() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useContext(AuthContext);

  const [t, setT] = useState(null);
  const [resumo, setResumo] = useState("");
  const [acao, setAcao] = useState("Orientação");

  const [anexoTratativa, setAnexoTratativa] = useState(null);
  const [anexoVale, setAnexoVale] = useState(null);

  const [loading, setLoading] = useState(false);

  const [linhaDescricao, setLinhaDescricao] = useState("");
  const [cargoMotorista, setCargoMotorista] = useState("MOTORISTA");

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    tipo_ocorrencia: "",
    prioridade: "Média",
    setor_origem: "",
    linha: "",
    descricao: "",
  });

  const [diasSusp, setDiasSusp] = useState(1);
  const [dataSuspensao, setDataSuspensao] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  const isFaltaDeFeria = useMemo(() => {
    const ocorr = norm(
      isEditing ? editForm.tipo_ocorrencia : t?.tipo_ocorrencia
    ).toLowerCase();
    return ocorr === "falta de féria" || ocorr === "falta de feria";
  }, [t?.tipo_ocorrencia, editForm.tipo_ocorrencia, isEditing]);

  const dataPtCompletaUpper = (d = new Date()) => {
    const meses = [
      "JANEIRO",
      "FEVEREIRO",
      "MARÇO",
      "ABRIL",
      "MAIO",
      "JUNHO",
      "JULHO",
      "AGOSTO",
      "SETEMBRO",
      "OUTUBRO",
      "NOVEMBRO",
      "DEZEMBRO",
    ];
    const dia = String(d.getDate()).padStart(2, "0");
    const mes = meses[d.getMonth()];
    const ano = d.getFullYear();
    return `${dia} de ${mes} de ${ano}`;
  };

  const br = (d) => {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleDateString("pt-BR");
  };

  const brDateTime = (d) => {
    if (!d) return "—";
    const dt = d instanceof Date ? d : new Date(d);
    if (Number.isNaN(dt.getTime())) return "—";
    return dt.toLocaleString("pt-BR");
  };

  const parseDateLocal = (dateStr) => {
    if (!dateStr) return new Date();
    const [yyyy, mm, dd] = String(dateStr).split("-").map(Number);
    return new Date(yyyy, (mm || 1) - 1, dd || 1);
  };

  const addDaysLocal = (dateOrStr, n) => {
    const base =
      dateOrStr instanceof Date ? new Date(dateOrStr) : parseDateLocal(dateOrStr);
    base.setDate(base.getDate() + Number(n || 0));
    return base;
  };

  const inicioSusp = useMemo(() => parseDateLocal(dataSuspensao), [dataSuspensao]);

  const fimSusp = useMemo(
    () => addDaysLocal(inicioSusp, Math.max(Number(diasSusp) - 1, 0)),
    [inicioSusp, diasSusp]
  );

  const retornoSusp = useMemo(
    () => addDaysLocal(inicioSusp, Math.max(Number(diasSusp), 0)),
    [inicioSusp, diasSusp]
  );

  const fileNameFromUrl = (u) => {
    try {
      const raw = String(u || "");
      const noHash = raw.split("#")[0];
      const noQuery = noHash.split("?")[0];
      const last = noQuery.split("/").filter(Boolean).pop() || "arquivo";
      return decodeURIComponent(last);
    } catch {
      return "arquivo";
    }
  };

  const isPdf = (fileOrUrl) => {
    if (!fileOrUrl) return false;
    if (typeof fileOrUrl === "string") return fileOrUrl.toLowerCase().includes(".pdf");
    return (
      fileOrUrl.type === "application/pdf" ||
      String(fileOrUrl.name || "").toLowerCase().endsWith(".pdf")
    );
  };

  const isImageUrl = (u) => {
    const s = String(u || "").toLowerCase();
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(s);
  };

  const renderEvidenciasGrid = (urls, label) => {
    const arr = Array.isArray(urls) ? urls.filter(Boolean) : [];
    if (arr.length === 0) return null;

    return (
      <div className="mt-3">
        <span className="block text-sm text-slate-500 mb-2 font-semibold">{label}</span>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {arr.map((u, i) => {
            const pdf = isPdf(u);
            const img = !pdf && isImageUrl(u);
            const name = fileNameFromUrl(u);

            if (img) {
              return (
                <a
                  key={`${u}-${i}`}
                  href={u}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-xl border bg-white overflow-hidden hover:shadow-sm"
                  title="Abrir evidência"
                >
                  <img
                    src={u}
                    alt={name}
                    className="h-24 w-full object-cover group-hover:opacity-95"
                    loading="lazy"
                  />
                  <div className="px-2 py-1.5 text-xs text-slate-700 truncate">
                    {name}
                  </div>
                </a>
              );
            }

            return (
              <a
                key={`${u}-${i}`}
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border bg-white p-3 hover:shadow-sm"
                title="Abrir evidência"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {pdf ? "PDF" : "ARQ"}
                  </span>
                </div>
                <div className="mt-2 text-xs text-blue-700 underline break-words">
                  {name}
                </div>
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
        <span className="block text-sm text-slate-500 mb-2 font-semibold">{label}</span>

        {pdf || !img ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border bg-white p-3 hover:shadow-sm"
            title="Abrir arquivo"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                {pdf ? "PDF" : "ARQ"}
              </span>
            </div>
            <div className="mt-2 text-sm text-blue-700 underline break-words">{name}</div>
          </a>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            title="Abrir imagem"
            className="inline-block"
          >
            <img
              src={url}
              alt={name}
              className="h-24 w-24 rounded-xl border object-cover hover:opacity-90"
              loading="lazy"
            />
          </a>
        )}
      </div>
    );
  };

  const [previewTratativaUrl, setPreviewTratativaUrl] = useState(null);
  const [previewValeUrl, setPreviewValeUrl] = useState(null);

  useEffect(() => {
    if (!anexoTratativa) {
      if (previewTratativaUrl) URL.revokeObjectURL(previewTratativaUrl);
      setPreviewTratativaUrl(null);
      return;
    }
    const url = URL.createObjectURL(anexoTratativa);
    setPreviewTratativaUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anexoTratativa]);

  useEffect(() => {
    if (!anexoVale) {
      if (previewValeUrl) URL.revokeObjectURL(previewValeUrl);
      setPreviewValeUrl(null);
      return;
    }
    const url = URL.createObjectURL(anexoVale);
    setPreviewValeUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anexoVale]);

  useEffect(() => {
    return () => {
      if (previewTratativaUrl) URL.revokeObjectURL(previewTratativaUrl);
      if (previewValeUrl) URL.revokeObjectURL(previewValeUrl);
    };
  }, [previewTratativaUrl, previewValeUrl]);

  const renderPreviewSelecionado = (arquivo, previewUrl, setArquivo) => {
    if (!arquivo) return null;

    const pdf = isPdf(arquivo);
    const name = arquivo.name || "arquivo";

    if (pdf) {
      return (
        <div className="mt-3 rounded-xl border bg-white p-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
              PDF
            </span>
            <button
              type="button"
              onClick={() => setArquivo(null)}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Remover
            </button>
          </div>
          <div className="mt-2 text-sm text-slate-700 break-words">{name}</div>
        </div>
      );
    }

    return (
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">Pré-visualização</span>
          <button
            type="button"
            onClick={() => setArquivo(null)}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Remover
          </button>
        </div>
        <img
          src={previewUrl}
          alt={name}
          className="mt-2 h-28 w-28 rounded-xl border object-cover"
        />
        <div className="mt-1 text-xs text-slate-600 break-words">{name}</div>
      </div>
    );
  };

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("tratativas")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error(error);
        return;
      }

      setT(data || null);

      setEditForm({
        tipo_ocorrencia: data?.tipo_ocorrencia || "",
        prioridade: data?.prioridade || "Média",
        setor_origem: data?.setor_origem || "",
        linha: data?.linha || "",
        descricao: data?.descricao || "",
      });

      if (data?.linha) {
        const { data: row } = await supabase
          .from("linhas")
          .select("descricao")
          .eq("codigo", data.linha)
          .maybeSingle();
        setLinhaDescricao(row?.descricao || "");
      } else {
        setLinhaDescricao("");
      }

      if (data?.motorista_chapa) {
        const { data: m } = await supabase
          .from("motoristas")
          .select("cargo")
          .eq("chapa", data.motorista_chapa)
          .maybeSingle();
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
      const { error } = await supabase
        .from("tratativas")
        .update({
          tipo_ocorrencia: editForm.tipo_ocorrencia || null,
          prioridade: editForm.prioridade || null,
          setor_origem: editForm.setor_origem || null,
          linha: editForm.linha || null,
          descricao: editForm.descricao || null,
        })
        .eq("id", t.id);

      if (error) throw error;

      setT((prev) => (prev ? { ...prev, ...editForm } : prev));

      if (editForm.linha) {
        const { data: row } = await supabase
          .from("linhas")
          .select("descricao")
          .eq("codigo", editForm.linha)
          .maybeSingle();
        setLinhaDescricao(row?.descricao || "");
      } else {
        setLinhaDescricao("");
      }

      setIsEditing(false);
      alert("Dados atualizados!");
    } catch (e) {
      alert(`Erro ao salvar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function uploadArquivoTratativa(file, prefixo) {
    if (!file) return null;
    const safe = `${prefixo}_${Date.now()}_${file.name}`.replace(/\s+/g, "_");
    const up = await supabase.storage.from("tratativas").upload(safe, file, {
      upsert: false,
      contentType: file.type || undefined,
    });
    if (up.error) throw up.error;
    return supabase.storage.from("tratativas").getPublicUrl(safe).data.publicUrl;
  }

  async function concluir() {
    if (!t) return;
    if (!resumo) {
      alert("Informe o resumo/observações");
      return;
    }

    setLoading(true);
    try {
      const anexo_tratativa_url = await uploadArquivoTratativa(
        anexoTratativa,
        "anexo_tratativa"
      );

      const anexo_vale_url = isFaltaDeFeria
        ? await uploadArquivoTratativa(anexoVale, "anexo_vale")
        : null;

      const tratadoPorId = pickUserUuid(user);
      const tratadoPorLogin = user?.login || user?.email || null;
      const tratadoPorNome =
        user?.nome_completo || user?.nome || user?.login || user?.email || null;

      const ins = await supabase.from("tratativas_detalhes").insert({
        tratativa_id: t.id,
        acao_aplicada: acao,
        observacoes: resumo,
        anexo_tratativa: anexo_tratativa_url,
        anexo_vale: anexo_vale_url,
        tratado_por_login: tratadoPorLogin,
        tratado_por_nome: tratadoPorNome,
        tratado_por_id: tratadoPorId,
      });

      if (ins.error) throw ins.error;

      const upd = await supabase
        .from("tratativas")
        .update({
          status: "Concluída",
        })
        .eq("id", t.id);

      if (upd.error) throw upd.error;

      alert("Tratativa concluída com sucesso!");
      nav(-1);
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
        body {
          font-family: "Courier New", Courier, monospace;
          color:#000; font-size: 14px; line-height: 1.55; margin: 0;
        }
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

  function renderSuspensaoHtml({
    nome,
    registro,
    cargo,
    ocorrencia,
    dataOcorr,
    observ,
    dataDoc,
    dias,
    inicio,
    fim,
    retorno,
  }) {
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
        body {
          font-family: "Courier New", Courier, monospace;
          font-size: 14px; line-height: 1.7; color: #000; margin: 0;
        }
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
            <div>SR(A) <span class="label">${nome}</span> ${
      registro ? `(REGISTRO: ${registro})` : ""
    }</div>
            <div><span class="label">Cargo:</span> ${cargo}</div>
          </div>

          <p class="mt bl">
  Pelo presente, notificamos que, por ter o senhor cometido a falta abaixo descrita, encontra-se suspenso do serviço por <span class="label nowrap">${diasFmt} ${rotuloDia}</span>, <span class="nowrap">a partir de <span class="label">${brLocal(
      inicio
    )}</span></span>, devendo, portanto, apresentar-se ao mesmo, no horário usual, <span class="nowrap">no dia <span class="label">${brLocal(
      retorno
    )}</span></span>, salvo outra resolução nossa, que lhe daremos parte se for o caso e, assim, pedimos a devolução do presente com o seu “ciente”.
</p>

          <div class="mt"><span class="label">Ocorrência:</span> ${ocorrencia}</div>
          <div class="mt"><span class="label">Data da Ocorrência:</span> ${dataOcorr}</div>
          <div class="mt"><span class="label">Período da Suspensão:</span> ${brLocal(
            inicio
          )} a ${brLocal(fim)} (retorno: ${brLocal(retorno)})</div>
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

  function renderGenericHtml({
    titulo,
    intro1,
    intro2,
    nome,
    registro,
    cargo,
    ocorrencia,
    dataOcorr,
    observ,
    dataDoc,
  }) {
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
                <div>SR(A) <span class="label">${nome}</span> ${
      registro ? `(REGISTRO: ${registro})` : ""
    }</div>
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
                <div class="ass">
                  <div class="ass-line"></div>
                  Assinatura do Empregado
                </div>
                <div class="ass">
                  <div class="ass-line"></div>
                  Assinatura do Empregador
                </div>
              </div>
              <div class="ass-grid" style="margin-top:20px">
                <div class="ass">
                  <div class="ass-line"></div>
                  Testemunha &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CPF:
                </div>
                <div class="ass">
                  <div class="ass-line"></div>
                  Testemunha &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; CPF:
                </div>
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
    if (!resumo.trim()) {
      alert("Preencha o Resumo / Observações para gerar a medida.");
      return;
    }

    const dataDoc = dataPtCompletaUpper(new Date());
    const nome = (t.motorista_nome || "—").toUpperCase();
    const registro = t.motorista_chapa || "";
    const cargo = cargoMotorista;
    const ocorrencia = (t.tipo_ocorrencia || "—").toUpperCase();
    const dataOcorr = t.data_ocorrido ? br(t.data_ocorrido) : "—";
    const observ = (resumo || t.descricao || "").trim() || "—";

    const html = renderGenericHtml({
      titulo: "ORIENTAÇÃO DISCIPLINAR",
      intro1:
        "Vimos pelo presente, aplicar-lhe a pena de orientação disciplinar, em virtude de o(a) senhor(a) ter cometido a falta abaixo descrita.",
      intro2:
        "Pedimos que tal falta não mais se repita, pois, caso contrário, seremos obrigados a adotar medidas mais severas que nos são facultadas pela lei.",
      nome,
      registro,
      cargo,
      ocorrencia,
      dataOcorr,
      observ,
      dataDoc,
    });

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  }

  function gerarAdvertencia() {
    if (!t) return;
    if (!resumo.trim()) {
      alert("Preencha o Resumo / Observações para gerar a medida.");
      return;
    }

    const dataDoc = dataPtCompletaUpper(new Date());
    const nome = (t.motorista_nome || "—").toUpperCase();
    const registro = t.motorista_chapa || "";
    const cargo = cargoMotorista;
    const ocorrencia = (t.tipo_ocorrencia || "—").toUpperCase();
    const dataOcorr = t.data_ocorrido ? br(t.data_ocorrido) : "—";
    const observ = (resumo || t.descricao || "").trim() || "—";

    const html = renderGenericHtml({
      titulo: "ADVERTÊNCIA DISCIPLINAR",
      intro1:
        "Vimos pelo presente, aplicar-lhe a pena de advertência disciplinar, em virtude de o(a) senhor(a) ter cometido a falta abaixo descrita.",
      intro2:
        "Pedimos que tal falta não mais se repita, pois, caso contrário, seremos obrigados a adotar medidas mais severas, nos termos da lei.",
      nome,
      registro,
      cargo,
      ocorrencia,
      dataOcorr,
      observ,
      dataDoc,
    });

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  }

  function gerarSuspensao() {
    if (!t) return;
    if (!resumo.trim()) {
      alert("Preencha o Resumo / Observações para gerar a medida.");
      return;
    }

    const dataDoc = dataPtCompletaUpper(new Date());
    const nome = (t.motorista_nome || "—").toUpperCase();
    const registro = t.motorista_chapa || "";
    const cargo = cargoMotorista;
    const ocorrencia = (t.tipo_ocorrencia || "—").toUpperCase();
    const dataOcorr = t.data_ocorrido ? br(t.data_ocorrido) : "—";
    const observ = (resumo || t.descricao || "").trim() || "—";

    const html = renderSuspensaoHtml({
      nome,
      registro,
      cargo,
      ocorrencia,
      dataOcorr,
      observ,
      dataDoc,
      dias: diasSusp,
      inicio: inicioSusp,
      fim: fimSusp,
      retorno: retornoSusp,
    });

    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
  }

  if (!t) return <div className="p-6">Carregando…</div>;

  const evidenciasSolicitacao =
    Array.isArray(t.evidencias_urls) && t.evidencias_urls.length > 0
      ? t.evidencias_urls
      : t.imagem_url
      ? [t.imagem_url]
      : [];

  const criadoPor = t.criado_por_nome || t.criado_por_login || "—";
  const criadoEm = brDateTime(t.created_at);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto min-h-screen bg-[#f8f9fa] font-sans text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b pb-4 gap-4">
        <div className="space-y-3">
          <button
            onClick={() => nav(-1)}
            className="px-4 py-2 bg-white border rounded-lg shadow-sm hover:bg-slate-50 font-bold text-sm flex items-center gap-2"
          >
            <FaArrowLeft />
            Voltar
          </button>

          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
              <FaGavel className="text-violet-500" /> Tratar Tratativa
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Revise os dados, registre a ação aplicada e conclua a tratativa.
            </p>
          </div>
        </div>

        <div className="text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="font-semibold">Criado por:</span> {criadoPor}
          <span className="mx-2 text-blue-300">•</span>
          <span className="font-semibold">Data/Hora:</span> {criadoEm}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ResumoCard
          titulo="Motorista"
          valor={t.motorista_nome || "-"}
          subtitulo={t.motorista_chapa || "-"}
          icon={<FaUser className="text-3xl text-blue-100" />}
          border="border-l-blue-500"
        />
        <ResumoCard
          titulo="Ocorrência"
          valor={t.tipo_ocorrencia || "-"}
          subtitulo={t.prioridade || "-"}
          icon={<FaExclamationTriangle className="text-3xl text-amber-100" />}
          border="border-l-amber-500"
        />
        <ResumoCard
          titulo="Setor / Linha"
          valor={t.setor_origem || "-"}
          subtitulo={t.linha ? `${t.linha}${linhaDescricao ? ` - ${linhaDescricao}` : ""}` : "-"}
          icon={<FaBuilding className="text-3xl text-violet-100" />}
          border="border-l-violet-500"
        />
        <ResumoCard
          titulo="Status"
          valor={t.status || "-"}
          subtitulo={`${t.data_ocorrido || "-"} ${t.hora_ocorrido || ""}`}
          icon={<FaInfoCircle className="text-3xl text-emerald-100" />}
          border="border-l-emerald-500"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <FaClipboardList className="text-slate-500" />
            <h2 className="text-lg font-bold text-slate-800">Detalhes da tratativa</h2>
          </div>

          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="rounded-lg bg-yellow-500 px-3 py-2 text-white hover:bg-yellow-600 font-bold text-sm flex items-center gap-2"
            >
              <FaEdit />
              Editar dados
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={salvarEdicao}
                disabled={loading}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-white hover:bg-emerald-700 disabled:opacity-60 font-bold text-sm flex items-center gap-2"
              >
                <FaSave />
                Salvar
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditForm({
                    tipo_ocorrencia: t.tipo_ocorrencia || "",
                    prioridade: t.prioridade || "Média",
                    setor_origem: t.setor_origem || "",
                    linha: t.linha || "",
                    descricao: t.descricao || "",
                  });
                }}
                className="rounded-lg bg-slate-400 px-3 py-2 text-white hover:bg-slate-500 font-bold text-sm"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Item titulo="Motorista" valor={t.motorista_nome || "-"} icon={<FaUser />} />
          <Item titulo="Registro" valor={t.motorista_chapa || "-"} icon={<FaIdBadge />} />

          <Item
            titulo="Ocorrência"
            icon={<FaExclamationTriangle />}
            valor={
              isEditing ? (
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={editForm.tipo_ocorrencia}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, tipo_ocorrencia: e.target.value }))
                  }
                />
              ) : (
                t.tipo_ocorrencia || "-"
              )
            }
          />

          <Item
            titulo="Prioridade"
            icon={<FaFlag />}
            valor={
              isEditing ? (
                <select
                  className="w-full border rounded-lg px-3 py-2 bg-white"
                  value={editForm.prioridade}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, prioridade: e.target.value }))
                  }
                >
                  <option>Baixa</option>
                  <option>Média</option>
                  <option>Alta</option>
                  <option>Gravíssima</option>
                </select>
              ) : (
                t.prioridade || "-"
              )
            }
          />

          <Item
            titulo="Setor"
            icon={<FaBuilding />}
            valor={
              isEditing ? (
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={editForm.setor_origem}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, setor_origem: e.target.value }))
                  }
                />
              ) : (
                t.setor_origem || "-"
              )
            }
          />

          <Item
            titulo="Linha"
            icon={<FaBus />}
            valor={
              isEditing ? (
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  placeholder="Código ex.: 01TR ou NA"
                  value={editForm.linha}
                  onChange={(e) => setEditForm((s) => ({ ...s, linha: e.target.value }))}
                />
              ) : t.linha ? (
                `${t.linha}${linhaDescricao ? ` - ${linhaDescricao}` : ""}`
              ) : (
                "-"
              )
            }
          />

          <Item titulo="Status" valor={t.status || "-"} icon={<FaInfoCircle />} />
          <Item
            titulo="Data/Hora"
            valor={`${t.data_ocorrido || "-"} ${t.hora_ocorrido || ""}`}
            icon={<FaCalendarAlt />}
          />

          <Item
            className="md:col-span-2"
            titulo="Descrição"
            valor={
              isEditing ? (
                <textarea
                  className="w-full border rounded-lg px-3 py-2"
                  rows={3}
                  value={editForm.descricao}
                  onChange={(e) =>
                    setEditForm((s) => ({ ...s, descricao: e.target.value }))
                  }
                />
              ) : (
                t.descricao || "-"
              )
            }
          />

          <div className="md:col-span-2">
            {renderEvidenciasGrid(
              evidenciasSolicitacao,
              "Evidências da solicitação (reclamação)"
            )}
          </div>
        </dl>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-5">
        <div className="flex items-center gap-2 mb-4">
          <FaClipboardList className="text-slate-500" />
          <h2 className="text-lg font-bold text-slate-800">Conclusão</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-slate-600 mb-1">
              Ação aplicada
            </label>
            <select
              className="w-full rounded-lg border px-3 py-2 bg-white"
              value={acao}
              onChange={(e) => setAcao(e.target.value)}
            >
              {acoes.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {acao === "Suspensão" && (
            <>
              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Dias de Suspensão
                </label>
                <select
                  className="w-full rounded-lg border px-3 py-2 bg-white"
                  value={diasSusp}
                  onChange={(e) => setDiasSusp(Number(e.target.value))}
                >
                  {[1, 3, 5, 7].map((d) => (
                    <option key={d} value={d}>
                      {d} dia(s)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-600 mb-1">
                  Data da Suspensão (emissão)
                </label>
                <input
                  type="date"
                  className="w-full rounded-lg border px-3 py-2"
                  value={dataSuspensao}
                  onChange={(e) => setDataSuspensao(e.target.value)}
                />
              </div>

              <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                <ResumoMini titulo="Início" valor={br(inicioSusp)} />
                <ResumoMini titulo="Fim" valor={br(fimSusp)} />
                <ResumoMini titulo="Retorno" valor={br(retornoSusp)} />
              </div>
            </>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-xl border bg-slate-50 p-4">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Resumo / Observações
            </label>
            <textarea
              rows={6}
              className="w-full rounded-lg border bg-white px-3 py-2"
              value={resumo}
              onChange={(e) => setResumo(e.target.value)}
              placeholder="Descreva o que foi feito, conclusão, orientações, etc."
            />
            <p className="text-xs text-slate-500 mt-2">
              Esse texto vai para <b>tratativas_detalhes.observacoes</b>.
            </p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4 space-y-4">
            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="block text-sm font-semibold text-slate-700">
                  Anexo da Tratativa
                </label>
                <span className="text-xs text-slate-500">imagem ou PDF</span>
              </div>

              <div className="mt-3 rounded-xl border-2 border-dashed bg-white p-4">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAnexoTratativa(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-700
                    file:mr-3 file:rounded-md file:border-0
                    file:bg-blue-600 file:px-4 file:py-2
                    file:text-white hover:file:bg-blue-700"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Será salvo em <b>tratativas_detalhes.anexo_tratativa</b>.
                </p>
                {renderPreviewSelecionado(
                  anexoTratativa,
                  previewTratativaUrl,
                  setAnexoTratativa
                )}
              </div>
            </div>

            {isFaltaDeFeria && (
              <div>
                <div className="flex items-center justify-between gap-3">
                  <label className="block text-sm font-semibold text-slate-700">
                    Anexo do Vale
                  </label>
                  <span className="text-xs text-slate-500">somente para Falta de Féria</span>
                </div>

                <div className="mt-3 rounded-xl border-2 border-dashed bg-white p-4">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setAnexoVale(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-700
                      file:mr-3 file:rounded-md file:border-0
                      file:bg-emerald-600 file:px-4 file:py-2
                      file:text-white hover:file:bg-emerald-700"
                  />
                  <p className="text-xs text-slate-500 mt-2">
                    Será salvo em <b>tratativas_detalhes.anexo_vale</b>.
                  </p>
                  {renderPreviewSelecionado(anexoVale, previewValeUrl, setAnexoVale)}
                </div>
              </div>
            )}

            {renderArquivoOuThumb(t.anexo_tratativa || null, "Anexo já anexado (se houver)")}
          </div>
        </div>

        <div className="mt-6 flex gap-3 flex-wrap">
          <button
            onClick={concluir}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-60 font-bold"
          >
            {loading ? "Salvando…" : "Concluir"}
          </button>

          <button
            type="button"
            onClick={() => {
              if (acao === "Orientação") return gerarOrientacao();
              if (acao === "Advertência") return gerarAdvertencia();
              if (acao === "Suspensão") return gerarSuspensao();
              alert('Selecione "Orientação", "Advertência" ou "Suspensão" para gerar o documento.');
            }}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700 font-bold"
            title="Gerar documento conforme a ação selecionada"
          >
            GERAR MEDIDA DISCIPLINAR
          </button>
        </div>
      </div>
    </div>
  );
}

function ResumoCard({ titulo, valor, subtitulo, icon, border }) {
  return (
    <div className={`bg-white p-4 rounded-xl border shadow-sm flex items-center justify-between border-l-4 ${border}`}>
      <div className="min-w-0">
        <p className="text-sm text-slate-500 font-bold">{titulo}</p>
        <p className="text-xl font-black text-slate-800 break-words">{valor}</p>
        {subtitulo ? (
          <p className="text-xs text-slate-500 mt-1 font-semibold break-words">{subtitulo}</p>
        ) : null}
      </div>
      <div>{icon}</div>
    </div>
  );
}

function ResumoMini({ titulo, valor }) {
  return (
    <div className="rounded-xl border bg-slate-50 p-3">
      <div className="text-xs font-bold text-slate-500">{titulo}</div>
      <div className="text-base font-black text-slate-800 mt-1">{valor}</div>
    </div>
  );
}

function Item({ titulo, valor, className, icon }) {
  return (
    <div className={className}>
      <dt className="text-sm text-slate-500 flex items-center gap-2 font-semibold">
        {icon ? <span className="text-slate-400">{icon}</span> : null}
        {titulo}
      </dt>
      <dd className="font-bold text-slate-800 break-words mt-1">{valor}</dd>
    </div>
  );
}
