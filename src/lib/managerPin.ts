const MANAGER_PIN_KEY = "managerPin";
export const DEFAULT_MANAGER_PIN = "1234";

export function getManagerPin(): string {
  if (typeof window === "undefined") return DEFAULT_MANAGER_PIN;
  try {
    const stored = localStorage.getItem(MANAGER_PIN_KEY);
    return stored ?? DEFAULT_MANAGER_PIN;
  } catch {
    return DEFAULT_MANAGER_PIN;
  }
}

export function setManagerPin(pin: string) {
  localStorage.setItem(MANAGER_PIN_KEY, pin);
}

export function verifyManagerPin(pin: string): boolean {
  return pin === getManagerPin();
}
