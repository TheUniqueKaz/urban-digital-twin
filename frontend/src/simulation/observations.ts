export type Parameter = 'PM25' | 'PM10' | 'NO2' | 'CO2';

// Fixed demo visualization bands, with a separate scale for each Parameter.
export const parameters = {
  PM25: { label: 'PM2.5', unit: 'µg/m³', thresholds: [15, 30] },
  PM10: { label: 'PM10', unit: 'µg/m³', thresholds: [30, 60] },
  NO2: { label: 'NO2', unit: 'µg/m³', thresholds: [20, 40] },
  CO2: { label: 'CO2', unit: 'ppm', thresholds: [450, 600] },
} satisfies Record<Parameter, { label: string; unit: string; thresholds: number[] }>;

export const bandColors = ['#155e75', '#6b4f00', '#7e2749'];

export type Measurement = {
  id: string;
  sensorId: string;
  simulationRunId: string;
  parameter: Parameter;
  value: number;
  unit: string;
  observedAt: string;
  recordedAt: string;
  provenance: 'SIMULATED';
};

export function observationColor(measurement: Measurement) {
  const [first, second] = parameters[measurement.parameter].thresholds;
  return bandColors[measurement.value < first ? 0 : measurement.value < second ? 1 : 2];
}

export function observationText(measurement: Measurement) {
  return `${parameters[measurement.parameter].label}: ${measurement.value} ${measurement.unit} · ${measurement.provenance}`;
}

export function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit' })
    .format(new Date(value));
}
