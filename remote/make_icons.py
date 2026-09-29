#!/usr/bin/env python3
"""Generate the ABS Remote icons with no third-party dependencies.

A cream play triangle with two "remote" signal arcs on a pine rounded square
(the kids UI palette), written as PNGs into ./icons.
"""
import math
import os
import struct
import zlib

BG = (15, 26, 22)
TILE = (31, 58, 49)
CREAM = (242, 238, 233)
SS = 3  # supersampling factor for anti-aliasing


def write_png(path, w, h, rgba):
    raw = bytearray()
    stride = w * 4
    for y in range(h):
        raw.append(0)  # filter type 0 (None)
        raw += rgba[y * stride:(y + 1) * stride]

    def chunk(typ, data):
        return (struct.pack('>I', len(data)) + typ + data +
                struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff))

    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)))
        f.write(chunk(b'IDAT', zlib.compress(bytes(raw), 9)))
        f.write(chunk(b'IEND', b''))


def in_round_rect(x, y, x0, y0, x1, y1, r):
    if x < x0 or x > x1 or y < y0 or y > y1:
        return False
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    dx, dy = x - cx, y - cy
    return dx * dx + dy * dy <= r * r


def in_triangle(px, py, a, b, c):
    def side(p1, p2):
        return (px - p2[0]) * (p1[1] - p2[1]) - (p1[0] - p2[0]) * (py - p2[1])
    d1, d2, d3 = side(a, b), side(b, c), side(c, a)
    neg = d1 < 0 or d2 < 0 or d3 < 0
    pos = d1 > 0 or d2 > 0 or d3 > 0
    return not (neg and pos)


def in_arc(px, py, cx, cy, radius, width, half_angle):
    """A ring segment opening to the right, with round caps"""
    dx, dy = px - cx, py - cy
    dist = math.hypot(dx, dy)
    angle = math.atan2(dy, dx)
    if abs(angle) <= half_angle and abs(dist - radius) <= width / 2:
        return True
    for sign in (-1, 1):
        ex = cx + radius * math.cos(sign * half_angle)
        ey = cy + radius * math.sin(sign * half_angle)
        if math.hypot(px - ex, py - ey) <= width / 2:
            return True
    return False


def shape(u, v):
    """Foreground in unit coordinates of the content box"""
    if in_triangle(u, v, (0.2, 0.26), (0.2, 0.74), (0.56, 0.5)):
        return True
    for radius in (0.2, 0.34):
        if in_arc(u, v, 0.5, 0.5, radius, 0.075, math.radians(42)):
            return True
    return False


def render(size, pad_frac, tile):
    w = size * SS
    pad = w * pad_frac
    x0, x1 = pad, w - pad
    r = (x1 - x0) * 0.22

    out = bytearray(size * size * 4)
    for y in range(size):
        for x in range(size):
            acc = [0, 0, 0]
            for sy in range(SS):
                for sx in range(SS):
                    cx = x * SS + sx + 0.5
                    cy = y * SS + sy + 0.5
                    u = (cx - x0) / (x1 - x0)
                    v = (cy - x0) / (x1 - x0)
                    if 0 <= u <= 1 and 0 <= v <= 1 and shape(u, v):
                        c = CREAM
                    elif not tile or in_round_rect(cx, cy, x0, x0, x1, x1, r):
                        c = TILE
                    else:
                        c = BG
                    acc[0] += c[0]
                    acc[1] += c[1]
                    acc[2] += c[2]
            n = SS * SS
            o = (y * size + x) * 4
            out[o], out[o + 1], out[o + 2], out[o + 3] = acc[0] // n, acc[1] // n, acc[2] // n, 255
    return out


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, 'icons')
    os.makedirs(out_dir, exist_ok=True)
    targets = [
        # name, size, padding of the content box, draw the rounded tile
        ('icon-192.png', 192, 0.1, True),
        ('icon-512.png', 512, 0.1, True),
        ('icon-maskable-512.png', 512, 0.24, False),  # full bleed, content inside the safe zone
        ('apple-touch-icon.png', 180, 0.14, False),  # iOS rounds the corners itself
    ]
    for name, size, pad, tile in targets:
        write_png(os.path.join(out_dir, name), size, size, render(size, pad, tile))
        print('wrote', os.path.join('icons', name))


if __name__ == '__main__':
    main()
