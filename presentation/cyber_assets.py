"""Generate the cyber-style artwork (background, radar, hex icons, framed screenshots) used by build.py.

Run `python presentation/cyber_assets.py`. Screenshots are read from presentation/assets/shot-*.png.
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ASSETS = Path(__file__).resolve().parent / "assets"
CYAN, MINT, AMBER, RED, VIOLET = (34, 211, 255), (61, 220, 151), (245, 184, 75), (255, 77, 109), (139, 92, 246)
BG = (5, 9, 20)


def glow(layer, radius, strength=1.0):
    blurred = layer.filter(ImageFilter.GaussianBlur(radius))
    if strength != 1.0:
        alpha = blurred.getchannel("A").point(lambda v: min(255, int(v * strength)))
        blurred.putalpha(alpha)
    return Image.alpha_composite(blurred, layer)


def background(path):
    w, h = 1920, 1080
    rnd = random.Random(7)
    img = Image.new("RGBA", (w, h), BG + (255,))
    blobs = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(blobs)
    d.ellipse((1150, -380, 2150, 520), fill=(21, 90, 160, 150))
    d.ellipse((-420, 520, 520, 1380), fill=(70, 30, 150, 110))
    d.ellipse((700, 780, 1500, 1300), fill=(20, 110, 130, 60))
    img = Image.alpha_composite(img, blobs.filter(ImageFilter.GaussianBlur(170)))
    grid = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g = ImageDraw.Draw(grid)
    for x in range(0, w, 96):
        g.line((x, 0, x, h), fill=(120, 200, 255, 22))
    for y in range(0, h, 96):
        g.line((0, y, w, y), fill=(120, 200, 255, 22))
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).ellipse((120, -250, 1800, 800), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(200))
    grid.putalpha(Image.composite(grid.getchannel("A"), Image.new("L", (w, h), 0), mask))
    img = Image.alpha_composite(img, grid)
    net = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    n = ImageDraw.Draw(net)
    pts = [(rnd.randint(0, w), rnd.randint(0, h)) for _ in range(70)]
    for i, a in enumerate(pts):
        for b in pts[i + 1:]:
            dist = math.dist(a, b)
            if dist < 230:
                n.line((*a, *b), fill=CYAN + (int(55 * (1 - dist / 230)),), width=1)
        n.ellipse((a[0] - 2, a[1] - 2, a[0] + 2, a[1] + 2), fill=(140, 225, 255, 150))
    img = Image.alpha_composite(img, net)
    vignette = Image.new("L", (w, h), 0)
    ImageDraw.Draw(vignette).ellipse((-300, -300, w + 300, h + 300), fill=255)
    vignette = vignette.filter(ImageFilter.GaussianBlur(220))
    dark = Image.new("RGBA", (w, h), (2, 4, 10, 255))
    img = Image.composite(img, dark, vignette)
    img.convert("RGB").save(path, quality=92)


def radar(path, size=1200):
    s = size
    c = s // 2
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for r, alpha, width in ((c - 8, 70, 2), (int(c * .83), 60, 2), (int(c * .62), 45, 2), (int(c * .4), 40, 2)):
        d.ellipse((c - r, c - r, c + r, c + r), outline=CYAN + (alpha,), width=width)
    d.line((c, 10, c, s - 10), fill=CYAN + (40,), width=2)
    d.line((10, c, s - 10, c), fill=CYAN + (40,), width=2)
    for a in range(0, 360, 6):
        r1, r2 = c - 8, c - (26 if a % 30 == 0 else 16)
        x1, y1 = c + r1 * math.cos(math.radians(a)), c + r1 * math.sin(math.radians(a))
        x2, y2 = c + r2 * math.cos(math.radians(a)), c + r2 * math.sin(math.radians(a))
        d.line((x1, y1, x2, y2), fill=CYAN + (110 if a % 30 == 0 else 60,), width=2)
    r = int(c * .72)
    for a in range(0, 360, 14):
        d.arc((c - r, c - r, c + r, c + r), a, a + 8, fill=VIOLET + (150,), width=3)
    sweep = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sweep)
    for i in range(60):
        start = -70 - i * 1.1
        sd.pieslice((c - (c - 20), c - (c - 20), c + (c - 20), c + (c - 20)), start - 1.2, start, fill=CYAN + (int(110 * (1 - i / 60)),))
    img = Image.alpha_composite(img, sweep)
    blips = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    bd = ImageDraw.Draw(blips)
    for fx, fy in ((.68, .27), (.3, .24), (.76, .62), (.24, .68), (.55, .8)):
        x, y = fx * s, fy * s
        bd.ellipse((x - 9, y - 9, x + 9, y + 9), fill=RED + (255,))
        bd.ellipse((x - 26, y - 26, x + 26, y + 26), outline=RED + (120,), width=3)
    img = Image.alpha_composite(img, glow(blips, 14, 1.4))
    for fx, fy, col in ((.5, .04, CYAN), (.96, .5, MINT), (.14, .5, VIOLET)):
        x, y = fx * s, fy * s
        dot = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        ImageDraw.Draw(dot).ellipse((x - 11, y - 11, x + 11, y + 11), fill=col + (255,))
        img = Image.alpha_composite(img, glow(dot, 10, 1.3))
    img.save(path)


def draw_icon(d, name, col, w):
    def line(*pts):
        d.line(pts, fill=col, width=w, joint="curve")
    if name == "shield":
        line((256, 64), (400, 118), (400, 262), (256, 448), (112, 262), (112, 118), (256, 64))
        line((190, 252), (240, 302), (330, 200))
    elif name == "scan":
        for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
            x0, y0 = 256 - sx * 150, 256 - sy * 150
            line((x0, y0 + sy * 70), (x0, y0), (x0 + sx * 70, y0))
        line((130, 256), (382, 256))
    elif name == "flask":
        line((196, 80), (316, 80))
        line((222, 80), (222, 220), (128, 392), (150, 430), (362, 430), (384, 392), (290, 220), (290, 80))
        line((160, 340), (352, 340))
    elif name == "target":
        for r in (170, 105):
            d.ellipse((256 - r, 256 - r, 256 + r, 256 + r), outline=col, width=w)
        d.ellipse((246, 246, 266, 266), fill=col)
    elif name == "chat":
        d.rounded_rectangle((90, 100, 422, 340), radius=50, outline=col, width=w)
        line((170, 340), (140, 430), (250, 340))
        line((170, 200), (342, 200))
        line((170, 260), (280, 260))
    elif name == "cube":
        line((256, 64), (420, 160), (420, 352), (256, 448), (92, 352), (92, 160), (256, 64))
        line((92, 160), (256, 256), (420, 160))
        line((256, 256), (256, 448))
    elif name == "doc":
        line((150, 64), (310, 64), (400, 154), (400, 448), (150, 448), (150, 64))
        line((310, 64), (310, 154), (400, 154))
        line((200, 260), (350, 260))
        line((200, 330), (350, 330))
        line((200, 390), (290, 390))
    elif name == "lock":
        d.rounded_rectangle((120, 224, 392, 448), radius=36, outline=col, width=w)
        d.arc((170, 80, 342, 300), 180, 360, fill=col, width=w)
        d.ellipse((240, 306, 272, 338), fill=col)
    elif name == "link":
        for ox, oy in ((-52, -52), (52, 52)):
            layer = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
            ImageDraw.Draw(layer).rounded_rectangle((70 + ox, 196 + oy, 300 + ox, 316 + oy), radius=60, outline=col, width=w)
            d._image.alpha_composite(layer.rotate(-45, center=(256 + ox, 256 + oy)))
    elif name == "chart":
        line((90, 440), (430, 440))
        for x, top in ((140, 300), (230, 200), (320, 120)):
            d.rounded_rectangle((x, top, x + 60, 440), radius=10, outline=col, width=w)
    elif name == "user":
        d.ellipse((186, 80, 326, 220), outline=col, width=w)
        d.arc((106, 270, 406, 560), 180, 360, fill=col, width=w)
    elif name == "grad":
        line((256, 110), (440, 190), (256, 270), (72, 190), (256, 110))
        line((150, 235), (150, 340), (256, 395), (362, 340), (362, 235))
        line((440, 190), (440, 300))


def hex_icon(path, name, color, size=256):
    s = 512
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [(256 + 236 * math.cos(math.radians(a)), 256 + 236 * math.sin(math.radians(a))) for a in range(-90, 270, 60)]
    d.polygon(pts, fill=color + (36,), outline=color + (210,), width=8)
    glyph = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glyph)
    gd._image = glyph
    scale = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scale)
    sd._image = scale
    draw_icon(sd, name, color + (255,), 22)
    shrunk = scale.resize((int(s * .52), int(s * .52)), Image.LANCZOS)
    glyph.paste(shrunk, ((s - shrunk.width) // 2, (s - shrunk.height) // 2), shrunk)
    img = Image.alpha_composite(img, glow(glyph, 9, 1.2))
    img = glow(img, 14, .7)
    img.resize((size, size), Image.LANCZOS).save(path)


def bare_icon(path, name, color, size=256):
    s = 512
    scale = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    sd = ImageDraw.Draw(scale)
    sd._image = scale
    draw_icon(sd, name, color + (255,), 26)
    glow(scale, 10, 1.0).resize((size, size), Image.LANCZOS).save(path)


def framed(src, path, width=1440, radius=26, tone=CYAN):
    shot = Image.open(src).convert("RGBA")
    shot = shot.resize((width, round(shot.height * width / shot.width)), Image.LANCZOS)
    pad = 36
    canvas = Image.new("RGBA", (shot.width + pad * 2, shot.height + pad * 2), (0, 0, 0, 0))
    halo = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(halo).rounded_rectangle((pad, pad, pad + shot.width, pad + shot.height), radius=radius, fill=tone + (110,))
    canvas = Image.alpha_composite(canvas, halo.filter(ImageFilter.GaussianBlur(22)))
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width - 1, shot.height - 1), radius=radius, fill=255)
    canvas.paste(shot, (pad, pad), mask)
    ImageDraw.Draw(canvas).rounded_rectangle((pad, pad, pad + shot.width - 1, pad + shot.height - 1), radius=radius, outline=tone + (200,), width=3)
    canvas.save(path)


def main():
    ASSETS.mkdir(exist_ok=True)
    background(ASSETS / "bg.jpg")
    radar(ASSETS / "radar.png")
    palette = {"shield": CYAN, "scan": CYAN, "flask": MINT, "target": AMBER, "chat": VIOLET, "cube": CYAN, "doc": RED,
               "lock": MINT, "link": AMBER, "chart": CYAN, "user": CYAN, "grad": MINT}
    for name, color in palette.items():
        hex_icon(ASSETS / f"icon-{name}.png", name, color)
        bare_icon(ASSETS / f"glyph-{name}.png", name, color)
    for shot in ASSETS.glob("shot-*.png"):
        framed(shot, ASSETS / shot.name.replace("shot-", "frame-"))
    print("assets ready in", ASSETS)


if __name__ == "__main__":
    main()
