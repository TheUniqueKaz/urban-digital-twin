import { AuthBoundary, useAuth } from './auth/AuthBoundary';

function AuthenticatedApplication() {
  const { user, signOut } = useAuth();

  return (
    <main>
      <h1>Urban Air Quality Digital Twin</h1>
      <p>Signed in as {user.email}</p>
      <p>Role: {user.role}</p>
      <button type="button" onClick={signOut}>Sign out</button>
    </main>
  );
}

export default function App() {
  return (
    <AuthBoundary>
      <AuthenticatedApplication />
    </AuthBoundary>
  );
}
