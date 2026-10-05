import concurrent.futures
import os
import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.database import Database
from backend.main import create_app


class WorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.url = 'sqlite:///' + str(Path(self.tmp.name) / 'app.db')
        self.env = patch.dict(os.environ, {'RATE_LIMIT':'30','REQUIRE_POSTGRES':'false','AUTH_SECRET':''})
        self.env.start()
        self.client = TestClient(create_app(self.url))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None,None,None)
        self.env.stop()
        self.tmp.cleanup()

    def test_batch_validation_and_session_isolation(self):
        payload={'items':[{'content':'Срочно! Введите CVV карты.'},{'content':'Покупка на 3 500 ₸.'},{'content':'https://kaspi.kz.verify.example','channel':'url'}]}
        r=self.client.post('/api/analyze/batch',json=payload)
        self.assertEqual(r.status_code,200)
        items=r.json()['items']
        self.assertEqual(len(items),3)
        self.assertEqual(len({i['id'] for i in items}),3)
        self.assertIsNone(items[-1]['ml_score'])
        self.assertEqual(self.client.get('/api/dashboard').json()['channels'],{'sms':2,'email':0,'whatsapp':0,'url':1})
        with TestClient(create_app(self.url)) as other:
            self.assertEqual(other.get('/api/history').json()['items'],[])
            self.assertEqual(other.get('/api/reports/'+items[0]['id']+'.pdf').status_code,404)
        for entries in ([],[{'content':'ok'}],[{'content':'valid'}]*11,[{'content':'valid'},{'content':'   '}]):
            self.assertEqual(self.client.post('/api/analyze/batch',json={'items':entries}).status_code,422)
        self.assertEqual(len(self.client.get('/api/history').json()['items']),3)

    def test_batch_charges_each_item_and_shares_quota_across_apps(self):
        with patch.dict(os.environ,{'RATE_LIMIT':'4'}):
            with TestClient(create_app(self.url)) as first, TestClient(create_app(self.url)) as second:
                self.assertEqual(first.post('/api/analyze/batch',json={'items':[{'content':'Обычное сообщение'}]*3}).status_code,200)
                first.cookies.clear()
                self.assertEqual(second.post('/api/analyze',json={'content':'Обычное сообщение'}).status_code,200)
                denied=first.post('/api/analyze/batch',json={'items':[{'content':'Обычное сообщение'}]})
                self.assertEqual(denied.status_code,429)
                self.assertIn('retry-after',denied.headers)
                self.assertEqual(len(second.get('/api/history').json()['items']),1)

    def test_atomic_quota_with_concurrent_database_instances(self):
        databases=[Database(self.url),Database(self.url)]
        for db in databases: db.init()
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
            results=list(executor.map(lambda i:databases[i%2].reserve('same-peer',5,cost=2,now=12020)[0],range(20)))
        self.assertEqual(sum(results),2)
        self.assertEqual(databases[0].reserve('same-peer',5,now=12020),(True,40))
        self.assertFalse(databases[1].reserve('same-peer',5,now=12020)[0])
        self.assertTrue(databases[1].reserve('same-peer',5,now=12060)[0])

    def test_batch_write_rolls_back_on_failure(self):
        db=Database(self.url)
        now=datetime.now(timezone.utc)
        result={'id':'duplicate','created_at':now.isoformat(),'expires_before':(now-timedelta(days=7)).isoformat()}
        with self.assertRaises(sqlite3.IntegrityError): db.save_many('own',[result,result])
        self.assertEqual(db.history('own'),[])

    def test_expired_history_and_pdf_are_inaccessible(self):
        item=self.client.post('/api/analyze',json={'content':'Обычное сообщение'}).json()
        with sqlite3.connect(Path(self.tmp.name)/'app.db') as c:
            c.execute('UPDATE checks SET created_at=?',((datetime.now(timezone.utc)-timedelta(days=8)).isoformat(),))
        self.assertEqual(self.client.get('/api/history').json()['items'],[])
        self.assertEqual(self.client.get('/api/reports/'+item['id']+'.pdf').status_code,404)
