"""Draw the KAMU PILIH Part 1 scenes that Canva could not generate.
Palette matches the Canva scenes: near-black navy, single red accent, white stick figure."""
import math, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1080, 1920
NAVY = (9, 14, 26)
NAVY2 = (18, 28, 48)
RED = (214, 31, 44)
WHITE = (236, 238, 242)
BOLD = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
INTER = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"
random.seed(13)


def font(size, path=BOLD):
    return ImageFont.truetype(path, size)


def base(color_top=NAVY2, color_bottom=NAVY):
    im = Image.new("RGB", (W, H), color_bottom)
    d = ImageDraw.Draw(im)
    for y in range(H):
        t = y / H
        c = tuple(int(color_top[i] * (1 - t) + color_bottom[i] * t) for i in range(3))
        d.line([(0, y), (W, y)], fill=c)
    return im


def finish(im):
    """Vignette + film grain so code-drawn scenes sit next to the Canva ones."""
    small = Image.new("L", (108, 192), 0)
    px = small.load()
    for y in range(192):
        for x in range(108):
            dx, dy = (x - 54) / 54, (y - 96) / 96
            r = math.sqrt(dx * dx + dy * dy)
            px[x, y] = int(255 * max(0.0, min(1.0, 1.25 - 0.55 * r * r)))
    vig = small.resize((W, H), Image.BICUBIC)
    dark = Image.new("RGB", (W, H), (0, 0, 0))
    im = Image.composite(im, dark, vig)
    noise = Image.effect_noise((W, H), 18).convert("RGB")
    return Image.blend(im, noise, 0.04)


def centered(d, y, text, f, fill):
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)


def glow(im, box, color, radius=60, strength=1.0):
    layer = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius=20, fill=color)
    layer = layer.filter(ImageFilter.GaussianBlur(radius))
    return Image.blend(im, Image.eval(Image.composite(layer, im, layer.convert("L")), lambda v: v), 0.0) if strength == 0 else _add(im, layer, strength)


def _add(a, b, k):
    from PIL import ImageChops
    return ImageChops.add(a, Image.eval(b, lambda v: int(v * k)))


# ---- Scene 5: kamu vs ibu, 300 km ------------------------------------------
def scene5():
    im = base()
    d = ImageDraw.Draw(im)
    # stars
    for _ in range(90):
        x, y = random.randint(0, W), random.randint(0, 900)
        d.point((x, y), fill=(120, 130, 160))
    # moon
    d.ellipse([760, 220, 880, 340], fill=(200, 205, 215))
    # two points + dotted path
    kx, ky, ix, iy = 260, 1380, 820, 640
    steps = 34
    for i in range(steps):
        if i % 2:
            continue
        t0, t1 = i / steps, (i + 1) / steps
        x0 = kx + (ix - kx) * t0 + math.sin(t0 * math.pi) * 120
        y0 = ky + (iy - ky) * t0
        x1 = kx + (ix - kx) * t1 + math.sin(t1 * math.pi) * 120
        y1 = ky + (iy - ky) * t1
        d.line([(x0, y0), (x1, y1)], fill=(150, 160, 185), width=6)
    # kos building (you)
    d.rectangle([180, 1300, 340, 1460], fill=(30, 42, 66))
    d.rectangle([240, 1350, 280, 1395], fill=(240, 200, 120))
    # village house (ibu)
    d.polygon([(760, 640), (820, 580), (880, 640)], fill=(30, 42, 66))
    d.rectangle([770, 640, 870, 720], fill=(30, 42, 66))
    d.ellipse([802, 660, 838, 696], fill=RED)
    f = font(46)
    d.text((140, 1490), "KAMU", font=f, fill=WHITE)
    d.text((760, 740), "IBU", font=f, fill=RED)
    centered(d, 1010, "300 KM", font(110), WHITE)
    return finish(im)


# ---- Scene 6: phone with chat ----------------------------------------------
def scene6():
    im = base((12, 18, 32), (5, 8, 16))
    pw, ph = 620, 1180
    px, py = (W - pw) // 2, 360
    # glow
    g = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(g).rounded_rectangle([px, py, px + pw, py + ph], 70, fill=(70, 90, 140))
    im = _add(im, g.filter(ImageFilter.GaussianBlur(110)), 0.8)
    d = ImageDraw.Draw(im)
    # hand (stick figure white)
    # phone
    d.rounded_rectangle([px, py, px + pw, py + ph], 70, fill=(20, 22, 30))
    sx, sy, sw, sh = px + 26, py + 26, pw - 52, ph - 52
    d.rounded_rectangle([sx, sy, sx + sw, sy + sh], 52, fill=(232, 234, 238))
    # header
    d.rounded_rectangle([sx, sy, sx + sw, sy + 170], 52, fill=(40, 48, 66))
    d.rectangle([sx, sy + 100, sx + sw, sy + 170], fill=(40, 48, 66))
    d.ellipse([sx + 40, sy + 55, sx + 120, sy + 135], fill=(150, 160, 185))
    d.text((sx + 145, sy + 60), "ibu", font=font(46), fill=WHITE)
    d.text((sx + 145, sy + 115), "terakhir dilihat 22.00", font=font(26, INTER), fill=(180, 186, 200))
    # older bubble
    d.rounded_rectangle([sx + 40, sy + 240, sx + 400, sy + 330], 30, fill=WHITE)
    d.text((sx + 70, sy + 263), "udah sampe kos?", font=font(32, INTER), fill=(30, 34, 44))
    d.rounded_rectangle([sx + sw - 330, sy + 360, sx + sw - 40, sy + 450], 30, fill=(200, 222, 255))
    d.text((sx + sw - 300, sy + 383), "udah bu ❤", font=font(32, INTER), fill=(30, 34, 44))
    # key message
    bx0, by0 = sx + 40, sy + 520
    d.rounded_rectangle([bx0, by0, bx0 + 470, by0 + 200], 30, fill=WHITE)
    d.text((bx0 + 30, by0 + 28), "ibu tidur duluan ya nak.", font=font(32, INTER), fill=(30, 34, 44))
    d.text((bx0 + 30, by0 + 78), "jangan begadang.", font=font(32, INTER), fill=(30, 34, 44))
    d.text((bx0 + 360, by0 + 145), "22.00", font=font(24, INTER), fill=(130, 136, 150))
    # clock in status bar style: now 02.13 in red
    d.text((sx + sw - 170, sy + sh - 90), "02.13", font=font(40), fill=RED)
    return finish(im)


# ---- Scene 8: floating feet under the door ----------------------------------
def scene8():
    im = base((14, 20, 34), (6, 9, 18))
    d = ImageDraw.Draw(im)
    floor_y, gap_h = 1180, 90
    top = floor_y - gap_h
    d.rectangle([0, 0, W, top], fill=(22, 28, 44))
    d.rectangle([0, floor_y, W, H], fill=(8, 10, 18))
    light = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(light).rectangle([0, top, W, floor_y], fill=(215, 222, 236))
    im = _add(im, light.filter(ImageFilter.GaussianBlur(10)), 0.9)
    spill = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(spill).polygon([(120, floor_y), (W - 120, floor_y), (W + 150, H), (-150, H)], fill=(40, 48, 66))
    im = _add(im, spill.filter(ImageFilter.GaussianBlur(90)), 0.6)
    d = ImageDraw.Draw(im)
    d.rectangle([0, top + 6, W, floor_y - 2], fill=(226, 232, 244))
    hover = 30  # light visible under the feet
    for cx in (410, 670):
        # ankle coming down from the top of the gap, foot pointing toward the viewer
        d.rectangle([cx - 38, top, cx + 38, floor_y - hover - 30], fill=(3, 4, 8))
        d.rounded_rectangle([cx - 70, floor_y - hover - 46, cx + 70, floor_y - hover], 22, fill=(3, 4, 8))
    tint = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(tint).ellipse([330, floor_y - 40, 750, floor_y + 240], fill=(130, 10, 22))
    im = _add(im, tint.filter(ImageFilter.GaussianBlur(70)), 0.5)
    return finish(im)


# ---- Scene 10: choice screen -------------------------------------------------
def scene10():
    im = base((70, 8, 14), (24, 2, 6))
    d = ImageDraw.Draw(im)
    d.line([(W // 2, 300), (W // 2, 1620)], fill=(120, 20, 30), width=4)
    # left: door
    d.rectangle([110, 520, 430, 1180], fill=(26, 12, 16), outline=(240, 220, 220), width=8)
    d.ellipse([385, 840, 410, 865], fill=(240, 220, 220))
    d.text((235, 610), "13", font=font(80), fill=RED)
    # right: phone
    d.rounded_rectangle([680, 560, 940, 1140], 40, fill=(20, 10, 14), outline=(240, 220, 220), width=8)
    d.rounded_rectangle([705, 600, 915, 1080], 20, fill=(70, 90, 130))
    d.text((745, 790), "☎", font=font(110, "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"), fill=WHITE)
    fA = font(190)
    d.text((200, 1220), "A", font=fA, fill=WHITE)
    d.text((740, 1220), "B", font=fA, fill=WHITE)
    f = font(50)
    w = d.textlength("BUKA PINTU", font=f)
    d.text((270 - w / 2, 1470), "BUKA PINTU", font=f, fill=WHITE)
    w = d.textlength("TELEPON IBU", font=f)
    d.text((810 - w / 2, 1470), "TELEPON IBU", font=f, fill=WHITE)
    centered(d, 330, "KAMU PILIH", font(84), WHITE)
    return finish(im)


# ---- Scene 11: comment CTA --------------------------------------------------
def scene11():
    im = Image.new("RGB", (W, H), (4, 5, 9))
    d = ImageDraw.Draw(im)
    # comment bubble icon
    d.rounded_rectangle([390, 470, 690, 700], 50, outline=WHITE, width=16)
    d.polygon([(450, 690), (450, 790), (540, 696)], fill=WHITE)
    for i, x in enumerate((470, 540, 610)):
        d.ellipse([x - 18, 567, x + 18, 603], fill=RED if i == 1 else WHITE)
    centered(d, 880, "KOMEN A / B", font(130), WHITE)
    centered(d, 1060, "pilihan terbanyak", font(64), (190, 196, 210))
    centered(d, 1140, "= KENYATAAN", font(80), RED)
    centered(d, 1420, "FOLLOW BUAT PART 2", font(68), WHITE)
    d.polygon([(500, 1560), (580, 1560), (540, 1630)], fill=WHITE)
    return finish(im)


# ---- Corner label used across the whole video -------------------------------
def label():
    im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    f = font(34)
    text = "ALUR DITENTUKAN PENONTON"
    tw = d.textlength(text, font=f)
    x1, y1 = W - 50, 120
    x0 = x1 - tw - 110
    d.rounded_rectangle([x0, y1, x1, y1 + 74], 37, fill=(0, 0, 0, 150), outline=(214, 31, 44, 255), width=3)
    d.ellipse([x0 + 28, y1 + 25, x0 + 52, y1 + 49], fill=RED)
    d.text((x0 + 72, y1 + 14), text, font=f, fill=WHITE)
    return im


if __name__ == "__main__":
    out = "/home/claude/kamupilih/adegan"
    import os
    os.makedirs(out, exist_ok=True)
    scene5().save(f"{out}/05_ibu_300km.png")
    scene6().save(f"{out}/06_chat_ibu.png")
    scene8().save(f"{out}/08_kaki_melayang.png")
    scene10().save(f"{out}/10_pilihan_AB.png")
    scene11().save(f"{out}/11_komen_follow.png")
    label().save(f"{out}/label_pojok.png")
    print("ok")


# ===== Scenes 0-4 drawn in code (Canva full-res files are not reachable) =====
def stick(d, cx, base_y, h=420, color=WHITE, sitting=False, suitcase=False):
    """Faceless stick figure: head + body + limbs, thick rounded strokes."""
    r = h * 0.12
    w = int(h * 0.05)
    hy = base_y - h + r
    d.ellipse([cx - r, hy - r, cx + r, hy + r], fill=color)
    neck = hy + r
    hip = base_y - h * 0.42 if not sitting else base_y - h * 0.15
    d.line([(cx, neck), (cx, hip)], fill=color, width=w)
    d.line([(cx, neck + h * 0.08), (cx - h * 0.16, hip - h * 0.05)], fill=color, width=w)
    d.line([(cx, neck + h * 0.08), (cx + h * 0.18, hip)], fill=color, width=w)
    if not sitting:
        d.line([(cx, hip), (cx - h * 0.12, base_y)], fill=color, width=w)
        d.line([(cx, hip), (cx + h * 0.10, base_y)], fill=color, width=w)
    if suitcase:
        sx = cx + h * 0.18
        d.rounded_rectangle([sx, hip - 10, sx + h * 0.3, hip + h * 0.32], 14, fill=(150, 30, 40))
    for p in [(cx, neck), (cx, hip)]:
        d.ellipse([p[0] - w / 2, p[1] - w / 2, p[0] + w / 2, p[1] + w / 2], fill=color)


def scene0():
    im = base((10, 12, 20), (4, 5, 9))
    # candle glow
    g = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(g).ellipse([180, 520, 560, 900], fill=(160, 40, 30))
    im = _add(im, g.filter(ImageFilter.GaussianBlur(120)), 0.9)
    d = ImageDraw.Draw(im)
    # table
    d.rectangle([0, 1250, W, H], fill=(16, 12, 14))
    # candle
    d.rectangle([340, 760, 380, 1000], fill=(200, 40, 48))
    d.ellipse([348, 700, 372, 760], fill=(255, 210, 140))
    # open book (perspective trapezoids)
    left = [(150, 1150), (540, 1110), (540, 1480), (110, 1520)]
    right = [(540, 1110), (930, 1150), (970, 1520), (540, 1480)]
    d.polygon([(100, 1165), (540, 1125), (980, 1165), (1010, 1545), (540, 1500), (70, 1545)], fill=(40, 30, 32))
    d.polygon(left, fill=(150, 140, 128))
    d.polygon(right, fill=(205, 196, 180))
    for i in range(9):  # lines of text on the left page only
        y = 1170 + i * 34
        d.line([(185, y + 4 - i * 0.6), (500, y - 2)], fill=(95, 88, 80), width=6)
    # bookmark ribbon (red)
    d.polygon([(560, 1480), (590, 1480), (590, 1640), (575, 1615), (560, 1640)], fill=RED)
    # blinking cursor on the empty page
    d.rectangle([735, 1290, 745, 1350], fill=(40, 40, 46))
    return finish(im)


def scene1():
    im = base((16, 22, 38), (6, 8, 16))
    d = ImageDraw.Draw(im)
    vx, vy = W // 2, 860  # vanishing point
    # corridor walls / floor / ceiling
    d.polygon([(0, 0), (vx - 120, vy - 260), (vx - 120, vy + 200), (0, H)], fill=(20, 26, 42))
    d.polygon([(W, 0), (vx + 120, vy - 260), (vx + 120, vy + 200), (W, H)], fill=(17, 22, 37))
    d.polygon([(0, H), (vx - 120, vy + 200), (vx + 120, vy + 200), (W, H)], fill=(11, 14, 24))
    d.rectangle([vx - 120, vy - 260, vx + 120, vy + 200], fill=(4, 5, 10))
    # doors along walls
    for k, t in enumerate([0.15, 0.4, 0.62, 0.8]):
        for side in (-1, 1):
            x_out = 0 if side < 0 else W
            x_in = vx + side * 120
            x0 = x_out + (x_in - x_out) * t
            x1 = x_out + (x_in - x_out) * (t + 0.1)
            top0 = 0 + (vy - 260) * t + 120 * (1 - t)
            bot0 = H + (vy + 200 - H) * t
            top1 = 0 + (vy - 260) * (t + 0.1) + 120 * (1 - t - 0.1)
            bot1 = H + (vy + 200 - H) * (t + 0.1)
            d.polygon([(x0, top0 + (bot0 - top0) * 0.25), (x1, top1 + (bot1 - top1) * 0.25), (x1, bot1), (x0, bot0)], fill=(30, 38, 58))
    # ceiling lamp (red, flickering one)
    g = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(g).ellipse([vx - 260, 260, vx + 260, 700], fill=(150, 20, 30))
    im = _add(im, g.filter(ImageFilter.GaussianBlur(110)), 0.8)
    d = ImageDraw.Draw(im)
    d.line([(vx, 0), (vx, 330)], fill=(60, 60, 70), width=6)
    d.polygon([(vx - 70, 330), (vx + 70, 330), (vx + 40, 390), (vx - 40, 390)], fill=RED)
    # light pool on floor
    p = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(p).ellipse([vx - 330, 1380, vx + 330, 1640], fill=(110, 20, 30))
    im = _add(im, p.filter(ImageFilter.GaussianBlur(60)), 0.7)
    d = ImageDraw.Draw(im)
    stick(d, vx - 40, 1560, h=520, suitcase=True)
    return finish(im)


def door(d, x0, y0, x1, y1, number=None):
    d.rectangle([x0 - 26, y0 - 26, x1 + 26, y1], fill=(14, 18, 30))
    d.rectangle([x0, y0, x1, y1], fill=(30, 38, 58))
    pad = 60
    mid = (y0 + y1) // 2
    d.rectangle([x0 + pad, y0 + pad, x1 - pad, mid - 30], outline=(22, 28, 44), width=8)
    d.rectangle([x0 + pad, mid + 30, x1 - pad, y1 - pad], outline=(22, 28, 44), width=8)
    d.ellipse([x1 - 90, mid - 20, x1 - 50, mid + 20], fill=(150, 156, 170))
    if number:
        f = font(170)
        tw = d.textlength(number, font=f)
        d.text(((x0 + x1 - tw) / 2, y0 + 150), number, font=f, fill=RED)


def scene2():
    im = base((16, 22, 38), (5, 7, 14))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 1580, W, H], fill=(9, 11, 20))
    door(d, 260, 360, 820, 1580, number="13")
    g = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(g).ellipse([360, 420, 720, 700], fill=(120, 15, 25))
    im = _add(im, g.filter(ImageFilter.GaussianBlur(80)), 0.6)
    return finish(im)


def scene3():
    im = base((12, 18, 32), (5, 7, 14))
    d = ImageDraw.Draw(im)
    # window with moonlight
    d.rectangle([110, 420, 420, 820], fill=(24, 34, 56))
    d.line([(265, 420), (265, 820)], fill=(12, 16, 28), width=10)
    d.line([(110, 620), (420, 620)], fill=(12, 16, 28), width=10)
    # red clock glow
    g = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(g).rounded_rectangle([600, 470, 980, 680], 30, fill=(170, 20, 30))
    im = _add(im, g.filter(ImageFilter.GaussianBlur(70)), 0.7)
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([630, 500, 950, 650], 22, fill=(18, 6, 8))
    f = font(110)
    tw = d.textlength("02:13", font=f)
    d.text((790 - tw / 2, 505), "02:13", font=f, fill=RED)
    # bed
    d.rounded_rectangle([60, 1240, 1020, 1420], 30, fill=(32, 40, 62))
    d.rounded_rectangle([90, 1150, 360, 1260], 40, fill=(70, 80, 104))  # pillow
    d.rounded_rectangle([60, 1400, 110, 1600], 10, fill=(20, 26, 42))
    d.rounded_rectangle([970, 1400, 1020, 1600], 10, fill=(20, 26, 42))
    # sitting figure under a blanket
    stick(d, 330, 1250, h=470, sitting=True)
    d.rounded_rectangle([260, 1190, 1000, 1330], 50, fill=(44, 54, 80))
    return finish(im)


def scene4():
    im = base((10, 14, 26), (4, 6, 12))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 1500, W, H], fill=(7, 9, 16))
    door(d, 220, 260, 860, 1500)
    light = Image.new("RGB", (W, H), (0, 0, 0))
    ImageDraw.Draw(light).rectangle([220, 1488, 860, 1500], fill=(220, 228, 240))
    im = _add(im, light.filter(ImageFilter.GaussianBlur(18)), 1.0)
    d = ImageDraw.Draw(im)
    d.rectangle([230, 1491, 850, 1499], fill=(230, 236, 246))
    # red blanket edge in the foreground (we're in bed)
    d.ellipse([-300, 1650, 700, 2300], fill=(90, 12, 20))
    return finish(im)


def render_all_code_scenes(out="/home/claude/kamupilih/adegan"):
    scene0().save(f"{out}/00_buku.png")
    scene1().save(f"{out}/01_lorong.png")
    scene2().save(f"{out}/02_pintu13.png")
    scene3().save(f"{out}/03_kamar_0213.png")
    scene4().save(f"{out}/04_pintu_dalam.png")
