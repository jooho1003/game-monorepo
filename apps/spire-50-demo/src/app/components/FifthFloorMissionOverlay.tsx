import { useEffect } from "react";
import type { FifthFloorMissionState } from "../../domain/fifth-floor-mission.js";
import { useGameStore } from "../../store/game-store.js";

const phaseLabels: Record<FifthFloorMissionState["phase"], string> = {
  watching: "경계 중",
  sleeping: "수면 중",
  "gate-open": "탈출로 개방",
};

const weakPointLabels: Record<FifthFloorMissionState["weakPoint"], string> = {
  dormant: "눈 보호 중",
  primed: "눈을 조준해 기본 공격",
  blinded: "시야·공격 정지",
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
  const pending =
    mission?.phase === "watching" && mission.strategy === "pending";
  const selecting =
    mission?.phase === "watching" &&
    mission.strategy === "stealth-selecting";

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

  if (!mission || mission.status !== "active") return null;
  const phaseSeconds = Math.max(0, Math.ceil(mission.phaseRemainingMs / 1_000));
  const survivorsGathered = mission.alliesAtBeach >= mission.alliesRemaining;
  const missionHint = getMissionHint(mission, survivorsGathered);
  const bossHealthPercent = Math.max(
    0,
    Math.min(100, (mission.bossHp / mission.bossMaxHp) * 100),
  );

  return (
    <section className="cyclops-mission" aria-label="5층 탈출 임무">
      <div className={`cyclops-mission__summary is-${mission.phase}`}>
        <div className="cyclops-mission__topline">
          <div className="cyclops-mission__title">
            <span>5층 임무 · 외눈박이의 해안</span>
            <strong>생존자 전원 탈출</strong>
          </div>
          <div className="cyclops-mission__status-line">
            <i aria-hidden="true" />
            <span>{phaseLabels[mission.phase]}</span>
            <strong>{phaseSeconds}초</strong>
          </div>
          <div className="cyclops-mission__clock" role="timer">
            <span>남은 시간</span>
            <strong>{formatTime(mission.remainingMs)}</strong>
          </div>
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
          <span className="cyclops-mission__health-track" aria-hidden="true">
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
              <small>양</small>
              <b>{mission.sheepCount}마리</b>
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
      {pending || selecting ? (
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
                    <small>2명을 골라 돌진 · 수면 후 문 개방</small>
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
          ) : (
            <>
              <div className="cyclops-mission__choice-heading is-selecting">
                <span>희생 병사 선택</span>
                <strong>돌진시킬 병사 2명을 고르세요</strong>
                <small>선택한 병사는 외눈박이를 잠재우고 희생됩니다.</small>
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
            </>
          )}
        </div>
      ) : null}
    </section>
  );
}

function getMissionHint(
  mission: FifthFloorMissionState,
  survivorsGathered: boolean,
): string {
  if (mission.phase === "sleeping") {
    return "잠든 눈을 기본 공격하면 8초 동안 문이 열리고 보스가 공격하지 않습니다.";
  }
  if (mission.phase === "gate-open") {
    if (!mission.reachedBeach) return "바위문을 통과해 해안으로 이동하세요.";
    if (!survivorsGathered)
      return "뒤처진 생존 병사를 모두 해안까지 데려오세요.";
    return "전원 집결 완료 · 청록색 휴식처 게이트로 탈출하세요.";
  }
  if (mission.strategy === "fighting") {
    return "붉은 타격 지점을 보고 피하세요. 병사들은 돌진을 멈추지 않습니다.";
  }
  if (mission.strategy === "stealth-selecting")
    return "희생시킬 병사 2명을 직접 선택한 뒤 돌진시키세요.";
  if (mission.strategy === "stealth-charging")
    return "선택한 두 병사가 외눈박이에게 돌진하고 있습니다.";
  return "병사들은 대열을 유지하며 당신의 선택을 기다립니다.";
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
