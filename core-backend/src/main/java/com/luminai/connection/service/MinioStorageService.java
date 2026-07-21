package com.luminai.connection.service;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.PutObjectArgs;
import io.minio.RemoveObjectArgs;
import java.io.InputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/** Low-level MinIO storage service for uploading and managing raw files. */
@Service
public class MinioStorageService {

  private static final Logger log = LoggerFactory.getLogger(MinioStorageService.class);

  private final MinioClient minioClient;

  @Value("${minio.bucket:luminai-raw}")
  private String bucket;

  public MinioStorageService(MinioClient minioClient) {
    this.minioClient = minioClient;
  }

  /**
   * Uploads a file to MinIO under the given object key.
   *
   * @param objectKey the full path/key in the bucket (e.g. tenant-id/uploads/file.csv)
   * @param inputStream the file content stream
   * @param contentType MIME type of the file
   * @param sizeBytes exact byte size of the stream (-1 if unknown, triggers multipart)
   */
  public void upload(
      String objectKey, InputStream inputStream, String contentType, long sizeBytes) {
    try {
      ensureBucketExists();

      // MinIO SDK handles multipart automatically when partSize is set.
      // We use 10 MB parts for files > 50 MB (partSize must be >= 5 MB per S3 spec).
      long partSize = sizeBytes > FileConnectorService.MULTIPART_THRESHOLD ? 10 * 1024 * 1024 : -1;

      PutObjectArgs args =
          PutObjectArgs.builder().bucket(bucket).object(objectKey).stream(
                  inputStream, sizeBytes, partSize)
              .contentType(contentType)
              .build();

      minioClient.putObject(args);
      log.info("Uploaded object '{}' to bucket '{}'", objectKey, bucket);

    } catch (Exception e) {
      throw new RuntimeException("Failed to upload file to MinIO: " + e.getMessage(), e);
    }
  }

  /**
   * Deletes an object from MinIO.
   *
   * @param objectKey the full path/key in the bucket
   */
  public void delete(String objectKey) {
    try {
      minioClient.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build());
      log.info("Deleted object '{}' from bucket '{}'", objectKey, bucket);
    } catch (Exception e) {
      throw new RuntimeException("Failed to delete file from MinIO: " + e.getMessage(), e);
    }
  }

  private void ensureBucketExists() throws Exception {
    boolean exists = minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucket).build());
    if (!exists) {
      minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
      log.info("Created MinIO bucket '{}'", bucket);
    }
  }
}
