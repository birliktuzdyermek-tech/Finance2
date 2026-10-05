import os
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient
from backend.main import create_app

CONFIG={'AUTH_SECRET':'test-only-secret-0123456789-abcdefgh',
        'TWILIO_ACCOUNT_SID':'AC'+'0'*32,'TWILIO_AUTH_TOKEN':'test-only-token',
        'TWILIO_FROM_NUMBER':'+15555550123','RESEND_API_KEY':'test-only-key',
        'AUTH_EMAIL_FROM':'Qalqan <login@example.com>','RATE_LIMIT':'100','REQUIRE_POSTGRES':'false'}
CONTACTS={'email':'student@example.com','phone':'+7 (701) 234-56-78','consent':True}


class AuthTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.url='sqlite:///'+str(Path(self.tmp.name)/'app.db')
        self.env=patch.dict(os.environ,CONFIG)
        self.env.start()
        self.codes=[]
        self.sender=patch('backend.auth.deliver_codes',side_effect=lambda phone,email,sms,mail:self.codes.append((sms,mail)))
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

    def verify(self,challenge,client=None,sms=None,mail=None):
        pair=self.codes[-1]
        return (client or self.client).post('/api/auth/verify',json={'challenge_id':challenge,'sms_code':sms or pair[0],'email_code':mail or pair[1]})

    def test_dual_codes_cookie_rotation_cross_device_history_and_deletion(self):
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

    def test_both_codes_required_attempt_limit_persists(self):
        challenge=self.start()
        sms,mail=self.codes[-1]
        wrong=f'{(int(mail)+1)%1000000:06d}'
        for n in range(5):
            self.assertEqual(self.verify(challenge,sms=sms,mail=wrong).status_code,429 if n==4 else 400)
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
            values=c.execute('SELECT sms_hash,email_hash FROM auth_challenges').fetchone()
        for code,stored in zip(self.codes[-1],values):
            self.assertNotEqual(code,stored)
            self.assertEqual(len(stored),64)
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

    def test_changed_contact_pair_does_not_replace_an_account(self):
        self.assertEqual(self.verify(self.start()).status_code,200)
        changed={**CONTACTS,'phone':'+77012345679'}
        challenge=self.client.post('/api/auth/start',json=changed).json()['challenge_id']
        self.assertEqual(self.verify(challenge).status_code,409)
        self.assertTrue(self.client.get('/api/auth/me').json()['authenticated'])

    def test_provider_failure_cancels_challenge(self):
        from fastapi import HTTPException
        import sqlite3
        with patch('backend.auth.deliver_codes',side_effect=HTTPException(502,'Delivery rejected')):
            self.assertEqual(self.client.post('/api/auth/start',json=CONTACTS).status_code,502)
        with sqlite3.connect(Path(self.tmp.name)/'app.db') as c:
            self.assertEqual(c.execute('SELECT COUNT(*) FROM auth_challenges').fetchone()[0],0)
