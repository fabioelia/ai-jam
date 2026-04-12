import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';
import { randomUUID } from 'crypto';
import { config } from '../config.js';

const AVATAR_SIZES = { width: 256, height: 256 } as const;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const s3 = new S3Client({
  region: config.s3Region,
  ...(config.s3Endpoint && { endpoint: config.s3Endpoint }),
  ...(config.s3AccessKeyId && config.s3SecretAccessKey && {
    credentials: {
      accessKeyId: config.s3AccessKeyId,
      secretAccessKey: config.s3SecretAccessKey,
    },
  }),
});

export function validateAvatarMimetype(mimetype: string): boolean {
  return ALLOWED_MIMETYPES.includes(mimetype);
}

export function validateAvatarSize(size: number): boolean {
  return size <= MAX_FILE_SIZE;
}

/** Resize image to 256x256 WebP, return buffer. */
export async function resizeAvatar(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(AVATAR_SIZES.width, AVATAR_SIZES.height, { fit: 'cover' })
    .webp({ quality: 80 })
    .toBuffer();
}

/** Upload resized avatar to S3, return public URL. */
export async function uploadAvatarToS3(userId: string, imageBuffer: Buffer): Promise<string> {
  const key = `avatars/${userId}/${randomUUID()}.webp`;

  await s3.send(new PutObjectCommand({
    Bucket: config.s3Bucket,
    Key: key,
    Body: imageBuffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  // If custom endpoint (e.g. MinIO), build URL from that; otherwise standard S3 URL
  if (config.s3Endpoint) {
    return `${config.s3Endpoint}/${config.s3Bucket}/${key}`;
  }
  return `https://${config.s3Bucket}.s3.${config.s3Region}.amazonaws.com/${key}`;
}

/** Delete old avatar from S3 given its full URL. */
export async function deleteAvatarFromS3(avatarUrl: string): Promise<void> {
  try {
    const url = new URL(avatarUrl);
    // Extract key from URL path (remove leading slash)
    let key: string;
    if (config.s3Endpoint) {
      // Custom endpoint: /{bucket}/{key}
      key = url.pathname.replace(`/${config.s3Bucket}/`, '');
    } else {
      // Standard S3: /{key}
      key = url.pathname.slice(1);
    }

    await s3.send(new DeleteObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
    }));
  } catch {
    // Non-critical — old avatar cleanup failure shouldn't block upload
  }
}
