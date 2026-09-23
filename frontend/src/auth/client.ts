export type User = {
  id: string;
  email: string;
  role: 'ADMIN' | 'CUSTOMER';
};

type AuthClientOptions = {
  onUnauthorized: () => void;
};

const TOKEN_KEY = 'digital-twin-access-token';

export function createAuthClient({ onUnauthorized }: AuthClientOptions) {
  function clearToken() {
    window.localStorage.removeItem(TOKEN_KEY);
  }

  async function authenticatedFetch(input: RequestInfo | URL, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const token = window.localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(input, { ...init, headers });
    if (response.status === 401) {
      clearToken();
      onUnauthorized();
    }
    return response;
  }

  return {
    hasSession: () => Boolean(window.localStorage.getItem(TOKEN_KEY)),
    clearToken,

    async login(email: string, password: string) {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Invalid email or password.');
      }

      const { accessToken } = (await response.json()) as { accessToken: string };
      window.localStorage.setItem(TOKEN_KEY, accessToken);
    },

    authenticatedFetch,

    async getCurrentUser(): Promise<User | null> {
      const response = await authenticatedFetch('/api/me');
      if (response.status === 401) {
        return null;
      }
      if (!response.ok) {
        throw new Error('Could not load the signed-in user.');
      }
      return response.json() as Promise<User>;
    },
  };
}
