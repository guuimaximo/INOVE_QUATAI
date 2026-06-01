import { useContext, useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { AuthContext } from "../context/AuthContext";
import { supabase } from "../supabase";

// Escuta finalizacoes do bot de conferencia e dispara uma notificacao
// local com o resultado. Funciona tanto no APK (LocalNotifications)
// quanto no navegador (Notification API). Cada job so notifica uma vez.

function calcularAcuracidade(resultadoJson = {}) {
  const total = Number(
    resultadoJson.itens_total ?? resultadoJson.itens_atualizados ?? 0
  );
  const corretos = Number(resultadoJson.itens_corretos ?? 0);
  if (total > 0 && Number.isFinite(corretos)) {
    return `${Math.round((corretos / total) * 1000) / 10}%`;
  }
  if (resultadoJson.acuracidade != null) {
    return `${resultadoJson.acuracidade}%`;
  }
  return null;
}

function montarMensagem(job) {
  const r = job?.resultado_json || {};
  const acuracidade = calcularAcuracidade(r);
  if (acuracidade) return `Segue resultado: ${acuracidade}`;
  return `Segue resultado: ${r.itens_atualizados ?? "?"} atualizados, ${r.divergencias ?? "?"} divergencias.`;
}

async function disparar(job) {
  const titulo = "Contagem foi apurada";
  const corpo = montarMensagem(job);

  try {
    if (Capacitor?.isNativePlatform?.()) {
      const perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const req = await LocalNotifications.requestPermissions();
        if (req.display !== "granted") return;
      }
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Math.floor(Date.now() / 1000) + (Number(job?.id) || 0),
            title: titulo,
            body: corpo,
            schedule: { at: new Date(Date.now() + 500) },
            smallIcon: "ic_stat_icon_config_sample",
            channelId: "default",
          },
        ],
      });
      return;
    }
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      if (Notification.permission === "granted") {
        new Notification(titulo, { body: corpo });
      }
    }
  } catch (err) {
    console.warn("Falha ao notificar conclusao do bot:", err);
  }
}

export default function BotJobNotifier() {
  const auth = useContext(AuthContext);
  const user = auth?.user;
  const notificadosRef = useRef(new Set());

  useEffect(() => {
    if (!user) return undefined;

    // Pede permissao logo no mount (boa UX: nao espera o primeiro job)
    if (Capacitor?.isNativePlatform?.()) {
      LocalNotifications.checkPermissions()
        .then((perm) => {
          if (perm.display !== "granted") {
            return LocalNotifications.requestPermissions();
          }
          return null;
        })
        .catch(() => {});
    }

    const channel = supabase
      .channel(`bot-jobs-notifier-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "suprimentos_bot_jobs" },
        (payload) => {
          const novo = payload?.new;
          const antigo = payload?.old;
          if (!novo) return;
          if (novo.status !== "concluido") return;
          if (antigo?.status === "concluido") return;
          if (notificadosRef.current.has(novo.id)) return;
          notificadosRef.current.add(novo.id);
          void disparar(novo);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, user?.usuario_id]);

  return null;
}
