package com.example.digitaltwin;

import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
class SmokeController {

    @GetMapping("/api/smoke")
    Map<String, String> smoke() {
        return Map.of("status", "ok");
    }
}

