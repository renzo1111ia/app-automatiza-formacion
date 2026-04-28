import { 
    S3Client, PutObjectCommand, GetObjectCommand, 
    DeleteObjectCommand, ListObjectsV2Command,
    HeadBucketCommand, CreateBucketCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * MINIO INTEGRATION (S3 Compatible)
 * Serves as the primary storage for Knowledge Base PDFs.
 */

const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
const accessKeyId = process.env.MINIO_ACCESS_KEY || '';
const secretAccessKey = process.env.MINIO_SECRET_KEY || '';
const bucketName = process.env.MINIO_BUCKET || 'esden-knowledge-base';
const region = 'us-east-1'; // Minio usually ignores this but SDK requires it

const minioClient = new S3Client({
    endpoint,
    region,
    forcePathStyle: true, // Required for MinIO
    credentials: {
        accessKeyId,
        secretAccessKey,
    }
});

/**
 * Ensures the target bucket exists before performing operations.
 * Auto-creates it if it throws a 404/NotFound error.
 */
async function ensureBucketExists(targetBucket: string = bucketName) {
    try {
        await minioClient.send(new HeadBucketCommand({ Bucket: targetBucket }));
    } catch (error: any) {
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            console.log(`[MINIO] Bucket '${targetBucket}' no encontrado. Creándolo automáticamente...`);
            await minioClient.send(new CreateBucketCommand({ Bucket: targetBucket }));
            console.log(`[MINIO] ✅ Bucket '${targetBucket}' creado exitosamente.`);
        } else {
            console.error(`[MINIO] Error verificando el bucket '${targetBucket}':`, error);
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

        await minioClient.send(command);
        return `minio://${bucketName}/${key}`;
    } catch (error) {
        console.error('❌ [MINIO] Error uploading:', error);
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

        return await getSignedUrl(minioClient, command, { expiresIn });
    } catch (error) {
        console.error('❌ [MINIO] Error generating signed URL:', error);
        return null;
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

        await minioClient.send(command);
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

        const response = await minioClient.send(command);
        return response.Contents || [];
    } catch (error) {
        console.error('❌ [MINIO] Error listing files:', error);
        return [];
    }
}
