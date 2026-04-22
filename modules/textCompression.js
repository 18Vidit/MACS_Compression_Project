// This module handles compressing text and csv files using GZIP (fflate library)
export async function compressText(file) {
    // First, make sure the file is actually a text or csv file
    const isValidType = file.name.endsWith(".txt") || file.name.endsWith(".csv") || file.type === "text/plain" || file.type === "text/csv";
    
    if (!file || !isValidType) {
        throw new Error("Only .txt and .csv files are supported for text compression.");
    }

    const originalSize = file.size;

    // We read the file content into an array buffer to compress it byte by byte
    const arrayBuffer = await file.arrayBuffer();
    const inputData = new Uint8Array(arrayBuffer);

    // Compress the data using fflate's gzip with maximum compression level (9)
    const compressedData = await new Promise((resolve, reject) => {
        fflate.gzip(inputData, { level: 9 }, (error, data) => {
            if (error) {
                reject(new Error("Compression failed: " + error.message));
            } else {
                resolve(data);
            }
        });
    });

    // Create a new file blob from the compressed data
    const compressedBlob = new Blob([compressedData], { type: "application/gzip" });
    const compressedSize = compressedBlob.size;

    // Calculate how much space we saved
    const ratio = (originalSize / compressedSize).toFixed(2);
    const savings = (((originalSize - compressedSize) / originalSize) * 100).toFixed(2);

    return {
        file: compressedBlob,
        originalSize: originalSize,
        compressedSize: compressedSize,
        ratio: ratio + ":1",
        savings: savings + "%",
        type: "lossless"
    };
}
