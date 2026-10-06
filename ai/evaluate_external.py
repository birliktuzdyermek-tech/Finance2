"""Evaluate an independently collected CSV without fitting or changing thresholds."""
import argparse
import csv
import hashlib
import json
from pathlib import Path

from ai.model import rows, train
from ai.evaluate import metrics
from ai.benchmark import ablation_scores, bootstrap
from backend.analyzer import analyze


def evaluate(path):
    with path.open(encoding='utf-8-sig',newline='') as f:
        data=list(csv.DictReader(f))
    if not data or any(not all(k in r for k in ('id','group','language','label','text','source','consent')) for r in data):
        raise ValueError('CSV must contain id,group,language,label,text,source,consent and data rows')
    if {r['label'] for r in data}!={'0','1'}:
        raise ValueError('Independent test must contain both labels 0 and 1')
    if any(r['consent']!='yes' or not r['group'] or not r['source'] or r['language'] not in ('ru','kz','en') or not 3<=len(r['text'].strip())<=10000 for r in data):
        raise ValueError('Check consent, source, groups, language and redacted message lengths')
    known={r['text'].strip().casefold() for r in rows()}
    texts=[r['text'].strip().casefold() for r in data]
    if known.intersection(texts) or len(texts)!=len(set(texts)) or len({r['id'] for r in data})!=len(data):
        raise ValueError('Duplicate IDs/texts or overlap with the development corpus is forbidden')
    model=train([r for r in rows() if r['split']=='train'])
    results=[analyze(r['text'],model=model) for r in data]
    scores=ablation_scores(results);scores['ml']=model.predict_proba([r['text'] for r in data])[:,1]
    y=[int(r['label']) for r in data]
    out={'status':'evaluated','dataset':'collector_declared_independent','dataset_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
         'rows':len(data),'groups':len({r['group'] for r in data}),
         'collection_warning':'Independence and redaction require collector review. No script can prove blind collection.',
         'methods':{key:metrics(y,value,.5 if key=='ml' else .35) for key,value in scores.items()},
         'bootstrap':bootstrap(y,[r['group'] for r in data],scores)}
    return out


def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('csv',type=Path);p.add_argument('--output',type=Path,default=Path('artifacts/external-evaluation.json'));args=p.parse_args()
    try: result=evaluate(args.csv)
    except (ValueError,KeyError,OSError): p.exit(1,'External evaluation rejected. Check the collection protocol and CSV fields; source messages were not printed.\n')
    args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print('External evaluation saved:',args.output)


if __name__=='__main__': main()
