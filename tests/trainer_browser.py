"""Stage 3: exercise choices, real analysis, author review and saved history offline."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]


def main():
    output=ROOT/'artifacts'; output.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.getenv('CHROMIUM_PATH'),headless=True)
        context=browser.new_context(viewport={'width':1440,'height':1000})
        page=context.new_page(); errors=[]; requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(os.getenv('TEST_BASE_URL','http://127.0.0.1:8773')+'/#trainer',wait_until='networkidle')
        page.on('request',lambda r:requests.append((r.method,r.url,r.post_data)))
        context.set_offline(True)
        expect(page.locator('#trainer-select option')).to_have_count(7)
        expect(page.locator('#trainer-review')).to_be_hidden()
        expect(page.locator('#trainer-review-panels')).to_be_empty()
        source=page.locator('#trainer-message').inner_text()
        page.locator('#trainer-reveal').click()
        expect(page.locator('#trainer-error')).to_be_visible()
        first=page.locator('#trainer-message button').first
        first.focus();page.keyboard.press('Space')
        expect(first).to_have_attribute('aria-pressed','true')
        page.keyboard.press('Space');expect(first).to_have_attribute('aria-pressed','false')
        page.locator('#trainer-none').click()
        expect(page.locator('#trainer-none')).to_have_attribute('aria-pressed','true')
        first.click()
        expect(page.locator('#trainer-none')).to_have_attribute('aria-pressed','false')
        page.locator('#trainer-message button').filter(has_text='Введите').click()
        page.locator('#trainer-message button').filter(has_text='код').click()
        page.locator('#trainer-reveal').click()
        expect(page.locator('#trainer-review-title')).to_be_focused()
        expect(page.locator('#trainer-review-panels > article')).to_have_count(3)
        expect(page.locator('.trainer-score')).to_have_text('85 / 100')
        expect(page.locator('#trainer-message button').first).to_be_disabled()
        expect(page.locator('#trainer-differences [data-difference="authorMissed"]')).to_contain_text('заблокирован.')
        expect(page.locator('#trainer-review-panels > article').nth(0)).to_contain_text('Вы отметили слов: 3')
        expect(page.locator('#trainer-review-panels > article').nth(1)).to_contain_text('Результат анализатора Qalqan')
        expect(page.locator('#trainer-review-panels > article').nth(2)).to_contain_text('Учебная разметка автора')
        page.locator('[data-language="kk"]').click()
        expect(page.locator('#view-trainer h1')).to_have_text('Белгілерді тап')
        expect(page.locator('#trainer-review-panels > article').nth(0)).to_contain_text('Сіз белгілеген сөздер: 3')
        assert page.locator('#trainer-message').inner_text()==source
        expect(page.locator('.trainer-score')).to_have_text('85 / 100')
        page.locator('[data-language="ru"]').click()
        page.locator('#trainer-save').click()
        expect(page.locator('#trainer-save')).to_be_disabled()
        page.locator('#trainer-open').click()
        expect(page.locator('#result-learning')).to_contain_text('Тренажёр · пример 1')
        expect(page.locator('#result-learning')).to_contain_text('Вы отметили слов: 3')
        page.locator('[data-view="trainer"]').click()
        expect(page.locator('#trainer-save')).to_be_disabled()
        page.locator('#trainer-reset').click()
        expect(page.locator('#trainer-message button').first).to_be_focused()
        expect(page.locator('#trainer-review')).to_be_hidden()
        page.locator('#trainer-none').click();page.locator('#trainer-reveal').click()
        page.locator('[data-view="history"]').click()
        expect(page.locator('#history-list tbody tr')).to_have_count(1)
        page.locator('#history-list .history-open').click()
        expect(page.locator('#result-learning')).to_contain_text('Вы отметили слов: 3')

        # Each case uses the analyzer, including false alerts and missed context.
        page.locator('[data-view="trainer"]').click()
        for index,score in [(1,45),(2,35),(3,45),(4,0),(5,0),(6,63)]:
            page.locator('#trainer-select').select_option(str(index))
            expect(page.locator('#trainer-review')).to_be_hidden()
            page.locator('#trainer-none').click();page.locator('#trainer-reveal').click()
            expect(page.locator('.trainer-score')).to_have_text(f'{score} / 100')
            if index==4:
                expect(page.locator('#trainer-differences [data-difference="authorOnly"]')).to_contain_text('Переведи')
            if index==5:
                expect(page.locator('#trainer-review-panels > article').nth(2)).to_contain_text('Автор не отметил')
        expect(page.locator('#trainer-differences [data-difference="systemOnly"]')).to_contain_text('Срочно!')
        expect(page.locator('#trainer-review-panels > article').nth(2)).to_contain_text('ложная тревога')
        page.locator('#trainer-save').click()
        page.evaluate('window.scrollTo(0,0)')
        page.screenshot(path=str(output/'trainer-desktop.png'),full_page=True)
        page.locator('#trainer-projector').click()
        expect(page.locator('body')).to_have_class('projector-mode')
        expect(page.locator('#trainer-projector')).to_have_attribute('aria-pressed','true')
        page.keyboard.press('Escape');expect(page.locator('#projector-exit')).to_be_hidden()
        for width in [1024,390]:
            page.set_viewport_size({'width':width,'height':844})
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'),width
        page.screenshot(path=str(output/'trainer-mobile.png'))
        page.set_viewport_size({'width':1440,'height':1000})

        # Save a scenario prefix, then reset playback: saved trail must survive.
        page.locator('[data-view="scenarios"]').click()
        for _ in range(4):page.locator('#scenario-next').click()
        page.locator('#scenario-previous').click();page.locator('#scenario-previous').click()
        page.locator('#scenario-open').click()
        expect(page.locator('#risk-score')).to_have_text('40')
        expect(page.locator('#result-learning .learning-timeline li')).to_have_count(2)
        expect(page.locator('#result-learning')).to_contain_text('Первое предупреждение в сохранённых шагах: шаг 2')
        expect(page.locator('#result-message')).not_to_contain_text('Введите код')
        page.locator('[data-view="scenarios"]').click();page.locator('#scenario-reset').click()

        # Own checks remain distinct; unsafe markup stays literal in saved comparison.
        page.locator('[data-view="analyzer"]').click()
        text='<img src=x onerror="window.historyXSS=1"> Обычное уведомление о покупке.'
        page.locator('#content').fill(text);page.locator('#analyze-button').click()
        expect(page.locator('#risk-score')).to_have_text('0')
        expect(page.locator('#result-learning')).to_be_empty()
        page.locator('[data-view="history"]').click()
        expect(page.locator('#history-list tbody tr')).to_have_count(4)
        for kind,count in [('trainer',2),('scenario',1),('own',1),('all',4)]:
            page.locator('#history-origin').select_option(kind)
            expect(page.locator('#history-list tbody tr')).to_have_count(count)
        page.locator('#history-origin').select_option('scenario')
        page.locator('#history-list .history-open').click()
        expect(page.locator('#result-learning .learning-timeline li')).to_have_count(2)
        expect(page.locator('#risk-score')).to_have_text('40')
        page.locator('#preview-report').click()
        expect(page.locator('#report-paper')).to_contain_text('40 из 100')
        expect(page.locator('#report-paper')).to_contain_text('browser-rules-1.0')
        page.locator('#close-report').click()
        page.emulate_media(media='print')
        expect(page.locator('#result-learning')).to_be_visible()
        expect(page.locator('#result-analyzer-version')).to_be_visible()
        page.pdf(path=str(output/'learning-history.pdf'))
        page.emulate_media(media='screen')
        page.locator('[data-view="history"]').click()
        page.locator('#history-origin').select_option('all')
        page.locator('#history-list input[type=checkbox]').nth(0).check()
        page.locator('#history-list input[type=checkbox]').nth(1).check()
        page.locator('#compare-open').click()
        expect(page.locator('#compare-results .compare-card')).to_have_count(2)
        page.locator('#compare-results .history-evidence summary').nth(0).click()
        expect(page.locator('#compare-results .marked-message').first).to_have_text(text)
        expect(page.locator('#compare-results img')).to_have_count(0)
        assert page.evaluate('typeof window.historyXSS')=='undefined'
        page.locator('#compare-results button').filter(has_text='Открыть разбор').nth(1).click()
        expect(page.locator('#risk-score')).to_have_text('40')
        expect(page.locator('#result-learning')).to_contain_text('Сценарий · шаг 2')

        page.locator('[data-view="history"]').click()
        page.once('dialog',lambda dialog:dialog.accept());page.locator('#clear-history').click()
        expect(page.locator('#history-list tbody tr')).to_have_count(0)
        expect(page.locator('#result-learning')).to_be_empty()
        page.locator('[data-view="trainer"]').click()
        expect(page.locator('#trainer-select')).to_have_value('0')
        expect(page.locator('#trainer-review')).to_be_hidden()
        expect(page.locator('#trainer-message [aria-pressed=true]')).to_have_count(0)
        page.locator('[data-view="scenarios"]').click()
        expect(page.locator('#scenario-position')).to_have_text('Шаг 0 / 4')
        assert page.evaluate('localStorage.length')==0
        assert page.evaluate('sessionStorage.length')==0
        assert not errors,errors
        assert all(method=='GET' and '/static/shield.svg' in url and body is None for method,url,body in requests),requests
        context.set_offline(False);page.reload(wait_until='networkidle')
        page.locator('[data-view="history"]').click()
        expect(page.locator('#history-list tbody tr')).to_have_count(0)
        browser.close()
    print('Trainer/history browser passed: seven real results, separate answers/author/system, false alert/miss, keyboard, RU/KK, saved attempts and prefix trails, filters, comparison, print, XSS, projector, responsive, deletion/reload, offline and no data egress.')


if __name__=='__main__':main()
