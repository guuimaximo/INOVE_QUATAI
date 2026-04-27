// src/pages/LancarAvaria.jsx
// (Revertido 'TipoOcorrencia' para input de texto)
// ✅ AJUSTE: aceitar múltiplas evidências (já salva array de URLs em urls_evidencias)

import React, { useState, useMemo } from 'react';
import { supabase } from '../../supabase';
import CampoMotorista from '../../components/CampoMotorista';
import CampoPrefixo from '../../components/CampoPrefixo';

// --- Componente OrcamentoLinha (Item do Orçamento) ---
function OrcamentoLinha({ item, index, onRemove, onChange }) {
  const totalLinha = (item.qtd || 0) * (item.valorUnitario || 0);

  return (
    <div className="grid grid-cols-12 gap-3 mb-2 items-center">
      <input
        type="text"
        placeholder="Descrição do item"
        className="col-span-5 border rounded-md px-3 py-2"
        value={item.descricao}
        onChange={(e) => onChange(index, 'descricao', e.target.value)}
      />
      <input
        type="number"
        placeholder="Qtd"
        className="col-span-2 border rounded-md px-3 py-2"
        value={item.qtd}
        min="0"
        onChange={(e) => onChange(index, 'qtd', parseFloat(e.target.value))}
      />
      <input
        type="number"
        placeholder="Vl. Unitário"
        className="col-span-2 border rounded-md px-3 py-2"
        value={item.valorUnitario}
        min="0"
        step="0.01"
        onChange={(e) => onChange(index, 'valorUnitario', parseFloat(e.target.value))}
      />
      <span className="col-span-2 p-2 text-right font-medium text-gray-700">
        {totalLinha.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
      </span>
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="col-span-1 text-red-500 hover:text-red-700 font-bold"
      >
        X
      </button>
    </div>
  );
}

// --- Componente Principal da Página ---
export default function LancarAvaria() {
  // --- Estados do Formulário ---
  const [formData, setFormData] = useState({
    dataAvaria: '',
    tipoOcorrencia: '',
    descricao: '',
    numero_da_avaria: '', // <<< ADICIONADO
  });

  // States separados para os componentes de busca
  const [prefixo, setPrefixo] = useState('');
  const [motorista, setMotorista] = useState({ chapa: '', nome: '' });

  // --- Estados do Orçamento ---
  const [pecas, setPecas] = useState([]);
  const [servicos, setServicos] = useState([]);

  // --- Estados de Upload e Loading ---
  const [arquivos, setArquivos] = useState([]); // ✅ AGORA vira uma lista real de múltiplos arquivos
  const [loading, setLoading] = useState(false);

  // --- Handlers do Formulário ---
  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // --- Handlers do Orçamento (Sem alteração) ---
  const handleAddPeca = () =>
    setPecas([...pecas, { id: Date.now(), descricao: '', qtd: 1, valorUnitario: 0 }]);
  const handleRemovePeca = (index) => setPecas(pecas.filter((_, i) => i !== index));
  const handleChangePeca = (index, field, value) => {
    const novasPecas = [...pecas];
    novasPecas[index][field] = value;
    setPecas(novasPecas);
  };

  const handleAddServico = () =>
    setServicos([...servicos, { id: Date.now(), descricao: '', qtd: 1, valorUnitario: 0 }]);
  const handleRemoveServico = (index) => setServicos(servicos.filter((_, i) => i !== index));
  const handleChangeServico = (index, field, value) => {
    const novosServicos = [...servicos];
    novosServicos[index][field] = value;
    setServicos(novosServicos);
  };

  // ✅ AJUSTE: garante múltiplos arquivos (Array) e não FileList
  const handleFileChange = (e) => {
    const list = Array.from(e.target.files || []);
    setArquivos(list); // mantém como array
  };

  const calcularTotal = (lista) =>
    lista.reduce((acc, item) => acc + (item.qtd || 0) * (item.valorUnitario || 0), 0);
  const totalPecas = useMemo(() => calcularTotal(pecas), [pecas]);
  const totalServicos = useMemo(() => calcularTotal(servicos), [servicos]);
  const totalOrcamento = totalPecas + totalServicos;

  // --- Handler para salvar tudo ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Upload de arquivos (MÚLTIPLOS) ✅
      const uploadedFileUrls = [];

      for (const file of arquivos) {
        const safeName = (file.name || 'arquivo')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\s+/g, '_')
          .replace(/[^a-zA-Z0-9._-]/g, '');

        const fileName = `avaria_${Date.now()}_${Math.random().toString(16).slice(2)}_${safeName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avarias')
          .upload(fileName, file, { upsert: false, contentType: file.type || undefined });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('avarias').getPublicUrl(uploadData.path);
        if (urlData?.publicUrl) uploadedFileUrls.push(urlData.publicUrl);
      }

      // 2. Salvar dados na tabela 'avarias'
      const motoristaString =
        motorista.chapa || motorista.nome
          ? [motorista.chapa, motorista.nome].filter(Boolean).join(' - ')
          : null;

      const { data: avariaData, error: avariaError } = await supabase
        .from('avarias')
        .insert({
          ...formData, // inclui numero_da_avaria
          prefixo: prefixo,
          motoristaId: motoristaString,
          status: 'Pendente de Aprovação',

          // ✅ múltiplas evidências
          urls_evidencias: uploadedFileUrls,

          valor_total_orcamento: totalOrcamento,
        })
        .select()
        .single();

      if (avariaError) throw avariaError;

      const avariaId = avariaData.id;

      // 3. Salvar itens do orçamento
      const orcamentoItens = [
        ...pecas.map((p) => ({ ...p, tipo: 'Peca', avaria_id: avariaId, valorUnitario: p.valorUnitario })),
        ...servicos.map((s) => ({
          ...s,
          tipo: 'Servico',
          avaria_id: avariaId,
          valorUnitario: s.valorUnitario,
        })),
      ];

      const itensParaSalvar = orcamentoItens.map(({ id, valorUnitario, ...rest }) => ({
        ...rest,
        valorUnitario: valorUnitario,
      }));

      const { error: orcamentoError } = await supabase.from('cobrancas_avarias').insert(itensParaSalvar);

      if (orcamentoError) {
        alert('Falha ao salvar itens do orçamento: ' + orcamentoError.message);
      } else {
        alert('Avaria lançada para aprovação com sucesso!');
      }
    } catch (err) {
      console.error(err);
      alert('Falha: ' + (err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERIZAÇÃO (JSX) ---
  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Registrar Lançamento de Avaria</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* --- Seção 1 & 2: Identificação e Detalhes --- */}
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-700 border-b pb-2">
            Identificação e Detalhes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Campo Prefixo */}
            <div className="flex flex-col">
              <CampoPrefixo value={prefixo} onChange={setPrefixo} label="Prefixo" />
            </div>

            {/* Campo Motorista */}
            <div className="flex flex-col">
              <CampoMotorista value={motorista} onChange={setMotorista} label="Motorista (Opcional)" />
            </div>

            {/* Campo Data */}
            <div className="flex flex-col">
              <label htmlFor="dataAvaria" className="mb-1 text-sm font-medium text-gray-600">
                Data e Hora da Avaria
              </label>
              <input
                type="datetime-local"
                name="dataAvaria"
                id="dataAvaria"
                className="border rounded-md px-3 py-2"
                onChange={handleFormChange}
                value={formData.dataAvaria}
                required
              />
            </div>

            {/* CAMPO TIPO OCORRÊNCIA */}
            <div className="flex flex-col">
              <label htmlFor="tipoOcorrencia" className="mb-1 text-sm font-medium text-gray-600">
                Tipo de Ocorrência
              </label>
              <input
                type="text"
                name="tipoOcorrencia"
                id="tipoOcorrencia"
                className="border rounded-md px-3 py-2"
                onChange={handleFormChange}
                value={formData.tipoOcorrencia}
                required
              />
            </div>

            {/* Número da Avaria */}
            <div className="flex flex-col">
              <label htmlFor="numero_da_avaria" className="mb-1 text-sm font-medium text-gray-600">
                Número da Avaria
              </label>
              <input
                type="text"
                name="numero_da_avaria"
                id="numero_da_avaria"
                className="border rounded-md px-3 py-2"
                placeholder="Ex: 12345"
                value={formData.numero_da_avaria}
                onChange={handleFormChange}
              />
            </div>

            {/* DESCRIÇÃO */}
            <div className="flex flex-col md:col-span-3">
              <label htmlFor="descricao" className="mb-1 text-sm font-medium text-gray-600">
                Descrição da Avaria (Relato)
              </label>
              <textarea
                name="descricao"
                id="descricao"
                rows="4"
                className="border rounded-md px-3 py-2"
                placeholder="Descreva o que foi identificado pela manutenção..."
                onChange={handleFormChange}
                value={formData.descricao}
              />
            </div>
          </div>
        </div>

        {/* ORÇAMENTO */}
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-700 border-b pb-2">Orçamento de Reparo</h2>

          {/* Peças */}
          <div>
            <h3 className="text-base font-semibold mb-3 text-gray-700">Peças</h3>
            <div className="grid grid-cols-12 gap-3 mb-2 px-2 text-sm font-bold text-gray-500">
              <span className="col-span-5">Item/Peça</span>
              <span className="col-span-2">Qtd</span>
              <span className="col-span-2">Vl. Unitário</span>
              <span className="col-span-2 text-right">Total</span>
              <span className="col-span-1">Ação</span>
            </div>
            {pecas.map((item, index) => (
              <OrcamentoLinha
                key={item.id}
                item={item}
                index={index}
                onRemove={handleRemovePeca}
                onChange={handleChangePeca}
              />
            ))}
            <button
              type="button"
              onClick={handleAddPeca}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              + Adicionar Peça
            </button>
            <div className="text-right font-bold mt-2 pr-14 text-gray-800">
              Total Peças: {totalPecas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>

          <hr className="my-6 border-gray-200" />

          {/* Serviços */}
          <div>
            <h3 className="text-base font-semibold mb-3 text-gray-700">Mão de Obra / Serviços</h3>
            <div className="grid grid-cols-12 gap-3 mb-2 px-2 text-sm font-bold text-gray-500">
              <span className="col-span-5">Serviço</span>
              <span className="col-span-2">Qtd/Horas</span>
              <span className="col-span-2">Vl. Unitário</span>
              <span className="col-span-2 text-right">Total</span>
              <span className="col-span-1">Ação</span>
            </div>
            {servicos.map((item, index) => (
              <OrcamentoLinha
                key={item.id}
                item={item}
                index={index}
                onRemove={handleRemoveServico}
                onChange={handleChangeServico}
              />
            ))}
            <button
              type="button"
              onClick={handleAddServico}
              className="mt-2 px-3 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
            >
              + Adicionar Serviço
            </button>
            <div className="text-right font-bold mt-2 pr-14 text-gray-800">
              Total M.O.: {totalServicos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </div>
          </div>

          {/* Total */}
          <div className="text-right text-xl font-bold mt-6 pt-4 border-t border-gray-200 text-gray-900">
            Total do Orçamento: {totalOrcamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
        </div>

        {/* EVIDÊNCIAS */}
        <div className="bg-white shadow rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3 text-gray-700 border-b pb-2">
            Evidências (Fotos e Vídeos)
          </h2>
          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center w-full h-48 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <p className="mb-2 text-sm text-gray-500">
                <span className="font-semibold">Clique para enviar</span> ou arraste e solte
              </p>
              <p className="text-xs text-gray-500">Imagens (PNG, JPG) ou Vídeos (MP4, MOV)</p>
            </div>

            {/* ✅ mantém multiple */}
            <input
              id="file-upload"
              type="file"
              className="hidden"
              multiple
              onChange={handleFileChange}
              accept="image/*,video/*"
            />
          </label>

          {arquivos.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-700">Arquivos selecionados:</h4>
              <ul className="list-disc list-inside text-gray-600">
                {arquivos.map((file, index) => (
                  <li key={index}>
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* AÇÕES */}
        <div className="flex justify-end gap-4 pt-4">
          <button type="button" className="bg-gray-200 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-300">
            Limpar
          </button>
          <button
            type="submit"
            disabled={loading}
            className="ml-2 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Salvando...' : 'Enviar para Aprovação'}
          </button>
        </div>
      </form>
    </div>
  );
}
