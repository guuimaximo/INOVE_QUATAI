import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  LOCAIS,
  RAIO_VEIC,
  distanciaM,
  horaParaMinutos,
  localConhecido,
  ordenarPontas,
  raioLocal,
  resolverTerminal,
} from "./regrasGps";

/* =============================================================================
   MapaBatidas — o mapa das batidas do pop-up do cartão (Leaflet).

   Porte de Sistemas/PONTO — app/ui/app.js:
     initPdMap ...... app.js:4503-4566  (o mapa)
     desenhaLocais .. app.js:4468-4485  (as cercas)
     pdPin .......... app.js:4455       (o pino com emoji)
     estilos ........ app/ui/styles.css:689, 885-889, 1528-1543
   Constantes (LOCAIS, RAIO_*) vêm de `regrasGps.js`, que é o porte de main.py —
   NÃO redefina coordenada nem raio aqui.

   POR QUE O MAPA EXISTE: a lista de batidas diz "fora · 2,1 km"; o mapa diz
   ONDE aquilo foi. Sem as cercas desenhadas, pessoa e ônibus ficavam soltos num
   fundo de rua: dava pra medir a distância entre os dois, mas não pra saber se
   aquele ponto era o terminal, a garagem ou o meio do corredor.

   ORDEM DO DESENHO (a mesma do original, e ela importa):
     1. cercas (por baixo, `zIndexOffset: -600`)
     2. a pessoa (pino 👤 com rótulo permanente)
     3. o ônibus (pino 🚌 casado no tempo pela régua)
     4. a régua (linha pessoa↔ônibus com a distância)

   API
     <MapaBatidas
        batidas={[...]}         // linhas de `ponto_gps` — usado quando NÃO há régua
        ancoras={[...]}         // linhas de `gps_carro` — de onde sai a COORDENADA do ônibus
        resultadoRegua={[...]}  // saída de `reguaLocal()` — manda no veredito e nos rótulos
        nome="FULANO"           // motorista, só para o tooltip do ônibus
        altura={320}
     />

   Quando `resultadoRegua` vem preenchido ele é a FONTE: já traz lat/lon da
   batida, papel, `fora`, `via`, distância e os campos textuais do veículo. As
   `ancoras` entram só para recuperar a COORDENADA do ônibus, que a régua usa
   internamente mas não devolve. Sem régua (aba Motorista, que não lê
   `gps_carro`) o mapa desenha cercas + pessoas, sem ônibus e sem linha — é
   exatamente o que aquela tela sabe.
   ========================================================================== */

/* ------------------------------------------------------------------ helpers */

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const km = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`);

const numero = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** "HH:MM" para exibição (aceita a hora compacta "0410" do lake). */
function horaTexto(v) {
  const m = horaParaMinutos(v);
  if (m == null) return String(v ?? "").slice(0, 5);
  const mm = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
}

/**
 * Tipo VISUAL da referência (só escolhe emoji e cor). Espelha `_tipo_local`
 * (main.py:345), que em `regrasGps` é privado. O RAIO continua vindo de
 * `raioLocal()` — a regra não é reimplementada aqui, só o ícone.
 */
function tipoVisual(nome) {
  const x = String(nome ?? "").toLowerCase();
  if (x.startsWith("garagem")) return "garagem";
  if (x.startsWith("terminal")) return "terminal";
  if (x.startsWith("esta") || x.startsWith("apoio")) return "estacao";
  return "poi";
}

const ICO_LOCAL = {
  garagem: ["🏠", "#2f4f8f"],
  terminal: ["🚏", "#7a4fa3"],
  estacao: ["🚉", "#7a4fa3"],
  poi: ["📍", "#8a8f99"],
};

// app.js:4477 — cores das pontas da jornada.
const COR_PAPEL = { Entrada: "#1c8a51", Saída: "#c53434", Almoço: "#9a6a11" };
const COR_PADRAO = "#3d6ae0";

/** `lab` (app.js:4476): primeira = Entrada, última = Saída, resto = Almoço. */
const rotuloPorIndice = (i, n) => (i === 0 ? "Entrada" : i === n - 1 ? "Saída" : "Almoço");

const pino = (emoji, cor) =>
  L.divIcon({
    className: "",
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    html: `<div class="dp-map-pin" style="background:${cor}">${emoji}</div>`,
  });

/* ------------------------------------------------------------------ modelo  */

/**
 * Coordenada de uma linha de `gps_carro`, pela MESMA escada da régua
 * (regrasGps `reguaLocal`, bloco 1): lat/lon crus quando existem; senão o
 * nome do terminal do Citatti resolvido em `resolverTerminal`. Terminal que a
 * régua não resolve (o "Est Itaqua", ambíguo de propósito) fica sem coordenada
 * e some do mapa — é o mesmo "não medido" da lista.
 */
function coordAncora(a) {
  const lat = numero(a?.latitude);
  const lon = numero(a?.longitude);
  if (lat != null && lon != null) return { lat, lon };
  const nomePoi = String(a?.poi ?? "").trim() || String(a?.cerca ?? "").trim();
  const r = resolverTerminal(nomePoi);
  return r ? { lat: r.lat, lon: r.lon } : null;
}

/**
 * Recupera a COORDENADA do ônibus que a régua casou com esta batida.
 * A régua devolve hora/veículo/POI da âncora escolhida, mas não a coordenada —
 * então procura-se de volta na lista crua de `gps_carro`.
 *
 * O desempate é a própria distância: entre as âncoras candidatas, a certa é a
 * que reproduz EXATAMENTE o `distancia` que a régua calculou (mesmo Haversine
 * truncado). Isso evita pôr o ônibus no lugar de outra âncora da mesma hora.
 */
function acharCarro(d, ancoras) {
  const mRef = horaParaMinutos(d.horaVeiculo);
  const veic = String(d.veiculo ?? "").trim();
  const candidatas = ancoras.filter(
    (a) =>
      (mRef == null || a.m === mRef) && (!veic || !a.veiculo || a.veiculo === veic),
  );
  const bate = (a) =>
    d.distancia != null && distanciaM(d.lat, d.lon, a.coord.lat, a.coord.lon) === d.distancia;
  return candidatas.find(bate) || ancoras.find(bate) || candidatas[0] || null;
}

/**
 * Normaliza tudo o que o mapa precisa desenhar. Um item por batida:
 * { lat, lon, papel, hora, local, fora, distancia, carro }.
 * `carro` é null quando não há ônibus a desenhar — dia de RESERVA
 * (`via === "local"`, app.js:4488) ou âncora sem coordenada ("não medido").
 */
function montarModelo({ batidas, ancoras, resultadoRegua, nome }) {
  const anc = (ancoras || [])
    .map((a) => ({
      m: horaParaMinutos(a?.hora),
      veiculo: String(a?.veiculo ?? "").trim(),
      coord: coordAncora(a),
    }))
    .filter((a) => a.coord);

  if ((resultadoRegua || []).length) {
    return (resultadoRegua || [])
      .filter((d) => Number.isFinite(d?.lat) && Number.isFinite(d?.lon))
      .map((d) => {
        // RESERVA e "não medido" não têm carro: `via` só é "veiculo" quando a
        // régua realmente mediu contra a posição operacional.
        const a = d.via === "veiculo" ? acharCarro(d, anc) : null;
        return {
          lat: d.lat,
          lon: d.lon,
          papel: d.papel || "",
          hora: d.hora || "",
          local: d.nomeLocal || d.localMaisProximo || "",
          fora: d.fora,
          distancia: d.distancia,
          carro: a
            ? {
                lat: a.coord.lat,
                lon: a.coord.lon,
                veiculo: d.veiculo || "",
                hora: d.horaVeiculo || "",
                poi: d.poi || "",
                linha: d.linha || "",
                fonte: d.fonte || "",
                nome: nome || "",
              }
            : null,
        };
      });
  }

  // Sem régua: só as batidas (aba Motorista, que não lê `gps_carro`).
  // O rótulo Entrada/Almoço/Saída sai da POSIÇÃO na jornada, então a ordem tem
  // que ser a da jornada — `ordenarPontas` (o `ordenaBatidas` do app.js:4489).
  // Turno que cruza a meia-noite tem a madrugada no FIM: ordenado pelo relógio,
  // a saída das 00:40 viraria "Entrada".
  const pts = (batidas || [])
    .map((b) => ({
      lat: numero(b?.latitude ?? b?.lat),
      lon: numero(b?.longitude ?? b?.lon ?? b?.lng),
      hora: horaTexto(b?.hora),
      local: String(b?.local ?? ""),
      m: horaParaMinutos(b?.hora),
    }))
    .filter((p) => p.lat != null && p.lon != null);

  return ordenarPontas(pts).map((p, i) => ({
    ...p,
    papel: rotuloPorIndice(i, pts.length),
    local: p.local || localConhecido(p.lat, p.lon)?.nome || "",
    fora: null,
    distancia: null,
    carro: null,
  }));
}

/* ------------------------------------------------------------------ cercas  */

/**
 * `desenhaLocais` (app.js:4468). A CERCA DESENHADA É A REGRA: o raio de cada
 * referência vem de `raioLocal()` (100 m em tudo hoje), não de um número solto.
 * Os marcadores ficam ATRÁS das batidas — a referência não pode tapar o que
 * está sendo julgado.
 */
function desenhaLocais(map) {
  const camada = L.layerGroup().addTo(map);
  for (const l of LOCAIS) {
    const tipo = tipoVisual(l.nome);
    const [emo, cor] = ICO_LOCAL[tipo] || ICO_LOCAL.poi;
    const gar = tipo === "garagem";
    const raio = raioLocal(l.nome);
    L.circle([l.lat, l.lon], {
      radius: raio,
      color: cor,
      weight: 1.2,
      opacity: gar ? 0.55 : 0.35,
      fillColor: cor,
      fillOpacity: gar ? 0.1 : 0.06,
      interactive: false,
    }).addTo(camada);
    L.marker([l.lat, l.lon], {
      icon: L.divIcon({
        className: "",
        iconSize: [26, 26],
        iconAnchor: [13, 13],
        html: `<div class="dp-map-loc ${tipo}">${emo}</div>`,
      }),
      zIndexOffset: -600,
    })
      .addTo(camada)
      .bindTooltip(
        `<b>${emo} ${esc(l.nome)}</b><br><span style="opacity:.7">cerca de ${raio} m</span>`,
        { direction: "top", className: "dp-map-tip dp-map-loctip", offset: [0, -12] },
      );
  }
  return camada;
}

/* ---------------------------------------------------------------- componente */

export default function MapaBatidas({
  batidas = [],
  ancoras = [],
  resultadoRegua = [],
  nome = "",
  altura = 320,
}) {
  const elRef = useRef(null);
  const modeloRef = useRef([]);

  const modelo = useMemo(
    () => montarModelo({ batidas, ancoras, resultadoRegua, nome }),
    [batidas, ancoras, resultadoRegua, nome],
  );
  modeloRef.current = modelo;

  // O efeito não pode depender do array (parent que remonta a lista recriaria o
  // mapa a cada render, e o Leaflet pisca inteiro). Depende da ASSINATURA dos
  // dados; o conteúdo vem do ref.
  const chave = useMemo(() => JSON.stringify(modelo), [modelo]);

  useEffect(() => {
    const el = elRef.current;
    const pts = modeloRef.current;
    if (!el || !pts.length) return undefined;

    el.innerHTML = "";
    const map = L.map(el, { zoomControl: true });
    // Centro provisório antes das camadas (app.js:4517): deixa a projeção
    // definida desde a primeira camada. O fitBounds do fim continua mandando.
    map.setView([pts[0].lat, pts[0].lon], 15);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // 1) referências primeiro, pra ficarem por baixo das batidas
    try {
      desenhaLocais(map);
    } catch {
      /* cerca é apoio de leitura: se falhar, o mapa das batidas continua de pé */
    }

    const bounds = [];
    for (const p of pts) {
      const papel = p.papel || "";
      const cor = COR_PAPEL[papel] || COR_PADRAO;

      // 2) a PESSOA (batida), com rótulo PERMANENTE — o mapa tem que ser legível
      // sem passar o mouse em cada pino.
      L.marker([p.lat, p.lon], { icon: pino("👤", cor) })
        .addTo(map)
        .bindTooltip(
          `<b style="color:${cor}">${esc(papel || "Batida")}</b> ${esc(p.hora || "")}` +
            (p.local ? `<br>${esc(p.local)}` : ""),
          { permanent: true, direction: "top", className: "dp-map-tip", offset: [0, -14] },
        );
      bounds.push([p.lat, p.lon]);

      // 3) o ÔNIBUS casado no tempo + 4) a régua com a distância.
      // Batida de RESERVA não tem carro (via="local") — nesse dia a pessoa não
      // tem veículo, e medir contra um carro que só vira dela horas depois é o
      // falso "bateu fora" que a régua existe para não produzir.
      const v = p.carro;
      if (!v) continue;

      const corLinha = p.fora ? "#c53434" : "#1c8a51";
      const dicaBus = [
        `<b>🚌 Veículo ${esc(v.veiculo || "—")}</b>`,
        `Chegou: <b>${esc(v.hora || "—")}</b>`,
        v.poi ? `Local: ${esc(v.poi)}` : "",
        v.linha ? `Linha: ${esc(v.linha)}` : "",
        v.nome ? `Motorista: ${esc(v.nome)}` : "",
        v.fonte
          ? `<span style="opacity:.55">fonte: ${v.fonte === "CITATTI" ? "Citatti" : esc(v.fonte)}</span>`
          : "",
      ]
        .filter(Boolean)
        .join("<br>");

      L.marker([v.lat, v.lon], { icon: pino("🚌", COR_PADRAO) })
        .addTo(map)
        .bindTooltip(dicaBus, {
          direction: "bottom",
          className: "dp-map-tip dp-map-bustip",
          offset: [0, 14],
        });

      L.polyline(
        [
          [p.lat, p.lon],
          [v.lat, v.lon],
        ],
        {
          color: corLinha,
          weight: 2.5,
          opacity: 0.85,
          dashArray: p.fora ? "7 5" : null,
        },
      ).addTo(map);

      if (p.distancia != null) {
        L.marker([(p.lat + v.lat) / 2, (p.lon + v.lon) / 2], {
          icon: L.divIcon({
            className: "",
            iconSize: [1, 1],
            html: `<div class="dp-map-dist" style="border-color:${corLinha};color:${corLinha}">${km(p.distancia)}</div>`,
          }),
        }).addTo(map);
      }
      bounds.push([v.lat, v.lon]);
    }

    // ENQUADRAMENTO: SÓ AS BATIDAS E O CARRO (app.js:4554-4559). Meter as
    // referências próximas no bounds destruiu o mapa uma vez: FABIO 16/08, duas
    // batidas ocupando 52 x 620 m, o filtro puxou 6 locais, o bounds virou
    // 1,6 x 2,1 km e o fitBounds caiu pra zoom 12 — "sumiu tudo". A referência
    // aparece se couber no enquadramento; ela não manda no zoom.
    try {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } catch {
      /* bounds degenerado: fica o setView provisório */
    }

    // O pop-up nasce escondido/animando e o Leaflet mede o container errado:
    // sem isto o mapa aparece cortado ou cinza. O timer cobre a abertura; o
    // observer cobre redimensionamento e layout tardio.
    const t = setTimeout(() => map.invalidateSize(), 120);
    let obs = null;
    if (typeof ResizeObserver !== "undefined") {
      obs = new ResizeObserver(() => map.invalidateSize());
      obs.observe(el);
    }

    return () => {
      clearTimeout(t);
      if (obs) obs.disconnect();
      // Sem o remove() o Leaflet deixa o container marcado e a reabertura do
      // pop-up monta um mapa quebrado ("Map container is already initialized").
      map.remove();
    };
  }, [chave, altura]);

  return (
    <div className="dp-map">
      <style>{CSS_MAPA}</style>
      {modelo.length ? (
        <>
          <div className="dp-map-leg">
            <span className="dp-map-lg">
              <i className="dp-map-loc garagem">🏠</i>garagem
            </span>
            <span className="dp-map-lg">
              <i className="dp-map-loc terminal">🚏</i>terminal · estação · apoio
            </span>
            <span className="dp-map-lg dp-map-lgc">
              cerca do local {raioLocal("Garagem")} m · veículo {RAIO_VEIC} m
            </span>
          </div>
          <div ref={elRef} className="dp-map-box" style={{ height: altura }} />
        </>
      ) : (
        <div className="dp-map-off" style={{ height: altura }}>
          sem GPS neste dia
        </div>
      )}
    </div>
  );
}

/* Estilos do mapa (porte de styles.css:689, 885-889, 1528-1543). Ficam aqui, e
   não no dp360.css, porque só existem quando este componente está na tela.
   Usam os tokens do `.dp360` com fallback, para o mapa não destoar do pop-up. */
const CSS_MAPA = `
/* isolation+position: os panes do Leaflet vão até z-index 800 e, soltos,
   passavam POR CIMA do cabeçalho e do botão de fechar do pop-up. */
.dp-map-box{width:100%;border-radius:12px;overflow:hidden;position:relative;
  isolation:isolate;z-index:0;
  border:1px solid var(--dp-border,#e4e8f0);background:var(--dp-surface-2,#f6f8fb)}
.dp-map-box .leaflet-container{height:100%;width:100%;font:inherit;background:var(--dp-surface-2,#f6f8fb)}
.dp-map-off{display:flex;align-items:center;justify-content:center;border-radius:12px;
  border:1px dashed var(--dp-border,#e4e8f0);color:var(--dp-muted,#6b7688);font-size:13px}
.dp-map-pin{width:28px;height:28px;border-radius:50%;border:2px solid #fff;
  box-shadow:0 2px 6px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;
  font-size:14px;line-height:1}
.dp-map-loc{display:flex;align-items:center;justify-content:center;width:26px;height:26px;
  border-radius:50%;font-size:14px;line-height:1;background:var(--dp-surface,#fff);
  border:2px solid #7a4fa3;box-shadow:0 1px 4px rgba(0,0,0,.25);opacity:.92}
.dp-map-loc.garagem{border-color:#2f4f8f;width:30px;height:30px;font-size:16px;opacity:1}
.dp-map-loc.terminal,.dp-map-loc.estacao{border-color:#7a4fa3}
.dp-map-loc.poi{border-color:#8a8f99;width:22px;height:22px;font-size:11px;opacity:.8}
.dp-map .leaflet-tooltip.dp-map-tip{background:var(--dp-surface,#fff);
  border:1px solid var(--dp-border-strong,#d3d9e4);border-radius:8px;
  box-shadow:var(--dp-shadow,0 1px 4px rgba(0,0,0,.15));font-size:11.5px;
  color:var(--dp-ink,#1a2233);padding:4px 8px;font-weight:500;white-space:nowrap}
.dp-map .leaflet-tooltip.dp-map-tip::before{display:none}
.dp-map .leaflet-tooltip.dp-map-loctip{font-weight:600}
.dp-map-dist{transform:translate(-50%,-50%);white-space:nowrap;background:var(--dp-surface,#fff);
  border:1.5px solid;border-radius:10px;padding:1px 7px;font-size:11px;font-weight:800;
  font-variant-numeric:tabular-nums;box-shadow:var(--dp-shadow,0 1px 4px rgba(0,0,0,.15))}
.dp-map-leg{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin:0 0 6px;
  font-size:10.5px;color:var(--dp-muted,#6b7688)}
.dp-map-lg{display:inline-flex;align-items:center;gap:4px}
.dp-map-lg i{font-style:normal;width:18px;height:18px;font-size:10px;border-width:1.5px}
.dp-map-lg i.garagem{width:19px;height:19px;font-size:11px}
.dp-map-lgc{opacity:.8;font-style:italic}
`;
