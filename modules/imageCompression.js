import { applyPerceptualEdgeMask } from './visionFilters.js';
 
/**
 * @param {Uint8ClampedArray} originalData     - RGBA from canvas.getImageData()
 * @param {Uint8Array}        decompressedData - RGB from jpeg.decode()
 * @param {number}            width
 * @param {number}            height
 * @returns {{ mse: string, psnr: string }}
 */
function calculateRebuildMetrics(originalData, decompressedData, width, height) {
    let mseSum = 0;
    const totalPixels = width * height;
 
    for (let i = 0; i < totalPixels; i++) {
        const op = i * 4; // RGBA stride — original canvas data
        const dp = i * 3; // RGB stride  — jpeg.decode output
 
        const rDiff = originalData[op    ] - decompressedData[dp    ];
        const gDiff = originalData[op + 1] - decompressedData[dp + 1];
        const bDiff = originalData[op + 2] - decompressedData[dp + 2];
 
        mseSum += (rDiff * rDiff) + (gDiff * gDiff) + (bDiff * bDiff);
    }
 
    const mse = mseSum / (totalPixels * 3);
 
    if (mse === 0) return { mse: '0.00', psnr: 'Infinity' };
 
    const psnr = 10 * Math.log10((255 * 255) / mse);
 
    return {
        mse:  mse.toFixed(2),
        psnr: psnr.toFixed(2),
    };
}
 
 
export async function compressJPEG(file, quality = 75, options = {}) {
    if (!file || !(file instanceof File)) {
        return Promise.reject(new Error('compressJPEG: first argument must be a File object.'));
    }
    if (!file.type.startsWith('image/')) {
        return Promise.reject(new Error(`compressJPEG: unsupported file type "${file.type}". Only image files are accepted.`));
    }
 
    const q = Math.max(1, Math.min(100, Math.round(quality)));
 
    const {
        maxDimension      = 1920,
        background        = '#ffffff',
        progressive       = true,
        chromaSubsampling = true,
        edgeThreshold     = 50,
    } = options;
 
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.src = url;
 
        img.onload = () => {
            URL.revokeObjectURL(url);
 
            let outputWidth  = img.naturalWidth  || img.width;
            let outputHeight = img.naturalHeight || img.height;
 
            if (
                isFinite(maxDimension) &&
                maxDimension > 0 &&
                (outputWidth > maxDimension || outputHeight > maxDimension)
            ) {
                const scale = Math.min(
                    maxDimension / outputWidth,
                    maxDimension / outputHeight
                );
                outputWidth  = Math.round(outputWidth  * scale);
                outputHeight = Math.round(outputHeight * scale);
            }
 
            const canvas = document.createElement('canvas');
            canvas.width  = outputWidth;
            canvas.height = outputHeight;
            const ctx = canvas.getContext('2d');
 
            ctx.fillStyle = background;
            ctx.fillRect(0, 0, outputWidth, outputHeight);
            ctx.drawImage(img, 0, 0, outputWidth, outputHeight);
 
            // Keep a clean copy of original pixels for MSE/PSNR comparison.
            // This must be captured BEFORE applyPerceptualEdgeMask runs.
            const originalImageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
 
            try {
                // Apply spatially variant perceptual filter:
                //   flat regions  → Gaussian blur  (entropy reduction)
                //   edge regions  → unsharp mask   (sharpness preservation)
                const filteredImageData = applyPerceptualEdgeMask(originalImageData, edgeThreshold);
 
                const rawData = {
                    data:   filteredImageData.data,
                    width:  filteredImageData.width,
                    height: filteredImageData.height,
                };
 
                const encodeOptions = {
                    quality: q,
                    progressive,
                    chromaSubsampling,
                };
 
                const compressedData = jpeg.encode(rawData, encodeOptions);
 
                // Decode the compressed output so we can measure distortion
                // against the *true* original (not the filtered version).
                // jpeg.decode returns RGB (3 bytes/pixel) — see calculateRebuildMetrics.
                const decompressedImage = jpeg.decode(compressedData.data, { useTArray: true });
 
                const qualityMetrics = calculateRebuildMetrics(
                    originalImageData.data,   // RGBA — 4 bytes/pixel
                    decompressedImage.data,   // RGB  — 3 bytes/pixel
                    outputWidth,
                    outputHeight
                );
 
                const originalFileSize      = file.size;
                const uncompressedPixelSize = outputWidth * outputHeight * 3;
                const compressedSize        = compressedData.data.byteLength;
 
                const savingsVsRaw = (
                    ((uncompressedPixelSize - compressedSize) / uncompressedPixelSize) * 100
                ).toFixed(2);
 
                const savingsVsOriginalFile = (
                    ((originalFileSize - compressedSize) / originalFileSize) * 100
                ).toFixed(2);
 
                const ratioVsRaw = (uncompressedPixelSize / compressedSize).toFixed(2);
 
                const compressedBlob = new Blob([compressedData.data], { type: 'image/jpeg' });
 
                canvas.width  = 0;
                canvas.height = 0;
 
                resolve({
                    blob:                 compressedBlob,
                    originalFileSize,
                    uncompressedPixelSize,
                    compressedSize,
                    outputWidth,
                    outputHeight,
                    ratioVsRaw,
                    savingsVsRaw,
                    savingsVsOriginalFile,
                    mse:                  qualityMetrics.mse,
                    psnr:                 qualityMetrics.psnr,
                });
 
            } catch (error) {
                reject(new Error('JPEG encoding failed: ' + error.message));
            }
        };
 
        img.onerror = () => reject(new Error('Failed to load image into DOM.'));
    });
}
 
 
export const compressForWeb = (file) =>
    compressJPEG(file, 78, { maxDimension: 1920, progressive: true,  chromaSubsampling: true  });
 
export const compressForThumbnail = (file) =>
    compressJPEG(file, 65, { maxDimension: 400,  progressive: false, chromaSubsampling: true  });
 
export const compressForArchive = (file) =>
    compressJPEG(file, 92, { maxDimension: Infinity, progressive: true, chromaSubsampling: false });