import { useEffect, useState } from 'react';

import { useAuth } from '../auth/AuthBoundary';
import type { Sensor, SiteBoundary } from '../digital-twin/geography';
import { ObservationExplorer } from './ObservationExplorer';
import { formatTime, type Measurement } from './observations';

type SimulationRun = {
  id: string;
  seed: number;
  configuration: string;
  timeZone: string;
  startAt: string;
  endAt: string;
  intervalMinutes: number;
  createdAt: string;
};

export function SimulationPanel({ customerId, twinId, boundary, sensors }: {
  customerId: string; twinId: string; boundary: SiteBoundary; sensors: Sensor[];
}) {
  const { authenticatedFetch, user } = useAuth();
  const [run, setRun] = useState<SimulationRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [dataset, setDataset] = useState<{ runId: string; measurements: Measurement[] } | null>(null);
  const [measurementError, setMeasurementError] = useState('');
  const runsUrl = `/api/customers/${customerId}/digital-twins/${twinId}/simulation-runs`;

  useEffect(() => {
    let active = true;
    setRun(null);
    setLoaded(false);
    setError('');
    authenticatedFetch(`${runsUrl}/latest`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Simulation data is unavailable.');
        const latestRun = response.status === 204 ? null : await response.json() as SimulationRun;
        if (active) {
          setRun(latestRun);
          setLoaded(true);
        }
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Simulation data is unavailable.');
      });
    return () => { active = false; };
  }, [authenticatedFetch, runsUrl]);

  useEffect(() => {
    let active = true;
    setDataset(null);
    setMeasurementError('');
    if (run) {
      authenticatedFetch(`${runsUrl}/${run.id}/measurements`)
        .then(async (response) => {
          if (!response.ok) throw new Error('Simulation observations are unavailable.');
          const measurements = await response.json() as Measurement[];
          if (active) setDataset({ runId: run.id, measurements: measurements.filter((row) =>
            row.simulationRunId === run.id && row.provenance === 'SIMULATED') });
        })
        .catch((reason: unknown) => {
          if (active) setMeasurementError(reason instanceof Error ? reason.message : 'Simulation observations are unavailable.');
        });
    }
    return () => { active = false; };
  }, [authenticatedFetch, runsUrl, run]);

  async function generate() {
    setGenerating(true);
    setError('');
    try {
      const response = await authenticatedFetch(runsUrl, { method: 'POST' });
      if (!response.ok) throw new Error('Simulation generation failed.');
      setRun(await response.json() as SimulationRun);
      setLoaded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Simulation generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  return <>
    {error && <p role="alert">{error}</p>}
    {run ? <section aria-label="Latest Simulation Run">
      <h2>Latest Simulation Run</h2>
      <p>Non-scientific SIMULATED demo data generated at {run.createdAt}.</p>
      <p>Run ID: {run.id}</p>
      <p>Seed: {run.seed} · Configuration: {run.configuration}</p>
      <p>Scenario: {formatTime(run.startAt, run.timeZone)} to {formatTime(run.endAt, run.timeZone)}
        {' · '}{run.intervalMinutes}-minute intervals ({run.timeZone})</p>
    </section> : loaded && <p>No simulation data is available.</p>}
    {user.role === 'ADMIN' && <button type="button" disabled={generating} onClick={() => void generate()}>
      {generating ? 'Generating…' : 'Generate Simulation'}
    </button>}
    {measurementError && <p role="alert">{measurementError}</p>}
    {run && !dataset && !measurementError && <p role="status">Loading Simulation Run observations…</p>}
    {run && dataset?.runId === run.id && dataset.measurements.length === 0 && <p>No observations are available for this Simulation Run.</p>}
    <ObservationExplorer boundary={boundary} sensors={sensors} timeZone={run?.timeZone}
      measurements={dataset?.runId === run?.id ? dataset?.measurements ?? [] : []} />
  </>;
}
