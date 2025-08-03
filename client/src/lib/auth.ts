export interface User {
  id: string;
  username: string;
  email: string;
  plan: string;
  role?: string;
}

export function getUser(): User | null {
  const token = localStorage.getItem("token");
  const userData = localStorage.getItem("user");
  
  if (!token || !userData) {
    return null;
  }
  
  try {
    return JSON.parse(userData);
  } catch {
    return null;
  }
}

export function setAuth(user: User, token: string) {
  localStorage.setItem("user", JSON.stringify(user));
  localStorage.setItem("token", token);
}

export function logout() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
}

export function clearAuth() {
  localStorage.removeItem("user");
  localStorage.removeItem("token");
}

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function getAuthToken(): string | null {
  return localStorage.getItem("token");
}

export function getAuthHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}