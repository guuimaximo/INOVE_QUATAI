// As imagens do Monitoramento Vision (foto de cadastro, captura da camera,
// recortes de biometria) ficam no bucket `vision-inspecoes`, que passou a ser
// PRIVADO em 2026-09-09 — antes disso qualquer um baixava rosto + registro por
// URL publica, sem login.
//
// O produtor do laudo roda fora deste repo e continua gravando a URL no formato
// publico (.../object/public/vision-inspecoes/<caminho>). Em vez de exigir
// mudanca la, aqui a gente extrai o caminho e assina na hora. Se um dia ele
// passar a gravar so o caminho, tambem funciona.

import { supabase } from "../supabase";

const BUCKET = "vision-inspecoes";
const VALIDADE_SEGUNDOS = 60 * 60;

// Aceita URL publica, URL ja assinada, ou o caminho cru.
export function caminhoNoBucket(url) {
  if (!url || typeof url !== "string") return null;

  for (const marca of [`/object/public/${BUCKET}/`, `/object/sign/${BUCKET}/`, `/object/${BUCKET}/`]) {
    const i = url.indexOf(marca);
    if (i !== -1) {
      const bruto = url.slice(i + marca.length).split("?")[0];
      try {
        return decodeURIComponent(bruto);
      } catch {
        return bruto;
      }
    }
  }

  // Nao e URL: trata como caminho dentro do bucket.
  if (!/^https?:\/\//i.test(url)) return url.replace(/^\/+/, "");

  // URL de outro lugar — devolve null para o chamador manter o valor original.
  return null;
}

/**
 * Assina varias URLs de uma vez (uma ida ao servidor por lote).
 * Devolve um objeto { [urlOriginal]: urlAssinada | null }.
 * Valor null significa "nao consegui assinar" — a tela mostra o fallback.
 */
export async function assinarUrlsVision(urls) {
  const originais = [...new Set((urls || []).filter(Boolean))];
  if (!originais.length) return {};

  const porCaminho = new Map();
  const resultado = {};

  for (const url of originais) {
    const caminho = caminhoNoBucket(url);
    if (!caminho) {
      resultado[url] = url; // nao e do nosso bucket: deixa como esta
      continue;
    }
    if (!porCaminho.has(caminho)) porCaminho.set(caminho, []);
    porCaminho.get(caminho).push(url);
  }

  const caminhos = [...porCaminho.keys()];
  if (!caminhos.length) return resultado;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(caminhos, VALIDADE_SEGUNDOS);

  if (error) {
    console.warn("Falha ao assinar imagens do Vision:", error.message);
    for (const url of originais) if (!(url in resultado)) resultado[url] = null;
    return resultado;
  }

  const assinadaPorCaminho = new Map();
  for (const item of data || []) {
    // o retorno traz `path` sem barra inicial e `signedUrl` (ou erro por item)
    // o SDK expoe `signedUrl`; o REST cru devolve `signedURL`. Aceita os dois.
    const assinada = item?.signedUrl || item?.signedURL;
    if (item?.path && assinada) assinadaPorCaminho.set(item.path, assinada);
  }

  for (const [caminho, urlsDoCaminho] of porCaminho) {
    const assinada = assinadaPorCaminho.get(caminho) || null;
    for (const url of urlsDoCaminho) resultado[url] = assinada;
  }

  return resultado;
}

/** Versao de uma URL so — conveniencia para chamadas isoladas. */
export async function assinarUrlVision(url) {
  if (!url) return null;
  const mapa = await assinarUrlsVision([url]);
  return mapa[url] ?? null;
}
