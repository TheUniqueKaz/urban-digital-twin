// Development-only browser verification/benchmark. Never mounted in production.
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, Vector3 } from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { SiteFrame } from './geography';

export function SceneProbe({ frame, controls, benchmark, reduced }: {
  frame: SiteFrame; controls: React.RefObject<OrbitControls | null>; benchmark: boolean; reduced: boolean;
}) {
  const state = useThree();
  const frames = useRef(0);
  const run = useRef<{ start: number; previous: number; times: number[]; zoom: number; finish: (result: unknown) => void } | null>(null);
  useEffect(() => {
    const probe = {
      state, frame, controls,
      get renderedFrames() { return frames.current; },
      runBenchmark: () => {
        if (!benchmark || run.current) throw new Error('Open ?sceneBenchmark=1 and run one benchmark at a time.');
        return new Promise((finish) => {
          run.current = { start: performance.now(), previous: 0, times: [], zoom: state.camera.zoom, finish };
          state.invalidate();
        });
      },
    };
    Object.assign(window, { siteSceneProbe: probe });
    return () => {
      delete (window as unknown as Record<string, unknown>).siteSceneProbe;
      run.current?.finish({ cancelled: true }); run.current = null;
    };
  }, [state, frame, controls, benchmark, reduced]);
  useFrame(() => {
    frames.current++;
    const current = run.current;
    if (!current) return;
    const now = performance.now();
    const elapsed = (now - current.start) / 1000;
    // Four seconds shader/asset warmup, then the identical 60-second path.
    if (elapsed >= 4 && current.previous) current.times.push(now - current.previous);
    current.previous = now;
    const t = Math.max(0, elapsed - 4);
    const orbit = Math.PI / 4 + Math.sin(t * Math.PI / 15) * 0.6;
    const polar = 0.8 + Math.sin(t * Math.PI / 20) * 0.15;
    const distance = frame.radius * 3;
    const target = new Vector3(frame.center[0] + Math.sin(t * Math.PI / 12) * frame.radius * 0.1, 0,
      frame.center[2] + Math.cos(t * Math.PI / 12) * frame.radius * 0.1);
    controls.current?.target.copy(target);
    state.camera.position.set(target.x + distance * Math.sin(polar) * Math.sin(orbit), distance * Math.cos(polar),
      target.z + distance * Math.sin(polar) * Math.cos(orbit));
    if (state.camera instanceof OrthographicCamera) state.camera.zoom = current.zoom * (1 + Math.sin(t * Math.PI / 10) * 0.15);
    state.camera.updateProjectionMatrix(); controls.current?.update();
    if (elapsed < 64) { state.invalidate(); return; }
    let dipFrames = 0, dipMs = 0, longestDipFrames = 0, longestDipMs = 0, sampleMs = 0;
    const seconds = Array.from({ length: 60 }, () => 0);
    for (const milliseconds of current.times) {
      sampleMs += milliseconds;
      const second = Math.floor(sampleMs / 1000);
      if (second < seconds.length) seconds[second]++;
      if (milliseconds > 1000 / 30) { dipFrames++; dipMs += milliseconds; }
      else { dipFrames = 0; dipMs = 0; }
      longestDipFrames = Math.max(longestDipFrames, dipFrames);
      longestDipMs = Math.max(longestDipMs, dipMs);
    }
    const sorted = [...current.times].sort((a, b) => a - b);
    current.finish({ quality: reduced ? 'reduced' : 'normal', durationSeconds: t,
      frames: sorted.length, medianFps: 1000 / sorted[Math.floor(sorted.length / 2)],
      p95FrameMs: sorted[Math.floor(sorted.length * 0.95)],
      stallsOver50Ms: sorted.filter((ms) => ms > 50).length,
      stallsOver100Ms: sorted.filter((ms) => ms > 100).length, worstFrameMs: sorted.at(-1),
      below30FpsFrames: sorted.filter((ms) => ms > 1000 / 30).length,
      longestDipFrames, longestDipMs,
      minOneSecondFps: Math.min(...seconds),
      drawCalls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles,
      geometries: state.gl.info.memory.geometries, textures: state.gl.info.memory.textures,
      pixelRatio: state.gl.getPixelRatio(), viewport: [state.size.width, state.size.height] });
    run.current = null;
  });
  return null;
}
