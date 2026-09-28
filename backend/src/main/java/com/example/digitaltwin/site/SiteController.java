package com.example.digitaltwin.site;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.example.digitaltwin.customer.CustomerAccess;
import com.example.digitaltwin.site.SiteRepository.Site;

@RestController
@RequestMapping("/api/customers/{customerId}/sites")
class SiteController {
    private final SiteRepository sites;
    private final CustomerAccess customerAccess;

    SiteController(SiteRepository sites, CustomerAccess customerAccess) {
        this.sites = sites;
        this.customerAccess = customerAccess;
    }

    @GetMapping
    List<Site> sites(@PathVariable UUID customerId, @AuthenticationPrincipal Jwt jwt) {
        customerAccess.require(customerId, customerAccess.current(jwt));
        return sites.findAll(customerId);
    }

    @GetMapping("/{siteId}")
    Site site(@PathVariable UUID customerId, @PathVariable UUID siteId, @AuthenticationPrincipal Jwt jwt) {
        customerAccess.require(customerId, customerAccess.current(jwt));
        return sites.findById(customerId, siteId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
    }
}
