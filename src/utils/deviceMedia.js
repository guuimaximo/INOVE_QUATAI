import { Capacitor } from "@capacitor/core";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

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
    resultType: CameraResultType.Base64,
    quality,
    promptLabelHeader,
    promptLabelPhoto: "Galeria",
    promptLabelPicture: "Camera",
  });

  if (!photo?.base64String) return null;

  const extension = photo.format || "jpg";
  const mimeType = photo.format ? `image/${photo.format}` : "image/jpeg";
  const bytes = base64ToUint8Array(photo.base64String);

  return new File([bytes], `${fileNamePrefix}.${extension}`, { type: mimeType });
}
