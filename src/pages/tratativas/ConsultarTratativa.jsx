import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../supabase'
import {
  FaEdit,
  FaUser,
  FaIdBadge,
  FaExclamationTriangle,
  FaFlag,
  FaBuilding,
  FaBus,
  FaInfoCircle,
  FaCalendarAlt,
  FaClipboardList,
  FaHistory,
  FaBan,
  FaPaperclip,
  FaImage,
  FaArrowLeft,
} from 'react-icons/fa'
import FileViewerModal from '../../components/FileViewerModal'

export default function ConsultarTratativa() {
  const { id } = useParams()
  const nav = useNavigate()

  const [t, setT] = useState(null)
  const [historico, setHistorico] = useState([])
  const [linhaDesc, setLinhaDesc] = useState('')
  const [viewerFile, setViewerFile] = useState(null)

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

  const openViewer = (url) => {
    if (!url) return
    setViewerFile({ url, name: fileNameFromUrl(url) })
  }

  const renderViewerArquivoOuThumb = (url, label) => {
    if (!url) return null
    const pdf = isPdf(url)
    const img = !pdf && isImageUrl(url)

    return (
      <div className="mt-2">
        <span className="mb-2 block text-sm font-semibold text-slate-500">{label}</span>

        {pdf || !img ? (
          <button
            type="button"
            onClick={() => openViewer(url)}
            className="block rounded-xl border bg-white p-3 text-left hover:shadow-sm"
            title="Visualizar arquivo"
          >
            <div className="flex items-center justify-between">
              <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {pdf ? 'PDF' : 'ARQ'}
              </span>
            </div>
            <div className="mt-2 break-words text-sm text-blue-700 underline">
              {fileNameFromUrl(url)}
            </div>
          </button>
        ) : (
          <button type="button" onClick={() => openViewer(url)} title="Visualizar imagem">
            <img
              src={url}
              alt={fileNameFromUrl(url)}
              className="h-24 w-24 rounded-xl border object-cover hover:opacity-90"
              loading="lazy"
            />
          </button>
        )}
      </div>
    )
  }

  const renderViewerListaArquivosCompacta = (urls, label) => {
    const arr = Array.isArray(urls) ? urls.filter(Boolean) : []
    if (arr.length === 0) return null

    return (
      <div className="mt-2">
        <span className="mb-2 block text-sm font-semibold text-slate-500">{label}</span>
        <ul className="space-y-2">
          {arr.map((u, i) => (
            <li key={`${u}-${i}`} className="text-sm">
              <button
                type="button"
                onClick={() => openViewer(u)}
                className="inline-flex items-center gap-2 text-left text-blue-600 underline"
                title="Visualizar evidência"
              >
                {isImageUrl(u) && !isPdf(u) ? <FaImage className="text-xs" /> : <FaPaperclip className="text-xs" />}
                {fileNameFromUrl(u)}
              </button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const renderArquivoOuThumb = (url, label) => {
    if (!url) return null
    const pdf = isPdf(url)
    const img = !pdf && isImageUrl(url)

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
                {pdf ? 'PDF' : 'ARQ'}
              </span>
            </div>
            <div className="mt-2 text-sm text-blue-700 underline break-words">
              {fileNameFromUrl(url)}
            </div>
          </a>
        ) : (
          <a href={url} target="_blank" rel="noopener noreferrer" title="Abrir imagem">
            <img
              src={url}
              alt={fileNameFromUrl(url)}
              className="h-24 w-24 rounded-xl border object-cover hover:opacity-90"
              loading="lazy"
            />
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
        <span className="block text-sm text-slate-500 mb-2 font-semibold">{label}</span>
        <ul className="space-y-2">
          {arr.map((u, i) => (
            <li key={`${u}-${i}`} className="text-sm">
              <a
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-blue-600 underline"
                title="Abrir evidência"
              >
                {isImageUrl(u) && !isPdf(u) ? <FaImage className="text-xs" /> : <FaPaperclip className="text-xs" />}
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
      const { data, error } = await supabase
        .from('tratativas')
        .select('*')
        .eq('id', id)
        .single()

      if (error) console.error(error)
      setT(data || null)

      const h = await supabase
        .from('tratativas_detalhes')
        .select(`
          id,
          created_at,
          tratativa_id,
          acao_aplicada,
          observacoes,
          imagem_tratativa,
          anexo_tratativa,
          anexo_vale,
          tratado_por_login,
          tratado_por_nome,
          tratado_por_id
        `)
        .eq('tratativa_id', id)
        .order('created_at', { ascending: false })

      if (h.error) console.error(h.error)
      setHistorico(h.data || [])

      if (data?.linha) {
        const { data: row } = await supabase
          .from('linhas')
          .select('descricao')
          .eq('codigo', data.linha)
          .maybeSingle()
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

  const evidenciasSolicitacao =
    Array.isArray(t.evidencias_urls) && t.evidencias_urls.length > 0
      ? t.evidencias_urls
      : t.imagem_url
      ? [t.imagem_url]
      : []

  const suspensoes = (historico || []).filter((h) =>
    String(h.acao_aplicada || '').toLowerCase().includes('susp')
  )

  const conclusaoQuando = fmtDataHora(ultima?.created_at)
  const conclusaoQuem = ultima?.tratado_por_nome || ultima?.tratado_por_login || '—'
  const conclusaoObs = ultima?.observacoes || 'Sem observações registradas.'

  return (
    <div className="min-h-screen space-y-5 bg-slate-50 p-4 md:p-6 text-slate-800">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div className="space-y-3">
          <button
            onClick={() => nav(-1)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            <FaArrowLeft />
            Voltar
          </button>

          <div>
            <div className="text-xs font-black uppercase tracking-[0.24em] text-violet-600">
              Tratativas
            </div>
            <h1 className="mt-3 text-3xl font-black text-slate-900">Consultar Tratativa</h1>
            <p className="mt-2 text-sm text-slate-600">
              Visualização completa da tratativa, conclusão e histórico de ações.
            </p>
          </div>
        </div>

        <button
          onClick={() => nav(`/tratar/${id}`)}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
        >
          <FaEdit />
          Editar
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <ResumoCard
          titulo="Motorista"
          valor={t.motorista_nome || '-'}
          subtitulo={t.motorista_chapa || '-'}
          icon={<FaUser className="text-3xl text-blue-100" />}
          border="border-l-blue-500"
        />

        <ResumoCard
          titulo="Ocorrência"
          valor={t.tipo_ocorrencia || '-'}
          subtitulo={t.prioridade || '-'}
          icon={<FaExclamationTriangle className="text-3xl text-amber-100" />}
          border="border-l-amber-500"
        />

        <ResumoCard
          titulo="Status"
          valor={t.status || '-'}
          subtitulo={t.setor_origem || '-'}
          icon={<FaInfoCircle className="text-3xl text-violet-100" />}
          border="border-l-violet-500"
        />

        <ResumoCard
          titulo="Data/Hora"
          valor={dataOcorr || '-'}
          subtitulo={horaOcorr || '-'}
          icon={<FaCalendarAlt className="text-3xl text-emerald-100" />}
          border="border-l-emerald-500"
        />
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <FaClipboardList className="text-slate-500" />
          <h2 className="text-lg font-bold text-slate-800">Detalhes da Tratativa</h2>
        </div>

        <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Item titulo="Motorista" valor={t.motorista_nome || '-'} icon={<FaUser />} />
          <Item titulo="Registro" valor={t.motorista_chapa || '-'} icon={<FaIdBadge />} />
          <Item titulo="Ocorrência" valor={t.tipo_ocorrencia || '-'} icon={<FaExclamationTriangle />} />
          <Item titulo="Prioridade" valor={t.prioridade || '-'} icon={<FaFlag />} />
          <Item titulo="Setor" valor={t.setor_origem || '-'} icon={<FaBuilding />} />
          <Item
            titulo="Linha"
            valor={t.linha ? `${t.linha}${linhaDesc ? ` - ${linhaDesc}` : ''}` : '-'}
            icon={<FaBus />}
          />
          <Item titulo="Status" valor={t.status || '-'} icon={<FaInfoCircle />} />
          <Item titulo="Data/Hora" valor={`${dataOcorr} ${horaOcorr}`} icon={<FaCalendarAlt />} />
          <Item
            titulo="Descrição (abertura)"
            valor={t.descricao || '-'}
            className="md:col-span-2"
          />

          <div className="md:col-span-2">
            {renderViewerListaArquivosCompacta(
              evidenciasSolicitacao,
              'Evidências da solicitação (reclamação)'
            )}
          </div>
        </dl>
      </div>

      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-emerald-900">Conclusão da Tratativa</h2>
            <p className="text-sm text-emerald-700 mt-1">
              Última ação registrada no histórico.
            </p>
          </div>
          <span className="text-sm font-semibold text-emerald-800">{conclusaoQuando}</span>
        </div>

        <div className="mt-4 rounded-lg bg-white/70 border border-emerald-200 p-4">
          <div className="font-bold text-slate-800">{ultima?.acao_aplicada || '—'}</div>

          <div className="mt-2 text-sm text-blue-800">
            <span className="font-semibold">Quem tratou:</span> {conclusaoQuem}
          </div>

          <div className="mt-3 whitespace-pre-wrap text-slate-700">{conclusaoObs}</div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>{renderViewerArquivoOuThumb(ultima?.imagem_tratativa, 'Evidência da conclusão')}</div>
            <div>{renderViewerArquivoOuThumb(ultima?.anexo_tratativa, 'Anexo da tratativa')}</div>
            <div>{renderViewerArquivoOuThumb(ultima?.anexo_vale, 'Anexo do vale')}</div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <FaHistory className="text-slate-500" />
          <h2 className="text-lg font-bold text-slate-800">Histórico / Ações aplicadas</h2>
        </div>

        {historico.length === 0 ? (
          <div className="text-slate-500">Sem histórico.</div>
        ) : (
          <ul className="space-y-4">
            {historico.map((h) => {
              const when = fmtDataHora(h.created_at)
              const quem = h.tratado_por_nome || h.tratado_por_login || '—'

              return (
                <li key={h.id} className="rounded-xl border p-4 bg-slate-50/60">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-800">{h.acao_aplicada || '—'}</div>
                      <div className="text-sm text-blue-700 mt-1">
                        <span className="font-semibold">Tratado por:</span> {quem}
                      </div>
                    </div>
                    <div className="text-sm text-slate-500 font-medium">{when}</div>
                  </div>

                  {h.observacoes && (
                    <div className="mt-3 text-slate-700 whitespace-pre-wrap">
                      {h.observacoes}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>{renderViewerArquivoOuThumb(h.imagem_tratativa, 'Evidência da conclusão')}</div>
                    <div>{renderViewerArquivoOuThumb(h.anexo_tratativa, 'Anexo da tratativa')}</div>
                    <div>{renderViewerArquivoOuThumb(h.anexo_vale, 'Anexo do vale')}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border p-4 md:p-5">
        <div className="flex items-center gap-2 mb-4">
          <FaBan className="text-slate-500" />
          <h2 className="text-lg font-bold text-slate-800">Histórico de Suspensões</h2>
        </div>

        {suspensoes.length === 0 ? (
          <div className="text-slate-500">Sem suspensões registradas nesta tratativa.</div>
        ) : (
          <ul className="space-y-4">
            {suspensoes.map((s) => {
              const when = fmtDataHora(s.created_at)

              return (
                <li key={s.id} className="border rounded-xl p-4 bg-rose-50/40">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
                    <div className="font-bold text-slate-800">Suspensão aplicada</div>
                    <div className="text-sm text-slate-500 font-medium">{when}</div>
                  </div>

                  {s.observacoes && (
                    <div className="mt-3 text-slate-700 whitespace-pre-wrap">
                      {s.observacoes}
                    </div>
                  )}

                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>{renderViewerArquivoOuThumb(s.imagem_tratativa, 'Evidência')}</div>
                    <div>{renderViewerArquivoOuThumb(s.anexo_vale, 'Anexo do vale')}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <FileViewerModal
        open={Boolean(viewerFile?.url)}
        url={viewerFile?.url || ''}
        name={viewerFile?.name || ''}
        onClose={() => setViewerFile(null)}
      />
    </div>
  )
}

function ResumoCard({ titulo, valor, subtitulo, icon, border }) {
  const tone =
    border?.includes("blue")
      ? "from-blue-50 to-cyan-50 border-blue-200 text-blue-700"
      : border?.includes("amber")
      ? "from-amber-50 to-orange-50 border-amber-200 text-amber-700"
      : border?.includes("violet")
      ? "from-violet-50 to-fuchsia-50 border-violet-200 text-violet-700"
      : border?.includes("emerald")
      ? "from-emerald-50 to-teal-50 border-emerald-200 text-emerald-700"
      : "from-slate-50 to-gray-50 border-slate-200 text-slate-700";

  return (
    <div className={`min-h-[124px] rounded-3xl border bg-gradient-to-br p-4 shadow-sm ${tone}`}>
      <div className="flex h-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.18em] opacity-80">{titulo}</p>
          <p className="mt-3 text-2xl font-black text-slate-900 break-words">{valor}</p>
          {subtitulo ? (
            <p className="mt-2 text-xs font-semibold break-words opacity-80">{subtitulo}</p>
          ) : null}
        </div>
        <div className="text-2xl opacity-80">{icon}</div>
      </div>
    </div>
  )
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
  )
}

