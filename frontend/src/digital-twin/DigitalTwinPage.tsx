import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthBoundary';
import type { Navigate } from '../shared/navigation';
import { SiteScene, type Sensor, type SiteBoundary } from './SiteScene';

type DigitalTwin = { id: string; siteId: string; name: string; boundary: SiteBoundary };

export function DigitalTwinPage({ customerId, twinId, navigate }: {
  customerId: string;
  twinId: string;
  navigate: Navigate;
}) {
  const { authenticatedFetch, user } = useAuth();
  const [digitalTwin, setDigitalTwin] = useState<DigitalTwin | null>(null);
  const [sensors, setSensors] = useState<Sensor[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setDigitalTwin(null);
    setSensors([]);
    setError('');
    const url = `/api/customers/${customerId}/digital-twins/${twinId}`;
    authenticatedFetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error('Digital Twin data is unavailable.');
        const twin = await response.json() as DigitalTwin;
        if (!active) return;
        const sensorsResponse = await authenticatedFetch(`${url}/sensors`);
        if (!sensorsResponse.ok) throw new Error('Digital Twin data is unavailable.');
        const loadedSensors = await sensorsResponse.json() as Sensor[];
        if (!active) return;
        setSensors(loadedSensors);
        setDigitalTwin(twin);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Digital Twin data is unavailable.');
      });
    return () => { active = false; };
  }, [authenticatedFetch, customerId, twinId]);

  return (
    <main>
      <a href={`/customers/${customerId}`} onClick={(event) => navigate(event, `/customers/${customerId}`)}>Customer</a>
      <h1>{digitalTwin?.name ?? 'Digital Twin'}</h1>
      {error && <p role="alert">{error}</p>}
      {digitalTwin && <>
        <p>Site: {digitalTwin.siteId}</p>
        <SiteScene boundary={digitalTwin.boundary} sensors={sensors} />
        <h2>Virtual Sensors</h2>
        <ul>{sensors.map((sensor) => <li key={sensor.id}>
          {sensor.name} ({sensor.code}) · {sensor.capabilities.join(', ')}
        </li>)}</ul>
        <p>No simulation data is available.</p>
        {user.role === 'ADMIN' && <button type="button" disabled title="Simulation generation is not available yet">Generate Simulation</button>}
      </>}
    </main>
  );
}
