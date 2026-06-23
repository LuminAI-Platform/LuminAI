package com.luminai.connection;

import com.luminai.connection.dto.SchemaMappingDto;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

/**
 * REST API for managing schema mapping configurations.
 *
 * <p>All endpoints require a valid JWT. Tenant isolation is enforced
 * by the service layer — the authenticated tenant can only access
 * its own schema mappings.
 *
 * <pre>
 * POST   /api/v1/schema-mappings           — Create mapping
 * GET    /api/v1/schema-mappings           — List all for tenant
 * GET    /api/v1/schema-mappings/{id}      — Get by ID
 * GET    /api/v1/schema-mappings/connector/{connectorId} — Get all for connector
 * PUT    /api/v1/schema-mappings/{id}      — Update mapping
 * DELETE /api/v1/schema-mappings/{id}      — Delete mapping
 * </pre>
 */
@RestController
@RequestMapping("/api/v1/schema-mappings")
public class SchemaMappingController {

    private final SchemaMappingService schemaMappingService;

    public SchemaMappingController(SchemaMappingService schemaMappingService) {
        this.schemaMappingService = schemaMappingService;
    }

    @PostMapping
    public ResponseEntity<SchemaMappingDto.Response> create(
            @Valid @RequestBody SchemaMappingDto.CreateRequest request) {

        SchemaMappingDto.Response created = schemaMappingService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping
    public ResponseEntity<List<SchemaMappingDto.Response>> getAll() {
        return ResponseEntity.ok(schemaMappingService.getAllForTenant());
    }

    @GetMapping("/{id}")
    public ResponseEntity<SchemaMappingDto.Response> getById(@PathVariable UUID id) {
        return ResponseEntity.ok(schemaMappingService.getById(id));
    }

    @GetMapping("/connector/{connectorId}")
    public ResponseEntity<List<SchemaMappingDto.Response>> getByConnector(
            @PathVariable UUID connectorId) {

        return ResponseEntity.ok(schemaMappingService.getAllForConnector(connectorId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SchemaMappingDto.Response> update(
            @PathVariable UUID id,
            @RequestBody SchemaMappingDto.UpdateRequest request) {

        return ResponseEntity.ok(schemaMappingService.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        schemaMappingService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
