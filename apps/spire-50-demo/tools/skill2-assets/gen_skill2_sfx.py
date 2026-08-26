"""Synthesize the five skill-2 cast sounds (44.1kHz 16-bit mono WAV).

Each weapon gets a distinct signature:
  longsword  spinning storm  - two overlapping whoosh sweeps + metallic ring
  dagger     phantom fan     - three rapid high whooshes with a shimmer tail
  shield     earthshatter    - deep boom drop with rumble decay
  bow        explosive arrow - string twang then an explosion burst
  staff      arcane beam     - rising shimmer into a sustained zap
"""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np

SR = 44_100
OUT = Path(
    "/home/user/game-monorepo/apps/spire-50-demo/public/assets/audio/sfx"
)
RNG = np.random.default_rng(50_505)


def t(seconds: float) -> np.ndarray:
    return np.arange(int(SR * seconds)) / SR


def env(n: int, attack: float, release: float) -> np.ndarray:
    e = np.ones(n)
    a = max(1, int(SR * attack))
    r = max(1, int(SR * release))
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    return e


def bandpass_noise(seconds: float, low: float, high: float) -> np.ndarray:
    n = int(SR * seconds)
    spectrum = np.fft.rfft(RNG.standard_normal(n))
    freqs = np.fft.rfftfreq(n, 1 / SR)
    spectrum[(freqs < low) | (freqs > high)] = 0
    sig = np.fft.irfft(spectrum, n)
    peak = np.max(np.abs(sig))
    return sig / peak if peak > 0 else sig


def whoosh(seconds: float, f0: float, f1: float) -> np.ndarray:
    n = int(SR * seconds)
    center = np.linspace(f0, f1, n)
    noise = bandpass_noise(seconds, 120, 8_000)
    lfo = np.sin(2 * np.pi * np.cumsum(center) / SR)
    sig = noise * (0.55 + 0.45 * lfo)
    return sig * env(n, 0.04, seconds * 0.5)


def tone(seconds: float, freq: float, kind: str = "sine") -> np.ndarray:
    x = t(seconds)
    if kind == "saw":
        return 2 * ((x * freq) % 1) - 1
    return np.sin(2 * np.pi * freq * x)


def place(target: np.ndarray, sig: np.ndarray, at: float, gain: float) -> None:
    start = int(SR * at)
    end = min(len(target), start + len(sig))
    target[start:end] += sig[: end - start] * gain


def normalize(sig: np.ndarray, peak: float = 0.82) -> np.ndarray:
    m = np.max(np.abs(sig))
    return sig * (peak / m) if m > 0 else sig


def save(name: str, sig: np.ndarray) -> None:
    data = (normalize(sig) * 32_767).astype("<i2")
    with wave.open(str(OUT / name), "wb") as fh:
        fh.setnchannels(1)
        fh.setsampwidth(2)
        fh.setframerate(SR)
        fh.writeframes(data.tobytes())
    print(name, f"{len(sig) / SR:.2f}s")


def longsword() -> np.ndarray:
    out = np.zeros(int(SR * 0.9))
    place(out, whoosh(0.42, 300, 1_500), 0.0, 0.9)
    place(out, whoosh(0.42, 380, 1_900), 0.22, 0.8)
    ring = tone(0.5, 2_650) * env(int(SR * 0.5), 0.002, 0.46)
    ring += tone(0.5, 3_960) * env(int(SR * 0.5), 0.002, 0.4) * 0.4
    place(out, ring, 0.30, 0.22)
    return out


def dagger() -> np.ndarray:
    out = np.zeros(int(SR * 0.75))
    for i in range(3):
        place(out, whoosh(0.2, 900 + i * 300, 3_200 + i * 400), i * 0.11, 0.85)
    shimmer = np.zeros(int(SR * 0.4))
    for f in (2_100, 2_800, 3_500):
        shimmer += tone(0.4, f) * env(int(SR * 0.4), 0.01, 0.36)
    place(out, shimmer / 3, 0.32, 0.3)
    return out


def shield() -> np.ndarray:
    out = np.zeros(int(SR * 1.05))
    n = int(SR * 0.7)
    freq = np.linspace(150, 42, n)
    boom = np.sin(2 * np.pi * np.cumsum(freq) / SR) * env(n, 0.004, 0.55)
    place(out, boom, 0.02, 1.0)
    rumble = bandpass_noise(0.9, 30, 220) * env(int(SR * 0.9), 0.01, 0.8)
    place(out, rumble, 0.05, 0.55)
    crack = bandpass_noise(0.12, 800, 6_000) * env(int(SR * 0.12), 0.001, 0.1)
    place(out, crack, 0.02, 0.5)
    return out


def bow() -> np.ndarray:
    out = np.zeros(int(SR * 1.0))
    n = int(SR * 0.25)
    freq = np.linspace(430, 300, n)
    twang = np.sin(2 * np.pi * np.cumsum(freq) / SR)
    twang += 0.4 * np.sin(2 * np.pi * np.cumsum(freq * 2.01) / SR)
    place(out, twang * env(n, 0.001, 0.2), 0.0, 0.5)
    place(out, whoosh(0.3, 1_200, 2_600), 0.05, 0.35)
    blast = bandpass_noise(0.55, 60, 3_800) * env(int(SR * 0.55), 0.002, 0.48)
    place(out, blast, 0.34, 1.0)
    thump_n = int(SR * 0.3)
    thump_f = np.linspace(120, 46, thump_n)
    thump = np.sin(2 * np.pi * np.cumsum(thump_f) / SR) * env(thump_n, 0.002, 0.26)
    place(out, thump, 0.34, 0.8)
    return out


def staff() -> np.ndarray:
    out = np.zeros(int(SR * 1.1))
    n = int(SR * 0.35)
    rise_f = np.linspace(500, 1_900, n)
    rise = np.sin(2 * np.pi * np.cumsum(rise_f) / SR) * env(n, 0.02, 0.1)
    rise += 0.5 * np.sin(2 * np.pi * np.cumsum(rise_f * 1.5) / SR) * env(n, 0.02, 0.1)
    place(out, rise, 0.0, 0.45)
    beam_n = int(SR * 0.6)
    x = t(0.6)
    carrier = 880 + 40 * np.sin(2 * np.pi * 9 * x)
    beam = np.sin(2 * np.pi * np.cumsum(carrier) / SR)
    beam += 0.45 * np.sin(2 * np.pi * np.cumsum(carrier * 2) / SR)
    beam += 0.25 * np.sin(2 * np.pi * np.cumsum(carrier * 3.01) / SR)
    place(out, beam * env(beam_n, 0.02, 0.5), 0.32, 0.6)
    sparkle = bandpass_noise(0.6, 4_000, 10_000) * env(int(SR * 0.6), 0.05, 0.5)
    place(out, sparkle, 0.32, 0.16)
    return out


def main() -> None:
    save("skill2-longsword.wav", longsword())
    save("skill2-dagger.wav", dagger())
    save("skill2-shield.wav", shield())
    save("skill2-bow.wav", bow())
    save("skill2-staff.wav", staff())


if __name__ == "__main__":
    main()
