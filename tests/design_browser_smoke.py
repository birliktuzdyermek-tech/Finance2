"""Exercise the screenshot-based design against a running app.

Usage: CHROMIUM_PATH=/usr/bin/chromium TEST_BASE_URL=http://127.0.0.1:8000 \
    python tests/design_browser_smoke.py

Only analysis requests are sent. This check never requests a login email.
"""
import os
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts"
BASE_URL = os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000").rstrip("/")


def main():
    OUTPUT.mkdir(exist_ok=True)
    errors = []
    writes = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.getenv("CHROMIUM_PATH"),
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        context = browser.new_context(viewport={"width": 1440, "height": 1080})
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("request", lambda request: writes.append(request.url) if request.method == "POST" else None)

        def route(view):
            page.evaluate("view => { location.hash = view; }", view)
            expect(page.locator(f"#view-{view}")).to_be_visible()

        def no_overflow():
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth"), page.url

        def snapshot(name):
            page.screenshot(path=str(OUTPUT / f"design-{name}.png"), full_page=True)

        page.goto(BASE_URL + "/", wait_until="networkidle")
        expect(page.locator("#view-home")).to_be_visible(timeout=60000)
        expect(page.locator("#connection-status")).to_have_text("Сервис доступен")
        assert page.locator("body").evaluate("element => getComputedStyle(element).backgroundColor") == "rgb(10, 16, 32)"
        assert not writes, "Home must not manufacture checks"
        no_overflow()
        snapshot("desktop-home")

        page.locator("#home-analyze").click()
        expect(page.locator("#view-analyzer")).to_be_visible()
        page.locator('[data-sample="phishing"]').click()
        page.locator("#analyze-button").click()
        expect(page.locator("#view-result")).to_be_visible()
        expect(page.locator("#result-status")).to_have_text("Проверка завершена")
        expect(page.locator("#risk-verdict")).to_have_text("Высокий риск")
        assert len(writes) == 1, "Submitting one message must create one check"
        no_overflow()
        snapshot("desktop-result")

        page.locator("#preview-report").click()
        expect(page.locator("#report-preview")).to_be_visible()
        assert page.locator("#report-preview").evaluate("dialog => dialog.open")
        with page.expect_download() as download:
            page.locator("#preview-download").click()
        pdf = OUTPUT / "design-preview-report.pdf"
        download.value.save_as(str(pdf))
        assert pdf.read_bytes().startswith(b"%PDF")
        page.keyboard.press("Escape")
        expect(page.locator("#report-preview")).not_to_be_visible()
        page.locator("#preview-report").click()
        page.locator("#close-report").click()
        expect(page.locator("#report-preview")).not_to_be_visible()
        with page.expect_download() as download:
            page.locator("#download-report").click()
        direct_pdf = OUTPUT / "design-direct-report.pdf"
        download.value.save_as(str(direct_pdf))
        assert direct_pdf.read_bytes().startswith(b"%PDF")

        page.locator("#result-projector").click()
        expect(page.locator("body")).to_have_class(re.compile(r"\bprojector-mode\b"))
        no_overflow()
        page.locator("#projector-exit").click()
        expect(page.locator("body")).not_to_have_class(re.compile(r"\bprojector-mode\b"))

        page.locator("#more-navigation > summary").click()
        page.locator('nav [data-view="brand"]').click()
        expect(page.locator("#view-brand")).to_be_visible()
        page.locator("#brand-input").fill("https://kaspi-secure-login.example/verify")
        page.locator("#brand-submit").click()
        expect(page.locator("#brand-results")).to_be_visible()
        expect(page.locator("#brand-results")).to_contain_text("kaspi")
        assert len(writes) == 2, "Brand comparison must use the real analyzer once"
        snapshot("desktop-brand")
        page.locator("#brand-open-result").click()
        expect(page.locator("#view-result")).to_be_visible()
        expect(page.locator("#ml-score")).to_have_text("Не применяется")

        static_writes = len(writes)
        route("schemes")
        schemes = page.locator("[data-scheme]")
        assert schemes.count() >= 7
        schemes.nth(1).click()
        expect(page.locator("#scheme-guidance")).to_be_visible()
        assert page.locator("#scheme-guidance").inner_text().strip()
        page.locator("#scheme-example").click()
        expect(page.locator("#view-analyzer")).to_be_visible()
        assert page.locator("#content").input_value().strip()
        assert len(writes) == static_writes, "Loading a scheme example must not silently submit it"

        route("glossary")
        entries = page.locator(".glossary-entry:visible")
        total_entries = entries.count()
        assert total_entries >= 5
        page.locator("#glossary-search").fill("фишинг")
        expect(entries).to_have_count(1)
        expect(entries).to_contain_text("Фишинг")
        page.locator("#glossary-search").fill("несуществующийтермин123")
        expect(entries).to_have_count(0)
        page.locator("#glossary-search").fill("")
        expect(entries).to_have_count(total_entries)

        route("guide")
        expect(page.locator("#view-guide .tour-steps > li")).to_have_count(3)
        page.locator("#guide-start").click()
        expect(page.locator("#view-analyzer")).to_be_visible()

        route("presentation")
        expect(page.locator("#presentation-slide-how")).to_be_visible()
        expect(page.locator("#presentation-slide-metrics")).not_to_be_visible()
        page.locator("#presentation-next").click()
        expect(page.locator("#presentation-slide-metrics")).to_be_visible()
        expect(page.locator("#presentation-slide-metrics")).to_contain_text("132")
        page.locator("#presentation-projector").click()
        expect(page.locator("body")).to_have_class(re.compile(r"\bprojector-mode\b"))
        no_overflow()
        snapshot("presentation-projector")
        page.locator("#projector-exit").click()
        page.locator("#presentation-prev").click()
        expect(page.locator("#presentation-slide-how")).to_be_visible()
        expect(page.locator("body")).not_to_have_class(re.compile(r"\bprojector-mode\b"))

        route("telegram")
        expect(page.locator("#view-telegram")).to_contain_text("Демонстрация")
        route("states")
        expect(page.locator("#view-states")).to_contain_text("Нет связи")
        assert len(writes) == static_writes, "Informational routes must not create checks"

        route("history")
        expect(page.locator("#history-list tbody tr")).to_have_count(2)
        route("research")
        expect(page.locator("#method-comparison tbody tr")).to_have_count(5)
        expect(page.locator("#adversarial-results tbody tr")).to_have_count(10)
        no_overflow()
        snapshot("desktop-research")

        page.set_viewport_size({"width": 390, "height": 844})
        route("home")
        no_overflow()
        snapshot("mobile-home")
        page.locator("#nav-toggle").click()
        expect(page.locator(".sidebar")).to_have_class(re.compile(r"\bnav-open\b"))
        page.locator('nav [data-view="analyzer"]').click()
        expect(page.locator("#view-analyzer")).to_be_visible()
        expect(page.locator("#nav-toggle")).to_have_attribute("aria-expanded", "false")
        snapshot("mobile-analyzer")
        page.locator("#nav-toggle").click()
        page.keyboard.press("Escape")
        expect(page.locator("#nav-toggle")).to_have_attribute("aria-expanded", "false")

        for view in ("result", "dashboard", "history", "research", "brand", "schemes", "glossary", "guide", "presentation", "states", "telegram", "account", "batch", "compare"):
            route(view)
            if view == "dashboard":
                expect(page.locator("#dashboard-stats .stat").first.locator("strong")).to_have_text("2")
            no_overflow()
        route("result")
        snapshot("mobile-result")
        page.locator("#preview-report").click()
        expect(page.locator("#report-preview")).to_be_visible()
        no_overflow()
        page.keyboard.press("Escape")
        expect(page.locator("#report-preview")).not_to_be_visible()
        assert len(writes) == static_writes
        assert not any("/api/auth/" in url for url in writes), "Design smoke must never send login emails"
        assert not errors, errors
        context.close()
        browser.close()
    print("Design browser passed: dark desktop/mobile, real analysis and brand check, PDF preview/download, schemes, glossary, guide, projector slides, static states, responsive routes, and no email requests/page errors.")


if __name__ == "__main__":
    main()
