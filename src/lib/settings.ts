import type { Settings } from "../types";

export const SETTINGS_KEY = "5ix-settings";

export const DEFAULT_SETTINGS: Settings = {
  defaultQuantity: 100,
  largeNotionalThreshold: 25000,
  largeQuantityThreshold: 10000,
  notificationsEnabled: true,
};
