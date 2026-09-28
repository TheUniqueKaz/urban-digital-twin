package com.example.digitaltwin.customer;

import java.util.List;
import java.util.UUID;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.example.digitaltwin.customer.CustomerRepository.Customer;

@RestController
@RequestMapping("/api/customers")
class CustomerController {
    private final CustomerRepository customers;
    private final CustomerAccess customerAccess;

    CustomerController(CustomerRepository customers, CustomerAccess customerAccess) {
        this.customers = customers;
        this.customerAccess = customerAccess;
    }

    @GetMapping
    List<Customer> customers(@AuthenticationPrincipal Jwt jwt) {
        return customers.findAll(customerAccess.current(jwt));
    }

    @GetMapping("/{customerId}")
    Customer customer(@PathVariable UUID customerId, @AuthenticationPrincipal Jwt jwt) {
        customerAccess.require(customerId, customerAccess.current(jwt));
        return customers.findById(customerId).orElseThrow();
    }
}
