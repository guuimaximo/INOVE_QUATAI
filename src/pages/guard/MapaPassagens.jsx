// MapaPassagens.jsx — o mapa das passagens de um cartão, numeradas pela ordem.
// Saiu de dentro da GuardFraudes (16/09/2026) porque a aba de Bloqueio usa o mesmo mapa.
import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

/* ───────────────────────────── mapa das passagens ────────────────────────── */

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

const COR_PASSAGEM = "#c53434"; // débito que girou a catraca
const COR_SEM_GIRO = "#9aa4b4"; // leu e não girou

const pinoNumerado = (rotulo, cor, foco) =>
  L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    html: `<div class="gd-pin${foco ? " foco" : ""}" style="background:${cor}">${esc(rotulo)}</div>`,
  });

/**
 * Mapa SIMPLES das passagens de um caso — de propósito.
 *
 * NÃO é o `MapaBatidas` do DP360: aquele desenha cercas de terminal/garagem e
 * uma régua pessoa↔ônibus, regras do PONTO que não têm nada a ver com fraude de
 * cartão. Aqui só interessa ONDE o bloco aconteceu.
 *
 * Como o BLOCO é, por definição, o mesmo endereço, os pontos costumam cair
 * praticamente em cima uns dos outros — por isso o `maxZoom` do enquadramento é
 * alto e o pino traz o número da ORDEM.
 */
export default function MapaPassagens({ pontos, foco, altura = 300 }) {
  const elRef = useRef(null);
  const dadosRef = useRef([]);
  const mapaRef = useRef(null);
  const marcadoresRef = useRef([]);
  dadosRef.current = pontos;

  // O efeito não pode depender do ARRAY (o pai recria a lista a cada render e o
  // Leaflet piscaria o mapa inteiro): depende da assinatura dos dados.
  const chave = useMemo(() => JSON.stringify(pontos), [pontos]);

  useEffect(() => {
    const el = elRef.current;
    const pts = dadosRef.current;
    if (!el || !pts.length) return undefined;

    el.innerHTML = "";
    const map = L.map(el, { zoomControl: true });
    map.setView([pts[0].lat, pts[0].lon], 17);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const bounds = [];
    marcadoresRef.current = pts.map((p) => {
      const cor = p.efetiva ? COR_PASSAGEM : COR_SEM_GIRO;
      const marcador = L.marker([p.lat, p.lon], { icon: pinoNumerado(p.rotulo, cor, false) })
        .addTo(map)
        .bindTooltip(
          [
            `<b>#${esc(p.rotulo)} · ${esc(p.hora || "—")}</b>`,
            p.efetiva ? "passagem (girou)" : "leitura sem giro",
            p.placa ? `Veículo ${esc(p.placa)}` : "",
            p.valor ? `Débito ${esc(p.valor)}` : "",
            p.local ? esc(p.local) : "",
          ]
            .filter(Boolean)
            .join("<br>"),
          { direction: "top", className: "gd-tip", offset: [0, -14] },
        );
      bounds.push([p.lat, p.lon]);
      return { marcador, ponto: p };
    });

    try {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18 });
    } catch {
      /* bounds degenerado (um ponto só): fica o setView acima */
    }

    // O painel nasce animando e o Leaflet mede o container errado — sem isto o
    // mapa aparece cortado ou cinza.
    const t = setTimeout(() => map.invalidateSize(), 120);
    let obs = null;
    if (typeof ResizeObserver !== "undefined") {
      obs = new ResizeObserver(() => map.invalidateSize());
      obs.observe(el);
    }
    mapaRef.current = map;

    return () => {
      clearTimeout(t);
      if (obs) obs.disconnect();
      marcadoresRef.current = [];
      mapaRef.current = null;
      // Sem o remove() o Leaflet marca o container e a reabertura monta um mapa
      // quebrado ("Map container is already initialized").
      map.remove();
    };
  }, [chave, altura]);

  // Foco em efeito SEPARADO: trocar a passagem selecionada não pode remontar o
  // mapa (perderia o zoom que a pessoa acabou de dar).
  useEffect(() => {
    const map = mapaRef.current;
    if (!map) return;
    marcadoresRef.current.forEach(({ marcador, ponto }) => {
      const ativo = ponto.id === foco;
      marcador.setIcon(pinoNumerado(ponto.rotulo, ponto.efetiva ? COR_PASSAGEM : COR_SEM_GIRO, ativo));
      if (ativo) {
        marcador.openTooltip();
        map.panTo([ponto.lat, ponto.lon], { animate: true });
      }
    });
  }, [foco, chave]);

  if (!pontos.length) {
    return (
      <div className="gd-map">
        <div className="gd-map-off" style={{ height: altura }}>
          Nenhuma passagem deste caso tem GPS — sem ping não há ponto para mostrar.
        </div>
      </div>
    );
  }

  return (
    <div className="gd-map">
      <div className="gd-map-leg">
        <span>o número do pino é a ordem da passagem no bloco</span>
        <span>· vermelho = girou a catraca · cinza = leu sem girar</span>
        <span>· o bloco é sempre o MESMO endereço, então os pinos ficam sobrepostos</span>
      </div>
      <div ref={elRef} className="gd-map-box" style={{ height: altura }} />
    </div>
  );
}
