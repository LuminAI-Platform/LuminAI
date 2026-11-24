package com.luminai.dataset.controller;

import com.luminai.dataset.dto.MlModelDto;
import com.luminai.dataset.dto.RegisterModelRequestDto;
import com.luminai.dataset.dto.TrainModelRequestDto;
import com.luminai.dataset.service.MlModelService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/ml")
@PreAuthorize("isAuthenticated()")
public class MlModelController {

  private final MlModelService mlModelService;

  public MlModelController(MlModelService mlModelService) {
    this.mlModelService = mlModelService;
  }

  @PostMapping("/train")
  public ResponseEntity<Map<String, Object>> trainModel(
      @Valid @RequestBody TrainModelRequestDto request) {
    return ResponseEntity.status(HttpStatus.CREATED).body(mlModelService.trainAndPersist(request));
  }

  @GetMapping("/models")
  public ResponseEntity<List<MlModelDto>> listModels(
      @RequestParam(required = false) String status) {
    return ResponseEntity.ok(mlModelService.listModels(status));
  }

  @GetMapping("/models/{id}")
  public ResponseEntity<MlModelDto> getModel(@PathVariable UUID id) {
    return ResponseEntity.ok(mlModelService.getModel(id));
  }

  @PutMapping("/models/{id}/status")
  public ResponseEntity<MlModelDto> updateStatus(
      @PathVariable UUID id, @Valid @RequestBody RegisterModelRequestDto request) {
    return ResponseEntity.ok(mlModelService.promoteModel(id, request.status()));
  }

  @GetMapping("/experiments")
  public ResponseEntity<List<Map<String, Object>>> listExperiments() {
    return ResponseEntity.ok(mlModelService.listExperiments());
  }
}
