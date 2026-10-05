"""Browser registration against a real local server with mocked delivery only."""
import os
import tempfile
import threading
import time
from pathlib import Path
from unittest.mock import patch

import uvicorn
from playwright.sync_api import sync_playwright, expect
from backend.main import create_app
from tests.test_auth import CONFIG


def main():
    codes=[]
    with tempfile.TemporaryDirectory() as d,patch.dict(os.environ,{**CONFIG,'RENDER':'false','COOKIE_SECURE':'false','PUBLIC_ORIGIN':'','RENDER_EXTERNAL_URL':''}),patch('backend.auth.deliver_codes',side_effect=lambda p,e,s,m:codes.append((s,m))):
        server=uvicorn.Server(uvicorn.Config(create_app('sqlite:///'+str(Path(d)/'auth.db')),host='127.0.0.1',port=8005,log_level='error',proxy_headers=False))
        thread=threading.Thread(target=server.run,daemon=True);thread.start()
        end=time.monotonic()+10
        while not server.started and time.monotonic()<end: time.sleep(.05)
        assert server.started
        try:
            with sync_playwright() as p:
                browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'),headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
                context=browser.new_context(viewport={'width':390,'height':844});page=context.new_page();errors=[]
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.goto('http://127.0.0.1:8005/#account',wait_until='networkidle')
                expect(page.locator('#account-send')).to_be_enabled()
                page.locator('#account-phone').fill('+7 (701) 234-56-78');page.locator('#account-email').fill('student@example.com');page.locator('#account-consent').check();page.locator('#account-send').click()
                expect(page.locator('#account-verify')).to_be_visible()
                assert len(codes)==1
                page.locator('#sms-code').fill(codes[0][0]);page.locator('#email-code').fill(codes[0][1]);page.locator('#account-confirm').click()
                expect(page.locator('#account-member')).to_be_visible();expect(page.locator('#account-link')).to_have_text('Мой аккаунт')
                assert page.evaluate('document.documentElement.scrollWidth<=window.innerWidth')
                page.locator('#account-logout').click()
                expect(page.locator('#account-start')).to_be_visible();expect(page.locator('#account-link')).to_have_text('Войти')
                assert not errors, errors
                context.close();browser.close()
        finally:
            server.should_exit=True;thread.join(timeout=10)
    print('Registration browser passed: mobile, two mocked delivery codes, verification and logout. No real SMS/email was sent.')


if __name__=='__main__':main()
