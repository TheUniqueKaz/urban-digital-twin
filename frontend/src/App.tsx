import { useEffect, useState } from 'react';

import { AuthBoundary, useAuth } from './auth/AuthBoundary';
import { CustomersPage, CustomerPage } from './customers/CustomersPage';
import { DigitalTwinPage } from './digital-twin/DigitalTwinPage';
import { navigate } from './shared/navigation';

function AuthenticatedApplication() {
  const { user, signOut } = useAuth();
  const [pathname, setPathname] = useState(window.location.pathname);

  useEffect(() => {
    const update = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  const twinRoute = pathname.match(/^\/customers\/([^/]+)\/digital-twins\/([^/]+)$/);
  const customerRoute = pathname.match(/^\/customers\/([^/]+)$/);

  return (
    <>
      <header>
        <strong>Urban Air Quality Digital Twin</strong>
        <span>Signed in as {user.email} · Role: {user.role}</span>
        <button type="button" onClick={signOut}>Sign out</button>
      </header>
      {twinRoute ? (
        <DigitalTwinPage customerId={twinRoute[1]} twinId={twinRoute[2]} navigate={navigate} />
      ) : customerRoute ? (
        <CustomerPage customerId={customerRoute[1]} navigate={navigate} />
      ) : (
        <CustomersPage navigate={navigate} />
      )}
    </>
  );
}

export default function App() {
  return (
    <AuthBoundary>
      <AuthenticatedApplication />
    </AuthBoundary>
  );
}
