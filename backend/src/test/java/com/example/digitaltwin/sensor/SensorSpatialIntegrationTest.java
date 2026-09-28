package com.example.digitaltwin.sensor;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;

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
class SensorSpatialIntegrationTest {
    private static final String CUSTOMER_A = "20000000-0000-0000-0000-000000000001";
    private static final String CUSTOMER_B = "20000000-0000-0000-0000-000000000002";
    private static final String TWIN_A = "40000000-0000-0000-0000-000000000001";
    private static final String TWIN_B = "40000000-0000-0000-0000-000000000003";
    private static final String SENSOR_A = "50000000-0000-0000-0000-000000000001";
    private static final String SENSOR_B = "50000000-0000-0000-0000-000000000007";

    @Autowired MockMvc mockMvc;
    @Autowired JdbcClient jdbcClient;

    @Test
    void flywayPersistsPolygonAndPointInSrid4326WithSeedCapabilities() {
        assertThat(jdbcClient.sql("SELECT ST_SRID(boundary) FROM sites WHERE id = :id")
                .param("id", UUID.fromString("30000000-0000-0000-0000-000000000001"))
                .query(Integer.class).single()).isEqualTo(4326);
        assertThat(jdbcClient.sql("SELECT GeometryType(boundary) FROM sites WHERE id = :id")
                .param("id", UUID.fromString("30000000-0000-0000-0000-000000000001"))
                .query(String.class).single()).isEqualTo("POLYGON");
        assertThat(jdbcClient.sql("SELECT ST_SRID(location) FROM sensors WHERE id = :id")
                .param("id", UUID.fromString(SENSOR_A)).query(Integer.class).single()).isEqualTo(4326);
        assertThat(jdbcClient.sql("SELECT GeometryType(location) FROM sensors WHERE id = :id")
                .param("id", UUID.fromString(SENSOR_A)).query(String.class).single()).isEqualTo("POINT");
        assertThat(jdbcClient.sql("SELECT COUNT(*) FROM sensors WHERE digital_twin_id = :id AND kind = 'VIRTUAL'")
                .param("id", UUID.fromString(TWIN_A)).query(Integer.class).single()).isBetween(5, 10);
        assertThat(jdbcClient.sql("SELECT COUNT(*) FROM sensors p JOIN digital_twins t ON t.id = p.digital_twin_id JOIN sites s ON s.id = t.site_id WHERE NOT ST_Covers(s.boundary, p.location)")
                .query(Integer.class).single()).isZero();
    }

    @Test
    void postgisAcceptsInsideAndBoundaryButRejectsOutside() {
        insertThenDelete("106.700 10.774");
        insertThenDelete("106.695 10.774");
        assertThatThrownBy(() -> insert(UUID.randomUUID(), "106.690 10.774"))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("Sensor location must be inside or on its Site boundary");
    }

    @Test
    void databaseRejectsSensorWithoutExistingDigitalTwin() {
        assertThatThrownBy(() -> insert(UUID.randomUUID(), UUID.randomUUID(), "106.700 10.774"))
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("sensors_digital_twin_id_fkey");
    }

    @Test
    void databaseRejectsDuplicateSensorCapability() {
        assertThatThrownBy(() -> jdbcClient.sql("""
                        INSERT INTO sensor_capabilities (sensor_id, parameter)
                        VALUES (:sensorId, 'PM25')
                        """)
                .param("sensorId", UUID.fromString(SENSOR_A))
                .update())
                .isInstanceOf(DataAccessException.class)
                .hasMessageContaining("sensor_capabilities_pkey");
    }

    @Test
    void scopedTwinAndSensorReadsReturnOnlyTheirCustomerData() throws Exception {
        String customer = bearer("customer@example.com");
        String admin = bearer("admin@example.com");
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}", CUSTOMER_A, TWIN_A)
                        .header("Authorization", customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.boundary.type").value("Polygon"))
                .andExpect(jsonPath("$.boundary.coordinates[0][0][0]").value(106.695));
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}/sensors", CUSTOMER_A, TWIN_A)
                        .header("Authorization", customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(6)))
                .andExpect(jsonPath("$[0].kind").value("VIRTUAL"))
                .andExpect(jsonPath("$[0].capabilities", hasSize(2)))
                .andExpect(jsonPath("$[0].capabilities[0]").value("PM10"))
                .andExpect(jsonPath("$[0].capabilities[1]").value("PM25"));
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}/sensors/{sensorId}",
                        CUSTOMER_A, TWIN_A, SENSOR_A).header("Authorization", customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.location.longitude").value(106.697));
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}/sensors/{sensorId}",
                        CUSTOMER_A, TWIN_A, "50000000-0000-0000-0000-000000000003")
                        .header("Authorization", customer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.capabilities", hasSize(4)))
                .andExpect(jsonPath("$.capabilities[0]").value("CO2"))
                .andExpect(jsonPath("$.capabilities[1]").value("NO2"))
                .andExpect(jsonPath("$.capabilities[2]").value("PM10"))
                .andExpect(jsonPath("$.capabilities[3]").value("PM25"));
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}/sensors/{sensorId}",
                        CUSTOMER_B, TWIN_B, SENSOR_B).header("Authorization", admin))
                .andExpect(status().isOk());
    }

    @Test
    void customerAndRelationshipIdTamperingDisclosesNothing() throws Exception {
        String customer = bearer("customer@example.com");
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}", CUSTOMER_A, TWIN_B)
                        .header("Authorization", customer)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}/sensors", CUSTOMER_A, TWIN_B)
                        .header("Authorization", customer)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}/sensors/{sensorId}",
                        CUSTOMER_A, TWIN_A, SENSOR_B).header("Authorization", customer))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}/sensors/{sensorId}",
                        CUSTOMER_A, TWIN_B, SENSOR_B).header("Authorization", customer))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}/sensors/{sensorId}",
                        CUSTOMER_B, TWIN_B, SENSOR_B).header("Authorization", customer))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}/sensors", CUSTOMER_A, TWIN_A))
                .andExpect(status().isUnauthorized());
    }

    private void insertThenDelete(String point) {
        UUID id = UUID.randomUUID();
        try {
            insert(id, point);
            assertThat(jdbcClient.sql("SELECT ST_SRID(location) FROM sensors WHERE id = :id")
                    .param("id", id).query(Integer.class).single()).isEqualTo(4326);
        } finally {
            jdbcClient.sql("DELETE FROM sensors WHERE id = :id").param("id", id).update();
        }
    }

    private void insert(UUID id, String point) {
        insert(id, UUID.fromString(TWIN_A), point);
    }

    private void insert(UUID id, UUID twinId, String point) {
        jdbcClient.sql("""
                INSERT INTO sensors (id, digital_twin_id, code, name, kind, location)
                VALUES (:id, :twinId, :code, 'Spatial Test', 'VIRTUAL', ST_GeomFromText(:point, 4326))
                """)
                .param("id", id).param("twinId", twinId).param("code", id.toString())
                .param("point", "POINT(" + point + ")").update();
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
}
