"""Stage 1: real analyzer, causal scenario playback and zero content transmission."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def main():
    output = ROOT / 'artifacts'; output.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'), headless=True)
        context = browser.new_context(viewport={'width':1440, 'height':1000})
        page = context.new_page(); errors = []; requests = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(os.getenv('TEST_BASE_URL','http://127.0.0.1:8773')+'/#scenarios', wait_until='networkidle')
        expect(page.locator('#view-scenarios')).to_be_visible()
        requests.clear()
        page.on('request', lambda req: requests.append((req.method, req.url, req.post_data)))
        context.set_offline(True)
        expect(page.locator('#scenario-select option')).to_have_count(7)
        expect(page.locator('#scenario-score')).to_have_text('—')
        expect(page.locator('#scenario-previous')).to_be_disabled()
        for step, score in [(1,0),(2,40),(3,40),(4,85)]:
            page.locator('#scenario-next').click()
            expect(page.locator('#scenario-position')).to_have_text(f'Шаг {step} / 4')
            expect(page.locator('#scenario-score')).to_have_text(f'{score} / 100')
            expect(page.locator('#scenario-transcript .scenario-turn')).to_have_count(step)
        expect(page.locator('#scenario-new-signals')).to_contain_text('Запрос секретных данных')
        expect(page.locator('#scenario-new-signals')).to_contain_text('+45')
        expect(page.locator('#scenario-next')).to_be_disabled()
        page.locator('#scenario-previous').click()
        expect(page.locator('#scenario-score')).to_have_text('40 / 100')
        expect(page.locator('#scenario-transcript')).not_to_contain_text('Введите код')
        expect(page.locator('#scenario-journal button')).to_have_count(3)
        page.locator('#scenario-journal [data-step="2"]').click()
        expect(page.locator('#scenario-position')).to_have_text('Шаг 2 / 4')
        page.locator('#scenario-open').click()
        expect(page.locator('#view-result')).to_be_visible()
        expect(page.locator('#risk-score')).to_have_text('40')
        expect(page.locator('#result-message .evidence-card')).to_have_count(2)
        page.locator('[data-view="history"]').click()
        expect(page.locator('#history-list tbody tr')).to_have_count(1)
        page.locator('[data-view="scenarios"]').click()
        expect(page.locator('#scenario-position')).to_have_text('Шаг 2 / 4')
        page.locator('#scenario-reset').click()
        expect(page.locator('#scenario-score')).to_have_text('—')
        expect(page.locator('#scenario-journal button')).to_have_count(0)
        page.locator('#scenario-play').click()
        expect(page.locator('#scenario-position')).to_have_text('Шаг 1 / 4')
        page.locator('#scenario-play').click()
        page.wait_for_timeout(2600)
        expect(page.locator('#scenario-position')).to_have_text('Шаг 1 / 4')
        page.locator('#scenario-play').click()
        page.locator('[data-view="history"]').click()
        page.wait_for_timeout(2600)
        page.locator('[data-view="scenarios"]').click()
        expect(page.locator('#scenario-position')).to_have_text('Шаг 1 / 4')
        for scenario, count, score in [('code-request',4,63),('safe-account',4,53),('domain-switch',4,80),('friend-transfer',4,18),('bank-notice',3,0),('security-warning',3,63)]:
            page.locator('#scenario-select').select_option(scenario)
            expect(page.locator('#scenario-score')).to_have_text('—')
            for _ in range(count): page.locator('#scenario-next').click()
            expect(page.locator('#scenario-score')).to_have_text(f'{score} / 100')
        page.locator('#scenario-author').evaluate('(el) => { el.open = true; }')
        expect(page.locator('#scenario-author-note')).to_contain_text('ложная тревога')
        originals = page.locator('#scenario-transcript .marked-message').all_text_contents()
        page.locator('[data-language="kk"]').click()
        expect(page.locator('#scenario-next')).to_have_text('Келесі реплика →')
        expect(page.locator('#scenario-position')).to_have_text('Қадам 3 / 3')
        expect(page.locator('#scenario-author-note')).to_contain_text('жалған дабыл')
        assert page.locator('#scenario-transcript .marked-message').all_text_contents() == originals
        expect(page.locator('#scenario-score')).to_have_text('63 / 100')
        page.locator('[data-language="ru"]').click()
        page.locator('#scenario-select').select_option('bank-message')
        page.locator('#scenario-next').focus(); page.keyboard.press('Enter')
        expect(page.locator('#scenario-position')).to_have_text('Шаг 1 / 4')
        page.locator('#scenario-next').click()
        page.screenshot(path=str(output/'scenarios-desktop.png'), full_page=True)
        page.locator('#scenario-projector').click()
        expect(page.locator('body')).to_have_class('projector-mode')
        page.keyboard.press('Escape')
        expect(page.locator('#projector-exit')).to_be_hidden()
        page.set_viewport_size({'width':390, 'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(output/'scenarios-mobile.png'), full_page=True)
        assert page.evaluate('localStorage.length') == 0
        assert page.evaluate('sessionStorage.length') == 0
        assert not errors, errors
        assert all(method == 'GET' and '/static/shield.svg' in url and body is None for method,url,body in requests), requests
        context.set_offline(False)
        page.reload(wait_until='networkidle')
        expect(page.locator('#scenario-position')).to_have_text('Шаг 0 / 4')
        browser.close()
    print('Scenario browser passed: seven real analyses, prefix isolation, pause, rewind/reset, history handoff, RU/KK, keyboard, projector, 390px, offline and no data transmission.')


if __name__ == '__main__':
    main()
