"""Shared frozen-threshold evaluation and template-group bootstrap."""
import numpy as np
from sklearn.metrics import roc_auc_score


THRESHOLDS={'text_rules':.35,'url_rules':.35,'rules':.35,'ml':.5,'hybrid':.35}


def ablation_scores(results):
    return {'text_rules':[min(100,sum(s['weight'] for s in r['signals'] if s['source']=='text'))/100 for r in results],
            'url_rules':[min(100,sum(s['weight'] for s in r['signals'] if s['source']=='url'))/100 for r in results],
            'rules':[r['rules_score']/100 for r in results],
            'hybrid':[r['score']/100 for r in results]}


def quick_metrics(labels,scores,threshold):
    y=np.asarray(labels,dtype=bool);s=np.asarray(scores);p=s>=threshold
    tp=int(np.sum(y&p));fp=int(np.sum(~y&p));fn=int(np.sum(y&~p));tn=int(np.sum(~y&~p))
    return {'precision':tp/max(1,tp+fp),'recall':tp/max(1,tp+fn),'f1':2*tp/max(1,2*tp+fp+fn),
            'false_positive_rate':fp/max(1,fp+tn),
            'roc_auc':float(roc_auc_score(y,s)) if len(set(y))==2 else None}


def bootstrap(labels,groups,methods,samples=1000,seed=42):
    labels=np.asarray(labels);unique=sorted(set(groups));indices=[np.flatnonzero(np.asarray(groups)==g) for g in unique]
    rng=np.random.default_rng(seed)
    observed={method:{metric:[] for metric in ('precision','recall','f1','false_positive_rate','roc_auc')} for method in methods}
    for _ in range(samples):
        selected=np.concatenate([indices[i] for i in rng.integers(0,len(unique),len(unique))])
        # All-one-class bootstrap samples cannot estimate both class rates or AUC.
        if len(set(labels[selected]))<2:
            continue
        for method,scores in methods.items():
            values=quick_metrics(labels[selected],np.asarray(scores)[selected],THRESHOLDS[method])
            for metric,value in values.items():
                if value is not None: observed[method][metric].append(value)
    out={'method':'template_group_bootstrap','confidence':.95,'samples_requested':samples,'seed':seed,'groups':len(unique)}
    for method,measurements in observed.items():
        out[method]={name:{'low':round(float(np.quantile(values,.025)),4),'high':round(float(np.quantile(values,.975)),4),'valid_samples':len(values)} if values else None for name,values in measurements.items()}
    return out
