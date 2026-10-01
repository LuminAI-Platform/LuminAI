package com.luminai.connection.converter;

import com.luminai.connection.model.Connection;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Case-insensitive JPA converter for {@link Connection.Status}. Tolerate database values such as
 * 'active', 'ACTIVE', 'inactive', 'error'.
 */
@Converter(autoApply = true)
public class ConnectionStatusConverter implements AttributeConverter<Connection.Status, String> {

  @Override
  public String convertToDatabaseColumn(Connection.Status attribute) {
    return attribute != null ? attribute.name() : null;
  }

  @Override
  public Connection.Status convertToEntityAttribute(String dbData) {
    if (dbData == null || dbData.isBlank()) {
      return Connection.Status.ACTIVE;
    }
    try {
      return Connection.Status.valueOf(dbData.trim().toUpperCase());
    } catch (IllegalArgumentException e) {
      return Connection.Status.ACTIVE;
    }
  }
}
