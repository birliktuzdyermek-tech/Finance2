"""Real-browser regressions: run the app first. No messages may leave the page."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts"


def main():
    OUTPUT.mkdir(exist_ok=True)
    errors, unexpected_dialogs, requests = [], [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv("CHROMIUM_PATH"), headless=True,
                                    args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 1100})
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000"), wait_until="networkidle")
        expect(page.locator("#connection-status")).to_have_text("Локальная обработка")
        page.on("request", lambda req: requests.append((req.method, req.url, req.post_data)))
        context.set_offline(True)

        for sample, verdict in (("phishing", "Высокий риск"), ("safe", "Низкий риск"), ("url", "Подозрительно")):
            page.locator(f'[data-sample="{sample}"]').click()
            page.locator("#analyze-button").click()
            expect(page.locator("#result-status")).to_have_text("Проверка завершена")
            expect(page.locator("#risk-verdict")).to_have_text(verdict)
        assert "kaspi.kz.verify.example" in page.locator(".marked-message mark").all_text_contents()

        page.locator('[data-view="dashboard"]').click()
        expect(page.locator("#dashboard-stats .stat").first.locator("strong")).to_have_text("3")
        page.locator('[data-view="history"]').click()
        expect(page.locator("#history-list tbody tr")).to_have_count(3)
        page.locator("#history-filter").select_option("high")
        expect(page.locator("#history-list tbody tr")).to_have_count(1)
        page.locator('[data-view="analyzer"]').click()
        page.locator('[data-mode="dialogue"]').click()
        conversation = "Банк: Срочно, ваш счёт заблокирован.\n\nЯ: Что делать?\n\nБанк: SMS кодты енгізіңіз."
        page.locator("#content").fill(conversation)
        page.locator("#analyze-button").click()
        expect(page.locator("#message-evidence .evidence-card")).to_have_count(3)
        expect(page.locator("#risk-score")).to_have_text("85")
        expect(page.locator("#message-evidence .evidence-card").nth(1).locator("mark")).to_have_count(0)
        assert page.locator(".marked-message").all_text_contents() == conversation.split("\n\n")
        expect(page.locator("#dialogue-summary")).to_be_visible()
        page.locator("#content").fill("Одна реплика")
        page.locator("#analyze-button").click()
        expect(page.locator("#form-error")).to_be_visible()
        # Invalid input must not add a result or corrupt the previous analysis.
        expect(page.locator("#risk-score")).to_have_text("85")

        for language in ("kk", "ru"):
            page.locator(f'[data-language="{language}"]').click()
            expect(page.locator("html")).to_have_attribute("lang", language)
            for key in ("received", "opened", "entered", "transferred"):
                page.locator(f'[data-incident="{key}"]').click()
                expect(page.locator(f'[data-incident="{key}"]')).to_have_attribute("aria-pressed", "true")
                assert page.locator("#incident-steps li").count() >= 2
                text = page.locator("#incident-steps").inner_text().lower()
                assert "банк" in text or (key == "transferred" and "полиция" in text)
        expect(page.locator("#incident-steps")).to_contain_text("Возврат денег не гарантирован")

        page.locator('[data-mode="single"]').click()
        page.locator('[data-channel="sms"]').click()
        for text in ("Никогда не сообщайте код из SMS и CVV сотрудникам банка.",
                     "SMS кодты ешкімге жібермеңіз. Құпиясөзді енгізбеңіз."):
            page.locator("#content").fill(text)
            page.locator("#analyze-button").click()
            expect(page.locator("#risk-score")).to_have_text("0")
            expect(page.locator(".marked-message mark")).to_have_count(0)
            expect(page.locator('[data-incident="transferred"]')).to_have_attribute("aria-pressed", "true")

        def unexpected(dialog):
            unexpected_dialogs.append(dialog.message)
            dialog.dismiss()
        page.on("dialog", unexpected)
        hostile = '<img src="https://example.invalid/leak" onerror="alert(1)"><script>alert(2)</script> Срочно введите CVV.'
        page.locator("#content").fill(hostile)
        page.locator("#analyze-button").click()
        expect(page.locator(".marked-message")).to_have_text(hostile)
        expect(page.locator("#message-evidence img, #message-evidence script")).to_have_count(0)
        assert not unexpected_dialogs
        page.remove_listener("dialog", unexpected)

        # Print/PDF remains local and is available for history results too.
        page.evaluate("() => { window.__printed = 0; window.print = () => { window.__printed += 1; }; }")
        page.locator("#download-report").click()
        assert page.evaluate("window.__printed") == 1, (page.evaluate("window.__printed"), errors)
        page.pdf(path=str(OUTPUT / "sample-risk-report.pdf"))
        assert (OUTPUT / "sample-risk-report.pdf").read_bytes().startswith(b"%PDF")
        # Browsers may re-request the fixed favicon on hash navigation/printing.
        assert all(method == "GET" and url.endswith("/static/shield.svg") and body is None
                   for method, url, body in requests), requests
        assert page.evaluate("localStorage.length + sessionStorage.length") == 0

        context.set_offline(False)
        page.locator('[data-view="research"]').click()
        expect(page.locator("#method-comparison tbody tr")).to_have_count(3)
        assert all(method == "GET" and url.endswith(("/api/metrics", "/static/shield.svg")) and body is None
                   for method, url, body in requests), requests
        page.locator('[data-view="settings"]').click()
        expect(page.locator("#view-settings")).to_be_visible()
        page.locator('[data-view="history"]').click()
        page.once("dialog", lambda dialog: dialog.accept())
        page.locator("#clear-history").click()
        expect(page.locator("#history-list tbody tr")).to_have_count(0)

        page.locator('[data-view="analyzer"]').click()
        page.locator('[data-sample="phishing"]').click()
        page.locator("#analyze-button").click()
        page.screenshot(path=str(OUTPUT / "desktop-analyzer.png"), full_page=True)
        page.set_viewport_size({"width": 390, "height": 844})
        page.locator('[data-language="kk"]').click()
        expect(page.locator("#risk-verdict")).to_have_text("Жоғары қауіп")
        page.screenshot(path=str(OUTPUT / "mobile-analyzer.png"), full_page=True)
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.set_viewport_size({"width": 800, "height": 900})
        page.evaluate("document.documentElement.style.fontSize = '200%'")
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        page.reload(wait_until="networkidle")
        page.locator('[data-view="history"]').click()
        expect(page.locator("#history-list tbody tr")).to_have_count(0)
        assert not errors, errors
        context.close()
        browser.close()
    print("Browser smoke passed: local/offline analysis, exact evidence, dialogue, 4 actions, RU/KK, XSS, history, print, responsive layout, no data transmission")


if __name__ == "__main__":
    main()
