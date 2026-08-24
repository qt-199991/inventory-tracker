from PIL import Image, ImageDraw

def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)

def make(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size
    pad = int(s * 0.08)
    # 背景圆角方块（绿）
    rounded(d, [pad, pad, s - pad, s - pad], int(s * 0.18), (46, 125, 50, 255))
    # 白色内卡片
    inner = int(s * 0.24)
    card = [inner, inner, s - inner, s - inner]
    rounded(d, card, int(s * 0.10), (255, 255, 255, 255))
    # 清单横线
    line_color = (46, 125, 50, 255)
    lx0 = int(s * 0.34); lx1 = int(s * 0.66)
    ys = [int(s * 0.40), int(s * 0.52), int(s * 0.64)]
    for y in ys:
        d.line([(lx0, y), (lx1, y)], fill=line_color, width=max(2, int(s * 0.025)))
    # 顶部对勾圆点
    cy = int(s * 0.40); cx = int(s * 0.30)
    r = int(s * 0.035)
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=line_color)
    return img

for sz in (192, 512):
    make(sz).save(f"C:/Users/tianq/WorkBuddy/2026-08-13-16-57-10/icons/icon-{sz}.png")
print("icons generated")
