import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthBoundary';
import type { Navigate } from '../shared/navigation';

type DigitalTwin = { id: string; siteId: string; name: string };

export function DigitalTwinPage({ customerId, twinId, navigate }: {
  customerId: string;
  twinId: string;
  navigate: Navigate;
}) {
  const { authenticatedFetch } = useAuth();
  const [digitalTwin, setDigitalTwin] = useState<DigitalTwin | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authenticatedFetch(`/api/customers/${customerId}/digital-twins/${twinId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Digital Twin data is unavailable.');
        setDigitalTwin(await response.json() as DigitalTwin);
      })
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Digital Twin data is unavailable.'));
  }, [authenticatedFetch, customerId, twinId]);

  return (
    <main>
      <a href={`/customers/${customerId}`} onClick={(event) => navigate(event, `/customers/${customerId}`)}>Customer</a>
      <h1>{digitalTwin?.name ?? 'Digital Twin'}</h1>
      {error && <p role="alert">{error}</p>}
      {digitalTwin && <p>Site: {digitalTwin.siteId}</p>}
    </main>
  );
}
