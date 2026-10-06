"""Stage 2: actual result -> editable copy -> explanation, entirely offline."""
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
        page.goto(os.getenv('TEST_BASE_URL','http://127.0.0.1:8773')+'/#whatif', wait_until='networkidle')
        expect(page.locator('#whatif-empty')).to_be_visible()
        page.on('request', lambda req: requests.append((req.method, req.url, req.post_data)))
        context.set_offline(True)

        def analyze(text, mode='single', channel='sms'):
            page.locator('[data-view="analyzer"]').click()
            page.locator(f'[data-mode="{mode}"]').click()
            page.locator(f'[data-channel="{channel}"]').click()
            page.locator('#content').fill(text)
            page.locator('#analyze-button').click()
            expect(page.locator('#view-result')).to_be_visible()

        source = '<img src=x onerror="window.qalqanXSS=1"> 🔐 Срочно! Введите   код.'
        analyze(source)
        expect(page.locator('#risk-score')).to_have_text('63')
        expect(page.locator('#result-message .marked-message')).to_have_text(source)
        expect(page.locator('#result-message .evidence-list [data-rule="secret_request"]')).to_contain_text('· +45')
        assert page.locator('#result-message mark').all_text_contents() == ['Срочно', 'Введите', 'код']
        expect(page.locator('#result-message img')).to_have_count(0)
        page.locator('#result-whatif').click()
        expect(page.locator('#view-whatif')).to_be_visible()
        expect(page.locator('#whatif-original-score')).to_contain_text('63 / 100')
        expect(page.locator('#whatif-delta')).to_have_text('Балл: 63 → 63 (0).')
        draft = source.replace('Срочно!', 'Добрый день!')
        page.locator('#whatif-input').fill(draft)
        expect(page.locator('#whatif-results')).to_be_hidden()
        expect(page.locator('#whatif-status')).to_contain_text('Копия изменена')
        page.locator('[data-language="kk"]').click()
        expect(page.locator('#view-whatif h1')).to_have_text('Не өзгереді?')
        expect(page.locator('#whatif-check')).to_have_text('Нұсқаларды салыстыру')
        expect(page.locator('#whatif-input')).to_have_value(draft)
        expect(page.locator('#whatif-original-evidence .marked-message')).to_have_text(source)
        page.locator('#whatif-input').fill(source)
        expect(page.locator('#whatif-results')).to_be_visible()
        expect(page.locator('#whatif-retained')).to_contain_text('Құпия дерек сұрауы')
        page.locator('#whatif-input').fill(draft)
        expect(page.locator('#whatif-results')).to_be_hidden()
        page.locator('[data-language="ru"]').click()
        page.locator('#whatif-check').focus(); page.keyboard.press('Enter')
        expect(page.locator('#whatif-delta')).to_have_text('Балл: 63 → 45 (-18).')
        expect(page.locator('#whatif-delta')).to_be_focused()
        expect(page.locator('#whatif-removed [data-rule="urgency"]')).to_contain_text('−18')
        expect(page.locator('#whatif-removed q')).to_have_text('Срочно')
        expect(page.locator('#whatif-edited-evidence .marked-message')).to_have_text(draft)
        expect(page.locator('#whatif-edited-evidence img')).to_have_count(0)
        assert page.evaluate('typeof window.qalqanXSS') == 'undefined'
        page.locator('#whatif-input').fill('')
        page.locator('#whatif-check').click()
        expect(page.locator('#whatif-error')).to_be_visible()
        expect(page.locator('#whatif-results')).to_be_hidden()
        expect(page.locator('#whatif-input')).to_have_attribute('aria-invalid','true')
        page.locator('#whatif-reset').click()
        expect(page.locator('#whatif-input')).to_have_value(source)
        expect(page.locator('#whatif-delta')).to_have_text('Балл: 63 → 63 (0).')
        page.locator('#whatif-back').click()
        expect(page.locator('#risk-score')).to_have_text('63')
        expect(page.locator('#result-message .marked-message')).to_have_text(source)
        page.locator('#preview-report').click()
        expect(page.locator('#report-paper')).to_contain_text('browser-rules-1.0')
        expect(page.locator('#report-paper')).to_contain_text('63 из 100')
        page.locator('#close-report').click()
        page.locator('[data-view="history"]').click()
        expect(page.locator('#history-list tbody tr')).to_have_count(1)

        # Same rule in different replies: contribution +45 once and +0 on repeat.
        dialogue = 'Срочно введите код.\n\nШұғыл! SMS кодты жіберіңіз.\n\nЧек в приложении банка.'
        analyze(dialogue, mode='dialogue', channel='whatsapp')
        rows = page.locator('#result-message .evidence-list [data-rule="secret_request"]')
        expect(rows.nth(0)).to_contain_text('· +45'); expect(rows.nth(1)).to_contain_text('· +0')
        expect(rows.nth(1)).to_contain_text('Уже учтено в реплике 1')
        page.locator('#result-whatif').click()
        page.locator('#whatif-input').fill('Добрый день.\n\nШұғыл! SMS кодты жіберіңіз.\n\nЧек в приложении банка.')
        page.locator('#whatif-check').click()
        expect(page.locator('#whatif-delta')).to_have_text('Балл: 63 → 63 (0).')
        expect(page.locator('#whatif-retained')).to_contain_text('Реплика 2')
        expect(page.locator('#whatif-retained')).to_contain_text('Фрагменты или их позиции изменились')
        page.locator('#whatif-input').fill('Осталась одна реплика.')
        page.locator('#whatif-check').click()
        expect(page.locator('#whatif-error')).to_contain_text('2–20 реплик')
        page.locator('#whatif-back').click()
        expect(page.locator('#result-message .evidence-card')).to_have_count(3)

        # Replacing a domain removes actual URL findings, without opening either site.
        analyze('http://kaspi-verify.example/pay', channel='url')
        page.locator('#result-whatif').click()
        page.locator('#whatif-input').fill('https://kaspi.kz/pay')
        page.locator('#whatif-check').click()
        expect(page.locator('#whatif-delta')).to_have_text('Балл: 55 → 0 (-55).')
        expect(page.locator('#whatif-removed [data-rule]')).to_have_count(2)
        expect(page.locator('#whatif-content')).to_contain_text('Уменьшение балла не доказывает безопасность')

        # Ordinary / mixed warning contexts and safe text rendering across language switches.
        analyze('Покупка на 3 500 ₸. Чек доступен в приложении банка.')
        page.locator('#result-whatif').click()
        page.locator('#whatif-input').fill('Проверить сообщение')
        page.locator('#whatif-check').click()
        page.locator('[data-language="kk"]').click()
        expect(page.locator('#whatif-edited-evidence .marked-message')).to_have_text('Проверить сообщение')
        expect(page.locator('#whatif-edited-score')).to_contain_text('0 / 100')
        page.locator('[data-language="ru"]').click()
        page.locator('#whatif-input').fill('Предупреждение: мошенники пишут «Срочно! Введите код».')
        page.locator('#whatif-check').click()
        expect(page.locator('#whatif-delta')).to_have_text('Балл: 0 → 63 (+63).')
        expect(page.locator('#whatif-added [data-rule]')).to_have_count(2)
        expect(page.locator('#whatif-limits')).to_contain_text('цитаты')

        # A removed rule need not lower a capped score.
        analyze('Срочно! Счёт заблокирован. Введите код. http://kaspi-verify.example')
        page.locator('#result-whatif').click()
        page.locator('#whatif-input').fill('Счёт заблокирован. Введите код. http://kaspi-verify.example')
        page.locator('#whatif-check').click()
        expect(page.locator('#whatif-delta')).to_have_text('Балл: 100 → 100 (0).')
        expect(page.locator('#whatif-cap')).to_be_visible()

        analyze('Срочно! Введите код из SMS.')
        page.locator('#result-whatif').click()
        page.locator('#whatif-input').fill('Введите код из SMS.')
        page.locator('#whatif-check').click()
        page.evaluate('window.scrollTo(0, 0)')
        page.screenshot(path=str(output/'comparison-desktop.png'), full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(output/'comparison-mobile.png'), full_page=True)
        page.set_viewport_size({'width':1440,'height':1000})

        # Deleting history also erases the anchor, draft and evidence DOM.
        page.locator('[data-view="history"]').click()
        expect(page.locator('#history-list tbody tr')).to_have_count(6)
        page.once('dialog', lambda dialog: dialog.accept())
        page.locator('#clear-history').click()
        expect(page.locator('#history-list')).to_contain_text('Проверок пока нет')
        page.evaluate("location.hash='whatif'")
        expect(page.locator('#whatif-empty')).to_be_visible()
        expect(page.locator('#whatif-input')).to_have_value('')
        expect(page.locator('#whatif-original-evidence')).to_be_empty()
        expect(page.locator('#whatif-edited-evidence')).to_be_empty()
        assert page.evaluate('localStorage.length') == 0
        assert page.evaluate('sessionStorage.length') == 0
        assert not errors, errors
        assert all(method == 'GET' and '/static/shield.svg' in url and body is None for method,url,body in requests), requests
        context.set_offline(False)
        page.reload(wait_until='networkidle')
        expect(page.locator('#whatif-empty')).to_be_visible()
        browser.close()
    print('Comparison browser passed: original retained, exact weights/fragments, edits/deltas, duplicates, cap, RU/KK, HTML safety, validation, keyboard, mobile, PDF version, clear/reload and zero data transmission.')


if __name__ == '__main__':
    main()
