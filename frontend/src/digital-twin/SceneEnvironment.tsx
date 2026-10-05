import { memo, useEffect, useMemo, useRef, useState } from 'react';
import type { ThreeEvent } from '@react-three/fiber';
import { BufferGeometry, ConeGeometry, CylinderGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute,
  InstancedMesh, MeshStandardMaterial, Object3D } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { footprintShape, roadVertices, roadWidth, type EnvironmentObject, type EnvironmentSnapshot } from './environment';
import type { ScenePoint, SiteFrame } from './geography';

type Feature = EnvironmentObject & { geometry: BufferGeometry; lastFace: number; sector: number };

function sector([x, , z]: ScenePoint) { return (x >= 0 ? 1 : 0) + (z >= 0 ? 2 : 0); }

export const SceneEnvironment = memo(function SceneEnvironment({ snapshot, frame, selected, onSelect, benchmark }: {
  snapshot: EnvironmentSnapshot; frame: SiteFrame; selected: string | undefined;
  onSelect: (object: EnvironmentObject) => void; benchmark: boolean;
}) {
  const [hovered, setHovered] = useState<string>();
  const resources = useMemo(() => {
    const features: Feature[] = [];
    for (const building of snapshot.buildings) {
      const rings = building.coordinates.map((ring) => ring.map(frame.toGround));
      const geometry = new ExtrudeGeometry(footprintShape(rings), { depth: 18, bevelEnabled: false, steps: 1 });
      geometry.rotateX(-Math.PI / 2);
      features.push({ id: building.id, name: building.name ?? 'Unnamed building', type: 'building',
        geometry, lastFace: 0, sector: sector(rings[0][0]) });
    }
    for (const road of snapshot.roads) {
      const points = road.coordinates.map(frame.toGround);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(roadVertices(points, roadWidth(road)), 3));
      geometry.computeVertexNormals();
      features.push({ id: road.id, name: road.name ?? 'Unnamed main road', type: 'road',
        geometry, lastFace: 0, sector: sector(points[0]) });
    }
    const batches = [0, 1, 2, 3].flatMap((quadrant) => (['building', 'road'] as const).flatMap((type) => {
      const members = features.filter((feature) => feature.sector === quadrant && feature.type === type);
      if (!members.length) return [];
      let faceCount = 0;
      members.forEach((member) => {
        faceCount += member.geometry.getAttribute('position').count / 3;
        member.lastFace = faceCount;
      });
      return [{ type, quadrant, members, geometry: mergeGeometries(members.map((member) => member.geometry))! }];
    }));
    return { features, batches,
      buildingMaterial: new MeshStandardMaterial({ color: '#c4cbbd', roughness: 1 }),
      roadMaterial: new MeshStandardMaterial({ color: '#64757b', roughness: 1, side: DoubleSide }),
      highlightMaterial: new MeshStandardMaterial({ color: '#efbd63', roughness: 1, side: DoubleSide,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) };
  }, [snapshot, frame]);
  useEffect(() => () => {
    resources.features.forEach(({ geometry }) => geometry.dispose());
    resources.batches.forEach(({ geometry }) => geometry.dispose());
    resources.buildingMaterial.dispose(); resources.roadMaterial.dispose(); resources.highlightMaterial.dispose();
  }, [resources]);
  const highlight = resources.features.find(({ id }) => id === (hovered ?? selected));
  function pick(event: ThreeEvent<PointerEvent | MouseEvent>, members: Feature[]) {
    event.stopPropagation();
    // ponytail: linear lookup for 587 source features; binary search only if picking profiles justify it.
    return members.find(({ lastFace }) => (event.faceIndex ?? -1) < lastFace);
  }
  return <group name="Geographic environment">
    {resources.batches.map((batch) => <group key={`${batch.quadrant}/${batch.type}`} name={`Context sector ${batch.quadrant}`}>
      <mesh geometry={batch.geometry} material={batch.type === 'building' ? resources.buildingMaterial : resources.roadMaterial}
        onPointerMove={(event) => setHovered(pick(event, batch.members)?.id)}
        onPointerOut={() => setHovered(undefined)}
        onClick={(event) => { const feature = pick(event, batch.members); if (feature) onSelect(feature); }} />
    </group>)}
    {highlight && <mesh geometry={highlight.geometry} material={resources.highlightMaterial} raycast={() => {}} />}
    <Decorations frame={frame} count={benchmark ? 1000 : 24} selected={selected} onSelect={onSelect} />
  </group>;
});

function TreeInstances({ points, geometry, material, onSelect, selected }: {
  points: ScenePoint[]; geometry: ConeGeometry | CylinderGeometry; material: MeshStandardMaterial;
  onSelect: (object: EnvironmentObject) => void; selected: string | undefined;
}) {
  const mesh = useRef<InstancedMesh>(null);
  useEffect(() => {
    const transform = new Object3D();
    points.forEach((point, index) => {
      transform.position.set(...point); transform.updateMatrix();
      mesh.current!.setMatrixAt(index, transform.matrix);
    });
    mesh.current!.instanceMatrix.needsUpdate = true;
    mesh.current!.computeBoundingSphere();
  }, [points]);
  const [hover, setHover] = useState<number>();
  useEffect(() => {
    points.forEach(([, , z], index) => {
      // Shared material; per-instance color is the only highlight variation.
      const active = hover === index || selected === `tree/${points[index][0]}/${z}`;
      mesh.current!.setColorAt(index, material.color.clone().set(active ? '#efbd63' : material.color));
    });
    if (mesh.current!.instanceColor) mesh.current!.instanceColor.needsUpdate = true;
  }, [hover, selected, material, points]);
  return <instancedMesh ref={mesh} args={[geometry, material, points.length]}
    onPointerMove={(event) => { event.stopPropagation(); setHover(event.instanceId); }}
    onPointerOut={() => setHover(undefined)}
    onClick={(event) => {
      event.stopPropagation();
      if (event.instanceId === undefined) return;
      const [x, , z] = points[event.instanceId];
      onSelect({ id: `tree/${x}/${z}`, name: 'Illustrative tree', type: 'tree' });
    }} />;
}

function Decorations({ frame, count, selected, onSelect }: {
  frame: SiteFrame; count: number; selected: string | undefined; onSelect: (object: EnvironmentObject) => void;
}) {
  const assets = useMemo(() => ({
    trunk: new CylinderGeometry(0.7, 1, 7, 6).translate(0, 3.5, 0),
    canopy: new ConeGeometry(5, 13, 7).translate(0, 12, 0),
    bark: new MeshStandardMaterial({ color: '#8b735d', roughness: 1 }),
    leaf: new MeshStandardMaterial({ color: '#4c8775', roughness: 1 }),
  }), []);
  useEffect(() => () => Object.values(assets).forEach((asset) => asset.dispose()), [assets]);
  const groups = useMemo(() => {
    const points = Array.from({ length: count }, (_, index): ScenePoint => {
      const angle = index * 2.399963229728653;
      const distance = frame.radius * (count === 24 ? 0.83 : 0.8 * Math.sqrt((index + 1) / count));
      return [frame.center[0] + Math.cos(angle) * distance, 0, frame.center[2] + Math.sin(angle) * distance];
    });
    return [0, 1, 2, 3].map((quadrant) => points.filter((point) => sector(point) === quadrant));
  }, [frame, count]);
  return <group name="Illustrative vegetation">
    {groups.map((points, quadrant) => <group key={quadrant} name={`Vegetation sector ${quadrant}`}>
      <TreeInstances points={points} geometry={assets.trunk} material={assets.bark} onSelect={onSelect} selected={selected} />
      <TreeInstances points={points} geometry={assets.canopy} material={assets.leaf} onSelect={onSelect} selected={selected} />
    </group>)}
  </group>;
}
