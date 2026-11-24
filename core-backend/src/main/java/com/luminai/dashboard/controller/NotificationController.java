package com.luminai.dashboard.controller;

import com.luminai.dashboard.dto.ActivityItemDto;
import com.luminai.dashboard.service.DashboardService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/notifications")
@Tag(
    name = "Notifications",
    description = "Endpoints for acknowledging and clearing user notifications")
public class NotificationController {

  private final DashboardService dashboardService;
  private final Set<String> readNotificationIds = ConcurrentHashMap.newKeySet();
  private final Set<String> clearedNotificationIds = ConcurrentHashMap.newKeySet();

  public NotificationController(DashboardService dashboardService) {
    this.dashboardService = dashboardService;
  }

  public record AcknowledgeRequest(List<String> ids, Boolean all) {}

  @PostMapping("/read")
  @Operation(summary = "Mark notifications as read")
  public ResponseEntity<Void> markAsRead(
      @RequestBody(required = false) AcknowledgeRequest request) {
    if (request != null && request.ids() != null) {
      readNotificationIds.addAll(request.ids());
    }
    return ResponseEntity.noContent().build();
  }

  @PostMapping("/clear")
  @Operation(summary = "Clear notifications")
  public ResponseEntity<Void> clearNotifications(
      @RequestBody(required = false) AcknowledgeRequest request) {
    if (request != null && request.ids() != null) {
      clearedNotificationIds.addAll(request.ids());
    }
    return ResponseEntity.noContent().build();
  }

  @GetMapping
  @Operation(summary = "Get current notifications")
  public ResponseEntity<List<Map<String, Object>>> getNotifications(
      @RequestParam(required = false, defaultValue = "30") int limit) {
    List<ActivityItemDto> activities = dashboardService.getActivity(limit);
    List<Map<String, Object>> result =
        activities.stream()
            .map(
                a -> {
                  String id = a.id() != null ? a.id() : "act-" + a.hashCode();
                  if (clearedNotificationIds.contains(id)) return null;
                  String st = a.status() != null ? a.status().toUpperCase() : "INFO";
                  String type = "info";
                  if ("FAILED".equals(st) || "ERROR".equals(st)) type = "error";
                  else if ("RUNNING".equals(st)) type = "warning";
                  else if ("COMPLETED".equals(st) || "SUCCESS".equals(st)) type = "success";

                  return Map.<String, Object>of(
                      "id",
                      id,
                      "type",
                      type,
                      "title",
                      a.title() != null ? a.title() : "Platform Event",
                      "message",
                      a.description() != null ? a.description() : "Activity recorded.",
                      "timestamp",
                      a.timestamp() != null ? a.timestamp().toString() : "",
                      "read",
                      readNotificationIds.contains(id));
                })
            .filter(java.util.Objects::nonNull)
            .toList();

    return ResponseEntity.ok(result);
  }
}
