export interface Rng {
  /** [0, 1) 난수 */
  next(): number;
  /** [min, max] 정수 난수 */
  intBetween(min: number, max: number): number;
}

/**
 * 시드 기반 결정적 난수 생성기 (mulberry32).
 * 리플레이·테스트 재현이 가능하도록 Math.random 대신 이것을 쓴다.
 */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    intBetween(min: number, max: number): number {
      return min + Math.floor(next() * (max - min + 1));
    },
  };
}
