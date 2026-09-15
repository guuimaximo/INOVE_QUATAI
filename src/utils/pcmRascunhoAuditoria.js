// A AUDITORIA DE PNEUS EM ANDAMENTO, guardada no próprio celular.
//
// Por que existe: no APK, a câmera abre como outro app e o INOVE vai para segundo plano.
// Celular com pouca memória MATA o app nesse momento, e ao voltar ele "fecha e abre" do
// zero — a ficha e as fotos já tiradas somem. Isso acontecia justamente na ÚLTIMA foto,
// que é quando o app segura mais coisa na memória.
//
// Reduzir memória diminui a chance, mas não impede: quem decide matar é o Android. Então,
// além de gastar menos, a auditoria passa a SOBREVIVER à morte do app — cada alteração é
// gravada aqui, e ao reabrir a auditoria o PCM continua de onde parou.
//
// As fotos vão como Blob direto no IndexedDB (sem base64): base64 ocupa 1/3 a mais e
// exigiria segurar a string inteira na memória para gravar — o problema que estamos
// resolvendo.

const DB_NAME = "inove-pcm-rascunho";
const STORE = "rascunhos";
const CHAVE = "auditoria";

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function comStore(modo, fn) {
  const db = await abrir();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, modo);
      const store = tx.objectStore(STORE);
      let resultado;
      const req = fn(store);
      if (req) req.onsuccess = () => { resultado = req.result; };
      tx.oncomplete = () => resolve(resultado);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Tem alguma coisa digitada ou fotografada? Rascunho vazio não merece perguntar nada. */
export function rascunhoTemConteudo(r) {
  if (!r) return false;
  if (String(r.prefixo || "").trim() || String(r.observacoes || "").trim()) return true;
  return (r.posicoes || []).some(
    (p) => p.foto || String(p.numeroFogo || "").trim() || String(p.calibragem || "").trim() || String(p.sulco || "").trim(),
  );
}

export function contarFotos(r) {
  return (r?.posicoes || []).filter((p) => p.foto).length;
}

/**
 * Grava o formulário como está. `usuario` vai junto: um celular do PCM passa de mão em
 * mão, e a auditoria de um não pode aparecer como "sua em andamento" para o outro.
 */
export async function salvarRascunhoAuditoria(form, usuario, extra = {}) {
  const rascunho = {
    id: CHAVE,
    usuario: String(usuario || ""),
    salvoEm: new Date().toISOString(),
    prefixo: form?.prefixo || "",
    observacoes: form?.observacoes || "",
    posicoes: (form?.posicoes || []).map((p) => ({
      posicao: p.posicao,
      numeroFogo: p.numeroFogo || "",
      calibragem: p.calibragem || "",
      sulco: p.sulco || "",
      foto: p.foto || null,
      fotoNome: p.foto?.name || "",
      fotoTipo: p.foto?.type || "",
    })),
    fotoPendente: null,
    ...extra,
  };
  if (!rascunhoTemConteudo(rascunho) && rascunho.fotoPendente == null) {
    await apagarRascunhoAuditoria();
    return;
  }
  await comStore("readwrite", (store) => store.put(rascunho));
}

export async function lerRascunhoAuditoria() {
  try {
    const r = await comStore("readonly", (store) => store.get(CHAVE));
    if (!r) return null;
    // Blob volta como Blob; o formulário e o upload esperam File, com nome.
    r.posicoes = (r.posicoes || []).map((p) => ({
      ...p,
      foto: p.foto
        ? new File([p.foto], p.fotoNome || `${p.posicao || "foto"}.jpg`, { type: p.fotoTipo || p.foto.type || "image/jpeg" })
        : null,
    }));
    return r;
  } catch {
    return null; // sem IndexedDB (navegador restrito): o fluxo segue como era antes
  }
}

export async function apagarRascunhoAuditoria() {
  try {
    await comStore("readwrite", (store) => store.delete(CHAVE));
  } catch {
    // nada a fazer
  }
}

/**
 * A foto que ESTAVA SENDO TIRADA quando o Android matou o app. O Capacitor a entrega na
 * reabertura (`appRestoredResult`); a posição dela foi anotada em `fotoPendente` antes de
 * abrir a câmera, porque depois da morte do app ninguém mais sabe para qual pneu era.
 */
export async function anexarFotoRestaurada(file) {
  const r = await comStore("readonly", (store) => store.get(CHAVE)).catch(() => null);
  if (!r || r.fotoPendente == null || !file) return false;
  const i = Number(r.fotoPendente);
  if (!r.posicoes?.[i]) return false;
  r.posicoes[i] = { ...r.posicoes[i], foto: file, fotoNome: file.name || "", fotoTipo: file.type || "" };
  r.fotoPendente = null;
  r.salvoEm = new Date().toISOString();
  await comStore("readwrite", (store) => store.put(r));
  return true;
}
