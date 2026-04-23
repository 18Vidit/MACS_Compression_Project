// Polyfill document for ffmpeg.min.js which sometimes incorrectly assumes it's on the main thread
self.document = { currentScript: { src: '' } };

// CRITICAL MV3 WORKAROUND #1 & #2:
// Move overrides to the absolute top of the file so that if ffmpeg.min.js captures fetch 
// during its initial evaluation, it captures our intercepted versions!
const originalFetch = fetch;
let interceptedCoreText = null;
let interceptedWasmBuffer = null;

self.fetch = async function(url, options) {
    if (typeof url === 'string') {
        // Use .includes() because ffmpeg might append ?v=0.11.x cache busters!
        if (url.includes('ffmpeg-core.js') && interceptedCoreText) {
            return new Response(interceptedCoreText, { headers: { 'Content-Type': 'application/javascript' } });
        }
        if (url.includes('ffmpeg-core.wasm') && interceptedWasmBuffer) {
            return new Response(interceptedWasmBuffer, { headers: { 'Content-Type': 'application/wasm' } });
        }
        if (url.includes('ffmpeg-core.worker.js')) {
            // The wrapper always attempts to fetch this, even for single-threaded!
            // We just return a dummy script to satisfy it.
            return new Response('', { headers: { 'Content-Type': 'application/javascript' } });
        }
        // Log any unexpected fetches to the UI so we can see what's failing!
        postMessage({ status: 'progress', message: 'FFmpeg attempted to fetch: ' + url });
    }
    return originalFetch(url, options);
};

const originalCreateObjectURL = URL.createObjectURL;
let interceptedCoreUrl = null;
let interceptedWasmUrl = null;

URL.createObjectURL = function(blob) {
    if (blob) {
        // Use Blob size to reliably intercept without depending on correct MIME types
        if (blob.size > 10000000 && interceptedWasmUrl) {
            // WASM file is ~24MB (multithreaded) or ~15MB (single-threaded)
            return interceptedWasmUrl;
        }
        if (blob.size > 50000 && interceptedCoreUrl) {
            // JS Core file is ~100KB
            return interceptedCoreUrl;
        }
    }
    return originalCreateObjectURL(blob);
};

importScripts('../lib/ffmpeg.min.js');
// Initialise FFmpeg (ffmpeg.wasm v0.11.x API) later with absolute paths
const { createFFmpeg } = FFmpeg;
let ffmpeg = null;
 
onmessage = async function (e) {
    if (e.data.type !== 'START_COMPRESSION') return;
 
    const { arrayBuffer, crf, filename, coreUrl, wasmUrl, coreText, wasmBuffer } = e.data;
 
    // Populate the global intercepted variables so the overrides can use them
    interceptedCoreUrl = coreUrl;
    interceptedWasmUrl = wasmUrl;
    interceptedCoreText = coreText;
    interceptedWasmBuffer = wasmBuffer;

    // Use the real input filename so FFmpeg selects the correct demuxer.
    // Fall back to 'input.mp4' only if no filename was provided.
    const inputName  = filename || 'input.mp4';
    const outputName = 'output.mp4';
 
    try {
        if (!ffmpeg) {
            postMessage({ status: 'progress', message: 'Initializing FFmpeg...' });

            ffmpeg = createFFmpeg({
                log: true,
                logger: ({ message }) => {
                    // Send all FFmpeg internal logs directly to the UI so the user 
                    // can see it's actively processing frames and not stuck at 0%!
                    postMessage({ status: 'progress', message: 'FFmpeg: ' + message.substring(0, 50) + '...' });
                },
                corePath: coreUrl,
                wasmPath: wasmUrl,
                workerPath: coreUrl.replace('ffmpeg-core.js', 'ffmpeg-core.worker.js'), // Force it through our interceptor!
                mainName: 'main'
            });
        }

        postMessage({ status: 'progress', message: 'Loading FFmpeg engine...' });
 
        if (!ffmpeg.isLoaded()) {
            await ffmpeg.load();
        }
 
        // Write the raw bytes into FFmpeg's virtual in-memory file system
        ffmpeg.FS('writeFile', inputName, new Uint8Array(arrayBuffer));
 
        // Hook into FFmpeg's progress event for real-time UI feedback
        // ffmpeg.setProgress(({ ratio }) => {
        //     const percent = Math.round(ratio * 100);
        //     // Guard against the occasional negative value emitted during initialisation
        //     if (percent >= 0 && percent <= 100) {
        //         postMessage({ status: 'progress', message: `Compressing: ${percent}%` });
        //     }
        // });
 
        // Run the compression:
        //   -threads 1        Force single thread to avoid SharedArrayBuffer hangs in Chrome Extensions
        //   -vcodec libx264   Force H.264 video codec
        //   -crf              Constant Rate Factor — controls spatial/temporal data loss
        //   -preset ultrafast Fastest motion-vector search; prevents the extension hanging
        //   -acodec copy      Pass audio stream through untouched — no re-encode, no drift
        await ffmpeg.run(
            '-i',      inputName,
            '-threads', '1',
            '-vcodec', 'libx264',
            '-crf',    crf,
            '-preset', 'ultrafast',
            '-acodec', 'copy',
            outputName
        );
 
        // Read the compressed result back from the virtual file system
        const data = ffmpeg.FS('readFile', outputName);
 
        // Send the compressed buffer back to the main thread (zero-copy transfer)
        postMessage({ status: 'done', data: data.buffer }, [data.buffer]);
 
    } catch (error) {
        postMessage({ status: 'error', message: 'FFmpeg error: ' + error.message });
 
    } finally {
        // Always clean up virtual FS files to free WASM heap memory.
        // Wrapped individually so a missing output file doesn't block input cleanup.
        try { ffmpeg.FS('unlink', inputName);  } catch (_) {}
        try { ffmpeg.FS('unlink', outputName); } catch (_) {}
    }
};