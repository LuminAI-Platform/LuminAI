package com.luminai.connection.service;

import java.io.IOException;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Service for ingesting uploaded files (CSV, JSON, Excel) into MinIO raw storage under
 * tenant-isolated partition paths.
 *
 * <p>File size rules:
 *
 * <ul>
 *   <li>Files &gt; 500 MB are rejected immediately.
 *   <li>Files &gt; 50 MB use chunked multipart uploads (handled by {@link MinioStorageService}).
 *   <li>Files ≤ 50 MB use standard single-part uploads.
 * </ul>
 */
@Service
public class FileConnectorService {

  private static final Logger log = LoggerFactory.getLogger(FileConnectorService.class);

  /** Maximum allowed file size: 500 MB */
  public static final long MAX_FILE_SIZE = 500L * 1024 * 1024;

  /** Threshold above which multipart upload is used: 50 MB */
  public static final long MULTIPART_THRESHOLD = 50L * 1024 * 1024;

  private static final Set<String> ALLOWED_CONTENT_TYPES =
      Set.of(
          "text/csv",
          "application/json",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

  private static final Set<String> ALLOWED_EXTENSIONS = Set.of("csv", "json", "xls", "xlsx");

  private final MinioStorageService minioStorageService;

  public FileConnectorService(MinioStorageService minioStorageService) {
    this.minioStorageService = minioStorageService;
  }

  /**
   * Ingests an uploaded file into MinIO under a tenant-isolated partition path.
   *
   * <p>Path format: {@code {tenantId}/raw/{connectionId}/{originalFileName}}
   *
   * @param tenantId the tenant's UUID for path isolation
   * @param connectionId the connection UUID this file belongs to
   * @param file the uploaded multipart file
   * @return the MinIO object key where the file was stored
   * @throws IllegalArgumentException if the file type or size is invalid
   * @throws IOException if the file stream cannot be read
   */
  public String ingest(UUID tenantId, UUID connectionId, MultipartFile file) throws IOException {
    validateFile(file);

    String objectKey = buildObjectKey(tenantId, connectionId, file.getOriginalFilename());
    String contentType = resolveContentType(file);
    long size = file.getSize();

    log.info(
        "Ingesting file '{}' ({} bytes) for tenant '{}', connection '{}'",
        file.getOriginalFilename(),
        size,
        tenantId,
        connectionId);

    if (size > MULTIPART_THRESHOLD) {
      log.info("File exceeds {} MB — using multipart upload", MULTIPART_THRESHOLD / 1024 / 1024);
    }

    minioStorageService.upload(objectKey, file.getInputStream(), contentType, size);

    log.info("File successfully stored at '{}'", objectKey);
    return objectKey;
  }

  /**
   * Deletes a previously ingested file from MinIO.
   *
   * @param tenantId the tenant's UUID
   * @param connectionId the connection UUID
   * @param fileName the original file name
   */
  public void delete(UUID tenantId, UUID connectionId, String fileName) {
    String objectKey = buildObjectKey(tenantId, connectionId, fileName);
    minioStorageService.delete(objectKey);
  }

  // --- Private helpers ---

  private void validateFile(MultipartFile file) {
    if (file == null || file.isEmpty()) {
      throw new IllegalArgumentException("File must not be empty");
    }

    long size = file.getSize();
    if (size > MAX_FILE_SIZE) {
      throw new IllegalArgumentException(
          String.format(
              "File size %.2f MB exceeds the maximum allowed size of 500 MB",
              size / (1024.0 * 1024)));
    }

    String extension = getExtension(file.getOriginalFilename());
    if (!ALLOWED_EXTENSIONS.contains(extension.toLowerCase())) {
      throw new IllegalArgumentException(
          "Unsupported file type: ." + extension + ". Allowed types: csv, json, xls, xlsx");
    }
  }

  private String buildObjectKey(UUID tenantId, UUID connectionId, String fileName) {
    return String.format("%s/raw/%s/%s", tenantId, connectionId, fileName);
  }

  private String resolveContentType(MultipartFile file) {
    String contentType = file.getContentType();
    if (contentType == null
        || contentType.isBlank()
        || contentType.equals("application/octet-stream")) {
      String ext = getExtension(file.getOriginalFilename()).toLowerCase();
      return switch (ext) {
        case "csv" -> "text/csv";
        case "json" -> "application/json";
        case "xls" -> "application/vnd.ms-excel";
        case "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
        default -> "application/octet-stream";
      };
    }
    return contentType;
  }

  private String getExtension(String fileName) {
    if (fileName == null || !fileName.contains(".")) {
      throw new IllegalArgumentException("File must have a valid extension");
    }
    return fileName.substring(fileName.lastIndexOf('.') + 1);
  }
}
