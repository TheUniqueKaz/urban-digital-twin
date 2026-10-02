package com.example.digitaltwin.simulation;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import javax.sql.DataSource;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.dao.DataAccessException;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest(properties = "auth.jwt.secret=test-only-jwt-secret-with-at-least-32-bytes")
@AutoConfigureMockMvc
class SimulationIntegrationTest {
    private static final String CUSTOMER_A = "20000000-0000-0000-0000-000000000001";
    private static final String CUSTOMER_B = "20000000-0000-0000-0000-000000000002";
    private static final String TWIN_A = "40000000-0000-0000-0000-000000000001";
    private static final String TWIN_WITHOUT_SENSORS = "40000000-0000-0000-0000-000000000002";
    private static final String TWIN_B = "40000000-0000-0000-0000-000000000003";
    private static final String RUNS = "/api/customers/{customerId}/digital-twins/{twinId}/simulation-runs";

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcClient jdbcClient;
    @Autowired private DataSource dataSource;
    private final List<UUID> createdRuns = new ArrayList<>();
    private final List<UUID> createdSensors = new ArrayList<>();

    @AfterEach
    void removeTestRuns() {
        jdbcClient.sql("DROP TRIGGER IF EXISTS issue6_fail_measurement ON measurements").update();
        jdbcClient.sql("DROP FUNCTION IF EXISTS issue6_fail_measurement()").update();
        for (UUID id : createdRuns) {
            jdbcClient.sql("DELETE FROM measurements WHERE simulation_run_id = :id").param("id", id).update();
            jdbcClient.sql("DELETE FROM simulation_runs WHERE id = :id").param("id", id).update();
        }
        for (UUID id : createdSensors) {
            jdbcClient.sql("DELETE FROM sensor_capabilities WHERE sensor_id = :id").param("id", id).update();
            jdbcClient.sql("DELETE FROM sensors WHERE id = :id").param("id", id).update();
        }
    }

    @Test
    void noRunResponseDoesNotCreateDataAndLeavesTwinAndSensorsReadable() throws Exception {
        String customer = bearer("other-customer@example.com");
        long beforeRuns = jdbcClient.sql("SELECT COUNT(*) FROM simulation_runs").query(Long.class).single();
        long beforeMeasurements = totalMeasurementCount();
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}", CUSTOMER_B, TWIN_B)
                        .header("Authorization", customer)).andExpect(status().isOk());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}/sensors", CUSTOMER_B, TWIN_B)
                        .header("Authorization", customer)).andExpect(status().isOk());
        mockMvc.perform(get(RUNS + "/latest", CUSTOMER_B, TWIN_B).header("Authorization", customer))
                .andExpect(status().isNoContent());
        assertThat(jdbcClient.sql("SELECT COUNT(*) FROM simulation_runs").query(Long.class).single())
                .isEqualTo(beforeRuns);
        assertThat(totalMeasurementCount()).isEqualTo(beforeMeasurements);
    }

    @Test
    void adminGenerationIsSynchronousCompleteAndImmutableAcrossRequests() throws Exception {
        long beforeRuns = runCount();
        UUID first = generate(CUSTOMER_A, TWIN_A);
        assertThat(runCount()).isEqualTo(beforeRuns + 1);
        long expected = jdbcClient.sql("""
                        SELECT COUNT(*) FROM sensor_capabilities c JOIN sensors s ON s.id = c.sensor_id
                        WHERE s.digital_twin_id = :twinId
                        """)
                .param("twinId", UUID.fromString(TWIN_A)).query(Long.class).single() * 41;
        assertThat(measurementCount(first)).isEqualTo(expected);
        List<String> firstOutput = output(first);

        UUID second = generate(CUSTOMER_A, TWIN_A);
        assertThat(second).isNotEqualTo(first);
        assertThat(output(second)).containsExactlyElementsOf(firstOutput);
        assertThat(output(first)).containsExactlyElementsOf(firstOutput);
        assertThat(runCount()).isEqualTo(beforeRuns + 2);

        mockMvc.perform(get(RUNS + "/latest", CUSTOMER_A, TWIN_A)
                        .header("Authorization", bearer("admin@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(second.toString()))
                .andExpect(jsonPath("$.seed").value(20260928))
                .andExpect(jsonPath("$.configuration").value("non-scientific-demo-rule-v1"))
                .andExpect(jsonPath("$.createdBy").value("10000000-0000-0000-0000-000000000001"));
    }

    @Test
    void generatedRowsHaveExactLocalTimesUnitsProvenanceAndRunReference() throws Exception {
        UUID runId = generate(CUSTOMER_A, TWIN_A);
        List<Instant> times = jdbcClient.sql("""
                        SELECT DISTINCT observed_at FROM measurements
                        WHERE simulation_run_id = :id ORDER BY observed_at
                        """)
                .param("id", runId).query((rs, row) -> rs.getTimestamp(1).toInstant()).list();
        assertThat(times).hasSize(41);
        ZoneId siteZone = ZoneId.of("Asia/Ho_Chi_Minh");
        assertThat(times.getFirst().atZone(siteZone).toLocalTime()).isEqualTo(LocalTime.of(8, 0));
        assertThat(times.getLast().atZone(siteZone).toLocalTime()).isEqualTo(LocalTime.of(18, 0));
        for (int index = 1; index < times.size(); index++) {
            assertThat(times.get(index).getEpochSecond() - times.get(index - 1).getEpochSecond()).isEqualTo(900);
        }
        assertThat(jdbcClient.sql("""
                        SELECT COUNT(*) FROM measurements WHERE simulation_run_id = :id
                          AND (provenance <> 'SIMULATED' OR recorded_at IS NULL OR unit <> CASE
                            WHEN parameter = 'CO2' THEN 'ppm' ELSE 'µg/m³' END)
                        """).param("id", runId).query(Long.class).single()).isZero();
        assertThat(jdbcClient.sql("""
                        SELECT COUNT(*) FROM measurements WHERE simulation_run_id = :id
                          AND (sensor_id IS NULL OR parameter IS NULL OR observed_at IS NULL)
                        """).param("id", runId).query(Long.class).single()).isZero();
        mockMvc.perform(get(RUNS + "/{runId}/measurements", CUSTOMER_A, TWIN_A, runId)
                        .header("Authorization", bearer("customer@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].simulationRunId").value(runId.toString()))
                .andExpect(jsonPath("$[0].provenance").value("SIMULATED"));
    }

    @Test
    void sensorAndTimeVariationIsSmoothAndReproducible() throws Exception {
        UUID runId = generate(CUSTOMER_A, TWIN_A);
        List<BigDecimal> northGate = jdbcClient.sql("""
                        SELECT value FROM measurements WHERE simulation_run_id = :id
                          AND sensor_id = '50000000-0000-0000-0000-000000000001' AND parameter = 'PM25'
                        ORDER BY observed_at
                        """).param("id", runId).query(BigDecimal.class).list();
        assertThat(northGate).hasSize(41);
        assertThat(northGate.stream().distinct().count()).isGreaterThan(10);
        for (int index = 1; index < northGate.size(); index++) {
            assertThat(northGate.get(index).subtract(northGate.get(index - 1)).abs())
                    .isLessThan(new BigDecimal("1.00"));
        }
        BigDecimal otherSensor = jdbcClient.sql("""
                        SELECT value FROM measurements WHERE simulation_run_id = :id
                          AND sensor_id = '50000000-0000-0000-0000-000000000002' AND parameter = 'PM25'
                        ORDER BY observed_at LIMIT 1
                        """).param("id", runId).query(BigDecimal.class).single();
        assertThat(otherSensor).isNotEqualByComparingTo(northGate.getFirst());
    }

    @Test
    void customerCannotGenerateAndEveryPathIsScoped() throws Exception {
        long beforeRuns = runCount();
        String customer = bearer("customer@example.com");
        String outsider = bearer("other-customer@example.com");
        String admin = bearer("admin@example.com");
        mockMvc.perform(post(RUNS, CUSTOMER_A, TWIN_A).header("Authorization", customer))
                .andExpect(status().isForbidden());
        mockMvc.perform(post(RUNS, CUSTOMER_A, TWIN_A)).andExpect(status().isUnauthorized());
        mockMvc.perform(post(RUNS, CUSTOMER_A, TWIN_A).header("Authorization", outsider))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(RUNS, CUSTOMER_A, TWIN_B).header("Authorization", admin))
                .andExpect(status().isNotFound());
        mockMvc.perform(post(RUNS, CUSTOMER_B, TWIN_A).header("Authorization", admin))
                .andExpect(status().isNotFound());
        assertThat(runCount()).isEqualTo(beforeRuns);

        UUID runId = generate(CUSTOMER_A, TWIN_A);
        mockMvc.perform(get(RUNS + "/latest", CUSTOMER_A, TWIN_A).header("Authorization", customer))
                .andExpect(status().isOk());
        mockMvc.perform(get(RUNS + "/latest", CUSTOMER_A, TWIN_A).header("Authorization", outsider))
                .andExpect(status().isNotFound());
        mockMvc.perform(get(RUNS + "/latest", CUSTOMER_A, TWIN_A)).andExpect(status().isUnauthorized());
        mockMvc.perform(get(RUNS + "/{runId}/measurements", CUSTOMER_A, TWIN_A, runId)
                        .header("Authorization", outsider)).andExpect(status().isNotFound());
        mockMvc.perform(get(RUNS + "/{runId}/measurements", CUSTOMER_A, TWIN_A, runId)
                        .header("Authorization", admin)).andExpect(status().isOk());
        mockMvc.perform(get(RUNS + "/{runId}/measurements", CUSTOMER_A, TWIN_A, runId))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get(RUNS + "/{runId}/measurements", CUSTOMER_B, TWIN_B, runId)
                        .header("Authorization", admin)).andExpect(status().isNotFound());
        mockMvc.perform(get(RUNS + "/{runId}/measurements", CUSTOMER_A, TWIN_A, UUID.randomUUID())
                        .header("Authorization", customer)).andExpect(status().isNotFound());
    }

    @Test
    void databaseRejectsDuplicateSimulatedObservation() throws Exception {
        UUID runId = generate(CUSTOMER_A, TWIN_A);
        assertThatThrownBy(() -> jdbcClient.sql("""
                        INSERT INTO measurements
                            (id, sensor_id, simulation_run_id, parameter, value, unit,
                             observed_at, recorded_at, provenance)
                        SELECT :newId, sensor_id, simulation_run_id, parameter, value, unit,
                               observed_at, recorded_at, provenance
                        FROM measurements WHERE simulation_run_id = :runId LIMIT 1
                        """).param("newId", UUID.randomUUID()).param("runId", runId).update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("unique_simulated_observation");
    }

    @Test
    void databaseRejectsMeasurementWhoseSensorAndRunBelongToDifferentTwins() throws Exception {
        UUID runId = generate(CUSTOMER_A, TWIN_A);
        assertThatThrownBy(() -> jdbcClient.sql("""
                        INSERT INTO measurements
                            (id, sensor_id, simulation_run_id, parameter, value, unit,
                             observed_at, recorded_at, provenance)
                        SELECT :newId, '50000000-0000-0000-0000-000000000007', simulation_run_id,
                               parameter, value, unit, observed_at, recorded_at, provenance
                        FROM measurements WHERE simulation_run_id = :runId LIMIT 1
                        """).param("newId", UUID.randomUUID()).param("runId", runId).update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("must belong to the same Digital Twin");
    }

    @Test
    void databaseRejectsMovingSimulationRunToAnotherTwin() throws Exception {
        UUID runId = generate(CUSTOMER_A, TWIN_A);
        long measurementsBefore = measurementCount(runId);

        assertThatThrownBy(() -> jdbcClient.sql("""
                        UPDATE simulation_runs SET digital_twin_id = :twinId WHERE id = :runId
                        """).param("twinId", UUID.fromString(TWIN_B)).param("runId", runId).update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("Simulation Run Digital Twin is immutable");

        assertThat(jdbcClient.sql("SELECT digital_twin_id FROM simulation_runs WHERE id = :runId")
                .param("runId", runId).query(UUID.class).single()).isEqualTo(UUID.fromString(TWIN_A));
        assertThat(measurementCount(runId)).isEqualTo(measurementsBefore);
        assertThat(incoherentMeasurementCount(runId)).isZero();
    }

    @Test
    void databaseRejectsMovingSensorToAnotherTwinEvenWithoutMeasurements() {
        UUID sensorId = UUID.fromString("50000000-0000-0000-0000-000000000007");

        assertThatThrownBy(() -> jdbcClient.sql("""
                        UPDATE sensors
                        SET digital_twin_id = :twinId,
                            location = ST_SetSRID(ST_MakePoint(106.715, 10.774), 4326)
                        WHERE id = :sensorId
                        """).param("twinId", UUID.fromString(TWIN_WITHOUT_SENSORS))
                .param("sensorId", sensorId).update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("Sensor Digital Twin is immutable");

        assertThat(jdbcClient.sql("SELECT digital_twin_id FROM sensors WHERE id = :sensorId")
                .param("sensorId", sensorId).query(UUID.class).single()).isEqualTo(UUID.fromString(TWIN_B));
        assertThat(jdbcClient.sql("UPDATE sensors SET digital_twin_id = digital_twin_id WHERE id = :sensorId")
                .param("sensorId", sensorId).update()).isOne();
    }

    @Test
    void concurrentMeasurementInsertAndSensorMoveCannotCommitCrossTwinOwnership() throws Exception {
        UUID runId = generate(CUSTOMER_A, TWIN_A);
        UUID sensorId = UUID.randomUUID();
        UUID measurementId = UUID.randomUUID();
        createdSensors.add(sensorId);
        jdbcClient.sql("""
                        INSERT INTO sensors (id, digital_twin_id, code, name, kind, location)
                        VALUES (:id, :twinId, :code, 'Concurrent Sensor', 'VIRTUAL',
                                ST_SetSRID(ST_MakePoint(106.700, 10.774), 4326))
                        """)
                .param("id", sensorId)
                .param("twinId", UUID.fromString(TWIN_A))
                .param("code", "CONCURRENT-" + sensorId.toString().substring(0, 8))
                .update();
        jdbcClient.sql("INSERT INTO sensor_capabilities (sensor_id, parameter) VALUES (:id, 'PM25')")
                .param("id", sensorId).update();

        ExecutorService executor = Executors.newSingleThreadExecutor();
        try (Connection measurementConnection = dataSource.getConnection()) {
            measurementConnection.setAutoCommit(false);

            try (PreparedStatement insert = measurementConnection.prepareStatement("""
                    INSERT INTO measurements
                        (id, sensor_id, simulation_run_id, parameter, value, unit,
                         observed_at, recorded_at, provenance)
                    VALUES (?, ?, ?, 'PM25', 12.34, 'µg/m³', ?, ?, 'SIMULATED')
                    """)) {
                insert.setObject(1, measurementId);
                insert.setObject(2, sensorId);
                insert.setObject(3, runId);
                insert.setTimestamp(4, Timestamp.from(Instant.parse("2026-09-28T12:00:00Z")));
                insert.setTimestamp(5, Timestamp.from(Instant.parse("2026-09-28T12:00:01Z")));
                assertThat(insert.executeUpdate()).isOne();
            }

            CompletableFuture<Integer> sensorBackendPid = new CompletableFuture<>();
            Future<SQLException> sensorMove = executor.submit(() -> {
                try (Connection sensorConnection = dataSource.getConnection()) {
                    sensorConnection.setAutoCommit(false);
                    try (PreparedStatement queryPid = sensorConnection.prepareStatement("SELECT pg_backend_pid()");
                            var result = queryPid.executeQuery()) {
                        result.next();
                        sensorBackendPid.complete(result.getInt(1));
                    }
                    try (PreparedStatement move = sensorConnection.prepareStatement("""
                            UPDATE sensors
                            SET digital_twin_id = ?,
                                location = ST_SetSRID(ST_MakePoint(106.715, 10.774), 4326)
                            WHERE id = ?
                            """)) {
                        move.setObject(1, UUID.fromString(TWIN_WITHOUT_SENSORS));
                        move.setObject(2, sensorId);
                        try {
                            move.executeUpdate();
                            sensorConnection.commit();
                            return null;
                        } catch (SQLException exception) {
                            sensorConnection.rollback();
                            return exception;
                        }
                    }
                }
            });

            awaitLockWait(sensorBackendPid.get(5, TimeUnit.SECONDS));
            measurementConnection.commit();
            assertThat((Throwable) sensorMove.get(5, TimeUnit.SECONDS))
                    .hasMessageContaining("Sensor Digital Twin is immutable");
        } finally {
            executor.shutdownNow();
        }

        assertThat(jdbcClient.sql("SELECT COUNT(*) FROM measurements WHERE id = :id")
                .param("id", measurementId).query(Long.class).single()).isOne();
        assertThat(jdbcClient.sql("SELECT digital_twin_id FROM sensors WHERE id = :id")
                .param("id", sensorId).query(UUID.class).single()).isEqualTo(UUID.fromString(TWIN_A));
        assertThat(incoherentMeasurementCount(runId)).isZero();
    }

    @Test
    void measurementGetRejectsChangingOnlyCustomerPathId() throws Exception {
        UUID runId = generate(CUSTOMER_A, TWIN_A);
        mockMvc.perform(get(RUNS + "/{runId}/measurements", CUSTOMER_B, TWIN_A, runId)
                        .header("Authorization", bearer("customer@example.com")))
                .andExpect(status().isNotFound())
                .andExpect(content().string(not(containsString(runId.toString()))))
                .andExpect(content().string(not(containsString("SIMULATED"))));
    }

    @Test
    void measurementGetRejectsChangingOnlyTwinPathId() throws Exception {
        UUID runId = generate(CUSTOMER_A, TWIN_A);
        mockMvc.perform(get(RUNS + "/{runId}/measurements", CUSTOMER_A, TWIN_B, runId)
                        .header("Authorization", bearer("customer@example.com")))
                .andExpect(status().isNotFound())
                .andExpect(content().string(not(containsString(runId.toString()))))
                .andExpect(content().string(not(containsString("SIMULATED"))));
    }

    @Test
    void failedGenerationRollsBackRunAndPartialMeasurements() throws Exception {
        long beforeRuns = runCount();
        long beforeMeasurements = totalMeasurementCount();
        jdbcClient.sql("""
                CREATE FUNCTION issue6_fail_measurement() RETURNS trigger AS $$
                BEGIN
                    IF NEW.sensor_id = '50000000-0000-0000-0000-000000000002' THEN
                        RAISE EXCEPTION 'Forced measurement failure';
                    END IF;
                    RETURN NEW;
                END;
                $$ LANGUAGE plpgsql
                """).update();
        jdbcClient.sql("""
                CREATE TRIGGER issue6_fail_measurement BEFORE INSERT ON measurements
                FOR EACH ROW EXECUTE FUNCTION issue6_fail_measurement()
                """).update();
        assertThatThrownBy(() -> mockMvc.perform(post(RUNS, CUSTOMER_A, TWIN_A)
                        .header("Authorization", bearer("admin@example.com"))))
                .hasStackTraceContaining("Forced measurement failure");
        assertThat(runCount()).isEqualTo(beforeRuns);
        assertThat(totalMeasurementCount()).isEqualTo(beforeMeasurements);
    }

    @Test
    void latestRunUsesIdToBreakCreationTimeTies() throws Exception {
        UUID first = generate(CUSTOMER_A, TWIN_A);
        UUID second = generate(CUSTOMER_A, TWIN_A);
        Instant sameTime = Instant.parse("2099-01-01T00:00:00Z");
        jdbcClient.sql("UPDATE simulation_runs SET created_at = :time WHERE id IN (:first, :second)")
                .param("time", Timestamp.from(sameTime)).param("first", first).param("second", second).update();
        UUID expected = first.toString().compareTo(second.toString()) > 0 ? first : second;
        mockMvc.perform(get(RUNS + "/latest", CUSTOMER_A, TWIN_A)
                        .header("Authorization", bearer("admin@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(expected.toString()));
    }

    private UUID generate(String customerId, String twinId) throws Exception {
        String response = mockMvc.perform(post(RUNS, customerId, twinId)
                        .header("Authorization", bearer("admin@example.com")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.digitalTwinId").value(twinId))
                .andExpect(jsonPath("$.intervalMinutes").value(15))
                .andReturn().getResponse().getContentAsString();
        UUID id = UUID.fromString(JsonPath.read(response, "$.id"));
        createdRuns.add(id);
        return id;
    }

    private String bearer(String email) throws Exception {
        String password = "admin@example.com".equals(email) ? "admin-demo-password" : "customer-demo-password";
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return "Bearer " + JsonPath.read(response, "$.accessToken");
    }

    private long measurementCount(UUID runId) {
        return jdbcClient.sql("SELECT COUNT(*) FROM measurements WHERE simulation_run_id = :id")
                .param("id", runId).query(Long.class).single();
    }

    private long runCount() {
        return jdbcClient.sql("SELECT COUNT(*) FROM simulation_runs WHERE digital_twin_id = :id")
                .param("id", UUID.fromString(TWIN_A)).query(Long.class).single();
    }

    private long totalMeasurementCount() {
        return jdbcClient.sql("SELECT COUNT(*) FROM measurements").query(Long.class).single();
    }

    private long incoherentMeasurementCount(UUID runId) {
        return jdbcClient.sql("""
                        SELECT COUNT(*) FROM measurements m
                        JOIN sensors s ON s.id = m.sensor_id
                        JOIN simulation_runs r ON r.id = m.simulation_run_id
                        WHERE r.id = :runId AND s.digital_twin_id <> r.digital_twin_id
                        """).param("runId", runId).query(Long.class).single();
    }

    private void awaitLockWait(int backendPid) throws InterruptedException {
        for (int attempt = 0; attempt < 500; attempt++) {
            boolean waiting = jdbcClient.sql("""
                            SELECT EXISTS (
                                SELECT 1 FROM pg_locks WHERE pid = :pid AND NOT granted
                            )
                            """)
                    .param("pid", backendPid).query(Boolean.class).single();
            if (waiting) {
                return;
            }
            Thread.sleep(10);
        }
        throw new AssertionError("Sensor reassignment did not reach the expected PostgreSQL lock wait");
    }

    private List<String> output(UUID runId) {
        return jdbcClient.sql("""
                        SELECT sensor_id, parameter, value, unit, observed_at, provenance
                        FROM measurements WHERE simulation_run_id = :id
                        ORDER BY observed_at, sensor_id, parameter
                        """)
                .param("id", runId)
                .query((rs, row) -> rs.getString("sensor_id") + ":" + rs.getString("parameter")
                        + ":" + rs.getBigDecimal("value") + ":" + rs.getString("unit")
                        + ":" + rs.getTimestamp("observed_at").toInstant()
                        + ":" + rs.getString("provenance"))
                .list();
    }
}
