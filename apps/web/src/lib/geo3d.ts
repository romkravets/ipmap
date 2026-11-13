import * as THREE from "three";

// Широта/довгота → точка на сфері радіуса r
export function latLngToVec3(lat: number, lng: number, r = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

// Дуга великого кола між двома точками з піковою висотою peakAlt
export function greatCircleArc(
  p1: THREE.Vector3,
  p2: THREE.Vector3,
  peakAlt: number,
  segments = 64,
): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const pt = new THREE.Vector3().lerpVectors(p1, p2, t).normalize();
    const alt = 1 + peakAlt * Math.sin(t * Math.PI);
    pts.push(pt.multiplyScalar(alt));
  }
  return pts;
}
