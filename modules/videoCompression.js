// This module handles video compression by sending the file to a Web Worker
// The worker will run FFmpeg to compress the video without freezing the main browser UI
export async function compressVideo(file, onProgress) {
    if (!file || !file.type.startsWith("video/")) {
        throw new Error("Please upload a valid video file.");
    }

    const originalSize = file.size;
    const arrayBuffer = await file.arrayBuffer();

    return new Promise((resolve, reject) => {
        // Create a new web worker from our worker script
        const worker = new Worker("modules/videoWorker.js");

        // Listen for messages coming back from the worker
        worker.onmessage = function (event) {
            const status = event.data.status;
            const message = event.data.message;
            const data = event.data.data;

            if (status === "progress") {
                // Update the UI with the current progress
                if (onProgress) {
                    onProgress(message);
                }
            } else if (status === "done") {
                // The worker finished compressing the video
                const compressedSize = data.byteLength;
                const compressedBlob = new Blob([data], { type: "video/mp4" });

                const ratio = (originalSize / compressedSize).toFixed(2);
                const savings = (((originalSize - compressedSize) / originalSize) * 100).toFixed(2);

                resolve({
                    file: compressedBlob,
                    originalSize: originalSize,
                    compressedSize: compressedSize,
                    ratio: ratio + ":1",
                    savings: savings + "%",
                    type: "lossy"
                });

                // Clean up the worker
                worker.terminate();
            } else if (status === "error") {
                reject(new Error(message));
                worker.terminate();
            }
        };

        // Handle any sudden crashes in the worker itself
        worker.onerror = function (error) {
            reject(new Error("Video compression failed to start: " + error.message));
            worker.terminate();
        };

        // We use a Constant Rate Factor (CRF) of 28. Lower means better quality but larger size.
        // 28 is a good balance for web videos.
        const crfValue = "28";

        // Send the file data to the worker to start the process
        // We transfer the arrayBuffer to avoid duplicating it in memory
        worker.postMessage({
            type: "START_COMPRESSION",
            arrayBuffer: arrayBuffer,
            crf: crfValue,
            filename: file.name
        }, [arrayBuffer]);
    });
}