// basemaps

import type { Basemap } from "./basemap.types";
import { getCharts } from "./utils/api";

/*


      // style: "https://demotiles.maplibre.org/globe.json", // style URL
      // style: "https://tiles.openfreemap.org/styles/liberty",
      // style: "https://tiles.openfreemap.org/styles/dark",
      // style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",


osm:
https://tile.openstreetmap.org/{z}/{x}/{y}.png

opentopo:
https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png

acrgis/sat:
https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}

ne local...

  Empty: L.tileLayer(""),
  OpenStreetMap: osm,
  OpenTopoMap: openTopoMap,
  Satellite: satLayer,
  "NaturalEarth (offline)": naturalEarth10m,

var charts = await getHttpResponse("/signalk/v1/api/resources/charts", {


http://localhost:3000/signalk/v2/api/resources/charts/

http://localhost:3000/signalk/v1/api/resources/charts

http://localhost:3000/signalk/pmtiles
["FP-pmtiles"]

http://localhost:3000/signalk/pmtiles/FP-pmtiles


http://localhost:3000/signalk/v2/api/resources/charts
{"FP-pmtiles":{"identifier":"FP-pmtiles","name":"FP","description":"","type":"tilelayer","scale":250000,"minzoom":0,"maxzoom":15,"bounds":[-153,-19,-138,-7],"format":"mvt","url":"/signalk/pmtiles/FP.pmtiles","layers":["boundaries","buildings","earth","landcover","landuse","places","pois","roads","water"]}}

http://localhost:3000/signalk/v1/api/resources/charts
{}


pmtiles extract https://build.protomaps.com/20260610.pmtiles south-pacific.pmtiles \
  --bbox=-176.5,-23.5,-157.5,-9.0



{
    "FP-pmtiles": {
        "identifier": "FP-pmtiles",                   <<<<<<<<<<<<<<<<<<<<<<<<<<<
        "name": "FP",                                 <<<<<<<<<<<<<<<<<<
        "description": "",
        "type": "tilelayer",                          <<<<<
        "scale": 250000,
        "minzoom": 0,
        "maxzoom": 15,
        "bounds": [
            -153,
            -19,
            -138,
            -7
        ],
        "format": "mvt",                              <<<<<<<
        "url": "/signalk/pmtiles/FP.pmtiles",         <<<<<<<
        "layers": [
            "boundaries",
            "buildings",
            "earth",
            "landcover",
            "landuse",
            "places",
            "pois",
            "roads",
            "water"
        ]
    }
}

*/

// export const basemaps = {
export const basemaps: Record<string, Basemap> = $state({
  street: {
    id: "street",
    label: "Street Map",
    type: "carto-vector",
    online: true,
  },
  satellite: {
    id: "satellite",
    label: "Satellite",
    type: "raster",
    online: true,
  },
  offline: {
    id: "offline",
    label: "Offline",
    type: "offline",
    online: false,
  },
  empty: {
    id: "empty",
    label: "Empty",
    type: "empty",
    online: false,
  },
});

// add pmtiles entries into basemaps
export async function initBasemaps() {
  console.log(">>> ENTER initBasemaps");
  try {
    const charts = await getCharts();
    console.log({ charts });
    for (const chart of Object.values(charts)) {
      console.log({ chart });
      {
        // "identifier": "south-pacific-pmtiles",
        // "name": "south-pacific",
        // "description": "",
        // "type": "tilelayer",
        // "scale": 250000,
        // "minzoom": 0,
        // "maxzoom": 15,
        // "bounds": [
        //     -176.5,
        //     -23.5,
        //     -157.5,
        //     -9
        // ],
        // "format": "mvt",
        // "url": "/signalk/pmtiles/south-pacific.pmtiles",
        // "layers": [
        //     "boundaries",
        //     "buildings",
        //     "earth",
        //     "landcover",
        //     "landuse",
        //     "places",
        //     "pois",
        //     "roads",
        //     "water"
        // ]
      }
      if (
        // @ts-expect-error - chart.format/url reflect v2 API not yet in type defs
        chart.format === "mvt" &&
        // @ts-expect-error - chart.format/url reflect v2 API not yet in type defs
        chart.url.toLowerCase().endsWith(".pmtiles")
      ) {
        basemaps[chart.identifier] = {
          id: chart.identifier,
          label: chart.name,
          type: "signalk-protomaps-pmtiles",
          online: false,
        };
      }
    }
  } catch (e) {
    console.error(e);
    throw e;
  }
  console.log(">>> EXIT initBasemaps");
}
