package com.luminai.connection;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class ConnectionPreviewServiceImpl implements ConnectionPreviewService {

  private static final int MAX_ROWS = 100;

  @Override
  public List<Map<String, Object>> previewFile(UUID connectionId) {
    // TODO: implement file preview logic
    return List.of();
  }

  @Override
  public List<Map<String, Object>> previewTable(UUID connectionId, String table) {
    // TODO: implement table preview logic
    return List.of();
  }
}
