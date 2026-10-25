# -*- coding: utf-8 -*-
"""画面指标：亮度 / 近黑帧 / 内容覆盖率。输出 JSON。"""
import json, os, subprocess, sys, tempfile, glob
from PIL import Image, ImageStat

def metrics(video):
    import imageio_ffmpeg
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    d = tempfile.mkdtemp()
    subprocess.run([ff, "-y", "-hide_banner", "-loglevel", "error", "-i", video,
                    "-vf", "fps=5,scale=320:-1", os.path.join(d, "f%04d.png")], check=True)
    files = sorted(glob.glob(os.path.join(d, "*.png")))
    ys, cover = [], []
    for f in files:
        im = Image.open(f).convert("L")
        st = ImageStat.Stat(im)
        m = st.mean[0]
        ys.append(m)
        h = im.histogram()
        total = sum(h)
        bright = sum(h[25:])
        cover.append(bright / total if total else 0)
    if not ys:
        return {"ok": False, "error": "no frames"}
    return {
        "ok": True,
        "sampled": len(ys),
        "avgY": round(sum(ys) / len(ys), 2),
        "maxY": round(max(ys), 2),
        "darkPct": round(100 * sum(1 for y in ys if y < 8) / len(ys), 1),
        "brightPct": round(100 * sum(cover) / len(cover), 1),
        "minBrightPct": round(100 * min(cover), 1),
    }

if __name__ == "__main__":
    print(json.dumps(metrics(sys.argv[1]), ensure_ascii=False))
