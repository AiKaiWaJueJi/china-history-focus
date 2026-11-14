from PIL import Image
import glob, os
files = sorted(glob.glob('src/assets/nb*.png'))
for f in files:
    im = Image.open(f).convert('RGB')
    w, h = im.size
    target = (1600, 900)
    # 等比缩放到 cover 1600x900，再居中裁切
    scale = max(target[0] / w, target[1] / h)
    nw, nh = int(w * scale + 0.5), int(h * scale + 0.5)
    im = im.resize((nw, nh), Image.LANCZOS)
    left = (nw - target[0]) // 2
    top = (nh - target[1]) // 2
    im = im.crop((left, top, left + target[0], top + target[1]))
    out = f.replace('.png', '.jpg')
    im.save(out, 'JPEG', quality=86, optimize=True)
    os.remove(f)
    print(out, im.size, os.path.getsize(out))
