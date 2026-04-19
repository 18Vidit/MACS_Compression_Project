importScripts('../lib/ffmpeg.min.js');
 
// Initialise FFmpeg (ffmpeg.wasm v0.11.x API)
const { createFFmpeg } = FFmpeg;
const ffmpeg = createFFmpeg({
    log: true,
    // Local path to the WASM core file — required to satisfy Chrome Extension CSP
    corePath: '../lib/ffmpeg-core.js',
});
 
onmessage = async function (e) {
    if (e.data.type !== 'START_COMPRESSION') return;
 
    const { arrayBuffer, crf, filename } = e.data;
 
    // Use the real input filename so FFmpeg selects the correct demuxer.
    // Fall back to 'input.mp4' only if no filename was provided.
    const inputName  = filename || 'input.mp4';
    const outputName = 'output.mp4';
 
    try {
        postMessage({ status: 'progress', message: 'Loading FFmpeg engine...' });
 
        if (!ffmpeg.isLoaded()) {
            await ffmpeg.load();
        }
 
        // Write the raw bytes into FFmpeg's virtual in-memory file system
        ffmpeg.FS('writeFile', inputName, new Uint8Array(arrayBuffer));
 
        // Hook into FFmpeg's progress event for real-time UI feedback
        ffmpeg.setProgress(({ ratio }) => {
            const percent = Math.round(ratio * 100);
            // Guard against the occasional negative value emitted during initialisation
            if (percent >= 0 && percent <= 100) {
                postMessage({ status: 'progress', message: `Compressing: ${percent}%` });
            }
        });
 
        // Run the compression:
        //   -vcodec libx264   Force H.264 video codec
        //   -crf              Constant Rate Factor — controls spatial/temporal data loss
        //   -preset fast      Faster motion-vector search; prevents the extension hanging
        //   -acodec copy      Pass audio stream through untouched — no re-encode, no drift
        await ffmpeg.run(
            '-i',      inputName,
            '-vcodec', 'libx264',
            '-crf',    crf,
            '-preset', 'fast',
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