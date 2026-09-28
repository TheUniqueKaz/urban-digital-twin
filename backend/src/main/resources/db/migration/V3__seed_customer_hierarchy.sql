CREATE TABLE customers (
    id UUID PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE customer_memberships (
    user_id UUID NOT NULL REFERENCES app_users(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, customer_id)
);

CREATE TABLE sites (
    id UUID PRIMARY KEY,
    customer_id UUID NOT NULL REFERENCES customers(id),
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE digital_twins (
    id UUID PRIMARY KEY,
    site_id UUID NOT NULL UNIQUE REFERENCES sites(id),
    name VARCHAR(200) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE FUNCTION enforce_site_digital_twin() RETURNS TRIGGER AS $$
DECLARE
    site_to_check UUID;
BEGIN
    IF TG_TABLE_NAME = 'sites' THEN
        site_to_check := NEW.id;
    ELSE
        site_to_check := OLD.site_id;
    END IF;
    IF EXISTS (SELECT 1 FROM sites WHERE id = site_to_check)
       AND NOT EXISTS (SELECT 1 FROM digital_twins WHERE site_id = site_to_check) THEN
        RAISE EXCEPTION 'Site % must have exactly one Digital Twin', site_to_check;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER site_requires_digital_twin
AFTER INSERT OR UPDATE ON sites
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_site_digital_twin();

CREATE CONSTRAINT TRIGGER digital_twin_keeps_site_complete
AFTER DELETE OR UPDATE OF site_id ON digital_twins
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_site_digital_twin();

INSERT INTO app_users (id, email, password_hash, role)
VALUES
    ('10000000-0000-0000-0000-000000000003', 'other-customer@example.com', '$2y$12$CA12/ta9.UW8N1/fcpEBGuz5342g3Xbsy0A7JVlFhgdYQwNKQn6cC', 'CUSTOMER'),
    ('10000000-0000-0000-0000-000000000004', 'no-memberships@example.com', '$2y$12$CA12/ta9.UW8N1/fcpEBGuz5342g3Xbsy0A7JVlFhgdYQwNKQn6cC', 'CUSTOMER');

INSERT INTO customers (id, name)
VALUES
    ('20000000-0000-0000-0000-000000000001', 'Saigon Campus Group'),
    ('20000000-0000-0000-0000-000000000002', 'Riverside Research');

INSERT INTO customer_memberships (user_id, customer_id)
VALUES
    ('10000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001'),
    ('10000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002');

INSERT INTO sites (id, customer_id, name)
VALUES
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Innovation Campus'),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Technology Annex'),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'Riverside Campus');

INSERT INTO digital_twins (id, site_id, name)
VALUES
    ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Innovation Campus Digital Twin'),
    ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 'Technology Annex Digital Twin'),
    ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 'Riverside Campus Digital Twin');
