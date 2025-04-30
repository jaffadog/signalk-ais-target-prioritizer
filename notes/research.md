
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
