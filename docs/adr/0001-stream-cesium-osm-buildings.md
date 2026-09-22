# Stream Cesium OSM Buildings as an external base layer

The MVP streams Cesium OSM Buildings directly in CesiumJS and does not import or persist building geometry in PostGIS. This keeps the personal demo focused on customer-owned environmental observations, at the cost of not having an immutable building snapshot or backend building queries; importing source OpenStreetMap data remains a later, separate pipeline if those capabilities become necessary.

