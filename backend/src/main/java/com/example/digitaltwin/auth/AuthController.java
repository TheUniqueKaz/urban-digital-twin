package com.example.digitaltwin.auth;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository users;
    private final TokenService tokens;

    AuthController(AuthenticationManager authenticationManager, UserRepository users, TokenService tokens) {
        this.authenticationManager = authenticationManager;
        this.users = users;
        this.tokens = tokens;
    }

    @PostMapping("/auth/login")
    LoginResponse login(@RequestBody LoginRequest request) {
        if (request.email() == null || request.email().isBlank()
                || request.password() == null || request.password().isBlank()) {
            throw unauthorized();
        }

        try {
            authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(request.email(), request.password()));
        } catch (AuthenticationException exception) {
            throw unauthorized();
        }

        UserAccount user = users.findByEmail(request.email()).orElseThrow(this::unauthorized);
        return new LoginResponse(tokens.issue(user), tokens.expiresInSeconds());
    }

    @GetMapping("/me")
    MeResponse me(@AuthenticationPrincipal Jwt jwt) {
        return new MeResponse(
                UUID.fromString(jwt.getClaimAsString("uid")),
                jwt.getSubject(),
                Role.valueOf(jwt.getClaimAsString("role")));
    }

    private ResponseStatusException unauthorized() {
        return new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
    }

    record LoginRequest(String email, String password) {
    }

    record LoginResponse(String accessToken, long expiresIn) {
    }

    record MeResponse(UUID id, String email, Role role) {
    }
}
