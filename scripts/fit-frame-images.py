"""把豆包下载的原图（2848×1600 PNG，右下角带「豆包 AI 生成」角标）
裁掉右侧与底部各 12%，等比压回 1600×900 JPG，供 FallStage 使用。

用法：python scripts/fit-frame-images.py [前缀...]
不带参数时处理全部七朝的 21 张（按 *_1/_2/_3 命名）。
"""
import sys
from pathlib import Path

from PIL import Image

ASSETS = Path("src/assets")
PREFIXES = ["sui", "tang", "fd", "song", "yuan", "ming", "qing"]
TARGET = (1600, 900)


def fit(src: Path) -> Path:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    # 角标固定在右下角：裁掉右 12% + 下 12%，16:9 比例不变
    cw, ch = int(w * 0.88), int(h * 0.88)
    im = im.crop((0, 0, cw, ch)).resize(TARGET, Image.LANCZOS)
    out = src.with_suffix(".jpg")
    im.save(out, "JPEG", quality=86, optimize=True)
    src.unlink()
    return out


def main(argv: list[str]) -> None:
    prefixes = argv or PREFIXES
    done = []
    for prefix in prefixes:
        for n in (1, 2, 3):
            src = ASSETS / f"{prefix}_{n}.png"
            if not src.exists():
                print(f"skip  {src.name}（还没下载）")
                continue
            out = fit(src)
            done.append(out.name)
            print(f"ok    {out.name}  {out.stat().st_size // 1024} KB")
    print(f"共 {len(done)} 张")


if __name__ == "__main__":
    main(sys.argv[1:])
