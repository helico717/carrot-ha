#!/bin/sh
# Bundle the 3D viewer (three.js + GLTFLoader + meshopt) into one ES module for HA.
# Needs `three` and `esbuild` installed in a node_modules directory passed as $1
# (kept outside the repository). Usage: tools/vehicle3d/build.sh /path/to/node_modules
set -e
cd "$(dirname "$0")"
NM="${1:?path to node_modules containing three and esbuild}"
NODE_PATH="$NM" "$NM/.bin/esbuild" viewer.src.js --bundle --minify --format=esm --target=es2020 \
  --outfile=../../custom_components/carrot_ha/frontend/carrot-assets/vehicle-3d.js \
  --legal-comments=none
