// A FOTO QUE SOBREVIVE À MORTE DO APP.
//
// Quando o Android mata o INOVE com a câmera aberta, a foto não se perde: ao reabrir, o
// Capacitor entrega o resultado da câmera pelo evento `appRestoredResult`. Mas a tela que
// pediu a foto já não existe — o app reabriu do zero, na tela inicial.
//
// Por isso este ouvinte é registrado na ENTRADA do app (main.jsx), e não na página de
// pneus: ele precisa estar de pé antes de o evento chegar, e a página só monta quando o
// PCM navega até ela. O que ele faz é mínimo — guarda a foto no rascunho da auditoria, na
// posição que tinha sido anotada antes de abrir a câmera. A página pega de lá quando o PCM
// reabrir a auditoria.

import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { anexarFotoRestaurada } from "./pcmRascunhoAuditoria";

export const EVENTO_FOTO_RESTAURADA = "inove:foto-restaurada";

export function registrarRecuperacaoDaCamera() {
  if (!Capacitor.isNativePlatform()) return;
  CapacitorApp.addListener("appRestoredResult", async (evento) => {
    try {
      if (evento?.pluginId !== "Camera" || !evento?.success) return;
      const webPath = evento?.data?.webPath;
      if (!webPath) return;
      const blob = await (await fetch(webPath)).blob();
      const tipo = blob.type || "image/jpeg";
      const file = new File([blob], `auditoria_restaurada.${tipo.split("/")[1] || "jpg"}`, { type: tipo });
      if (await anexarFotoRestaurada(file)) {
        window.dispatchEvent(new CustomEvent(EVENTO_FOTO_RESTAURADA));
      }
    } catch (erro) {
      console.error("Nao foi possivel recuperar a foto apos o app reabrir:", erro);
    }
  });
}
