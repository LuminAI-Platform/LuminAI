package com.luminai.connection;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * REST API for data source connection previews.
 *
 * <p>All endpoints require a valid JWT. Tenant isolation is enforced by the service layer.
 *
 * <pre>
 * GET /api/v1/connections/{id}/preview/file        — Preview first 100 rows of an uploaded file
 * GET /api/v1/connections/{id}/preview/table       — Preview first 100 rows of a database table
 * </pre>
 */
@RestController
@RequestMapping("/api/v1/connections")
public class ConnectionController {

  private final ConnectionPreviewService connectionPreviewService;

  public ConnectionController(ConnectionPreviewService connectionPreviewService) {
    this.connectionPreviewService = connectionPreviewService;
  }

  /**
   * Returns the first 100 rows of an uploaded file as a list of key-value maps, where each map
   * represents a row with column names as keys.
   *
   * @param id the connection ID referencing the uploaded file
   * @return list of row maps matching the file's column structure
   */
  @GetMapping("/{id}/preview/file")
  public ResponseEntity<List<Map<String, Object>>> previewFile(@PathVariable UUID id) {
    List<Map<String, Object>> rows = connectionPreviewService.previewFile(id);
    return ResponseEntity.ok(rows);
  }

  /**
   * Returns the first 100 rows of a database table as a list of key-value maps, where each map
   * represents a row with column names as keys.
   *
   * @param id the connection ID referencing the database source
   * @param table the name of the table to preview
   * @return list of row maps matching the table's column structure
   */
  @GetMapping("/{id}/preview/table")
  public ResponseEntity<List<Map<String, Object>>> previewTable(
      @PathVariable UUID id, @RequestParam String table) {
    List<Map<String, Object>> rows = connectionPreviewService.previewTable(id, table);
    return ResponseEntity.ok(rows);
  }
}
