package com.luminai.config;

import io.minio.MinioClient;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class MinioConfig {

  @Value("${MINIO_ENDPOINT:${minio.url:http://localhost:9000}}")
  private String url;

  @Value("${MINIO_ACCESS_KEY:${minio.access-key:minioadmin}}")
  private String accessKey;

  @Value("${MINIO_SECRET_KEY:${minio.secret-key:minioadmin}}")
  private String secretKey;

  @Bean
  public MinioClient minioClient() {
    return MinioClient.builder().endpoint(url).credentials(accessKey, secretKey).build();
  }
}
