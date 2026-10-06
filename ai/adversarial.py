"""Authored robustness probes, separate from a blind or real-world benchmark."""
import json
from ai.model import ROOT
from backend.analyzer import analyze

CASES=[
    ('direct_secret','Введите CVV карты немедленно.',1,'plain'),
    ('spaced_secret','В в е д и т е C V V к а р т ы.',1,'spaces'),
    ('mixed_script','Ввeдите CVV кaрты нeмедленно.',1,'homoglyph_text'),
    ('leetspeak','Vved1te C V V karty.',1,'leetspeak_text'),
    ('typo_domain','https://kasp1.kz/login',1,'url_leetspeak'),
    ('unicode_domain','https://kаspi.kz/login',1,'url_homoglyph'),
    ('brand_subdomain','https://egov.kz.verify.example/benefit',1,'url_subdomain'),
    ('trusted_reference','https://egov.kz/',0,'reference_domain'),
    ('warning','Никогда не сообщайте CVV и код из SMS другим людям.',0,'negation'),
    ('normal_notice','Покупка на 3 500 ₸. Чек в приложении.',0,'notification'),
]


def main():
    cases=[]
    for uid,text,label,kind in CASES:
        r=analyze(text,'url' if text.startswith('http') else 'sms')
        cases.append({'id':uid,'kind':kind,'expected':label,'score':r['score'],'predicted':int(r['score']>=35),'correct':(r['score']>=35)==bool(label),'signals':[s['code'] for s in r['signals']]})
    out={'dataset':'authored_robustness_probes','threshold':35,'cases':cases,'passed':sum(c['correct'] for c in cases),'total':len(cases),'limitations':'These probes reveal failures and do not estimate real-world accuracy. No tuning on an independent test.'}
    (ROOT/'ai/evaluation/adversarial.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
    print('Robustness probes:',out['passed'],'/',out['total'],'correct; failures retained in report')


if __name__=='__main__': main()
