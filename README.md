# Shrinkr 🗜️
![Status Badge](https://img.shields.io/badge/Status-Submitted%20%E2%80%94%20MACS%20JC%20Project%202-success)

## Overview
Shrinkr is a Chrome Extension designed to compress text, images, audio, and video files directly in the browser. It supports `.txt`, `.csv`, `.png`, `.jpg`, `.jpeg`,`.mp3`, `.wav` and `.mp4` formats. The extension utilizes local, browser-based compression to ensure privacy and fast processing, leveraging native Canvas APIs and WebAssembly (FFmpeg) to achieve a balance between file size reduction and quality.

## Team Name: **Aaahm Aaahdmi Party**

## Team Members:

| Name                  | Role / Contribution                        | Contribution % |
| :-------------------- | :----------------------------------------- | :------------- |
| **Vidit Arora**       | Integration, Testing, Documentation and UI | 16.67% |
| **Kartik Sisodia**    | Decompression and Validation               | 16.67% |
| **Sumit Singh**       | Lossless Compression                       | 16.67% |
| **Shivam Sinha**      | Lossless Compression                       | 16.67% |
| **Hussain**           | Lossy Compression                          | 16.67% |
| **Govind Khandelwal** | Lossy Compression                          | 16.67% |

## Features
*   **Multi-format Support:** Compress text (`.txt`, `.csv`), images (`.png`, `.jpg`, `.jpeg`), audio (`.mp3`), and video (`.mp4`).
*   **Lossless & Lossy Compression:** GZIP for text, UPNG/Canvas for images, MP3 encoding, and H.264 video compression.
*   **Real Time Metrics:** Displays Original Size, Compressed Size, Compression Ratio, and Space Savings Percentage upon completion.
*   **Rebuild & Hash Verification:** Allows decompression testing. For lossless files, it verifies the rebuild against the original using a SHA-256 hash.
*   **Quality Assessment:** Calculates Peak Signal-to-Noise Ratio (PSNR) for lossy image compression to track quality loss.
*   **Graceful Error Handling:** Invalid file types and processing errors are caught and shown cleanly in the UI.

## Installation & Deployment
Shrinkr is provided as both a production-ready `.crx` package and a raw source directory. To ensure successful evaluation, please follow the instructions below.

###  Method 1: Production Package (.crx) — Recommended
This is the standard distribution format for Chrome extensions.
1.  **Download:** Open the [Shrinkr.crx](Shrinkr.crx) file in this repository and click the **"Download raw file"** button (⬇️).
    *   *Note: Avoid "Save link as" on the file name, as it may result in binary corruption.*
2.  **Navigate:** Open Chrome and go to `chrome://extensions/`.
3.  **Initialize:** Ensure the **"Developer mode"** toggle in the top-right is **ON**.
4.  **Deploy:** Drag and drop the downloaded `Shrinkr.crx` file onto the extensions page.
5.  **Pin:** Pin **Shrinkr** from the extensions toolbar for easy access.

> [!IMPORTANT]
> **Chrome Security Policy:** As of Chrome v117+, the browser may occasionally display `CRX_REQUIRED_PROOF_MISSING` for off-store extensions. This is a known browser security restriction for unverified files. If this occurs, please use **Method 2** below to load the source directly.

###  Method 2: Developer Source (Load Unpacked)
This method is the industry standard for code review and avoids all browser signature restrictions.
1.  **Download:** Clone this repository or download the ZIP of the source code.
2.  **Navigate:** Open `chrome://extensions/` and enable **Developer mode**.
3.  **Load:** Click the **"Load unpacked"** button in the top-left.
4.  **Select:** Choose the root project folder (the one containing `manifest.json`)(the one where you cloned the repository).

## How to Use
1. Click the Shrinkr icon in the Chrome toolbar to open the extension popup.
2. Click **Choose a file to compress** and select a supported file.
3. Click the **Compress File** button and wait for the process to finish.
4. Review the size reduction metrics displayed.
5. Click **Download Compressed File** to save it.
6. To verify the file, select the downloaded compressed file under the **Decompress & Verify** section and click the verify button.

## Screenshots:
![Compression UI](assets/ui-compression.png)
![Decompression UI](assets/ui-verify.png)

## Compression Results

| File Type | File Name | Original Size | Compressed Size | Compression Ratio | Space Savings (%) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Text | `100_item.csv` | 1.55 KB | 540 Bytes | 2.94:1 | 66.04% |
| Text | `For_Mr_Hitesh_Mehta_Ji.txt` | 86.08 KB | 1.09 KB | 78.84:1 | 98.73% |
| Image (JPEG) | `isspiderman.jpeg` | 616.87 KB | 114.87 KB |5.37:1 | 81.38% |
| Image (PNG) | `structure_chart.png` | 7 MB | 5.6 MB | 1.25:1 | 20.02% |
| Audio (MP3) | `Shoot Vol 1.mp3` | 10.87 MB | 3.25 MB | 3.34:1 | 70.09% |
| Video (MP4) | `prithvi.mp4` | 1.5 MB | 1.02 MB | 1.47:1 | 31.93% |


## Rebuild Verification
The extension includes a verification tool that checks if the compressed file can be successfully rebuilt. 

*   **Lossless (Text):** We use a SHA-256 Web Crypto API hash comparison. If the decompressed file matches the original byte-for-byte, the UI displays a green "Perfect Match" indicator.
*   **Lossy (Image/Audio/Video):** Because data is permanently discarded, byte-for-byte equality is impossible. The UI will calculate the PSNR (for images) or display the applied settings (like 96kbps audio or CRF 28 video).

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
