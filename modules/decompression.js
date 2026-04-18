import { validateOutput } from "./validation.js";

export async function processDecompression(originalFile, compressedObj) {

  if (!compressedObj || !compressedObj.file) {
    return {
      error: true,
      message: "Invalid compressed file input"
    };
  }

  const decompressedFile = await decompressFile(compressedObj);

  if (decompressedFile.error) {
    return decompressedFile;
  }

  const validation = await validateOutput(
    originalFile,
    decompressedFile,
    compressedObj.type
  );

  return {
    decompressedFile,   // UI will handle download
    validation
  };
}


// Routing Layer
async function decompressFile(fileObj) {
  const { file, type } = fileObj;

  try {
    switch (type) {

      case "text":
        return await decompressText(file);

      case "image":
        return await decompressImage(file);

      case "audio":
        return await decompressAudio(file);

      case "video":
        return await decompressVideo(file);

      default:
        return {
          error: true,
          message: "Unsupported file type"
        };
    }

  } catch (err) {
    return {
      error: true,
      message: err.message || "Decompression failed"
    };
  }
}


// Temporary Dummy Functions (Replace later)
async function decompressText(file) {
  return file;
}

async function decompressImage(file) {
  return file;
}

async function decompressAudio(file) {
  return file;
}

async function decompressVideo(file) {
  return file;
}