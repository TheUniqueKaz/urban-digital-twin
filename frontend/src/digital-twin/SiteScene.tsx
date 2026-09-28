import { useEffect, useRef } from 'react';
import { Cartesian2, Cartesian3, Color, EllipsoidTerrainProvider, Rectangle, Viewer } from 'cesium';
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

export function SiteScene({ boundary, sensors }: { boundary: SiteBoundary; sensors: Sensor[] }) {
  const container = useRef<HTMLDivElement>(null);

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
    });
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
    return () => viewer.destroy();
  }, [boundary, sensors]);

  return <div ref={container} className="site-scene" aria-label="Site boundary and Virtual Sensors" />;
}
