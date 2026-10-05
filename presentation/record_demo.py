"""Record a short silent walkthrough. Install playwright and start the server first."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "artifacts"


def main():
    OUTPUT.mkdir(exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.getenv("CHROMIUM_PATH"), headless=True, args=["--no-sandbox", "--disable-dev-shm-usage"])
        context = browser.new_context(viewport={"width": 1440, "height": 1000}, record_video_dir=str(OUTPUT / "video"), record_video_size={"width": 1440, "height": 1000})
        page = context.new_page()
        page.goto(os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000") + "/#home", wait_until="networkidle")
        expect(page.locator("#view-home")).to_be_visible()
        video = page.video
        def navigate(view):
            link=page.locator(f'nav [data-view="{view}"]')
            if not link.is_visible():page.locator('#more-navigation > summary').click()
            link.click()
        page.wait_for_timeout(3500)
        for sample in ("phishing", "safe", "url"):
            navigate('demo')
            page.wait_for_timeout(1500)
            page.locator(f'[data-demo="{sample}"]').click()
            expect(page.locator("#result-status")).to_have_text("Проверка завершена")
            page.wait_for_timeout(5000)
            if sample == "phishing":
                page.locator('#preview-report').click()
                expect(page.locator('#report-preview')).to_be_visible()
                page.wait_for_timeout(3500)
                page.keyboard.press('Escape')
        for view in ("dashboard", "history", "research"):
            navigate(view)
            page.wait_for_timeout(4500)
        navigate('presentation')
        page.locator('#presentation-next').click()
        expect(page.locator('#presentation-slide-metrics')).to_be_visible()
        page.wait_for_timeout(2500)
        context.close()
        video.save_as(str(OUTPUT / "Qalqan-demo.webm"))
        video.delete()
        browser.close()
    print("Recorded silent demo: artifacts/Qalqan-demo.webm")


if __name__ == "__main__":
    main()
