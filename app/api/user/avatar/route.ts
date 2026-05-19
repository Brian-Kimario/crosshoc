/**
 * app/api/user/avatar/route.ts — Avatar upload and removal
 *
 * POST  /api/user/avatar — Upload a new avatar image
 * DELETE /api/user/avatar — Remove the current avatar
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import dbConnect from "@/lib/db";
import User from "@/lib/models/User";
import {
  verifyAuth,
  unauthorizedResponse,
  errorResponse,
} from "@/lib/auth";
import {
  checkRateLimit,
  rateLimitExceededResponse,
} from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

// ─── Cloudinary configuration ─────────────────────────────────────────────────

function configureCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

// ─── POST /api/user/avatar ────────────────────────────────────────────────────

/**
 * Upload a new avatar image for the authenticated user.
 *
 * Accepts multipart/form-data with a "file" field.
 * Validates MIME type and file size before uploading to Cloudinary
 * with a face-aware 256×256 crop. Stores the resulting URL on the user.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Rate limit check
    const rateLimitResult = await checkRateLimit(request, "upload");
    if (!rateLimitResult.success) {
      return rateLimitExceededResponse(rateLimitResult);
    }

    // 2. Auth check
    await dbConnect();
    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    // 3. Parse multipart/form-data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return errorResponse("Invalid multipart/form-data request", 400);
    }

    const fileEntry = formData.get("file");
    if (!fileEntry || !(fileEntry instanceof File)) {
      return errorResponse(
        'No file provided. Include a "file" field in the form data.',
        400
      );
    }

    const file = fileEntry as File;

    // 4. MIME type validation
    const mimeType = file.type;
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return errorResponse(
        "Unsupported file type. Only JPEG, PNG, and WebP images are allowed.",
        400
      );
    }

    // 5. File size validation
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_FILE_SIZE) {
      return errorResponse("File exceeds the 5 MB size limit.", 400);
    }

    // 6. Upload to Cloudinary with face-aware 256×256 crop
    configureCloudinary();

    const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;

    const uploadResult = await cloudinary.uploader.upload(dataUri, {
      folder: "spliteasy/avatars",
      public_id: `user_${userId}`,
      overwrite: true,
      transformation: [
        { width: 256, height: 256, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    const avatarUrl = uploadResult.secure_url;

    // 7. Store avatarUrl on the user document
    await User.findByIdAndUpdate(userId, { $set: { avatarUrl } });

    return NextResponse.json({ success: true, avatarUrl }, { status: 200 });
  } catch (error) {
    logError("[user avatar POST]", error);
    return errorResponse("Internal server error", 500);
  }
}

// ─── DELETE /api/user/avatar ──────────────────────────────────────────────────

/**
 * Remove the authenticated user's avatar.
 *
 * Sets avatarUrl to null on the user document and attempts to destroy
 * the Cloudinary asset (non-fatal if it fails).
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check
    await dbConnect();
    const userId = await verifyAuth(request);
    if (!userId) {
      return unauthorizedResponse();
    }

    // 2. Clear avatarUrl on the user document
    await User.findByIdAndUpdate(userId, { $set: { avatarUrl: null } });

    // 3. Attempt to destroy the Cloudinary asset (non-fatal)
    try {
      configureCloudinary();
      await cloudinary.uploader.destroy(`spliteasy/avatars/user_${userId}`);
    } catch (cloudinaryError) {
      // Non-fatal — log but do not fail the request
      logError("[user avatar DELETE] Cloudinary destroy failed", cloudinaryError);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    logError("[user avatar DELETE]", error);
    return errorResponse("Internal server error", 500);
  }
}
