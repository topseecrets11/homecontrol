#!/usr/bin/env python3
"""VectorRig engine for Beast OS (runs with Frame Grabber's venv: cv2, numpy, PIL).

Ported from vectorrig-studio/python-engine/engine.py (Phase 1: crop & trace), with
the parts that were stubs made real:
  trace      layered colour trace: quantise to N flat colours, one filled path per
             colour region, master 3px black outline (the original only traced the
             silhouette, white fill)
  normalize  snap fills to the character palette within 15% tolerance (the original
             returned white for every colour), force master stroke, drop gradients
  pad        joint caps: filled circles in the part's colour under the paths, so
             rotating a limb never shows a gap (the original added transparent circles)
  validate   the original quality checks (complexity, stroke consistency, hidden
             text, stray subpaths) plus empty/huge-file checks; score out of 100

usage: engine.py OP args.json   -> prints one JSON result
"""
import json
import sys
import xml.etree.ElementTree as ET

import cv2
import numpy as np

SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
MASTER_STROKE = "#000000"

PALETTES = {   # from the original engine
    "man": {"skin": ["#F5D0B0", "#E8B898", "#D4A57A"], "hair": ["#2C1810", "#4A3020", "#6B4423"],
            "clothing": ["#1E3A5F", "#2E5A8F", "#4A7AB0"]},
    "woman": {"skin": ["#FFE4D0", "#F5D0B8", "#E8BCA0"], "hair": ["#8B4513", "#A0522D", "#CD853F"],
              "clothing": ["#8B008B", "#9932CC", "#BA55D3"]},
}


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgbhex(c):
    return "#%02x%02x%02x" % tuple(int(v) for v in c)


def load_rgba(path):
    img = cv2.imread(path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError("can't read the picture")
    if img.ndim == 2:
        img = cv2.cvtColor(img, cv2.COLOR_GRAY2BGRA)
    elif img.shape[2] == 3:
        img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)
    return img


def path_d(contour):
    pts = contour.reshape(-1, 2)
    return "M " + " L ".join(f"{x},{y}" for x, y in pts) + " Z"


def op_trace(a):
    img = load_rgba(a["in"])
    h, w = img.shape[:2]
    colours = max(1, min(16, int(a.get("colours", 6))))
    detail = float(a.get("detail", 0.6))           # 0 = very simple shapes, 1 = follows every pixel
    stroke = float(a.get("stroke", 3))
    eps = 0.004 + (1 - detail) * 0.02
    alpha = img[:, :, 3]
    solid = alpha > 127
    if not solid.any():
        raise ValueError("the picture is empty (fully transparent)")
    bgr = cv2.bilateralFilter(img[:, :, :3], 7, 40, 7)
    px = bgr[solid].reshape(-1, 3).astype(np.float32)
    k = min(colours, len(px))
    _, labels, centers = cv2.kmeans(px, k, None, (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 20, 1.0), 2,
                                    cv2.KMEANS_PP_CENTERS)
    lab = np.full((h, w), -1, np.int32)
    lab[solid] = labels.ravel()
    order = np.argsort([-np.sum(labels == i) for i in range(k)])   # biggest region first (underneath)
    layers, minarea = [], max(6, h * w * 0.0002)
    for i in order:
        m = (lab == i).astype(np.uint8) * 255
        m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
        cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        ds = []
        for c in cs:
            if cv2.contourArea(c) < minarea:
                continue
            ap = cv2.approxPolyDP(c, eps * cv2.arcLength(c, True), True)
            if len(ap) >= 3:
                ds.append(path_d(ap))
        if ds:
            b, g, r = centers[i]
            layers.append({"fill": rgbhex((r, g, b)), "d": " ".join(ds)})
    # master outline from the silhouette
    sil, _ = cv2.findContours(solid.astype(np.uint8) * 255, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    outline = " ".join(path_d(cv2.approxPolyDP(c, eps * cv2.arcLength(c, True), True))
                       for c in sil if cv2.contourArea(c) >= minarea)
    svg = [f'<svg xmlns="{SVG_NS}" width="{w}" height="{h}" viewBox="0 0 {w} {h}">']
    if outline and layers:   # base fill under the colour layers, so no seams show between them
        svg.append(f'  <path class="fill base" d="{outline}" fill="{layers[0]["fill"]}" stroke="none"/>')
    for L in layers:
        svg.append(f'  <path class="fill" d="{L["d"]}" fill="{L["fill"]}" stroke="none"/>')
    if outline:
        svg.append(f'  <path class="outline" d="{outline}" fill="none" stroke="{MASTER_STROKE}" '
                   f'stroke-width="{stroke}" stroke-linejoin="round"/>')
    svg.append("</svg>")
    out = "\n".join(svg)
    open(a["out"], "w").write(out)
    return {"paths": len(layers) + (1 if outline else 0), "colours": [L["fill"] for L in layers], "w": w, "h": h,
            "bytes": len(out)}


def op_normalize(a):
    tree = ET.parse(a["in"])
    root = tree.getroot()
    pal = a.get("palette", "man")
    tol = float(a.get("tolerance", 0.15))
    stroke = float(a.get("stroke", 3))
    colours = [c for grp in PALETTES.get(pal, {}).values() for c in grp] if pal in PALETTES else []
    snapped = kept = 0
    for p in root.iter(f"{{{SVG_NS}}}path"):
        if p.get("class") == "outline" or p.get("fill") == "none":
            p.set("stroke", MASTER_STROKE)
            p.set("stroke-width", str(stroke))
            continue
        fill = p.get("fill", "#ffffff")
        if "url(" in fill:                         # gradients / textures out
            p.set("fill", "#ffffff")
            continue
        if colours and fill.startswith("#") and len(fill) == 7:
            c = np.array(hexrgb(fill), float)
            best = min(colours, key=lambda x: np.linalg.norm(c - np.array(hexrgb(x), float)))
            dist = np.linalg.norm(c - np.array(hexrgb(best), float)) / (255 * np.sqrt(3))
            if dist <= tol:
                p.set("fill", best)
                snapped += 1
            else:
                kept += 1
        p.set("stroke", "none")
    for tag in ("linearGradient", "radialGradient", "pattern", "filter"):
        for el in list(root.iter(f"{{{SVG_NS}}}{tag}")):
            for parent in root.iter():
                if el in list(parent):
                    parent.remove(el)
    tree.write(a["out"], encoding="unicode")
    return {"snapped": snapped, "kept": kept, "palette": pal, "stroke": stroke}


def op_pad(a):
    tree = ET.parse(a["in"])
    root = tree.getroot()
    r = float(a.get("radius", 10))
    fills = [p.get("fill") for p in root.iter(f"{{{SVG_NS}}}path") if p.get("fill") not in (None, "none")]
    fill = fills[0] if fills else "#ffffff"
    for old in [c for c in root if c.get("class") == "joint-padding"]:
        root.remove(old)
    for j in a.get("joints", [])[:32]:
        c = ET.Element(f"{{{SVG_NS}}}circle", {"cx": str(float(j["x"])), "cy": str(float(j["y"])), "r": str(r),
                                                "fill": fill, "class": "joint-padding",
                                                "data-joint": str(j.get("name", "joint"))[:24]})
        root.insert(0, c)
    tree.write(a["out"], encoding="unicode")
    return {"joints": len(a.get("joints", [])), "radius": r}


def op_validate(a):
    res = {"score": 100, "issues": [], "warnings": []}
    raw = open(a["in"]).read()
    root = ET.fromstring(raw)
    paths = list(root.iter(f"{{{SVG_NS}}}path"))
    if not paths:
        res["issues"].append("No shapes at all")
        res["score"] -= 50
    for i, p in enumerate(paths):
        d = p.get("d", "")
        if len(d) > 5000:
            res["warnings"].append(f"Shape {i + 1} is very detailed ({len(d)} chars): lower the detail")
            res["score"] -= 5
        if d.count("M") > 10 and p.get("class") != "outline":
            res["warnings"].append(f"Shape {i + 1} has many separate pieces (stray specks?)")
    strokes = {p.get("stroke") for p in paths if p.get("stroke") not in (None, "none")}
    if len(strokes) > 1:
        res["warnings"].append("Outline colours aren't consistent")
        res["score"] -= 10
    if list(root.iter(f"{{{SVG_NS}}}text")):
        res["issues"].append("Hidden text found: remove it")
        res["score"] -= 20
    if len(raw) > 400_000:
        res["warnings"].append(f"Large file ({len(raw) // 1024} KB)")
        res["score"] -= 5
    res["score"] = max(0, res["score"])
    res["ok"] = res["score"] >= 70 and not res["issues"]
    return res


OPS = {"trace": op_trace, "normalize": op_normalize, "pad": op_pad, "validate": op_validate}

if __name__ == "__main__":
    try:
        print(json.dumps({"ok": True, **OPS[sys.argv[1]](json.load(open(sys.argv[2])))}))
    except Exception as e:
        print(json.dumps({"ok": False, "error": f"{e.__class__.__name__}: {e}"}))
