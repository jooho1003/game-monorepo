/** 점수·콤보·최고점 관리. 어떤 엔진에서든 재사용 가능한 순수 로직. */
export class ScoreBoard {
  #score = 0;
  #combo = 0;
  #best = 0;

  get score(): number {
    return this.#score;
  }

  get combo(): number {
    return this.#combo;
  }

  get best(): number {
    return this.#best;
  }

  /** 기본 점수에 콤보 배율(10%씩 증가)을 적용해 가산한다. */
  add(base: number): number {
    this.#combo += 1;
    const gained = Math.round(base * (1 + (this.#combo - 1) * 0.1));
    this.#score += gained;
    this.#best = Math.max(this.#best, this.#score);
    return gained;
  }

  breakCombo(): void {
    this.#combo = 0;
  }

  reset(): void {
    this.#score = 0;
    this.#combo = 0;
  }
}
