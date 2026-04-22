export async function compressImage(file, level = "balanced") {
    // Check if the file is valid and is an image
    if (!file || !file.type.startsWith('image/')) {
        throw new Error("Please upload a valid image file.");
    }

    const isPNG = file.type === "image/png";

    if (isPNG) {
        return await compressLosslessPNG(file);
    } else {
        return await compressLossyJPEG(file, level);
    }
}

// Lossless compression using native Canvas and UPNG (if available) or just returning a clean blob
async function compressLosslessPNG(file) {
    const originalSize = file.size;
    const arrayBuffer = await file.arrayBuffer();
    let compressedBlob;

    try {
        // We use UPNG for lossless PNG compression
        if (typeof UPNG !== 'undefined') {
            const img = UPNG.decode(arrayBuffer);
            const rgbaFrames = UPNG.toRGBA8(img);
            // 0 means lossless compression in UPNG
            const compressedBuffer = UPNG.encode(rgbaFrames, img.width, img.height, 0);
            compressedBlob = new Blob([compressedBuffer], { type: "image/png" });
        } else {
            throw new Error("UPNG library not loaded");
        }
    } catch (err) {
        console.warn("UPNG failed, falling back to Canvas API", err);
        // Fallback to Canvas API
        compressedBlob = await useCanvasCompression(file, "image/png", 1.0);
    }

    const compressedSize = compressedBlob.size;
    
    // Sometimes lossless compression might increase size slightly due to headers.
    // If that happens, we just return the original file to save space.
    if (compressedSize >= originalSize) {
        compressedBlob = file;
    }

    return calculateMetrics(file, compressedBlob, "lossless");
}

// Lossy compression using HTML5 Canvas API
async function compressLossyJPEG(file, level) {
    // Map the string level to a quality number
    let quality = 0.7; // balanced
    if (level === "aggressive") quality = 0.4;
    if (level === "light") quality = 0.9;

    let compressedBlob = await useCanvasCompression(file, "image/jpeg", quality);
    
    // If lossy compression actually increases the file size (happens with tiny files),
    // we discard the compression and just return the original file to save space.
    if (compressedBlob.size >= file.size) {
        compressedBlob = file;
    }
    
    return calculateMetrics(file, compressedBlob, "lossy");
}

// Helper function to draw image to canvas and get a blob back
function useCanvasCompression(file, mimeType, quality) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            
            // Set a maximum dimension to massively reduce size of 4K/huge photos
            const maxDimension = 1920;
            let width = img.width;
            let height = img.height;
            
            if (width > maxDimension || height > maxDimension) {
                const ratio = Math.min(maxDimension / width, maxDimension / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext("2d");
            
            // Draw a white background first in case of transparent images converting to JPEG
            if (mimeType === "image/jpeg") {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            
            ctx.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error("Canvas toBlob failed"));
                }
            }, mimeType, quality);
        };
        
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image for compression"));
        };
        
        img.src = url;
    });
}

// Helper function to calculate all the required metrics
function calculateMetrics(originalFile, compressedBlob, type) {
    const originalSize = originalFile.size;
    const compressedSize = compressedBlob.size;
    
    // Compression Ratio
    const ratio = (originalSize / compressedSize).toFixed(2);
    
    // Space Savings Percentage
    const savings = (((originalSize - compressedSize) / originalSize) * 100).toFixed(2);
    
    return {
        file: compressedBlob,
        originalSize: originalSize,
        compressedSize: compressedSize,
        ratio: ratio + ":1",
        savings: savings + "%",
        type: type
    };
}
