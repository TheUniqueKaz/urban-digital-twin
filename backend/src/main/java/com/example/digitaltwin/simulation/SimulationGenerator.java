package com.example.digitaltwin.simulation;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.SplittableRandom;
import java.util.UUID;

import com.example.digitaltwin.sensor.Parameter;

/** A deterministic, non-scientific demonstration rule. */
final class SimulationGenerator {
    private SimulationGenerator() {
    }

    static BigDecimal value(long seed, UUID sensorId, double longitude, double latitude,
            Parameter parameter, int intervalIndex) {
        double baseline = parameter.baseline();
        long sensorSeed = seed ^ sensorId.getMostSignificantBits() ^ sensorId.getLeastSignificantBits()
                ^ ((long) parameter.ordinal() << 48)
                ^ Double.doubleToLongBits(longitude) ^ Double.doubleToLongBits(latitude);
        SplittableRandom random = new SplittableRandom(sensorSeed);
        double lowerNoise = 0;
        double upperNoise = random.nextDouble(-0.025, 0.025);
        for (int hour = 0; hour <= intervalIndex / 4; hour++) {
            lowerNoise = upperNoise;
            upperNoise = random.nextDouble(-0.025, 0.025);
        }
        double noise = lowerNoise + (upperNoise - lowerNoise) * (intervalIndex % 4) / 4.0;
        double sensorOffset = Math.floorMod(sensorId.hashCode(), 1000) / 500.0 - 1;
        double locationOffset = Math.sin(Math.toRadians(longitude * 1000))
                + Math.cos(Math.toRadians(latitude * 1000));
        double dailyCurve = Math.sin(2 * Math.PI * intervalIndex / 40.0 - Math.PI / 2);
        double value = baseline * (1 + 0.04 * sensorOffset + 0.03 * locationOffset
                + 0.12 * dailyCurve + noise);
        return BigDecimal.valueOf(Math.max(0, value)).setScale(2, RoundingMode.HALF_UP);
    }
}
