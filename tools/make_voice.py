"""Record Tekis's cute robo-cat voice lines into audio/voice/*.mp3.

Finds every line Tekis speaks in the game files, voices it with Microsoft's "Ana" cartoon neural voice,
adds a robot effect, and writes js/voice-manifest.js so the game knows which clips exist.

    python -m pip install --user edge-tts imageio-ffmpeg   (once)
    python tools/make_voice.py                             (needs internet; only new/changed lines are recorded)
    python tools/make_voice.py --force                     (re-record everything, e.g. after changing the voice settings)

The game itself plays the clips offline.
"""
import argparse
import asyncio
import re
import subprocess
import sys
from pathlib import Path

import edge_tts
import imageio_ffmpeg
import numpy as np
from scipy.signal import lfilter

ROOT = Path(__file__).resolve().parent.parent
JS = ROOT / 'js'
OUT_DIR = ROOT / 'audio' / 'voice'
MANIFEST = JS / 'voice-manifest.js'
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()

# Voice settings
TTS_VOICE = 'en-US-AnaNeural'   # Microsoft's "cartoon, cute" child voice
TTS_RATE = '+6%'
TTS_PITCH = '+30Hz'
SR = 24000
RING_HZ = 55          # robot buzz frequency
RING_MIX = 0.35       # 0 = no buzz, 1 = full ring modulation
COMB_MS = 3.5         # metallic "inside a robot" resonance
COMB_FEEDBACK = 0.45
ROBOT_MIX = 0.6       # blend of robot effect vs. the plain cute voice

SPOKEN = {'AI': 'A.I.', 'IOT': 'I.O.T.', 'QR': 'Q.R.', 'WASD': 'W, A, S, D', 'CO2': 'C.O.2',
          'Q-DAY': 'Q day', 'TECHIS': 'Tech I.S.', 'TEKIS': 'Tekis', 'CONVERGEIT': 'Converge I.T.'}
STRING = re.compile(r"'((?:\\.|[^'\\\n])*)'|\"((?:\\.|[^\"\\\n])*)\"|`((?:\\.|[^`\\])*)`")


def voice_key(text):
    """FNV-1a over UTF-16 code units; must match voiceKey() in js/voice.js."""
    h = 0x811C9DC5
    raw = text.encode('utf-16-le')
    for i in range(0, len(raw), 2):
        h = ((h ^ int.from_bytes(raw[i:i + 2], 'little')) * 0x01000193) & 0xFFFFFFFF
    return f'{h:08x}'


def read_org():
    block = re.search(r'const ORG = \{(.*?)\n\};', (JS / 'config.js').read_text(encoding='utf-8'), re.S).group(1)
    return dict(re.findall(r"(\w+):\s*'((?:\\.|[^'\\])*)'", block))


def strings_in(block, org):
    out = []
    for m in STRING.finditer(block):
        s = next(g for g in m.groups() if g is not None)
        s = s.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\')
        s = re.sub(r'\$\{ORG\.(\w+)\}', lambda k: org[k.group(1)], s)
        if '${' in s:
            sys.exit(f'Cannot voice a line with a dynamic value: {s}')
        out.append(s)
    return out


def collect_lines():
    org = read_org()
    lines = []
    for f in sorted((JS / 'games').glob('*.js')):
        for block in re.findall(r'tekis:\s*\[(.*?)\n\s*\],', f.read_text(encoding='utf-8'), re.S):
            lines += strings_in(block, org)
    scenes = (JS / 'scenes.js').read_text(encoding='utf-8')
    for name in ('ORG_PAGES', 'TEKIS_WIN', 'TEKIS_LOSE'):
        lines += strings_in(re.search(rf'const {name} = \[(.*?)\];', scenes, re.S).group(1), org)
    voice = (JS / 'voice.js').read_text(encoding='utf-8')
    lines += strings_in(re.search(r'const TEKIS_SAYS = \{(.*?)\n\};', voice, re.S).group(1), org)
    return list(dict.fromkeys(lines))


def speakable(text):
    s = re.sub(r'♥|>_<|\^_\^|~', ' ', text)
    s = re.sub(r"[A-Z0-9][A-Z0-9'-]*", lambda m: SPOKEN.get(m.group(0), m.group(0).lower()), s)
    s = re.sub(r'\bnya+\b', 'nya!', s)
    s = re.sub(r'!+', '!', re.sub(r'\s+', ' ', s)).strip()
    if not re.search(r'nya\w*[\s!?.,]*$', s):
        s = re.sub(r'[\s!?.,]*$', '', s) + ', nya!'
    return s


def robotize(x):
    t = np.arange(len(x)) / SR
    ring = x * ((1 - RING_MIX) + RING_MIX * np.sin(2 * np.pi * RING_HZ * t))
    d = int(SR * COMB_MS / 1000)
    a = np.zeros(d + 1)
    a[0], a[d] = 1, -COMB_FEEDBACK
    comb = lfilter([1 - COMB_FEEDBACK], a, ring)
    y = (1 - ROBOT_MIX) * x + ROBOT_MIX * comb
    y = np.concatenate([np.zeros(int(SR * 0.03)), y, np.zeros(int(SR * 0.08))])
    return (y / (np.max(np.abs(y)) + 1e-9) * 0.9).astype(np.float32)


async def record(text, path):
    tmp = path.with_suffix('.raw.mp3')
    await edge_tts.Communicate(speakable(text), TTS_VOICE, rate=TTS_RATE, pitch=TTS_PITCH).save(str(tmp))
    pcm = subprocess.run([FFMPEG, '-v', 'error', '-i', str(tmp), '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    tmp.unlink()
    y = robotize(np.frombuffer(pcm, dtype=np.float32))
    subprocess.run([FFMPEG, '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '1', '-i', '-',
                    '-codec:a', 'libmp3lame', '-b:a', '64k', str(path)], input=y.tobytes(), check=True)


async def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--force', action='store_true', help='re-record every line')
    args = parser.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    lines = collect_lines()
    keys = {}
    for i, text in enumerate(lines, 1):
        key = voice_key(text)
        keys[key] = text
        path = OUT_DIR / f'{key}.mp3'
        if path.exists() and not args.force:
            continue
        print(f'[{i}/{len(lines)}] {speakable(text)}')
        await record(text, path)

    for old in OUT_DIR.glob('*.mp3'):
        if old.stem not in keys:
            old.unlink()
            print(f'removed unused clip {old.name}')

    entries = ''.join(f"  '{k}',  // {keys[k][:60]}\n" for k in keys)
    MANIFEST.write_text("'use strict';\n\n/* Generated by tools/make_voice.py - do not edit. */\n"
                        f'const VOICE_CLIPS = new Set([\n{entries}]);\n', encoding='utf-8')
    print(f'\n{len(keys)} voice lines ready in {OUT_DIR.relative_to(ROOT)}')


if __name__ == '__main__':
    asyncio.run(main())
