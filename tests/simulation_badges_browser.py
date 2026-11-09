"""Simulator 3.0 badges through the real UI: earned from what happened, tab memory only, RU/KK."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv('TEST_BASE_URL', 'http://127.0.0.1:8773')
IDS = ['blocked-card', 'safe-transfer', 'ordinary-receipt', 'qr-parking', 'relative-transfer', 'bank-call', 'marketplace-prepay', 'fake-job']


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'), headless=True, args=['--enable-unsafe-swiftshader'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
        page = context.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + '/#simulator', wait_until='networkidle')
        expect(page.locator('.sim-badge')).to_have_count(6)
        expect(page.locator('.sim-badge.earned')).to_have_count(0)
        expect(page.locator('.sim-badges-count')).to_contain_text('0 / 6')
        expect(page.locator('.sim-badges-count')).to_contain_text('0 / 8')
        expect(page.locator('.sim-badges-note')).to_contain_text('не оценивают вашу защищённость')

        # A careful path: check first, find the domain, contact the bank yourself.
        page.locator('#sim-hotspot').click()
        page.locator('[data-sim-action="analyze"]').click()
        page.locator('[data-sim-action="inspect_link"]').click()
        page.locator('[data-url-part="domain"]').click(); page.locator('#sim-check-link').click()
        expect(page.locator('.sim-badge-note')).to_have_count(0)
        page.locator('[data-sim-action="contact"]').click()
        note = page.locator('.sim-badge-note'); expect(note).to_be_visible(); expect(note).to_have_attribute('role', 'status')
        for badge in ('stop', 'domain', 'calm', 'selfcall', 'verify'):
            expect(page.locator(f'[data-badge="{badge}"]')).to_have_class(__import__('re').compile(r'\bearned\b'))
        expect(page.locator('[data-badge="all"]')).not_to_have_class(__import__('re').compile(r'\bearned\b'))
        expect(page.locator('.sim-badges-count')).to_contain_text('5 / 6'); expect(page.locator('.sim-badges-count')).to_contain_text('1 / 8')
        assert 'Не поддался давлению' in page.locator('[data-badge="calm"]').get_attribute('aria-label')

        # Replaying does not announce the same badges again, and a risky ending earns nothing new.
        page.locator('.sim-actions .text-button').first.click()
        expect(page.locator('.sim-badge-note')).to_have_count(0)
        page.locator('#sim-hotspot').click(); page.locator('[data-sim-action="open_link"]').click(); page.locator('[data-sim-action="send_demo"]').click()
        expect(page.locator('.sim-badge-note')).to_have_count(0)
        expect(page.locator('.sim-badges-count')).to_contain_text('5 / 6')

        # Finishing every story earns the last badge, with any ending.
        for story_id in IDS[1:]:
            page.locator(f'[data-story="{story_id}"]').click(); page.locator('#sim-hotspot').click(); page.locator('[data-sim-action="ignore"]').click()
        expect(page.locator('[data-badge="all"]')).to_have_class(__import__('re').compile(r'\bearned\b'))
        expect(page.locator('.sim-badges-count')).to_contain_text('6 / 6'); expect(page.locator('.sim-badges-count')).to_contain_text('8 / 8')
        expect(page.locator('.sim-badge-note')).to_contain_text('Все сюжеты')

        # Kazakh labels; nothing in browser storage.
        page.locator('[data-language="kk"]').click()
        expect(page.locator('.sim-badges-count')).to_contain_text('Белгішелер')
        expect(page.locator('[data-badge="stop"] .sim-badge-name')).to_have_text('Алғашқы тоқтау')
        page.locator('[data-language="ru"]').click()
        assert page.evaluate('localStorage.length + sessionStorage.length') == 0

        # Badges live in tab memory: a reload starts again.
        page.reload(wait_until='networkidle')
        expect(page.locator('.sim-badge.earned')).to_have_count(0)
        expect(page.locator('.sim-badges-count')).to_contain_text('0 / 6')
        assert not errors, errors
        browser.close()
    print('Simulator badges passed: earned from the path, no repeats, all stories, KK, tab memory only.')


if __name__ == '__main__':
    main()
