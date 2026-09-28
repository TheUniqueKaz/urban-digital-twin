package com.example.digitaltwin.digitaltwin;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.digitaltwin.customer.CustomerAccess;
import com.example.digitaltwin.digitaltwin.DigitalTwinRepository.DigitalTwin;

@RestController
@RequestMapping("/api/customers/{customerId}/digital-twins")
class DigitalTwinController {
    private final DigitalTwinRepository digitalTwins;
    private final CustomerAccess customerAccess;

    DigitalTwinController(DigitalTwinRepository digitalTwins, CustomerAccess customerAccess) {
        this.digitalTwins = digitalTwins;
        this.customerAccess = customerAccess;
    }

    @GetMapping("/{twinId}")
    DigitalTwin digitalTwin(@PathVariable UUID customerId, @PathVariable UUID twinId,
            @AuthenticationPrincipal Jwt jwt) {
        customerAccess.require(customerId, customerAccess.current(jwt));
        return digitalTwins.findById(customerId, twinId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
