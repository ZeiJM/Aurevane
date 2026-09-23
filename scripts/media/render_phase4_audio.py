"""Deterministic Phase-4 material-synthesis audio renderer.

No recordings or external samples are used. The v02 Discipline pack intentionally gives each
published Discipline its own transient, spectral envelope, pitch motion, and Essence treatment
instead of varying one shared recipe by oscillator frequencies.
"""

from pathlib import Path
import argparse
import hashlib
import json
import subprocess

import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[2] / "content/media-candidates/phase4-a07-audio-v02"
RATE = 48_000

DISCIPLINES = {
    "vanguard": ("Armored weapon impact", [88, 176, 352], 0.32),
    "farstrider": ("Taut bowstring and arrow flight", [145, 435, 1160], 0.24),
    "shadehand": ("Muted blade whisper and cloth", [118, 746, 1730], 0.21),
    "aetherist": ("Arcane glass spark and rising charge", [330, 880, 1760], 0.31),
    "lifebinder": ("Warm organic pulse and leaf release", [196, 294, 588], 0.34),
    "ironfist": ("Wrapped fist contact and cloth movement", [102, 207, 431], 0.25),
    "chronist": ("Measured clockwork tap and suspended glass", [330, 495, 825], 0.28),
    "bastion": ("Deep shield brace and metal bloom", [74, 148, 296], 0.36),
    "ravager": ("Serrated heavy cut and scrape", [72, 217, 503], 0.30),
    "edgedancer": ("Precise bright blade slice", [710, 1171, 1923], 0.20),
    "wildwarden": ("Wooden string snap and thorn brush", [174, 348, 696], 0.29),
    "runeblade": ("Steel contact and rune resonance", [238, 533, 863], 0.33),
    "dawnshield": ("Warm shield resonance and radiant bloom", [164, 330, 491], 0.36),
    "cinderweaver": ("Dry ignition and flame rush", [110, 201, 347], 0.30),
    "frostweaver": ("Brittle ice fracture and crystal ring", [1081, 1667, 2419], 0.25),
    "stormsinger": ("Thunder crack and charged air", [83, 178, 419], 0.30),
    "tidecaller": ("Water impact and flowing release", [231, 403, 617], 0.36),
}

SHARED = {
    "attrition": ("Subdued attrition tick", [152, 317, 609], 0.16),
    "healing": ("Soft healing release", [261, 392, 523], 0.32),
    "cleanse": ("Clear cleansing release", [523, 791, 1047], 0.27),
    "resonance": ("Short conversion accent", [287, 459, 701], 0.25),
}

FAMILIES = {**DISCIPLINES, **SHARED}


def band(noise, low_hz, high_hz, order=2):
    high_hz = min(high_hz, RATE / 2 - 100)
    low_hz = max(20, low_hz)
    return signal.sosfilt(
        signal.butter(order, [low_hz, high_hz], btype="band", fs=RATE, output="sos"),
        noise,
    )


def low(noise, cutoff):
    return signal.sosfilt(
        signal.butter(2, cutoff, btype="low", fs=RATE, output="sos"),
        noise,
    )


def modal_body(mode_hz, time, detune, decays=(0.07, 0.095, 0.12)):
    return sum(
        np.sin(2 * np.pi * frequency * detune * time)
        * np.exp(-time / decays[min(index, len(decays) - 1)])
        / (index + 1)
        for index, frequency in enumerate(mode_hz)
    )


def sweep(time, start_hz, end_hz, duration, phase=0):
    swept = np.minimum(time, duration)
    slope = (end_hz - start_hz) / max(duration, 1e-6)
    phase_curve = 2 * np.pi * (start_hz * swept + 0.5 * slope * swept * swept) + phase
    return np.sin(phase_curve)


def clicks(time, positions, width=0.0015):
    result = np.zeros_like(time)
    for position, amplitude in positions:
        result += amplitude * np.exp(-((time - position) / width) ** 2)
    return result


def render(family, variant, essence):
    label, mode_hz, regular_duration = FAMILIES[family]
    duration = 0.62 if essence else regular_duration
    seed = int.from_bytes(
        hashlib.sha256(f"{family}:{variant}:{essence}:v02".encode()).digest()[:8],
        "little",
    )
    rng = np.random.default_rng(seed)
    time = np.arange(round(duration * RATE)) / RATE
    noise = rng.normal(0, 1, len(time))
    detune = [0.965, 1.0, 1.035][variant - 1]

    body = modal_body(mode_hz, time, detune)
    contact = band(noise, 160, 4800) * np.exp(-time / 0.022)
    air = band(noise, 500, 5000) * np.sin(np.pi * np.minimum(time / duration, 1)) ** 2

    if family == "vanguard":
        low_hit = low(noise, 260) * np.exp(-time / 0.035)
        metal = np.sin(2 * np.pi * 640 * detune * time) * np.exp(-time / 0.09)
        audio = 0.80 * body + 0.70 * low_hit + 0.22 * metal + 0.08 * air
    elif family == "farstrider":
        pluck = sum(
            np.sin(2 * np.pi * 145 * detune * harmonic * time)
            * np.exp(-time / (0.055 + 0.014 * harmonic))
            / harmonic
            for harmonic in range(1, 10)
        )
        whistle = (
            sweep(time, 1550 * detune, 900 * detune, min(duration, 0.20))
            * np.exp(-time / 0.12)
        )
        audio = 0.75 * pluck + 0.42 * band(noise, 1800, 6500) * np.exp(-time / 0.035)
        audio += 0.25 * whistle
    elif family == "shadehand":
        hush = band(noise, 700, 3600) * np.exp(-time / 0.075)
        blade = (
            sweep(time, 2100 * detune, 950 * detune, min(duration, 0.15))
            * np.exp(-time / 0.07)
        )
        cloth = band(noise, 90, 500) * np.exp(-time / 0.045)
        audio = 0.18 * body + 0.62 * hush + 0.34 * blade + 0.22 * cloth
    elif family == "aetherist":
        chirp = (
            sweep(time, 520 * detune, 2500 * detune, min(duration, 0.24))
            * np.exp(-time / 0.16)
        )
        glass = np.sin(2 * np.pi * 1760 * detune * time) * np.exp(-time / 0.20)
        glass += 0.35 * np.sin(2 * np.pi * 2640 * detune * time) * np.exp(-time / 0.13)
        sparks = band(noise, 2600, 7200) * clicks(
            time,
            [(0.012, 0.9), (0.055, 0.5), (0.11, 0.3)],
            0.003,
        )
        audio = 0.25 * body + 0.48 * chirp + 0.32 * glass + 0.22 * sparks
    elif family == "lifebinder":
        pulse = np.sin(2 * np.pi * 196 * detune * time)
        pulse *= np.exp(-time / 0.16) - np.exp(-time / 0.012)
        wood = band(noise, 180, 1100) * np.exp(-time / 0.05)
        leaf = band(noise, 1200, 4200) * np.sin(np.pi * np.minimum(time / duration, 1)) ** 3
        overtone = np.sin(2 * np.pi * 588 * detune * time) * np.exp(-time / 0.21)
        audio = 0.48 * pulse + 0.28 * wood + 0.26 * leaf + 0.18 * overtone
    elif family == "ironfist":
        audio = 0.55 * body * np.exp(-time / 0.035) + 0.62 * contact
        audio += 0.18 * band(noise, 90, 900) * np.exp(-time / 0.065)
    elif family == "chronist":
        tick = clicks(time, [(0.010, 1), (0.095, 0.60), (0.190, 0.35)], 0.0016)
        tick *= band(noise, 800, 5200)
        glass = np.sin(2 * np.pi * 825 * detune * time) * np.exp(-time / 0.22)
        audio = 0.28 * body + 0.35 * tick + 0.24 * glass + 0.06 * air
    elif family == "bastion":
        sub = low(noise, 180) * np.exp(-time / 0.055)
        ring = np.sin(2 * np.pi * 296 * detune * time) * np.exp(-time / 0.18)
        audio = 0.92 * body + 0.78 * sub + 0.25 * ring + 0.05 * air
    elif family == "ravager":
        scrape = band(noise, 450, 4200) * np.exp(-time / 0.14)
        scrape *= 1 - np.exp(-time / 0.008)
        growl = np.sin(2 * np.pi * 72 * detune * time) * np.exp(-time / 0.20)
        audio = 0.48 * body + 0.55 * contact + 0.64 * scrape + 0.28 * growl
    elif family == "edgedancer":
        slice_noise = band(noise, 1800, 7200) * np.exp(-time / 0.045)
        glint = np.sin(2 * np.pi * 2350 * detune * time) * np.exp(-time / 0.075)
        whoosh = (
            sweep(time, 1300 * detune, 2600 * detune, min(duration, 0.12))
            * np.exp(-time / 0.06)
        )
        audio = 0.12 * body + 0.70 * slice_noise + 0.28 * glint + 0.20 * whoosh
    elif family == "wildwarden":
        pluck = sum(
            np.sin(2 * np.pi * 174 * detune * harmonic * time)
            * np.exp(-time / (0.07 + 0.01 * harmonic))
            / harmonic
            for harmonic in range(1, 7)
        )
        brush = band(noise, 500, 2400) * np.sin(np.pi * np.minimum(time / duration, 1)) ** 2
        twig = clicks(time, [(0.018, 0.8), (0.072, 0.35)], 0.0022) * band(
            noise, 1200, 4800
        )
        audio = 0.58 * pluck + 0.38 * brush + 0.22 * twig
    elif family == "runeblade":
        steel = band(noise, 850, 5600) * np.exp(-time / 0.028)
        rune = np.sin(2 * np.pi * 533 * detune * time) * np.exp(-time / 0.24)
        rune += 0.4 * np.sin(2 * np.pi * 1066 * detune * time) * np.exp(-time / 0.15)
        audio = 0.42 * body + 0.56 * steel + 0.34 * rune + 0.08 * air
    elif family == "dawnshield":
        bloom = np.sin(2 * np.pi * 330 * detune * time)
        bloom += 0.45 * np.sin(2 * np.pi * 660 * detune * time)
        bloom *= np.exp(-time / 0.28) * (1 - np.exp(-time / 0.025))
        shield = low(noise, 420) * np.exp(-time / 0.045)
        audio = 0.44 * body + 0.38 * bloom + 0.38 * shield + 0.12 * air
    elif family == "cinderweaver":
        centers = rng.uniform(0.006, duration * 0.55, 16 if essence else 10)
        grains = sum(np.exp(-((time - center) / 0.0028) ** 2) for center in centers)
        crackle = band(noise, 1300, 7200) * grains * np.exp(-time / 0.14)
        flame = band(noise, 350, 1800) * np.sin(np.pi * np.minimum(time / duration, 1)) ** 2
        audio = 0.14 * body + 0.62 * crackle + 0.38 * flame
    elif family == "frostweaver":
        centers = rng.uniform(0.004, duration * 0.35, 11 if essence else 7)
        shards = sum(np.exp(-((time - center) / 0.0017) ** 2) for center in centers)
        crack = band(noise, 2200, 8500) * shards * np.exp(-time / 0.10)
        crystal = np.sin(2 * np.pi * 1667 * detune * time)
        crystal += 0.35 * np.sin(2 * np.pi * 2419 * detune * time)
        crystal *= np.exp(-time / 0.24)
        audio = 0.10 * body + 0.56 * crack + 0.35 * crystal
    elif family == "stormsinger":
        thunder = low(noise, 240) * np.exp(-time / 0.08)
        snap = band(noise, 1200, 8000) * np.exp(-time / 0.012)
        charge = (
            sweep(time, 180 * detune, 1100 * detune, min(duration, 0.22))
            * np.exp(-time / 0.15)
        )
        audio = 0.60 * thunder + 0.48 * snap + 0.24 * charge + 0.08 * air
    elif family == "tidecaller":
        fluid = (
            sweep(time, 360 * detune, 120 * detune, min(duration, 0.28))
            * np.exp(-time / 0.16)
        )
        splash = band(noise, 300, 2700) * np.exp(-time / 0.09)
        splash *= 1 - np.exp(-time / 0.008)
        audio = 0.45 * fluid + 0.58 * splash + 0.18 * air
    elif family == "attrition":
        audio = 0.35 * body + 0.24 * contact
    else:
        release = np.minimum(time / 0.028, 1) * np.exp(-time / 0.13)
        audio = sum(
            np.sin(2 * np.pi * frequency * detune * time) / (index + 1)
            for index, frequency in enumerate(mode_hz)
        )
        audio = audio * release + 0.10 * air

    if essence:
        if family in ("vanguard", "bastion", "dawnshield"):
            offset = round(0.145 * RATE)
            audio[offset:] += audio[:-offset] * 0.36
        elif family in ("farstrider", "wildwarden"):
            offset = round(0.110 * RATE)
            audio[offset:] += audio[:-offset] * 0.28
            second_offset = round(0.225 * RATE)
            audio[second_offset:] += audio[:-second_offset] * 0.18
        elif family == "shadehand":
            offset = round(0.085 * RATE)
            audio[offset:] -= audio[:-offset] * 0.18
        elif family == "aetherist":
            audio += 0.18 * sweep(time, 300 * detune, 3300 * detune, 0.42) * np.exp(
                -time / 0.33
            )
        elif family == "lifebinder":
            audio += (
                0.18
                * np.sin(2 * np.pi * 392 * detune * time)
                * np.exp(-time / 0.34)
                * (1 - np.exp(-time / 0.05))
            )
        elif family == "ironfist":
            strike = audio.copy()
            for delay, gain in ((0.135, 0.85), (0.270, 0.72)):
                offset = round(delay * RATE)
                audio[offset:] += strike[:-offset] * gain
        elif family == "chronist":
            offset = round(0.095 * RATE)
            audio[offset:] += audio[:-offset] * 0.34
            second_offset = round(0.190 * RATE)
            audio[second_offset:] += audio[:-second_offset] * 0.18
        elif family == "ravager":
            audio += 0.20 * band(noise, 260, 2400) * np.exp(-time / 0.26)
        elif family == "edgedancer":
            offset = round(0.055 * RATE)
            audio[offset:] += audio[:-offset] * 0.20
        elif family == "runeblade":
            audio += 0.16 * np.sin(2 * np.pi * 1066 * detune * time) * np.exp(
                -time / 0.31
            )
        elif family == "cinderweaver":
            audio += 0.20 * band(noise, 500, 3200) * np.exp(-time / 0.26)
        elif family == "frostweaver":
            audio += 0.16 * np.sin(2 * np.pi * 2419 * detune * time) * np.exp(
                -time / 0.34
            )
        elif family == "stormsinger":
            offset = round(0.18 * RATE)
            audio[offset:] += (
                low(noise[:-offset], 220) * 0.22 * np.exp(-time[:-offset] / 0.12)
            )
        elif family == "tidecaller":
            audio += 0.18 * sweep(time, 500 * detune, 90 * detune, 0.46) * np.exp(
                -time / 0.31
            )

    audio = signal.sosfilt(
        signal.butter(2, [45, 9000], btype="band", fs=RATE, output="sos"),
        audio,
    )
    audio -= np.mean(audio)
    fade_in = np.minimum(time / 0.0025, 1)
    fade_out = np.minimum((duration - time) / (0.05 if essence else 0.035), 1)
    audio *= fade_in * np.maximum(fade_out, 0) ** 2

    target_db = -25 if family in ("shadehand", "edgedancer") else -24
    target_rms = 10 ** (target_db / 20)
    peak_limit = 10 ** (-10 / 20)
    rms = max(np.sqrt(np.mean(audio * audio)), 1e-9)
    peak = max(np.max(np.abs(audio)), 1e-9)
    audio *= min(target_rms / rms, peak_limit / peak)
    audio[0] = audio[-1] = 0

    return np.round(audio * 32767).astype(np.int16), seed, label


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--family", choices=FAMILIES, action="append")
    parser.add_argument("--output", type=Path, default=ROOT)
    parser.add_argument("--version", default="v02")
    args = parser.parse_args()

    root = args.output
    masters = root / "audio/masters"
    runtime = root / "audio/runtime"
    masters.mkdir(parents=True, exist_ok=True)
    runtime.mkdir(parents=True, exist_ok=True)

    families = args.family or list(DISCIPLINES)
    rows = []
    for family in families:
        roles = [False, True] if family in DISCIPLINES else [False]
        for essence in roles:
            for variant in range(1, 4):
                role = "essence" if essence else "action"
                name = f"{family}-{role}-{args.version}-{variant}"
                samples, seed, label = render(family, variant, essence)
                master = masters / f"{name}.wav"
                encoded = runtime / f"{name}.mp3"
                wavfile.write(master, RATE, samples)
                subprocess.run(
                    [
                        "ffmpeg",
                        "-v",
                        "error",
                        "-y",
                        "-i",
                        str(master),
                        "-map_metadata",
                        "-1",
                        "-codec:a",
                        "libmp3lame",
                        "-b:a",
                        "96k",
                        str(encoded),
                    ],
                    check=True,
                )
                values = samples.astype(float) / 32768
                peak = max(np.max(np.abs(values)), 1e-9)
                rms = max(np.sqrt(np.mean(values * values)), 1e-9)
                rows.append(
                    {
                        "id": f"audio.phase4.{name}",
                        "family": family,
                        "label": label,
                        "role": role,
                        "variant": variant,
                        "status": "candidate",
                        "approvedBy": None,
                        "sourceMethod": "internal-material-synthesis-v2",
                        "requestId": "AUDIO-A07-001",
                        "seed": str(seed),
                        "durationMs": round(len(samples) / RATE * 1000),
                        "sampleRate": RATE,
                        "channels": 1,
                        "peakDbfs": round(20 * np.log10(peak), 2),
                        "rmsDbfs": round(20 * np.log10(rms), 2),
                        "runtimeBytes": encoded.stat().st_size,
                        "runtimeSha256": hashlib.sha256(encoded.read_bytes()).hexdigest(),
                    }
                )

    (root / "audio-manifest.json").write_text(json.dumps(rows, indent=2) + "\n")
    print(
        json.dumps(
            {
                "candidates": len(rows),
                "runtimeBytes": sum(row["runtimeBytes"] for row in rows),
                "maxRuntimeBytes": max(row["runtimeBytes"] for row in rows),
                "maxPeakDbfs": max(row["peakDbfs"] for row in rows),
            }
        )
    )


if __name__ == "__main__":
    main()
