CREATE TABLE app_users (
    id UUID PRIMARY KEY,
    email VARCHAR(320) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'CUSTOMER')),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO app_users (id, email, password_hash, role)
VALUES
    ('10000000-0000-0000-0000-000000000001', 'admin@example.com', '$2y$12$za4dFz4kA46byCXk.M47qODbdB66J.nfrridSqrSQhVLbrm0zl0/e', 'ADMIN'),
    ('10000000-0000-0000-0000-000000000002', 'customer@example.com', '$2y$12$CA12/ta9.UW8N1/fcpEBGuz5342g3Xbsy0A7JVlFhgdYQwNKQn6cC', 'CUSTOMER');
