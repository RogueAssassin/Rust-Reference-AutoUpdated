#!/usr/bin/env python3
import hashlib,json,os,shutil,tempfile,urllib.request
from datetime import datetime,timezone
from pathlib import Path
BASE="https://api.carbonmod.gg/meta/rust/"
NAMES=("blueprints","items","entities","prefabs","convars","commands")
ROOT=Path(__file__).resolve().parents[1]; CURRENT=ROOT/"data"/"current"; HISTORY=ROOT/"data"/"history"
CURRENT.mkdir(parents=True,exist_ok=True); HISTORY.mkdir(parents=True,exist_ok=True)
now=datetime.now(timezone.utc); stamp=now.strftime("%Y-%m-%dT%H-%M-%SZ"); changed=[]; meta={"updated_at":now.isoformat(),"source":"Carbon Rust metadata API","datasets":{}}
def count(v): return len(v) if isinstance(v,(list,dict)) else 1
for name in NAMES:
    req=urllib.request.Request(BASE+name+".json",headers={"User-Agent":"Rust-Reference-AutoUpdated/1.0"})
    with urllib.request.urlopen(req,timeout=60) as r: raw=r.read()
    if not raw: raise RuntimeError(f"{name}: empty response")
    obj=json.loads(raw)
    if not isinstance(obj,(list,dict)) or count(obj)==0: raise RuntimeError(f"{name}: unexpected/empty JSON")
    normalized=(json.dumps(obj,ensure_ascii=False,separators=(",",":"))+"\n").encode()
    digest=hashlib.sha256(normalized).hexdigest(); dest=CURRENT/f"{name}.json"
    old=dest.read_bytes() if dest.exists() else None
    if old!=normalized:
        if old is not None:
            hist=HISTORY/stamp; hist.mkdir(parents=True,exist_ok=True); (hist/f"{name}.json").write_bytes(old)
        dest.write_bytes(normalized); changed.append(name)
    meta["datasets"][name]={"count":count(obj),"sha256":digest,"source":BASE+name+".json","changed":name in changed}
meta["changed_datasets"]=changed
(ROOT/"data"/"metadata.json").write_text(json.dumps(meta,indent=2)+"\n",encoding="utf-8")
print("Updated:",", ".join(changed) if changed else "metadata only")