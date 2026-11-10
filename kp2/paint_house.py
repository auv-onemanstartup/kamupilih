"""Placeholder plate 07_rumah_desa.png (944x1680) in the Canva set's style, until the user's AI image
arrives. Village house at night seen from the yard: navy sky, crescent moon, banana trees, one warm
window, a closed front door with a dim porch. The stick figure is drawn live in film.js."""
from PIL import Image, ImageDraw, ImageFilter
import numpy as np, math
W, H = 944, 1680
rng = np.random.default_rng(7)
y = np.linspace(0, 1, H)[:, None]
sky = np.zeros((H, W, 3))
top, bot = np.array([6, 9, 20]), np.array([16, 24, 44])
sky[:] = top + (bot - top) * y[..., None][:, :, 0:1].repeat(1, 1) if False else (top + (bot - top) * y)[:, None, :].repeat(W, 1) if False else 0
for c in range(3): sky[:, :, c] = top[c] + (bot[c] - top[c]) * np.clip(y * 1.4, 0, 1)
img = Image.fromarray(sky.astype(np.uint8))
d = ImageDraw.Draw(img, "RGBA")
for _ in range(90):                                   # stars
    x, yy = rng.integers(0, W), rng.integers(0, 700); a = int(rng.integers(40, 140)); d.point((x, yy), (210, 220, 240, a))
# moon glow + crescent
glow = Image.new("L", (W, H), 0); ImageDraw.Draw(glow).ellipse((620, 150, 860, 390), 90); glow = glow.filter(ImageFilter.GaussianBlur(60))
img.paste(Image.new("RGB", (W, H), (120, 140, 190)), (0, 0), glow)
d = ImageDraw.Draw(img, "RGBA")
mm = Image.new("L", (W, H), 0); md = ImageDraw.Draw(mm); md.ellipse((690, 220, 790, 320), 255); md.ellipse((718, 204, 818, 304), 0)
img.paste(Image.new("RGB", (W, H), (235, 232, 220)), (0, 0), mm.filter(ImageFilter.GaussianBlur(1)))
d = ImageDraw.Draw(img, "RGBA")
# distant hills
pts = [(0, 1020)] + [(x, 1000 - 40 * math.sin(x / 140) - 25 * math.sin(x / 61)) for x in range(0, W + 1, 16)] + [(W, 1020), (W, H), (0, H)]
d.polygon(pts, (9, 13, 26, 255))
# ground
d.rectangle((0, 1180, W, H), (7, 10, 19, 255))
for k in range(1200, H, 6): d.line((0, k, W, k), (10, 14, 26, int(40 + 60 * (k - 1200) / (H - 1200))))
# house: body, roof, door, window, porch
d.polygon([(170, 1180), (170, 860), (780, 860), (780, 1180)], (20, 27, 46, 255))
d.polygon([(120, 880), (475, 640), (830, 880)], (12, 16, 30, 255))
d.line([(120, 880), (475, 640), (830, 880)], (40, 52, 82, 255), 6)
d.rectangle((150, 860, 800, 880), (14, 19, 34, 255))
d.rectangle((410, 950, 540, 1180), (9, 12, 22, 255)); d.rectangle((410, 950, 540, 1180), outline=(44, 56, 88, 255), width=5)
d.ellipse((515, 1060, 527, 1072), (190, 30, 40, 255))                              # red knob: the single accent
d.rectangle((600, 950, 720, 1060), (255, 196, 110, 255))                          # warm window (film.js turns it off)
d.line([(660, 950), (660, 1060)], (60, 40, 30, 255), 6); d.line([(600, 1005), (720, 1005)], (60, 40, 30, 255), 6)
d.rectangle((230, 950, 340, 1060), (11, 15, 28, 255)); d.rectangle((230, 950, 340, 1060), outline=(40, 52, 82, 255), width=4)
d.polygon([(380, 1180), (570, 1180), (640, 1330), (310, 1330)], (16, 21, 36, 255))  # path to the door
# banana trees (silhouettes)
def banana(x0, y0, s, flip=1):
    d.line([(x0, y0), (x0 + 8 * flip, y0 - 330 * s)], (5, 8, 16, 255), int(26 * s))
    top = (x0 + 8 * flip, y0 - 330 * s)
    for ang, L in ((-2.4, 230), (-1.9, 260), (-1.2, 250), (-0.6, 230), (-2.9, 190), (-0.2, 180)):
        a = ang if flip > 0 else -math.pi - ang
        ex, ey = top[0] + math.cos(a) * L * s, top[1] + math.sin(a) * L * s + 60 * s
        mx, my = (top[0] + ex) / 2, (top[1] + ey) / 2 - 40 * s
        d.polygon([top, (mx + 30 * s, my - 22 * s), (ex, ey), (mx - 30 * s, my + 22 * s)], (5, 8, 16, 255))
banana(70, 1250, 1.25, 1); banana(890, 1230, 1.1, -1); banana(30, 1500, 1.7, 1)
img = img.filter(ImageFilter.GaussianBlur(0.8))
n = (rng.normal(0, 5, (H, W, 1))).repeat(3, 2)
arr = np.clip(np.asarray(img).astype(float) + n, 0, 255).astype(np.uint8)
Image.fromarray(arr).save("kp2/assets/art/07_rumah_desa.png")
print("ok")
