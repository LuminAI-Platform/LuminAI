package com.luminai.connection.controller;

import com.luminai.connection.service.CleaningRuleService;
import com.luminai.connection.dto.CleaningRuleDto;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST API for managing per-connector cleaning rules. Cleaning rules define data transformation
 * operations (TRIM, UPPERCASE, DATE_NORMALIZE, etc.) that the Data Engine cleaning pipeline applies
 * to specific columns during ingestion. Rules are executed in ascending priority order. All
 * endpoints require a valid JWT. Tenant isolation is enforced by the service layer — the
 * authenticated tenant can only access its own cleaning rules. GET
 * /api/v1/connections/{connectionId}/cleaning-rules — List rules for connector POST
 * /api/v1/connections/{connectionId}/cleaning-rules — Create rule PUT
 * /api/v1/connections/{connectionId}/cleaning-rules/{ruleId} — Update rule DELETE
 * /api/v1/connections/{connectionId}/cleaning-rules/{ruleId} — Delete rule
 */
@RestController
@RequestMapping("/api/v1/connections/{connectionId}/cleaning-rules")
@Tag(name = "Cleaning Rules", description = "Per-connector data cleaning rule management")
public class CleaningRuleController {

  private final CleaningRuleService cleaningRuleService;

  public CleaningRuleController(CleaningRuleService cleaningRuleService) {
    this.cleaningRuleService = cleaningRuleService;
  }

  @GetMapping
  @Operation(
      summary = "List cleaning rules",
      description = "Returns all rules for a connector, ordered by priority")
  public ResponseEntity<List<CleaningRuleDto.Response>> list(@PathVariable UUID connectionId) {

    return ResponseEntity.ok(cleaningRuleService.getAllForConnection(connectionId));
  }

  @PostMapping
  @Operation(
      summary = "Create cleaning rule",
      description = "Creates a new data cleaning rule for the connector")
  public ResponseEntity<CleaningRuleDto.Response> create(
      @PathVariable UUID connectionId, @Valid @RequestBody CleaningRuleDto.CreateRequest request) {

    CleaningRuleDto.Response created = cleaningRuleService.create(connectionId, request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @PutMapping("/{ruleId}")
  @Operation(
      summary = "Update cleaning rule",
      description = "Partially updates an existing cleaning rule")
  public ResponseEntity<CleaningRuleDto.Response> update(
      @PathVariable UUID connectionId,
      @PathVariable UUID ruleId,
      @RequestBody CleaningRuleDto.UpdateRequest request) {

    return ResponseEntity.ok(cleaningRuleService.update(ruleId, request));
  }

  @DeleteMapping("/{ruleId}")
  @Operation(
      summary = "Delete cleaning rule",
      description = "Removes a cleaning rule from the connector")
  public ResponseEntity<Void> delete(@PathVariable UUID connectionId, @PathVariable UUID ruleId) {

    cleaningRuleService.delete(ruleId);
    return ResponseEntity.noContent().build();
  }
}
