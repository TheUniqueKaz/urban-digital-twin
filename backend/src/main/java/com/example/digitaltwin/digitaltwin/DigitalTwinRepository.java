package com.example.digitaltwin.digitaltwin;

import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class DigitalTwinRepository {
    private final JdbcClient jdbcClient;

    DigitalTwinRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    Optional<DigitalTwin> findById(UUID customerId, UUID twinId) {
        return jdbcClient.sql("""
                        SELECT t.id, t.site_id, t.name FROM digital_twins t
                        JOIN sites s ON s.id = t.site_id
                        WHERE t.id = :twinId AND s.customer_id = :customerId
                        """)
                .param("customerId", customerId)
                .param("twinId", twinId)
                .query(DigitalTwin.class)
                .optional();
    }

    record DigitalTwin(UUID id, UUID siteId, String name) {
    }
}
