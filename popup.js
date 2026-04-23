import { compressText } from './modules/textCompression.js';
import { compressImage } from './modules/imageCompression.js';
import { compressAudio } from './modules/audioCompression.js';
import { compressVideo } from './modules/videoCompression.js';
import { processDecompression } from './modules/decompression.js';

// Global state to hold files
let originalFile = null;
let compressedResult = null;
let uploadedCompressedFile = null;

// UI Elements
const fileUpload = document.getElementById('file-upload');
const fileNameDisplay = document.getElementById('file-name-display');
const compressBtn = document.getElementById('compress-btn');
const errorMsg = document.getElementById('error-message');
const progressSection = document.getElementById('progress-section');
const progressText = document.getElementById('progress-text');

const resultsSection = document.getElementById('results-section');
const resOriginal = document.getElementById('res-original');
const resCompressed = document.getElementById('res-compressed');
const resRatio = document.getElementById('res-ratio');
const resSavings = document.getElementById('res-savings');
const downloadBtn = document.getElementById('download-btn');

const verifyUpload = document.getElementById('verify-upload');
const verifyNameDisplay = document.getElementById('verify-name-display');
const verifyBtn = document.getElementById('verify-btn');
const verifyResults = document.getElementById('verify-results');
const verifyMessage = document.getElementById('verify-message');
const verifyMetric = document.getElementById('verify-metric');
const downloadDecompressedBtn = document.getElementById('download-decompressed-btn');

// Format bytes into readable sizes (KB, MB)
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Show error messages in the UI
function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.classList.remove('hidden');
    progressSection.classList.add('hidden');
}

function hideError() {
    errorMsg.classList.add('hidden');
}

// Event Listeners for File Uploads
fileUpload.addEventListener('change', (e) => {
    hideError();
    const file = e.target.files[0];
    if (file) {
        originalFile = file;
        fileNameDisplay.textContent = file.name;
        compressBtn.disabled = false;
        resultsSection.classList.add('hidden');
    }
});

verifyUpload.addEventListener('change', (e) => {
    hideError();
    const file = e.target.files[0];
    if (file) {
        uploadedCompressedFile = file;
        verifyNameDisplay.textContent = file.name;
        verifyBtn.disabled = false;
        verifyResults.classList.add('hidden');
    }
});

// Compress Button Logic
compressBtn.addEventListener('click', async () => {
    if (!originalFile) return;

    hideError();
    compressBtn.disabled = true;
    resultsSection.classList.add('hidden');
    progressSection.classList.remove('hidden');
    progressText.textContent = "Compressing...";

    const fileType = originalFile.type;
    const fileName = originalFile.name.toLowerCase();

    try {
        if (fileName.endsWith('.txt') || fileName.endsWith('.csv') || fileType.includes('text')) {
            compressedResult = await compressText(originalFile);
        } else if (fileType.includes('image')) {
            compressedResult = await compressImage(originalFile);
        } else if (fileType.includes('audio')) {
            compressedResult = await compressAudio(originalFile);
        } else if (fileType.includes('video')) {
            compressedResult = await compressVideo(originalFile, (msg) => {
                progressText.textContent = msg;
            });
        } else {
            throw new Error("Unsupported file type. Please upload text, image, audio, or video.");
        }

        // Display Results
        resOriginal.textContent = formatBytes(compressedResult.originalSize);
        resCompressed.textContent = formatBytes(compressedResult.compressedSize);
        resRatio.textContent = compressedResult.ratio;
        resSavings.textContent = compressedResult.savings;

        progressSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        compressBtn.disabled = false;

    } catch (err) {

        showError(err.message || "An error occurred during compression.");
        compressBtn.disabled = false;
    }
});

// Download Compressed File
downloadBtn.addEventListener('click', () => {
    if (!compressedResult || !compressedResult.file) return;
    
    // Create a temporary link to download the blob
    const url = URL.createObjectURL(compressedResult.file);
    const a = document.createElement('a');
    a.href = url;
    
    // Generate a new name indicating it's compressed
    const extIndex = originalFile.name.lastIndexOf('.');
    let name = originalFile.name.substring(0, extIndex) + '_compressed';
    
    // Update extension if needed based on the blob type
    if (compressedResult.file.type === "application/gzip") {
        name += '.gz';
    } else if (compressedResult.file.type === "image/jpeg") {
        name += '.jpg';
    } else if (compressedResult.file.type === "image/png") {
        name += '.png';
    } else if (compressedResult.file.type === "audio/mp3") {
        name += '.mp3';
    } else if (compressedResult.file.type === "video/mp4") {
        name += '.mp4';
    } else {
        name += originalFile.name.substring(extIndex);
    }
    
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
});

// Verify & Decompress Logic
verifyBtn.addEventListener('click', async () => {
    if (!uploadedCompressedFile || !originalFile) {
        showError("You need both the original file and the compressed file to verify.");
        return;
    }

    hideError();
    verifyBtn.disabled = true;
    verifyResults.classList.add('hidden');
    progressSection.classList.remove('hidden');
    progressText.textContent = "Verifying...";

    try {
        let typeString = "lossy";
        if (originalFile.type.includes('text') || originalFile.type.includes('csv')) typeString = "text";
        else if (originalFile.type.includes('image')) typeString = "image";
        else if (originalFile.type.includes('audio')) typeString = "audio";
        else if (originalFile.type.includes('video')) typeString = "video";

        const result = await processDecompression(originalFile, uploadedCompressedFile, typeString);

        if (result.error) {
            throw new Error(result.message);
        }

        // Show verification results
        verifyMessage.textContent = result.validation.message;
        verifyMetric.textContent = result.validation.metric || "";
        
        // Change color based on validity
        if (result.validation.isValid) {
            verifyMessage.style.color = "var(--accent-green)";
        } else {
            verifyMessage.style.color = "var(--error-red)";
        }

        verifyResults.classList.remove('hidden');
        progressSection.classList.add('hidden');
        verifyBtn.disabled = false;

        // If it's lossless, allow downloading the decompressed file
        if (result.validation.type === "lossless" && result.decompressedFile) {
            downloadDecompressedBtn.classList.remove('hidden');
            downloadDecompressedBtn.onclick = () => {
                const url = URL.createObjectURL(result.decompressedFile);
                const a = document.createElement('a');
                a.href = url;
                a.download = "restored_" + originalFile.name;
                a.click();
                URL.revokeObjectURL(url);
            };
        } else {
            downloadDecompressedBtn.classList.add('hidden');
        }

    } catch (err) {

        showError(err.message || "Verification failed.");
        verifyBtn.disabled = false;
        progressSection.classList.add('hidden');
    }
});
