"""Simulator 3.0 step 1: learning pressure timer, X-ray labels from real analysis and animated neon room."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.getenv('TEST_BASE_URL', 'http://127.0.0.1:8773')


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'), headless=True, args=['--enable-unsafe-swiftshader'])
        context = browser.new_context(viewport={'width': 1440, 'height': 1100})
        page = context.new_page(); errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(BASE + '/#simulator', wait_until='networkidle')
        expect(page.locator('#sim-canvas')).to_have_attribute('data-render', 'webgl')
        # No timer or X-ray before the phone is opened.
        expect(page.locator('.sim-timer')).to_have_count(0)
        expect(page.locator('#sim-xray-toggle')).to_have_count(0)
        # The neon room is animated while visible: pixels change without any interaction.
        canvas = page.locator('#sim-canvas'); first = canvas.screenshot(); page.wait_for_timeout(700)
        assert canvas.screenshot() != first, 'room should animate when motion is allowed'

        page.locator('#sim-hotspot').click()
        timer = page.locator('.sim-timer')
        expect(timer).to_have_count(1); expect(timer).to_have_attribute('role', 'timer')
        expect(timer).to_contain_text('10 минут'); expect(timer).to_contain_text('не влияет на индекс')
        assert page.locator('.sim-timer-clock').inner_text() in ('10:00', '09:59', '09:58')
        # The visible clock counts down without rebuilding the phone.
        page.wait_for_timeout(2200)
        assert page.locator('.sim-timer-clock').inner_text() in ('09:57', '09:58', '09:56', '09:55')

        # X-ray appears only after a real analysis and shows real signals, never before.
        expect(page.locator('.sim-xray-label')).to_have_count(0)
        page.locator('[data-sim-action="analyze"]').click()
        toggle = page.locator('#sim-xray-toggle')
        expect(toggle).to_have_attribute('aria-pressed', 'true')
        labels = page.locator('.sim-xray-label'); assert 2 <= labels.count() <= 3
        weights = labels.evaluate_all('ns=>ns.map(n=>Number(n.firstElementChild.textContent.split("+").pop()))')
        assert weights == sorted(weights, reverse=True) and all(w > 0 for w in weights)
        shown = page.locator('#sim-analysis .evidence-list li strong').all_inner_texts()
        for text in labels.evaluate_all('ns=>ns.map(n=>n.firstElementChild.textContent)'):
            assert text in shown, (text, shown)
        toggle.click(); expect(page.locator('.sim-xray-label')).to_have_count(0); expect(toggle).to_have_attribute('aria-pressed', 'false')
        toggle.click(); expect(page.locator('.sim-xray-label')).not_to_have_count(0)
        # A new reply hides the stale result and its X-ray.
        page.locator('.sim-reply-button').first.click()
        expect(page.locator('#sim-xray-toggle')).to_have_count(0)

        # Kazakh text; the timer never touches storage.
        page.locator('[data-language="kk"]').click()
        expect(page.locator('.sim-timer')).to_contain_text('минут')
        expect(page.locator('.sim-timer')).to_contain_text('Qalqan')
        page.locator('[data-language="ru"]').click()
        assert page.evaluate('localStorage.length + sessionStorage.length') == 0

        # Finishing records the decision time and freezes the timer.
        page.locator('[data-sim-action="contact"]').click()
        expect(page.locator('.sim-timer')).to_have_count(0)
        expect(page.locator('.sim-timer-note')).to_contain_text('Решение принято за')

        # The ordinary notification has no pressure and no timer.
        page.locator('[data-story="ordinary-receipt"]').click()
        page.locator('#sim-hotspot').click()
        expect(page.locator('.sim-timer')).to_have_count(0)
        page.locator('[data-sim-action="analyze"]').click()
        expect(page.locator('#sim-xray-toggle')).to_have_count(0)

        # Reduced motion keeps the room still.
        quiet = browser.new_context(viewport={'width': 1440, 'height': 1100}, reduced_motion='reduce').new_page()
        quiet.goto(BASE + '/#simulator', wait_until='networkidle')
        expect(quiet.locator('#sim-canvas')).to_have_attribute('data-render', 'webgl')
        c2 = quiet.locator('#sim-canvas'); a = c2.screenshot(); quiet.wait_for_timeout(700)
        assert c2.screenshot() == a, 'room must be static with reduced motion'
        assert not errors, errors
        browser.close()
    print('Simulator FX passed: pressure timer, real X-ray labels, no timer for ordinary story, KK, animation and reduced motion.')


if __name__ == '__main__':
    main()
