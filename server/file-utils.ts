import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';
import multer from 'multer';
import sharp from 'sharp';
import mime from 'mime-types';

// Promisify file system operations
const mkdir = promisify(fs.mkdir);
const rename = promisify(fs.rename);
const unlink = promisify(fs.unlink);
const exists = promisify(fs.exists);
const writeFile = promisify(fs.writeFile);

// Base directories for uploads
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');

// Ensure upload directories exist
export async function ensureDirectories() {
  try {
    if (!await exists(UPLOADS_DIR)) {
      await mkdir(UPLOADS_DIR, { recursive: true });
    }
    
    if (!await exists(THUMBNAILS_DIR)) {
      await mkdir(THUMBNAILS_DIR, { recursive: true });
    }
  } catch (err) {
    console.error('Error creating upload directories:', err);
    throw err;
  }
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    await ensureDirectories();
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to prevent conflicts
    const randomName = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${randomName}${ext}`);
  }
});

// File filter to limit file types
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Allow images, videos, audio, PDFs, and common document formats
  const allowedMimeTypes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Videos
    'video/mp4', 'video/webm', 'video/ogg',
    // Audio
    'audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm',
    // Documents
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
};

// Create multer upload instance
export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max file size
  }
});

// Function to generate thumbnail for image files
export async function generateThumbnail(filePath: string): Promise<string | null> {
  try {
    const mimeType = mime.lookup(filePath);
    
    // Only generate thumbnails for images
    if (!mimeType || !mimeType.startsWith('image/')) {
      return null;
    }
    
    // Skip SVGs as they're already scalable
    if (mimeType === 'image/svg+xml') {
      return null;
    }
    
    const fileName = path.basename(filePath);
    const thumbnailPath = path.join(THUMBNAILS_DIR, fileName);
    
    // Generate thumbnail
    await sharp(filePath)
      .resize(300, 300, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFile(thumbnailPath);
    
    return thumbnailPath;
  } catch (err) {
    console.error('Error generating thumbnail:', err);
    return null;
  }
}

// Function to get a clean relative path (for storage/retrieval)
export function getRelativePath(absolutePath: string): string {
  return absolutePath.replace(process.cwd(), '');
}

// Delete a file (used for cleanup)
export async function deleteFile(filePath: string): Promise<void> {
  try {
    if (await exists(filePath)) {
      await unlink(filePath);
    }
  } catch (err) {
    console.error(`Error deleting file ${filePath}:`, err);
  }
}

// Function to determine if a file is an image
export function isImageFile(filePath: string): boolean {
  const mimeType = mime.lookup(filePath);
  return mimeType ? mimeType.startsWith('image/') : false;
}

// Function to determine if a file is a video
export function isVideoFile(filePath: string): boolean {
  const mimeType = mime.lookup(filePath);
  return mimeType ? mimeType.startsWith('video/') : false;
}

// Function to determine if a file is audio
export function isAudioFile(filePath: string): boolean {
  const mimeType = mime.lookup(filePath);
  return mimeType ? mimeType.startsWith('audio/') : false;
}