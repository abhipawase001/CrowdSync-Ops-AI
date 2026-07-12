import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { GateTelemetry } from "@/lib/types";

/**
 * 3D Stadium with live crowd heatmap.
 * Performance-tuned:
 *  - Telemetry props are throttled so re-renders don't fire on every tick.
 *  - Seat tiers use a single InstancedMesh (1 draw call vs ~384).
 *  - Orbit drag debounces auto-rotate and pauses non-critical animation.
 *  - Mobile detection lowers dpr, segments, particle count, and frame rate.
 */

// ---------- shared perf helpers ----------

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 768px), (pointer: coarse)");
    const on = () => setMobile(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  return mobile;
}

/** Throttle a rapidly-changing prop to at most one update per `ms`. */
function useThrottled<T>(value: T, ms: number): T {
  const [held, setHeld] = useState(value);
  const last = useRef(0);
  const pending = useRef<number | null>(null);
  useEffect(() => {
    const now = performance.now();
    const elapsed = now - last.current;
    if (elapsed >= ms) {
      last.current = now;
      setHeld(value);
    } else {
      if (pending.current !== null) window.clearTimeout(pending.current);
      pending.current = window.setTimeout(() => {
        last.current = performance.now();
        setHeld(value);
        pending.current = null;
      }, ms - elapsed);
    }
    return () => {
      if (pending.current !== null) {
        window.clearTimeout(pending.current);
        pending.current = null;
      }
    };
  }, [value, ms]);
  return held;
}

/** Runs `cb(delta)` at most `targetFps` times per second inside a useFrame. */
function useThrottledFrame(cb: (delta: number) => void, targetFps: number, enabled = true) {
  const acc = useRef(0);
  const interval = 1 / targetFps;
  useFrame((_state, delta) => {
    if (!enabled) return;
    acc.current += delta;
    if (acc.current < interval) return;
    const d = acc.current;
    acc.current = 0;
    cb(d);
  });
}

function capacityColor(pct: number, target = new THREE.Color()): THREE.Color {
  if (pct < 60) {
    const t = pct / 60;
    target.setRGB(0.1 + t * 0.9, 0.9, 0.4 - t * 0.2);
  } else {
    const t = Math.min(1, (pct - 60) / 40);
    target.setRGB(1, 0.7 - t * 0.7, 0.15);
  }
  return target;
}

const GATE_POSITIONS: Record<string, [number, number]> = {
  "Gate C": [0, -1],
  "Gate D": [1, 0],
  "Gate E": [0, 1],
  "Accessible Ramp A104": [-1, 0],
};

function gateAngle(gateId: string): number {
  const p = GATE_POSITIONS[gateId] ?? [1, 0];
  return Math.atan2(p[1], p[0]);
}

// ---------- interaction context ----------
// A tiny ref-based "is user dragging" signal shared between OrbitControls
// and animation components. Avoids re-renders on every pointer event.
const dragRef = { current: false };
const lastInteractAt = { current: 0 };

// ---------- Stadium bowl (instanced) ----------

function StadiumBowl({ gates, isMobile }: { gates: GateTelemetry[]; isMobile: boolean }) {
  const rings = isMobile ? 4 : 6;
  const segments = isMobile ? 40 : 64;
  const rx = 6.2;
  const ry = 4.4;
  const tierH = 0.35;
  const tierDepth = 0.55;
  const count = rings * segments;

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  // Static per-instance transforms — computed once per size change.
  const transforms = useMemo(() => {
    const arr: { x: number; y: number; z: number; a: number; segIdx: number }[] = [];
    for (let r = 0; r < rings; r++) {
      const scale = 1 + r * 0.09;
      for (let i = 0; i < segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        arr.push({
          x: Math.cos(a) * rx * scale,
          z: Math.sin(a) * ry * scale,
          y: r * tierH + 0.2,
          a,
          segIdx: i,
        });
      }
    }
    return arr;
  }, [rings, segments]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let idx = 0; idx < transforms.length; idx++) {
      const t = transforms[idx];
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(0, -t.a, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(idx, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [transforms, dummy]);

  // Recolor instances when gates (throttled) change.
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const heat = new Float32Array(segments);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      let weighted = 0;
      let wsum = 0;
      for (const g of gates) {
        const ga = gateAngle(g.gate_id);
        let d = Math.abs(a - ga);
        if (d > Math.PI) d = Math.PI * 2 - d;
        const w = 1 / (0.15 + d * d);
        weighted += g.current_capacity_pct * w;
        wsum += w;
      }
      heat[i] = wsum > 0 ? weighted / wsum : 0;
    }
    for (let idx = 0; idx < transforms.length; idx++) {
      capacityColor(heat[transforms[idx].segIdx], tmpColor);
      mesh.setColorAt(idx, tmpColor);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [gates, segments, transforms, tmpColor]);

  return (
    <group>
      {/* Field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[0, 5.6, isMobile ? 40 : 64]} />
        <meshStandardMaterial color="#0a3d1f" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[5.55, 5.7, isMobile ? 40 : 64]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      {/* Instanced seat tiers — one draw call for the whole bowl. */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        castShadow={false}
        receiveShadow={false}
      >
        <boxGeometry args={[0.55, tierH * 0.9, tierDepth]} />
        <meshStandardMaterial
          vertexColors={false}
          emissiveIntensity={0.35}
          roughness={0.55}
          toneMapped
        />
      </instancedMesh>
    </group>
  );
}

// ---------- Gate markers ----------

function GateMarkers({ gates, isMobile }: { gates: GateTelemetry[]; isMobile: boolean }) {
  return (
    <group>
      {gates.map((g) => {
        const p = GATE_POSITIONS[g.gate_id] ?? [1, 0];
        const x = p[0] * 7.6;
        const z = p[1] * 5.6;
        const color = capacityColor(g.current_capacity_pct, new THREE.Color());
        return (
          <group key={g.gate_id} position={[x, 0, z]}>
            <PulseBeacon color={color} intensity={g.current_capacity_pct} isMobile={isMobile} />
            <Html
              center
              position={[0, 2.2, 0]}
              distanceFactor={12}
              occlude={false}
              zIndexRange={[10, 0]}
            >
              <div className="pointer-events-none whitespace-nowrap rounded border border-cyan-300/50 bg-[#050d1c]/90 px-1.5 py-0.5 font-mono text-[10px] font-bold text-cyan-50 shadow">
                {g.gate_id} · {g.current_capacity_pct}%
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}

function PulseBeacon({
  color,
  intensity,
  isMobile,
}: {
  color: THREE.Color;
  intensity: number;
  isMobile: boolean;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const speed = 0.6 + intensity / 80;
  const segs = isMobile ? 12 : 24;
  const ringSegs = isMobile ? 20 : 32;
  const fps = isMobile ? 30 : 60;

  useThrottledFrame(() => {
    const t = performance.now() * 0.001 * speed;
    if (ref.current) ref.current.position.y = 0.6 + Math.sin(t * 2) * 0.15;
    if (ringRef.current) {
      const s = 1 + ((t * 0.8) % 1) * 1.8;
      ringRef.current.scale.set(s, s, s);
      const m = ringRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.7 * (1 - ((t * 0.8) % 1));
    }
  }, fps);

  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[0.35, segs, segs]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.4, 0.52, ringSegs]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

// ---------- Crowd flow particles ----------

function CrowdFlow({ gates, isMobile }: { gates: GateTelemetry[]; isMobile: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    const list: { gate: string; offset: number; radius: number }[] = [];
    const divisor = isMobile ? 24 : 12;
    const minCount = isMobile ? 3 : 6;
    gates.forEach((g) => {
      const count = Math.max(minCount, Math.round(g.inflow_rate_per_min / divisor));
      for (let i = 0; i < count; i++) {
        list.push({
          gate: g.gate_id,
          offset: Math.random(),
          radius: 0.6 + Math.random() * 1.4,
        });
      }
    });
    return list;
  }, [gates, isMobile]);

  const fps = isMobile ? 24 : 45;
  useThrottledFrame(() => {
    if (!groupRef.current) return;
    // Pause flow updates while user is actively dragging orbit.
    if (dragRef.current) return;
    const t = performance.now() * 0.001;
    const children = groupRef.current.children;
    for (let i = 0; i < children.length; i++) {
      const p = particles[i];
      if (!p) continue;
      const gate = GATE_POSITIONS[p.gate] ?? [1, 0];
      const gx = gate[0] * 7;
      const gz = gate[1] * 5.2;
      const phase = (t * 0.35 + p.offset) % 1;
      const sx = -gate[0] * p.radius;
      const sz = -gate[1] * p.radius;
      const child = children[i];
      child.position.set(
        sx + (gx - sx) * phase,
        0.15 + Math.sin(phase * Math.PI) * 0.4,
        sz + (gz - sz) * phase,
      );
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = Math.sin(phase * Math.PI) * 0.9;
    }
  }, fps);

  const segs = isMobile ? 6 : 8;
  return (
    <group ref={groupRef}>
      {particles.map((p, i) => {
        const gate = gates.find((g) => g.gate_id === p.gate);
        const color = capacityColor(gate?.current_capacity_pct ?? 30, new THREE.Color());
        return (
          <mesh key={i}>
            <sphereGeometry args={[0.08, segs, segs]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

// ---------- Auto-rotate (pauses during drag) ----------

function AutoRotate({ enabled }: { enabled: boolean }) {
  const angle = useRef(0);
  useFrame((state, delta) => {
    // Skip camera manipulation while the user is orbiting, and for a short
    // debounce window after they release, so their view isn't yanked away.
    const idleFor = performance.now() - lastInteractAt.current;
    if (!enabled || dragRef.current || idleFor < 1500) return;
    angle.current += delta * 0.12;
    const t = angle.current;
    state.camera.position.x = Math.sin(t) * 14;
    state.camera.position.z = Math.cos(t) * 14;
    state.camera.position.y = 8.5;
    state.camera.lookAt(0, 0.5, 0);
  });
  return null;
}

// ---------- Root ----------

export function StadiumHeatmap({ gates }: { gates: GateTelemetry[] }) {
  const isMobile = useIsMobile();
  // Throttle telemetry-driven prop churn: bowl re-color + particle re-seed
  // now happen at most every 750ms (1.5s on mobile) instead of every tick.
  const throttleMs = isMobile ? 1500 : 750;
  const throttledGates = useThrottled(gates, throttleMs);

  const avg = Math.round(
    gates.reduce((s, g) => s + g.current_capacity_pct, 0) / Math.max(1, gates.length),
  );
  const hot = gates.filter((g) => g.current_capacity_pct >= 80).length;

  const dpr: [number, number] = isMobile ? [1, 1.25] : [1, 1.75];
  const heightClass = isMobile ? "h-[280px]" : "h-[360px]";

  const onStart = () => {
    dragRef.current = true;
    lastInteractAt.current = performance.now();
  };
  const onEnd = () => {
    dragRef.current = false;
    lastInteractAt.current = performance.now();
  };

  return (
    <div className="space-y-3">
      <div
        className={`relative ${heightClass} w-full overflow-hidden rounded-xl border border-cyan-500/25 bg-gradient-to-b from-[#02060f] to-[#050d1c]`}
      >
        <Canvas
          camera={{ position: [12, 9, 12], fov: 45 }}
          dpr={dpr}
          gl={{ antialias: !isMobile, powerPreference: "high-performance" }}
          performance={{ min: 0.5 }}
          aria-label="3D stadium crowd heatmap"
        >
          <color attach="background" args={["#02060f"]} />
          <fog attach="fog" args={["#02060f", 18, 40]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[8, 12, 6]} intensity={1.1} />
          <pointLight position={[0, 8, 0]} intensity={0.6} color="#22d3ee" />
          <Suspense fallback={null}>
            <StadiumBowl gates={throttledGates} isMobile={isMobile} />
            <CrowdFlow gates={throttledGates} isMobile={isMobile} />
            <GateMarkers gates={throttledGates} isMobile={isMobile} />
          </Suspense>
          <AutoRotate enabled={!isMobile} />
          <OrbitControls
            enablePan={false}
            enableZoom
            enableDamping
            dampingFactor={0.12}
            minDistance={10}
            maxDistance={22}
            maxPolarAngle={Math.PI / 2.2}
            onStart={onStart}
            onEnd={onEnd}
          />
        </Canvas>
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border border-cyan-500/30 bg-[#050d1c]/80 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-cyan-100">
          Live Bowl · Avg {avg}% · {hot} hot gate{hot === 1 ? "" : "s"}
        </div>
        <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-2 rounded-md border border-cyan-500/30 bg-[#050d1c]/80 px-2.5 py-1.5 text-[10px] text-cyan-50">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Low
          <span className="inline-block h-2 w-2 rounded-full bg-amber-300" />
          Mid
          <span className="inline-block h-2 w-2 rounded-full bg-red-500" />
          High
          <span className="ml-2 text-cyan-200">Drag to orbit</span>
        </div>
      </div>
    </div>
  );
}
