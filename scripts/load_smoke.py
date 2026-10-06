"""Small synthetic local-load probe; never targets the public demo by default."""
import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import httpx
import numpy as np


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--base-url',default='http://127.0.0.1:8004');p.add_argument('--output',type=Path,default=Path('artifacts/load-smoke.json'));a=p.parse_args()
    if httpx.URL(a.base_url).host not in ('127.0.0.1','localhost'):
        p.error('This probe is restricted to a local test service')
    def once(_):
        start=time.perf_counter()
        with httpx.Client(base_url=a.base_url,timeout=30) as c:r=c.post('/api/analyze',json={'content':'Покупка на 3 500 ₸. Чек в приложении банка.'})
        return r.status_code,(time.perf_counter()-start)*1000
    started=time.perf_counter()
    with ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(once,range(40)))
    elapsed=time.perf_counter()-started
    out={'environment':'local managed execution environment','requests':40,'concurrency':8,'successful':sum(s==200 for s,_ in results),'status_counts':{str(s):sum(t==s for t,_ in results) for s,_ in results},'wall_seconds':round(elapsed,3),'p50_ms':round(float(np.percentile([t for _,t in results],50)),2),'p95_ms':round(float(np.percentile([t for _,t in results],95)),2),'requests_per_second':round(40/elapsed,2),'scope':'Synthetic warm API requests including client creation and database; not Render capacity or real-world model accuracy'}
    a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(out,indent=2)+'\n');print(out)
    assert out['successful']==40,'Unexpected errors under local test load'


if __name__=='__main__':main()
