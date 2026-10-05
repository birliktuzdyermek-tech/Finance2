import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.main import create_app

CONFIG={'AUTH_SECRET':'test-only-secret-0123456789-abcdefgh',
        'RESEND_API_KEY':'test-only-key',
        'AUTH_EMAIL_FROM':'Qalqan <login@example.com>','RATE_LIMIT':'100','REQUIRE_POSTGRES':'false'}
CONTACTS={'email':'student@example.com','consent':True}


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.url='sqlite:///'+str(Path(self.tmp.name)/'app.db')
        self.env=patch.dict(os.environ,CONFIG)
        self.env.start()
        self.codes=[]
        self.sender=patch('backend.auth.deliver_code',side_effect=lambda email,mail:self.codes.append(mail))
        self.sender.start()
        self.client=TestClient(create_app(self.url))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None,None,None)
        self.sender.stop()
        self.env.stop()
        self.tmp.cleanup()

    def start(self,client=None):
        r=(client or self.client).post('/api/auth/start',json=CONTACTS)
        self.assertEqual(r.status_code,200,r.text)
        self.assertNotIn('code',r.json())
        return r.json()['challenge_id']

    def verify(self,challenge,client=None,mail=None):
        code=self.codes[-1]
        return (client or self.client).post('/api/auth/verify',json={'challenge_id':challenge,'email_code':mail or code})

    def test_email_code_cookie_rotation_cross_device_history_and_deletion(self):
        original=self.client.post('/api/analyze',json={'content':'Обычное сообщение'}).json()['id']
        previous=self.client.cookies.get('qalqan_session')
        challenge=self.start()
        result=self.verify(challenge)
        self.assertEqual(result.status_code,200)
        self.assertTrue(result.json()['authenticated'])
        self.assertNotEqual(previous,self.client.cookies.get('qalqan_session'))
        self.assertEqual(self.client.get('/api/history').json()['items'][0]['id'],original)
        self.assertEqual(self.verify(challenge).status_code,410)
        with TestClient(create_app(self.url)) as other:
            self.assertEqual(other.get('/api/history').json()['items'],[])
            self.assertEqual(self.verify(self.start(other),other).status_code,200)
            self.assertEqual(other.get('/api/history').json()['items'][0]['id'],original)
            self.assertEqual(other.delete('/api/auth/account').status_code,204)
        self.assertFalse(self.client.get('/api/auth/me').json()['authenticated'])
        self.assertEqual(self.client.get('/api/reports/'+original+'.pdf').status_code,404)

    def test_wrong_email_code_attempt_limit_persists(self):
        challenge=self.start()
        mail=self.codes[-1]
        wrong=f'{(int(mail)+1)%1000000:06d}'
        for n in range(5):
            self.assertEqual(self.verify(challenge,mail=wrong).status_code,429 if n==4 else 400)
        self.assertEqual(self.verify(challenge).status_code,429)
        self.assertFalse(self.client.get('/api/auth/me').json()['authenticated'])

    def test_challenge_is_bound_to_browser_and_expires(self):
        challenge=self.start()
        with TestClient(create_app(self.url)) as other:
            self.assertEqual(self.verify(challenge,other).status_code,410)
        with patch('backend.auth.time.time',return_value=time.time()+601):
            self.assertEqual(self.verify(challenge).status_code,410)

    def test_missing_providers_never_fake_delivery_and_consent_is_required(self):
        with patch.dict(os.environ,{'AUTH_SECRET':''}):
            self.assertFalse(self.client.get('/api/auth/me').json()['delivery_available'])
            self.assertEqual(self.client.post('/api/auth/start',json=CONTACTS).status_code,503)
        for payload in ({**CONTACTS,'consent':False},{**CONTACTS,'email':'invalid'},{**CONTACTS,'phone':'123'}):
            self.assertEqual(self.client.post('/api/auth/start',json=payload).status_code,422)
        self.assertEqual(self.codes,[])

    def test_codes_not_stored_or_exposed_and_hourly_delivery_is_limited(self):
        import sqlite3
        self.start()
        with sqlite3.connect(Path(self.tmp.name)/'app.db') as c:
            values=c.execute('SELECT email_hash FROM auth_challenges').fetchone()
        self.assertNotEqual(self.codes[-1],values[0])
        self.assertEqual(len(values[0]),64)
        self.start();self.start()
        self.assertEqual(self.client.post('/api/auth/start',json=CONTACTS).status_code,429)
        self.assertEqual(len(self.codes),3)

    def test_logout_revokes_cookie_and_preserves_account_data(self):
        self.verify(self.start())
        token=self.client.cookies.get('qalqan_session')
        self.client.post('/api/analyze',json={'content':'Обычное сообщение'})
        self.assertEqual(self.client.post('/api/auth/logout').status_code,204)
        self.client.cookies.set('qalqan_session',token)
        self.assertFalse(self.client.get('/api/auth/me').json()['authenticated'])
        self.assertEqual(self.client.get('/api/history').json()['items'],[])

    def test_normalized_email_reuses_same_account_without_phone(self):
        self.assertEqual(self.verify(self.start()).status_code,200)
        original=self.client.post('/api/analyze',json={'content':'Обычное сообщение'}).json()['id']
        self.client.post('/api/auth/logout')
        changed={**CONTACTS,'email':'STUDENT@example.com'}
        challenge=self.client.post('/api/auth/start',json=changed).json()['challenge_id']
        result=self.verify(challenge)
        self.assertEqual(result.status_code,200)
        self.assertNotIn('phone',result.json())
        self.assertEqual(self.client.get('/api/history').json()['items'][0]['id'],original)

    def test_provider_failure_cancels_challenge(self):
        from fastapi import HTTPException
        import sqlite3
        with patch('backend.auth.deliver_code',side_effect=HTTPException(502,'Delivery rejected')):
            self.assertEqual(self.client.post('/api/auth/start',json=CONTACTS).status_code,502)
        with sqlite3.connect(Path(self.tmp.name)/'app.db') as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM auth_challenges').fetchone()[0],0)

    def test_legacy_schema_migrates_preserving_account_and_session(self):
        import sqlite3
        from backend.auth import AuthService
        from backend.database import Database
        path=Path(self.tmp.name)/'legacy.db'
        db=Database('sqlite:///'+str(path));db.init()
        with sqlite3.connect(path) as c:
            c.execute('CREATE TABLE users (id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,phone TEXT NOT NULL UNIQUE,created_at BIGINT NOT NULL)')
            c.execute("INSERT INTO users VALUES ('legacy-user','legacy@example.com','+77012345678',1)")
            c.execute('CREATE TABLE auth_sessions (session_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires_at BIGINT NOT NULL)')
            c.execute("INSERT INTO auth_sessions VALUES ('legacy-session','legacy-user',?)",(int(time.time())+1000,))
            c.execute('CREATE TABLE auth_challenges (id TEXT PRIMARY KEY,session_id TEXT NOT NULL,email TEXT NOT NULL,phone TEXT NOT NULL,sms_hash TEXT NOT NULL,email_hash TEXT NOT NULL,expires_at BIGINT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0)')
            c.execute("INSERT INTO auth_challenges VALUES ('old-challenge','legacy-session','legacy@example.com','+77012345678','old-sms','old-email',?,0)",(int(time.time())+600,))
        auth=AuthService(db);auth.init();auth.init()
        self.assertEqual(auth.user('legacy-session'),{'id':'legacy-user','email':'legacy@example.com'})
        with sqlite3.connect(path) as c:
            for table in ('users','auth_challenges'):
                self.assertNotIn('phone',{r[1] for r in c.execute('PRAGMA table_info('+table+')')})
            self.assertEqual(c.execute('SELECT COUNT(*) FROM auth_challenges').fetchone()[0],0)

    def test_missing_email_code_cannot_authenticate(self):
        challenge=self.start()
        self.assertEqual(self.client.post('/api/auth/verify',json={'challenge_id':challenge}).status_code,422)
        self.assertEqual(self.client.post('/api/auth/verify',json={'challenge_id':challenge,'email_code':'１２３４５６'}).status_code,422)
        self.assertFalse(self.client.get('/api/auth/me').json()['authenticated'])

    def test_resend_delivery_uses_email_only_and_hides_provider_errors(self):
        self.sender.stop()
        import httpx
        from fastapi import HTTPException
        from backend.auth import deliver_code
        with patch('backend.auth.httpx.Client') as factory:
            client=factory.return_value.__enter__.return_value
            deliver_code('student@example.com','123456')
            client.post.assert_called_once()
            args,kwargs=client.post.call_args
            self.assertEqual(args,('https://api.resend.com/emails',))
            self.assertEqual(kwargs['json']['to'],['student@example.com'])
            self.assertIn('123456',kwargs['json']['text'])
            self.assertEqual(kwargs['headers']['Authorization'],'Bearer test-only-key')
            client.post.return_value.raise_for_status.side_effect=httpx.HTTPError('provider detail must remain private')
            with self.assertRaises(HTTPException) as error:deliver_code('student@example.com','123456')
            self.assertEqual(error.exception.status_code,502)
            self.assertNotIn('provider detail',error.exception.detail)
