"""Store the HA viewer's default materials in a GLB without re-encoding geometry.

Usage: python tools/vehicle3d/model/bake_ha_materials.py INPUT.glb OUTPUT.glb
Only JSON material properties change; all binary chunks remain byte-identical.
Lighting, tone mapping and envMapIntensity remain viewer settings.
"""
import argparse
import json
from pathlib import Path
import struct


def linear_rgb(hex_color):
    """Match Three.js Color.set(hex): sRGB input becomes linear glTF RGB."""
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]


def bake(data):
    magic, version, length = struct.unpack_from('<4sII', data)
    if magic != b'glTF' or version != 2 or length != len(data):
        raise ValueError('Expected a complete GLB v2 file')
    chunks = []
    offset = 12
    while offset < len(data):
        size, kind = struct.unpack_from('<II', data, offset)
        end = offset + 8 + size
        if size % 4 or end > len(data):
            raise ValueError('Invalid GLB chunk')
        chunks.append((kind, data[offset + 8:end]))
        offset = end
    if not chunks or chunks[0][0] != 0x4E4F534A:
        raise ValueError('Missing JSON chunk')
    model = json.loads(chunks[0][1])
    changed = []
    for material in model.get('materials', []):
        name = material.get('name', '')
        pbr = material.setdefault('pbrMetallicRoughness', {})
        if name.startswith('Artic_Blue_Metallic'):
            pbr.update(baseColorFactor=linear_rgb('#333234') + [1], metallicFactor=0.55, roughnessFactor=0.5)
            pbr.pop('baseColorTexture', None)
            material.setdefault('extensions', {}).setdefault('KHR_materials_clearcoat', {}).update(
                clearcoatFactor=0.3, clearcoatRoughnessFactor=0.45)
            used = model.setdefault('extensionsUsed', [])
            if 'KHR_materials_clearcoat' not in used:
                used.append('KHR_materials_clearcoat')
        elif name.startswith(('Windows_Ext_Clear', 'Windows_Ext_Tinted')):
            color, opacity = ('#0c1113', 0.93) if name.startswith('Windows_Ext_Clear') else ('#05090a', 0.9)
            pbr.update(baseColorFactor=linear_rgb(color) + [opacity], roughnessFactor=0.12)
            material['alphaMode'] = 'BLEND'
        elif name.startswith('Reflector_Orange'):
            pbr.update(baseColorFactor=linear_rgb('#0c0c0d') + [1], metallicFactor=0.2, roughnessFactor=0.6)
            pbr.pop('baseColorTexture', None)
            material['emissiveFactor'] = [0, 0, 0]
        else:
            continue
        changed.append(name)
    if len(changed) != 4:
        raise ValueError(f'Expected paint, reflector and two glass materials; found {changed}')
    encoded = json.dumps(model, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    encoded += b' ' * (-len(encoded) % 4)
    chunks[0] = (chunks[0][0], encoded)
    body = b''.join(struct.pack('<II', len(payload), kind) + payload for kind, payload in chunks)
    return struct.pack('<4sII', b'glTF', 2, len(body) + 12) + body, changed


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    result, changed = bake(args.input.read_bytes())
    args.output.write_bytes(result)
    print(json.dumps({'bytes': len(result), 'materials': changed}))
