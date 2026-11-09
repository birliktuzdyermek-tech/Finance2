"""Simulator 3.0: all five new stories played through the real UI, RU/KK and a phone-width layout."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv('TEST_BASE_URL', 'http://127.0.0.1:8773')
# id, expected index, has page, direct demo action, minutes on the learning timer (0 = none)
STORIES = [('qr-parking', 28, True, None, 10), ('relative-transfer', 18, False, 'transfer_demo', 15),
           ('bank-call', 45, False, 'send_demo', 5), ('marketplace-prepay', 62, True, None, 0), ('fake-job', 50, True, None, 20)]


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'), headless=True, args=['--enable-unsafe-swiftshader'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce')
        page = context.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + '/#simulator', wait_until='networkidle')
        expect(page.locator('.sim-story')).to_have_count(8)
        expect(page.locator('.sim-new')).to_have_count(5)
        for story_id, score, has_page, direct, minutes in STORIES:
            page.locator(f'[data-story="{story_id}"]').click()
            expect(page.locator(f'[data-story="{story_id}"]')).to_have_attribute('aria-pressed', 'true')
            page.locator('#sim-hotspot').click()
            expect(page.locator('.sim-message').first).to_be_visible()
            expect(page.locator('.sim-timer')).to_have_count(1 if minutes else 0)
            if minutes:
                expect(page.locator('.sim-timer')).to_contain_text(f'{minutes} минут')
            page.locator('[data-sim-action="analyze"]').click()
            expect(page.locator('#sim-analysis .sim-score')).to_have_text(f'{score} / 100')
            # A chosen reply brings the next authored message and hides the stale result.
            page.locator('[data-sim-action="ask_reason"]').click()
            expect(page.locator('.sim-message')).to_have_count(2)
            expect(page.locator('#sim-analysis')).to_be_hidden()
            if has_page:
                page.locator('[data-sim-action="inspect_link"]').click()
                page.locator('[data-url-part="domain"]').click()
                page.locator('#sim-check-link').click()
                expect(page.locator('#sim-inspection-feedback')).to_have_attribute('data-correct', 'true')
                page.locator('[data-sim-action="open_link"]').click()
                expect(page.locator('.sim-address')).to_be_visible()
                expect(page.locator('.sim-demo-value')).not_to_have_text('000 000') if story_id != 'qr-parking' else expect(page.locator('.sim-demo-value')).to_have_text('15 000 ₸')
                page.locator('[data-sim-action="transfer_demo"]').click()
            else:
                expect(page.locator('[data-sim-action="open_link"]')).to_have_count(0)
                page.locator(f'[data-sim-action="{direct}"]').click()
            expect(page.locator('#sim-decision-map')).to_be_visible()
            assert page.locator('#sim-map-list > li').count() >= 3
            if minutes:
                expect(page.locator('.sim-timer-note')).to_contain_text('Решение принято за')
        # Kazakh interface for a new story; the source message stays as authored.
        page.locator('[data-story="fake-job"]').click(); page.locator('#sim-hotspot').click()
        page.locator('[data-language="kk"]').click()
        expect(page.locator('.sim-new').first).to_have_text('Жаңа')
        expect(page.locator('.sim-timer')).to_contain_text('минут')
        expect(page.locator('.sim-message').first).to_contain_text('Поздравляем!')
        page.locator('[data-language="ru"]').click()
        assert page.evaluate('localStorage.length + sessionStorage.length') == 0
        # A phone-width layout has no horizontal scroll with eight stories and the X-ray.
        page.set_viewport_size({'width': 390, 'height': 900})
        page.locator('[data-story="bank-call"]').click(); page.locator('#sim-hotspot').click(); page.locator('[data-sim-action="analyze"]').click()
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1')
        assert not errors, errors
        browser.close()
    print('Simulator stories passed: 5 new stories end to end, pages and direct asks, timers, KK, storage and 390px.')


if __name__ == '__main__':
    main()
