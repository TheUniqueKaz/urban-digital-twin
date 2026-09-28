package com.example.digitaltwin.sensor;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class SensorRepository {
    private final JdbcClient jdbcClient;

    SensorRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public List<Sensor> findAll(UUID customerId, UUID twinId) {
        return query("p.digital_twin_id = :twinId")
                .param("customerId", customerId)
                .param("twinId", twinId)
                .query(SensorRepository::mapSensor)
                .list();
    }

    public Optional<Sensor> findById(UUID customerId, UUID twinId, UUID sensorId) {
        return query("p.digital_twin_id = :twinId AND p.id = :sensorId")
                .param("customerId", customerId)
                .param("twinId", twinId)
                .param("sensorId", sensorId)
                .query(SensorRepository::mapSensor)
                .optional();
    }

    private JdbcClient.StatementSpec query(String predicate) {
        return jdbcClient.sql("""
                SELECT p.id, p.digital_twin_id, p.code, p.name, p.kind,
                       ST_X(p.location) AS longitude, ST_Y(p.location) AS latitude,
                       array_agg(c.parameter ORDER BY c.parameter) AS capabilities
                FROM sensors p
                JOIN digital_twins t ON t.id = p.digital_twin_id
                JOIN sites s ON s.id = t.site_id
                JOIN sensor_capabilities c ON c.sensor_id = p.id
                WHERE s.customer_id = :customerId AND %s
                GROUP BY p.id ORDER BY p.code
                """.formatted(predicate));
    }

    private static Sensor mapSensor(ResultSet rs, int rowNumber) throws SQLException {
        Array capabilities = rs.getArray("capabilities");
        return new Sensor(rs.getObject("id", UUID.class), rs.getObject("digital_twin_id", UUID.class),
                rs.getString("code"), rs.getString("name"), rs.getString("kind"),
                new Location(rs.getDouble("longitude"), rs.getDouble("latitude")),
                Arrays.stream((String[]) capabilities.getArray())
                        .map(Parameter::valueOf)
                        .toList());
    }

    public record Sensor(UUID id, UUID digitalTwinId, String code, String name, String kind,
            Location location, List<Parameter> capabilities) {
    }

    public record Location(double longitude, double latitude) {
    }
}
