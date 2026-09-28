package com.example.digitaltwin.customer;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.empty;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.web.servlet.MockMvc;

import com.jayway.jsonpath.JsonPath;

@SpringBootTest(properties = "auth.jwt.secret=test-only-jwt-secret-with-at-least-32-bytes")
@AutoConfigureMockMvc
class CustomerNavigationIntegrationTest {

    private static final String CUSTOMER_A = "20000000-0000-0000-0000-000000000001";
    private static final String CUSTOMER_B = "20000000-0000-0000-0000-000000000002";
    private static final String SITE_A = "30000000-0000-0000-0000-000000000001";
    private static final String SITE_B = "30000000-0000-0000-0000-000000000003";
    private static final String TWIN_A = "40000000-0000-0000-0000-000000000001";
    private static final String TWIN_B = "40000000-0000-0000-0000-000000000003";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcClient jdbcClient;

    @Test
    void adminCanListEveryCustomer() throws Exception {
        mockMvc.perform(get("/api/customers")
                        .header("Authorization", "Bearer " + login("admin@example.com", "admin-demo-password")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].name").value("Saigon Campus Group"))
                .andExpect(jsonPath("$[1].name").value("Riverside Research"));
    }

    @Test
    void customerListsOnlyMembershipsAndZeroMembershipsStayEmpty() throws Exception {
        mockMvc.perform(get("/api/customers")
                        .header("Authorization", bearer("customer@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value(CUSTOMER_A));

        mockMvc.perform(get("/api/customers")
                        .header("Authorization", bearer("no-memberships@example.com")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", empty()));

        Integer membershipCount = jdbcClient.sql("""
                        SELECT COUNT(*) FROM customer_memberships
                        WHERE user_id = '10000000-0000-0000-0000-000000000004'
                        """)
                .query(Integer.class)
                .single();
        org.assertj.core.api.Assertions.assertThat(membershipCount).isZero();
    }

    @Test
    void authorizedCustomerNavigatesCustomerToSitesToDigitalTwin() throws Exception {
        String authorization = bearer("customer@example.com");

        mockMvc.perform(get("/api/customers/{customerId}", CUSTOMER_A).header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Saigon Campus Group"));

        mockMvc.perform(get("/api/customers/{customerId}/sites", CUSTOMER_A).header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].digitalTwin.id").exists())
                .andExpect(jsonPath("$[1].digitalTwin.id").exists());

        mockMvc.perform(get("/api/customers/{customerId}/sites/{siteId}", CUSTOMER_A, SITE_A)
                        .header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.customerId").value(CUSTOMER_A))
                .andExpect(jsonPath("$.digitalTwin.id").value(TWIN_A));

        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}", CUSTOMER_A, TWIN_A)
                        .header("Authorization", authorization))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.siteId").value(SITE_A))
                .andExpect(jsonPath("$.name").value("Innovation Campus Digital Twin"));
    }

    @Test
    void adminCanNavigateEveryCustomerHierarchy() throws Exception {
        String authorization = bearer("admin@example.com");

        mockMvc.perform(get("/api/customers/{customerId}", CUSTOMER_B).header("Authorization", authorization))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/customers/{customerId}/sites", CUSTOMER_B).header("Authorization", authorization))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/customers/{customerId}/sites/{siteId}", CUSTOMER_B, SITE_B)
                        .header("Authorization", authorization))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}", CUSTOMER_B, TWIN_B)
                        .header("Authorization", authorization))
                .andExpect(status().isOk());
    }

    @Test
    void unauthenticatedCustomerScopedRequestsAreRejected() throws Exception {
        mockMvc.perform(get("/api/customers")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/customers/{customerId}", CUSTOMER_A)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/customers/{customerId}/sites", CUSTOMER_A)).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/customers/{customerId}/sites/{siteId}", CUSTOMER_A, SITE_A))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}", CUSTOMER_A, TWIN_A))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void customerSiteAndTwinIdTamperingRevealNoCrossCustomerData() throws Exception {
        String customerA = bearer("customer@example.com");

        mockMvc.perform(get("/api/customers/{customerId}", CUSTOMER_B).header("Authorization", customerA))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/sites", CUSTOMER_B).header("Authorization", customerA))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/sites/{siteId}", CUSTOMER_A, SITE_B)
                        .header("Authorization", customerA))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/sites/{siteId}", CUSTOMER_B, SITE_A)
                        .header("Authorization", customerA))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}", CUSTOMER_A, TWIN_B)
                        .header("Authorization", customerA))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}", CUSTOMER_B, TWIN_A)
                        .header("Authorization", customerA))
                .andExpect(status().isNotFound());

        String customerB = bearer("other-customer@example.com");
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}", CUSTOMER_A, TWIN_A)
                        .header("Authorization", customerB))
                .andExpect(status().isNotFound());
    }

    @Test
    void zeroMembershipCustomerCannotReadAnyCustomerScopedResource() throws Exception {
        String authorization = bearer("no-memberships@example.com");

        mockMvc.perform(get("/api/customers/{customerId}", CUSTOMER_A).header("Authorization", authorization))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/sites", CUSTOMER_A).header("Authorization", authorization))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/sites/{siteId}", CUSTOMER_A, SITE_A)
                        .header("Authorization", authorization))
                .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/customers/{customerId}/digital-twins/{twinId}", CUSTOMER_A, TWIN_A)
                        .header("Authorization", authorization))
                .andExpect(status().isNotFound());
    }

    @Test
    void schemaKeepsOwnershipOnSiteAndOneDigitalTwinPerSite() {
        Integer directCustomerColumns = jdbcClient.sql("""
                        SELECT COUNT(*) FROM information_schema.columns
                        WHERE table_schema = 'public' AND table_name = 'digital_twins' AND column_name = 'customer_id'
                        """)
                .query(Integer.class)
                .single();
        Integer uniqueSiteConstraints = jdbcClient.sql("""
                        SELECT COUNT(*)
                        FROM pg_constraint c
                        JOIN pg_class t ON t.oid = c.conrelid
                        WHERE t.relname = 'digital_twins' AND c.contype = 'u'
                          AND pg_get_constraintdef(c.oid) = 'UNIQUE (site_id)'
                        """)
                .query(Integer.class)
                .single();

        org.assertj.core.api.Assertions.assertThat(directCustomerColumns).isZero();
        org.assertj.core.api.Assertions.assertThat(uniqueSiteConstraints).isOne();
    }

    @Test
    void databaseRejectsASiteWithoutItsDigitalTwin() {
        String orphanSite = "30000000-0000-0000-0000-000000000099";

        assertThatThrownBy(() -> jdbcClient.sql("""
                        INSERT INTO sites (id, customer_id, name)
                        VALUES (:id, :customerId, 'Orphan Site')
                        """)
                .param("id", java.util.UUID.fromString(orphanSite))
                .param("customerId", java.util.UUID.fromString(CUSTOMER_A))
                .update())
                .isInstanceOf(DataAccessException.class);

        Integer persisted = jdbcClient.sql("SELECT COUNT(*) FROM sites WHERE id = :id")
                .param("id", java.util.UUID.fromString(orphanSite))
                .query(Integer.class)
                .single();
        org.assertj.core.api.Assertions.assertThat(persisted).isZero();
    }

    private String bearer(String email) throws Exception {
        return "Bearer " + login(email, "customer@example.com".equals(email)
                || "other-customer@example.com".equals(email)
                || "no-memberships@example.com".equals(email)
                        ? "customer-demo-password"
                        : "admin-demo-password");
    }

    private String login(String email, String password) throws Exception {
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsString();
        return JsonPath.read(response, "$.accessToken");
    }
}
