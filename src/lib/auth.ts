const AUTH_KEY = "isLoggedIn";
export const CART_COUNT_KEY = "posCartCount";

export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "true";
}

export function setLoggedIn(): void {
  localStorage.setItem(AUTH_KEY, "true");
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem(CART_COUNT_KEY);
}

export function getCartCount(): number {
  if (typeof window === "undefined") return 0;
  const count = localStorage.getItem(CART_COUNT_KEY);
  return count ? parseInt(count, 10) : 0;
}

export function setCartCount(count: number): void {
  localStorage.setItem(CART_COUNT_KEY, count.toString());
  window.dispatchEvent(new Event("cart-updated"));
}
