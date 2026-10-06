"""Real browser smoke: run server first, install playwright + Chromium separately."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts"


def main():
    OUTPUT.mkdir(exist_ok=True)
    console_errors = []
    analysis_requests = []
    with sync_playwright() as p:
        executable = os.getenv("CHROMIUM_PATH")
        browser = p.chromium.launch(executable_path=executable, headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 1100})
        page = context.new_page()
        def navigate(view):
            link=page.locator('#account-link' if view == 'account' else f'nav [data-view="{view}"]')
            if not link.is_visible() and page.locator('#nav-toggle').is_visible() and page.locator('#nav-toggle').get_attribute('aria-expanded')=='false':
                page.locator('#nav-toggle').click()
            if not link.is_visible():
                page.locator('#more-navigation > summary').click()
            link.click()
        page.on("pageerror", lambda error: console_errors.append(str(error)))
        page.on("request", lambda request: analysis_requests.append(request) if request.method == "POST" and request.url.endswith("/api/analyze") else None)
        page.goto(os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000") + "/#demo", wait_until="networkidle")
        expect(page.locator("#view-demo")).to_be_visible(timeout=60000)
        expect(page.locator("#connection-status")).to_have_text("Сервис доступен")
        expect(page.locator("#view-demo")).to_be_visible()
        assert not analysis_requests, "Opening demo must not create checks"
        page.screenshot(path=str(OUTPUT / "desktop-demo.png"), full_page=True)
        if os.getenv("EXPECT_EPHEMERAL_HISTORY") == "true":
            expect(page.locator("#history-retention")).to_contain_text("История в демо временная")
        for sample, verdict in (("phishing", "Высокий риск"), ("safe", "Низкий риск"), ("url", "Подозрительно")):
            navigate('demo')
            expected_text = page.locator(f'[data-demo-text="{sample}"]').inner_text()
            page.locator(f'[data-demo="{sample}"]').click()
            expect(page.locator("#view-result")).to_be_visible()
            expect(page.locator("#content")).to_have_value(expected_text)
            expect(page.locator("#result-status")).to_have_text("Проверка завершена")
            expect(page.locator("#risk-verdict")).to_have_text(verdict)
        assert len(analysis_requests) == 3, "Each demo button should create exactly one analysis"
        expect(page.locator("#ml-score")).to_have_text("Не применяется")
        page.screenshot(path=str(OUTPUT / "desktop-analyzer.png"), full_page=True)
        with page.expect_download() as download:
            page.locator("#download-report").click()
        download.value.save_as(str(OUTPUT / "sample-risk-report.pdf"))
        assert (OUTPUT / "sample-risk-report.pdf").read_bytes().startswith(b"%PDF")
        navigate('dashboard')
        expect(page.locator("#dashboard-stats .stat").first.locator("strong")).to_have_text("3")
        page.screenshot(path=str(OUTPUT / "desktop-dashboard.png"), full_page=True)
        navigate('history')
        expect(page.locator("#history-list tbody tr")).to_have_count(3)
        page.locator("#history-filter").select_option("high")
        expect(page.locator("#history-list tbody tr")).to_have_count(1)
        navigate('research')
        expect(page.locator("#method-comparison tbody tr")).to_have_count(5)
        expect(page.locator("#confidence-details")).to_contain_text("95% CI")
        expect(page.locator("#adversarial-results tbody tr")).to_have_count(10)
        navigate('batch')
        page.locator('#batch-example').click()
        page.locator('#batch-submit').click()
        expect(page.locator('#batch-status')).to_have_text('Готово: 3 результатов.')
        expect(page.locator('#batch-results tbody tr')).to_have_count(3)
        navigate('history')
        page.locator('#history-filter').select_option('all')
        page.locator('#history-channel').select_option('url')
        page.locator('#history-search').fill('kaspi')
        expect(page.locator('#history-list tbody tr')).to_have_count(2)
        with page.expect_download() as csv_download:
            page.locator('#history-export').click()
        csv_download.value.save_as(str(OUTPUT/'history-export.csv'))
        assert len((OUTPUT/'history-export.csv').read_text(encoding='utf-8-sig').splitlines())==3
        page.locator('#history-list input[type=checkbox]').nth(0).check()
        page.locator('#history-list input[type=checkbox]').nth(1).check()
        page.locator('#compare-open').click()
        expect(page.locator('#compare-results .compare-card')).to_have_count(2)
        expect(page.locator('#compare-hint')).to_contain_text('Разница риск-баллов')
        navigate('account')
        expect(page.locator('#account-start')).to_be_visible()
        # Use the browser's transport, cookies and configured proxy/CA.
        profile=page.evaluate('fetch("/api/auth/me").then(response => response.json())')
        if profile['delivery_available']:expect(page.locator('#account-send')).to_be_enabled()
        else:expect(page.locator('#account-send')).to_be_disabled()
        navigate('settings')
        expect(page.locator("#view-settings")).to_be_visible()
        # Fresh browser context cannot retrieve the first context's report.
        report_path = page.locator("#download-report").get_attribute("href")
        other = browser.new_context()
        response = other.new_page().goto(os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000") + report_path)
        assert response.status == 404
        other.close()
        navigate('analyzer')
        page.set_viewport_size({"width": 390, "height": 844})
        page.screenshot(path=str(OUTPUT / "mobile-analyzer.png"), full_page=True)
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.locator('[data-sample="phishing"]').click()
        page.locator("#analyze-button").click()
        expect(page.locator("#risk-verdict")).to_have_text("Высокий риск")
        page.locator('[data-action="paid"]').click()
        expect(page.locator('#action-steps')).to_contain_text('Возврат не гарантирован')
        page.locator('[data-feedback="correct"]').click()
        expect(page.locator('#feedback-status')).to_contain_text('нужно отметить согласие')
        page.locator('#feedback-consent').check()
        page.locator('[data-feedback="correct"]').click()
        expect(page.locator('#feedback-status')).to_contain_text('Отзыв сохранён')
        navigate('batch')
        expect(page.locator('#view-batch')).to_be_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.screenshot(path=str(OUTPUT/'mobile-batch.png'),full_page=True)
        navigate('account')
        expect(page.locator('#account-email')).to_be_visible()
        expect(page.locator('#account-phone')).to_have_count(0)
        expect(page.locator('#sms-code')).to_have_count(0)
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.screenshot(path=str(OUTPUT/'mobile-account.png'),full_page=True)
        navigate('demo')
        expect(page.locator("#view-demo")).to_be_visible()
        page.screenshot(path=str(OUTPUT / "mobile-demo.png"), full_page=True)
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        assert not console_errors, console_errors
        context.close()
        browser.close()
    print("Browser smoke passed: demo, batch, filtered CSV, comparison, research, account availability, consent feedback, mobile menu and no page errors")


if __name__ == "__main__":
    main()
