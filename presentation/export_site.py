"""Render artifacts/Qalqan-pitch-deck.pptx into the slide images shown on the site's #presentation page.

Requires LibreOffice (soffice), poppler (pdftoppm) and Pillow. Run `python presentation/build.py` first.
"""
import shutil
import subprocess
import tempfile
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "artifacts" / "Qalqan-pitch-deck.pptx"
TARGET = ROOT / "frontend" / "presentation"


def main():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        subprocess.run(["soffice", "--headless", "--convert-to", "pdf", "--outdir", str(tmp), str(SOURCE)],
                       check=True, capture_output=True)
        subprocess.run(["pdftoppm", "-r", "144", "-png", str(tmp / (SOURCE.stem + ".pdf")), str(tmp / "s")],
                       check=True, capture_output=True)
        pages = sorted(tmp.glob("s-*.png"))
        shutil.rmtree(TARGET, ignore_errors=True)
        TARGET.mkdir(parents=True)
        for i, page in enumerate(pages, 1):
            Image.open(page).convert("RGB").resize((1600, 900), Image.LANCZOS).save(
                TARGET / f"slide-{i:02d}.webp", "WEBP", quality=80, method=6)
    shutil.copy(SOURCE, TARGET / SOURCE.name)
    print(f"Exported {len(pages)} slides to {TARGET}")


if __name__ == "__main__":
    main()
