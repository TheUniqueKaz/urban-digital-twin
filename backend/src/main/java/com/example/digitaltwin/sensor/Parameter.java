package com.example.digitaltwin.sensor;

public enum Parameter {
    PM25("µg/m³", 18),
    PM10("µg/m³", 32),
    NO2("µg/m³", 24),
    CO2("ppm", 420);

    private final String unit;
    private final double baseline;

    Parameter(String unit, double baseline) {
        this.unit = unit;
        this.baseline = baseline;
    }

    public String unit() {
        return unit;
    }

    public double baseline() {
        return baseline;
    }
}
