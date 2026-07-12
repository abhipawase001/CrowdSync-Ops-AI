import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import type { GateTelemetry } from "@/lib/types";

/**
 * 3D Stadium with live crowd heatmap.
 * - Elliptical bowl of tiered seat rings, colored by nearest-gate density.
 * - Field with animated crowd-flow arcs pointing to each gate.
 * - Gate markers colored red/amber/green by current capacity.
 */

function capacityColor(pct: number): THREE.Color {
  // 0% green -> 60% amber -> 100% red
  const c = new THREE.Color();
  if (pct < 60) {
    const t = pct / 60;
    c.setRGB(0.1 + t * 0.9, 0.9, 0.4 - t * 0.2);
  } else {
    const t = Math.min(1, (pct - 60) / 40);
    c.setRGB(1, 0.7 - t * 0.7, 0.15);
  }
  return c;
}

const GATE_POSITIONS: Record<string, [number, number]> = {
  "Gate C": [0, -1],       // south (angle 270°)
  "Gate D": [1, 0],        // east
  "Gate E": [0, 1],        // north
  "Accessible Ramp A104": [-1, 0], // west
};

function gateAngle(gateId: string): number {
  const p = GATE_POSITIONS[gateId] ?? [1, 0];
  return Math.atan2(p[1], p[0]);
}

function StadiumBowl({ gates }: { gates: GateTelemetry[] }) {
  const rings = 6;
  const segments = 64;
  const rx = 6.2;
  const ry = 4.4;
  const tierH = 0.35;
  const tierDepth = 0.55;

  // Precompute per-segment heat by nearest gate influence.
  const heat = useMemo(() => {
    const arr = new Float32Array(segments);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      let weighted = 0;
      let wsum = 0;
      for (const g of gates) {
        const ga = gateAngle(g.gate_id);
        // circular distance
        let d = Math.abs(a - ga);
        if (d > Math.PI) d = Math.PI * 2 - d;
        const w = 1 / (0.15 + d * d);
        weighted += g.current_capacity_pct * w;
        wsum += w;
      }
      arr[i] = wsum > 0 ? weighted / wsum : 0;
    }
    return arr;
  }, [gates]);

  const tiers = [];
  for (let r = 0; r < rings; r++) {
    const scale = 1 + r * 0.09;
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      const x = Math.cos(a) * rx * scale;
      const z = Math.sin(a) * ry * scale;
      const y = r * tierH + 0.2;
      const color = capacityColor(heat[i]);
      tiers.push({ pos: [x, y, z] as [number, number, number], a, color });
    }
  }

  return (
    <group>
      {/* Field */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <ringGeometry args={[0, 5.6, 64]} />
        <meshStandardMaterial color="#0a3d1f" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <ringGeometry args={[5.55, 5.7, 64]} />
        <meshStandardMaterial color="#e2e8f0" />
      </mesh>

      {/* Seat tiers as instanced-ish boxes */}
      {tiers.map((t, idx) => (
        <mesh key={idx} position={t.pos} rotation={[0, -t.a, 0]}>
          <boxGeometry args={[0.55, tierH * 0.9, tierDepth]} />
          <meshStandardMaterial
            color={t.color}
            emissive={t.color}
            emissiveIntensity={0.35}
            roughness={0.55}
          />
        </mesh>
      ))}
    </group>
  );
}

function GateMarkers({ gates }: { gates: GateTelemetry[] }) {
  return (
    <group>
      {gates.map((g) => {
        const p = GATE_POSITIONS[g.gate_id] ?? [1, 0];
        const rx = 7.6;
        const ry = 5.6;
        const x = p[0] * rx;
        const z = p[1] * ry;
        const color = capacityColor(g.current_capacity_pct);
        return (
          <group key={g.gate_id} position={[x, 0, z]}>
            <PulseBeacon color={color} intensity={g.current_capacity_pct} />
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

function PulseBeacon({ color, intensity }: { color: THREE.Color; intensity: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const speed = 0.6 + intensity / 80;
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed;
    if (ref.current) {
      ref.current.position.y = 0.6 + Math.sin(t * 2) * 0.15;
    }
    if (ringRef.current) {
      const s = 1 + ((t * 0.8) % 1) * 1.8;
      ringRef.current.scale.set(s, s, s);
      const m = ringRef.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.7 * (1 - ((t * 0.8) % 1));
    }
  });
  return (
    <group>
      <mesh ref={ref}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
        />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <ringGeometry args={[0.4, 0.52, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

function CrowdFlow({ gates }: { gates: GateTelemetry[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const particles = useMemo(() => {
    const list: { gate: string; offset: number; radius: number }[] = [];
    gates.forEach((g) => {
      const count = Math.max(6, Math.round(g.inflow_rate_per_min / 12));
      for (let i = 0; i < count; i++) {
        list.push({
          gate: g.gate_id,
          offset: Math.random(),
          radius: 0.6 + Math.random() * 1.4,
        });
      }
    });
    return list;
  }, [gates]);

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    groupRef.current.children.forEach((child, i) => {
      const p = particles[i];
      if (!p) return;
      const gate = GATE_POSITIONS[p.gate] ?? [1, 0];
      const gx = gate[0] * 7;
      const gz = gate[1] * 5.2;
      const phase = (t * 0.35 + p.offset) % 1;
      // travel from center-ish to gate
      const sx = -gate[0] * p.radius;
      const sz = -gate[1] * p.radius;
      const x = sx + (gx - sx) * phase;
      const z = sz + (gz - sz) * phase;
      child.position.set(x, 0.15 + Math.sin(phase * Math.PI) * 0.4, z);
      const m = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
      m.opacity = Math.sin(phase * Math.PI) * 0.9;
    });
  });

  return (
    <group ref={groupRef}>
      {particles.map((p, i) => {
        const gates2 = gates.find((g) => g.gate_id === p.gate);
        const color = capacityColor(gates2?.current_capacity_pct ?? 30);
        return (
          <mesh key={i}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={0.6} />
          </mesh>
        );
      })}
    </group>
  );
}

function AutoRotate() {
  useFrame((state) => {
    const t = state.clock.elapsedTime * 0.12;
    state.camera.position.x = Math.sin(t) * 14;
    state.camera.position.z = Math.cos(t) * 14;
    state.camera.position.y = 8.5;
    state.camera.lookAt(0, 0.5, 0);
  });
  return null;
}

export function StadiumHeatmap({ gates }: { gates: GateTelemetry[] }) {
  const avg = Math.round(
    gates.reduce((s, g) => s + g.current_capacity_pct, 0) /
      Math.max(1, gates.length),
  );
  const hot = gates.filter((g) => g.current_capacity_pct >= 80).length;

  return (
    <div className="space-y-3">
      <div className="relative h-[360px] w-full overflow-hidden rounded-xl border border-cyan-500/25 bg-gradient-to-b from-[#02060f] to-[#050d1c]">
        <Canvas
          camera={{ position: [12, 9, 12], fov: 45 }}
          dpr={[1, 1.75]}
          aria-label="3D stadium crowd heatmap"
        >
          <color attach="background" args={["#02060f"]} />
          <fog attach="fog" args={["#02060f", 18, 40]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[8, 12, 6]} intensity={1.1} />
          <pointLight position={[0, 8, 0]} intensity={0.6} color="#22d3ee" />
          <Suspense fallback={null}>
            <StadiumBowl gates={gates} />
            <CrowdFlow gates={gates} />
            <GateMarkers gates={gates} />
          </Suspense>
          <AutoRotate />
          <OrbitControls
            enablePan={false}
            enableZoom
            minDistance={10}
            maxDistance={22}
            maxPolarAngle={Math.PI / 2.2}
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
