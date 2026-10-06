from contextlib import closing
import json
import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.analyzer import inspect_url, analyze
from ai.benchmark import bootstrap
from ai.evaluate_external import evaluate


class ResearchFeatureTests(unittest.TestCase):
    def test_brand_homoglyphs_and_malformed_punycode(self):
        for url in ('https://freed0m.example','https://eg0v.example','https://kаspi.kz','https://airastanna.example'):
            self.assertIn('impersonation',[s['code'] for s in inspect_url(url)['signals']],url)
        self.assertIn('homoglyph',[s['code'] for s in inspect_url('https://kаspi.kz')['signals']])
        self.assertIsInstance(inspect_url('https://xn--a.example'),dict)
        self.assertFalse(inspect_url('https://egov.kz.fake.example')['official'])

    def test_scheme_is_tentative_and_does_not_change_risk(self):
        self.assertEqual(analyze('Срочно! Введите CVV для получения приза.')['scheme']['code'],'prize')
        self.assertEqual(analyze('Покупка на 3500 тенге.')['scheme']['code'],'unknown')

    def test_feedback_requires_consent_and_owner_without_source_text(self):
        with tempfile.TemporaryDirectory() as d:
            app=create_app('sqlite:///'+str(Path(d)/'app.db'))
            with TestClient(app) as owner,TestClient(app) as foreign:
                item=owner.post('/api/analyze',json={'content':'Срочно! Введите CVV private-value-432876.'}).json()
                path='/api/checks/'+item['id']+'/feedback'
                self.assertEqual(owner.post(path,json={'vote':'correct','consent':False}).status_code,422)
                self.assertEqual(foreign.post(path,json={'vote':'incorrect','consent':True}).status_code,404)
                self.assertEqual(owner.post(path,json={'vote':'correct','consent':True}).status_code,200)
                import sqlite3
                with closing(sqlite3.connect(Path(d)/'app.db')) as c, c:
                    features=c.execute('SELECT features FROM feedback').fetchone()[0]
                    self.assertNotIn('private-value',features)
                    self.assertNotIn('content',json.loads(features))
                owner.delete('/api/history')
                with closing(sqlite3.connect(Path(d)/'app.db')) as c, c:
                    self.assertEqual(c.execute('SELECT COUNT(*) FROM feedback').fetchone()[0],0)

    def test_bootstrap_resamples_groups_and_external_empty_template_rejected(self):
        r=bootstrap([0,0,1,1],['negative','negative','positive','positive'],{'hybrid':[0,0,1,1]},samples=50)
        self.assertEqual(r['groups'],2)
        self.assertLess(r['hybrid']['precision']['valid_samples'],50)
        self.assertEqual(r['hybrid']['precision']['low'],1)
        with self.assertRaises(ValueError):evaluate(Path('ai/dataset/blind-template.csv'))
