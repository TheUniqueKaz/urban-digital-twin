# Innovation Campus geographic context

This is public visual context for the area of the existing Innovation Campus seed, not a real campus survey or customer-owned backend data. Site boundaries and Virtual Sensor positions still come exclusively from the authorized APIs.

## Source and coverage

- Source: [OpenStreetMap map API](https://api.openstreetmap.org/api/0.6/map?bbox=106.695,10.770,106.705,10.779).
- Retrieved: 2026-10-05 (Asia/Saigon).
- Coverage: west 106.695°, south 10.770°, east 106.705°, north 10.779°; central Ho Chi Minh City, approximately 1.09 km × 1.00 km.
- Attribution: © OpenStreetMap contributors, [copyright and ODbL 1.0](https://www.openstreetmap.org/copyright). The derived snapshot remains available under ODbL 1.0; retain attribution when redistributing it.
- Asset: `frontend/public/geography/innovation-campus.json`, 140,546 UTF-8 bytes.
- SHA-256: `3517D56C308A4A2759CF0F0B541359E748B64AE186D75DA5EE41211FA618B599`.
- Frozen workload: 441 building footprints; 146 main-road segments.

The API returned 482 tagged building ways and 674 tagged highway ways before curation. A one-time standard-library XML extraction retained closed building ways whose complete vertex list lies inside the coverage. It retained contiguous in-coverage vertex sequences (at least two vertices) for `primary`, `secondary`, `tertiary`, `trunk`, `primary_link`, and `secondary_link` roads. Coordinates and names are copied from source; ways may split into several rendering segments. The original public XML response was a temporary extraction input, not a runtime asset. Overpass endpoints were unavailable during delivery; the OSM map API supplied the data successfully. There are no runtime provider calls or backend imports.

## Omissions and approximation limits

OpenStreetMap is community mapping, not surveyed truth. Coverage is incomplete and may be stale. Multipolygon relations, building ways crossing the coverage edge, minor/service/residential roads, and roads with fewer than two consecutive in-coverage vertices are omitted. Road endings stop at source vertices; they are not analytically clipped to the bounding box. Water, parks, terrain, interiors, roof shapes, and verified elevation are omitted. Missing source names appear as unnamed; address and ownership are unavailable.

Buildings preserve footprint vertices and orientation and use uniform, **stylized 18 m heights**; these are not sourced heights. Roads preserve centerline vertices; **approximate widths** are 14 m for primary/trunk, 10 m for secondary, and 8 m for other included classes. Butt joins and overlaps are intentional simple presentation, not surveyed road edges. Buildings have one shared neutral material and no textures. Trees are reusable low-poly trunk/canopy geometry with shared materials and instancing in four spatial sectors. Production contains 24 illustrative trees; their placement and dimensions are decorative. The 1,000-tree case is development benchmark data only.

## Geographic registration

`geography.ts` derives the longitude/latitude midpoint of the authorized Site exterior ring's bounding extent. All rings, Sensor points, building vertices and road vertices use its WGS84 zero-height geodetic → ECEF → local ENU conversion, before Float32 GPU buffers. Three axes are East, Up, −North; one unit equals one metre. Flat ground discards curvature-related Up, with roads and markers slightly raised for presentation. No local coordinates are stored or posted to an API. Camera fit uses projected boundary extents with label margins and never rescales geographic geometry.

Independent coordinate fixtures were generated using PostGIS `ST_Transform` from EPSG:4979 to EPSG:4978 (PROJ), then an explicit SQL ENU rotation. Tests compare all three axes to 1 mm, including a point approximately 7.8 km away. This is numerical agreement with the zero-height ellipsoid conversion, not positional accuracy of the OSM data or a terrain model. Polygon holes are converted and passed to Three Shape holes for triangulation/extrusion.

Environment context distinguishes sourced horizontal layout, approximate dimensions, illustrative vegetation, and unavailable metadata. Feature keys are frontend/source picking identifiers only. Snapshot HTTP errors, invalid geometry, and unsupported Site coverage report unavailable context while boundary/Sensors/observations remain usable.
