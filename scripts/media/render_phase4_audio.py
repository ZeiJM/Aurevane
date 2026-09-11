"""Original, deterministic material-synthesis candidates. No recordings or external samples.

Offline only: numpy/scipy + ffmpeg. Outputs remain outside apps/web/public until human approval.
"""
from pathlib import Path
import hashlib
import json
import subprocess
import numpy as np
from scipy import signal
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[2] / 'content/media-candidates/phase4'
RATE = 48000
FAMILIES = {
    'bastion': ('Muted shield thud', [126, 309, 587], 0.32),
    'ravager': ('Coarse cut', [96, 231, 510], 0.29),
    'edgedancer': ('Precise slice', [710, 1171, 1923], 0.22),
    'wildwarden': ('String snap and thorn brush', [196, 392, 790], 0.27),
    'runeblade': ('Steel contact and rune resonance', [238, 533, 863], 0.33),
    'dawnshield': ('Warm shield resonance', [164, 330, 491], 0.34),
    'cinderweaver': ('Dry ignition', [110, 201, 347], 0.30),
    'frostweaver': ('Brittle ice fracture', [1081, 1667, 2419], 0.24),
    'stormsinger': ('Restrained crack and air', [83, 178, 419], 0.28),
    'tidecaller': ('Water impact and release', [231, 403, 617], 0.34),
    'attrition': ('Subdued attrition tick', [152, 317, 609], 0.16),
    'healing': ('Soft healing release', [261, 392, 523], 0.32),
    'cleanse': ('Clear cleansing release', [523, 791, 1047], 0.27),
    'resonance': ('Short conversion accent', [287, 459, 701], 0.25),
}

def filtered(noise, low, high):
    return signal.sosfilt(signal.butter(2, [low, high], btype='band', fs=RATE, output='sos'), noise)

def render(family, variant, essence):
    _, modes, regular_duration = FAMILIES[family]
    duration = 0.54 if essence else regular_duration
    seed = int.from_bytes(hashlib.sha256(f'{family}:{variant}:{essence}:v01'.encode()).digest()[:8], 'little')
    rng = np.random.default_rng(seed)
    t = np.arange(round(duration * RATE)) / RATE
    noise = rng.normal(0, 1, len(t))
    detune = [0.973, 1, 1.028][variant - 1]
    body = sum(np.sin(2*np.pi*f*detune*t) * np.exp(-t/(0.055 + 0.028*i)) / (i+1)
               for i, f in enumerate(modes))
    contact = filtered(noise, 180, 4200) * np.exp(-t/0.024)
    air = filtered(noise, 380, 2700) * np.sin(np.pi*np.minimum(t/duration, 1))**2
    if family in ('bastion', 'dawnshield'):
        x = 0.80*body + 0.50*contact + 0.07*air
    elif family == 'ravager':
        x = 0.50*body + 0.42*contact + 0.65*air
    elif family == 'edgedancer':
        x = 0.12*body + 0.13*contact + 0.95*air
    elif family == 'wildwarden':
        string = sum(np.sin(2*np.pi*modes[0]*detune*k*t)*np.exp(-t/(0.085/k))/k for k in range(1, 9))
        x = 0.70*string + 0.45*contact + 0.18*air
    elif family == 'runeblade':
        x = 0.52*body + 0.65*contact + 0.12*air
    elif family in ('cinderweaver', 'stormsinger', 'frostweaver'):
        centers = rng.uniform(0.006, duration*0.55, 9 if family != 'stormsinger' else 15)
        grains = sum(np.exp(-((t-c)/(0.002 if family == 'frostweaver' else 0.004))**2) for c in centers)
        crackle = filtered(noise, 800, 5600) * grains * np.exp(-t/0.12)
        x = (0.12 if family == 'frostweaver' else 0.35)*body + 0.70*crackle + 0.22*air
    elif family == 'tidecaller':
        fluid = np.sin(2*np.pi*(260*detune*t - 180*t*t))*np.exp(-t/0.11)
        x = 0.38*fluid + 0.65*air + 0.18*contact
    elif family == 'attrition':
        x = 0.40*body + 0.28*contact
    else:
        release = np.minimum(t/0.028, 1)*np.exp(-t/0.13)
        x = sum(np.sin(2*np.pi*f*detune*t)/(i+1) for i, f in enumerate(modes))*release + 0.10*air
    if essence:
        # More articulation, not more gain: a brief early reflection and longer material release.
        reflection = np.zeros_like(x)
        offset = round(0.061*RATE)
        reflection[offset:] = x[:-offset]*0.22
        x += reflection + 0.12*body*np.minimum(t/0.045, 1)
    x = signal.sosfilt(signal.butter(2, [55, 6200], btype='band', fs=RATE, output='sos'), x)
    x -= np.mean(x)
    fade_in = np.minimum(t/0.003, 1)
    fade_out = np.minimum((duration-t)/0.045, 1)
    x *= fade_in * np.maximum(fade_out, 0)**2
    target_rms = 10**((-30 if family == 'attrition' else -24)/20)
    x *= min(target_rms / max(np.sqrt(np.mean(x*x)), 1e-9), 10**(-10/20)/max(np.max(np.abs(x)), 1e-9))
    x[0] = x[-1] = 0
    return np.round(x*32767).astype(np.int16), seed

def main():
    masters, runtime = ROOT/'audio/masters', ROOT/'audio/runtime'
    masters.mkdir(parents=True, exist_ok=True)
    runtime.mkdir(parents=True, exist_ok=True)
    rows = []
    for family, (label, _, _) in FAMILIES.items():
        for essence in ([False, True] if family not in ('attrition', 'healing', 'cleanse', 'resonance') else [False]):
            for variant in range(1, 4):
                name = f'{family}-{"essence" if essence else "action"}-v01-{variant}'
                samples, seed = render(family, variant, essence)
                master, encoded = masters/f'{name}.wav', runtime/f'{name}.mp3'
                wavfile.write(master, RATE, samples)
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(master), '-map_metadata', '-1',
                                '-codec:a', 'libmp3lame', '-b:a', '96k', str(encoded)], check=True)
                peak = np.max(np.abs(samples.astype(float)))/32768
                assert peak <= 10**(-9.9/20)
                assert encoded.stat().st_size <= 20000
                rows.append(dict(id=f'audio.phase4.{name}', family=family, label=label,
                    role='essence' if essence else 'action', variant=variant, status='candidate', approvedBy=None,
                    sourceMethod='internal-material-synthesis', requestId='AUDIO-DISC-001', seed=str(seed),
                    master=str(master.relative_to(ROOT)), runtime=str(encoded.relative_to(ROOT)),
                    durationMs=round(len(samples)/RATE*1000), sampleRate=RATE, channels=1,
                    peakDbfs=round(20*np.log10(max(peak, 1e-9)), 2),
                    rmsDbfs=round(20*np.log10(max(np.sqrt(np.mean((samples.astype(float)/32768)**2)), 1e-9)), 2),
                    runtimeBytes=encoded.stat().st_size, masterSha256=hashlib.sha256(master.read_bytes()).hexdigest(),
                    runtimeSha256=hashlib.sha256(encoded.read_bytes()).hexdigest()))
    (ROOT/'audio-manifest.json').write_text(json.dumps(rows, indent=2)+'\n')
    print(json.dumps(dict(candidates=len(rows), runtimeBytes=sum(r['runtimeBytes'] for r in rows),
                         maxRuntimeBytes=max(r['runtimeBytes'] for r in rows), maxPeakDbfs=max(r['peakDbfs'] for r in rows))))

if __name__ == '__main__':
    main()
