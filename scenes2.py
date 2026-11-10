"""v2 scenes: built FROM the Canva renders so every scene shares their look
(painted dark navy, soft red light, grain). Output 1080x1920 PNGs in adegan2/."""
import os
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops, ImageEnhance, ImageOps

ROOT = os.path.dirname(os.path.abspath(__file__))
C = os.path.join(ROOT, "canva")
OUT = os.path.join(ROOT, "adegan2")
os.makedirs(OUT, exist_ok=True)
W, H = 1080, 1920
RED = (214, 31, 44)
SERIF = "/usr/share/texmf/fonts/opentype/public/tex-gyre/texgyrepagella-bold.otf"
TYPE = "/usr/share/texmf/fonts/opentype/public/tex-gyre/texgyrecursor-bold.otf"


def f(path, size):
    return ImageFont.truetype(path, size)


def load(name):
    return Image.open(os.path.join(C, name)).convert("RGB")


def fit(im, box=None):
    """Crop (optional) and scale to fill 1080x1920."""
    if box:
        im = im.crop(box)
    r = max(W / im.width, H / im.height)
    im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    x, y = (im.width - W) // 2, (im.height - H) // 2
    return im.crop((x, y, x + W, y + H))


def glow_layer(draw_fn, blur, strength):
    layer = Image.new("RGB", (W, H), (0, 0, 0))
    draw_fn(ImageDraw.Draw(layer))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    return lambda im: ImageChops.add(im, ImageEnhance.Brightness(layer).enhance(strength))


def centered(d, y, text, font, fill, stroke=0):
    w = d.textlength(text, font=font)
    d.text(((W - w) / 2, y), text, font=font, fill=fill, stroke_width=stroke, stroke_fill=(0, 0, 0))


# --- straight Canva scenes ---------------------------------------------------
def straight():
    for n in ("00_buku", "01_lorong", "03_kamar_0213", "04_pintu_dalam"):
        fit(load(n + ".png")).save(os.path.join(OUT, n + ".png"))


# --- 02: the door of room 13 (from the Canva door, number painted on) --------
def door13():
    im = fit(load("04_pintu_dalam.png"), (150, 0, 820, 1192))
    d = ImageDraw.Draw(im)
    # paint '13' on the upper-right panel like old house paint
    num = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    nd = ImageDraw.Draw(num)
    font = f(SERIF, 230)
    nd.text((560, 420), "13", font=font, fill=(170, 22, 32, 235))
    num = num.filter(ImageFilter.GaussianBlur(1.2))
    im = im.convert("RGBA"); im.alpha_composite(num); im = im.convert("RGB")
    add = glow_layer(lambda g: g.text((560, 420), "13", font=font, fill=(150, 10, 20)), 40, 0.9)
    return add(im)


# --- 05: the window, mother is far away ---------------------------------------
def far_away():
    im = fit(load("03_kamar_0213.png"), (0, 140, 300, 673))
    im = ImageEnhance.Brightness(im).enhance(1.15)
    return im


# --- 06: phone in the dark bedroom --------------------------------------------
def phone():
    bg = fit(load("03_kamar_0213.png")).filter(ImageFilter.GaussianBlur(14))
    bg = ImageEnhance.Brightness(bg).enhance(0.55)
    pw, ph = 600, 1150
    px, py = (W - pw) // 2, 380
    bg = glow_layer(lambda g: g.rounded_rectangle([px, py, px + pw, py + ph], 70, fill=(55, 75, 120)), 120, 0.9)(bg)
    d = ImageDraw.Draw(bg)
    d.rounded_rectangle([px, py, px + pw, py + ph], 70, fill=(8, 9, 14))
    sx, sy, sw, sh = px + 22, py + 22, pw - 44, ph - 44
    d.rounded_rectangle([sx, sy, sx + sw, sy + sh], 52, fill=(16, 20, 30))  # dark-mode chat
    d.rectangle([sx, sy + 150, sx + sw, sy + 152], fill=(40, 46, 60))
    d.ellipse([sx + 36, sy + 45, sx + 116, sy + 125], fill=(70, 80, 100))
    d.text((sx + 140, sy + 48), "ibu", font=f(TYPE, 48), fill=(225, 228, 236))
    d.text((sx + 140, sy + 100), "terakhir dilihat 22.00", font=f(TYPE, 24), fill=(130, 136, 150))
    def bubble(x, y, w, h, lines, mine=False):
        d.rounded_rectangle([x, y, x + w, y + h], 26, fill=(36, 60, 92) if mine else (36, 40, 52))
        for k, ln in enumerate(lines):
            d.text((x + 26, y + 22 + k * 42), ln, font=f(TYPE, 30), fill=(220, 224, 232))
    bubble(sx + 30, sy + 210, 330, 82, ["udah sampe kos?"])
    bubble(sx + sw - 290, sy + 320, 260, 82, ["udah bu"], mine=True)
    bubble(sx + 30, sy + 450, 470, 160, ["ibu tidur duluan", "ya nak. jangan begadang."])
    d.text((sx + 400, sy + 575), "22.00", font=f(TYPE, 22), fill=(120, 126, 140))
    d.text((sx + sw - 150, sy + sh - 80), "02.13", font=f(TYPE, 40), fill=RED)
    return bg


# --- 08: floating feet in the light under the door ----------------------------
def feet():
    base = load("04_pintu_dalam.png")
    im = fit(base, (230, 760, 760, 1703))  # floor-level view of the gap
    scale = W / 530
    def P(x, y):  # canva coords -> crop coords
        return ((x - 230) * scale, (y - 760) * scale)
    (lx, ly), (rx, ry) = P(262, 1104), P(712, 1131)   # the slanted light gap
    gy = lambda x: ly + (ry - ly) * (x - lx) / (rx - lx)
    band = lambda g, t, b, col: g.polygon([(lx, gy(lx) - t), (rx, gy(rx) - t), (rx, gy(rx) + b), (lx, gy(lx) + b)], fill=col)
    im = glow_layer(lambda g: band(g, 46, 14, (120, 140, 180)), 22, 1.0)(im)
    d = ImageDraw.Draw(im)
    band(d, 40, 8, (170, 186, 214))
    for k in (0.36, 0.62):
        cx = lx + (rx - lx) * k; y = gy(cx)
        d.rectangle([cx - 24, y - 40, cx + 24, y - 26], fill=(2, 3, 6))
        d.rounded_rectangle([cx - 60, y - 36, cx + 60, y - 15], 10, fill=(2, 3, 6))
    gx0, gx1, gyy = lx, rx, gy((lx + rx) / 2)
    # long cold light spill on the floor, no shadows of feet touching it
    im = glow_layer(lambda g: g.polygon([(gx0, gyy + 8), (gx1, gyy + 8), (gx1 + 260, H), (gx0 - 260, H)], fill=(30, 40, 62)), 60, 0.7)(im)
    return im


# --- 09: VHS pause --------------------------------------------------------------
def paused(feet_img):
    im = ImageOps.grayscale(feet_img).convert("RGB")
    im = ImageEnhance.Brightness(im).enhance(0.7)
    d = ImageDraw.Draw(im)
    d.rectangle([70, 158, 88, 214], fill=(235, 235, 235)); d.rectangle([102, 158, 120, 214], fill=(235, 235, 235))
    d.text((140, 150), "PAUSE", font=f(TYPE, 64), fill=(235, 235, 235))
    centered(d, 1080, "CERITA BERHENTI", f(SERIF, 96), (240, 240, 240), 3)
    centered(d, 1200, "DI SINI.", f(SERIF, 96), (240, 240, 240), 3)
    centered(d, 1500, "kamu yang nulis lanjutannya", f(TYPE, 50), RED, 2)
    return im


# --- 10: choice --------------------------------------------------------------------
def choice(phone_img):
    bg = Image.new("RGB", (W, H), (14, 2, 5))
    bg = glow_layer(lambda g: g.ellipse([-200, 500, W + 200, 1600], fill=(110, 10, 20)), 200, 0.8)(bg)
    door_crop = load("04_pintu_dalam.png").crop((200, 40, 760, 1150)).resize((430, 852), Image.LANCZOS)
    door_crop = ImageEnhance.Brightness(door_crop).enhance(1.4)
    bg.paste(door_crop, (50, 430))
    ph = phone_img.crop((240, 360, 840, 1550)).resize((410, 813), Image.LANCZOS)
    bg.paste(ph, (W - 460, 450))
    d = ImageDraw.Draw(bg)
    d.line([(W // 2, 430), (W // 2, 1300)], fill=(150, 20, 30), width=3)
    centered(d, 250, "KAMU PILIH", f(SERIF, 104), (240, 240, 240), 3)
    for x, letter, label in ((265, "A", "BUKA PINTU"), (W - 255, "B", "TELEPON IBU")):
        fl, fs = f(SERIF, 200), f(TYPE, 46)
        w = d.textlength(letter, font=fl); d.text((x - w / 2, 1330), letter, font=fl, fill=(240, 240, 240), stroke_width=3, stroke_fill=(0, 0, 0))
        w = d.textlength(label, font=fs); d.text((x - w / 2, 1580), label, font=fs, fill=RED)
    return bg


# --- 11: CTA ------------------------------------------------------------------------
def cta():
    bg = fit(load("04_pintu_dalam.png")).filter(ImageFilter.GaussianBlur(10))
    bg = ImageEnhance.Brightness(bg).enhance(0.45)
    d = ImageDraw.Draw(bg)
    centered(d, 640, "KOMEN", f(SERIF, 150), (240, 240, 240), 3)
    centered(d, 800, "A  atau  B", f(SERIF, 150), RED, 3)
    centered(d, 1040, "pilihan terbanyak", f(TYPE, 54), (200, 204, 214), 2)
    centered(d, 1110, "jadi kenyataan.", f(TYPE, 54), (200, 204, 214), 2)
    centered(d, 1380, "follow buat part 2", f(TYPE, 58), (240, 240, 240), 2)
    return bg


if __name__ == "__main__":
    straight()
    door13().save(os.path.join(OUT, "02_pintu13.png"))
    far_away().save(os.path.join(OUT, "05_jauh.png"))
    p = phone(); p.save(os.path.join(OUT, "06_chat_ibu.png"))
    ft = feet(); ft.save(os.path.join(OUT, "08_kaki_melayang.png"))
    paused(ft).save(os.path.join(OUT, "09_pause.png"))
    choice(p).save(os.path.join(OUT, "10_pilihan_AB.png"))
    cta().save(os.path.join(OUT, "11_komen.png"))
    print("ok")
