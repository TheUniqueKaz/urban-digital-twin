package com.example.digitaltwin.auth;

import java.util.UUID;

record UserAccount(UUID id, String email, String passwordHash, Role role, boolean enabled) {
}
