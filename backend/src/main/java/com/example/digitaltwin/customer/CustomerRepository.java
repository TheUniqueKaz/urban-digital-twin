package com.example.digitaltwin.customer;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
class CustomerRepository {
    private final JdbcClient jdbcClient;

    CustomerRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    List<Customer> findAll(CustomerAccess.Access access) {
        return jdbcClient.sql("""
                        SELECT c.id, c.name FROM customers c
                        WHERE :admin OR EXISTS (
                            SELECT 1 FROM customer_memberships m
                            WHERE m.customer_id = c.id AND m.user_id = :userId
                        )
                        ORDER BY c.id
                        """)
                .param("admin", access.admin())
                .param("userId", access.userId())
                .query(Customer.class)
                .list();
    }

    Optional<Customer> findById(UUID customerId) {
        return jdbcClient.sql("SELECT id, name FROM customers WHERE id = :customerId")
                .param("customerId", customerId)
                .query(Customer.class)
                .optional();
    }

    record Customer(UUID id, String name) {
    }
}
