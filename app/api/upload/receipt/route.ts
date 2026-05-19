/**
 * app/api/upload/receipt/route.ts — File upload security pipeline
 *
 * Requirements: 1.8, 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.1, 11.3
 *
 * Validation pipeline (in order):
 *  1. Rate limit check (upload preset: 10/60s)
 *  2. Auth check
 *  3. Parse multipart/form-data and extract file
 *  4. MIME type allowlist check → HTTP 415
 *  5. Size check (> 10 MiB) → HTTP 413
 *  6. Magic bytes check → HTTP 415
 *  7. Filename sanitization
 *  8. Upload to Cloudinary
 */

import { NextRequest, NextResponse } from 'next/server';
import { v2 } from 'cloudinary';
import { checkRateLimit, rateLimitExceededResponse } from '@/lib/rate-limit';
import { verifyAuth, unauthorizedResponse } from '@/lib/auth';
import { sanitizeFilename } from '@/lib/sanitize';
import { logError } from '@/lib/logger';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

const MAX_FILE_SIZE = 10_485_760; // 10 MiB

// ─── Magic bytes table ────────────────────────────────────────────────────────

const MAGIC_BYTES: Record<string, (buf: Buffer) => boolean> = {
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/png': (b) =>
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47 &&
    b[4] === 0x0d &&
    b[5] === 0x0a &&
    b[6] === 0x1a &&
    b[7] === 0x0a,
  'image/webp': (b) =>
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50,
  'image/gif': (b) =>
    b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  'application/pdf': (b) =>
    b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
};

// ─── Cloudinary configuration ─────────────────────────────────────────────────

function configureCloudinary() {
  v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Rate limit check — must be first
    const rateLimitResult = await checkRateLimit(request, 'upload');
    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    // 2. Auth check
    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    // 3. Parse multipart/form-data and extract file
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid multipart/form-data request' },
        { status: 400 }
      );
    }

    const fileEntry = formData.get('file');
    if (!fileEntry || !(fileEntry instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Include a "file" field in the form data.' },
        { status: 400 }
      );
    }

    const file = fileEntry as File;

    // 4. MIME type allowlist check
    const mimeType = file.type;
    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 415 }
      );
    }

    // 5. Read file as Buffer and check size
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File exceeds 10 MiB limit' },
        { status: 413 }
      );
    }

    // 6. Magic bytes check — verify actual file content matches declared MIME type
    const magicCheck = MAGIC_BYTES[mimeType];
    if (!magicCheck || !magicCheck(buffer)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 415 }
      );
    }

    // 7. Filename sanitization
    const safeFilename = sanitizeFilename(file.name);

    // 8. Upload to Cloudinary (only after all checks pass)
    configureCloudinary();

    const dataUri = `data:${mimeType};base64,${buffer.toString('base64')}`;

    const uploadResult = await v2.uploader.upload(dataUri, {
      resource_type: 'auto',
      folder: 'receipts',
      public_id: safeFilename ? safeFilename.replace(/\.[^.]+$/, '') : undefined,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          url: uploadResult.secure_url,
          publicId: uploadResult.public_id,
          format: uploadResult.format,
          bytes: uploadResult.bytes,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    logError('[upload receipt]', error);
    return NextResponse.json(
      { success: false, error: 'An error occurred while uploading the file.' },
      { status: 500 }
    );
  }
}
