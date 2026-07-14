package com.luminai;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest(properties = "spring.profiles.active=test")
@ActiveProfiles("test")
@Import(TestcontainersConfig.class)
@Testcontainers(disabledWithoutDocker = true)
class LuminAiApplicationTests {

  @Test
  void contextLoads() {}
}
