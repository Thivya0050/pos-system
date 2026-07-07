export type AppSettings = {
  pointsPerRmSilver: number;
  pointsPerRmGold: number;
  pointsPerRmPlatinum: number;
  goldMinSpend: number;
  platinumMinSpend: number;
  taxRate: number;
  pharmacyName: string;
  pharmacyAddress: string;
  pharmacyPhone: string;
};

const SETTINGS_KEY = "pharmapos_settings";

export const defaultSettings: AppSettings = {
  pointsPerRmSilver: 1,
  pointsPerRmGold: 2,
  pointsPerRmPlatinum: 3,
  goldMinSpend: 1000,
  platinumMinSpend: 5000,
  taxRate: 6,
  pharmacyName: "PharmaPOS Pharmacy",
  pharmacyAddress: "123 Health Street, Kuala Lumpur",
  pharmacyPhone: "+60 3-1234 5678",
};

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
