import { useEffect, useState } from "react";
import {
  FIFTH_FLOOR_MIN_ESCAPE_ALLIES,
  type FifthFloorMissionState,
} from "../../domain/fifth-floor-mission.js";
import { useGameStore } from "../../store/game-store.js";

const phaseLabels: Record<FifthFloorMissionState["phase"], string> = {
  watching: "바위문 열림까지",
  sleeping: "수면 중",
  "gate-open": "바위문 열림",
};

const weakPointLabels: Record<FifthFloorMissionState["weakPoint"], string> = {
  dormant: "눈 보호 중",
  primed: "눈 앞에서 G",
  blinded: "문 앞 공격범위 축소",
};

export function FifthFloorMissionOverlay() {
  const mission = useGameStore((state) => state.fifthFloorMission);
  const requestStrategy = useGameStore(
    (state) => state.requestFifthFloorStrategy,
  );
  const toggleSacrifice = useGameStore(
    (state) => state.requestFifthFloorSacrificeToggle,
  );
  const confirmSacrifice = useGameStore(
    (state) => state.requestFifthFloorSacrificeCharge,
  );
  const revokeStrategy = useGameStore(
    (state) => state.requestFifthFloorStrategyRevoke,
  );
  const [showDetails, setShowDetails] = useState(false);
  const pending =
    mission?.phase !== "sleeping" && mission?.strategy === "pending";
  const selecting =
    mission?.phase !== "sleeping" &&
    mission?.strategy === "stealth-selecting";
  const fighting =
    mission?.phase !== "sleeping" && mission?.strategy === "fighting";
  const revocable = selecting || fighting;

  useEffect(() => {
    const handleDetailKey = (event: KeyboardEvent) => {
      if (event.code !== "KeyN") return;
      event.preventDefault();
      setShowDetails((visible) => !visible);
    };
    window.addEventListener("keydown", handleDetailKey);
    return () => window.removeEventListener("keydown", handleDetailKey);
  }, []);

  useEffect(() => {
    if (!pending) return;
    const handleChoiceKey = (event: KeyboardEvent) => {
      if (event.code === "Digit1" || event.code === "Numpad1") {
        event.preventDefault();
        requestStrategy(true);
      }
      if (event.code === "Digit2" || event.code === "Numpad2") {
        event.preventDefault();
        requestStrategy(false);
      }
    };
    window.addEventListener("keydown", handleChoiceKey);
    return () => window.removeEventListener("keydown", handleChoiceKey);
  }, [pending, requestStrategy]);

  useEffect(() => {
    if (!revocable) return;
    const handleRevokeKey = (event: KeyboardEvent) => {
      if (event.code !== "KeyX") return;
      event.preventDefault();
      revokeStrategy();
    };
    window.addEventListener("keydown", handleRevokeKey);
    return () => window.removeEventListener("keydown", handleRevokeKey);
  }, [revocable, revokeStrategy]);

  if (!mission || mission.status !== "active") return null;
  const phaseSeconds = Math.max(0, Math.ceil(mission.phaseRemainingMs / 1_000));
  const timerHeld = mission.phaseTimerHeld && mission.phase !== "sleeping";
  const phaseDetail =
    mission.phase === "gate-open" && phaseSeconds === 0
      ? timerHeld
        ? "공격 중 · 개방 유지"
        : "양 이동 대기"
      : timerHeld
        ? `${phaseSeconds}초 · 공격 중 정지`
        : mission.phase === "watching"
          ? `${phaseSeconds}초 전`
          : `${phaseSeconds}초`;
  const survivorsGathered = mission.alliesAtBeach >= mission.alliesRemaining;
  const missionHint = getMissionHint(mission, survivorsGathered);
  const bossHealthPercent = Math.max(
    0,
    Math.min(100, (mission.bossHp / mission.bossMaxHp) * 100),
  );

  return (
    <>
      <section className="cyclops-mission" aria-label="5층 탈출 임무">
        <div className={`cyclops-mission__topbar is-${mission.phase}`}>
          <div className="cyclops-mission__status-line">
            <i aria-hidden="true" />
            <span>{phaseLabels[mission.phase]}</span>
            <strong>{phaseDetail}</strong>
          </div>
          <div className="cyclops-mission__clock" role="timer">
            <span>남은 시간</span>
            <strong>{formatTime(mission.remainingMs)}</strong>
          </div>
          <small className="cyclops-mission__toggle-hint">
            N {showDetails ? "정보 닫기" : "상세 정보"}
          </small>
        </div>
        {showDetails ? (
          <div className={`cyclops-mission__summary is-${mission.phase}`}>
            <div className="cyclops-mission__title">
              <span>5층 임무 · 외눈박이의 해안</span>
              <strong>병사 6명 이상 탈출</strong>
            </div>

            <div
              className="cyclops-mission__boss-health"
              role="progressbar"
              aria-label="폴리페모스 체력"
              aria-valuemin={0}
              aria-valuemax={mission.bossMaxHp}
              aria-valuenow={mission.bossHp}
            >
              <div>
                <span>보스 · 폴리페모스</span>
                <b>
                  {mission.bossHp} / {mission.bossMaxHp}
                </b>
              </div>
              <span
                className="cyclops-mission__health-track"
                aria-hidden="true"
              >
                <i style={{ width: `${bossHealthPercent}%` }} />
              </span>
            </div>

            <div className="cyclops-mission__meta">
              <div
                className="cyclops-mission__squad"
                role="group"
                aria-label="아군 현황"
              >
                <span>
                  <small>생존 병사</small>
                  <b>{mission.alliesRemaining}명</b>
                </span>
                <span>
                  <small>해안 집결</small>
                  <b>
                    {mission.alliesAtBeach}/{mission.alliesRemaining}명
                  </b>
                </span>
                <span>
                  <small>양 해안 이동</small>
                  <b>
                    {mission.sheepAtBeach}/{mission.sheepCount}마리
                  </b>
                </span>
              </div>
              <em className={`is-${mission.weakPoint}`}>
                <small>보스 약점</small>
                <b>{weakPointLabels[mission.weakPoint]}</b>
              </em>
            </div>

            <p className="cyclops-mission__hint">
              <span aria-hidden="true">목표</span>
              {missionHint}
            </p>
          </div>
        ) : null}
      </section>
      {pending || selecting || fighting ? (
        <section
          className="cyclops-mission cyclops-mission--dock"
          aria-label="전술 결정"
        >
          <div className="cyclops-mission__choice" aria-live="polite">
          {pending ? (
            <>
              <div className="cyclops-mission__choice-heading">
                <span>전술 결정</span>
                <strong>병사들이 명령을 기다립니다</strong>
                <small>숫자 키 또는 버튼으로 작전을 선택하세요.</small>
              </div>
              <div className="cyclops-mission__strategy-list">
                <button
                  className="is-stealth"
                  type="button"
                  onClick={() => requestStrategy(true)}
                >
                  <kbd>1</kbd>
                  <span>
                    <strong>은밀히 탈출</strong>
                    <small>2명 희생 · 수면 중 G로 눈 타격</small>
                  </span>
                </button>
                <button
                  className="is-fighting"
                  type="button"
                  onClick={() => requestStrategy(false)}
                >
                  <kbd>2</kbd>
                  <span>
                    <strong>맞서 싸운다</strong>
                    <small>전 병사가 즉시 보스에게 돌진</small>
                  </span>
                </button>
              </div>
            </>
          ) : selecting ? (
            <>
              <div className="cyclops-mission__choice-heading is-selecting">
                <span>희생 병사 선택</span>
                <strong>돌진시킬 병사 2명을 고르세요</strong>
                <small>
                  선택한 병사는 외눈박이를 잠재우고 희생됩니다. X 키로
                  선택을 철회할 수 있습니다.
                </small>
                <b>{mission.selectedSacrificeIds.length} / 2</b>
              </div>
              <div
                className="cyclops-mission__soldier-picker"
                role="group"
                aria-label="희생 병사 목록"
              >
                {mission.activeSoldierIds.map((soldierId) => {
                  const selected =
                    mission.selectedSacrificeIds.includes(soldierId);
                  const disabled =
                    !selected && mission.selectedSacrificeIds.length >= 2;
                  return (
                    <button
                      className={selected ? "is-selected" : undefined}
                      type="button"
                      key={soldierId}
                      disabled={disabled}
                      aria-label={`병사 ${soldierId + 1}${selected ? ", 선택됨" : ""}`}
                      aria-pressed={selected}
                      onClick={() => toggleSacrifice(soldierId)}
                    >
                      <span aria-hidden="true">{soldierId + 1}</span>
                    </button>
                  );
                })}
              </div>
              <button
                className="cyclops-mission__charge"
                type="button"
                disabled={mission.selectedSacrificeIds.length !== 2}
                onClick={confirmSacrifice}
              >
                <strong>선택한 2명 돌진</strong>
                <small>
                  {mission.selectedSacrificeIds.length === 2
                    ? "준비 완료 · 클릭하여 명령"
                    : "병사 2명을 선택해야 합니다"}
                </small>
              </button>
              <button
                className="cyclops-mission__charge"
                type="button"
                onClick={revokeStrategy}
              >
                <strong>선택 철회</strong>
                <small>X 키 · 전술 결정으로 돌아갑니다</small>
              </button>
            </>
          ) : (
            <>
              <div className="cyclops-mission__choice-heading">
                <span>교전 중</span>
                <strong>병사들이 외눈박이를 공격하고 있습니다</strong>
                <small>X 키 또는 버튼으로 공격 명령을 철회할 수 있습니다.</small>
              </div>
              <button
                className="cyclops-mission__charge"
                type="button"
                onClick={revokeStrategy}
              >
                <strong>공격 명령 철회</strong>
                <small>X 키 · 병사들이 전투를 멈추고 물러납니다</small>
              </button>
            </>
          )}
          </div>
        </section>
      ) : null}
    </>
  );
}

function getMissionHint(
  mission: FifthFloorMissionState,
  survivorsGathered: boolean,
): string {
  if (mission.phase === "sleeping") {
    return "보스의 눈 앞에서 G를 누르세요. 실명은 영구적이며, 바위문은 원래 주기대로 계속 열리고 닫힙니다.";
  }
  if (mission.phase === "gate-open") {
    if (mission.bossHp > 0) {
      return mission.flockDirection === "out"
        ? "양이 모두 나갈 때까지 바위문이 열립니다. 지금 함께 나갈 수 있지만 보스는 계속 잡으러 옵니다."
        : "양을 모두 들여보내는 동안 바위문이 다시 열립니다. 지금 함께 나갈 수 있지만 보스는 계속 공격합니다.";
    }
    if (!mission.reachedBeach) {
      return mission.bossHp <= 0
        ? "보스를 쓰러뜨렸습니다. 열린 바위문을 통과하세요."
        : "공격 범위가 줄어든 보스를 피해 바위문을 통과하세요.";
    }
    if (!survivorsGathered)
      return "뒤처진 생존 병사를 모두 해안까지 데려오세요.";
    if (mission.alliesRemaining < FIFTH_FLOOR_MIN_ESCAPE_ALLIES) {
      return `생존 병사가 ${FIFTH_FLOOR_MIN_ESCAPE_ALLIES}명 미만이라 탈출 시 임무가 실패합니다.`;
    }
    return `병사 ${mission.alliesRemaining}명 집결 완료 · 청록색 휴식처 게이트로 탈출하세요.`;
  }
  if (mission.strategy === "fighting") {
    return "붉은 타격 지점을 보고 피하세요. 바위문이 닫힌 채 보스를 쓰러뜨리면 출구가 막힙니다. X로 공격 명령을 철회할 수 있습니다.";
  }
  if (mission.strategy === "stealth-selecting")
    return "희생시킬 병사 2명을 직접 선택한 뒤 돌진시키세요.";
  if (mission.strategy === "stealth-charging")
    return "선택한 두 병사가 외눈박이에게 돌진하고 있습니다.";
  if (mission.strategy === "observing") {
    return "외눈박이가 바위문을 직접 열러 갑니다. 양은 밖과 안을 오가며 문은 반복해서 열리고 닫힙니다.";
  }
  return mission.flockDirection === "in"
    ? "양이 밖에 있습니다. 잠시 후 바위문을 다시 열어 양을 들여보냅니다."
    : "양이 안에 있습니다. 잠시 후 바위문을 다시 열어 양을 내보냅니다.";
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
            : result === "failure-too-few-survivors"
              ? "탈출한 병사가 6명 미만이라 임무에 실패했습니다."
              : result === "failure-gate-sealed"
                ? "바위문이 닫힌 채 외눈박이가 쓰러져 출구가 영영 막혔습니다."
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
