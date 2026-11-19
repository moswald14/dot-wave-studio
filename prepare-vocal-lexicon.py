"""Regenerate the offline pronunciation lookup from pinned CMUdict data.

Normal Studio builds use the checked-in module and need no network access.
"""
from pathlib import Path
import hashlib
import json
import re
import urllib.request
import argparse

ROOT = Path(__file__).resolve().parent
REVISION = "74790861f652b15e4ac49015a90074ad62a27690"
BASE = f"https://raw.githubusercontent.com/cmusphinx/cmudict/{REVISION}/"


def fetch(name, source=None):
    if source:
        return (source / name).read_bytes()
    with urllib.request.urlopen(BASE + name, timeout=30) as response:
        return response.read()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, help="Use a previously downloaded copy of the pinned source")
    args = parser.parse_args()
    raw, license_text = fetch("cmudict.dict", args.source_dir), fetch("LICENSE", args.source_dir)
    if hashlib.sha256(raw).hexdigest() != "81917843c7f44ce2b094ac63873c2c7a4cf802040792c455ba3ca406891c3d22":
        raise ValueError("The dictionary does not match the pinned CMUdict source.")
    words = {}
    for line in raw.decode("utf-8").splitlines():
        fields = line.split(" #", 1)[0].split()
        if len(fields) < 2 or not re.fullmatch(r"[a-z]+(?:'[a-z]+)?", fields[0]):
            continue
        codes = [re.sub(r"[012]$", "", code) for code in fields[1:]]
        if len(codes) <= 32:
            words.setdefault(fields[0], " ".join(codes))
    packed = "\n".join(word + " " + words[word] for word in sorted(words))
    module = """/* CMUdict pronunciations. See vocal-credits for provenance.
LICENSE_TEXT
*/
(function(root){
  'use strict';
  const data=PACKED;
  let words;
  const api={count:COUNT,lookup(word){
    if(!words){words=new Map();for(const line of data.split('\\n')){const at=line.indexOf(' ');words.set(line.slice(0,at),line.slice(at+1));}}
    return words.get(word.toLowerCase());
  }};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DotVocalLexicon=api;
})(typeof globalThis!=='undefined'?globalThis:this);
""".replace("PACKED", json.dumps(packed, ensure_ascii=True)).replace("COUNT", str(len(words))).replace("LICENSE_TEXT", license_text.decode("utf-8"))
    (ROOT / "dsp/vocal-lexicon.js").write_text(module, encoding="utf-8", newline="\n")
    credits = ROOT / "vocal-credits"
    credits.mkdir(exist_ok=True)
    (credits / "CMUdict-LICENSE.txt").write_bytes(license_text)
    manifest = {"source": "https://github.com/cmusphinx/cmudict", "revision": REVISION,
                "dictionarySha256": hashlib.sha256(raw).hexdigest(), "words": len(words),
                "transformation": "First standard spelling; remove stress digits; omit entries over 32 phones. No audio or model weights."}
    (credits / "source.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"words": len(words), "sourceSha256": manifest["dictionarySha256"]}))


if __name__ == "__main__":
    main()
