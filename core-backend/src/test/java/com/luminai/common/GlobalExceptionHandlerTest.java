package com.luminai.common;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.luminai.common.exception.ConflictException;
import com.luminai.common.exception.EntityNotFoundException;
import com.luminai.common.exception.GlobalExceptionHandler;
import com.luminai.common.exception.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

class GlobalExceptionHandlerTest {

  @RestController
  static class TestExceptionController {
    @GetMapping("/test/not-found")
    public void throwNotFound() {
      throw new ResourceNotFoundException("Connection", "123");
    }

    @GetMapping("/test/entity-not-found")
    public void throwEntityNotFound() {
      throw new EntityNotFoundException("Customer", "c-999");
    }

    @GetMapping("/test/bad-request")
    public void throwBadRequest() {
      throw new IllegalArgumentException("Invalid parameter range");
    }

    @GetMapping("/test/forbidden")
    public void throwForbidden() {
      throw new AccessDeniedException("Access denied to tenant resources");
    }

    @GetMapping("/test/conflict")
    public void throwConflict() {
      throw new ConflictException("Connection name already registered");
    }

    @GetMapping("/test/internal-error")
    public void throwInternalError() {
      throw new RuntimeException("Database timeout failure");
    }
  }

  private MockMvc mockMvc;

  @BeforeEach
  void setUp() {
    mockMvc =
        MockMvcBuilders.standaloneSetup(new TestExceptionController())
            .setControllerAdvice(new GlobalExceptionHandler())
            .build();
  }

  @Test
  @DisplayName("404 ResourceNotFoundException returns structured NOT_FOUND error")
  void testResourceNotFound() throws Exception {
    mockMvc
        .perform(get("/test/not-found"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.error").value("NOT_FOUND"))
        .andExpect(jsonPath("$.message").value("Connection not found with id: '123'"))
        .andExpect(jsonPath("$.path").value("/test/not-found"))
        .andExpect(jsonPath("$.correlationId").isNotEmpty())
        .andExpect(jsonPath("$.timestamp").isNotEmpty());
  }

  @Test
  @DisplayName("404 EntityNotFoundException returns structured NOT_FOUND error")
  void testEntityNotFound() throws Exception {
    mockMvc
        .perform(get("/test/entity-not-found"))
        .andExpect(status().isNotFound())
        .andExpect(jsonPath("$.error").value("NOT_FOUND"))
        .andExpect(jsonPath("$.message").value("Customer not found with id: 'c-999'"))
        .andExpect(jsonPath("$.path").value("/test/entity-not-found"))
        .andExpect(jsonPath("$.correlationId").isNotEmpty());
  }

  @Test
  @DisplayName("400 IllegalArgumentException returns structured BAD_REQUEST error")
  void testBadRequest() throws Exception {
    mockMvc
        .perform(get("/test/bad-request"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("BAD_REQUEST"))
        .andExpect(jsonPath("$.message").value("Invalid parameter range"))
        .andExpect(jsonPath("$.path").value("/test/bad-request"))
        .andExpect(jsonPath("$.correlationId").isNotEmpty());
  }

  @Test
  @DisplayName("403 AccessDeniedException returns structured FORBIDDEN error")
  void testForbidden() throws Exception {
    mockMvc
        .perform(get("/test/forbidden"))
        .andExpect(status().isForbidden())
        .andExpect(jsonPath("$.error").value("FORBIDDEN"))
        .andExpect(
            jsonPath("$.message").value("You do not have permission to access this resource"))
        .andExpect(jsonPath("$.path").value("/test/forbidden"))
        .andExpect(jsonPath("$.correlationId").isNotEmpty());
  }

  @Test
  @DisplayName("409 ConflictException returns structured CONFLICT error")
  void testConflict() throws Exception {
    mockMvc
        .perform(get("/test/conflict"))
        .andExpect(status().isConflict())
        .andExpect(jsonPath("$.error").value("CONFLICT"))
        .andExpect(jsonPath("$.message").value("Connection name already registered"))
        .andExpect(jsonPath("$.path").value("/test/conflict"))
        .andExpect(jsonPath("$.correlationId").isNotEmpty());
  }

  @Test
  @DisplayName("500 Internal error returns sanitized message without leaking internals")
  void testInternalServerError() throws Exception {
    mockMvc
        .perform(get("/test/internal-error"))
        .andExpect(status().isInternalServerError())
        .andExpect(jsonPath("$.error").value("INTERNAL_SERVER_ERROR"))
        .andExpect(jsonPath("$.message").value("An unexpected internal server error occurred"))
        .andExpect(jsonPath("$.path").value("/test/internal-error"))
        .andExpect(jsonPath("$.correlationId").isNotEmpty());
  }
}
