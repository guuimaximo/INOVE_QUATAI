import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

export function isNativeCameraAvailable() {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export async function captureNativePhotoFile({
  fileNamePrefix = "foto",
  promptLabelHeader = "Foto",
  quality = 80,
} = {}) {
  const permissions = await Camera.checkPermissions();
  const hasCameraPermission =
    permissions.camera === "granted" || permissions.camera === "limited";

  if (!hasCameraPermission) {
    const requested = await Camera.requestPermissions({ permissions: ["camera"] });
    const granted =
      requested.camera === "granted" || requested.camera === "limited";

    if (!granted) {
      throw new Error("Permissao da camera negada.");
    }
  }

  const photo = await Camera.getPhoto({
    source: CameraSource.Camera,
    // URI em vez de Base64: a foto NAO e carregada inteira na memoria do WebView
    // (base64 de foto em alta resolucao estoura a memoria e derruba o app).
    resultType: CameraResultType.Uri,
    quality,
    width: 1600,
    correctOrientation: true,
    promptLabelHeader,
    promptLabelPhoto: "Galeria",
    promptLabelPicture: "Camera",
  });

  const src = photo?.webPath || photo?.path;
  if (!src) return null;

  const response = await fetch(src);
  const blob = await response.blob();
  const extension = photo.format || (blob.type.split("/")[1] || "jpg");
  const mimeType = blob.type || (photo.format ? `image/${photo.format}` : "image/jpeg");

  return new File([blob], `${fileNamePrefix}.${extension}`, { type: mimeType });
}
