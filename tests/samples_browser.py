"""Analyzer examples through the real UI: buttons follow the mode and language, and each one gives its intended index."""
import json
import os
import subprocess
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv('TEST_BASE_URL', 'http://127.0.0.1:8773')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXPECTED = {'sms-parcel': 73, 'sms-bonus': 62, 'sms-otp': 0, 'wa-relative': 18, 'wa-prize': 60, 'wa-kk': 95, 'email-invoice': 45, 'email-job': 50,
            'email-news': 0, 'url-short': 28, 'url-ip': 35, 'url-user': 30, 'url-ok': 0, 'dlg-bank': 63, 'dlg-safe': 53, 'dlg-relative': 18,
            'dlg-market': 62, 'dlg-normal': 0, 'dlg-quote': 63}


def main():
    samples = json.loads(subprocess.check_output(['node', '-e', "console.log(JSON.stringify(require('./frontend/samples.js').list))"], cwd=ROOT))
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'), headless=True, args=['--enable-unsafe-swiftshader'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
        page = context.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + '/#analyzer', wait_until='networkidle')
        single = [s for s in samples if s['mode'] == 'single']; dialogue = [s for s in samples if s['mode'] == 'dialogue']
        visible = lambda: page.locator('.samples button:visible')
        # Single mode: the three original buttons plus the new single examples; no dialogue examples.
        expect(visible()).to_have_count(3 + len(single))
        for s in dialogue:
            expect(page.locator(f'[data-sample="{s["key"]}"]')).to_be_hidden()
        context.set_offline(True)
        for s in single:
            page.locator(f'[data-sample="{s["key"]}"]').click()
            assert page.locator('#content').input_value() == s['text']
            page.locator('#analyze-button').click()
            expect(page.locator('#risk-score')).to_have_text(str(EXPECTED[s['key']]))
            page.locator('[data-view="analyzer"]').click()
        # Dialogue mode shows only dialogue examples; the link channel is unavailable there.
        page.locator('[data-mode="dialogue"]').click()
        expect(visible()).to_have_count(len(dialogue))
        for s in dialogue:
            page.locator(f'[data-sample="{s["key"]}"]').click()
            assert page.locator('#content').input_value() == s['text']
            page.locator('#analyze-button').click()
            expect(page.locator('#risk-score')).to_have_text(str(EXPECTED[s['key']]))
            expect(page.locator('#result-message .evidence-card')).to_have_count(s['text'].count('\n\n') + 1)
            page.locator('[data-view="analyzer"]').click()
        # Kazakh labels and tooltips; back to single mode restores the single examples.
        page.locator('[data-language="kk"]').click()
        first = dialogue[0]
        expect(page.locator(f'[data-sample="{first["key"]}"]')).to_have_text(first['label']['kk'] + ' ↗')
        assert page.locator(f'[data-sample="{first["key"]}"]').get_attribute('title') == first['hint']['kk']
        page.locator('[data-mode="single"]').click()
        expect(visible()).to_have_count(3 + len(single))
        page.locator('[data-language="ru"]').click()
        expect(page.locator(f'[data-sample="{single[0]["key"]}"]')).to_have_text(single[0]['label']['ru'] + ' ↗')
        # Phone width: the example row wraps without horizontal scroll.
        page.set_viewport_size({'width': 390, 'height': 900})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        assert page.evaluate('localStorage.length + sessionStorage.length') == 0
        assert not errors, errors
        browser.close()
    print('Examples passed: 19 new examples, mode-aware buttons, intended indices, KK labels, 390px and no storage.')


if __name__ == '__main__':
    main()
