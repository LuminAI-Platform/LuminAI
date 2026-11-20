package com.luminai.dataset.dto;

import java.util.List;
import java.util.Map;

public record LineageGraphDto(List<Map<String, Object>> nodes, List<Map<String, Object>> edges) {}
