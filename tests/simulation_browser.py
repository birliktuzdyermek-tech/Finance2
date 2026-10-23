"""Real WebGL, all three stories, offline privacy, report snapshots and graceful fallback."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
BASE=os.getenv('TEST_BASE_URL','http://127.0.0.1:8773')


def main():
    output=ROOT/'artifacts';output.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'),headless=True,
                                  args=['--enable-unsafe-swiftshader'])
        context=browser.new_context(viewport={'width':1440,'height':1100},reduced_motion='reduce')
        page=context.new_page();errors=[];requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/#home',wait_until='networkidle')
        original_cookies=context.cookies()
        # WebGL is created only on entry, and entry does not create a history record.
        assert page.locator('#sim-canvas').get_attribute('data-render') is None
        page.locator('.sim-home-entry a').click()
        expect(page.locator('#sim-canvas')).to_have_attribute('data-render','webgl')
        expect(page.locator('#sim-canvas')).to_have_attribute('data-active','true')
        assert page.evaluate('QalqanStore.request("history").items.length')==0
        expect(page.locator('#sim-analysis')).to_be_hidden()
        page.on('request',lambda r:requests.append((r.method,r.url,r.post_data)))
        context.set_offline(True)
        canvas=page.locator('#sim-canvas')
        # Camera controls must change actual rendered pixels; keyboard Home restores the view.
        before=canvas.screenshot()
        page.locator('[data-sim-camera="left"]').click()
        assert canvas.screenshot()!=before
        canvas.focus();page.keyboard.press('Home')
        assert canvas.screenshot()==before
        rect=canvas.bounding_box();page.mouse.move(rect['x']+100,rect['y']+160)
        page.mouse.down();page.mouse.move(rect['x']+180,rect['y']+160);page.mouse.up()
        assert canvas.screenshot()!=before
        page.locator('[data-sim-camera="reset"]').click()
        page.screenshot(path=str(output/'simulation-desktop.png'),full_page=True)

        # Card story: keyboard phone access, unchanged mixed-language source, exact evidence.
        page.locator('#sim-hotspot').focus();page.keyboard.press('Enter')
        expect(page.locator('#sim-phone-title')).to_be_focused()
        original=page.locator('.sim-message').inner_text()
        page.locator('[data-sim-action="analyze"]').click()
        expect(page.locator('#sim-analysis-title')).to_be_focused()
        expected=page.evaluate('QalqanEngine.analyze(QalqanSimulationEngine.stories[0].message,"sms")')
        expect(page.locator('.sim-score')).to_have_text(f'{expected["score"]} / 100')
        expect(page.locator('#sim-analysis .marked-message')).to_have_text(original)
        shown=page.locator('#sim-analysis .evidence-list q').all_text_contents()
        assert shown==[m['text'] for s in expected['signals'] for m in s['matches']]
        page.locator('[data-language="kk"]').click()
        expect(page.locator('#view-simulator h1')).to_have_text('Алдымен ойланыңыз. Содан кейін әрекет етіңіз.')
        expect(page.locator('.sim-message')).to_have_text(original)
        expect(page.locator('#sim-journal li')).to_have_count(2)
        page.screenshot(path=str(output/'simulation-kazakh.png'),full_page=True)
        page.locator('[data-language="ru"]').click()
        page.locator('#sim-report').click()
        expect(page.locator('#view-result')).to_be_visible()
        assert page.evaluate('QalqanStore.request("history").items[0].incident')=='received'
        page.evaluate('location.hash="simulator"')
        expect(canvas).to_have_attribute('data-active','true')
        page.locator('[data-sim-action="open_link"]').click()
        expect(page.locator('.sim-address')).to_have_text('https://kaspi.kz.verify.example/confirm')
        expect(page.locator('#sim-phone-body input')).to_have_count(0)
        expect(page.locator('#sim-phone-body a')).to_have_count(0)
        page.locator('[data-sim-action="send_demo"]').click()
        expect(page.locator('#sim-phone-title')).to_be_focused()
        expect(page.locator('.sim-incident')).to_contain_text('Ввёл данные')
        expect(page.locator('#sim-review')).to_contain_text('Сразу свяжитесь с банком')
        expect(page.locator('#sim-review')).to_contain_text('Пояснение автора сюжета')
        # Saving after a changed incident creates a new snapshot; the former is untouched.
        page.locator('#sim-report').click()
        incidents=page.evaluate('QalqanStore.request("history").items.map(i=>i.incident)')
        assert incidents==['entered','received'],incidents
        page.evaluate('location.hash="simulator"')
        expect(canvas).to_have_attribute('data-active','true')

        # Money story: no analysis before the explicit check, then actual rules score.
        page.locator('[data-story="safe-transfer"]').click()
        expect(page.locator('[data-story="safe-transfer"]')).to_be_focused()
        expect(page.locator('#sim-analysis')).to_be_hidden()
        expect(page.locator('#sim-journal-card')).to_be_hidden()
        page.locator('[data-sim-action="open_phone"]').click()
        page.locator('[data-sim-action="open_link"]').click()
        page.locator('[data-sim-action="transfer_demo"]').click()
        expect(page.locator('.sim-incident')).to_contain_text('Перевёл деньги')
        expect(page.locator('#sim-review')).to_contain_text('Возврат денег не гарантирован')
        page.locator('[data-sim-action="analyze"]').click()
        expect(page.locator('.sim-score')).to_have_text('53 / 100')

        # Ordinary receipt stays ordinary; there is no risky page action or fabricated evidence.
        page.locator('[data-story="ordinary-receipt"]').click()
        page.locator('[data-sim-action="open_phone"]').click()
        expect(page.locator('[data-sim-action="open_link"]')).to_have_count(0)
        page.locator('[data-sim-action="analyze"]').click()
        expect(page.locator('.sim-score')).to_have_text('0 / 100')
        expect(page.locator('#sim-analysis mark')).to_have_count(0)
        expect(page.locator('#sim-analysis')).to_contain_text('не подтверждает подлинность')
        page.locator('[data-sim-action="ignore"]').click()
        expect(page.locator('.sim-incident')).to_contain_text('Только получил сообщение')
        expect(page.locator('#sim-review')).to_contain_text('обычное уведомление')

        # Mobile and tablet remain operable without horizontal scroll, including Kazakh.
        page.locator('[data-language="kk"]').click()
        for width in [1024,390]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
        page.screenshot(path=str(output/'simulation-mobile-outcome.png'),full_page=True)
        page.locator('[data-story="blocked-card"]').click()
        page.screenshot(path=str(output/'simulation-mobile.png'),full_page=True)
        page.set_viewport_size({'width':1440,'height':1100})
        page.locator('[data-language="ru"]').click()
        page.locator('[data-sim-action="open_phone"]').click()
        page.locator('[data-sim-action="open_link"]').click()
        page.locator('[data-sim-action="contact"]').click()
        expect(page.locator('.sim-incident')).to_contain_text('Открыл ссылку')
        expect(page.locator('#sim-phone-body')).to_contain_text('не доказывает взлом')
        # Context loss and restoration preserve choices and keep accessible controls usable.
        page.evaluate('window.lostContext=document.getElementById("sim-canvas").getContext("webgl").getExtension("WEBGL_lose_context");lostContext.loseContext()')
        expect(page.locator('#sim-fallback')).to_be_visible()
        expect(page.locator('[data-sim-camera="left"]')).to_be_disabled()
        expect(page.locator('.sim-incident')).to_contain_text('Открыл ссылку')
        page.evaluate('lostContext.restoreContext()')
        expect(canvas).to_have_attribute('data-render','webgl')
        expect(page.locator('#sim-fallback')).to_be_hidden()
        # Clearing history also clears the current simulation journal.
        page.evaluate('location.hash="history"');expect(canvas).to_have_attribute('data-active','false')
        page.on('dialog',lambda d:d.accept())
        page.locator('#clear-history').click()
        page.evaluate('location.hash="simulator"')
        expect(page.locator('#view-simulator')).to_have_attribute('data-phase','notification')
        expect(page.locator('#sim-journal-card')).to_be_hidden()
        # The clear button also resets an unsaved attempt when general history is empty.
        page.locator('[data-sim-action="open_phone"]').click()
        page.evaluate('location.hash="history"');expect(page.locator('#view-history')).to_be_visible()
        page.locator('#clear-history').click()
        page.evaluate('location.hash="simulator"')
        expect(page.locator('#view-simulator')).to_have_attribute('data-phase','notification')
        expect(page.locator('#sim-journal-card')).to_be_hidden()
        assert page.evaluate('localStorage.length+sessionStorage.length')==0
        assert context.cookies()==original_cookies  # Existing anonymous session cookie is unchanged.
        assert all(method=='GET' and url==BASE+'/static/shield.svg' and body is None
                   for method,url,body in requests),requests  # Browser may retry the favicon offline.
        assert errors==[],errors
        context.close()

        # Devices without WebGL get the complete phone experience, never a blank canvas.
        fallback=browser.new_context(viewport={'width':390,'height':844})
        fallback.add_init_script('''const original=HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext=function(type,...args){
            return type.startsWith('webgl')?null:original.call(this,type,...args);
          };''')
        page=fallback.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(BASE+'/#simulator',wait_until='networkidle');fallback.set_offline(True)
        expect(page.locator('#sim-fallback')).to_be_visible()
        page.locator('#sim-hotspot').click();page.locator('[data-sim-action="open_link"]').click()
        page.locator('[data-sim-action="send_demo"]').click();page.locator('[data-sim-action="analyze"]').click()
        expect(page.locator('.sim-score')).to_have_text('100 / 100')
        expect(page.locator('.sim-incident')).to_contain_text('Ввёл данные')
        page.screenshot(path=str(output/'simulation-fallback.png'),full_page=True)
        assert errors==[],errors
        browser.close()
    print('Simulation: WebGL, camera, keyboard, three stories, RU/KK, reports, responsive layout, fallback, context restoration and offline privacy passed.')


if __name__=='__main__':main()
