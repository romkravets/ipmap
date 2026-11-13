import * as THREE from 'three'
import { latLngToVec3, greatCircleArc } from '../geo3d'

describe('latLngToVec3', () => {
  it('(0,0) → +X, (90,0) → +Y, (0,90) → −Z', () => {
    expect(latLngToVec3(0, 0).distanceTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-9)
    expect(latLngToVec3(90, 0).distanceTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-9)
    expect(latLngToVec3(0, 90).distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-9)
  })
  it('масштабує за r', () => {
    expect(latLngToVec3(30, 40, 1.5).length()).toBeCloseTo(1.5, 9)
  })
})

describe('greatCircleArc', () => {
  const a = latLngToVec3(0, 0), b = latLngToVec3(0, 90)
  it('segments+1 точок, кінці на сфері, середина на висоті 1+peak', () => {
    const pts = greatCircleArc(a, b, 0.2, 10)
    expect(pts).toHaveLength(11)
    expect(pts[0].length()).toBeCloseTo(1, 9)
    expect(pts[10].length()).toBeCloseTo(1, 9)
    expect(pts[5].length()).toBeCloseTo(1.2, 9)
  })
  it('за замовчуванням 65 точок', () => {
    expect(greatCircleArc(a, b, 0.1)).toHaveLength(65)
  })
})
