import { Component, memo, useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { Canvas, events, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, Vector3, type Intersection } from 'three';
import { OrbitControls as Controls } from 'three/addons/controls/OrbitControls.js';

import { coversSite, footprintShape, loadEnvironment, roadWidth, type EnvironmentObject, type EnvironmentSnapshot } from './environment';
import { siteFrame, type Sensor, type SensorBadge, type SiteBoundary, type SiteFrame } from './geography';
import { SceneEnvironment } from './SceneEnvironment';
import { SceneProbe } from './SceneProbe';

export type { Sensor, SiteBoundary } from './geography';

// Foreground Sensor markers own their ray hits even when a building is geometrically nearer.
// Filtering before R3F dispatch also prevents underlying environment hover/selection.
export function sensorIntersections(items: Intersection[]) {
  const sensors = items.filter((item) => item.object.userData.sensorTarget === true);
  return sensors.length ? sensors : items;
}

const sceneEvents: typeof events = (state) => ({ ...events(state), filter: sensorIntersections });

class SceneFallback extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p role="alert">3D view unavailable. Use the Virtual Sensor list below.</p> : this.props.children; }
}

export function SiteScene({ boundary, sensors, badges, onSensorSelect }: {
  boundary: SiteBoundary; sensors: Sensor[]; badges: SensorBadge[]; onSensorSelect: (id: string) => void;
}) {
  const frame = useMemo(() => siteFrame(boundary), [boundary]);
  const [snapshot, setSnapshot] = useState<EnvironmentSnapshot>();
  const [environmentError, setEnvironmentError] = useState('');
  const [selected, setSelected] = useState<EnvironmentObject>();
  const [reduced, setReduced] = useState(false);
  const [reset, setReset] = useState(0);
  const controls = useRef<Controls>(null);
  const gesture = useRef<{ pointerId: number; x: number; y: number; dragged: boolean; ended: boolean } | null>(null);
  const trackMovement = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (current?.pointerId === event.pointerId) {
      current.dragged ||= Math.hypot(event.clientX - current.x, event.clientY - current.y) > 2;
    }
  };
  const labels = useRef(new Map<string, HTMLDivElement>());
  const leaders = useRef(new Map<string, SVGLineElement>());
  const positions = useMemo(() => sensors.map((sensor) => frame.toGround([sensor.location.longitude, sensor.location.latitude])), [frame, sensors]);
  const benchmark = import.meta.env.DEV && new URLSearchParams(window.location.search).has('sceneBenchmark');
  const onEnvironmentSelect = useCallback((object: EnvironmentObject) => setSelected(object), []);
  useEffect(() => {
    const controller = new AbortController();
    setSnapshot(undefined); setSelected(undefined); setEnvironmentError('');
    loadEnvironment(controller.signal)
      .then((data) => {
        if (!coversSite(data, frame)) throw new Error('Geographic context is unavailable for this Site. Boundary, Sensors and observations remain available.');
        if (!controller.signal.aborted) setSnapshot(data);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setEnvironmentError(reason instanceof Error ? reason.message : 'Geographic environment unavailable.');
      });
    return () => controller.abort();
  }, [frame]);

  return <section aria-label="Site visualization" className={benchmark ? 'scene-benchmark' : undefined}>
    <div className="scene-toolbar">
      <button type="button" onClick={() => { setReset((value) => value + 1); setSelected(undefined); }}>Reset to Site</button>
      <label><input type="checkbox" checked={reduced} onChange={(event) => setReduced(event.target.checked)} />Reduced quality</label>
      <span>Drag: orbit · Right drag: pan · Scroll: zoom · North = −Z · Metres</span>
    </div>
    {environmentError && <p role="status">{environmentError}</p>}
    <div className="site-scene" aria-label="Site boundary and Virtual Sensors"
      onPointerDownCapture={(event) => { gesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, dragged: false, ended: false }; }}
      onPointerMoveCapture={trackMovement}
      onPointerUpCapture={(event) => {
        trackMovement(event);
        if (gesture.current?.pointerId === event.pointerId) gesture.current.ended = true;
      }}
      onPointerCancelCapture={(event) => { if (gesture.current?.pointerId === event.pointerId) gesture.current = null; }}
      onLostPointerCaptureCapture={(event) => {
        // OrbitControls releases capture after pointer-up, before the subsequent click.
        // Keep that completed result; an unexpected capture loss cancels an active gesture.
        if (gesture.current?.pointerId === event.pointerId && !gesture.current.ended) gesture.current = null;
      }}>
      <SceneFallback key={frame.origin.join('/')}>
        <Canvas events={sceneEvents} orthographic frameloop="demand" dpr={reduced ? 1 : [1, 1.5]} camera={{ near: 0.1, far: frame.radius * 20 }}
          fallback={<p role="alert">3D view unavailable. Use the Virtual Sensor list below.</p>}>
          <color attach="background" args={['#e6eee7']} />
          <ambientLight intensity={1.4} />
          <directionalLight position={[frame.radius, frame.radius * 2, frame.radius]} intensity={2.2} />
          <SiteCamera frame={frame} reset={reset} controls={controls} />
          <BoundaryGround frame={frame} />
          {snapshot && <SceneEnvironment snapshot={snapshot} frame={frame} selected={selected?.id}
            onSelect={onEnvironmentSelect} benchmark={benchmark} />}
          <SensorMarkers positions={positions} sensors={sensors} onSensorSelect={(id) => {
            const completed = gesture.current;
            gesture.current = null;
            if (completed?.ended && !completed.dragged) onSensorSelect(id);
          }} />
          <SensorLabelProjection positions={positions} sensors={sensors} labels={labels} leaders={leaders} />
          {import.meta.env.DEV && <SceneProbe frame={frame} controls={controls} benchmark={benchmark} reduced={reduced} />}
        </Canvas>
      </SceneFallback>
      <div className="sensor-overlay">
        <svg className="sensor-leaders" aria-hidden="true">
          {sensors.map((sensor) => <line key={sensor.id}
            ref={(element) => { if (element) leaders.current.set(sensor.id, element); else leaders.current.delete(sensor.id); }} />)}
        </svg>
        {sensors.map((sensor) => <div key={sensor.id} className="sensor-label" role="group" aria-label={`${sensor.name} map Sensor`}
          ref={(element) => { if (element) labels.current.set(sensor.id, element); else labels.current.delete(sensor.id); }}>
          <button type="button" onClick={() => onSensorSelect(sensor.id)}>{sensor.name}</button>
          {badges.filter((badge) => badge.sensorId === sensor.id).map((badge) => <button className="map-badge" key={badge.parameter}
            style={{ backgroundColor: badge.color }} onClick={() => onSensorSelect(sensor.id)}><span>{badge.text}</span></button>)}
        </div>)}
      </div>
    </div>
    <p className="scene-attribution">Flat ground · Buildings: stylized 18 m height · Road widths: approximate · Trees: illustrative.
      {snapshot && <> Layout: <a href="https://www.openstreetmap.org/copyright">{snapshot.attribution}</a> ({snapshot.license}),
        retrieved {snapshot.retrievedAt}. Coverage is incomplete.</>}</p>
    {selected && <aside className="environment-context" aria-label="Environment context">
      <h3>{selected.name}</h3>
      <button type="button" onClick={() => setSelected(undefined)}>Close environment details</button>
      {selected.type === 'tree' ? <p>Illustrative vegetation. Placement and dimensions are decorative, not sourced observations.</p>
        : <><p>Source-backed {selected.type === 'building' ? 'horizontal footprint and orientation' : 'main-road centerline'}: OpenStreetMap.</p>
          <p>{selected.type === 'building' ? 'Approximate/stylized height: 18 m. Real height: unavailable.'
            : `Approximate width: ${selectedRoadWidth(snapshot, selected.id)} m. Surveyed width: unavailable.`}</p></>}
      <p>Address, surveyed elevation and owner: unavailable.</p>
      {selected.type !== 'tree' && <p>Source feature: {selected.id} (frontend picking key).</p>}
    </aside>}
  </section>;
}

function selectedRoadWidth(snapshot: EnvironmentSnapshot | undefined, id: string) {
  const road = snapshot?.roads.find((row) => row.id === id);
  return road ? roadWidth(road) : 'unavailable';
}

function SiteCamera({ frame, reset, controls }: {
  frame: SiteFrame; reset: number; controls: React.RefObject<Controls | null>;
}) {
  const { camera, gl, size, invalidate } = useThree();
  useEffect(() => {
    const orbit = new Controls(camera, gl.domElement);
    orbit.enableDamping = false; orbit.minPolarAngle = Math.PI / 7; orbit.maxPolarAngle = Math.PI / 2.5;
    orbit.minZoom = 0.05; orbit.maxZoom = 8; orbit.screenSpacePanning = false;
    orbit.addEventListener('change', () => invalidate()); controls.current = orbit;
    return () => { orbit.dispose(); controls.current = null; };
  }, [camera, gl, invalidate, controls]);
  useEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    camera.position.set(frame.center[0] + frame.radius * 1.6, frame.radius * 2, frame.center[2] + frame.radius * 1.6);
    camera.lookAt(...frame.center); camera.zoom = 1; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const corners = frame.rings[0].map((point) => new Vector3(...point).project(camera));
    const spanX = (Math.max(...corners.map((p) => p.x)) - Math.min(...corners.map((p) => p.x))) * size.width / 2;
    const spanY = (Math.max(...corners.map((p) => p.y)) - Math.min(...corners.map((p) => p.y))) * size.height / 2;
    camera.zoom = Math.min(Math.max(size.width - 240, 100) / spanX, Math.max(size.height - 180, 100) / spanY);
    camera.updateProjectionMatrix();
    controls.current?.target.set(...frame.center); controls.current?.update(); invalidate();
  }, [frame, camera, size.width, size.height, reset, controls, invalidate]);
  return null;
}

const BoundaryGround = memo(function BoundaryGround({ frame }: { frame: SiteFrame }) {
  const shape = useMemo(() => footprintShape(frame.rings), [frame]);
  const ringBuffers = useMemo(() => frame.rings.map((ring) => new Float32Array(ring.flat())), [frame]);
  return <group name="Authoritative Site boundary">
    <mesh rotation={[-Math.PI / 2, 0, 0]} name="Site boundary">
      <shapeGeometry args={[shape]} /><meshStandardMaterial color="#b9cfb2" roughness={1} />
    </mesh>
    {ringBuffers.map((buffer, index) => <lineLoop key={index} name={index ? 'Site interior ring' : 'Site boundary outline'} position={[0, 0.5, 0]}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[buffer, 3]} /></bufferGeometry>
      <lineBasicMaterial color="#3c756c" />
    </lineLoop>)}
  </group>;
});

function SensorMarkers({ positions, sensors, onSensorSelect }: {
  positions: [number, number, number][]; sensors: Sensor[]; onSensorSelect: (id: string) => void;
}) {
  return <group name="Virtual Sensors">
    {sensors.map((sensor, index) => <group key={sensor.id} position={positions[index]} name={sensor.id}>
      <mesh position={[0, 5, 0]} userData={{ sensorTarget: true }} renderOrder={10}
        onPointerOver={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          if (event.button === 0) onSensorSelect(sensor.id);
        }}>
        <cylinderGeometry args={[3, 5, 10, 8]} /><meshStandardMaterial color="#224b64" depthTest={false} />
      </mesh>
    </group>)}
  </group>;
}

function SensorLabelProjection({ positions, sensors, labels, leaders }: {
  positions: [number, number, number][]; sensors: Sensor[]; labels: React.RefObject<Map<string, HTMLDivElement>>;
  leaders: React.RefObject<Map<string, SVGLineElement>>;
}) {
  const point = useMemo(() => new Vector3(), []);
  useFrame(({ camera, size }) => {
    camera.updateMatrixWorld();
    // Read all label dimensions before writing transforms; six labels need no layout service.
    const projected = sensors.flatMap((sensor, index) => {
      const label = labels.current.get(sensor.id), line = leaders.current.get(sensor.id);
      if (!label || !line) return [];
      point.set(positions[index][0], 5, positions[index][2]).project(camera);
      return [{ label, line, x: (point.x + 1) * size.width / 2, y: (1 - point.y) * size.height / 2,
        visible: Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1, width: label.offsetWidth, height: label.offsetHeight }];
    });
    const placed: { x: number; y: number; width: number; height: number }[] = [];
    for (const item of projected) {
      item.label.style.visibility = item.line.style.visibility = item.visible ? 'visible' : 'hidden';
      if (!item.visible) continue;
      const { x, y, width, height } = item;
      const desired = { x: x - width / 2, y: y - height - 12 };
      const candidates = [desired, { x: desired.x, y: y + 12 }, ...placed.flatMap((other) => [
        { x: other.x - width - 8, y: desired.y }, { x: other.x + other.width + 8, y: desired.y },
        { x: desired.x, y: other.y - height - 8 }, { x: desired.x, y: other.y + other.height + 8 },
      ])].map((candidate) => ({ x: Math.max(8, Math.min(candidate.x, size.width - width - 8)),
        y: Math.max(8, Math.min(candidate.y, size.height - height - 8)) }))
        .sort((a, b) => Math.hypot(a.x - desired.x, a.y - desired.y) - Math.hypot(b.x - desired.x, b.y - desired.y));
      const location = candidates.find((candidate) => placed.every((other) =>
        candidate.x + width + 6 <= other.x || candidate.x >= other.x + other.width + 6
        || candidate.y + height + 6 <= other.y || candidate.y >= other.y + other.height + 6)) ?? candidates[0];
      placed.push({ ...location, width, height });
      item.label.style.transform = `translate(${location.x}px, ${location.y}px)`;
      item.line.setAttribute('x1', String(x)); item.line.setAttribute('y1', String(y));
      item.line.setAttribute('x2', String(Math.max(location.x, Math.min(x, location.x + width))));
      item.line.setAttribute('y2', String(Math.max(location.y, Math.min(y, location.y + height))));
    }
  });
  return null;
}
