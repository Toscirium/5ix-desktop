import { loadJSON } from "./storage";
import { DEFAULT_SETTINGS, SETTINGS_KEY } from "./settings";

let permissionChecked = false;
let permissionGranted = false;

async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return permissionGranted;
  const { isPermissionGranted, requestPermission } = await import("@tauri-apps/plugin-notification");
  permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const result = await requestPermission();
    permissionGranted = result === "granted";
  }
  permissionChecked = true;
  return permissionGranted;
}

export async function notify(title: string, body?: string): Promise<void> {
  try {
    if (!loadJSON(SETTINGS_KEY, DEFAULT_SETTINGS).notificationsEnabled) return;
    const granted = await ensurePermission();
    if (!granted) return;
    const { sendNotification } = await import("@tauri-apps/plugin-notification");
    sendNotification({ title, body });
  } catch {
    // Notifications are a nice-to-have — never let a failure here affect the app.
  }
}
