from PIL import Image
import glob, os
files = sorted(glob.glob('src/assets/nb*.jpg'))
for f in files:
    im = Image.open(f).convert('RGB')
    w, h = im.size
    # 豆包角标在右下角：从左上裁掉 12%，保持 16:9，再压回 1600x900
    cw, ch = int(w * 0.88), int(h * 0.88)
    im = im.crop((0, 0, cw, ch)).resize((1600, 900), Image.LANCZOS)
    im.save(f, 'JPEG', quality=86, optimize=True)
print('cropped', len(files))
