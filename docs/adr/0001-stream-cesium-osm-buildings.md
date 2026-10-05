# Stream Cesium OSM Buildings as an external base layer

Status: Superseded by [ADR 0005 — Site-local stylized visualization](./0005-site-local-stylized-visualization.md), accepted 2026-10-05. The following records the historical decision; it is no longer the visualization requirement.

The MVP streams Cesium OSM Buildings directly in CesiumJS and does not import or persist building geometry in PostGIS. This keeps the personal demo focused on customer-owned environmental observations, at the cost of not having an immutable building snapshot or backend building queries; importing source OpenStreetMap data remains a later, separate pipeline if those capabilities become necessary.

