package com.luminai.connection;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Service interface for previewing data from file and database connections. */
public interface ConnectionPreviewService {

  /**
   * Returns the first 100 rows of an uploaded file.
   *
   * @param connectionId the connection ID referencing the uploaded file
   * @return list of row maps — each map is {columnName -> value}
   */
  List<Map<String, Object>> previewFile(UUID connectionId);

  /**
   * Returns the first 100 rows of a database table.
   *
   * @param connectionId the connection ID referencing the database source
   * @param table the name of the table to preview
   * @return list of row maps — each map is {columnName -> value}
   */
  List<Map<String, Object>> previewTable(UUID connectionId, String table);
}
