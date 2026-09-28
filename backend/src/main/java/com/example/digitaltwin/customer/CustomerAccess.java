package com.example.digitaltwin.customer;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class CustomerAccess {
    private final JdbcClient jdbcClient;

    CustomerAccess(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public Access current(Jwt jwt) {
        return new Access(UUID.fromString(jwt.getClaimAsString("uid")), "ADMIN".equals(jwt.getClaimAsString("role")));
    }

    public void require(UUID customerId, Access access) {
        Boolean allowed = jdbcClient.sql("""
                        SELECT EXISTS (
                            SELECT 1 FROM customers c
                            WHERE c.id = :customerId
                              AND (:admin OR EXISTS (
                                  SELECT 1 FROM customer_memberships m
                                  WHERE m.customer_id = c.id AND m.user_id = :userId
                              ))
                        )
                        """)
                .param("customerId", customerId)
                .param("admin", access.admin())
                .param("userId", access.userId())
                .query(Boolean.class)
                .single();
        if (!allowed) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
    }

    public record Access(UUID userId, boolean admin) {
    }
}
