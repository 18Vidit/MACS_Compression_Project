function validateFile(file, typeCheckFn = null, typeErrorMsg = "Invalid file type") {
  if (!file || file.size === 0) {
    throw new Error("File is empty or missing.");
  }

  const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
  if (file.size > MAX_SIZE) {
    throw new Error("File exceeds the 50 MB size limit.");
  }

  if (typeCheckFn && !typeCheckFn(file)) {
    throw new Error(typeErrorMsg);
  }
}

function buildResult(originalFile, compressedBlob, algorithm) {
  const originalSize = originalFile.size;
  const compressedSize = compressedBlob.size;

  return {
    compressedBlob,
    originalSize,
    compressedSize,
    algorithm,
    noGain: compressedSize >= originalSize,
  };
}

export async function compressPNG(file) {
  validateFile(
    file,
    (f) => f.name.endsWith(".png") || f.type === "image/png",
    "Only .png files are supported for PNG compression."
  );

  const arrayBuffer = await file.arrayBuffer();

  const img = UPNG.decode(arrayBuffer);
  const rgbaFrames = UPNG.toRGBA8(img);

  const compressedBuffer = UPNG.encode(rgbaFrames, img.width, img.height, 0);
  const compressedBlob = new Blob([compressedBuffer], { type: "image/png" });

  return buildResult(file, compressedBlob, "UPNG.js (Lossless PNG re-encode)");
}
