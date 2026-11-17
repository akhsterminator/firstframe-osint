# Bundled models

## `ultraface-rfb-320.onnx`

Ultra-Light-Fast-Generic-Face-Detector-1MB, RFB-320 variant, ONNX export.
Source: https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB
License: MIT
SHA-256: `34cd7e60aeff28744c657de7a3dc64e872d506741de66987f3426f2b79f88017`

FirstFrame uses this model for one thing only: finding face regions so they can
be blurred before a frame is stored, shown or shared. It produces boxes, not
embeddings. Nothing in this project compares, matches or identifies faces.
