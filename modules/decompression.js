import { validateOutput } from "./validation.js";

// This module handles decompressing files that were previously compressed
export async function processDecompression(originalFile, compressedFile, fileType) {
    if (!compressedFile) {
        return { error: true, message: "Invalid compressed file input" };
    }

    let decompressedFile;

    try {
        if (fileType === "text" || compressedFile.type === "application/gzip" || compressedFile.name.endsWith(".gz")) {
            decompressedFile = await decompressText(compressedFile, originalFile.name);
        } else if (fileType === "image" || compressedFile.type.startsWith("image/")) {
            decompressedFile = await decompressImage(compressedFile, originalFile);
        } else if (fileType === "audio" || compressedFile.type.startsWith("audio/")) {
            // Audio (MP3) is lossy, we don't 'decompress' it back to a file, it just stays as MP3
            // We just return it as is for metric comparison
            decompressedFile = compressedFile;
        } else if (fileType === "video" || compressedFile.type.startsWith("video/")) {
            // Video (MP4) is lossy, same as audio
            decompressedFile = compressedFile;
        } else {
            return { error: true, message: "Unsupported file type for decompression" };
        }

        // Run the validation metrics (Hash match or PSNR)
        const validation = await validateOutput(originalFile, decompressedFile, fileType || "lossy");

        return {
            decompressedFile: decompressedFile,
            validation: validation
        };

    } catch (err) {
        console.error(err);
        return { error: true, message: err.message || "Decompression failed" };
    }
}

// Decompress GZIP text files back to their original form
async function decompressText(file, originalName) {
    const arrayBuffer = await file.arrayBuffer();
    const inputData = new Uint8Array(arrayBuffer);

    // GZIP files always start with magic bytes 1F 8B
    if (inputData.length < 2 || inputData[0] !== 0x1f || inputData[1] !== 0x8b) {
        throw new Error("The file uploaded for verification is not a valid compressed GZIP file. Make sure you selected the downloaded '.gz' file in the second upload box!");
    }

    const decompressedData = await new Promise((resolve, reject) => {
        fflate.gunzip(inputData, (error, data) => {
            if (error) {
                reject(new Error("Failed to decompress text: " + error.message));
            } else {
                resolve(data);
            }
        });
    });

    // Create a new blob with the original text content
    return new File([decompressedData], originalName, { type: "text/plain" });
}

// For images, decompression usually just means rendering it to get raw pixels for comparison.
// We return the compressed file since it is the viewable image, but validation.js will handle the PSNR.
async function decompressImage(file, originalFile) {
    return file;
}