import { type Chart } from "../types";
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
*/

// export const basemaps = {
export const basemaps: Record<string, Chart> = $state({
  "builtin:street": {
    identifier: "builtin:street",
    name: "Street Map",
    type: "mapstyleJSON",
    format: "pbf",
    styleLight: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    styleDark:
      "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    online: true,
  },
  "builtin:satellite": {
    identifier: "builtin:satellite",
    name: "Satellite",
    type: "tilelayer",
    format: "jpg",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    online: true,
  },
  "builtin:offline": {
    identifier: "builtin:offline",
    name: "Offline",
    type: "mapstyleJSON",
    format: "pbf",
    online: false,
  },
  "builtin:empty": {
    identifier: "builtin:empty",
    name: "Empty",
    online: false,
  },
});

// add sk charts to basemaps
export async function initBasemaps() {
  console.log(">>> ENTER initBasemaps");
  try {
    const charts = await getCharts();
    console.log({ charts });
    for (const chart of Object.values(charts)) {
      basemaps[chart.identifier] = {
        identifier: chart.identifier,
        name: chart.name,
        format: chart.format,
        type: chart.type,
        url: chart.url,
        style: chart?.style,
        // FIXME might need to set this intelligently:
        online: false,
      };
      // }
    }
  } catch (e) {
    console.error(e);
    throw e;
  }
  console.log(">>> EXIT initBasemaps");
}
