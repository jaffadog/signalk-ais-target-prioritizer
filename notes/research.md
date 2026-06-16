
leaflet buttons
    rotate map

add tracks?
    // http://raspberrypi.local/signalk/v1/api/tracks?radius=500


laflet vs mapLibre gl js

    https://maplibre.org/maplibre-gl-js/docs/

    map methods/features used:
        markers
            svg icons
            labels/tooltips - collision controller (!)
            popups
        polylines
        circles
        tooltips (adding numbers to range rings)

        custom buttons
    map methods
        panTo
        fitBounds(to a pair of markers)

offline map:
    signalk server charts plugin

    https://docs.protomaps.com/
        PMTiles (not same as MBTiles!)
        signalk-pmtiles-plugin
        Your MBTiles files can be easily converted to PMTiles using the go-pmtiles utility
        Server Version	API	Path
        1.x.x	v1	/signalk/v1/api/resources/charts
        2.x.x	v2	/signalk/v2/api/resources/charts
        Protomaps publishes a lightweight Leaflet plugin, protomaps-leaflet, that implements vector drawing and text labels built on the Canvas API and Web Fonts.
        https://github.com/protomaps/protomaps-leaflet

        https://docs.protomaps.com/guide/getting-started

        The pmtiles CLI tool is a single binary you can download at GitHub Releases.

        We can also create a subset of the whole planet that is only zoom levels 0 to 6 and ~60 MB:
        pmtiles extract https://build.protomaps.com/20250424.pmtiles planet_z6.pmtiles --maxzoom=6

        pmtiles extract INPUT.pmtiles OUTPUT.pmtiles --bbox=MIN_LON,MIN_LAT,MAX_LON,MAX_LAT
        pmtiles extract INPUT.pmtiles OUTPUT.pmtiles --region=REGION.geojson
        pmtiles extract https://example.com/INPUT.pmtiles OUTPUT.pmtiles --maxzoom=MAXZOOM
        pmtiles extract INPUT.pmtiles OUTPUT.pmtiles --maxzoom=MAXZOOM --bucket=s3://BUCKET_NAME

        207.290039,-18.396230,222.341309,-7.602108
        -153,-19,-138,-7

        -135

        pmtiles extract https://build.protomaps.com/20250426.pmtiles FP.pmtiles --bbox=-153,-19,-138,-7 --dry-run

        196.699219,-23.039298,232.558594,-5.790897

        pmtiles extract https://build.protomaps.com/20250426.pmtiles FP.pmtiles --bbox=196.699219,-23.039298,232.558594,-5.790897 --dry-run

        https://pmtiles.io/

        https://www.jsdelivr.com/package/npm/protomaps-leaflet?tab=files
        5.0.1

        https://www.jsdelivr.com/package/npm/@protomaps/basemaps?tab=files&path=dist
        5.3.0


C:\Users\jaffa\Downloads\go-pmtiles_1.27.2_Windows_x86_64

C:\signalk\signalkhome\.signalk\charts\pmtiles

        // e3 e6
        // n54 n52

        pmtiles extract https://build.protomaps.com/20250504.pmtiles NL.pmtiles --bbox=1,50,8,56 --dry-run
        pmtiles extract https://build.protomaps.com/20250504.pmtiles NL.pmtiles --bbox=3,52,6,54



download:
https://osmdata.openstreetmap.de/download/simplified-land-polygons-complete-3857.zip

which contains:
simplified_land_polygons.shp
(Large simplified polygons not split, use for zoom level 0-9)	
Mercator (EPSG 3857)

convert to pmtiles (protomaps):

ogr2ogr -t_srs EPSG:3857 simplified_land_polygons.json simplified_land_polygons.shp
tippecanoe -zg --projection=EPSG:3857 -o simplified_land_polygons.pmtiles --drop-densest-as-needed --extend-zooms-if-still-dropping simplified_land_polygons.json

ogr2ogr -f GeoJSON simplified_land_polygons.geojson simplified_land_polygons.shp

tippecanoe -zg --projection=EPSG:3857 -o simplified_land_polygons.pmtiles --drop-densest-as-needed --extend-zooms-if-still-dropping simplified_land_polygons.geojson

tippecanoe --projection=EPSG:3857 -o earth.pmtiles -l earth -n "earth" -z13 simplified_land_polygons.json

tippecanoe --projection=EPSG:3857 -o earth-z15.pmtiles -l earth -n "earth" -z15 --drop-densest-as-needed --extend-zooms-if-still-dropping simplified_land_polygons.json

---

10m Natural Earth

/mnt/c/Users/jaffa/Downloads/10m_physical

ne_10m_land.shp
ne_10m_land_ocean_label_points.shp
ne_10m_minor_islands.shp
ne_10m_minor_islands_label_points.shp

// LAND:
ogr2ogr -f GeoJSON ne_10m_land.geojson ne_10m_land.shp
tippecanoe -f -z6 -o ne_10m_land.pmtiles --drop-densest-as-needed --extend-zooms-if-still-dropping ne_10m_land.geojson

tippecanoe -f -zg -o ne_10m_land-earth.pmtiles -l earth -n "earth" --drop-densest-as-needed --extend-zooms-if-still-dropping ne_10m_land.geojson

// MINOR ISLANDS:
ogr2ogr -f GeoJSON ne_10m_minor_islands.geojson ne_10m_minor_islands.shp
tippecanoe -f -z6 -o ne_10m_minor_islands.pmtiles --drop-densest-as-needed --extend-zooms-if-still-dropping ne_10m_minor_islands.geojson

tippecanoe -f -zg -o ne_10m_minor_islands.pmtiles -l earth -n "earth" --drop-densest-as-needed --extend-zooms-if-still-dropping ne_10m_minor_islands.geojson

// LAND OCEAN LABEL POINTS:
ogr2ogr -f GeoJSON ne_10m_land_ocean_label_points.geojson ne_10m_land_ocean_label_points.shp
tippecanoe -f -z6 -o ne_10m_land_ocean_label_points.pmtiles --drop-densest-as-needed --extend-zooms-if-still-dropping ne_10m_land_ocean_label_points.geojson

// MINOR ISLAND LABEL POINTS:
ogr2ogr -f GeoJSON ne_10m_minor_islands_label_points.geojson ne_10m_minor_islands_label_points.shp
tippecanoe -f -z6 -o ne_10m_minor_islands_label_points.pmtiles --drop-densest-as-needed --extend-zooms-if-still-dropping ne_10m_minor_islands_label_points.geojson

// MARINR POLYGONS:
ogr2ogr -f GeoJSON ne_10m_geography_marine_polys.geojson ne_10m_geography_marine_polys.shp
tippecanoe -f -z6 -o ne_10m_geography_marine_polys.pmtiles --drop-densest-as-needed --extend-zooms-if-still-dropping ne_10m_geography_marine_polys.geojson



--overzoom

tile-join -f -o ne_10m_land_islands.pmtiles \
ne_10m_land.pmtiles \
ne_10m_minor_islands.pmtiles \
ne_10m_land_ocean_label_points.pmtiles \
ne_10m_minor_islands_label_points.pmtiles \
ne_10m_geography_marine_polys.pmtiles


---

test with:
https://maps.protomaps.com/
https://pmtiles.io/
