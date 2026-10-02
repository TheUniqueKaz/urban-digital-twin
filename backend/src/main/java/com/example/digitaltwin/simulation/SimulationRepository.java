package com.example.digitaltwin.simulation;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import com.example.digitaltwin.sensor.Parameter;

@Repository
class SimulationRepository {
    private final JdbcClient jdbcClient;

    SimulationRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    Optional<ZoneId> siteTimeZone(UUID customerId, UUID twinId) {
        return jdbcClient.sql("""
                        SELECT s.time_zone FROM digital_twins t
                        JOIN sites s ON s.id = t.site_id
                        WHERE t.id = :twinId AND s.customer_id = :customerId
                        """)
                .param("customerId", customerId).param("twinId", twinId)
                .query(String.class).optional().map(ZoneId::of);
    }

    List<SensorParameter> inputs(UUID twinId) {
        return jdbcClient.sql("""
                        SELECT p.id, ST_X(p.location) AS longitude, ST_Y(p.location) AS latitude,
                               c.parameter
                        FROM sensors p JOIN sensor_capabilities c ON c.sensor_id = p.id
                        WHERE p.digital_twin_id = :twinId
                        ORDER BY p.code, p.id, c.parameter
                        """)
                .param("twinId", twinId)
                .query((rs, row) -> new SensorParameter(rs.getObject("id", UUID.class),
                        rs.getDouble("longitude"), rs.getDouble("latitude"),
                        Parameter.valueOf(rs.getString("parameter"))))
                .list();
    }

    void insertRun(Run run) {
        jdbcClient.sql("""
                        INSERT INTO simulation_runs
                            (id, digital_twin_id, name, seed, configuration, time_zone,
                             start_at, end_at, interval_minutes, created_by, created_at)
                        VALUES (:id, :twinId, :name, :seed, :configuration, :timeZone,
                                :startAt, :endAt, :intervalMinutes, :createdBy, :createdAt)
                        """)
                .param("id", run.id()).param("twinId", run.digitalTwinId())
                .param("name", run.name()).param("seed", run.seed())
                .param("configuration", run.configuration()).param("timeZone", run.timeZone())
                .param("startAt", Timestamp.from(run.startAt())).param("endAt", Timestamp.from(run.endAt()))
                .param("intervalMinutes", run.intervalMinutes())
                .param("createdBy", run.createdBy()).param("createdAt", Timestamp.from(run.createdAt()))
                .update();
    }

    void insertMeasurement(Measurement measurement) {
        jdbcClient.sql("""
                        INSERT INTO measurements
                            (id, sensor_id, simulation_run_id, parameter, value, unit,
                             observed_at, recorded_at, provenance)
                        VALUES (:id, :sensorId, :runId, :parameter, :value, :unit,
                                :observedAt, :recordedAt, :provenance)
                        """)
                .param("id", measurement.id()).param("sensorId", measurement.sensorId())
                .param("runId", measurement.simulationRunId())
                .param("parameter", measurement.parameter().name())
                .param("value", measurement.value()).param("unit", measurement.unit())
                .param("observedAt", Timestamp.from(measurement.observedAt()))
                .param("recordedAt", Timestamp.from(measurement.recordedAt()))
                .param("provenance", measurement.provenance())
                .update();
    }

    Optional<Run> latest(UUID customerId, UUID twinId) {
        return runs(customerId, twinId, "").query(SimulationRepository::mapRun).optional();
    }

    Optional<Run> findRun(UUID customerId, UUID twinId, UUID runId) {
        return runs(customerId, twinId, "AND r.id = :runId")
                .param("runId", runId).query(SimulationRepository::mapRun).optional();
    }

    List<Measurement> measurements(UUID customerId, UUID twinId, UUID runId) {
        return jdbcClient.sql("""
                        SELECT m.id, m.sensor_id, m.simulation_run_id, m.parameter, m.value, m.unit,
                               m.observed_at, m.recorded_at, m.provenance
                        FROM measurements m
                        JOIN simulation_runs r ON r.id = m.simulation_run_id
                        JOIN sensors p ON p.id = m.sensor_id
                        JOIN digital_twins t ON t.id = r.digital_twin_id AND t.id = p.digital_twin_id
                        JOIN sites s ON s.id = t.site_id
                        WHERE s.customer_id = :customerId AND t.id = :twinId AND r.id = :runId
                        ORDER BY m.observed_at, m.sensor_id, m.parameter
                        """)
                .param("customerId", customerId).param("twinId", twinId).param("runId", runId)
                .query((rs, row) -> new Measurement(
                        rs.getObject("id", UUID.class), rs.getObject("sensor_id", UUID.class),
                        rs.getObject("simulation_run_id", UUID.class),
                        Parameter.valueOf(rs.getString("parameter")), rs.getBigDecimal("value"),
                        rs.getString("unit"), rs.getTimestamp("observed_at").toInstant(),
                        rs.getTimestamp("recorded_at").toInstant(), rs.getString("provenance")))
                .list();
    }

    private JdbcClient.StatementSpec runs(UUID customerId, UUID twinId, String predicate) {
        return jdbcClient.sql("""
                        SELECT r.id, r.digital_twin_id, r.name, r.seed, r.configuration,
                               r.time_zone, r.start_at, r.end_at, r.interval_minutes,
                               r.created_by, r.created_at
                        FROM simulation_runs r
                        JOIN digital_twins t ON t.id = r.digital_twin_id
                        JOIN sites s ON s.id = t.site_id
                        WHERE s.customer_id = :customerId AND t.id = :twinId %s
                        ORDER BY r.created_at DESC, r.id DESC LIMIT 1
                        """.formatted(predicate))
                .param("customerId", customerId).param("twinId", twinId);
    }

    private static Run mapRun(ResultSet rs, int row) throws SQLException {
        return new Run(rs.getObject("id", UUID.class), rs.getObject("digital_twin_id", UUID.class),
                rs.getString("name"), rs.getLong("seed"), rs.getString("configuration"),
                rs.getString("time_zone"), rs.getTimestamp("start_at").toInstant(),
                rs.getTimestamp("end_at").toInstant(), rs.getInt("interval_minutes"),
                rs.getObject("created_by", UUID.class), rs.getTimestamp("created_at").toInstant());
    }

    record SensorParameter(UUID sensorId, double longitude, double latitude, Parameter parameter) {
    }

    record Run(UUID id, UUID digitalTwinId, String name, long seed, String configuration,
            String timeZone, Instant startAt, Instant endAt, int intervalMinutes,
            UUID createdBy, Instant createdAt) {
    }

    record Measurement(UUID id, UUID sensorId, UUID simulationRunId, Parameter parameter,
            BigDecimal value, String unit, Instant observedAt, Instant recordedAt, String provenance) {
    }
}
