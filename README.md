# Shrinkr 🗜️
![Status Badge](https://img.shields.io/badge/Status-Submitted%20%E2%80%94%20MACS%20JC%20Project%202-success)

## Overview
Shrinkr is a Chrome Extension designed to compress text, images, audio, and video files directly in the browser. It supports `.txt`, `.csv`, `.png`, `.jpg`, `.jpeg`,    `.mp3`, `.wav` and `.mp4` formats. The extension utilizes local, browser-based compression to ensure privacy and fast processing, leveraging native Canvas APIs and WebAssembly (FFmpeg) to achieve a balance between file size reduction and quality.

## Team Members:

| Name                  | Role / Contribution                        | Contribution % |
| --------------------- | ------------------------------------------ |  ------------- |
| **Vidit Arora**       | Integration, Testing, Documentation and UI | 16.67% |
| **Kartik Sisodia**    | Decompression                              | 16.67% |
| **Sumit Singh**       | Lossless Compression                       | 16.67% |
| **Shivam Sinha**      | Lossless Compression                       | 16.67% |
| **Hussain**           | Lossy Compression                          | 16.67% |
| **Govind Khandelwal** | Lossy Compression                          | 16.67% |

## Features
*   **Multi-format Support:** Compress text (`.txt`, `.csv`), images (`.png`, `.jpg`, `.jpeg`), audio (`.mp3`), and video (`.mp4`).
*   **Lossless & Lossy Compression:** GZIP for text, UPNG/Canvas for images, MP3 encoding, and H.264 video compression.
*   **Real-time Metrics:** Displays Original Size, Compressed Size, Compression Ratio, and Space Savings Percentage upon completion.
*   **Rebuild & Hash Verification:** Allows decompression testing. For lossless files, it verifies the rebuild against the original using a SHA-256 hash.
*   **Quality Assessment:** Calculates Peak Signal-to-Noise Ratio (PSNR) for lossy image compression to track quality loss.
*   **Graceful Error Handling:** Invalid file types and processing errors are caught and shown cleanly in the UI.

## Installation
To test and install the `.crx` file (or unpacked extension) in Chrome:

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle the **Developer Mode** switch in the top-right corner to **ON**.
3. *Option A (Unpacked):* Click **Load unpacked** and select the folder containing the `manifest.json` file.
4. *Option B (.crx file):* Simply drag and drop the `.crx` file directly into the extensions page.
5. Pin the extension to your toolbar for quick access.

## How to Use
1. Click the MACS Compressor icon in the Chrome toolbar to open the extension popup.
2. Click **Choose a file to compress** and select a supported file.
3. Click the **Compress File** button and wait for the process to finish.
4. Review the size reduction metrics displayed.
5. Click **Download Compressed File** to save it.
6. To verify the file, select the downloaded compressed file under the **Decompress & Verify** section and click the verify button.

> **Screenshot Placeholder:**
> *[Please insert a screenshot of the UI showing the compression of a file here. E.g. `![Compression UI](assets/ui-compression.png)`]*
>
> *[Please insert a screenshot of the UI showing the decompression/verification process here. E.g. `![Decompression UI](assets/ui-verify.png)`]*

## Compression Results
*(Test these with real files and fill out the table below. Here is an example structure)*

| File Type | File Name | Original Size | Compressed Size | Compression Ratio | Space Savings (%) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Text | `sample.txt` | 150 KB | 45 KB | 3.33:1 | 70.00% |
| Image (JPEG) | `photo.jpg` | 2.5 MB | 850 KB | 2.94:1 | 66.00% |
| Audio (MP3) | `song.wav` | 30 MB | 3 MB | 10.00:1 | 90.00% |
| Video (MP4) | `clip.mp4` | 50 MB | 25 MB | 2.00:1 | 50.00% |

*(Note: Replace the example numbers with your actual test results!)*

## Rebuild Verification
The extension includes a verification tool that checks if the compressed file can be successfully rebuilt. 

*   **Lossless (Text):** We use a SHA-256 Web Crypto API hash comparison. If the decompressed file matches the original byte-for-byte, the UI displays a green "Perfect Match" indicator.
*   **Lossy (Image/Audio/Video):** Because data is permanently discarded, byte-for-byte equality is impossible. The UI will calculate the PSNR (for images) or display the applied settings (like 96kbps audio or CRF 28 video).

> **Screenshot Placeholder:**
> *[Please insert a screenshot showing a successful SHA-256 hash "Perfect Match" here.]*

## Algorithm Explanation
*   **Text (GZIP):** We utilize the `fflate` library for fast GZIP compression. Text contains highly redundant characters, making dictionary-based algorithms extremely effective.
*   **Images (Canvas API / UPNG):** We leverage the native HTML5 Canvas `toBlob` method for JPEG compression, discarding high-frequency detail. For PNG, we utilize `UPNG.js` to strip redundant data losslessly.
*   **Audio (LameJS):** Audio is decoded into PCM floats using the Web Audio API, clamped to 16-bit integers, and encoded to a 96kbps MP3 stream using `lamejs`, removing frequencies inaudible to humans.
*   **Video (FFmpeg WASM):** We use a WebAssembly port of FFmpeg inside a background Web Worker. We apply the `libx264` codec with a CRF of 28, reducing temporal redundancy between frames while preserving spatial quality.

## Limitations
*   **Browser Memory Constraints:** Very large videos (>100MB) might crash the FFmpeg Web Worker due to browser heap limits.
*   **Video Speed:** WebAssembly video compression is CPU-intensive and will run slower than native desktop applications.
*   **Strict Formats:** Only `.txt, .csv, .png, .jpg, .mp3, .wav, .mp4` are fully supported by the UI handler right now.

## References
*   [fflate (GZIP compression)](https://github.com/101arrowz/fflate)
*   [UPNG.js (Lossless PNG)](https://github.com/photopea/UPNG.js)
*   [LameJS (MP3 Encoding)](https://github.com/zhuker/lamejs)
*   [FFmpeg WASM (Video)](https://github.com/ffmpegwasm/ffmpeg.wasm)
*   [MDN Web Docs - Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/digest)
