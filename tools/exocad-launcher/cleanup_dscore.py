# -*- coding: utf-8 -*-
"""시험 중 남은 DS Core 임시 환자 지우기. 사용: python cleanup_dscore.py TMP-... DF-..."""
import sys, tempfile, shutil
from pathlib import Path
import dscore
ids = sys.argv[1:]
tmp = Path(tempfile.mkdtemp())
ds = dscore.DSCore(tmp, show=False, say=print)
try:
    ds.ensure_login()
    for cid in ids:
        display = cid.split("=",1)[1] if "=" in cid else (f"Case{cid[-7:]}, Demo" if cid.startswith("TMP-") else f"{cid}, DenFlow")
        cid = cid.split("=",1)[0]
        ds.delete_patient(cid, display)
finally:
    ds.close(); shutil.rmtree(tmp, ignore_errors=True)
