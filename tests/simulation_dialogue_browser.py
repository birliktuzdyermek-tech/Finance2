"""Branch isolation, local URL learning and decision-map regressions on the real site."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE=os.getenv('TEST_BASE_URL','http://127.0.0.1:8773').rstrip('/')


def main():
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'),headless=True,
                                  args=['--enable-unsafe-swiftshader'])
        context=browser.new_context(viewport={'width':1440,'height':1100})
        page=context.new_page();errors=[];requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/#simulator',wait_until='networkidle');cookies=context.cookies()
        page.on('request',lambda r:requests.append((r.method,r.url,r.post_data)))
        context.set_offline(True)
        def action(name):page.locator(f'[data-sim-action="{name}"]').click()
        def story(name):page.locator(f'[data-story="{name}"]').click()
        def simulator():
            page.evaluate('location.hash="simulator"')
            expect(page.locator('#view-simulator')).to_be_visible()
        def inspect(part):
            action('inspect_link');expect(page.locator('#sim-inspector-title')).to_be_focused()
            expect(page.locator('#sim-check-link')).to_be_disabled()
            page.locator(f'[data-url-part="{part}"]').focus();page.keyboard.press('Enter')
            expect(page.locator(f'[data-url-part="{part}"]')).to_have_attribute('aria-pressed','true')
            page.locator('#sim-check-link').click()
            expect(page.locator('#sim-inspection-feedback')).to_be_focused()

        # Save the initial message, then follow a branch and require a fresh analysis.
        action('open_phone');action('analyze');page.locator('#sim-report').click();simulator()
        action('verify_sender')
        expect(page.locator('#sim-analysis')).to_be_hidden()
        expect(page.locator('#sim-analysis-stale')).to_be_visible()
        expect(page.locator('.sim-transcript .sim-message')).to_have_count(2)
        expect(page.locator('.sim-transcript')).to_contain_text('сообщите SMS-код')
        expect(page.locator('.sim-transcript')).not_to_contain_text('Осталось 5 минут')
        source=page.locator('.sim-transcript').locator('[data-user-text]').all_text_contents()
        page.locator('[data-language="kk"]').click()
        assert page.locator('.sim-transcript [data-user-text]').all_text_contents()==source
        action('analyze')
        expect(page.locator('#sim-analysis .marked-message')).to_have_count(2)
        expect(page.locator('#sim-analysis')).not_to_contain_text('Осталось 5 минут')
        expect(page.locator('#sim-analysis')).not_to_contain_text('Как проверить, кто вы?')
        expected=page.evaluate('QalqanEngine.analyzeDialogue(QalqanSimulationEngine.stories[0].message+"\\n\\n"+QalqanSimulationLessons.dialogues["blocked-card"].identity.text,"sms")')
        assert page.locator('#sim-analysis .evidence-list q').all_text_contents()==[
            m['text'] for reply in expected['replies'] for signal in reply['signals'] for m in signal['matches']]
        page.locator('#sim-report').click()
        history=page.evaluate('QalqanStore.request("history").items.map(r=>({text:r.text,mode:r.mode,incident:r.incident}))')
        assert len(history)==2 and history[0]['mode']=='dialogue'
        assert 'сообщите SMS-код' in history[0]['text'] and 'сообщите SMS-код' not in history[1]['text']
        simulator();page.locator('[data-language="ru"]').click()

        # A wrong URL answer is instructional feedback, not a risk score or link opening.
        score=page.locator('.sim-score').inner_text();inspect('prefix')
        expect(page.locator('#sim-inspection-feedback')).to_have_attribute('data-correct','false')
        expect(page.locator('#sim-inspection-feedback')).to_contain_text('поддомен')
        expect(page.locator('#sim-inspector a')).to_have_count(0)
        expect(page.locator('#sim-inspector input')).to_have_count(0)
        expect(page.locator('.sim-score')).to_have_text(score)
        page.locator('[data-language="kk"]').click()
        expect(page.locator('#sim-inspection-feedback')).to_contain_text('қосалқы домен')
        expect(page.locator('[data-url-part="prefix"]')).to_have_attribute('aria-pressed','true')
        expect(page.locator('#sim-check-link')).to_be_disabled()
        action('doubt_sender');action('analyze');action('contact')
        expect(page.locator('#sim-decision-map')).to_be_visible()
        page.locator('#sim-show-map').click();expect(page.locator('#sim-map-title')).to_be_focused()
        expect(page.locator('#sim-map-title')).to_have_text('Шешімдеріңіз картасы')
        names=page.locator('#sim-map-list>li').evaluate_all('nodes=>nodes.map(n=>n.dataset.decision)')
        assert names==['open_phone','analyze','verify_sender','analyze','inspect_link','check_link','doubt_sender','analyze','contact']
        assert 'ask_reason' not in names and 'open_link' not in names
        page.locator('#sim-map-list [data-decision="check_link"] summary').click()
        expect(page.locator('#sim-map-list [data-decision="check_link"]')).to_contain_text('Бұл — мекенжайдың басқа бөлігі')
        expect(page.locator('.sim-incident')).to_contain_text('Тек хабарлама алдым')
        # Changing UI language keeps the chosen incoming messages, including map quotations.
        page.locator('#sim-map-list [data-decision="verify_sender"] summary').focus();page.keyboard.press('Enter')
        expect(page.locator('#sim-map-list [data-decision="verify_sender"] .sim-map-reply')).to_contain_text('сообщите SMS-код')
        page.screenshot(path=str(ROOT/'artifacts/dialogue-map-kk.png'),full_page=True)

        # A distinct branch leads to time pressure and a transfer. Correct URL choice is not authentication.
        story('safe-transfer');expect(page.locator('#sim-inspector')).to_be_hidden();expect(page.locator('#sim-decision-map')).to_be_hidden()
        page.locator('[data-language="ru"]').click();action('open_phone');action('ask_reason');action('ask_time')
        expect(page.locator('.sim-transcript')).to_contain_text('Осталось 5 минут')
        expect(page.locator('.sim-transcript')).not_to_contain_text('4821')
        inspect('domain');expect(page.locator('#sim-inspection-feedback')).to_have_attribute('data-correct','true')
        expect(page.locator('#sim-inspector')).to_contain_text('подлинность сайта здесь не проверяется')
        action('open_link');action('transfer_demo');action('analyze')
        expect(page.locator('#sim-map-list [data-decision="open_link"]')).to_contain_text('Открыл ссылку')
        expect(page.locator('#sim-map-list [data-decision="transfer_demo"]')).to_contain_text('Перевёл деньги')
        page.locator('#sim-map-list [data-decision="transfer_demo"] summary').click()
        expect(page.locator('#sim-map-list [data-decision="transfer_demo"]')).to_contain_text('Реальные деньги не списывались')
        page.locator('[data-language="kk"]').click()
        for width in [1024,390]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        page.screenshot(path=str(ROOT/'artifacts/dialogue-map-mobile.png'),full_page=True)
        page.set_viewport_size({'width':1440,'height':1100})

        # Benign dialogue remains zero and has no link exercise. No unvisited risky endings in map.
        story('ordinary-receipt');action('open_phone');action('ask_reason');action('ask_time');action('analyze')
        expect(page.locator('.sim-score')).to_have_text('0 / 100')
        expect(page.locator('#sim-analysis mark')).to_have_count(0)
        expect(page.locator('[data-sim-action="inspect_link"]')).to_have_count(0)
        action('ignore');expect(page.locator('#sim-map-list [data-decision="transfer_demo"]')).to_have_count(0)
        expect(page.locator('#sim-map-list [data-decision="ask_reason"]')).to_contain_text('ақпараттық реплика')

        # Leaving a task unfinished is not marked incorrect or complete; reset clears everything.
        story('blocked-card');action('open_phone');action('inspect_link');action('ignore')
        expect(page.locator('#sim-decision-map')).to_contain_text('жауап тексерілмеді')
        expect(page.locator('#sim-map-list [data-decision="check_link"]')).to_have_count(0)
        expect(page.locator('#sim-check-link')).to_be_disabled()
        page.locator('#sim-decision-map button').click()
        expect(page.locator('#view-simulator')).to_have_attribute('data-phase','notification')
        expect(page.locator('#sim-inspector')).to_be_hidden();expect(page.locator('#sim-decision-map')).to_be_hidden()
        action('open_phone');action('verify_sender');action('inspect_link')
        page.on('dialog',lambda d:d.accept());page.evaluate('location.hash="history"')
        expect(page.locator('#view-history')).to_be_visible();page.locator('#clear-history').click();simulator()
        expect(page.locator('#view-simulator')).to_have_attribute('data-phase','notification')
        expect(page.locator('#sim-inspector')).to_be_hidden();expect(page.locator('#sim-decision-map')).to_be_hidden()
        assert page.evaluate('localStorage.length+sessionStorage.length')==0
        assert context.cookies()==cookies
        assert all(m=='GET' and u==BASE+'/static/shield.svg' and b is None for m,u,b in requests),requests
        assert errors==[],errors
        context.close()

        # Literal markup in an incoming reply stays text in transcript, evidence and map, even without 3D.
        safe=browser.new_context(viewport={'width':390,'height':844})
        safe.add_init_script('''const original=HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext=function(type,...args){return type.startsWith('webgl')?null:original.call(this,type,...args)};''')
        page=safe.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        payload='<img src=x onerror=window.__simXss=1>'
        def replace_reply(route):
            response=route.fetch()
            route.fulfill(response=response,body=response.text().replace('Я из службы безопасности банка.',payload))
        page.route('**/static/simulation-lessons.js?*',replace_reply)
        page.goto(BASE+'/#simulator',wait_until='networkidle');safe.set_offline(True)
        expect(page.locator('#sim-fallback')).to_be_visible()
        action('open_phone');action('verify_sender');expect(page.locator('.sim-transcript')).to_contain_text(payload)
        action('analyze');expect(page.locator('#sim-analysis')).to_contain_text(payload)
        inspect('domain');action('contact')
        page.locator('#sim-map-list [data-decision="verify_sender"] summary').click()
        expect(page.locator('#sim-decision-map')).to_contain_text(payload)
        expect(page.locator('#view-simulator img')).to_have_count(0)
        assert page.evaluate('window.__simXss===undefined')
        assert errors==[],errors
        browser.close()
    print('Dialogue lab passed: chosen branches only, stale-result invalidation, exact dialogue evidence, saved snapshots, domain quiz, chronological map, benign case, RU/KK, keyboard, mobile, resets, fallback, XSS and offline privacy.')


if __name__=='__main__':main()
