# Venus de Milo preview

Source: SMK — National Gallery of Denmark. Optimized by Shaderbytes.
https://sketchfab.com/3d-models/venus-de-milo-statuestexturingchallenge-smk-2983d92ac4e744f485492580ca7629f2
License: CC0 Public Domain, https://creativecommons.org/publicdomain/zero/1.0/

The user supplied the original download ZIP. Geometry and UVs are preserved, with uniform scaling to 2 metres and white stone studio material using the supplied normal texture. Original broken arms, drapery and thin base remain. This source preview was approved for game integration.

Geometry: 12,029 vertices and 24,058 triangles in the actual supplied OBJ. The source page reports a rounded 24.1k / API 24,060; actual imported mesh count is authoritative for this asset.


Game integration: source-derived mesh buffers are rotated to +Y up/+Z front, centered horizontally, and exported with shared high/distant geometry. Original split/corner normals are preserved; distant normals are sampled from the source smooth normal field rather than recomputed at UV seams. Far variants use 5,999 Venus / 8,000 David triangles and remain inside the high-detail bounds. The live station uses its portal-clipped matte marble shader, not the Blender studio lighting; the original Venus normal map is used when derivative shading is supported. See credits.html for current game attribution.
