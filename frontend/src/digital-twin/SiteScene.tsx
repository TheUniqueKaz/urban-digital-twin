import { useEffect, useRef } from 'react';
import { Cartesian2, Cartesian3, Color, EllipsoidTerrainProvider, Rectangle, ScreenSpaceEventType, Viewer } from 'cesium';
import type { ScreenSpaceEventHandler } from 'cesium';
import 'cesium/Build/Cesium/Widgets/widgets.css';

export type SiteBoundary = { type: 'Polygon'; coordinates: number[][][] };
export type Sensor = {
  id: string;
  digitalTwinId: string;
  code: string;
  name: string;
  kind: 'VIRTUAL';
  location: { longitude: number; latitude: number };
  capabilities: ('PM25' | 'PM10' | 'NO2' | 'CO2')[];
};

type SensorBadge = { sensorId: string; parameter: string; text: string; color: string };

export function SiteScene({ boundary, sensors, badges, onSensorSelect }: {
  boundary: SiteBoundary; sensors: Sensor[]; badges: SensorBadge[]; onSensorSelect: (id: string) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<Viewer | null>(null);

  useEffect(() => {
    if (!container.current) return;
    const viewer = new Viewer(container.current, {
      baseLayer: false,
      terrainProvider: new EllipsoidTerrainProvider(),
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      infoBox: false,
    });
    scene.current = viewer;
    const ring = boundary.coordinates[0];
    viewer.entities.add({
      name: 'Site boundary',
      polygon: {
        hierarchy: Cartesian3.fromDegreesArray(ring.flat()),
        material: Color.CYAN.withAlpha(0.2),
      },
    });
    viewer.entities.add({
      name: 'Site boundary outline',
      polyline: { positions: Cartesian3.fromDegreesArray(ring.flat()), width: 3, material: Color.CYAN },
    });
    for (const sensor of sensors) {
      viewer.entities.add({
        id: sensor.id,
        name: sensor.name,
        position: Cartesian3.fromDegrees(sensor.location.longitude, sensor.location.latitude),
        point: { pixelSize: 10, color: Color.YELLOW },
        label: {
          text: sensor.name,
          fillColor: Color.WHITE,
          font: '14px sans-serif',
          pixelOffset: new Cartesian2(0, -18),
          showBackground: true,
        },
      });
    }
    viewer.screenSpaceEventHandler.setInputAction((event: ScreenSpaceEventHandler.PositionedEvent) => {
      const entity = viewer.scene.pick(event.position)?.id;
      const sensorId = typeof entity?.id === 'string' ? entity.id.split('/')[0] : undefined;
      if (sensorId && sensors.some((sensor) => sensor.id === sensorId)) onSensorSelect(sensorId);
    }, ScreenSpaceEventType.LEFT_CLICK);
    const longitudes = ring.map(([longitude]) => longitude);
    const latitudes = ring.map(([, latitude]) => latitude);
    const west = Math.min(...longitudes);
    const east = Math.max(...longitudes);
    const south = Math.min(...latitudes);
    const north = Math.max(...latitudes);
    const longitudeMargin = (east - west) * 0.2;
    const latitudeMargin = (north - south) * 0.2;
    viewer.camera.setView({
      destination: Rectangle.fromDegrees(
        west - longitudeMargin, south - latitudeMargin,
        east + longitudeMargin, north + latitudeMargin,
      ),
    });
    return () => {
      scene.current = null;
      viewer.destroy();
    };
  }, [boundary, sensors, onSensorSelect]);

  useEffect(() => {
    const viewer = scene.current;
    if (!viewer) return;
    const ids: string[] = [];
    for (const sensor of sensors) {
      badges.filter((badge) => badge.sensorId === sensor.id).forEach((badge, index) => {
        const id = `${sensor.id}/${badge.parameter}`;
        ids.push(id);
        viewer.entities.add({
          id, name: sensor.name,
          position: Cartesian3.fromDegrees(sensor.location.longitude, sensor.location.latitude),
          label: {
            text: badge.text, font: '14px sans-serif', fillColor: Color.WHITE,
            showBackground: true, backgroundColor: Color.fromCssColorString(badge.color),
            pixelOffset: new Cartesian2(0, -46 - index * 28),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      });
    }
    return () => {
      if (!viewer.isDestroyed()) for (const id of ids) viewer.entities.removeById(id);
    };
  }, [boundary, sensors, badges, onSensorSelect]);

  return <div ref={container} className="site-scene" aria-label="Site boundary and Virtual Sensors" />;
}
