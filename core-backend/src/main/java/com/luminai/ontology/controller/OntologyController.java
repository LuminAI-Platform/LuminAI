package com.luminai.ontology.controller;

import com.luminai.ontology.dto.EntityTypeDto;
import com.luminai.ontology.dto.OntologyVersionDto;
import com.luminai.ontology.dto.RelationshipTypeDto;
import com.luminai.ontology.service.EntityTypeService;
import com.luminai.ontology.service.OntologyVersionService;
import com.luminai.ontology.service.RelationshipTypeService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST API for dynamic Ontology Entity Types, Relationship Types, Schema Versioning, and
 * Publishing.
 *
 * <p>All endpoints are tenant-isolated and require authentication.
 */
@RestController
@RequestMapping("/api/v1/ontology")
@Tag(
    name = "Ontology",
    description = "Dynamic Ontology Management, Relationship Types & Version Publishing")
public class OntologyController {

  private final EntityTypeService entityTypeService;
  private final RelationshipTypeService relationshipTypeService;
  private final OntologyVersionService ontologyVersionService;

  public OntologyController(
      EntityTypeService entityTypeService,
      RelationshipTypeService relationshipTypeService,
      OntologyVersionService ontologyVersionService) {
    this.entityTypeService = entityTypeService;
    this.relationshipTypeService = relationshipTypeService;
    this.ontologyVersionService = ontologyVersionService;
  }

  // ================================================================
  // Entity Types Endpoints
  // ================================================================

  @GetMapping("/entity-types")
  @Operation(
      summary = "List all entity types",
      description = "Retrieves all registered entity types for the active tenant")
  @ApiResponse(responseCode = "200", description = "List of entity types")
  public ResponseEntity<List<EntityTypeDto.Response>> getAllEntityTypes() {
    return ResponseEntity.ok(entityTypeService.getAll());
  }

  @GetMapping("/entity-types/{id}")
  @Operation(
      summary = "Get entity type by ID",
      description = "Retrieves a specific entity type schema by its UUID")
  @ApiResponses({
    @ApiResponse(responseCode = "200", description = "Entity type schema details"),
    @ApiResponse(responseCode = "404", description = "Entity type not found")
  })
  public ResponseEntity<EntityTypeDto.Response> getEntityTypeById(@PathVariable UUID id) {
    return ResponseEntity.ok(entityTypeService.getById(id));
  }

  @PostMapping("/entity-types")
  @Operation(
      summary = "Create entity type",
      description = "Defines a new dynamic entity type schema with custom property rules")
  @ApiResponses({
    @ApiResponse(responseCode = "201", description = "Entity type created successfully"),
    @ApiResponse(responseCode = "400", description = "Invalid request payload"),
    @ApiResponse(responseCode = "409", description = "Entity type with this name already exists")
  })
  public ResponseEntity<EntityTypeDto.Response> createEntityType(
      @Valid @RequestBody EntityTypeDto.CreateRequest request) {
    EntityTypeDto.Response created = entityTypeService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @PutMapping("/entity-types/{id}")
  @Operation(
      summary = "Update entity type",
      description = "Updates schema properties or display metadata for an entity type")
  @ApiResponses({
    @ApiResponse(responseCode = "200", description = "Entity type updated successfully"),
    @ApiResponse(responseCode = "400", description = "Invalid request payload"),
    @ApiResponse(responseCode = "404", description = "Entity type not found"),
    @ApiResponse(responseCode = "409", description = "Conflicting entity type name")
  })
  public ResponseEntity<EntityTypeDto.Response> updateEntityType(
      @PathVariable UUID id, @RequestBody EntityTypeDto.UpdateRequest request) {
    return ResponseEntity.ok(entityTypeService.update(id, request));
  }

  @DeleteMapping("/entity-types/{id}")
  @Operation(summary = "Delete entity type", description = "Deletes an entity type definition")
  @ApiResponses({
    @ApiResponse(responseCode = "204", description = "Entity type deleted successfully"),
    @ApiResponse(responseCode = "404", description = "Entity type not found")
  })
  public ResponseEntity<Void> deleteEntityType(@PathVariable UUID id) {
    entityTypeService.delete(id);
    return ResponseEntity.noContent().build();
  }

  // ================================================================
  // Relationship Types Endpoints
  // ================================================================

  @GetMapping("/relationship-types")
  @Operation(
      summary = "List all relationship types",
      description = "Retrieves all directional relationship types defined for the tenant")
  @ApiResponse(responseCode = "200", description = "List of relationship types")
  public ResponseEntity<List<RelationshipTypeDto.Response>> getAllRelationshipTypes() {
    return ResponseEntity.ok(relationshipTypeService.getAll());
  }

  @GetMapping("/relationship-types/{id}")
  @Operation(
      summary = "Get relationship type by ID",
      description = "Retrieves details of a specific relationship type")
  @ApiResponses({
    @ApiResponse(responseCode = "200", description = "Relationship type details"),
    @ApiResponse(responseCode = "404", description = "Relationship type not found")
  })
  public ResponseEntity<RelationshipTypeDto.Response> getRelationshipTypeById(
      @PathVariable UUID id) {
    return ResponseEntity.ok(relationshipTypeService.getById(id));
  }

  @PostMapping("/relationship-types")
  @Operation(
      summary = "Create relationship type",
      description = "Defines a directional relationship between two entity types")
  @ApiResponses({
    @ApiResponse(responseCode = "201", description = "Relationship type created successfully"),
    @ApiResponse(
        responseCode = "400",
        description = "Invalid request payload or source/target entity types not found"),
    @ApiResponse(
        responseCode = "409",
        description = "Relationship type with this name already exists")
  })
  public ResponseEntity<RelationshipTypeDto.Response> createRelationshipType(
      @Valid @RequestBody RelationshipTypeDto.CreateRequest request) {
    RelationshipTypeDto.Response created = relationshipTypeService.create(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(created);
  }

  @PutMapping("/relationship-types/{id}")
  @Operation(
      summary = "Update relationship type",
      description = "Updates a relationship type configuration")
  @ApiResponses({
    @ApiResponse(responseCode = "200", description = "Relationship type updated successfully"),
    @ApiResponse(responseCode = "400", description = "Invalid payload"),
    @ApiResponse(responseCode = "404", description = "Relationship type not found"),
    @ApiResponse(responseCode = "409", description = "Conflicting relationship type name")
  })
  public ResponseEntity<RelationshipTypeDto.Response> updateRelationshipType(
      @PathVariable UUID id, @RequestBody RelationshipTypeDto.UpdateRequest request) {
    return ResponseEntity.ok(relationshipTypeService.update(id, request));
  }

  @DeleteMapping("/relationship-types/{id}")
  @Operation(
      summary = "Delete relationship type",
      description = "Deletes a relationship type definition")
  @ApiResponses({
    @ApiResponse(responseCode = "204", description = "Relationship type deleted successfully"),
    @ApiResponse(responseCode = "404", description = "Relationship type not found")
  })
  public ResponseEntity<Void> deleteRelationshipType(@PathVariable UUID id) {
    relationshipTypeService.delete(id);
    return ResponseEntity.noContent().build();
  }

  // ================================================================
  // Ontology Versions & Publishing Endpoints
  // ================================================================

  @GetMapping("/versions")
  @Operation(
      summary = "List ontology versions",
      description = "Retrieves all published and draft ontology versions")
  @ApiResponse(responseCode = "200", description = "List of ontology versions")
  public ResponseEntity<List<OntologyVersionDto.Response>> getAllVersions() {
    return ResponseEntity.ok(ontologyVersionService.getAll());
  }

  @GetMapping("/versions/{id}")
  @Operation(
      summary = "Get ontology version by ID",
      description = "Retrieves details and snapshot of an ontology version")
  @ApiResponses({
    @ApiResponse(responseCode = "200", description = "Ontology version details"),
    @ApiResponse(responseCode = "404", description = "Ontology version not found")
  })
  public ResponseEntity<OntologyVersionDto.Response> getVersionById(@PathVariable UUID id) {
    return ResponseEntity.ok(ontologyVersionService.getById(id));
  }

  @PostMapping("/versions")
  @Operation(
      summary = "Publish ontology version",
      description = "Publishes an immutable snapshot of all current entity and relationship types")
  @ApiResponses({
    @ApiResponse(responseCode = "201", description = "Version published successfully"),
    @ApiResponse(responseCode = "400", description = "Invalid semver string"),
    @ApiResponse(responseCode = "409", description = "Version already exists")
  })
  public ResponseEntity<OntologyVersionDto.Response> publishVersion(
      @Valid @RequestBody OntologyVersionDto.CreateRequest request) {
    OntologyVersionDto.Response published = ontologyVersionService.publishVersion(request);
    return ResponseEntity.status(HttpStatus.CREATED).body(published);
  }

  @GetMapping("/versions/{id}/diff")
  @Operation(
      summary = "Get version diff",
      description = "Calculates schema differences against the previous version")
  @ApiResponses({
    @ApiResponse(responseCode = "200", description = "Schema diff between versions"),
    @ApiResponse(responseCode = "404", description = "Ontology version not found")
  })
  public ResponseEntity<OntologyVersionDto.DiffResponse> getVersionDiff(@PathVariable UUID id) {
    return ResponseEntity.ok(ontologyVersionService.getVersionDiff(id));
  }
}
