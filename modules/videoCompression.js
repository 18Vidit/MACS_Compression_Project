export async function compressVideo(file, crf = 28, onProgress) {
    // Input validation
    if (!file || !(file instanceof File)) {
        throw new Error('compressVideo: first argument must be a File object.');
    }
    if (!file.type.startsWith('video/')) {
        throw new Error(`compressVideo: unsupported file type "${file.type}". Only video files are accepted.`);
    }
 
    // Clamp CRF to valid FFmpeg range before it reaches the worker.
    // FFmpeg errors cryptically on out-of-range values — better to catch it here.
    const safeCrf = Math.max(0, Math.min(51, Math.round(crf)));
 
    // Read the file buffer BEFORE entering the Promise constructor.
    // Keeping async work outside new Promise(...) avoids the anti-pattern where
    // a thrown rejection inside an async executor is swallowed silently.
    const arrayBuffer = await file.arrayBuffer();
 
    return new Promise((resolve, reject) => {
        const worker = new Worker('modules/videoWorker.js');
 
        // Handle messages posted intentionally from inside the worker's try/catch
        worker.onmessage = function (e) {
            const { status, message, data } = e.data;
 
            if (status === 'progress') {
                if (onProgress) onProgress(message);
            }
            else if (status === 'done') {
                const originalSize   = file.size;
                const compressedSize = data.byteLength;
 
                const savingsPercent = (
                    ((originalSize - compressedSize) / originalSize) * 100
                ).toFixed(2);
 
                const ratio = (originalSize / compressedSize).toFixed(2);
 
                const compressedBlob = new Blob([data], { type: 'video/mp4' });
 
                resolve({
                    blob: compressedBlob,
                    originalSize,
                    compressedSize,
                    ratio,
                    savingsPercent,
                });
 
                worker.terminate();
            }
            else if (status === 'error') {
                reject(new Error(message));
                worker.terminate();
            }
        };
 
        // Handle worker crashes that happen BEFORE the worker's own try/catch runs —
        // bad importScripts path, CSP block, WASM load failure, etc.
        // Without this handler the promise would hang forever on a crashed worker.
        worker.onerror = function (e) {
            reject(new Error('Worker crashed: ' + (e.message || 'unknown error')));
            worker.terminate();
        };
 
        // Transfer the ArrayBuffer to the worker (zero-copy).
        // Passing filename lets the worker use the correct container/demuxer
        // regardless of whether the input is .mp4, .mov, .webm, .avi etc.
        worker.postMessage(
            {
                type:        'START_COMPRESSION',
                arrayBuffer: arrayBuffer,
                crf:         safeCrf.toString(),
                filename:    file.name,
            },
            [arrayBuffer] // Transfer list — avoids duplicating the buffer in memory
        );
    });
}