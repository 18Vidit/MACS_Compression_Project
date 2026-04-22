// This module compresses audio files into MP3 format using lamejs
export async function compressAudio(file) {
    if (!file || !file.type.startsWith("audio/")) {
        throw new Error("Please upload a valid audio file.");
    }

    const originalSize = file.size;
    const arrayBuffer = await file.arrayBuffer();

    // Use the browser's native AudioContext to decode the audio data
    // This gives us the raw audio samples to work with
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    
    // We'll compress to a standard 96 kbps which gives a good balance of size and quality
    const bitrate = 96;

    // Grab the audio data from the first channel (left channel or mono)
    const samples = audioBuffer.getChannelData(0);

    // lamejs needs the audio data as 16-bit integers, but the Web Audio API gives us 32-bit floats
    // So we need to convert the numbers before encoding
    const int16Samples = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        // Clamp the values between -1 and 1
        let s = Math.max(-1, Math.min(1, samples[i]));
        // Convert to 16-bit integer scale
        int16Samples[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    // Initialize the MP3 encoder (1 channel, sample rate, bitrate)
    const mp3encoder = new lamejs.Mp3Encoder(1, sampleRate, bitrate);
    const blockSize = 1152;
    let mp3Data = [];

    // Encode the audio in chunks to avoid memory issues
    for (let i = 0; i < int16Samples.length; i += blockSize) {
        const chunk = int16Samples.subarray(i, i + blockSize);
        const encodedChunk = mp3encoder.encodeBuffer(chunk);
        
        if (encodedChunk.length > 0) {
            mp3Data.push(encodedChunk);
        }
    }

    // Finish up the encoding and grab any remaining data
    const finalChunk = mp3encoder.flush();
    if (finalChunk.length > 0) {
        mp3Data.push(finalChunk);
    }

    // Combine all the MP3 data chunks into a single file blob
    const compressedBlob = new Blob(mp3Data, { type: "audio/mp3" });
    const compressedSize = compressedBlob.size;

    const ratio = (originalSize / compressedSize).toFixed(2);
    const savings = (((originalSize - compressedSize) / originalSize) * 100).toFixed(2);

    return {
        file: compressedBlob,
        originalSize: originalSize,
        compressedSize: compressedSize,
        ratio: ratio + ":1",
        savings: savings + "%",
        type: "lossy"
    };
}
