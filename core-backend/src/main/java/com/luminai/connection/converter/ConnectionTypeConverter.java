package com.luminai.connection.converter;

import com.luminai.connection.model.Connection;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/**
 * Case-insensitive JPA converter for {@link Connection.Type}. Tolerate database values such as
 * 'file', 'FILE', 'postgresql', 'POSTGRESQL'.
 */
@Converter(autoApply = true)
public class ConnectionTypeConverter implements AttributeConverter<Connection.Type, String> {

  @Override
  public String convertToDatabaseColumn(Connection.Type attribute) {
    return attribute != null ? attribute.name() : null;
  }

  @Override
  public Connection.Type convertToEntityAttribute(String dbData) {
    if (dbData == null || dbData.isBlank()) {
      return Connection.Type.FILE;
    }
    try {
      return Connection.Type.valueOf(dbData.trim().toUpperCase());
    } catch (IllegalArgumentException e) {
      return Connection.Type.FILE;
    }
  }
}
