package com.example.digitaltwin.digitaltwin;

import java.util.Optional;
import java.util.UUID;
import java.sql.SQLException;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class DigitalTwinRepository {
    private final JdbcClient jdbcClient;
    private final ObjectMapper objectMapper;

    DigitalTwinRepository(JdbcClient jdbcClient, ObjectMapper objectMapper) {
        this.jdbcClient = jdbcClient;
        this.objectMapper = objectMapper;
    }

    Optional<DigitalTwin> findById(UUID customerId, UUID twinId) {
        return jdbcClient.sql("""
                        SELECT t.id, t.site_id, t.name, ST_AsGeoJSON(s.boundary) AS boundary FROM digital_twins t
                        JOIN sites s ON s.id = t.site_id
                        WHERE t.id = :twinId AND s.customer_id = :customerId
                        """)
                .param("customerId", customerId)
                .param("twinId", twinId)
                .query((rs, rowNumber) -> {
                    try {
                        return new DigitalTwin(rs.getObject("id", UUID.class), rs.getObject("site_id", UUID.class),
                                rs.getString("name"), objectMapper.readTree(rs.getString("boundary")));
                    } catch (JacksonException exception) {
                        throw new SQLException("Invalid Site boundary GeoJSON", exception);
                    }
                })
                .optional();
    }

    record DigitalTwin(UUID id, UUID siteId, String name, JsonNode boundary) {
    }
}
