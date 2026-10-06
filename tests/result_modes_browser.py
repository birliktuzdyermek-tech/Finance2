"""Final-stage flow: presentation modes, per-record guidance, demo and privacy."""
import os
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def main():
    output = ROOT / 'artifacts'; output.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'), headless=True)
        context = browser.new_context(viewport={'width':1440, 'height':1000})
        page = context.new_page(); errors = []; requests = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.goto(os.getenv('TEST_BASE_URL','http://127.0.0.1:8000')+'/#demo', wait_until='networkidle')
        page.on('request', lambda req: requests.append((req.method, req.url, req.post_data)))
        context.set_offline(True)

        def route(view):
            page.evaluate('v => {location.hash=v}', view)
            expect(page.locator('#view-'+view)).to_be_visible()

        def analyze(text):
            route('analyzer')
            page.locator('[data-mode="single"]').click()
            page.locator('[data-channel="sms"]').click()
            page.locator('#content').fill(text)
            page.locator('#analyze-button').click()
            expect(page.locator('#view-result')).to_be_visible()

        # Connected demo uses the same real analyzer at every step.
        page.locator('#demo-start-scenario').click()
        for score in ('0', '40', '40', '85'):
            page.locator('#scenario-next').click()
            expect(page.locator('#scenario-score')).to_contain_text(score+' / 100')
        page.locator('#scenario-open').click()
        expect(page.locator('#risk-score')).to_have_text('85')
        expect(page.locator('#result-content')).to_have_attribute('data-detail','simple')
        expect(page.locator('#result-message mark').first).to_be_visible()
        expect(page.locator('#result-analyzer-version')).to_be_hidden()
        expect(page.locator('#signals .signal-weight').first).to_be_hidden()
        expect(page.locator('#action-selection-note')).to_contain_text('По умолчанию')
        page.screenshot(path=str(output/'result-simple.png'), full_page=True)
        page.locator('[data-result-mode="detailed"]').focus(); page.keyboard.press('Enter')
        expect(page.locator('#result-analyzer-version')).to_be_visible()
        expect(page.locator('#signals .signal-weight').first).to_be_visible()
        page.locator('[data-language="kk"]').click()
        expect(page.locator('[data-result-mode="detailed"]')).to_have_text('Толығырақ')
        expect(page.locator('#action-context')).to_contain_text('құпия')
        page.locator('[data-language="ru"]').click()
        page.locator('#result-whatif').click()
        original = page.locator('#whatif-input').input_value()
        replies = original.split('\n\n'); replies[-1] = 'Проверю через приложение банка.'
        page.locator('#whatif-input').fill('\n\n'.join(replies))
        page.locator('#whatif-check').click()
        expect(page.locator('#whatif-delta')).to_have_text('Балл: 85 → 40 (-45).')
        page.locator('#whatif-back').click()
        expect(page.locator('#risk-score')).to_have_text('85')
        route('demo'); page.locator('#demo-finish-safe').click()
        expect(page.locator('#risk-score')).to_have_text('0')

        # A low score never suppresses recovery steps. Choice belongs to this record.
        page.locator('[data-action="transferred"]').click()
        expect(page.locator('#action-context')).to_contain_text('независимо от балла')
        expect(page.locator('#action-steps')).to_contain_text('102')
        expect(page.locator('#action-steps')).to_contain_text('Возврат денег не гарантирован')
        page.locator('.action-sources summary').click()
        for link in page.locator('#action-sources a').all():
            assert link.get_attribute('href').startswith('https://www.gov.kz/')
            assert link.get_attribute('referrerpolicy') == 'no-referrer'
        analyze('Чек доступен в приложении банка.')
        expect(page.locator('[data-action="received"]')).to_have_attribute('aria-pressed','true')
        route('history')
        page.locator('#history-list .history-open').nth(1).click()
        expect(page.locator('[data-action="transferred"]')).to_have_attribute('aria-pressed','true')
        page.locator('[data-language="kk"]').click()
        expect(page.locator('#action-steps')).to_contain_text('кепіл жоқ')
        page.locator('[data-language="ru"]').click()
        page.locator('[data-result-mode="simple"]').click()
        page.locator('#preview-report').click()
        expect(page.locator('#report-paper')).to_contain_text('Перевёл деньги')
        expect(page.locator('#report-paper')).to_contain_text('102')
        page.locator('#close-report').click()
        page.emulate_media(media='print')
        expect(page.locator('#result-analyzer-version')).to_be_visible()
        expect(page.locator('#result-analysis-limit')).to_be_visible()
        expect(page.locator('#action-steps')).to_be_visible()
        page.pdf(path=str(output/'result-incident.pdf'), format='A4', print_background=True)
        page.emulate_media(media='screen')

        # Actual evidence survives simple mode, including hostile and mixed text.
        hostile = '<img src=x onerror="window.qalqanInjected=1"> Срочно! Карта заблокирована. SMS кодты жіберіңіз. http://kaspi.kz.verify.example'
        analyze(hostile)
        expect(page.locator('#result-message .marked-message')).to_have_text(hostile)
        expect(page.locator('#result-message img')).to_have_count(0)
        assert page.evaluate('typeof window.qalqanInjected') == 'undefined'
        assert page.locator('#signals .signal-row:visible').count() == 3
        expect(page.locator('#result-more-signals')).to_be_visible()
        page.locator('#result-more-signals').click()
        expect(page.locator('[data-result-mode="detailed"]')).to_be_focused()
        expect(page.locator('#url-results')).to_be_visible()
        assert page.locator('#signals .signal-row:visible').count() > 3
        page.screenshot(path=str(output/'result-detailed.png'), full_page=True)
        page.locator('[data-result-mode="simple"]').click()
        page.locator('#result-projector').click()
        expect(page.locator('body')).to_have_class('projector-mode')
        page.keyboard.press('Escape')
        for width in (1024,390):
            page.set_viewport_size({'width':width,'height':900})
            for language in ('kk','ru'):
                page.locator(f'[data-language="{language}"]').click()
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
            page.screenshot(path=str(output/f'result-{width}.png'), full_page=True)
        page.set_viewport_size({'width':1440,'height':1000})
        route('history')
        page.once('dialog', lambda dialog: dialog.accept())
        page.locator('#clear-history').click()
        route('result')
        expect(page.locator('#result-empty')).to_be_visible()
        expect(page.locator('#result-content')).to_have_attribute('data-detail','simple')
        expect(page.locator('[data-action="received"]')).to_have_attribute('aria-pressed','true')
        # Chromium may retry the favicon on fragment navigation, even offline.
        assert all(method == 'GET' and urlsplit(url).path == '/static/shield.svg'
                   and not urlsplit(url).query and body is None
                   for method, url, body in requests), requests
        assert not errors, errors
        assert page.evaluate('Object.keys(localStorage).length+Object.keys(sessionStorage).length') == 0
        context.close(); browser.close()
    print('Result modes passed: real demo 0/40/40/85 -> 40 -> 0, keyboard, RU/KK, per-record actions, low-score recovery, detailed print, XSS, responsive, projector, deletion and no analysis data sent offline (static favicon requests only).')


if __name__ == '__main__':
    main()
