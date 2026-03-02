import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../supabase'

export default function Diesel_tratativas_central() {
  const { id } = useParams()
  const nav = useNavigate()

  const [t, setT] = useState(null)
  const [historico, setHistorico] = useState([])
  const [linhaDesc, setLinhaDesc] = useState('')

  const fileNameFromUrl = (u) => {
    try {
      const raw = String(u || '')
      const noHash = raw.split('#')[0]
      const noQuery = noHash.split('?')[0]
      const last = noQuery.split('/').filter(Boolean).pop() || 'arquivo'
      return decodeURIComponent(last)
    } catch {
      return 'arquivo'
    }
  }

  const isPdf = (fileOrUrl) => {
    if (!fileOrUrl) return false
    if (typeof fileOrUrl === 'string') return fileOrUrl.toLowerCase().includes('.pdf')
    return false
  }

  const isImageUrl = (u) => {
    const s = String(u || '').toLowerCase()
    return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|#|$)/.test(s)
  }

  const renderArquivoOuThumb = (url, label) => {
    if (!url) return null
    const pdf = isPdf(url)
    const img = !pdf && isImageUrl(url)

    return (
      <div className="mt-2">
        <span className="block text-sm text-gray-600 mb-2">{label}</span>
        {pdf || !img ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline" title="Abrir arquivo">
            {fileNameFromUrl(url)}
          </a>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir imagem">
            <img src={url} alt={fileNameFromUrl(url)} className="h-20 w-20 rounded border object-cover hover:opacity-90" loading="lazy" />
          </a>
        )}
      </div>
    )
  }

  const renderListaArquivosCompacta = (urls, label) => {
    const arr = Array.isArray(urls) ? urls.filter(Boolean) : []
    if (arr.length === 0) return null

    return (
      <div className="mt-2">
        <span className="block text-sm text-gray-600 mb-2">{label}</span>
        <ul className="space-y-1">
          {arr.map((u, i) => (
            <li key={`${u}-${i}`} className="text-sm">
              <a href={u} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline" title="Abrir evidência">
                {fileNameFromUrl(u)}
              </a>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const fmtDataHora = (d) => {
    if (!d) return '—'
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return '—'
    return dt.toLocaleString('pt-BR')
  }

  useEffect(() => {
    ;(async () => {
      const { data, error } = await supabase.from('atas_diesel').select('*').eq('id', id).single()
      if (error) console.error(error)
      setT(data || null)

      const h = await supabase
        .from('atas_diesel_detalhes')
        .select('id, created_at, ata_id, acao_aplicada, observacoes, imagem_tratativa, anexo_tratativa, tratado_por_login, tratado_por_nome, tratado_por_id')
        .eq('ata_id', id)
        .order('created_at', { ascending: false })

      if (h.error) console.error(h.error)
      setHistorico(h.data || [])

      if (data?.linha) {
        const { data: row } = await supabase.from('linhas').select('descricao').eq('codigo', data.linha).maybeSingle()
        setLinhaDesc(row?.descricao || '')
      } else {
        setLinhaDesc('')
      }
    })()
  }, [id])

  const ultima = useMemo(() => {
    if (!historico || historico.length === 0) return null
    return historico[0]
  }, [historico])

  if (!t) return <div className="p-6">Carregando…</div>

  const dataOcorr = t.data_ocorrido || t.data_ocorrida || '-'
  const horaOcorr = t.hora_ocorrido || t.hora_ocorrida || ''

  const evidenciasSolicitacao = Array.isArray(t.evidencias_urls) && t.evidencias_urls.length > 0
    ? t.evidencias_urls
    : t.imagem_url ? [t.imagem_url] : []

  const suspensoes = (historico || []).filter((h) => String(h.acao_aplicada || '').toLowerCase().includes('susp'))

  const conclusaoQuando = fmtDataHora(ultima?.created_at)
  const conclusaoQuem = ultima?.tratado_por_nome || ultima?.tratado_por_login || '—'
  const conclusaoObs = ultima?.observacoes || 'Sem observações registradas.'

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Consultar</h1>
        <button onClick={() => nav(`/tratar/${id}`)} className="rounded-md bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700">
          Editar
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Detalhes da Ata</h2>
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Item titulo="Motorista" valor={t.motorista_nome || '-'} />
          <Item titulo="Registro" valor={t.motorista_chapa || '-'} />
          <Item titulo="Ocorrência" valor={t.tipo_ocorrencia || '-'} />
          <Item titulo="Prioridade" valor={t.prioridade || '-'} />
          <Item titulo="Setor" valor={t.setor_origem || '-'} />
          <Item titulo="Linha" valor={t.linha ? `${t.linha}${linhaDesc ? ` - ${linhaDesc}` : ''}` : '-'} />
          <Item titulo="Status" valor={t.status || '-'} />
          <Item titulo="Data/Hora" valor={`${dataOcorr} ${horaOcorr}`} />
          <Item titulo="Descrição (abertura)" valor={t.descricao || '-'} className="md:col-span-2" />
          <div className="md:col-span-2">
            {renderListaArquivosCompacta(evidenciasSolicitacao, 'Evidências da solicitação (reclamação)')}
          </div>
        </dl>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Conclusão da Ata</h2>
          <span className="text-sm opacity-80">{conclusaoQuando}</span>
        </div>
        <div className="mt-1 font-medium">{ultima?.acao_aplicada || '—'}</div>
        <div className="mt-2 text-sm text-blue-800"><span className="font-semibold">Quem tratou:</span> {conclusaoQuem}</div>
        <div className="mt-2 whitespace-pre-wrap">{conclusaoObs}</div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>{renderArquivoOuThumb(ultima?.imagem_tratativa, 'Evidência da conclusão')}</div>
          <div>{renderArquivoOuThumb(ultima?.anexo_tratativa, 'Anexo')}</div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <h2 className="font-semibold mb-3">Histórico / Ações aplicadas</h2>
        {historico.length === 0 ? (
          <div className="text-gray-500">Sem histórico.</div>
        ) : (
          <ul className="space-y-3">
            {historico.map((h) => {
              const when = fmtDataHora(h.created_at)
              const quem = h.tratado_por_nome || h.tratado_por_login || '—'
              return (
                <li key={h.id} className="rounded border p-3">
                  <div className="text-sm text-gray-600">{when}</div>
                  <div className="font-medium">{h.acao_aplicada || '—'}</div>
                  <div className="text-sm text-blue-700 mt-1"><span className="font-semibold">Tratado por:</span> {quem}</div>
                  {h.observacoes && <div className="text-gray-700 whitespace-pre-wrap">{h.observacoes}</div>}
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>{renderArquivoOuThumb(h.imagem_tratativa, 'Evidência da conclusão')}</div>
                    <div>{renderArquivoOuThumb(h.anexo_tratativa, 'Anexo')}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-4">
        <h2 className="font-semibold mb-3">Histórico de Suspensões</h2>
        {suspensoes.length === 0 ? (
          <div className="text-gray-500">Sem suspensões registradas nesta ata.</div>
        ) : (
          <ul className="space-y-2">
            {suspensoes.map((s) => {
              const when = fmtDataHora(s.created_at)
              return (
                <li key={s.id} className="border rounded p-3">
                  <div className="text-sm text-gray-600">{when}</div>
                  <div className="font-medium">Suspensão aplicada</div>
                  {s.observacoes && <div className="text-gray-700 whitespace-pre-wrap">{s.observacoes}</div>}
                  {s.imagem_tratativa && <div className="mt-2">{renderArquivoOuThumb(s.imagem_tratativa, 'Evidência')}</div>}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}

function Item({ titulo, valor, className }) {
  return (
    <div className={className}>
      <dt className="text-sm text-gray-600">{titulo}</dt>
      <dd className="font-medium break-words">{valor}</dd>
    </div>
  )
}
