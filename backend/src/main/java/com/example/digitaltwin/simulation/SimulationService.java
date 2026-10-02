package com.example.digitaltwin.simulation;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import com.example.digitaltwin.simulation.SimulationRepository.Measurement;
import com.example.digitaltwin.simulation.SimulationRepository.Run;
import com.example.digitaltwin.simulation.SimulationRepository.SensorParameter;

@Service
class SimulationService {
    private static final long SEED = 20260928L;
    private static final String CONFIGURATION = "non-scientific-demo-rule-v1";
    private static final int INTERVAL_MINUTES = 15;
    private static final int INTERVAL_COUNT = 40;

    private final SimulationRepository repository;
    private final Clock clock;

    SimulationService(SimulationRepository repository, Clock clock) {
        this.repository = repository;
        this.clock = clock;
    }

    @Transactional
    Run generate(UUID customerId, UUID twinId, UUID creatorId) {
        ZoneId zone = repository.siteTimeZone(customerId, twinId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        List<SensorParameter> inputs = repository.inputs(twinId);
        if (inputs.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "No Sensor capabilities to simulate");
        }
        LocalDate day = LocalDate.now(clock.withZone(zone));
        Instant start = day.atTime(8, 0).atZone(zone).toInstant();
        Instant end = day.atTime(18, 0).atZone(zone).toInstant();
        Instant createdAt = clock.instant();
        Run run = new Run(UUID.randomUUID(), twinId, "Fixed air-quality demo", SEED,
                CONFIGURATION, zone.getId(), start, end, INTERVAL_MINUTES, creatorId, createdAt);
        repository.insertRun(run);
        for (int interval = 0; interval <= INTERVAL_COUNT; interval++) {
            Instant observedAt = start.plusSeconds((long) interval * INTERVAL_MINUTES * 60);
            for (SensorParameter input : inputs) {
                repository.insertMeasurement(new Measurement(UUID.randomUUID(), input.sensorId(), run.id(),
                        input.parameter(), SimulationGenerator.value(SEED, input.sensorId(),
                                input.longitude(), input.latitude(), input.parameter(), interval),
                        input.parameter().unit(), observedAt, createdAt, "SIMULATED"));
            }
        }
        return run;
    }
}
