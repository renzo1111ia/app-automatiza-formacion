import { 
    S3Client, PutObjectCommand, GetObjectCommand, 
    DeleteObjectCommand, ListObjectsV2Command,
    HeadBucketCommand, CreateBucketCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from 'stream';

/**
 * MINIO INTEGRATION (S3 Compatible)
 * Serves as the primary storage for Knowledge Base PDFs.
 */

const bucketName = process.env.MINIO_BUCKET || 'esden-knowledge-base';
let _minioClient: S3Client | null = null;

function getMinioClient() {
    if (!_minioClient) {
        const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
        const accessKeyId = process.env.MINIO_ACCESS_KEY || '';
        const secretAccessKey = process.env.MINIO_SECRET_KEY || '';
        const region = 'us-east-1';

        _minioClient = new S3Client({
            endpoint,
            region,
            forcePathStyle: true,
            credentials: {
                accessKeyId,
                secretAccessKey,
            }
        });
    }
    return _minioClient;
}

/**
 * Ensures the target bucket exists before performing operations.
 * Auto-creates it if it throws a 404/NotFound error.
 */
async function ensureBucketExists(targetBucket: string = bucketName) {
    try {
        await getMinioClient().send(new HeadBucketCommand({ Bucket: targetBucket }));
    } catch (error: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s3Error = error as any; // Temporary cast for metadata access
        if (s3Error.name === 'NotFound' || s3Error.$metadata?.httpStatusCode === 404) {
            console.log(`[MINIO] Bucket '${targetBucket}' no encontrado. Creándolo automáticamente...`);
            await getMinioClient().send(new CreateBucketCommand({ Bucket: targetBucket }));
            console.log(`[MINIO] ✅ Bucket '${targetBucket}' creado exitosamente.`);
        } else {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const s3Error = error as any;
            console.error(`[MINIO] Error verificando el bucket '${targetBucket}':`, {
                name: s3Error.name,
                message: s3Error.message,
                httpStatusCode: s3Error.$metadata?.httpStatusCode,
                requestId: s3Error.$metadata?.requestId
            });
            throw error;
        }
    }
}

/**
 * Uploads a document to MinIO
 */
export async function uploadToMinio(key: string, body: Buffer | Uint8Array | Blob | string, contentType?: string) {
    try {
        await ensureBucketExists(bucketName);

        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
        });

        await getMinioClient().send(command);
        return `minio://${bucketName}/${key}`;
    } catch (error: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s3Error = error as any;
        console.error('❌ [MINIO] Error uploading document:', {
            message: s3Error.message,
            code: s3Error.code,
            name: s3Error.name,
            httpStatusCode: s3Error.$metadata?.httpStatusCode,
            requestId: s3Error.$metadata?.requestId,
            endpoint: process.env.MINIO_ENDPOINT,
            bucket: bucketName
        });
        throw error;
    }
}

/**
 * Generates a temporal signed URL
 */
export async function getMinioSignedUrl(key: string, expiresIn = 3600) {
    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        return await getSignedUrl(getMinioClient(), command, { expiresIn });
    } catch (error) {
        console.error('❌ [MINIO] Error generating signed URL:', error);
        return null;
    }
}

/**
 * Downloads a file from MinIO directly as a Buffer
 */
export async function downloadFromMinio(key: string): Promise<Buffer> {
    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        const response = await getMinioClient().send(command);
        const stream = response.Body as Readable;

        // Convert Stream to Buffer
        return new Promise((resolve, reject) => {
            const chunks: Uint8Array[] = [];
            stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
            stream.on('error', (err: Error) => reject(err));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
        });
    } catch (error) {
        console.error('❌ [MINIO] Error downloading file:', error);
        throw error;
    }
}

/**
 * Deletes a file from MinIO
 */
export async function deleteFromMinio(key: string) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        });

        await getMinioClient().send(command);
        return true;
    } catch (error) {
        console.error('❌ [MINIO] Error deleting file:', error);
        return false;
    }
}

/**
 * List files for a specific folder/prefix
 */
export async function listFiles(prefix: string) {
    try {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix,
        });

        const response = await getMinioClient().send(command);
        return response.Contents || [];
    } catch (error) {
        console.error('❌ [MINIO] Error listing files:', error);
        return [];
    }
}
