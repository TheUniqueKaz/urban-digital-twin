package com.example.digitaltwin.digitaltwin;

import java.util.UUID;
import java.util.List;

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
import com.example.digitaltwin.sensor.SensorRepository;
import com.example.digitaltwin.sensor.SensorRepository.Sensor;

@RestController
@RequestMapping("/api/customers/{customerId}/digital-twins")
class DigitalTwinController {
    private final DigitalTwinRepository digitalTwins;
    private final CustomerAccess customerAccess;
    private final SensorRepository sensors;

    DigitalTwinController(DigitalTwinRepository digitalTwins, CustomerAccess customerAccess, SensorRepository sensors) {
        this.digitalTwins = digitalTwins;
        this.customerAccess = customerAccess;
        this.sensors = sensors;
    }

    @GetMapping("/{twinId}")
    DigitalTwin digitalTwin(@PathVariable UUID customerId, @PathVariable UUID twinId,
            @AuthenticationPrincipal Jwt jwt) {
        customerAccess.require(customerId, customerAccess.current(jwt));
        return digitalTwins.findById(customerId, twinId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }

    @GetMapping("/{twinId}/sensors")
    List<Sensor> sensors(@PathVariable UUID customerId, @PathVariable UUID twinId,
            @AuthenticationPrincipal Jwt jwt) {
        customerAccess.require(customerId, customerAccess.current(jwt));
        digitalTwins.findById(customerId, twinId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        return sensors.findAll(customerId, twinId);
    }

    @GetMapping("/{twinId}/sensors/{sensorId}")
    Sensor sensor(@PathVariable UUID customerId, @PathVariable UUID twinId, @PathVariable UUID sensorId,
            @AuthenticationPrincipal Jwt jwt) {
        customerAccess.require(customerId, customerAccess.current(jwt));
        return sensors.findById(customerId, twinId, sensorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
