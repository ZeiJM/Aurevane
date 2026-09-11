"""Validate candidate provenance, encoded audio and static review structure; not human review."""
from pathlib import Path
from html.parser import HTMLParser
import hashlib
import json
import subprocess
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT/'content/media-candidates/phase4'

class PacketParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.ids = set(); self.cues = 0; self.families = 0; self.images = 0
    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f'Duplicate id: {attrs["id"]}'
            self.ids.add(attrs['id'])
        self.cues += 'data-cue' in attrs
        self.families += 'data-family' in attrs
        if tag == 'img':
            self.images += 1
            assert 'alt' in attrs
        for key in ('src', 'href'):
            value = attrs.get(key, '')
            assert not value.startswith(('http:', 'https:', '//')), 'Unexpected external dependency'

audio = json.loads((BASE/'audio-manifest.json').read_text())
art = json.loads((BASE/'art-manifest.json').read_text())
assert len(audio) == 72 and len(art) == 10
decoded = []
for entry in audio:
    assert entry['status'] == 'candidate' and entry['approvedBy'] is None
    for key in ('master', 'runtime'):
        path = BASE/entry[key]
        assert hashlib.sha256(path.read_bytes()).hexdigest() == entry[key+'Sha256']
    path = BASE/entry['runtime']
    assert path.stat().st_size <= 20000
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', '48000', '-'])
    samples = np.frombuffer(raw, dtype='<f4')
    peak = float(np.max(np.abs(samples)))
    duration = len(samples)/48000*1000
    assert np.isfinite(samples).all() and peak < 0.5, 'Encoded peak exceeded -6 dBFS'
    assert duration <= (600 if entry['role'] == 'essence' else 350)
    decoded.append(dict(id=entry['id'], durationMs=round(duration, 2), peakDbfs=round(20*np.log10(max(peak, 1e-9)), 2)))
for entry in art:
    assert entry['status'] == 'candidate' and entry['approvedBy'] is None
    assert hashlib.sha256((BASE/entry['master']).read_bytes()).hexdigest() == entry['masterSha256']
    assert len(entry['previews']) == 3
    for preview in entry['previews']:
        assert (BASE/preview['path']).stat().st_size == preview['bytes'] <= 40000
parser = PacketParser()
parser.feed((ROOT.parent/'phase4-media-review.html').read_text())
assert parser.cues == 72 and parser.families == 14 and parser.images == 21
assert {'filter','master','sfx','mute','stop','export','art-modal','audio-status'} <= parser.ids
report = dict(status='automated-checks-passed', humanArtApproval=False, humanListeningApproval=False,
    browserWalkthrough='blocked by browser local-file URL policy; not claimed',
    audioCandidates=72, artCandidates=10, audioRuntimeBytes=sum(e['runtimeBytes'] for e in audio),
    largestAudioRuntimeBytes=max(e['runtimeBytes'] for e in audio),
    largestArtRuntimeBytes=max(p['bytes'] for e in art for p in e['previews']),
    encodedPeakMaxDbfs=max(e['peakDbfs'] for e in decoded), encodedDurationMaxMs=max(e['durationMs'] for e in decoded),
    staticPacketChecks='72 cue buttons, 14 families, unique IDs, alt attributes, no external dependencies', audio=decoded)
(BASE/'validation.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='audio'}))
