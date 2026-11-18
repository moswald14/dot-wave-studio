"""Prepare the bundled recordings. Runtime playback needs no Python or network.
Build dependency: miniaudio 1.73. Source samples: tonejs-instruments, CC BY 3.0.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import array, base64, hashlib, json, math, re, sys, subprocess

ROOT = Path(__file__).resolve().parent
MEDIA = ROOT.parent / 'media-runtime'
sys.path.insert(0, str(MEDIA))
import miniaudio
RAW = ROOT.parent / 'instrument-research'
RAW.mkdir(exist_ok=True)
HEADERS = {'User-Agent': 'Dot-Wave-Studio-local-build'}
def fetch(url):
    return subprocess.run(['curl.exe', '--fail', '--location', '--silent', '--show-error', '--max-time', '60', url], check=True, capture_output=True).stdout
sha = json.loads(fetch('https://api.github.com/repos/nbrosowsky/tonejs-instruments/commits/master'))['sha']
base = f'https://raw.githubusercontent.com/nbrosowsky/tonejs-instruments/{sha}/'
mapping = fetch(base + 'Tonejs-Instruments.js').decode('utf-8')
configs = [
    ('piano', 'Grand piano', 0, [36, 48, 60, 72, 84], False, .35),
    ('guitar-acoustic', 'Acoustic guitar', 24, [43, 55, 67, 76], False, .25),
    ('bass-electric', 'Electric bass', 33, [28, 40, 52, 64], False, .20),
    ('violin', 'Violin', 40, [57, 69, 81, 88], True, .25),
    ('cello', 'Cello', 42, [36, 48, 60, 72], True, .28),
    ('flute', 'Flute', 73, [60, 72, 84, 96], True, .18),
    ('trumpet', 'Trumpet', 56, [55, 67, 79], True, .15),
    ('saxophone', 'Tenor sax', 66, [50, 62, 74], True, .18),
    ('harp', 'Harp', 46, [45, 57, 69, 81], False, .55),
    ('xylophone', 'Xylophone', 13, [60, 72, 84, 96], False, .18),
]
def midi(note):
    match = re.fullmatch(r'([A-G])(#?)(\d)', note)
    return (int(match[3]) + 1) * 12 + {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}[match[1]] + bool(match[2])

requests, bank = [], []
for folder, name, program, targets, sustain, release in configs:
    block = re.search(r"'" + re.escape(folder) + r"':\s*\{(.*?)\n\s*\}", mapping, re.S)[1]
    notes = [(midi(note), filename.replace('.[mp3|ogg]', '.mp3')) for note, filename in re.findall(r"'([^']+)':\s*'([^']+)'", block)]
    chosen = sorted({min(notes, key=lambda item: abs(item[0] - target)) for target in targets})
    item = {'id': 'real-' + folder, 'name': name, 'program': program, 'sustain': sustain, 'release': release, 'regions': []}
    bank.append(item)
    for root, filename in chosen:
        requests.append((item, folder, root, filename))

def prepare(request):
    item, folder, root, filename = request
    url = base + 'samples/' + folder + '/' + filename
    destination = RAW / (folder + '-' + filename)
    if not destination.exists(): destination.write_bytes(fetch(url))
    sound = miniaudio.decode_file(str(destination), output_format=miniaudio.SampleFormat.FLOAT32, nchannels=1, sample_rate=22050)
    pcm = sound.samples
    peak = max(abs(v) for v in pcm)
    assert peak > .0001, url
    # Remove only leading digital silence; keep the instrument's natural attack.
    first = next((i for i, value in enumerate(pcm) if abs(value) > peak * .001), 0)
    first = max(0, first - 110)
    pcm = pcm[first:first + 88200]
    gain = min(3, .83 / peak)
    result = array.array('h')
    for i, value in enumerate(pcm):
        edge = min(1, i / 44, (len(pcm) - 1 - i) / 882)
        result.append(round(max(-1, min(1, value * gain * edge)) * 32767))
    if sys.byteorder != 'little': result.byteswap()
    return item, {'root': root, 'rate': 22050, 'pcm': base64.b64encode(result.tobytes()).decode('ascii'), 'frames': len(result)}, {
        'instrument': item['name'], 'rootMidi': root, 'source': url, 'sourceSha256': hashlib.sha256(destination.read_bytes()).hexdigest(),
        'frames': len(result), 'rate': 22050, 'sourceLicense': 'CC BY 3.0'
    }

provenance = []
with ThreadPoolExecutor(max_workers=6) as pool:
    for item, region, record in pool.map(prepare, requests):
        item['regions'].append(region)
        provenance.append(record)
for item in bank: item['regions'].sort(key=lambda region: region['root'])
data = json.dumps(bank, separators=(',', ':'))
script = "(function(root){'use strict';const data=" + data + ";if(typeof module!=='undefined'&&module.exports)module.exports=data;else root.DotInstrumentData=data;})(typeof globalThis!=='undefined'?globalThis:this);\n"
(ROOT / 'dsp' / 'instrument-data.js').write_text(script, encoding='utf-8')
credits = ROOT / 'sample-credits'
credits.mkdir(exist_ok=True)
for name in ['LICENSE.md', 'sample-source-info.txt']:
    (credits / name).write_bytes(fetch(base + name))
(credits / 'SAMPLE-PROVENANCE.json').write_text(json.dumps({'commit': sha, 'source': 'https://github.com/nbrosowsky/tonejs-instruments', 'samples': provenance}, indent=2), encoding='utf-8')
(credits / 'README.txt').write_text('Instrument recordings from tonejs-instruments, curated and edited by Nicholaus P. Brosowsky. Samples licensed CC BY 3.0: https://creativecommons.org/licenses/by/3.0/\nSource: https://github.com/nbrosowsky/tonejs-instruments\nOriginal sources are listed in sample-source-info.txt. VSO2 recordings by Versilian Studios / Sam Gossner and contributors; guitar by University of Iowa Electronic Music Studios; electric bass and sax by Karoryfer; cello by Freesound user flcellogrl.\nChanges for Dot Wave Studio: selected pitch anchors, mono conversion, resampling to 22,050 Hz, leading digital silence trimmed, matched levels, four-second maximum tails and boundary fades. No sample-loader code from the upstream project is used.\n', encoding='utf-8')
print(json.dumps({'instruments': len(bank), 'recordings': len(provenance), 'dataBytes': len(script), 'commit': sha}))
