// src/components/CobrancaDetalheModal.jsx
// Ajustes: Origem (Interno/Externo) + Bloco Externo (Terceiro/Veículo/Fotos) + Persistência em avarias_terceiros
// + NOVO: permitir editar/reverter quando status for Cancelada
// + NOVO: Botão "Chamados de Motoristas" dentro de 🧮 Detalhes da Operação (abre modal)

import React, { useState, useEffect } from "react";
import { supabase } from "../supabase";
import { FaTimes } from "react-icons/fa";
import CampoMotorista from "./CampoMotorista";
import ChamadosMotoristasModal from "./ChamadosMotoristasModal";
import FileViewerModal from "./FileViewerModal";

// Helper para converter string (BRL ou US) para número
const parseCurrency = (value) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const num = parseFloat(value.replace(/\./g, "").replace(",", "."));
  return Number.isNaN(num) ? null : num;
};

const fileNameFromUrl = (url) => {
  try {
    const raw = String(url || "");
    const noHash = raw.split("#")[0];
    const noQuery = noHash.split("?")[0];
    const last = noQuery.split("/").filter(Boolean).pop() || "arquivo";
    return decodeURIComponent(last);
  } catch {
    return "arquivo";
  }
};

export default function CobrancaDetalheModal({
  avaria,
  onClose,
  onAtualizarStatus,
  canDelete,
  onExcluir,
}) {
  const [itensOrcamento, setItensOrcamento] = useState([]);
  const [urlsEvidencias, setUrlsEvidencias] = useState([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [valorCobrado, setValorCobrado] = useState("");
  const [observacaoOperacao, setObservacaoOperacao] = useState("");
  const [numParcelas, setNumParcelas] = useState(1);
  const [motivoCancelamento, setMotivoCancelamento] = useState("");
  const [selectedMotorista, setSelectedMotorista] = useState({ chapa: "", nome: "" });
  const [dataAvaria, setDataAvaria] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [tratativaTexto, setTratativaTexto] = useState("");
  const [salvandoInfo, setSalvandoInfo] = useState(false);
  const [viewerFile, setViewerFile] = useState(null);

  // ✅ NOVO: modal de chamados
  const [openChamados, setOpenChamados] = useState(false);

  // Origem (Interno/Externo)
  const [origem, setOrigem] = useState("Interno");

  // Dados do terceiro (Externo)
  const [terceiroNome, setTerceiroNome] = useState("");
  const [terceiroDocumento, setTerceiroDocumento] = useState("");
  const [terceiroTelefone, setTerceiroTelefone] = useState("");
  const [terceiroEmail, setTerceiroEmail] = useState("");

  const [terceiroPlaca, setTerceiroPlaca] = useState("");
  const [terceiroModelo, setTerceiroModelo] = useState("");
  const [terceiroCor, setTerceiroCor] = useState("");

  const [fotosTerceiro, setFotosTerceiro] = useState([]);
  const [loadingTerceiro, setLoadingTerceiro] = useState(false);
  const [salvandoTerceiro, setSalvandoTerceiro] = useState(false);

  useEffect(() => {
    async function carregarDados() {
      if (!avaria) return;
      setLoadingItens(true);
      setIsEditing(false);

      setValorCobrado(
        avaria.valor_cobrado !== undefined && avaria.valor_cobrado !== null
          ? String(avaria.valor_cobrado).replace(".", ",")
          : ""
      );
      setObservacaoOperacao(avaria.observacao_operacao || "");
      setNumParcelas(avaria.numero_parcelas || 1);
      setMotivoCancelamento(avaria.motivo_cancelamento_cobranca || "");

      setOrigem(avaria.origem === "Externo" ? "Externo" : "Interno");

      if (avaria.motoristaId) {
        const parts = String(avaria.motoristaId).split(" - ");
        setSelectedMotorista({
          chapa: parts[0] || "",
          nome: parts[1] || parts[0] || "",
        });
      } else {
        setSelectedMotorista({ chapa: "", nome: "" });
      }

      setDataAvaria(avaria.dataAvaria || avaria.data_avaria || new Date().toISOString());

      if (avaria.urls_evidencias) {
        let urls = [];
        if (Array.isArray(avaria.urls_evidencias)) urls = avaria.urls_evidencias;
        else if (typeof avaria.urls_evidencias === "string")
          urls = avaria.urls_evidencias.split(",").map((u) => u.trim());
        setUrlsEvidencias((urls || []).filter(Boolean));
      } else {
        setUrlsEvidencias([]);
      }

      if (avaria.urls_tratativa) {
        if (Array.isArray(avaria.urls_tratativa)) {
          setTratativaTexto(avaria.urls_tratativa.join("\n"));
        } else if (typeof avaria.urls_tratativa === "string") {
          setTratativaTexto(
            avaria.urls_tratativa
              .split(/\n|,/)
              .map((u) => u.trim())
              .filter(Boolean)
              .join("\n")
          );
        }
      } else {
        setTratativaTexto("");
      }

      const { data, error } = await supabase
        .from("cobrancas_avarias")
        .select("id, descricao, qtd, valorUnitario, tipo")
        .eq("avaria_id", avaria.id);

      if (!error && Array.isArray(data)) setItensOrcamento(data);
      setLoadingItens(false);

      if ((avaria.origem || "Interno") === "Externo") {
        setLoadingTerceiro(true);
        try {
          const { data: tData, error: tErr } = await supabase
            .from("avarias_terceiros")
            .select("*")
            .eq("avaria_id", avaria.id)
            .maybeSingle();

          if (tErr) console.warn("Erro ao carregar avarias_terceiros:", tErr.message);

          setTerceiroNome(tData?.terceiro_nome || "");
          setTerceiroDocumento(tData?.terceiro_documento || "");
          setTerceiroTelefone(tData?.terceiro_telefone || "");
          setTerceiroEmail(tData?.terceiro_email || "");

          setTerceiroPlaca(tData?.terceiro_veiculo_placa || "");
          setTerceiroModelo(tData?.terceiro_veiculo_modelo || "");
          setTerceiroCor(tData?.terceiro_veiculo_cor || "");

          setFotosTerceiro(Array.isArray(tData?.fotos_urls) ? tData.fotos_urls.filter(Boolean) : []);
        } finally {
          setLoadingTerceiro(false);
        }
      } else {
        setTerceiroNome("");
        setTerceiroDocumento("");
        setTerceiroTelefone("");
        setTerceiroEmail("");
        setTerceiroPlaca("");
        setTerceiroModelo("");
        setTerceiroCor("");
        setFotosTerceiro([]);
      }
    }

    carregarDados();
  }, [avaria]);

  useEffect(() => {
    if (!avaria) return;

    const run = async () => {
      if (origem !== "Externo") return;
      setLoadingTerceiro(true);
      try {
        const { data: tData, error: tErr } = await supabase
          .from("avarias_terceiros")
          .select("*")
          .eq("avaria_id", avaria.id)
          .maybeSingle();

        if (tErr) console.warn("Erro ao carregar avarias_terceiros:", tErr.message);

        setTerceiroNome(tData?.terceiro_nome || "");
        setTerceiroDocumento(tData?.terceiro_documento || "");
        setTerceiroTelefone(tData?.terceiro_telefone || "");
        setTerceiroEmail(tData?.terceiro_email || "");
        setTerceiroPlaca(tData?.terceiro_veiculo_placa || "");
        setTerceiroModelo(tData?.terceiro_veiculo_modelo || "");
        setTerceiroCor(tData?.terceiro_veiculo_cor || "");
        setFotosTerceiro(Array.isArray(tData?.fotos_urls) ? tData.fotos_urls.filter(Boolean) : []);
      } finally {
        setLoadingTerceiro(false);
      }
    };

    run();
  }, [origem, avaria]);

  if (!avaria) return null;

  const pecas = itensOrcamento.filter((i) => i.tipo === "Peca");
  const servicos = itensOrcamento.filter((i) => i.tipo === "Servico");

  const formatCurrency = (v) =>
    v === null || v === undefined || v === ""
      ? "-"
      : Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const motoristaAtual = () => {
    if (selectedMotorista && selectedMotorista.chapa) return selectedMotorista;
    if (avaria.motoristaId) {
      const parts = String(avaria.motoristaId).split(" - ");
      return { chapa: parts[0] || "", nome: parts[1] || parts[0] || "" };
    }
    return { chapa: "", nome: "" };
  };

  // ✅ agora: editar básico não só para pendente, mas também quando isEditing estiver true
  const podeEditarBasico = avaria.status_cobranca === "Pendente";
  const somenteLeituraOperacao = avaria.status_cobranca !== "Pendente" && !isEditing;

  const dataAvariaFmt = new Date(dataAvaria).toLocaleDateString("pt-BR");

  // Upload tratativa
  const handleUploadTratativaFiles = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const bucketName = "tratativas-avarias";
    const novosLinks = [];

    for (const file of files) {
      try {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
        const path = `avaria-${avaria.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, file);

        if (uploadError) {
          console.error(uploadError);
          alert(`Erro ao enviar arquivo de tratativa: ${uploadError.message}`);
          continue;
        }

        const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(path);
        const publicUrl = publicData?.publicUrl;
        if (publicUrl) novosLinks.push(publicUrl);
      } catch (err) {
        console.error(err);
        alert("Erro inesperado ao enviar arquivo de tratativa.");
      }
    }

    if (novosLinks.length > 0) {
      setTratativaTexto((prev) => {
        const base = prev && prev.trim().length > 0 ? prev.trim() + "\n" : "";
        return base + novosLinks.join("\n");
      });
    }

    event.target.value = "";
  };

  // Upload fotos terceiro
  const handleUploadFotosTerceiro = async (event) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const bucketName = "avarias-terceiros";
    const novosLinks = [];

    for (const file of files) {
      try {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
        const path = `avaria-${avaria.id}/terceiro/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage.from(bucketName).upload(path, file);

        if (uploadError) {
          console.error(uploadError);
          alert(`Erro ao enviar foto do terceiro: ${uploadError.message}`);
          continue;
        }

        const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(path);
        const publicUrl = publicData?.publicUrl;
        if (publicUrl) novosLinks.push(publicUrl);
      } catch (err) {
        console.error(err);
        alert("Erro inesperado ao enviar fotos do terceiro.");
      }
    }

    if (novosLinks.length > 0) {
      setFotosTerceiro((prev) => [...prev, ...novosLinks]);
    }

    event.target.value = "";
  };

  // upsert terceiro
  const salvarTerceiroUpsert = async () => {
    if (!avaria?.id) return;

    const payload = {
      avaria_id: avaria.id,
      terceiro_nome: terceiroNome || null,
      terceiro_documento: terceiroDocumento || null,
      terceiro_telefone: terceiroTelefone || null,
      terceiro_email: terceiroEmail || null,
      terceiro_veiculo_placa: terceiroPlaca || null,
      terceiro_veiculo_modelo: terceiroModelo || null,
      terceiro_veiculo_cor: terceiroCor || null,
      fotos_urls: Array.isArray(fotosTerceiro) && fotosTerceiro.length > 0 ? fotosTerceiro : null,
    };

    setSalvandoTerceiro(true);
    try {
      const { error } = await supabase.from("avarias_terceiros").upsert(payload, { onConflict: "avaria_id" });
      if (error) throw error;
    } finally {
      setSalvandoTerceiro(false);
    }
  };

  // salvar info (pendente)
  const handleSalvarInfo = async () => {
    const m = motoristaAtual();

    if (!m.chapa) {
      alert("⚠️ Selecione o motorista antes de salvar.");
      return;
    }

    const updateData = {
      motoristaId: `${m.chapa} - ${m.nome}`,
      dataAvaria,
      observacao_operacao: observacaoOperacao,
      origem,
    };

    try {
      setSalvandoInfo(true);

      if (origem === "Externo") {
        await salvarTerceiroUpsert();
      }

      if (onAtualizarStatus) {
        await onAtualizarStatus(avaria.id, avaria.status_cobranca || "Pendente", updateData);
      } else {
        const { error } = await supabase.from("avarias").update(updateData).eq("id", avaria.id);
        if (error) throw error;
      }

      alert("✅ Informações básicas salvas com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar informações: " + err.message);
    } finally {
      setSalvandoInfo(false);
    }
  };

  // ✅ aceitar Pendente também
  const handleSalvarStatus = async (novoStatus) => {
    const valorNumerico = parseCurrency(valorCobrado);

    const urlsTratativaArray = tratativaTexto
      .split(/\n|,/)
      .map((u) => u.trim())
      .filter(Boolean);

    const m = motoristaAtual();

    // Regras por status
    const isCobrada = novoStatus === "Cobrada";
    const isCancelada = novoStatus === "Cancelada";
    const isPendente = novoStatus === "Pendente";

    const updateData = {
      status_cobranca: novoStatus,
      observacao_operacao: observacaoOperacao,
      urls_tratativa: urlsTratativaArray.length > 0 ? urlsTratativaArray : null,
      dataAvaria,
      origem,

      // valores / parcelas:
      valor_cobrado: isCobrada ? valorNumerico : null,
      numero_parcelas: isCobrada ? Number(numParcelas) || 1 : null,

      // cancelamento:
      motivo_cancelamento_cobranca: isCancelada ? motivoCancelamento : null,

      // data cobrança:
      data_cobranca: isCobrada ? new Date().toISOString() : null,
    };

    if (m.chapa) {
      updateData.motoristaId = `${m.chapa} - ${m.nome}`;
    }

    if (!window.confirm(`Confirma marcar como ${novoStatus.toLowerCase()}?`)) return;

    try {
      if (origem === "Externo") {
        await salvarTerceiroUpsert();
      }

      onAtualizarStatus(avaria.id, novoStatus, updateData);
      if (isEditing) setIsEditing(false);
    } catch (err) {
      console.error(err);
      alert("Erro ao salvar dados do terceiro: " + err.message);
    }
  };

  // impressão
  const handlePrint = () => {
    const baseUrl = window.location.origin;
    let printContents = document.getElementById("printable-area").innerHTML;
    printContents = printContents.replace(/src="(\/[^\"]+)"/g, (_m, path) => `src="${baseUrl}${path}"`);
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((el) => el.outerHTML)
      .join("\n");
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>Laudo de Cobrança de Avaria - ${avaria.prefixo || ""}</title>
          ${styles}
          <style>
            @page { margin: 14mm; }
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; background: #fff; }
            img { max-width: 100%; }
          </style>
        </head>
        <body class="bg-white p-0">
          <div class="max-w-4xl mx-auto bg-white p-8">
            ${printContents}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();

    const doPrint = () => {
      const imgs = Array.from(printWindow.document.images || []);
      const pending = imgs.filter((img) => !img.complete);
      if (pending.length === 0) {
        printWindow.focus();
        printWindow.print();
        printWindow.close();
        return;
      }
      let remaining = pending.length;
      const done = () => {
        remaining -= 1;
        if (remaining <= 0) {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        }
      };
      pending.forEach((img) => {
        img.addEventListener("load", done);
        img.addEventListener("error", done);
      });
      // Fallback se algo travar
      setTimeout(() => {
        try {
          printWindow.focus();
          printWindow.print();
          printWindow.close();
        } catch {}
      }, 8000);
    };

    if (printWindow.document.readyState === "complete") {
      doPrint();
    } else {
      printWindow.addEventListener("load", doPrint);
      setTimeout(doPrint, 600);
    }
  };

  const isImageUrl = (u) => /\.(jpe?g|png|gif|webp|bmp)$/i.test(u || "");
  const isVideoUrl = (u) => /\.(mp4|mov|webm)$/i.test(u || "");
  const isPdfUrl = (u) => /\.pdf$/i.test(u || "");

  const tratativaUrls = tratativaTexto
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);

  const subtotalPecas = pecas.reduce((a, i) => a + (i.qtd || 0) * (i.valorUnitario || 0), 0);
  const subtotalServicos = servicos.reduce((a, i) => a + (i.qtd || 0) * (i.valorUnitario || 0), 0);
  const valorCobradoNum = parseCurrency(valorCobrado) ?? 0;
  const dataEmissao = new Date().toLocaleDateString("pt-BR");
  const statusAtual = avaria.status_cobranca || "Pendente";
  const tratativaImagens = tratativaUrls.filter(isImageUrl);
  const tratativaOutros = tratativaUrls.filter((u) => !isImageUrl(u));
  const evidenciasImagens = urlsEvidencias.filter((u) => !isVideoUrl(u));

  // Pode editar origem enquanto pendente (ou em edição)
  const podeEditarOrigem = podeEditarBasico || isEditing;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 p-4 print:hidden">
        <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col">
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-2xl font-bold text-gray-800">🧾 Detalhes da Cobrança</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800" aria-label="Fechar">
              <FaTimes size={20} />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Identificação */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 border-b pb-4">
              <div>
                <label className="text-xs font-medium text-gray-500 block">Prefixo</label>
                <p className="font-medium text-gray-900">{avaria.prefixo}</p>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block">Nº Avaria</label>
                <p className="font-medium text-gray-900">{avaria.numero_da_avaria || "-"}</p>
              </div>

              <div className="md:col-span-2">
                <CampoMotorista
                  label="Motorista"
                  value={selectedMotorista}
                  onChange={setSelectedMotorista}
                  disabled={!(podeEditarBasico || isEditing)}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 block">Data da Avaria</label>
                <input
                  type="date"
                  value={dataAvaria.slice(0, 10)}
                  onChange={(e) => setDataAvaria(e.target.value)}
                  className="border rounded p-1 w-full disabled:bg-gray-100"
                  disabled={!(podeEditarBasico || isEditing)}
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs font-medium text-gray-500 block">Origem da Cobrança</label>
                <select
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  disabled={!podeEditarOrigem}
                  className="border rounded p-2 w-full disabled:bg-gray-100"
                >
                  <option value="Interno">Interno</option>
                  <option value="Externo">Externo</option>
                </select>
                <p className="text-[11px] text-gray-500 mt-1">
                  Interno: mantém fluxo atual. Externo: habilita cadastro simples do terceiro/veículo/fotos.
                </p>
              </div>
            </div>

            {/* Externo */}
            {origem === "Externo" && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="text-lg font-semibold mb-3">👤 Cobrança Externa — Dados do Terceiro</h3>

                {loadingTerceiro ? (
                  <p className="text-sm text-gray-500">Carregando dados do terceiro...</p>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-600 block">Nome do Terceiro</label>
                        <input
                          type="text"
                          value={terceiroNome}
                          onChange={(e) => setTerceiroNome(e.target.value)}
                          disabled={somenteLeituraOperacao}
                          className="border rounded p-2 w-full disabled:bg-gray-100"
                          placeholder="Nome/Razão social"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600 block">CPF/CNPJ</label>
                        <input
                          type="text"
                          value={terceiroDocumento}
                          onChange={(e) => setTerceiroDocumento(e.target.value)}
                          disabled={somenteLeituraOperacao}
                          className="border rounded p-2 w-full disabled:bg-gray-100"
                          placeholder="Documento"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600 block">Telefone</label>
                        <input
                          type="text"
                          value={terceiroTelefone}
                          onChange={(e) => setTerceiroTelefone(e.target.value)}
                          disabled={somenteLeituraOperacao}
                          className="border rounded p-2 w-full disabled:bg-gray-100"
                          placeholder="WhatsApp/Telefone"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-600 block">E-mail</label>
                        <input
                          type="email"
                          value={terceiroEmail}
                          onChange={(e) => setTerceiroEmail(e.target.value)}
                          disabled={somenteLeituraOperacao}
                          className="border rounded p-2 w-full disabled:bg-gray-100"
                          placeholder="email@exemplo.com"
                        />
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold mt-4 mb-2">🚗 Veículo do Terceiro</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-600 block">Placa</label>
                        <input
                          type="text"
                          value={terceiroPlaca}
                          onChange={(e) => setTerceiroPlaca(e.target.value)}
                          disabled={somenteLeituraOperacao}
                          className="border rounded p-2 w-full disabled:bg-gray-100"
                          placeholder="ABC1D23"
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label className="text-xs font-medium text-gray-600 block">Modelo</label>
                        <input
                          type="text"
                          value={terceiroModelo}
                          onChange={(e) => setTerceiroModelo(e.target.value)}
                          disabled={somenteLeituraOperacao}
                          className="border rounded p-2 w-full disabled:bg-gray-100"
                          placeholder="Modelo do veículo"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-medium text-gray-600 block">Cor</label>
                        <input
                          type="text"
                          value={terceiroCor}
                          onChange={(e) => setTerceiroCor(e.target.value)}
                          disabled={somenteLeituraOperacao}
                          className="border rounded p-2 w-full disabled:bg-gray-100"
                          placeholder="Cor"
                        />
                      </div>
                    </div>

                    <h4 className="text-sm font-semibold mt-4 mb-2">📸 Fotos (Terceiro)</h4>
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleUploadFotosTerceiro}
                      disabled={somenteLeituraOperacao}
                      className="mb-3 block text-sm"
                    />

                    {fotosTerceiro.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {fotosTerceiro.map((url, i) => (
                          <button
                            type="button"
                            key={i}
                            onClick={() => setViewerFile({ url, name: fileNameFromUrl(url) })}
                            className="border rounded-lg overflow-hidden hover:opacity-80 bg-white"
                            title="Visualizar imagem"
                          >
                            <img src={url} alt={`Foto Terceiro ${i + 1}`} className="w-full h-24 object-cover" />
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Nenhuma foto do terceiro anexada.</p>
                    )}

                    {(podeEditarBasico || isEditing) && (
                      <div className="mt-3 flex justify-end">
                        <button
                          onClick={async () => {
                            try {
                              await salvarTerceiroUpsert();
                              alert("✅ Dados do terceiro salvos.");
                            } catch (err) {
                              console.error(err);
                              alert("Erro ao salvar dados do terceiro: " + err.message);
                            }
                          }}
                          disabled={somenteLeituraOperacao || salvandoTerceiro}
                          className={`px-4 py-2 rounded-md text-white ${
                            salvandoTerceiro ? "bg-gray-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                          }`}
                        >
                          {salvandoTerceiro ? "⏳ Salvando..." : "💾 Salvar Terceiro"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Evidências */}
            <div>
              <h3 className="text-xl font-semibold mt-6 mb-2">📸 Evidências da Avaria</h3>
              {urlsEvidencias.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {urlsEvidencias.map((url, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => setViewerFile({ url, name: fileNameFromUrl(url) })}
                      className="border rounded-lg overflow-hidden hover:opacity-80"
                    >
                      {url.match(/\.(mp4|mov|webm)$/i) ? (
                        <video controls src={url} className="w-full h-32 object-cover" />
                      ) : (
                        <img src={url} alt={`Evidência ${i + 1}`} className="w-full h-32 object-cover" />
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-sm">Nenhuma evidência anexada.</p>
              )}
            </div>

            {/* Itens */}
            <div>
              <h3 className="text-xl font-semibold">🔧 Detalhamento do Orçamento</h3>
              {loadingItens ? (
                <p>Carregando...</p>
              ) : (
                <>
                  <table className="min-w-full border text-sm mt-3">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 border text-left">Descrição</th>
                        <th className="p-2 border text-center">Qtd</th>
                        <th className="p-2 border text-right">Valor Unitário</th>
                        <th className="p-2 border text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...pecas, ...servicos].map((item) => (
                        <tr key={item.id} className="border-b">
                          <td className="border p-2">{item.descricao}</td>
                          <td className="border p-2 text-right">{item.qtd}</td>
                          <td className="border p-2 text-right">{formatCurrency(item.valorUnitario)}</td>
                          <td className="border p-2 text-right font-medium">
                            {formatCurrency((item.qtd || 0) * (item.valorUnitario || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-right text-xl font-bold mt-3">
                    Valor Total: {formatCurrency(avaria.valor_total_orcamento)}
                  </div>
                </>
              )}
            </div>

            {/* Operação + Tratativa */}
            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xl font-semibold">🧮 Detalhes da Operação</h3>

                {/* ✅ NOVO: Botão Chamados */}
                <button
                  onClick={() => setOpenChamados(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm"
                >
                  👥 Chamados de Motoristas
                </button>
              </div>

              <label className="block text-sm font-medium">Observações</label>
              <textarea
                value={observacaoOperacao}
                onChange={(e) => setObservacaoOperacao(e.target.value)}
                readOnly={somenteLeituraOperacao}
                className="w-full border rounded-md p-2 mb-3"
              />

              <label className="block text-sm font-medium">Motivo do Cancelamento</label>
              <textarea
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                readOnly={somenteLeituraOperacao}
                className="w-full border rounded-md p-2 mb-3"
              />

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium">Nº de Parcelas</label>
                  <input
                    type="number"
                    min="1"
                    value={numParcelas}
                    onChange={(e) => setNumParcelas(Number(e.target.value))}
                    readOnly={somenteLeituraOperacao}
                    className="w-full border rounded-md p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Valor Cobrado (R$)</label>
                  <input
                    type="text"
                    placeholder="Ex: 1.234,56"
                    value={valorCobrado}
                    onChange={(e) => setValorCobrado(e.target.value)}
                    readOnly={somenteLeituraOperacao}
                    className="w-full border rounded-md p-2"
                  />
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-1">📎 Tratativa (links / anexos)</h3>
                <p className="text-xs text-gray-500 mb-1">
                  Faça upload dos arquivos da tratativa (imagens, PDFs, etc). Eles serão salvos no bucket{" "}
                  <strong>tratativas-avarias</strong> e listados abaixo.
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf,video/*"
                  onChange={handleUploadTratativaFiles}
                  disabled={somenteLeituraOperacao}
                  className="mb-3 block text-sm"
                />
                <p className="text-xs text-gray-500 mb-1">
                  Você também pode colar manualmente links (Drive, etc.). Use uma linha para cada link.
                </p>
                <textarea
                  value={tratativaTexto}
                  onChange={(e) => setTratativaTexto(e.target.value)}
                  readOnly={somenteLeituraOperacao}
                  className="w-full border rounded-md p-2 h-24"
                  placeholder="https://drive.google.com/...\nhttps://minha-tratativa.com/..."
                />

                {tratativaUrls.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-semibold mb-1">Anexos da tratativa</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {tratativaUrls.map((url, i) => (
                        <button
                          type="button"
                          key={i}
                          onClick={() => setViewerFile({ url, name: fileNameFromUrl(url) })}
                          className="border rounded-lg overflow-hidden hover:opacity-80"
                        >
                          {url.match(/\.(mp4|mov|webm)$/i) ? (
                            <video controls src={url} className="w-full h-24 object-cover" />
                          ) : url.match(/\.(jpe?g|png|gif|webp|bmp)$/i) ? (
                            <img src={url} alt={`Tratativa ${i + 1}`} className="w-full h-24 object-cover" />
                          ) : url.match(/\.pdf$/i) ? (
                            <div className="w-full h-24 flex flex-col items-center justify-center text-xs p-2">
                              <span className="text-2xl">📄</span>
                              <span className="mt-1">PDF</span>
                            </div>
                          ) : (
                            <div className="w-full h-24 flex flex-col items-center justify-center text-xs p-2">
                              <span className="text-2xl">📎</span>
                              <span className="mt-1">Arquivo</span>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rodapé */}
          <div className="flex justify-between items-center p-4 border-t bg-gray-50">
            <button
              onClick={handlePrint}
              className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-md flex items-center gap-2"
            >
              🖨️ Imprimir
            </button>

            <div className="flex gap-3 flex-wrap justify-end">
              {podeEditarBasico && (
                <button
                  onClick={handleSalvarInfo}
                  disabled={salvandoInfo}
                  className={`px-4 py-2 rounded-md flex items-center gap-2 text-white ${
                    salvandoInfo ? "bg-blue-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {salvandoInfo ? "⏳ Salvando..." : "💾 Salvar Informações"}
                </button>
              )}

              {/* Pendente */}
              {avaria.status_cobranca === "Pendente" && (
                <>
                  <button
                    onClick={() => handleSalvarStatus("Cobrada")}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
                  >
                    💰 Marcar como Cobrada
                  </button>
                  <button
                    onClick={() => handleSalvarStatus("Cancelada")}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
                  >
                    ❌ Cancelar Cobrança
                  </button>
                </>
              )}

              {/* Cobrada */}
              {avaria.status_cobranca === "Cobrada" && !isEditing && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    alert('✏️ Edição liberada. Faça os ajustes e salve novamente como "Cobrada".');
                  }}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-md flex items-center gap-2"
                >
                  ✏️ Editar Cobrança
                </button>
              )}

              {/* Cancelada (NOVO) */}
              {avaria.status_cobranca === "Cancelada" && !isEditing && (
                <button
                  onClick={() => {
                    setIsEditing(true);
                    alert("✏️ Edição liberada. Você pode reabrir para Pendente ou marcar como Cobrada novamente.");
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
                >
                  ✏️ Editar Cancelamento
                </button>
              )}

              {/* Modo edição - ações */}
              {isEditing && (
                <>
                  <button
                    onClick={() => handleSalvarStatus("Pendente")}
                    className="bg-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-md flex items-center gap-2"
                    title="Reabrir para pendente"
                  >
                    ↩️ Voltar para Pendente
                  </button>

                  <button
                    onClick={() => handleSalvarStatus("Cobrada")}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
                  >
                    💰 Marcar como Cobrada
                  </button>

                  <button
                    onClick={() => handleSalvarStatus("Cancelada")}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md flex items-center gap-2"
                    title="Manter cancelada, mas salvar ajustes (motivo/observações/tratativa)"
                  >
                    💾 Salvar Cancelamento
                  </button>
                </>
              )}

              {/* Excluir */}
              {canDelete && typeof onExcluir === "function" && (
                <button
                  onClick={onExcluir}
                  className="bg-red-700 hover:bg-red-800 text-white px-4 py-2 rounded-md flex items-center gap-2"
                  title="Excluir avaria (apenas Administrador)"
                >
                  🗑️ Excluir Avaria
                </button>
              )}

              <button
                onClick={onClose}
                className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-md flex items-center gap-2"
              >
                🚪 Fechar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ NOVO: Modal Chamados */}
      {openChamados && (
        <ChamadosMotoristasModal
          avariaId={avaria.id}
          onClose={() => setOpenChamados(false)}
        />
      )}

      {/* === LAYOUT DE IMPRESSÃO === */}
      <FileViewerModal
        open={Boolean(viewerFile?.url)}
        url={viewerFile?.url || ""}
        name={viewerFile?.name || ""}
        onClose={() => setViewerFile(null)}
      />

      <div id="printable-area" className="hidden font-sans text-[11px] leading-snug text-gray-900">
        <style>{`
          @page { margin: 14mm; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
          #printable-area .compact th, #printable-area .compact td { padding: 4px 6px; border: 1px solid #cbd5e1; }
          #printable-area .compact thead th { background: #1e3a8a; color: #fff; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 0.03em; }
          #printable-area .compact tbody tr:nth-child(even) td { background: #f8fafc; }
          #printable-area .nobreak { break-inside: avoid; page-break-inside: avoid; }
          #printable-area h1, #printable-area h2, #printable-area h3 { margin: 0; padding: 0; }
          #printable-area .section-title {
            background: #1e3a8a; color: #fff; font-size: 11px; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.04em;
            padding: 4px 8px; margin-bottom: 6px; border-radius: 2px;
          }
          #printable-area .field-grid {
            display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px 12px;
            border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 3px; background: #f8fafc;
          }
          #printable-area .field-grid .full { grid-column: 1 / -1; }
          #printable-area .field-label {
            font-size: 9px; color: #475569; text-transform: uppercase;
            letter-spacing: 0.05em; font-weight: 600; display: block;
          }
          #printable-area .field-value { font-size: 11px; color: #0f172a; font-weight: 600; }
          #printable-area .doc-header {
            display: flex; align-items: center; justify-content: space-between;
            border-bottom: 3px solid #1e3a8a; padding-bottom: 8px; margin-bottom: 12px;
          }
          #printable-area .doc-title { font-size: 16px; font-weight: 800; color: #1e3a8a; letter-spacing: 0.02em; }
          #printable-area .doc-subtitle { font-size: 10px; color: #475569; }
          #printable-area .doc-meta { text-align: right; font-size: 9.5px; color: #475569; }
          #printable-area .status-pill {
            display: inline-block; padding: 2px 10px; border-radius: 999px;
            font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;
          }
          #printable-area .status-Pendente { background: #fef3c7; color: #92400e; border: 1px solid #fbbf24; }
          #printable-area .status-Cobrada  { background: #dcfce7; color: #166534; border: 1px solid #22c55e; }
          #printable-area .status-Cancelada{ background: #fee2e2; color: #991b1b; border: 1px solid #ef4444; }
          #printable-area .photo-grid {
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px;
          }
          #printable-area .photo-card {
            border: 1px solid #cbd5e1; border-radius: 3px; overflow: hidden; background: #fff;
          }
          #printable-area .photo-card img {
            width: 100%; height: 150px; object-fit: cover; display: block;
          }
          #printable-area .photo-caption {
            font-size: 9px; color: #475569; text-align: center; padding: 3px 4px;
            background: #f1f5f9; border-top: 1px solid #e2e8f0;
          }
          #printable-area .totals-box {
            width: 320px; border: 1px solid #cbd5e1; border-radius: 3px; overflow: hidden;
          }
          #printable-area .totals-box .row {
            display: flex; justify-content: space-between; padding: 5px 10px;
            border-bottom: 1px solid #e2e8f0; font-size: 11px;
          }
          #printable-area .totals-box .row:last-child { border-bottom: none; }
          #printable-area .totals-box .row.highlight {
            background: #1e3a8a; color: #fff; font-weight: 700;
          }
          #printable-area .signature-box {
            text-align: center;
          }
          #printable-area .signature-line {
            border-top: 1px solid #0f172a; margin: 40px 8px 4px 8px; padding-top: 3px;
            font-size: 10px; font-weight: 600;
          }
          #printable-area .signature-role { font-size: 9px; color: #475569; }
          #printable-area .note-box {
            border: 1px solid #cbd5e1; border-radius: 3px; padding: 8px 10px;
            background: #f8fafc; min-height: 42px; font-size: 11px; white-space: pre-wrap;
          }
          #printable-area .footer-disclaimer {
            margin-top: 12px; font-size: 8.5px; color: #64748b; text-align: justify;
            border-top: 1px dashed #cbd5e1; padding-top: 6px;
          }
        `}</style>

        {/* CABEÇALHO */}
        <header className="doc-header nobreak">
          <div>
            <h1 className="doc-title">LAUDO DE COBRANÇA DE AVARIA</h1>
            <div className="doc-subtitle">Documento técnico de apuração e cobrança</div>
          </div>
          <div className="doc-meta">
            <div><strong>Nº Avaria:</strong> {avaria.numero_da_avaria || "-"}</div>
            <div><strong>Emissão:</strong> {dataEmissao}</div>
            <div>
              <span className={`status-pill status-${statusAtual}`}>{statusAtual}</span>
            </div>
          </div>
        </header>

        {/* 1. IDENTIFICAÇÃO */}
        <section className="mb-3 nobreak">
          <div className="section-title">1. Identificação</div>
          <div className="field-grid">
            <div>
              <span className="field-label">Prefixo</span>
              <span className="field-value">{avaria.prefixo || "-"}</span>
            </div>
            <div>
              <span className="field-label">Nº da Avaria</span>
              <span className="field-value">{avaria.numero_da_avaria || "-"}</span>
            </div>
            <div>
              <span className="field-label">Data da Avaria</span>
              <span className="field-value">{dataAvariaFmt}</span>
            </div>
            <div>
              <span className="field-label">Origem</span>
              <span className="field-value">{origem}</span>
            </div>
            <div className="full" style={{ gridColumn: "1 / span 2" }}>
              <span className="field-label">Motorista</span>
              <span className="field-value">
                {motoristaAtual().chapa
                  ? `${motoristaAtual().chapa} — ${motoristaAtual().nome || "N/A"}`
                  : motoristaAtual().nome || "N/A"}
              </span>
            </div>
            <div style={{ gridColumn: "3 / span 2" }}>
              <span className="field-label">Status da Cobrança</span>
              <span className="field-value">{statusAtual}</span>
            </div>
            <div className="full">
              <span className="field-label">Descrição da Avaria</span>
              <span className="field-value" style={{ fontWeight: 500 }}>
                {avaria.descricao || "Não informada"}
              </span>
            </div>
          </div>
        </section>

        {/* 2. TERCEIRO (somente se Externo) */}
        {origem === "Externo" && (
          <section className="mb-3 nobreak">
            <div className="section-title">2. Dados do Terceiro Envolvido</div>
            <div className="field-grid">
              <div style={{ gridColumn: "1 / span 2" }}>
                <span className="field-label">Nome / Razão Social</span>
                <span className="field-value">{terceiroNome || "—"}</span>
              </div>
              <div>
                <span className="field-label">CPF / CNPJ</span>
                <span className="field-value">{terceiroDocumento || "—"}</span>
              </div>
              <div>
                <span className="field-label">Telefone</span>
                <span className="field-value">{terceiroTelefone || "—"}</span>
              </div>
              <div className="full">
                <span className="field-label">E-mail</span>
                <span className="field-value">{terceiroEmail || "—"}</span>
              </div>
              <div>
                <span className="field-label">Placa</span>
                <span className="field-value">{terceiroPlaca || "—"}</span>
              </div>
              <div style={{ gridColumn: "2 / span 2" }}>
                <span className="field-label">Modelo</span>
                <span className="field-value">{terceiroModelo || "—"}</span>
              </div>
              <div>
                <span className="field-label">Cor</span>
                <span className="field-value">{terceiroCor || "—"}</span>
              </div>
            </div>
          </section>
        )}

        {/* 3. EVIDÊNCIAS FOTOGRÁFICAS */}
        <section className="mb-3">
          <div className="section-title">
            {origem === "Externo" ? "3" : "2"}. Evidências Fotográficas da Avaria
          </div>
          {evidenciasImagens.length === 0 ? (
            <div className="note-box">Nenhuma evidência fotográfica anexada à avaria.</div>
          ) : (
            <div className="photo-grid">
              {evidenciasImagens.map((url, i) => (
                <div key={`ev-${i}`} className="photo-card nobreak">
                  <img src={url} alt={`Evidência ${i + 1}`} crossOrigin="anonymous" />
                  <div className="photo-caption">Evidência {i + 1}</div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. FOTOS DO TERCEIRO */}
        {origem === "Externo" && (
          <section className="mb-3">
            <div className="section-title">4. Registros Fotográficos do Terceiro</div>
            {fotosTerceiro.length === 0 ? (
              <div className="note-box">Nenhuma foto do terceiro anexada.</div>
            ) : (
              <div className="photo-grid">
                {fotosTerceiro.map((url, i) => (
                  <div key={`tf-${i}`} className="photo-card nobreak">
                    <img src={url} alt={`Foto Terceiro ${i + 1}`} crossOrigin="anonymous" />
                    <div className="photo-caption">Terceiro {i + 1}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* 5. ORÇAMENTO - PEÇAS */}
        <section className="mb-3 nobreak">
          <div className="section-title">
            {origem === "Externo" ? "5" : "3"}. Orçamento — Peças
          </div>
          <table className="w-full compact" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Descrição</th>
                <th style={{ width: "60px" }}>Qtd</th>
                <th style={{ width: "110px" }}>V. Unitário</th>
                <th style={{ width: "110px" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {pecas.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", padding: 6 }}>
                    Sem peças
                  </td>
                </tr>
              ) : (
                pecas.map((i) => (
                  <tr key={i.id}>
                    <td>{i.descricao}</td>
                    <td style={{ textAlign: "center" }}>{i.qtd}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(i.valorUnitario)}</td>
                    <td style={{ textAlign: "right" }}>
                      {formatCurrency((i.qtd || 0) * (i.valorUnitario || 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* 6. ORÇAMENTO - SERVIÇOS */}
        <section className="mb-3 nobreak">
          <div className="section-title">
            {origem === "Externo" ? "6" : "4"}. Orçamento — Serviços
          </div>
          <table className="w-full compact" style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Descrição</th>
                <th style={{ width: "60px" }}>Qtd</th>
                <th style={{ width: "110px" }}>V. Unitário</th>
                <th style={{ width: "110px" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {servicos.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: "center", padding: 6 }}>
                    Sem serviços
                  </td>
                </tr>
              ) : (
                servicos.map((i) => (
                  <tr key={i.id}>
                    <td>{i.descricao}</td>
                    <td style={{ textAlign: "center" }}>{i.qtd}</td>
                    <td style={{ textAlign: "right" }}>{formatCurrency(i.valorUnitario)}</td>
                    <td style={{ textAlign: "right" }}>
                      {formatCurrency((i.qtd || 0) * (i.valorUnitario || 0))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>

        {/* 7. RESUMO FINANCEIRO */}
        <section className="mb-3 nobreak" style={{ display: "flex", justifyContent: "flex-end" }}>
          <div className="totals-box">
            <div className="row">
              <span>Subtotal Peças</span>
              <span>{formatCurrency(subtotalPecas)}</span>
            </div>
            <div className="row">
              <span>Subtotal Serviços</span>
              <span>{formatCurrency(subtotalServicos)}</span>
            </div>
            <div className="row">
              <span>Valor Total do Orçamento</span>
              <span>{formatCurrency(avaria.valor_total_orcamento)}</span>
            </div>
            <div className="row highlight">
              <span>Valor Cobrado</span>
              <span>{formatCurrency(valorCobradoNum)}</span>
            </div>
            <div className="row">
              <span>Nº de Parcelas</span>
              <span>{numParcelas}</span>
            </div>
          </div>
        </section>

        {/* 8. OBSERVAÇÕES E TRATATIVA */}
        <section className="mb-3 nobreak">
          <div className="section-title">
            {origem === "Externo" ? "8" : "6"}. Observações da Operação
          </div>
          <div className="note-box">{observacaoOperacao || "—"}</div>
        </section>

        {statusAtual === "Cancelada" && (
          <section className="mb-3 nobreak">
            <div className="section-title">Motivo do Cancelamento</div>
            <div className="note-box">{motivoCancelamento || "—"}</div>
          </section>
        )}

        <section className="mb-3">
          <div className="section-title">
            {origem === "Externo" ? "9" : "7"}. Tratativa — Anexos e Evidências Complementares
          </div>
          {tratativaImagens.length > 0 && (
            <div className="photo-grid" style={{ marginBottom: 6 }}>
              {tratativaImagens.map((url, i) => (
                <div key={`tt-${i}`} className="photo-card nobreak">
                  <img src={url} alt={`Tratativa ${i + 1}`} crossOrigin="anonymous" />
                  <div className="photo-caption">Tratativa {i + 1}</div>
                </div>
              ))}
            </div>
          )}
          {tratativaOutros.length > 0 && (
            <div className="note-box">
              {tratativaOutros.map((linha, idx) => (
                <div key={idx} style={{ wordBreak: "break-all" }}>• {linha}</div>
              ))}
            </div>
          )}
          {tratativaImagens.length === 0 && tratativaOutros.length === 0 && (
            <div className="note-box">Nenhum anexo de tratativa registrado.</div>
          )}
        </section>

        {/* 9. ASSINATURAS */}
        <section className="mt-4 nobreak">
          <div className="section-title">
            {origem === "Externo" ? "10" : "8"}. Assinaturas
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginTop: 8 }}>
            <div className="signature-box">
              <div className="signature-line">Gerente de Manutenção</div>
              <div className="signature-role">Responsável técnico</div>
            </div>
            <div className="signature-box">
              <div className="signature-line">Responsável pela Cobrança</div>
              <div className="signature-role">Setor Financeiro / Operação</div>
            </div>
            <div className="signature-box">
              <div className="signature-line">{motoristaAtual().nome || "Motorista"}</div>
              <div className="signature-role">
                {origem === "Externo" ? "Terceiro / Responsável" : "Ciente da cobrança"}
              </div>
            </div>
          </div>
        </section>

        <div className="footer-disclaimer">
          Este laudo é emitido para fins de apuração e cobrança da avaria identificada acima, com base nas
          evidências, no orçamento técnico e na tratativa registrados no sistema. As partes signatárias
          declaram estar cientes do conteúdo e dos valores apresentados, ficando a cobrança vinculada ao
          status indicado no cabeçalho deste documento.
        </div>
      </div>
    </>
  );
}
