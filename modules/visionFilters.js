const GAUSSIAN_5X5 = [
    1/256,  4/256,  6/256,  4/256, 1/256,
    4/256, 16/256, 24/256, 16/256, 4/256,
    6/256, 24/256, 36/256, 24/256, 6/256,
    4/256, 16/256, 24/256, 16/256, 4/256,
    1/256,  4/256,  6/256,  4/256, 1/256,
];
const GAUSSIAN_RADIUS = 2; // (5-1)/2
 
const SOBEL_GX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
const SOBEL_GY = [-1, -2, -1,  0,  0,  0,  1,  2,  1];
const SOBEL_RADIUS = 1; // (3-1)/2
 
const UNSHARP_KERNEL = [
     0, -0.5,  0,
    -0.5,  3, -0.5,
     0, -0.5,  0,
];
const UNSHARP_RADIUS = 1;
 

 
/**
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number} Luma in [0, 255]
 */
function toLuma(r, g, b) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
}
 
 
// Build a greyscale luminance map from RGBA ImageData
 
/**
 * @param {Uint8ClampedArray} data 
 * @param {number} width
 * @param {number} height
 * @returns {Float32Array} 
 */
function buildLumaMap(data, width, height) {
    const luma = new Float32Array(width * height);
    for (let i = 0; i < width * height; i++) {
        const p = i * 4;
        luma[i] = toLuma(data[p], data[p + 1], data[p + 2]);
    }
    return luma;
}
 
 
//Apply a separable 3×3 convolution on the luma plane
 
/**
 * @param {Float32Array} src    - Input single-channel plane
 * @param {number}       width
 * @param {number}       height
 * @param {number[]}     kernel - Flat row-major kernel array
 * @param {number}       radius - (kernelSize - 1) / 2
 * @returns {Float32Array}      - Convolved output, same dimensions
 */
function convolve(src, width, height, kernel, radius) {
    const dst = new Float32Array(width * height);
    const kSize = radius * 2 + 1;
 
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let sum = 0;
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    // Clamp-to-border sampling
                    const sy = Math.min(height - 1, Math.max(0, y + ky));
                    const sx = Math.min(width  - 1, Math.max(0, x + kx));
                    const ki = (ky + radius) * kSize + (kx + radius);
                    sum += src[sy * width + sx] * kernel[ki];
                }
            }
            dst[y * width + x] = sum;
        }
    }
    return dst;
}
 
 
// Sobel edge magnitude map
 
/**
 * @param {Float32Array} luma
 * @param {number}       width
 * @param {number}       height
 * @returns {Float32Array} Edge magnitude map, values roughly in [0, 360]
 */
function computeSobelMagnitude(luma, width, height) {
    const gx  = convolve(luma, width, height, SOBEL_GX, SOBEL_RADIUS);
    const gy  = convolve(luma, width, height, SOBEL_GY, SOBEL_RADIUS);
    const mag = new Float32Array(width * height);
 
    for (let i = 0; i < mag.length; i++) {
        mag[i] = Math.sqrt(gx[i] * gx[i] + gy[i] * gy[i]);
    }
    return mag;
}
 
 
// Apply RGBA convolution (Gaussian or unsharp) selectively
 
/**
 * @param {Uint8ClampedArray} data   - RGBA source (modified in place)
 * @param {number}            width
 * @param {number}            height
 * @param {number[]}          kernel
 * @param {number}            radius
 * @param {Uint8Array}        mask   - 1 = apply filter, 0 = skip
 */
function applyKernelMasked(data, width, height, kernel, radius, mask) {
    const src   = new Uint8ClampedArray(data);
    const kSize = radius * 2 + 1;
 
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (!mask[idx]) continue;
 
            let r = 0, g = 0, b = 0;
            for (let ky = -radius; ky <= radius; ky++) {
                for (let kx = -radius; kx <= radius; kx++) {
                    const sy = Math.min(height - 1, Math.max(0, y + ky));
                    const sx = Math.min(width  - 1, Math.max(0, x + kx));
                    const sp = (sy * width + sx) * 4;
                    const ki = (ky + radius) * kSize + (kx + radius);
                    const w  = kernel[ki];
                    r += src[sp    ] * w;
                    g += src[sp + 1] * w;
                    b += src[sp + 2] * w;
                }
            }
 
            const dp        = idx * 4;
            data[dp    ]    = Math.min(255, Math.max(0, Math.round(r)));
            data[dp + 1]    = Math.min(255, Math.max(0, Math.round(g)));
            data[dp + 2]    = Math.min(255, Math.max(0, Math.round(b)));
        }
    }
}
 
 
// ── Public API 
 
/**
 * @param {ImageData} imageData     - Source canvas ImageData (not mutated)
 * @param {number}    edgeThreshold - Sobel magnitude threshold that separates
 *                                    "edge" from "flat". Range: 0–255.
 *                                    Lower = more pixels treated as edges (less blur).
 *                                    Higher = more pixels blurred (more compression).
 *                                    Default 50 is a perceptually safe middle ground.
 * @returns {ImageData}             - New ImageData with filtered pixel data
 */
export function applyPerceptualEdgeMask(imageData, edgeThreshold = 50) {
    const { width, height } = imageData;
 
    const filteredData = new Uint8ClampedArray(imageData.data);
 
    // 1. Build luma plane (BT.601)
    const luma = buildLumaMap(filteredData, width, height);
 
    // 2. Compute Sobel edge magnitudes on luma
    const magnitude = computeSobelMagnitude(luma, width, height);
 
    // 3. Build binary masks
    const flatMask = new Uint8Array(width * height);
    const edgeMask = new Uint8Array(width * height);
 
    let flatCount = 0, edgeCount = 0;
    for (let i = 0; i < magnitude.length; i++) {
        if (magnitude[i] < edgeThreshold) {
            flatMask[i] = 1;
            flatCount++;
        } else {
            edgeMask[i] = 1;
            edgeCount++;
        }
    }
 
    // 4. Apply Gaussian blur to flat regions (entropy reduction)
    applyKernelMasked(filteredData, width, height, GAUSSIAN_5X5, GAUSSIAN_RADIUS, flatMask);
 
    // 5. Apply unsharp mask to edge regions (perceptual sharpness preservation)
    applyKernelMasked(filteredData, width, height, UNSHARP_KERNEL, UNSHARP_RADIUS, edgeMask);
 
    // 6. Return a new ImageData — never mutates the caller's original
    return new ImageData(filteredData, width, height);
}