import { useEffect, useRef, useState } from 'react';

import { SiteScene } from '../digital-twin/SiteScene';
import type { Sensor, SiteBoundary } from '../digital-twin/geography';
import { bandColors, formatTime, observationColor, observationText, parameters, type Measurement, type Parameter } from './observations';

const parameterKeys = Object.keys(parameters) as Parameter[];

export function ObservationExplorer({ boundary, sensors, measurements, timeZone }: {
  boundary: SiteBoundary;
  sensors: Sensor[];
  measurements: Measurement[];
  timeZone?: string;
}) {
  const [selectedParameters, setSelectedParameters] = useState<Parameter[]>(['PM25']);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedSensorId, setSelectedSensorId] = useState<string | null>(null);
  const detail = useRef<HTMLElement>(null);
  useEffect(() => { detail.current?.focus(); }, [selectedSensorId]);
  const timestamps = [...new Set(measurements.map((measurement) => measurement.observedAt))]
    .sort((a, b) => Date.parse(a) - Date.parse(b));
  const timestamp = selectedTime && timestamps.includes(selectedTime) ? selectedTime : timestamps[0];
  const current = measurements.filter((measurement) => measurement.observedAt === timestamp);
  const available = current.filter((measurement) => sensors.some((sensor) =>
    sensor.id === measurement.sensorId && sensor.capabilities.includes(measurement.parameter)));
  const badges = sensors.flatMap((sensor) => parameterKeys.flatMap((parameter) => {
    const measurement = available.find((row) => row.sensorId === sensor.id && row.parameter === parameter);
    return selectedParameters.includes(parameter) && measurement
      ? [{ sensorId: sensor.id, parameter, text: observationText(measurement), color: observationColor(measurement) }]
      : [];
  }));
  const selectedSensor = sensors.find((sensor) => sensor.id === selectedSensorId);

  return <>
    {timeZone && timestamp && <section aria-label="Observation controls">
      <fieldset>
        <legend>Parameter badges</legend>
        {parameterKeys.map((parameter) => <label key={parameter}>
          <input type="checkbox" checked={selectedParameters.includes(parameter)} onChange={() =>
            setSelectedParameters((selected) => selected.includes(parameter)
              ? selected.filter((value) => value !== parameter) : [...selected, parameter])} />
          {parameters[parameter].label}
        </label>)}
      </fieldset>
      <label htmlFor="observation-time">Observation time ({timeZone})</label>
      <input id="observation-time" type="range" min={0} max={timestamps.length - 1} step={1}
        value={timestamps.indexOf(timestamp)} disabled={timestamps.length === 1}
        aria-valuetext={formatTime(timestamp, timeZone)} onChange={(event) => {
          const persisted = timestamps[Number(event.target.value)];
          if (persisted) setSelectedTime(persisted);
        }} />
      <div className="timeline-labels">
        <span>{formatTime(timestamps[0], timeZone)}</span>
        <output htmlFor="observation-time"><time dateTime={timestamp}>{formatTime(timestamp, timeZone)}</time></output>
        <span>{formatTime(timestamps[timestamps.length - 1], timeZone)}</span>
      </div>
      <p>Persisted observations only. Missing observations are unavailable.</p>
      <section aria-label="Demo visualization bands">
        <h2>Demo visualization bands</h2>
        {parameterKeys.filter((parameter) => selectedParameters.includes(parameter)).map((parameter) => {
          const { label, unit, thresholds: [first, second] } = parameters[parameter];
          return <section key={parameter} aria-label={`${label} demo legend`}>
            <h3>{label} ({unit})</h3>
            <ul className="demo-bands">
              {[`< ${first}`, `${first}–< ${second}`, `≥ ${second}`].map((band, index) =>
                <li key={band} style={{ backgroundColor: bandColors[index] }}>Band {index + 1}: {band} {unit}</li>)}
            </ul>
          </section>;
        })}
      </section>
    </section>}
    <SiteScene boundary={boundary} sensors={sensors} badges={badges} onSensorSelect={setSelectedSensorId} />
    <h2>Virtual Sensors</h2>
    <ul>{sensors.map((sensor) => <li key={sensor.id}>
      <button type="button" onClick={() => setSelectedSensorId(sensor.id)}>Inspect {sensor.name}</button>
      {' '}{sensor.name} ({sensor.code}) · {sensor.capabilities.join(', ')}
      <ul className="sensor-badges" aria-label={`${sensor.name} badges`}>
        {badges.filter((badge) => badge.sensorId === sensor.id).map((badge) =>
          <li key={badge.parameter} style={{ backgroundColor: badge.color }}>{badge.text}</li>)}
      </ul>
    </li>)}</ul>
    {selectedSensor && <section ref={detail} tabIndex={-1} role="dialog" aria-label={`${selectedSensor.name} observations`}>
      <h2>{selectedSensor.name} ({selectedSensor.code})</h2>
      <button type="button" onClick={() => setSelectedSensorId(null)}>Close Sensor details</button>
      {timestamp && timeZone && <p><time dateTime={timestamp}>{formatTime(timestamp, timeZone)}</time> ({timeZone})</p>}
      <ul>{parameterKeys.filter((parameter) => selectedSensor.capabilities.includes(parameter)).map((parameter) => {
        const measurement = available.find((row) => row.sensorId === selectedSensor.id && row.parameter === parameter);
        return <li key={parameter}>{measurement ? observationText(measurement)
          : `${parameters[parameter].label}: No observation at this timestamp.`}</li>;
      })}</ul>
    </section>}
  </>;
}
