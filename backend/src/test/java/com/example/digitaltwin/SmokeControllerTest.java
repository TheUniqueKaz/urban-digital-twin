package com.example.digitaltwin;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class SmokeControllerTest {

    private final MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new SmokeController()).build();

    @Test
    void exposesSmokeEndpoint() throws Exception {
        mockMvc.perform(get("/api/smoke"))
                .andExpect(status().isOk())
                .andExpect(content().json("{\"status\":\"ok\"}"));
    }
}

