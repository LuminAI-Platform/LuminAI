package com.luminai.engine.dto;

public record DataEngineHealthDto(
    String status, String appName, String version, long latencyMs, String message) {}
