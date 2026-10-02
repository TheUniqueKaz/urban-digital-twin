package com.example.digitaltwin.simulation;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.digitaltwin.customer.CustomerAccess;
import com.example.digitaltwin.customer.CustomerAccess.Access;
import com.example.digitaltwin.simulation.SimulationRepository.Measurement;
import com.example.digitaltwin.simulation.SimulationRepository.Run;

@RestController
@RequestMapping("/api/customers/{customerId}/digital-twins/{twinId}/simulation-runs")
class SimulationController {
    private final CustomerAccess customerAccess;
    private final SimulationRepository repository;
    private final SimulationService service;

    SimulationController(CustomerAccess customerAccess, SimulationRepository repository, SimulationService service) {
        this.customerAccess = customerAccess;
        this.repository = repository;
        this.service = service;
    }

    @PostMapping
    ResponseEntity<Run> generate(@PathVariable UUID customerId, @PathVariable UUID twinId,
            @AuthenticationPrincipal Jwt jwt) {
        Access access = authorizeTwin(customerId, twinId, jwt);
        if (!access.admin()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(service.generate(customerId, twinId, access.userId()));
    }

    @GetMapping("/latest")
    ResponseEntity<Run> latest(@PathVariable UUID customerId, @PathVariable UUID twinId,
            @AuthenticationPrincipal Jwt jwt) {
        authorizeTwin(customerId, twinId, jwt);
        return repository.latest(customerId, twinId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @GetMapping("/{runId}/measurements")
    List<Measurement> measurements(@PathVariable UUID customerId, @PathVariable UUID twinId,
            @PathVariable UUID runId, @AuthenticationPrincipal Jwt jwt) {
        authorizeTwin(customerId, twinId, jwt);
        repository.findRun(customerId, twinId, runId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return repository.measurements(customerId, twinId, runId);
    }

    private Access authorizeTwin(UUID customerId, UUID twinId, Jwt jwt) {
        Access access = customerAccess.current(jwt);
        customerAccess.require(customerId, access);
        if (repository.siteTimeZone(customerId, twinId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return access;
    }
}
