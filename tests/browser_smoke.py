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
        page.on("pageerror", lambda error: console_errors.append(str(error)))
        page.on("request", lambda request: analysis_requests.append(request) if request.method == "POST" and request.url.endswith("/api/analyze") else None)
        page.goto(os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000") + "/#demo", wait_until="networkidle")
        expect(page.locator("#connection-status")).to_have_text("API подключён")
        expect(page.locator("#view-demo")).to_be_visible()
        assert not analysis_requests, "Opening demo must not create checks"
        page.screenshot(path=str(OUTPUT / "desktop-demo.png"), full_page=True)
        if os.getenv("EXPECT_EPHEMERAL_HISTORY") == "true":
            expect(page.locator("#history-retention")).to_contain_text("История в демо временная")
        for sample, verdict in (("phishing", "Высокий риск"), ("safe", "Низкий риск"), ("url", "Подозрительно")):
            page.locator('nav [data-view="demo"]').click()
            expected_text = page.locator(f'[data-demo-text="{sample}"]').inner_text()
            page.locator(f'[data-demo="{sample}"]').click()
            expect(page.locator("#view-analyzer")).to_be_visible()
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
        page.locator('[data-view="dashboard"]').click()
        expect(page.locator("#dashboard-stats .stat").first.locator("strong")).to_have_text("3")
        page.screenshot(path=str(OUTPUT / "desktop-dashboard.png"), full_page=True)
        page.locator('[data-view="history"]').click()
        expect(page.locator("#history-list tbody tr")).to_have_count(3)
        page.locator("#history-filter").select_option("high")
        expect(page.locator("#history-list tbody tr")).to_have_count(1)
        page.locator('[data-view="research"]').click()
        expect(page.locator("#method-comparison tbody tr")).to_have_count(3)
        page.locator('[data-view="settings"]').click()
        expect(page.locator("#view-settings")).to_be_visible()
        # Fresh browser context cannot retrieve the first context's report.
        report_path = page.locator("#download-report").get_attribute("href")
        other = browser.new_context()
        response = other.new_page().goto(os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000") + report_path)
        assert response.status == 404
        other.close()
        page.locator('[data-view="analyzer"]').click()
        page.set_viewport_size({"width": 390, "height": 844})
        page.screenshot(path=str(OUTPUT / "mobile-analyzer.png"), full_page=True)
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.locator('[data-sample="phishing"]').click()
        page.locator("#analyze-button").click()
        expect(page.locator("#risk-verdict")).to_have_text("Высокий риск")
        page.locator('nav [data-view="demo"]').click()
        expect(page.locator("#view-demo")).to_be_visible()
        page.screenshot(path=str(OUTPUT / "mobile-demo.png"), full_page=True)
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        assert not console_errors, console_errors
        context.close()
        browser.close()
    print("Browser smoke passed: 6 views, demo creates no checks until clicked, 3 real analyses, PDF, isolation, mobile, no page errors")


if __name__ == "__main__":
    main()
