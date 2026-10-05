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
        page.goto(os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000"), wait_until="networkidle")
        video = page.video
        page.wait_for_timeout(3500)
        for sample in ("phishing", "safe", "url"):
            page.locator(f'[data-sample="{sample}"]').click()
            page.wait_for_timeout(1500)
            page.locator("#analyze-button").click()
            expect(page.locator("#result-status")).to_have_text("Проверка завершена")
            page.wait_for_timeout(5000)
        for view in ("dashboard", "history", "research"):
            page.locator(f'[data-view="{view}"]').click()
            page.wait_for_timeout(4500)
        page.locator('[data-view="analyzer"]').click()
        page.wait_for_timeout(2500)
        context.close()
        video.save_as(str(OUTPUT / "Qalqan-demo.webm"))
        video.delete()
        browser.close()
    print("Recorded silent demo: artifacts/Qalqan-demo.webm")


if __name__ == "__main__":
    main()
