# Sample provenance and schema

Supported interactive size limits: 10000 triangles per STL, 10000 nodes per CSV, and 20 MiB per file. Files exceeding any applicable limit are rejected before rendering.

Coordinate magnitudes and CSV temperature magnitudes are limited to 1e12 to avoid unusable rendering ranges. These are numerical interface limits, not physical validity guarantees.

Both sample files were created specifically for this assessment with disclosed AI assistance. No ANSYS installation or external CAD asset was used. These sample files are released under CC0-1.0 by the submitting author, subject to their ownership confirmation.

`sample.stl` is an original four-triangle tetrahedron spanning 0 to 1 in x/y/z. ASCII STL has no intrinsic unit field; the intended unit for this sample is metres. Normals are present but rendering uses vertex positions.

`temperatures.csv` is **synthetic**, not an actual ANSYS export. The temperature values follow T(x)=100-80x+500x(1-x) at x=0,0.25,0.5,0.75,1, repeated at y=0 and y=0.1 m, z=0. It demonstrates the supported ANSYS-style nodal export schema.

Exact case-sensitive header: `node_id,x_m,y_m,z_m,temperature_C`. Coordinates are metres and temperatures degrees Celsius. IDs must be unique non-negative safe integers. Plain unquoted comma-delimited numeric fields only. CRLF and LF supported. Empty rows are ignored; all five fields are required and finite. Quoted fields, extra columns and alternate headers are intentionally rejected. Upload limit: 20 MiB per file. ASCII STL only; binary STL and native CAD/ANSYS formats are unsupported. Mesh-to-result registration is not performed.
