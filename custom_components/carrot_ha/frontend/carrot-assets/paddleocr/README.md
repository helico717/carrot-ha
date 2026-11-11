# Receipt OCR runtime (on-device)

Used by `carrot-receipt-ocr.js` for fuel receipt recognition in the vehicle journal.
OCR runs in the viewer's browser; Home Assistant only serves these files.

| File | Source | License |
| --- | --- | --- |
| `det.onnx` | PaddleOCR PP-OCRv5 mobile text detection (`ch_PP-OCRv5_det_mobile`, RapidOCR ONNX export, SHA-256 `4d97c44a…78ae`) | Apache-2.0 |
| `rec.onnx`, `dict.txt` | PaddleOCR PP-OCRv5 Korean mobile recognition (`korean_PP-OCRv5_mobile_rec`, ONNX export from `monkt/paddleocr-onnx`) | Apache-2.0 |
| `ort-wasm.min.js` | onnxruntime-web 1.20.1 `dist/ort.wasm.min.mjs` (renamed to `.js`) | MIT |
| `ort-wasm-simd-threaded.js`, `.wasm` | onnxruntime-web 1.20.1 WASM backend (`.mjs` renamed to `.js`) | MIT |

The `.mjs` files are renamed so every server returns a JavaScript MIME type for module imports.
Bump `PADDLE_ASSET_VERSION` in `carrot-receipt-ocr.js` when any file here changes.
