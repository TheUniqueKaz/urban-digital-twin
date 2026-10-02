ALTER TABLE sites ADD COLUMN time_zone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';

CREATE TABLE simulation_runs (
    id UUID PRIMARY KEY,
    digital_twin_id UUID NOT NULL REFERENCES digital_twins(id),
    name VARCHAR(200) NOT NULL,
    seed BIGINT NOT NULL,
    configuration VARCHAR(100) NOT NULL,
    time_zone VARCHAR(64) NOT NULL,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    interval_minutes INTEGER NOT NULL CHECK (interval_minutes = 15),
    created_by UUID NOT NULL REFERENCES app_users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT simulation_run_time_order CHECK (end_at > start_at)
);

CREATE TABLE measurements (
    id UUID PRIMARY KEY,
    sensor_id UUID NOT NULL REFERENCES sensors(id),
    simulation_run_id UUID REFERENCES simulation_runs(id),
    parameter VARCHAR(10) NOT NULL CHECK (parameter IN ('PM25', 'PM10', 'NO2', 'CO2')),
    value NUMERIC(10, 2) NOT NULL,
    unit VARCHAR(10) NOT NULL,
    observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    provenance VARCHAR(10) NOT NULL CHECK (provenance IN ('MEASURED', 'SIMULATED', 'ESTIMATED')),
    CONSTRAINT simulated_measurement_has_run CHECK (provenance <> 'SIMULATED' OR simulation_run_id IS NOT NULL),
    CONSTRAINT unique_simulated_observation UNIQUE (simulation_run_id, sensor_id, parameter, observed_at)
);

CREATE FUNCTION enforce_measurement_run_sensor_twin() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.simulation_run_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM sensors s
        JOIN simulation_runs r ON r.id = NEW.simulation_run_id
        WHERE s.id = NEW.sensor_id AND s.digital_twin_id = r.digital_twin_id
    ) THEN
        RAISE EXCEPTION 'Measurement Sensor and Simulation Run must belong to the same Digital Twin';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER measurement_run_sensor_same_twin
BEFORE INSERT OR UPDATE OF sensor_id, simulation_run_id ON measurements
FOR EACH ROW EXECUTE FUNCTION enforce_measurement_run_sensor_twin();

CREATE FUNCTION prevent_simulation_run_twin_change() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.digital_twin_id IS DISTINCT FROM OLD.digital_twin_id THEN
        RAISE EXCEPTION 'Simulation Run Digital Twin is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER simulation_run_twin_immutable
BEFORE UPDATE OF digital_twin_id ON simulation_runs
FOR EACH ROW EXECUTE FUNCTION prevent_simulation_run_twin_change();

CREATE FUNCTION prevent_sensor_twin_change() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.digital_twin_id IS DISTINCT FROM OLD.digital_twin_id THEN
        RAISE EXCEPTION 'Sensor Digital Twin is immutable';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sensor_twin_immutable
BEFORE UPDATE OF digital_twin_id ON sensors
FOR EACH ROW EXECUTE FUNCTION prevent_sensor_twin_change();
