# David statue preview

Source: **David Statue** by **Filip (@filip.hans.nyberg)**.
https://sketchfab.com/3d-models/david-statue-f0e3d5b992d54d159ee26003e239b972

License: Creative Commons Attribution 4.0 (CC BY 4.0).
https://creativecommons.org/licenses/by/4.0/

This is the artist's independently sculpted interpretation of Michelangelo's David, not a photogrammetric replica of the original marble sculpture. The user supplied the original FBX download from the source page.

Changes: removed the separate stone plinth and complete sling, retained the uploaded figure's pose, face, fingers, feet and body geometry; normalized height to two metres; applied white marble material and studio lighting. The body already contains a simplified neutral pelvic surface without explicit genital geometry. The figure is 152,556 triangles across body, hair and eyes. No geometric subdivision was used to inflate the count.

The studio floor, camera and lights appear only in the renders and Blender project. They are not part of the GLB game asset. This source preview was approved for game integration.


Game integration: source-derived mesh buffers are rotated to +Y up/+Z front, centered horizontally, and exported with shared high/distant geometry. Original split/corner normals are preserved; distant normals are sampled from the source smooth normal field rather than recomputed at UV seams. Far variants use 5,999 Venus / 8,000 David triangles and remain inside the high-detail bounds. The live station uses its portal-clipped matte marble shader, not the Blender studio lighting; the original Venus normal map is used when derivative shading is supported. See credits.html for current game attribution.
