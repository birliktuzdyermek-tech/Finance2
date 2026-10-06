"""Record the connected four-minute demonstration using real browser results.
Start the server, install tests/requirements.txt and Playwright ffmpeg first.
"""
import os
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts"


def main():
    OUTPUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv("CHROMIUM_PATH"), headless=True)
        context = browser.new_context(viewport={"width":1440,"height":1000},
            record_video_dir=str(OUTPUT / "video"), record_video_size={"width":1440,"height":1000})
        page = context.new_page(); errors=[]
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(os.getenv("TEST_BASE_URL","http://127.0.0.1:8000")+"/#demo", wait_until="networkidle")
        video=page.video; start=time.monotonic()
        context.set_offline(True)

        def until(second):
            remaining=second-(time.monotonic()-start)
            if remaining>0: page.wait_for_timeout(remaining*1000)

        def show(selector):
            page.locator(selector).scroll_into_view_if_needed()

        until(12); page.locator("#demo-start-scenario").click()
        for second,score in ((20,"0"),(35,"40"),(50,"40"),(65,"85")):
            until(second); page.locator("#scenario-next").click()
            expect(page.locator("#scenario-score")).to_contain_text(score+" / 100")
            show("#scenario-score")
        until(80); page.locator("#scenario-open").click()
        expect(page.locator("#risk-score")).to_have_text("85")
        page.evaluate("scrollTo(0,0)")
        until(95); page.locator('[data-result-mode="detailed"]').click(); show("#result-message")
        until(110); page.locator('[data-language="kk"]').click()
        until(123); page.locator('[data-language="ru"]').click(); show(".action-card")
        page.locator('[data-action="entered"]').click()
        until(140); page.locator("#result-whatif").click()
        until(155)
        original=page.locator("#whatif-input").input_value()
        replies=original.split("\n\n"); replies[-1]="Проверю через приложение банка."
        page.locator("#whatif-input").fill("\n\n".join(replies))
        until(169); page.locator("#whatif-check").click()
        expect(page.locator("#whatif-delta")).to_have_text("Балл: 85 → 40 (-45).")
        show("#whatif-delta")
        until(185); show("#whatif-removed")
        until(201); page.locator("#whatif-back").click()
        expect(page.locator("#risk-score")).to_have_text("85")
        page.evaluate("scrollTo(0,0)")
        until(211); page.evaluate("location.hash='demo'")
        page.locator("#demo-finish-safe").click()
        page.locator('[data-result-mode="simple"]').click()
        expect(page.locator("#risk-score")).to_have_text("0")
        page.evaluate("scrollTo(0,0)")
        until(225); page.evaluate("location.hash='history'")
        expect(page.locator("#history-list tbody tr")).to_have_count(2)
        until(234); page.locator("#history-list .history-open").first.click()
        page.locator("#preview-report").click()
        expect(page.locator("#report-paper")).to_contain_text("0 из 100")
        until(245)
        assert not errors, errors
        context.close(); video.save_as(str(OUTPUT / "Qalqan-stage4-demo.webm")); video.delete()
        browser.close()
    print("Recorded ~4-minute silent demo: artifacts/Qalqan-stage4-demo.webm")


if __name__ == "__main__":
    main()
