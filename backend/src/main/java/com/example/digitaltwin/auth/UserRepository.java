package com.example.digitaltwin.auth;

import java.util.Optional;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class UserRepository {

    private final JdbcClient jdbcClient;

    UserRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    Optional<UserAccount> findByEmail(String email) {
        return jdbcClient.sql("""
                        SELECT id, email, password_hash, role, enabled
                        FROM app_users
                        WHERE lower(email) = lower(:email)
                        """)
                .param("email", email)
                .query((resultSet, rowNumber) -> new UserAccount(
                        resultSet.getObject("id", java.util.UUID.class),
                        resultSet.getString("email"),
                        resultSet.getString("password_hash"),
                        Role.valueOf(resultSet.getString("role")),
                        resultSet.getBoolean("enabled")))
                .optional();
    }
}
