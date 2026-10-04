"""
Ritar en liten glTF-modell till en bild med genomskinlig bakgrund (ren numpy, inget GL).

Används av build_hemmet.py för meeting stone i gruppsöket. Texturerad, z-buffrad och mjukt belyst;
räcker gott för modeller med några hundra trianglar.
"""
import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

DTYPE = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
WIDTH = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def render(gltf_path, textures, out_h=640, yaw=0.0, pitch=8.0, ss=2):
    """textures: materialnamn → bildfil. Primitiver vars material saknas i textures hoppas över."""
    gltf_path = Path(gltf_path)
    g = json.loads(gltf_path.read_text())
    buf = (gltf_path.parent / g["buffers"][0]["uri"]).read_bytes()

    def acc(i):
        a = g["accessors"][i]
        v = g["bufferViews"][a["bufferView"]]
        n = WIDTH[a["type"]]
        arr = np.frombuffer(buf, DTYPE[a["componentType"]], a["count"] * n, v.get("byteOffset", 0) + a.get("byteOffset", 0))
        return arr.reshape(a["count"], n) if n > 1 else arr

    prims = []
    for mesh in g["meshes"]:
        for p in mesh["primitives"]:
            name = g["materials"][p["material"]]["name"]
            if name in textures:
                at = p["attributes"]
                prims.append((acc(at["POSITION"]).astype(float), acc(at["NORMAL"]).astype(float), acc(at["TEXCOORD_0"]).astype(float),
                              acc(p["indices"]).reshape(-1, 3), np.asarray(Image.open(textures[name]).convert("RGBA"), float) / 255))

    # kameran: vrid runt y (yaw), luta lite (pitch); x höger, y upp, z mot betraktaren
    cy, sy, cp, sp = math.cos(math.radians(yaw)), math.sin(math.radians(yaw)), math.cos(math.radians(pitch)), math.sin(math.radians(pitch))
    R = np.array([[1, 0, 0], [0, cp, -sp], [0, sp, cp]]) @ np.array([[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]])
    allp = np.vstack([p[0] for p in prims]) @ R.T
    lo, hi = allp.min(0), allp.max(0)
    H = out_h * ss
    scale = (H * .94) / (hi[1] - lo[1])
    W = int(math.ceil((hi[0] - lo[0]) * scale + H * .06))
    light = np.array([-.45, .55, .7]); light /= np.linalg.norm(light)

    color = np.zeros((H, W, 4)); zbuf = np.full((H, W), -1e9)
    for P, N, UV, IDX, tex in prims:
        P = P @ R.T; N = N @ R.T
        sx = (P[:, 0] - lo[0]) * scale + H * .03
        sy_ = H - ((P[:, 1] - lo[1]) * scale + H * .03)
        th, tw = tex.shape[:2]
        for i0, i1, i2 in IDX:
            x0, y0, x1, y1, x2, y2 = sx[i0], sy_[i0], sx[i1], sy_[i1], sx[i2], sy_[i2]
            area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)
            if abs(area) < 1e-9:
                continue
            xa, xb = max(0, int(min(x0, x1, x2))), min(W - 1, int(max(x0, x1, x2)) + 1)
            ya, yb = max(0, int(min(y0, y1, y2))), min(H - 1, int(max(y0, y1, y2)) + 1)
            if xa > xb or ya > yb:
                continue
            xs, ys = np.meshgrid(np.arange(xa, xb + 1) + .5, np.arange(ya, yb + 1) + .5)
            w0 = ((x1 - xs) * (y2 - ys) - (x2 - xs) * (y1 - ys)) / area
            w1 = ((x2 - xs) * (y0 - ys) - (x0 - xs) * (y2 - ys)) / area
            w2 = 1 - w0 - w1
            inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
            if not inside.any():
                continue
            z = w0 * P[i0, 2] + w1 * P[i1, 2] + w2 * P[i2, 2]
            u = (w0 * UV[i0, 0] + w1 * UV[i1, 0] + w2 * UV[i2, 0]) % 1
            v = (w0 * UV[i0, 1] + w1 * UV[i1, 1] + w2 * UV[i2, 1]) % 1
            texel = tex[np.minimum((v * th).astype(int), th - 1), np.minimum((u * tw).astype(int), tw - 1)]
            n = w0[..., None] * N[i0] + w1[..., None] * N[i1] + w2[..., None] * N[i2]
            n /= np.maximum(np.linalg.norm(n, axis=2, keepdims=True), 1e-9)
            shade = .62 + .55 * np.clip(np.abs(n @ light), 0, 1)     # abs: baksidor (tunna skyltar) belyses också
            sub_z = zbuf[ya:yb + 1, xa:xb + 1]; sub_c = color[ya:yb + 1, xa:xb + 1]
            hit = inside & (z > sub_z) & (texel[..., 3] > .5)
            sub_z[hit] = z[hit]
            sub_c[hit, :3] = np.clip(texel[hit, :3] * shade[hit, None], 0, 1)
            sub_c[hit, 3] = 1
    img = Image.fromarray((color * 255).astype(np.uint8), "RGBA")
    img = img.resize((W // ss, H // ss), Image.LANCZOS)
    return img.crop(img.getbbox())
