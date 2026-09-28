package com.luminai.audit.controller;

import com.luminai.audit.dto.AuditLogDto;
import com.luminai.audit.service.AuditService;
import com.luminai.common.security.JwtClaimsExtractor;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Enterprise REST API for compliance audit logging, activity trails, and forensic analysis. */
@RestController
@RequestMapping("/api/v1/audit")
@Tag(
    name = "Audit Logs",
    description = "Enterprise compliance audit trail and forensic activity logs")
public class AuditController {

  private final AuditService auditService;
  private final JwtClaimsExtractor claimsExtractor;

  public AuditController(AuditService auditService, JwtClaimsExtractor claimsExtractor) {
    this.auditService = auditService;
    this.claimsExtractor = claimsExtractor;
  }

  @Operation(
      summary = "Query Audit Trail",
      description =
          "Retrieves tenant-scoped audit logs with optional action and resource type filtering.")
  @ApiResponse(responseCode = "200", description = "Audit trail page retrieved successfully")
  @GetMapping
  public ResponseEntity<Page<AuditLogDto.Response>> getAuditLogs(
      @Parameter(description = "Filter by action (e.g. MERGE_ENTITIES, SPLIT_CLUSTER, FILE_UPLOAD)")
          @RequestParam(required = false)
          String action,
      @Parameter(
              description = "Filter by resource type (e.g. GoldenRecord, Connection, PipelineRun)")
          @RequestParam(required = false)
          String resourceType,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {

    int safePage = Math.max(0, page);
    int safeSize = Math.min(Math.max(1, size), 100);

    Page<AuditLogDto.Response> result =
        auditService.getAuditLogs(action, resourceType, PageRequest.of(safePage, safeSize));
    return ResponseEntity.ok(result);
  }

  @Operation(
      summary = "Record Audit Event",
      description =
          "Appends a new audit log event for analyst actions, compliance reviews, or export operations.")
  @ApiResponse(responseCode = "201", description = "Audit event recorded successfully")
  @PostMapping
  public ResponseEntity<AuditLogDto.Response> recordAuditEvent(
      @Valid @RequestBody AuditLogDto.CreateRequest request,
      Authentication authentication,
      HttpServletRequest servletRequest) {

    UUID userId = null;
    try {
      String sub = claimsExtractor.getCurrentUserId();
      if (sub != null && !sub.isBlank()) {
        try {
          userId = UUID.fromString(sub);
        } catch (IllegalArgumentException ignored) {
        }
      }
    } catch (Exception ignored) {
    }

    String ipAddress = servletRequest.getRemoteAddr();

    AuditLogDto.Response created =
        auditService.recordEvent(
            userId,
            request.action(),
            request.resourceType(),
            request.resourceId(),
            request.changes(),
            ipAddress);

    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }
}
