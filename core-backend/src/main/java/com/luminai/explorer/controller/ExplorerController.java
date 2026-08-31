package com.luminai.explorer.controller;

import com.luminai.explorer.dto.EntityDetailDto;
import com.luminai.explorer.dto.ProvenanceItem;
import com.luminai.explorer.dto.SearchResponseDto;
import com.luminai.explorer.service.ExplorerSearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST API for Explorer full-text search, facet filtering, entity detail views, and provenance
 * lineage.
 */
@RestController
@RequestMapping("/api/v1/explorer")
@Tag(
    name = "Explorer",
    description = "Global Entity Search, Facets, Entity Details & Provenance Lineage")
public class ExplorerController {

  private final ExplorerSearchService searchService;

  public ExplorerController(ExplorerSearchService searchService) {
    this.searchService = searchService;
  }

  @GetMapping("/search")
  @Operation(
      summary = "Search entities",
      description =
          "Full-text search across canonical entity names and properties with facet aggregations and pagination")
  @ApiResponse(responseCode = "200", description = "Paginated search results with facet counts")
  public ResponseEntity<SearchResponseDto.Response> search(
      @RequestParam(name = "query", required = false, defaultValue = "") String query,
      @RequestParam(name = "entityType", required = false) String entityType,
      @RequestParam(name = "page", required = false, defaultValue = "0") int page,
      @RequestParam(name = "size", required = false, defaultValue = "20") int size,
      @RequestParam(name = "sortBy", required = false, defaultValue = "createdAt") String sortBy,
      @RequestParam(name = "sortDirection", required = false, defaultValue = "DESC")
          String sortDirection) {

    return ResponseEntity.ok(
        searchService.search(query, entityType, page, size, sortBy, sortDirection));
  }

  @GetMapping("/entities/{id}")
  @Operation(
      summary = "Get entity details",
      description =
          "Retrieves full canonical details, properties, source references, and provenance of a Golden Record")
  @ApiResponses({
    @ApiResponse(responseCode = "200", description = "Entity details found"),
    @ApiResponse(responseCode = "404", description = "Entity not found")
  })
  public ResponseEntity<EntityDetailDto.Response> getEntityById(@PathVariable UUID id) {
    return ResponseEntity.ok(searchService.getEntityById(id));
  }

  @GetMapping("/entities/{id}/provenance")
  @Operation(
      summary = "Get entity provenance lineage",
      description =
          "Retrieves field-level source audit records showing which raw dataset contributed each attribute")
  @ApiResponses({
    @ApiResponse(responseCode = "200", description = "Provenance lineage list"),
    @ApiResponse(responseCode = "404", description = "Entity not found")
  })
  public ResponseEntity<List<ProvenanceItem>> getProvenance(
      @PathVariable UUID id, @RequestParam(name = "property", required = false) String property) {

    return ResponseEntity.ok(searchService.getProvenance(id, property));
  }
}
