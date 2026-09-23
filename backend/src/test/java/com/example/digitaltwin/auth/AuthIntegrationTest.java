package com.example.digitaltwin.auth;

import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest(properties = "auth.jwt.secret=test-only-jwt-secret-with-at-least-32-bytes")
@AutoConfigureMockMvc
class AuthIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtEncoder jwtEncoder;

    @Autowired
    private JdbcClient jdbcClient;

    @Test
    void runsAgainstPostgresqlPostgisAndRealFlywayMigrations() {
        String database = jdbcClient.sql("SELECT version()")
                .query(String.class)
                .single();
        String postgis = jdbcClient.sql("SELECT postgis_version()")
                .query(String.class)
                .single();
        Integer seedMigration = jdbcClient.sql("""
                        SELECT COUNT(*) FROM flyway_schema_history
                        WHERE version = '2' AND success = TRUE
                        """)
                .query(Integer.class)
                .single();

        org.assertj.core.api.Assertions.assertThat(database).contains("PostgreSQL");
        org.assertj.core.api.Assertions.assertThat(postgis).isNotBlank();
        org.assertj.core.api.Assertions.assertThat(seedMigration).isOne();
    }

    @Test
    void seededPasswordsAreStoredAsBcryptHashes() {
        String hash = jdbcClient.sql("SELECT password_hash FROM app_users WHERE email = 'admin@example.com'")
                .query(String.class)
                .single();

        org.assertj.core.api.Assertions.assertThat(hash)
                .startsWith("$2")
                .doesNotContain("admin-demo-password");
    }

    @Test
    void adminCanLoginAndReadCurrentIdentity() throws Exception {
        String token = login("admin@example.com", "admin-demo-password");

        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("10000000-0000-0000-0000-000000000001"))
                .andExpect(jsonPath("$.email").value("admin@example.com"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void customerCanLoginAndReadCurrentIdentity() throws Exception {
        String token = login("customer@example.com", "customer-demo-password");

        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("customer@example.com"))
                .andExpect(jsonPath("$.role").value("CUSTOMER"));
    }

    @Test
    void invalidCredentialsAreRejected() throws Exception {
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"admin@example.com","password":"wrong"}
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void missingInvalidAndExpiredTokensAreRejected() throws Exception {
        mockMvc.perform(get("/api/me"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/me").header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized());

        Instant now = Instant.now();
        JwtClaimsSet expiredClaims = JwtClaimsSet.builder()
                .issuer("urban-digital-twin")
                .subject("admin@example.com")
                .issuedAt(now.minusSeconds(7200))
                .expiresAt(now.minusSeconds(3600))
                .claim("uid", "10000000-0000-0000-0000-000000000001")
                .claim("role", "ADMIN")
                .build();
        String expiredToken = jwtEncoder.encode(JwtEncoderParameters.from(
                JwsHeader.with(MacAlgorithm.HS256).build(), expiredClaims)).getTokenValue();

        mockMvc.perform(get("/api/me").header("Authorization", "Bearer " + expiredToken))
                .andExpect(status().isUnauthorized());
    }

    private String login(String email, String password) throws Exception {
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":"%s","password":"%s"}
                                """.formatted(email, password)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken", startsWith("eyJ")))
                .andExpect(jsonPath("$.expiresIn").value(3600))
                .andReturn()
                .getResponse()
                .getContentAsString();
        return com.jayway.jsonpath.JsonPath.read(response, "$.accessToken");
    }
}
