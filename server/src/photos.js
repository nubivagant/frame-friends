"use strict";
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const sharp = require("sharp");
const config = require("./config");

const PHOTOS_DIR = path.resolve(config.photosDir);
fs.mkdirSync(PHOTOS_DIR, { recursive: true });

function photoAbsolutePath(relativePath) {
  return path.join(PHOTOS_DIR, relativePath);
}

/** Resizes/re-encodes an uploaded image buffer and writes it to disk.
 *  Returns the relative path to store in Submission.photoPath. */
async function saveResizedPhoto(buffer) {
  const filename = `${crypto.randomUUID()}.jpg`;
  const out = photoAbsolutePath(filename);
  await sharp(buffer)
    .rotate() // respect EXIF orientation before stripping it
    .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(out);
  return filename;
}

async function deletePhoto(relativePath) {
  try {
    await fsp.unlink(photoAbsolutePath(relativePath));
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

module.exports = { photoAbsolutePath, saveResizedPhoto, deletePhoto, PHOTOS_DIR };
