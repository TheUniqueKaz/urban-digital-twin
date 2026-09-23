import { createContext, FormEvent, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

import { createAuthClient, type User } from './client';

type AuthState = {
  user: User;
  authenticatedFetch: ReturnType<typeof createAuthClient>['authenticatedFetch'];
  signOut: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

function goTo(path: string) {
  window.history.replaceState(null, '', path);
}

export function AuthBoundary({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState('');
  const client = useMemo(() => createAuthClient({
    onUnauthorized: () => {
      setUser(null);
      goTo('/login');
    },
  }), []);
  const [checkingSession, setCheckingSession] = useState(client.hasSession());

  useEffect(() => {
    if (!client.hasSession()) {
      goTo('/login');
      return;
    }

    client.getCurrentUser()
      .then((currentUser) => setUser(currentUser))
      .catch(() => setError('Could not restore your session.'))
      .finally(() => setCheckingSession(false));
  }, [client]);

  async function signIn(email: string, password: string) {
    setError('');
    try {
      await client.login(email, password);
      const currentUser = await client.getCurrentUser();
      if (!currentUser) {
        return;
      }
      setUser(currentUser);
      goTo('/');
    } catch (loginError) {
      client.clearToken();
      setError(loginError instanceof Error ? loginError.message : 'Sign in failed.');
    }
  }

  function signOut() {
    client.clearToken();
    setUser(null);
    goTo('/login');
  }

  if (checkingSession) {
    return <main aria-live="polite">Checking session…</main>;
  }

  if (!user) {
    return <LoginForm error={error} onSubmit={signIn} />;
  }

  return (
    <AuthContext.Provider value={{ user, authenticatedFetch: client.authenticatedFetch, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside AuthBoundary.');
  }
  return auth;
}

function LoginForm({ error, onSubmit }: { error: string; onSubmit: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    await onSubmit(email, password);
    setSubmitting(false);
  }

  return (
    <main>
      <h1>Sign in</h1>
      <p>Use a seeded demo account to continue.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
