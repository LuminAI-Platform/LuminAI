package com.luminai.graph.controller;

import com.luminai.graph.dto.GraphQueryResponseDto;
import com.luminai.graph.service.GraphQueryService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** REST API for bounded neighbourhood queries over the synchronized Entity graph. */
@RestController
@Validated
@RequestMapping("/api/v1/graph")
public class GraphController {

  private final GraphQueryService graphQueryService;

  public GraphController(GraphQueryService graphQueryService) {
    this.graphQueryService = graphQueryService;
  }

  /** The default depth is one hop; traversal is never expanded beyond four hops. */
  @GetMapping("/neighbourhood")
  public ResponseEntity<GraphQueryResponseDto> getNeighbourhood(
      @RequestParam @NotBlank(message = "entityId must not be blank") String entityId,
      @RequestParam(defaultValue = "1")
          @Min(value = 1, message = "depth must be at least 1")
          @Max(value = 4, message = "depth must not exceed 4")
          int depth,
      @RequestParam(required = false)
          @Pattern(
              regexp = "^[A-Za-z_][A-Za-z0-9_]*$",
              message = "relationshipType must be a valid relationship type")
          String relationshipType) {
    return ResponseEntity.ok(
        graphQueryService.getNeighbourhood(entityId.trim(), depth, relationshipType));
  }
}
