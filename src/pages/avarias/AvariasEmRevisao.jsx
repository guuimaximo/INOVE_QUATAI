import React, { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { FaUndo, FaEdit, FaSave, FaPlus, FaTrash, FaLock } from 'react-icons/fa';

// ======================================================================
// ========================== MODAL LOGIN (PERMISSÃO) ====================
// ======================================================================
function LoginModal({
  onConfirm,
  onCancel,
  title = 'Exclusão Restrita (Gestor/Administrador)',
  actionLabel = 'Autorizar exclusão',
}) {
  const [login, setLogin] = useState('');
  const [senha, setSenha] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setLoading(true);

    const { data, error } = await supabase
      .from('usuarios_aprovadores')
      .select('nome, login, nivel, ativo')
      .eq('login', login)
      .eq('senha', senha)
      .eq('ativo', true)
      .single();

    setLoading(false);

    if (error || !data) {
      alert('Login ou senha incorretos (ou usuário inativo).');
      return;
    }

    const nivel = String(data.nivel || '')
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (!['gestor', 'administrador', 'adm'].includes(nivel)) {
      alert('Sem permissão. Apenas Gestor ou Administrador podem excluir.');
      return;
    }

    onConfirm({ nome: data.nome, login: data.login, nivel: data.nivel });
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-50 p-4">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
        <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2">
          <FaLock /> {title}
        </h2>

        <input
          type="text"
          placeholder="Login"
          className="w-full mb-3 p-2 border rounded"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
        />

        <input
          type="password"
          placeholder="Senha"
          className="w-full mb-4 p-2 border rounded"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />

        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400">
            Cancelar
          </button>
          <button
            onClick={handleLogin}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            {loading ? 'Verificando...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ======================================================================
// ======================= MODAL DE EDIÇÃO TOTAL =========================
// ======================================================================
function EditarAvariaModal({ avaria, onClose, onAtualizarLista }) {
  const [itens, setItens] = useState([]);
  const [loadingItens, setLoadingItens] = useState(false);

  const [prefixo, setPrefixo] = useState('');
  const [motoristaId, setMotoristaId] = useState('');
  const [tipoOcorrencia, setTipoOcorrencia] = useState('');
  const [numeroAvaria, setNumeroAvaria] = useState('');
  const [dataAvaria, setDataAvaria] = useState('');
  const [descricao, setDescricao] = useState('');
  const [observacao, setObservacao] = useState('');
  const [valorTotal, setValorTotal] = useState(0);

  const [urlsEvidencias, setUrlsEvidencias] = useState([]);

  const [loginModalOpen, setLoginModalOpen] = useState(false);
  const [acaoPendente, setAcaoPendente] = useState(null); // excluir_item | excluir_evidencia | excluir_avaria
  const [pendencia, setPendencia] = useState(null); // { id, novo } | { idx } | { avariaId }

  useEffect(() => {
    if (avaria) carregarItens();
  }, [avaria]);

  async function carregarItens() {
    setLoadingItens(true);

    const { data } = await supabase
      .from('cobrancas_avarias')
      .select('*')
      .eq('avaria_id', avaria.id);

    setItens(data || []);

    setPrefixo(avaria.prefixo || '');
    setMotoristaId(avaria.motoristaId || '');
    setTipoOcorrencia(avaria.tipoOcorrencia || '');
    setNumeroAvaria(avaria.numero_da_avaria || '');
    setDataAvaria(avaria.dataAvaria?.split('T')[0] || '');
    setDescricao(avaria.descricao || '');
    setObservacao(avaria.observacao_operacao || '');
    setValorTotal(avaria.valor_total_orcamento || 0);

    let urls = [];
    if (Array.isArray(avaria.urls_evidencias)) urls = avaria.urls_evidencias;
    else if (typeof avaria.urls_evidencias === 'string') {
      urls = avaria.urls_evidencias.split(',').map((u) => u.trim());
    }

    setUrlsEvidencias(urls.filter(Boolean));
    setLoadingItens(false);
  }

  const handleItemChange = (id, field, value) => {
    setItens((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  };

  const adicionarEvidencia = (url) => {
    if (!url) return;
    setUrlsEvidencias((prev) => [...prev, url]);
  };

  const pedirExcluirEvidencia = (idx) => {
    setAcaoPendente('excluir_evidencia');
    setPendencia({ idx });
    setLoginModalOpen(true);
  };

  const removerEvidencia = (idx) => {
    setUrlsEvidencias((prev) => prev.filter((_, i) => i !== idx));
  };

  const adicionarItem = () => {
    setItens((prev) => [
      ...prev,
      {
        id: Date.now(),
        descricao: '',
        qtd: 1,
        valorUnitario: 0,
        tipo: 'Peca',
        novo: true,
        avaria_id: avaria.id,
      },
    ]);
  };

  const pedirExcluirItem = (id, novo) => {
    setAcaoPendente('excluir_item');
    setPendencia({ id, novo });
    setLoginModalOpen(true);
  };

  const removerItem = async (id, novo) => {
    if (!novo) {
      const { error } = await supabase.from('cobrancas_avarias').delete().eq('id', id);
      if (error) {
        alert('Erro ao excluir item: ' + error.message);
        return;
      }
    }
    setItens((prev) => prev.filter((i) => i.id !== id));
  };

  const pedirExcluirAvaria = () => {
    setAcaoPendente('excluir_avaria');
    setPendencia({ avariaId: avaria.id });
    setLoginModalOpen(true);
  };

  const excluirAvariaCompleta = async (avariaId) => {
    const confirm = window.confirm(
      'Tem certeza que deseja excluir esta avaria por completo? Essa ação remove a avaria e seus itens.'
    );
    if (!confirm) return;

    const { error: errItens } = await supabase
      .from('cobrancas_avarias')
      .delete()
      .eq('avaria_id', avariaId);

    if (errItens) {
      alert('Erro ao excluir itens da avaria: ' + errItens.message);
      return;
    }

    const { error: errAvaria } = await supabase.from('avarias').delete().eq('id', avariaId);

    if (errAvaria) {
      alert('Erro ao excluir avaria: ' + errAvaria.message);
      return;
    }

    alert('Avaria excluída com sucesso.');
    onAtualizarLista();
    onClose();
  };

  async function onLoginConfirm() {
    setLoginModalOpen(false);

    if (acaoPendente === 'excluir_item' && pendencia?.id) {
      await removerItem(pendencia.id, pendencia.novo);
    }

    if (acaoPendente === 'excluir_evidencia' && typeof pendencia?.idx === 'number') {
      removerEvidencia(pendencia.idx);
    }

    if (acaoPendente === 'excluir_avaria' && pendencia?.avariaId) {
      await excluirAvariaCompleta(pendencia.avariaId);
    }

    setPendencia(null);
    setAcaoPendente(null);
  }

  async function salvarAlteracoes(statusFinal = null) {
    for (const item of itens) {
      if (item.novo) {
        const { error } = await supabase.from('cobrancas_avarias').insert([
          {
            descricao: item.descricao,
            qtd: item.qtd,
            valorUnitario: item.valorUnitario,
            tipo: item.tipo,
            avaria_id: avaria.id,
          },
        ]);
        if (error) {
          alert('Erro ao inserir item: ' + error.message);
          return;
        }
      } else {
        const { error } = await supabase
          .from('cobrancas_avarias')
          .update({
            descricao: item.descricao,
            qtd: item.qtd,
            valorUnitario: item.valorUnitario,
            tipo: item.tipo,
          })
          .eq('id', item.id);

        if (error) {
          alert('Erro ao atualizar item: ' + error.message);
          return;
        }
      }
    }

    const updateData = {
      prefixo,
      motoristaId,
      tipoOcorrencia,
      numero_da_avaria: numeroAvaria,
      dataAvaria,
      descricao,
      observacao_operacao: observacao,
      valor_total_orcamento: valorTotal,
      urls_evidencias: urlsEvidencias,
    };

    if (statusFinal) updateData.status = statusFinal;

    const { error } = await supabase.from('avarias').update(updateData).eq('id', avaria.id);
    if (error) {
      alert('Erro ao salvar avaria: ' + error.message);
      return;
    }

    onAtualizarLista();
    onClose();
  }

  if (!avaria) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-40">
      <div className="bg-white w-full max-w-5xl rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-2xl font-bold">Editar Avaria #{avaria.id}</h2>
          <button onClick={onClose} className="text-gray-700 hover:text-black text-xl">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-gray-500">Prefixo</label>
              <input
                className="border p-2 rounded w-full"
                value={prefixo}
                onChange={(e) => setPrefixo(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Motorista</label>
              <input
                className="border p-2 rounded w-full"
                value={motoristaId}
                onChange={(e) => setMotoristaId(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Tipo da Ocorrência</label>
              <input
                className="border p-2 rounded w-full"
                value={tipoOcorrencia}
                onChange={(e) => setTipoOcorrencia(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Nº da Avaria</label>
              <input
                className="border p-2 rounded w-full"
                value={numeroAvaria}
                onChange={(e) => setNumeroAvaria(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Data da Avaria</label>
              <input
                type="date"
                className="border p-2 rounded w-full"
                value={dataAvaria}
                onChange={(e) => setDataAvaria(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-500">Descrição</label>
            <textarea
              className="border rounded p-2 w-full"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm text-gray-500">Observação / Motivo</label>
            <textarea
              className="border rounded p-2 w-full bg-yellow-50"
              rows={3}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
            />
          </div>

          <div>
            <h3 className="font-semibold mb-2">Evidências</h3>

            <div className="flex gap-2 mb-2">
              <input
                id="novaEvidencia"
                className="border p-2 rounded w-full"
                placeholder="Cole a URL da imagem ou vídeo"
              />
              <button
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                onClick={() => {
                  const url = document.getElementById('novaEvidencia').value;
                  adicionarEvidencia(url);
                  document.getElementById('novaEvidencia').value = '';
                }}
              >
                Adicionar
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {urlsEvidencias.map((url, index) => (
                <div key={index} className="relative border rounded overflow-hidden">
                  <button
                    onClick={() => pedirExcluirEvidencia(index)}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded px-2 text-xs flex items-center gap-1"
                    title="Excluir evidência (Gestor/Administrador)"
                  >
                    <FaTrash /> Excluir
                  </button>

                  {url.match(/\.(mp4|mov|webm)$/i) ? (
                    <video controls src={url} className="w-full h-32 object-cover" />
                  ) : (
                    <img src={url} alt="" className="w-full h-32 object-cover" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold text-gray-800">Itens do Orçamento</h3>
              <button
                onClick={adicionarItem}
                className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 text-sm"
              >
                <FaPlus /> Adicionar Item
              </button>
            </div>

            {loadingItens ? (
              <p>Carregando...</p>
            ) : (
              itens.map((item) => (
                <div key={item.id} className="grid grid-cols-5 gap-2 p-2 bg-gray-50 rounded mb-1">
                  <input
                    className="border p-1 rounded"
                    value={item.descricao}
                    onChange={(e) => handleItemChange(item.id, 'descricao', e.target.value)}
                    placeholder="Descrição"
                  />

                  <input
                    className="border p-1 rounded text-center"
                    type="number"
                    value={item.qtd}
                    onChange={(e) => handleItemChange(item.id, 'qtd', e.target.value)}
                  />

                  <input
                    className="border p-1 rounded text-center"
                    type="number"
                    value={item.valorUnitario}
                    onChange={(e) => handleItemChange(item.id, 'valorUnitario', e.target.value)}
                  />

                  <select
                    className="border p-1 rounded"
                    value={item.tipo}
                    onChange={(e) => handleItemChange(item.id, 'tipo', e.target.value)}
                  >
                    <option value="Peca">Peça</option>
                    <option value="Servico">Serviço</option>
                  </select>

                  <button
                    onClick={() => pedirExcluirItem(item.id, item.novo)}
                    className="bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 flex items-center justify-center gap-2"
                    title="Excluir item (Gestor/Administrador)"
                  >
                    <FaTrash /> <span className="hidden md:inline">Excluir</span>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="text-right text-xl font-bold">
            Total:
            <input
              type="number"
              className="border ml-2 p-2 rounded text-right w-40"
              value={valorTotal}
              onChange={(e) => setValorTotal(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-between p-4 border-t bg-gray-50">
          <button
            onClick={pedirExcluirAvaria}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 flex items-center gap-2"
          >
            <FaTrash /> Excluir Avaria
          </button>

          <div className="flex gap-3">
            <button
              onClick={() => salvarAlteracoes()}
              className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 flex items-center gap-2"
            >
              <FaSave /> Salvar
            </button>

            <button
              onClick={() => salvarAlteracoes('Pendente de Aprovação')}
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
            >
              <FaUndo /> Salvar e Reenviar
            </button>
          </div>
        </div>
      </div>

      {loginModalOpen && (
        <LoginModal
          title="Exclusão Restrita (Gestor/Administrador)"
          actionLabel="Autorizar exclusão"
          onConfirm={onLoginConfirm}
          onCancel={() => {
            setLoginModalOpen(false);
            setPendencia(null);
            setAcaoPendente(null);
          }}
        />
      )}
    </div>
  );
}

// ======================================================================
// =========================== PÁGINA PRINCIPAL ===========================
// ======================================================================
export default function AvariasEmRevisao() {
  const [avarias, setAvarias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  async function carregar() {
    setLoading(true);
    const { data } = await supabase
      .from('avarias')
      .select('*')
      .eq('status', 'Reprovado')
      .order('aprovado_em', { ascending: false });

    setAvarias(data || []);
    setLoading(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4 text-gray-800">Pendências de Revisão</h1>

      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full border">
          <thead className="bg-yellow-600 text-white">
            <tr>
              <th className="py-2 px-3 text-left">Data</th>
              <th className="py-2 px-3 text-left">Prefixo</th>
              <th className="py-2 px-3 text-left">Nº Avaria</th>
              <th className="py-2 px-3 text-left">Tipo</th>
              <th className="py-2 px-3 text-left">Valor</th>
              <th className="py-2 px-3 text-left">Reprovado por</th>
              <th className="py-2 px-3 text-left w-80">Motivo / Observação</th>
              <th className="py-2 px-3 text-left">Ações</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="text-center p-4">
                  Carregando...
                </td>
              </tr>
            ) : avarias.length === 0 ? (
              <tr>
                <td colSpan="8" className="text-center p-4 text-gray-600">
                  Nenhuma pendência.
                </td>
              </tr>
            ) : (
              avarias.map((a) => (
                <tr key={a.id} className="border-t">
                  <td className="py-2 px-3">
                    {a.dataAvaria ? new Date(a.dataAvaria).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td className="py-2 px-3">{a.prefixo}</td>
                  <td className="py-2 px-3">{a.numero_da_avaria || '-'}</td>
                  <td className="py-2 px-3">{a.tipoOcorrencia}</td>

                  <td className="py-2 px-3 font-medium">
                    {(a.valor_total_orcamento || 0).toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </td>

                  <td className="py-2 px-3">{a.aprovado_por || '—'}</td>

                  <td className="py-2 px-3">
                    <p className="text-sm bg-yellow-50 border rounded p-2 min-h-[48px]">
                      {a.observacao_operacao || 'Sem observação.'}
                    </p>
                  </td>

                  <td className="py-2 px-3">
                    <button
                      onClick={() => setSelected(a)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600 text-sm flex items-center gap-1"
                    >
                      <FaEdit /> Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <EditarAvariaModal
          avaria={selected}
          onClose={() => setSelected(null)}
          onAtualizarLista={carregar}
        />
      )}
    </div>
  );
}
