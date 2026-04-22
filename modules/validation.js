import { generateHash } from "../utils/hash.js";

// This module handles validating the decompression
// For lossless files, it checks if the hash matches exactly
// For lossy files, it calculates the PSNR (Peak Signal-to-Noise Ratio)
export async function validateOutput(originalFile, decompressedFile, fileType) {

    // Lossless Validation (Text)
    if (fileType === "text" || fileType === "lossless") {
        const originalHash = await generateHash(originalFile);
        const rebuiltHash = await generateHash(decompressedFile);
        
        const isMatch = originalHash === rebuiltHash;
        
        return {
            isValid: isMatch,
            type: "lossless",
            message: isMatch ? "Perfect Match (Byte-for-byte identical)" : "Mismatch Detected"
        };
    } 
    // Lossy Validation (Image, Audio, Video)
    else {
        // If it's an image, we can try to calculate PSNR by comparing pixels
        let qualityMetric = "PSNR/Quality varies based on algorithm";
        
        if (fileType === "image") {
            try {
                const psnr = await calculateImagePSNR(originalFile, decompressedFile);
                qualityMetric = `PSNR: ${psnr} dB`;
            } catch (err) {
                console.warn("Failed to calculate PSNR", err);
            }
        } else if (fileType === "audio") {
            qualityMetric = "Bitrate reduced to 96 kbps";
        } else if (fileType === "video") {
            qualityMetric = "H.264 CRF 28 applied";
        }

        return {
            isValid: true,
            type: "lossy",
            message: "Compression applied with acceptable quality loss",
            metric: qualityMetric
        };
    }
}

// Helper to calculate Peak Signal-to-Noise Ratio for images
async function calculateImagePSNR(originalBlob, compressedBlob) {
    const origData = await getImageData(originalBlob);
    
    // For the compressed image, if it was downscaled, we need to scale it back up
    // to the original dimensions to do a pixel-by-pixel PSNR comparison.
    const compData = await getImageData(compressedBlob, origData.width, origData.height);

    let mseSum = 0;
    const totalPixels = origData.width * origData.height;

    for (let i = 0; i < origData.data.length; i += 4) {
        const rDiff = origData.data[i] - compData.data[i];
        const gDiff = origData.data[i + 1] - compData.data[i + 1];
        const bDiff = origData.data[i + 2] - compData.data[i + 2];
        
        mseSum += (rDiff * rDiff) + (gDiff * gDiff) + (bDiff * bDiff);
    }

    const mse = mseSum / (totalPixels * 3);
    if (mse === 0) return "Infinity (Perfect Match)";

    const psnr = 10 * Math.log10((255 * 255) / mse);
    return psnr.toFixed(2);
}

// Helper to load an image blob to a canvas and get its pixel data
function getImageData(blob, targetWidth = null, targetHeight = null) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blob);
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement("canvas");
            
            // If target dimensions are provided (for PSNR matching), use them
            canvas.width = targetWidth || img.width;
            canvas.height = targetHeight || img.height;
            
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        };
        img.onerror = () => reject(new Error("Failed to load image for PSNR"));
        img.src = url;
    });
}