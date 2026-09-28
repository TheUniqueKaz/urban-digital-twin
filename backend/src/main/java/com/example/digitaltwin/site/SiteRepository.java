package com.example.digitaltwin.site;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class SiteRepository {
    private final JdbcClient jdbcClient;

    SiteRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    List<Site> findAll(UUID customerId) {
        return query("s.customer_id = :customerId")
                .param("customerId", customerId)
                .query(SiteRepository::mapSite)
                .list();
    }

    Optional<Site> findById(UUID customerId, UUID siteId) {
        return query("s.customer_id = :customerId AND s.id = :siteId")
                .param("customerId", customerId)
                .param("siteId", siteId)
                .query(SiteRepository::mapSite)
                .optional();
    }

    private JdbcClient.StatementSpec query(String predicate) {
        return jdbcClient.sql("""
                SELECT s.id, s.customer_id, s.name, t.id AS twin_id, t.name AS twin_name
                FROM sites s JOIN digital_twins t ON t.site_id = s.id
                WHERE %s ORDER BY s.name
                """.formatted(predicate));
    }

    private static Site mapSite(ResultSet rs, int rowNumber) throws SQLException {
        return new Site(rs.getObject("id", UUID.class), rs.getObject("customer_id", UUID.class), rs.getString("name"),
                new DigitalTwinSummary(rs.getObject("twin_id", UUID.class), rs.getString("twin_name")));
    }

    record Site(UUID id, UUID customerId, String name, DigitalTwinSummary digitalTwin) {
    }

    record DigitalTwinSummary(UUID id, String name) {
    }
}
