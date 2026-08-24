import { useEffect } from "react";
import type { FifthFloorMissionState } from "../../domain/fifth-floor-mission.js";
import { useGameStore } from "../../store/game-store.js";

const phaseLabels: Record<FifthFloorMissionState["phase"], string> = {
  watching: "외눈박이가 깨어 입구를 감시합니다",
  sleeping: "외눈박이가 깊이 잠들었습니다",
  "gate-open": "바위문이 열렸습니다 · 지금 탈출하세요",
};

const weakPointLabels: Record<FifthFloorMissionState["weakPoint"], string> = {
  dormant: "눈 보호 중",
  primed: "수면 중 · 기본 공격 1회로 눈을 깨우세요",
  exposed: "눈 노출 · 눈을 조준해 기본 공격",
  blinded: "시야 차단됨",
};

export function FifthFloorMissionOverlay() {
  const mission = useGameStore((state) => state.fifthFloorMission);
  const requestSacrifice = useGameStore(
    (state) => state.requestFifthFloorSacrifice,
  );
  const pending = Boolean(
    mission?.phase === "watching" &&
      mission.sacrificeDecision === "pending",
  );

  useEffect(() => {
    if (!pending) return;
    const handleChoiceKey = (event: KeyboardEvent) => {
      if (event.code === "Digit1" || event.code === "Numpad1") {
        event.preventDefault();
        requestSacrifice(true);
      }
      if (event.code === "Digit2" || event.code === "Numpad2") {
        event.preventDefault();
        requestSacrifice(false);
      }
    };
    window.addEventListener("keydown", handleChoiceKey);
    return () => window.removeEventListener("keydown", handleChoiceKey);
  }, [pending, requestSacrifice]);

  if (!mission || mission.status !== "active") return null;
  const phaseSeconds = Math.max(0, Math.ceil(mission.phaseRemainingMs / 1_000));
  const phaseLabel =
    mission.phase === "watching" && mission.sacrificeDecision === "fighting"
      ? "외눈박이가 당신을 추격합니다 · 한 번 잡히면 사망"
      : phaseLabels[mission.phase];

  return (
    <section className="cyclops-mission" aria-label="5층 탈출 임무">
      <div className="cyclops-mission__clock" role="timer">
        <span>POLYPHEMOS · 탈출 제한</span>
        <strong>{formatTime(mission.remainingMs)}</strong>
      </div>
      <div className={`cyclops-mission__phase is-${mission.phase}`}>
        <strong>{phaseLabel}</strong>
        <span>
          다음 변화까지 {phaseSeconds}초 · 아군 {mission.alliesRemaining}/15 · 양{" "}
          {mission.sheepCount}/20 ({mission.flockLocation === "inside" ? "동굴 안" : "동굴 밖"})
        </span>
        <div className="cyclops-mission__boss-health">
          <span>
            보스 체력 {mission.bossHp} / {mission.bossMaxHp}
          </span>
          <i
            style={{ width: `${(mission.bossHp / mission.bossMaxHp) * 100}%` }}
          />
        </div>
        <em className={`is-${mission.weakPoint}`}>
          약점 · {weakPointLabels[mission.weakPoint]}
        </em>
        {mission.reachedBeach ? <b>바닷가 도달 · 휴식처 게이트로 이동</b> : null}
      </div>
      {mission.phase === "watching" ? (
        <div className="cyclops-mission__choice" aria-live="polite">
          <p>
            {mission.sacrificeDecision === "fighting"
              ? "맞서 싸우기를 선택했습니다. 병사들이 공격에 합류합니다. 거인의 손에 잡히지 말고 바위문 개방까지 버티세요."
              : "1은 병사 2명이 손에 붙잡혀 피해를 입는 대신 거인을 재웁니다. 2는 병사들과 함께 맞서 싸웁니다."}
          </p>
          <div>
            <button
              type="button"
              disabled={!pending}
              onClick={() => requestSacrifice(true)}
            >
              1 · 희생 설정 (병사 2명)
            </button>
            <button
              type="button"
              disabled={!pending}
              onClick={() => requestSacrifice(false)}
            >
              2 · 맞서 싸우기 (15초 생존)
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function MissionFailureOverlay() {
  const result = useGameStore((state) => state.snapshot.lastMissionResult);
  const dispatch = useGameStore((state) => state.dispatch);

  useEffect(() => {
    if (!result) return;
    const timeout = window.setTimeout(
      () => dispatch({ type: "ACK_MISSION_RESULT" }),
      3_200,
    );
    return () => window.clearTimeout(timeout);
  }, [dispatch, result]);

  if (!result) return null;
  return (
    <div className="mission-failure" role="alert" aria-live="assertive">
      <div>
        <span>FIFTH FLOOR · ESCAPE FAILED</span>
        <h2>미션 실패</h2>
        <p>
          {result === "failure-spotted"
            ? "외눈박이의 손에 붙잡혀 단 한 번의 공격으로 사망했습니다."
            : "5분 안에 바위문을 통과하지 못했습니다."}
        </p>
        <strong>휴식처로 자동 귀환했습니다.</strong>
      </div>
    </div>
  );
}

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}
