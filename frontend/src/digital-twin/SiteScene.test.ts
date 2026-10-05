import { describe, expect, it } from 'vitest';
import { Object3D, Vector3, type Intersection } from 'three';
import { sensorIntersections } from './SiteScene';

function hit(distance: number, sensor = false): Intersection {
  const object = new Object3D();
  if (sensor) object.userData.sensorTarget = true;
  return { distance, object, point: new Vector3() };
}

describe('foreground Sensor interaction priority', () => {
  it('gives a Sensor its pointer interaction even behind a nearer environment hit', () => {
    const building = hit(1), sensor = hit(20, true);
    expect(sensorIntersections([building, sensor])).toEqual([sensor]);
  });

  it('preserves normal environment picking order when no Sensor is intersected', () => {
    const environment = [hit(1), hit(3)];
    expect(sensorIntersections(environment)).toBe(environment);
    expect(sensorIntersections([])).toEqual([]);
  });

  it('retains native distance order among intersected Sensor targets', () => {
    const first = hit(2, true), second = hit(4, true);
    expect(sensorIntersections([hit(1), first, hit(3), second])).toEqual([first, second]);
  });
});
