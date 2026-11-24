package com.luminai.config;

import io.minio.MinioClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

  private static final Logger log = LoggerFactory.getLogger(MinioConfig.class);

  @Value("${MINIO_ENDPOINT:${minio.url:http://minio:9000}}")
  private String url;

  @Value("${MINIO_ACCESS_KEY:${minio.access-key:minioadmin}}")
  private String accessKey;

  @Value("${MINIO_SECRET_KEY:${minio.secret-key:minioadmin}}")
  private String secretKey;

  @Bean
  public MinioClient minioClient() {
    String endpoint = (url != null && !url.trim().isEmpty()) ? url.trim() : "http://minio:9000";
    if (!endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
      endpoint = "http://" + endpoint;
    }
    String access =
        (accessKey != null && !accessKey.trim().isEmpty()) ? accessKey.trim() : "minioadmin";
    String secret =
        (secretKey != null && !secretKey.trim().isEmpty()) ? secretKey.trim() : "minioadmin";

    try {
      log.info("Initializing MinioClient with endpoint: {}", endpoint);
      return MinioClient.builder().endpoint(endpoint).credentials(access, secret).build();
    } catch (Exception e) {
      log.error(
          "Failed to initialize MinioClient with endpoint '{}', falling back to localhost: {}",
          endpoint,
          e.getMessage());
      return MinioClient.builder()
          .endpoint("http://localhost:9000")
          .credentials("minioadmin", "minioadmin")
          .build();
    }
  }
}
