"""Real browser smoke: run server first, install playwright + Chromium separately."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts"


def main():
    OUTPUT.mkdir(exist_ok=True)
    console_errors = []
    with sync_playwright() as p:
        executable = os.getenv("CHROMIUM_PATH")
        browser = p.chromium.launch(executable_path=executable, headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 1100})
        page = context.new_page()
        page.on("pageerror", lambda error: console_errors.append(str(error)))
        page.goto(os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000"), wait_until="networkidle")
        expect(page.locator("#connection-status")).to_have_text("API подключён")
        page.screenshot(path=str(OUTPUT / "desktop-analyzer.png"), full_page=True)
        for sample, verdict in (("phishing", "Высокий риск"), ("safe", "Низкий риск"), ("url", "Подозрительно")):
            page.locator(f'[data-sample="{sample}"]').click()
            page.locator("#analyze-button").click()
            expect(page.locator("#result-status")).to_have_text("Проверка завершена")
            expect(page.locator("#risk-verdict")).to_have_text(verdict)
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
        response = other.request.get(os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000") + report_path)
        assert response.status == 404
        other.close()
        page.locator('[data-view="analyzer"]').click()
        page.set_viewport_size({"width": 390, "height": 844})
        page.screenshot(path=str(OUTPUT / "mobile-analyzer.png"), full_page=True)
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.locator('[data-sample="phishing"]').click()
        page.locator("#analyze-button").click()
        expect(page.locator("#risk-verdict")).to_have_text("Высокий риск")
        assert not console_errors, console_errors
        context.close()
        browser.close()
    print("Browser smoke passed: 5 views, 3 cases, PDF, isolation, mobile, no page errors")


if __name__ == "__main__":
    main()
