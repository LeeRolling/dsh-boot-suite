import os, sys, subprocess, tempfile, threading, queue, time

D = r"F:\Lee的GitHub仓库\DeepSeek harness 开机动画\01-源码\docs\proto\division-codex"
CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
URL = "file:///" + os.path.join(D, "render.html").replace("\\", "/")
FRAMES = os.path.join(D, "frames")
FPS = 30
S0, L0, L1, E, SPEED = 3.4, 9.2, 25.45, 25.92, 1.5
V1 = L0 - S0
V2 = V1 + (L1 - L0) / SPEED
VD = V2 + (E - L1)
N = int(round(FPS * VD))  # 525

def src_time(v):
    if v <= V1: return S0 + v
    if v <= V2: return L0 + (v - V1) * SPEED
    return L1 + (v - V2)

def make_profiles(n):
    out = []
    for i in range(n):
        p = tempfile.mkdtemp(prefix="cdxprof_")
        out.append(p)
    return out

def shot(profile, f):
    t = src_time(f / FPS)
    out = os.path.join(FRAMES, "f_%04d.png" % f)
    if os.path.exists(out) and os.path.getsize(out) > 5000:
        return True
    for attempt in range(3):
        if os.path.exists(out):
            try: os.remove(out)
            except OSError: pass
        cmd = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars",
               "--window-size=1920,1080", "--user-data-dir=" + profile,
               "--virtual-time-budget=6000", "--screenshot=" + out,
               URL + "?t=%.4f" % t]
        try:
            subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
        except subprocess.TimeoutExpired:
            continue
        if os.path.exists(out) and os.path.getsize(out) > 5000:
            return True
    return False

def worker(profile, q, fails):
    while True:
        try: f = q.get_nowait()
        except queue.Empty: return
        ok = shot(profile, f)
        if not ok:
            fails.append(f)

def main():
    os.makedirs(FRAMES, exist_ok=True)
    todo = [f for f in range(N) if not (os.path.exists(os.path.join(FRAMES, "f_%04d.png" % f)) and os.path.getsize(os.path.join(FRAMES, "f_%04d.png" % f)) > 5000)]
    print("frames to render:", len(todo), "total:", N, flush=True)
    q = queue.Queue()
    for f in todo: q.put(f)
    fails = []
    profiles = make_profiles(3)
    ths = [threading.Thread(target=worker, args=(profiles[i], q, fails)) for i in range(3)]
    t0 = time.time()
    for th in ths: th.start()
    for th in ths: th.join()
    print("fails:", fails[:10], "count", len(fails), "elapsed", round(time.time()-t0), flush=True)
    mp4 = os.path.join(D, "division-codex-1080p30.mp4")
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
                    "-framerate", str(FPS), "-i", os.path.join(FRAMES, "f_%04d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
                    "-movflags", "+faststart", mp4], check=True)
    print("mp4:", mp4, os.path.getsize(mp4), flush=True)

if __name__ == "__main__":
    main()
