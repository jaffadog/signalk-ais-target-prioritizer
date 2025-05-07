"use strict";

// FIXME: need to look at better default data - remove impossible values like 450. remove range parameters that are not used.
// FIXME: need map rotation option to toggle between north-up and cog-up
// FIXME need to investigate node OOM issues - leak?

const DEFAULT_MAP_ZOOM = 14; // 14 gives us 2+ NM
const METERS_PER_NM = 1852;
const KNOTS_PER_M_PER_S = 1.94384;
const COURSE_PROJECTION_MINUTES = 10;
const LOST_TARGET_WARNING_AGE = 10 * 60; // lost target warning in seconds - 10 minutes
const AGE_OUT_OLD_TARGETS = true;
const TARGET_MAX_AGE = 30 * 60; // max age in seconds - 30 minutes
const SHOW_ALARMS_INTERVAL = 60 * 1000; // show alarms every 60 seconds
const PLUGIN_ID = 'signalk-ais-target-prioritizer';

var noSleep = new NoSleep();
var collisionProfiles;
var selfMmsi;
var selfPosition;
var offsetLatitude = 0;
var offsetLongitude = 0;
var disableMoveend = false;
var disableMapPanTo = false;
var response;
var targets = new Map();
var boatMarkers = new Map();
var boatProjectedCourseLines = new Map();
var rangeRings = L.layerGroup();
var selectedVesselMmsi;
var blueBoxIcon;
var blueCircle1;
var blueCircle2;
var tooltipList;
var validTargetCount;
var filteredTargetCount;
var alarmTargetCount;
var lastAlarmTime;

var blueLayerGroup = L.layerGroup();
//blueLayerGroup.className = 'blueStuff';

const bsModalError = new bootstrap.Modal('#modalError');
const bsModalAlarm = new bootstrap.Modal('#modalAlarm');
const bsModalClosebyBoats = new bootstrap.Modal('#modalClosebyBoats');
const bsModalSelectedVesselProperties = new bootstrap.Modal('#modalSelectedVesselProperties');
const bsOffcanvasSettings = new bootstrap.Offcanvas('#offcanvasSettings');
const bsOffcanvasEditProfiles = new bootstrap.Offcanvas('#offcanvasEditProfiles');
const bsOffcanvasTargetList = new bootstrap.Offcanvas('#offcanvasTargetList');

response = await fetch("./assets/js/defaultCollisionProfiles.json", {
    credentials: 'include'
});
if (response.status == 401) {
    location.href = "/admin/#/login";
}
if (!response.ok) {
    console.error(`Response status: ${response.status} from ${response.url}`);
    throw new Error(`Response status: ${response.status} from ${response.url}`);
}
const defaultCollisionProfiles = await response.json();

// load collisionProfiles
// /plugins/${PLUGIN_ID}/getCollisionProfiles
response = await fetch(`/plugins/${PLUGIN_ID}/getCollisionProfiles`, {
    credentials: 'include'
});
if (response.status == 401) {
    location.href = "/admin/#/login";
}
if (!response.ok) {
    console.error(`Response status: ${response.status} from ${response.url}`);
    throw new Error(`Response status: ${response.status} from ${response.url}`);
}
var text = await response.text();
if (!text) {
    showError("The SignalK AIS Target Prioritizer plugin is not running. Please check the plugin status.");
    throw new Error("Error: SignalK AIS Target Prioritizer plugin is not running.");
}
collisionProfiles = JSON.parse(text);
console.log('collisionProfiles', collisionProfiles);
if (!collisionProfiles.current) {
    console.log('using default collisionProfiles');
    collisionProfiles = structuredClone(defaultCollisionProfiles);
    saveCollisionProfiles();
}

document.getElementById("activeProfile").value = collisionProfiles.current;
document.getElementById("checkNoSleep").checked = (localStorage.getItem("checkNoSleep") == "true");
configureNoSleep();

response = await fetch('/signalk/v1/api/resources/charts', { credentials: 'include' });
if (response.status == 401) {
    location.href = "/admin/#/login";
}
if (!response.ok) {
    console.error(`Response status: ${response.status} from ${response.url}`);
    throw new Error(`Response status: ${response.status} from ${response.url}`);
}
var charts = await response.json();

response = await fetch('/signalk/v1/api/vessels/self', { credentials: 'include' });
if (response.status == 401) {
    location.href = "/admin/#/login";
}
if (!response.ok) {
    console.error(`Response status: ${response.status} from ${response.url}`);
    throw new Error(`Response status: ${response.status} from ${response.url}`);
}
var data = await response.json();
selfMmsi = data.mmsi;

const map = L.map('map', {
    zoom: DEFAULT_MAP_ZOOM,
    minZoom: 1, //9,
    maxZoom: 18,
});

var biCursorFill = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-cursor-fill" viewBox="0 0 16 16">
  <path d="M14.082 2.182a.5.5 0 0 1 .103.557L8.528 15.467a.5.5 0 0 1-.917-.007L5.57 10.694.803 8.652a.5.5 0 0 1-.006-.916l12.728-5.657a.5.5 0 0 1 .556.103z"/>
</svg>`;

L.easyButton(biCursorFill, function (btn, map) {
    if (selfPosition) {
        map.panTo([selfPosition.latitude, selfPosition.longitude]);
        offsetLatitude = 0;
        offsetLongitude = 0;
    }
}).addTo(map);

let PAINT_RULES = [
    {
        dataLayer: "earth",
        symbolizer: new protomapsL.PolygonSymbolizer({
            fill: "lightgray",
        }),
        // var(--bs-secondary-bg) lightgray
    },
    {
        dataLayer: "water",
        symbolizer: new protomapsL.LineSymbolizer({
            color: "cadetblue",
            opacity: 0.3
        }),
    },
    {
        dataLayer: "roads",
        symbolizer: new protomapsL.LineSymbolizer({
            color: "gray",
            opacity: 0.4
        }),
    },
    {
        dataLayer: "places",
        symbolizer: new protomapsL.PolygonSymbolizer({
            fill: "orange"
        }),
    },

];

// FIXME add basic labels - land masses, islands, countries, towns
let LABEL_RULES = []; // ignore for now LabelSymbolizers 

// Grab hold of the light theme configuration
//let light_theme = protomapsL.light;
// Create the actual paint and label rules. These decide how to render the map.
//let my_paint_rules = protomapsL.paintRules(light_theme, "");
//let my_label_rules = protomapsL.labelRules(light_theme, "");

// http://localhost:3000/signalk/v1/api/resources/charts
// http://localhost:3000/pmtiles/FP.pmtiles
// var layer = protomapsL.leafletLayer({url:'FILE.pmtiles OR ENDPOINT/{z}/{x}/{y}.mvt',flavor:"light",lang:"en"})

// url: 'https://demo-bucket.protomaps.com/v4.pmtiles',
// url: 'http://localhost:8080/FP/{z}/{x}/{y}.mvt',

// FIXME look at protomaps basemap project - which is apparently now a dependency for flavor/styles

// var layer = protomapsL.leafletLayer({
//     url: 'http://localhost:8080/FP/{z}/{x}/{y}.mvt',
//     paintRules: PAINT_RULES,
//     labelRules: LABEL_RULES,
//     flavor: "light",
//     lang: "en"
// });
// layer.addTo(map)

var osm = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
});

var openTopoMap = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
});

var baseMaps = {
    "Empty": L.tileLayer(''),
    "OpenStreetMap": osm,
    "OpenTopoMap": openTopoMap
};

// console.log(basemaps);
// console.log(basemaps.namedFlavor("light"));
// let light_theme = protomapsL.light;
// console.log(light_theme);
// console.log(protomapsL.paintRules(basemaps.namedFlavor("light")));
// console.log(protomapsL.labelRules(basemaps.namedFlavor("light")));
//console.log(protomapsL.paintRules(light_theme));
//console.log(protomapsL.paintRules(light_theme, ""));
//protomapsL.paintRules(light_theme, "light");
// protomapsL.paintRules();

for (let key in charts) {
    var chart = charts[key];
    var layer;
    console.log(chart.name, chart.tilemapUrl, chart.format, chart.maxzoom);
    if (chart.format == "mvt") {

        // layer = protomapsL.leafletLayer({
        //     url: chart.tilemapUrl,
        //     flavor: 'light', 
        //     lang: 'en'
        // });

        layer = protomapsL.leafletLayer({
            url: chart.tilemapUrl,
            paintRules: PAINT_RULES,
            labelRules: LABEL_RULES,
            //  flavor: "dark",
            //  lang: "en"
            // maxNativeZoom: 6, this produces very blury results at z>=6
        });

    } else {
        layer = L.tileLayer(chart.tilemapUrl, {
            maxZoom: chart.maxzoom,
            attribution: ''
        });
    }
    baseMaps[chart.name] = layer;
}

var OpenSeaMap = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: ''
});

var overlayMaps = {
    "OpenSeaMap": OpenSeaMap
};

var layerControl = L.control.layers(baseMaps, overlayMaps, { position: 'topleft' }).addTo(map);

var layerControlLayersToggleEl = document.getElementsByClassName("leaflet-control-layers-toggle")[0];

var biLayersFill = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-layers-fill" viewBox="0 0 16 16">
  <path d="M7.765 1.559a.5.5 0 0 1 .47 0l7.5 4a.5.5 0 0 1 0 .882l-7.5 4a.5.5 0 0 1-.47 0l-7.5-4a.5.5 0 0 1 0-.882z"/>
  <path d="m2.125 8.567-1.86.992a.5.5 0 0 0 0 .882l7.5 4a.5.5 0 0 0 .47 0l7.5-4a.5.5 0 0 0 0-.882l-1.86-.992-5.17 2.756a1.5 1.5 0 0 1-1.41 0z"/>
</svg>`;

layerControlLayersToggleEl.innerHTML = biLayersFill;

var biListOl = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M5 11.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5"/>
  <path d="M1.713 11.865v-.474H2c.217 0 .363-.137.363-.317 0-.185-.158-.31-.361-.31-.223 0-.367.152-.373.31h-.59c.016-.467.373-.787.986-.787.588-.002.954.291.957.703a.595.595 0 0 1-.492.594v.033a.615.615 0 0 1 .569.631c.003.533-.502.8-1.051.8-.656 0-1-.37-1.008-.794h.582c.008.178.186.306.422.309.254 0 .424-.145.422-.35-.002-.195-.155-.348-.414-.348h-.3zm-.004-4.699h-.604v-.035c0-.408.295-.844.958-.844.583 0 .96.326.96.756 0 .389-.257.617-.476.848l-.537.572v.03h1.054V9H1.143v-.395l.957-.99c.138-.142.293-.304.293-.508 0-.18-.147-.32-.342-.32a.33.33 0 0 0-.342.338zM2.564 5h-.635V2.924h-.031l-.598.42v-.567l.629-.443h.635z"/>
</svg>`;

L.easyButton(biListOl, function (btn, map) {
    bsOffcanvasTargetList.show();
}).addTo(map);

var biGearFill = `
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-gear-fill" viewBox="0 0 16 16">
  <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z"/>
</svg>`;

// '<span data-bs-toggle="offcanvas" href="#offcanvasSettings">Settings</span>'
L.easyButton(biGearFill, function (btn, map) {
    bsOffcanvasSettings.show();
}).addTo(map);

// reload last used baselayer/overlay
var baselayer = localStorage.getItem("baselayer");
var overlay = localStorage.getItem("overlay");
if (!baseMaps[baselayer]) {
    baselayer = "OpenStreetMap";
}
baseMaps[baselayer].addTo(map);
if (overlay && overlayMaps[overlay]) {
    overlayMaps[overlay].addTo(map);
}

blueBoxIcon = L.marker([], {
    icon: getBlueBoxIcon(),
});

blueCircle1 = L.circleMarker([], {
    radius: 6,
    color: 'blue',
    opacity: 1.0,
    fillOpacity: 1.0,
    interactive: false,
    className: 'blueStuff'
});

blueCircle2 = L.circleMarker([], {
    radius: 6,
    color: 'blue',
    opacity: 1.0,
    fillOpacity: 1.0,
    interactive: false,
    className: 'blueStuff'
});

// we're adding all the blue stuff to a layer group so that we can raise the z index of the whole group
// and turn visibility on/off in one shot
blueLayerGroup.addLayer(blueBoxIcon);
blueLayerGroup.addLayer(blueCircle1);
blueLayerGroup.addLayer(blueCircle2);

// setup vessel label collision avoidance
var hideLabel = function (label) { label.labelObject.style.opacity = 0; };
var showLabel = function (label) { label.labelObject.style.opacity = 1; };
var labelToCollisionController = new labelgun.default(hideLabel, showLabel);

// *********************************************************************************************************
// ** REGISTER EVENT LISTENERS

map.on('baselayerchange', handleBaseLayerChange);
map.on('overlayadd', handleOverlayAdd);
map.on('overlayremove', handleOverlayRemove);

document.getElementById("tableOfTargetsBody").addEventListener("click", handleTableOfTargetsBodyClick);

document.getElementById("listOfClosebyBoats").addEventListener("click", handleListOfClosebyBoatsClick);

document.getElementById("activeProfile").addEventListener("input", (ev) => {
    collisionProfiles.current = ev.target.value;
    saveCollisionProfiles();
});

document.getElementById("editProfilesButton").addEventListener("click", () => {
    bsOffcanvasSettings.hide();
    bsOffcanvasEditProfiles.show();
});

document.getElementById("checkNoSleep").addEventListener("change", (event) => {
    configureNoSleep();
});

document.getElementById("checkDarkMode").addEventListener("change", applyColorMode);

document.getElementById("checkFullScreen").addEventListener("change", (event) => {
    if (checkFullScreen.checked) {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else if (!document.webkitFullscreenElement) {
            document.documentElement.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
});

document.addEventListener("fullscreenchange", fullscreenchangeHandler);

//document.addEventListener("webkitfullscreenchange", fullscreenchangeHandler);

document.getElementById("profileToEdit").addEventListener("input", (ev) => {
    setupProfileEditView(ev.target.value);
});

document.getElementById("buttonRestoreDefaults").addEventListener("click", () => {
    collisionProfiles = structuredClone(defaultCollisionProfiles);
    setupProfileEditView(profileToEdit.value);
    saveCollisionProfiles();
});

document.getElementById("buttonMuteAllAlarms").addEventListener("click", muteAllAlarms);

// save config when offcanvasEditProfiles is closed 
offcanvasEditProfiles.addEventListener('hide.bs.offcanvas', () => {
    saveCollisionProfiles();
})

// show modalSelectedVesselProperties when modalClosebyBoats is closed 
modalClosebyBoats.addEventListener('hidden.bs.modal', () => {
    var boatMarker = boatMarkers.get(selectedVesselMmsi);
    positionModalWindow(boatMarker.getLatLng(), "modalSelectedVesselProperties");
    updateSelectedVesselProperties(targets.get(selectedVesselMmsi));
    bsModalSelectedVesselProperties.show();
})

configWarningCpaRange.addEventListener("input", processDistanceRangeControl);
configWarningTcpaRange.addEventListener("input", processTcpaRangeControl);
configWarningSogRange.addEventListener("input", processSpeedRangeControl);

configAlarmCpaRange.addEventListener("input", processDistanceRangeControl);
configAlarmTcpaRange.addEventListener("input", processTcpaRangeControl);
configAlarmSogRange.addEventListener("input", processSpeedRangeControl);

configGuardRangeRange.addEventListener("input", processDistanceRangeControl);
configGuardSogRange.addEventListener("input", processSpeedRangeControl);

map.on('movestart', function (e) {
    disableMapPanTo = true;
});

map.on('moveend', function (e) {
    disableMapPanTo = false;

    if (disableMoveend) {
        return;
    }

    // if the map was panned, store the offsets from selfVessel
    if (selfPosition) {
        var mapCenter = map.getCenter();
        offsetLatitude = mapCenter.lat - selfPosition.latitude;
        offsetLongitude = mapCenter.lng - selfPosition.longitude;
    }

});

map.on("zoomend", function (e) {
    drawRangeRings();
    labelToCollisionController.update();
});

map.on('click', handleMapClick);

// ** END REGISTER EVENT LISTENERS
// *********************************************************************************************************

function fullscreenchangeHandler() {
    if (document.fullscreenElement) {
        checkFullScreen.checked = true;
    } else {
        checkFullScreen.checked = false;
    }
}

function applyColorMode() {
    if (checkDarkMode.checked) {
        document.documentElement.setAttribute('data-bs-theme', "dark");
        var elements = document.querySelectorAll('.leaflet-layer');
        for (var i = 0; i < elements.length; i++) {
            elements[i].style.filter = "invert(1) hue-rotate(180deg) brightness(0.8) contrast(1.2)";
        }
    } else {
        document.documentElement.setAttribute('data-bs-theme', "light");
        var elements = document.querySelectorAll('.leaflet-layer');
        for (var i = 0; i < elements.length; i++) {
            elements[i].style.filter = "none";
        }
    }
}

function configureNoSleep() {
    if (checkNoSleep.checked) {
        noSleep.enable();
    } else {
        noSleep.disable();
    }
    localStorage.setItem("checkNoSleep", checkNoSleep.checked);
}

function handleBaseLayerChange(event) {
    localStorage.setItem("baselayer", event.name);
    applyColorMode();
}

function handleOverlayAdd(event) {
    localStorage.setItem("overlay", event.name);
    applyColorMode();
}

function handleOverlayRemove(event) {
    localStorage.removeItem("overlay");
}

// initialize profile edit screen on startup
setupProfileEditView('anchor');

updateAllVessels();
var updateInterval = setInterval(updateAllVessels, 1000);

function setupProfileEditView(profile) {
    configWarningCpaRange.value = distanceToTick(collisionProfiles[profile].warning.cpa);
    configWarningTcpaRange.value = timeToTick(collisionProfiles[profile].warning.tcpa / 60);
    configWarningSogRange.value = speedToTick(collisionProfiles[profile].warning.speed);

    configAlarmCpaRange.value = distanceToTick(collisionProfiles[profile].danger.cpa);
    configAlarmTcpaRange.value = timeToTick(collisionProfiles[profile].danger.tcpa / 60);
    configAlarmSogRange.value = speedToTick(collisionProfiles[profile].danger.speed);

    configGuardRangeRange.value = distanceToTick(collisionProfiles[profile].guard.range);
    configGuardSogRange.value = speedToTick(collisionProfiles[profile].guard.speed);

    var inputEvent = new Event('input');

    configWarningCpaRange.dispatchEvent(inputEvent);
    configWarningTcpaRange.dispatchEvent(inputEvent);
    configWarningSogRange.dispatchEvent(inputEvent);

    configAlarmCpaRange.dispatchEvent(inputEvent);
    configAlarmTcpaRange.dispatchEvent(inputEvent);
    configAlarmSogRange.dispatchEvent(inputEvent);

    configGuardRangeRange.dispatchEvent(inputEvent);
    configGuardSogRange.dispatchEvent(inputEvent);
}

async function saveCollisionProfiles() {
    console.log('*** save collisionProfiles to server', collisionProfiles);

    // /plugins/${PLUGIN_ID}/setCollisionProfiles
    response = await fetch(`/plugins/${PLUGIN_ID}/setCollisionProfiles`, {
        credentials: 'include',
        method: 'PUT',
        body: JSON.stringify(collisionProfiles),
        headers: {
            "Content-Type": "application/json",
        }
    });
    if (response.status == 401) {
        location.href = "/admin/#/login";
    }
    if (!response.ok) {
        throw new Error(`Error saving collisionProfiles. Response status: ${response.status} from ${response.url}`);
    }
    console.log('successfully saved config', collisionProfiles);
}

function showError(message) {
    document.getElementById("errorText").textContent = message;
    bsModalError.show();
}

function handleTableOfTargetsBodyClick(ev) {
    bsOffcanvasTargetList.hide();
    var mmsi = ev.target.parentNode.dataset.mmsi;
    var boatMarker = boatMarkers.get(mmsi);
    selectBoatMarker(boatMarker);
    // FIXME: maybe use blueLayerGroup here. looks like L.featureGroup would be what we need.
    map.fitBounds([
        boatMarker.getLatLng(),
        boatMarkers.get(selfMmsi).getLatLng()
    ]);
    positionModalWindow(boatMarker.getLatLng(), "modalSelectedVesselProperties");
    updateSelectedVesselProperties(targets.get(boatMarker.mmsi));
    bsModalSelectedVesselProperties.show();
}

function distanceToTick(distance) {
    return distance <= 1 ? Math.floor(distance * 10) : Math.floor(distance + 9);
}

function tickToDistance(tick) {
    return tick <= 10 ? tick / 10 : tick - 9;
}

function processDistanceRangeControl(ev) {
    var tick = ev.target.value;
    var dataset = ev.target.dataset;
    var valueStorageElement = document.getElementById(dataset.target);
    // 0,0.1,0.2 ... 1.0,2,3,4,5,6,7,8,9,10
    // 20 values
    // tick                     distance
    // 0 - 10   correspond to   0 - 1.0
    // 11 - 19  correspond to   2 - 10
    var distance = tickToDistance(tick);
    var unitsSpan = document.getElementById(dataset.target + 'Units');

    if (distance == 0) {
        unitsSpan.hidden = true;
    } else {
        unitsSpan.hidden = false;
    }

    valueStorageElement.textContent = distance || 'OFF';
    collisionProfiles[profileToEdit.value][dataset.alarmType][dataset.alarmCriteria] = distance;
}

function timeToTick(time) {
    if (time <= 5) {
        return Math.floor(time);
    } else if (time <= 20) {
        return Math.floor((time - 10) / 5 + 6);
    } else {
        return Math.floor((time - 30) / 10 + 9);
    }
}

function tickToTime(tick) {
    if (tick <= 5) {
        return tick;
    } else if (tick <= 8) {
        return (tick - 6) * 5 + 10;
    } else {
        return (tick - 9) * 10 + 30;
    }
}

function processTcpaRangeControl(ev) {
    var tick = ev.target.value;
    var dataset = ev.target.dataset;
    var valueStorageElement = document.getElementById(dataset.target);
    // 1,2,3,4,  5,  10,15,  20,  30,40,50,60
    // 12 values
    // tick                     time (min)
    // 1 - 5    correspond to   1 - 5
    // 6 - 8    correspond to   10 - 20
    // 9 - 12   correspond to   30 - 60
    var time = tickToTime(tick)
    valueStorageElement.textContent = time;
    collisionProfiles[profileToEdit.value][dataset.alarmType][dataset.alarmCriteria] = time * 60;
}

function speedToTick(speed) {
    if (speed <= 0.5) {
        return Math.floor(speed * 10);
    } else if (speed <= 3) {
        return Math.floor(speed + 5);
    } else {
        return Math.floor(speed / 5 + 8);
    }
}

function tickToSpeed(tick) {
    if (tick <= 5) {
        return tick / 10;
    } else if (tick <= 8) {
        return tick - 5;
    } else {
        return (tick - 8) * 5;
    }
}

function processSpeedRangeControl(ev) {
    var tick = ev.target.value;
    var dataset = ev.target.dataset;
    var valueStorageElement = document.getElementById(dataset.target);
    // 0,0.1,0,2 ... 0.5,1,2,3,5,10
    // 11 values
    // tick                     speed (knots)
    // 0 - 5    correspond to   0.0 - 0.5
    // 6        correspond to   1
    // 7        correspond to   2
    // 8        correspond to   3
    // 9        correspond to   5
    // 10       correspond to   10
    var speed = tickToSpeed(tick);
    valueStorageElement.textContent = speed;
    collisionProfiles[profileToEdit.value][dataset.alarmType][dataset.alarmCriteria] = speed;
}

function drawRangeRings() {
    if (!selfPosition) {
        return;
    }
    rangeRings.removeFrom(map)
    rangeRings.clearLayers();

    var mapHeightInNauticalMiles = 60 * Math.abs(map.getBounds().getNorth() - map.getBounds().getSouth());

    // aiming for 3 visible range rings
    var step = mapHeightInNauticalMiles / 6;

    if (step < 0.125) {
        step = 0.125;
    } else if (step < 0.25) {
        step = 0.25;
    } else if (step < 0.5) {
        step = 0.5;
    } else if (step < 1) {
        step = 1;
    } else {
        step = 2 * Math.round(step / 2);
    }

    for (var i = 1; i <= 6; i++) {
        rangeRings.addLayer(
            L.circle(
                [selfPosition.latitude, selfPosition.longitude],
                {
                    radius: i * step * METERS_PER_NM,
                    color: 'gray',
                    weight: 1,
                    opacity: 0.7,
                    fill: false,
                    interactive: false,
                    zIndexOffset: -999
                }
            )
        );

        rangeRings.addLayer(
            L.tooltip(
                [selfPosition.latitude + (i * step) / 60, selfPosition.longitude],
                {
                    content: i * step + ' NM',
                    permanent: true,
                    direction: 'center',
                    opacity: 0.7,
                    offset: [0, 15],
                    className: 'map-labels',
                    interactive: false,
                    zIndexOffset: -999
                }
            )
        );

        rangeRings.addLayer(
            L.tooltip(
                [selfPosition.latitude - (i * step) / 60, selfPosition.longitude],
                {
                    content: i * step + ' NM',
                    permanent: true,
                    direction: 'center',
                    opacity: 0.7,
                    offset: [0, -15],
                    className: 'map-labels',
                    interactive: false,
                    zIndexOffset: -999
                }
            )
        );

    }

    rangeRings.addTo(map)
}

async function updateAllVessels() {
    try {
        var startTime = new Date();

        // FIXME switch to the streaming api? does it send atons?

        response = await fetch('/signalk/v1/api/vessels', { credentials: 'include' });
        if (response.status == 401) {
            location.href = "/admin/#/login";
        }
        if (!response.ok) {
            throw new Error(`Response status: ${response.status} from ${response.url}`);
        }
        var vessels = await response.json();
        //console.log(vessels);

        // we expect 404s from this when there are no atons:
        response = await fetch('/signalk/v1/api/atons', { credentials: 'include' });
        if (response.status == 401) {
            location.href = "/admin/#/login";
        }
        // we expect 404 errors querying atons - as there may not be any - and this is how signalk responds
        if (response.ok) {
            var atons = await response.json();
            vessels = Object.assign(vessels, atons);
        }

        validTargetCount = 0;
        filteredTargetCount = 0;
        alarmTargetCount = 0;

        updateAllVesselDataModel(vessels);
        updateAllVesselDerivedData();
        updateAllVesselUI();

        if (AGE_OUT_OLD_TARGETS) {
            ageOutOldTargets();
        }

        if (alarmTargetCount > 0 && (lastAlarmTime == null || Date.now() > lastAlarmTime + SHOW_ALARMS_INTERVAL)) {
            lastAlarmTime = Date.now();
            showAlarms();
        }

        // display performance metrics
        let layers = 0;
        map.eachLayer(function () { layers++ });
        var updateTimeInMillisecs = (new Date()).getTime() - startTime.getTime();
        //console.log(updateTimeInMillisecs + ' msecs');
        // FIXME this does not work in ios: performance.memory.usedJSHeapSize
        // map.attributionControl.setPrefix(`${updateTimeInMillisecs} msecs / ${layers} layers / ${(performance.memory.usedJSHeapSize / Math.pow(1000, 2)).toFixed(1)} MB`);
        map.attributionControl.setPrefix(`${updateTimeInMillisecs} msecs / ${layers} layers`);
    } catch (error) {
        console.error('Error in updateAllVessels:', error);
        showError(`Encountered an error while updating vessel data: ${error}`);
    }
}

function showAlarms() {
    var targetsWithAlarms = [];
    targets.forEach((target, mmsi) => {
        //console.log(target.mmsi, target.name, target.alarmState, target.alarmMuted);
        if (target.isValid && target.alarmState && !target.alarmMuted) {
            targetsWithAlarms.push(target);
        }
    });

    if (targetsWithAlarms.length > 0) {
        document.getElementById("alarmDiv").innerHTML = " ";
        targetsWithAlarms.forEach((target) => {
            document.getElementById("alarmDiv").innerHTML += `<div class="alert alert-danger" role="alert">${target.name} - ${target.alarmType.toUpperCase()}</div>`;
        });
        bsModalAlarm.show();
        new Audio('./assets/audio/horn.mp3').play();
    }
}

async function muteAllAlarms() {
    console.log('muting all alarms');
    targets.forEach((target, mmsi) => {
        if (target.alarmState) {
            target.alarmMuted = true;
        }
    });

    // mute alarms in the plugin as well
    // /plugins/${PLUGIN_ID}/muteAllAlarms
    response = await fetch(`/plugins/${PLUGIN_ID}/muteAllAlarms`, {
        credentials: 'include'
    });
    if (response.status == 401) {
        location.href = "/admin/#/login";
    }
    if (!response.ok) {
        console.error(`Response status: ${response.status} from ${response.url}`);
        throw new Error(`Response status: ${response.status} from ${response.url}`);
    }
}

function updateAllVesselDataModel(vessels) {
    // update our vessel first - then other vessels
    // vesselId looks like: urn:mrn:imo:mmsi:123456789
    var selfVessel = vessels[`urn:mrn:imo:mmsi:${selfMmsi}`];
    if (!selfVessel) {
        console.warn('selfVessel is undefined - skipping updateAllVesselDataModel');
        return;
    }

    // FIXME - override gps to testing with signalk team sample data (netherlands)
    // selfVessel.navigation.position.value = {
    //     latitude: 53.44,
    //     longitude: 4.86 //5.07
    // }

    // FIXME Cannot read properties of undefined (reading 'navigation')
    selfPosition = selfVessel.navigation?.position?.value;
    if (!selfPosition) {
        console.warn('selfPosition is undefined - skipping updateAllVesselDataModel');
        return;
    }

    updateSingleVesselDataModel(selfVessel);

    for (var vesselId in vessels) {
        var vessel = vessels[vesselId];
        //console.log(vessel);

        // excluding selfVessel, which we already did
        if (vessel.mmsi != selfMmsi) {
            updateSingleVesselDataModel(vessel);
        }
    }
}

function updateSingleVesselDataModel(vessel) {
    //get vessel data into an easier to access data model
    // values in their original data types - no text formatting of numeric values here
    var target = targets.get(vessel.mmsi);
    if (!target) {
        target = {};
    }

    target.mmsi = vessel.mmsi;
    target.name = vessel.name || '<' + vessel.mmsi + '>';
    // target.cpa = vessel.navigation?.closestApproach?.value?.distance;
    // target.tcpa = vessel.navigation?.closestApproach?.value?.timeTo;
    // target.range = vessel.navigation?.closestApproach?.value?.range;
    // target.bearing = vessel.navigation?.closestApproach?.value?.bearing;
    target.sog = vessel.navigation?.speedOverGround?.value;
    target.cog = vessel.navigation?.courseOverGroundTrue?.value;
    target.hdg = vessel.navigation?.headingTrue?.value;
    target.rot = vessel.navigation?.rateOfTurn?.value;
    target.callsign = vessel.communication?.callsignVhf || '---';
    target.type = (vessel.design?.aisShipType?.value.name || vessel.atonType?.value.name) ?? '---';
    target.aisClass = vessel.sensors?.ais?.class?.value || 'A';
    target.isVirtual = vessel.virtual?.value;
    target.isOffPosition = vessel.offPosition?.value;
    target.status = vessel.navigation?.state?.value ?? '---';
    target.length = vessel.design?.length?.value.overall;
    target.beam = vessel.design?.beam?.value;
    target.draft = vessel.design?.draft?.current ?? '---';
    target.destination = vessel.navigation?.destination?.commonName?.value ?? '---';
    target.eta = vessel.navigation?.destination?.eta?.value ?? '---';
    target.imo = vessel.registrations?.imo;
    target.latitude = vessel.navigation?.position?.value.latitude;
    target.longitude = vessel.navigation?.position?.value.longitude;
    target.lastSeenDate = new Date(vessel.navigation?.position?.timestamp);
    // target.alarmState = vessel.navigation?.closestApproach?.value?.collisionAlarmState;
    // target.alarmType = vessel.navigation?.closestApproach?.value?.collisionAlarmType;
    // target.order = vessel.navigation?.closestApproach?.value?.collisionRiskRating ?? Number.MAX_VALUE;

    var lastSeen = Math.round((new Date() - target.lastSeenDate) / 1000);

    // dont add targets that have already aged out
    if (lastSeen < TARGET_MAX_AGE) {
        targets.set(target.mmsi, target);
    }
}

function updateAllVesselDerivedData() {
    targets.forEach((target, mmsi) => {
        target.y = target.latitude * 111120;
        target.x = target.longitude * 111120 * Math.cos(toRadians(selfPosition.latitude));
        target.vy = target.sog * Math.cos(target.cog); // cog is in radians
        target.vx = target.sog * Math.sin(target.cog); // cog is in radians

        if (target.mmsi != selfMmsi) {
            calculateRangeAndBearing(target);
            updateCpa(target);
            evaluateAlarms(target);
        }

        // format and derive a few values for consistent use and display later:
        // these values are all strings - without units appended (NM, KN, T, etc)
        var mmsiMid = getMid(target.mmsi);

        var lastSeen = Math.round((new Date() - target.lastSeenDate) / 1000);
        if (lastSeen < 0) {
            lastSeen = 0;
        }

        target.lastSeen = lastSeen;
        target.isLost = lastSeen > LOST_TARGET_WARNING_AGE ? true : false;
        target.mmsiCountryCode = mmsiMidToCountry.get(mmsiMid)?.code;
        target.mmsiCountryName = mmsiMidToCountry.get(mmsiMid)?.name;
        target.cpaFormatted = formatCpa(target.cpa);
        target.tcpaFormatted = formatTcpa(target.tcpa);
        target.rangeFormatted = target.range != null ? (target.range / METERS_PER_NM).toFixed(2) + ' NM' : '---';
        target.bearingFormatted = target.bearing != null ? target.bearing + ' T' : '---';
        target.sogFormatted = target.sog != null ? (target.sog * KNOTS_PER_M_PER_S).toFixed(1) + ' kn' : '---';
        target.cogFormatted = target.cog != null ? (Math.round(toDegrees(target.cog)) + ' T') : '---';
        target.hdgFormatted = target.hdg != null ? (Math.round(toDegrees(target.hdg)) + ' T') : '---';
        target.rotFormatted = Math.round(toDegrees(target.rot)) || '---';
        target.aisClassFormatted = target.aisClass + (target.isVirtual ? ' (virtual)' : '');
        target.sizeFormatted = `${target.length?.toFixed(1) ?? '---'} m x ${target.beam?.toFixed(1) ?? '---'} m`;
        target.imoFormatted = target.imo?.replace(/imo/i, '') || '---';
        target.latitudeFormatted = formatLat(target.latitude);
        target.longitudeFormatted = formatLon(target.longitude);

        if (!target.latitude || !target.longitude || target.lastSeen > TARGET_MAX_AGE
        ) {
            target.isValid = false;
        } else {
            target.isValid = true;
        }
    });
}

function updateSelectedVesselProperties(target) {
    document.getElementById("target.name").textContent = target.name;
    document.getElementById("target.lastSeen").textContent = target.lastSeen;
    document.getElementById("target.cpaFormatted").textContent = target.cpaFormatted;
    document.getElementById("target.tcpaFormatted").textContent = target.tcpaFormatted;
    document.getElementById("target.rangeFormatted").textContent = target.rangeFormatted;
    document.getElementById("target.bearingFormatted").textContent = target.bearingFormatted;
    document.getElementById("target.sogFormatted").textContent = target.sogFormatted;
    document.getElementById("target.cogFormatted").textContent = target.cogFormatted;
    document.getElementById("target.hdgFormatted").textContent = target.hdgFormatted;
    document.getElementById("target.rotFormatted").textContent = target.rotFormatted;
    document.getElementById("target.callsign").textContent = target.callsign;
    document.getElementById("target.mmsi").textContent = target.mmsi;
    document.getElementById("target.mmsiCountryCode").textContent = target.mmsiCountryCode;
    document.getElementById("target.mmsiCountryCode").setAttribute("data-bs-title", target.mmsiCountryName);
    document.getElementById("target.type").textContent = target.type;
    document.getElementById("target.aisClassFormatted").textContent = target.aisClassFormatted;
    document.getElementById("target.status").textContent = target.status;
    document.getElementById("target.sizeFormatted").textContent = target.sizeFormatted;
    document.getElementById("target.draft").textContent = target.draft;
    document.getElementById("target.destination").textContent = target.destination;
    document.getElementById("target.eta").textContent = target.eta;
    document.getElementById("target.imoFormatted").textContent = target.imoFormatted;
    document.getElementById("target.latitudeFormatted").textContent = target.latitudeFormatted;
    document.getElementById("target.longitudeFormatted").textContent = target.longitudeFormatted;
    // navigation.specialManeuver

    activateToolTips();

    var classARows = document.querySelectorAll('.ais-class-a')

    // show/hide class A fields:
    if (target.aisClass == 'A') {
        [...classARows].map(row => row.classList.remove("d-none"));
    } else {
        [...classARows].map(row => row.classList.add("d-none"));
    }

    // show/hide alert:
    var selectedVesselAlert = document.getElementById("selectedVesselAlert");

    // FIXME change from "danger" to "alarm"?
    if (target.alarmState == 'danger') {
        selectedVesselAlert.classList.remove("alert-warning");
        selectedVesselAlert.classList.add("alert-danger");
        selectedVesselAlert.textContent = (target.alarmType + " alarm").toUpperCase();
        selectedVesselAlert.classList.remove("d-none");
    } else if (target.alarmState == 'warning') {
        selectedVesselAlert.classList.remove("alert-danger");
        selectedVesselAlert.classList.add("alert-warning");
        selectedVesselAlert.textContent = (target.alarmType + " warning").toUpperCase();
        selectedVesselAlert.classList.remove("d-none");
    } else {
        selectedVesselAlert.classList.add("d-none");
    }
}

function updateAllVesselUI() {
    // keep map centered on selfVessel as it moves
    // accomodates offsets if the user has panned the map
    if (selfPosition) {
        // we cant pan the map in code if the user is already panning the map by mouse
        if (!disableMapPanTo) {
            try {
                disableMoveend = true;
                map.panTo([
                    selfPosition.latitude + offsetLatitude,
                    selfPosition.longitude + offsetLongitude
                ], {
                    animate: false,
                });
            }
            finally {
                disableMoveend = false;
            }
        }

        // keep the range rings centered on selfVessel - even if we didnt pan (above)
        drawRangeRings();
    }

    //deactivateToolTips();

    targets.forEach((target, mmsi) => {
        //console.log(target);
        updateSingleVesselUI(target);

        // update data shown in modal properties screen
        if (target.mmsi == selectedVesselMmsi) {
            updateSelectedVesselProperties(target);
        }
    });

    labelToCollisionController.update();

    updateTableOfTargets();

    // update displayed target counts
    totalTargetCountUI.textContent = validTargetCount || 0;
    filteredTargetCountUI.textContent = filteredTargetCount || 0;
    alarmTargetCountUI.textContent = alarmTargetCount || 0;

    //activateToolTips();
}

function deactivateToolTips() {
    if (tooltipList) {
        tooltipList.forEach((tooltip) => { tooltip.dispose() });
    }
}

function activateToolTips() {
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
}

function updateTableOfTargets() {
    var targetsArray = Array.from(targets.values());
    targetsArray.sort(function (a, b) {
        return a.order - b.order
    });

    var tableBody = '';

    // FIXME add target icons to table: sail, pleasure, ship, tug, fishing, sart, aton
    // https://www.flaticon.com/search?word=ship

    var rowCount = 0;

    for (var target of targetsArray) {
        if (target.mmsi != selfMmsi && target.isValid) {
            tableBody += `
                <tr class="${target.alarmState == 'danger' ? 'table-danger' : target.alarmState == 'warning' ? 'table-warning' : ''}" data-mmsi="${target.mmsi}">
                <th scope="row">${target.name}</th>
                <td>${target.bearingFormatted}</td>
                <td>${target.rangeFormatted}</td>
                <td>${target.sogFormatted}</td>
                <td>${target.cpa ? target.cpaFormatted : ''}</td>
                <td>${target.cpa ? target.tcpaFormatted : ''}</td>
                </tr>`;
            rowCount++;
            // <td>${target.order}</td>
        }
    }

    document.getElementById("tableOfTargetsBody").innerHTML = tableBody;
    document.getElementById("numberOfAisTargets").textContent = rowCount;
}

function updateSingleVesselUI(target) {
    // dont update (and dont add back in) old targets
    if (!target.isValid) {
        return;
    }

    var boatMarker = boatMarkers.get(target.mmsi);
    var boatProjectedCourseLine = boatProjectedCourseLines.get(target.mmsi);

    if (!boatMarker) {
        var icon = getTargetIcon(
            target,
            false,
            'gray'
        );

        boatMarker = L.marker([0, 0], { icon: icon }).addTo(map);
        boatMarkers.set(target.mmsi, boatMarker);

        boatMarker.bindTooltip('', {
            permanent: true,
            direction: 'right',
            opacity: 0.7,
            offset: [25, 10],
            className: 'map-labels',
            interactive: false,
            zIndexOffset: -999
        });

        if (target.mmsi != selfMmsi) {
            boatMarker.on('click', boatClicked);
        }

        boatProjectedCourseLine = L.polyline([[]], {
            color: 'gray',
            opacity: 0.7,
            interactive: false,
            dashArray: '20 10',
            zIndexOffset: -999
        }).addTo(map);
        boatProjectedCourseLines.set(target.mmsi, boatProjectedCourseLine);
    }

    boatMarker.setLatLng([target.latitude, target.longitude]);

    var vesselIconColor;
    var vesselIconIsLarge;

    if (target.mmsi == selectedVesselMmsi) {
        vesselIconColor = 'blue';
        vesselIconIsLarge = true;
    } else if (target.alarmState == 'danger') {
        vesselIconColor = 'red';
        vesselIconIsLarge = true;
    } else if (target.alarmState == 'warning') {
        vesselIconColor = 'orange';
        vesselIconIsLarge = true;
    } else {
        vesselIconColor = 'gray';
        vesselIconIsLarge = false;
    }

    boatMarker.setIcon(getTargetIcon(
        target,
        vesselIconIsLarge,
        vesselIconColor
    ));

    // move the blue box with the selected boat over time
    if (target.mmsi == selectedVesselMmsi && blueBoxIcon) {
        blueBoxIcon.setLatLng([target.latitude, target.longitude]);
    }

    // store the whole vessel data model on the boat marker
    boatMarker.mmsi = target.mmsi;

    // FIXME add aton data for popup: isOffposition? or do the yellow box?

    if (target.mmsi != selfMmsi) {
        // update counts
        validTargetCount++;
        if (target.alarmState) {
            filteredTargetCount++;
            if (target.alarmState == 'danger') {
                alarmTargetCount++;
            }
        }

        // add tooltip text
        var tooltipText = target.name + '<br/>';
        if (target.sog > 0.1) {
            tooltipText += target.sogFormatted + ' ';
        }
        if (target.cpa) {
            tooltipText += target.cpaFormatted + ' ';
        }
        if (target.tcpa > 0 && target.tcpa < 3600) {
            tooltipText += target.tcpaFormatted;
        }
        // ensure the tooltip is always 2 rows - to prevent onscreen jumpiness
        tooltipText += "&nbsp";
        boatMarker.setTooltipContent(tooltipText);
        addLabelToCollisionController(boatMarker, target.mmsi, target.order);
    }

    // if this is our vessel and another vessel has been selected
    // draw a solid blue line to cpa point from our vessel
    // FIXME: the problem with this is that we process our vessel first. so the selected vessel wont be in targets yet: & targets.has(selectedVesselMmsi)
    if (target.mmsi == selfMmsi && selectedVesselMmsi) {
        //console.log(selectedVesselMmsi, targets.get(selectedVesselMmsi));
        var projectedCpaLocation = projectedLocation([
            target.latitude, target.longitude],
            target.cog || 0,
            (target.sog || 0) * (targets.get(selectedVesselMmsi).tcpa || 0));

        boatProjectedCourseLine.setLatLngs([
            [target.latitude, target.longitude],
            projectedCpaLocation
        ]);

        boatProjectedCourseLine.setStyle({
            color: 'blue',
            opacity: 1.0,
            interactive: false,
            dashArray: '',
            className: 'blueStuff'
        });

        blueCircle1.setLatLng(projectedCpaLocation);

        if (!map.hasLayer(blueCircle1)) {
            blueCircle1.addTo(map);
        }
    }

    // if this is the selected vessel
    // draw solid blue line to the cpa point from selected vessel 
    else if (selectedVesselMmsi == target.mmsi) {
        var projectedCpaLocation = projectedLocation([
            target.latitude, target.longitude],
            target.cog || 0,
            (target.sog || 0) * (target.tcpa || 0));

        boatProjectedCourseLine.setLatLngs([
            [target.latitude, target.longitude],
            projectedCpaLocation
        ]);

        boatProjectedCourseLine.setStyle({
            color: 'blue',
            opacity: 1.0,
            interactive: false,
            dashArray: '',
            className: 'blueStuff'
        });

        blueCircle2.setLatLng(projectedCpaLocation);

        if (!map.hasLayer(blueCircle2)) {
            blueCircle2.addTo(map);
        }

    }

    // all other vessels (not our vessel and not a selected vessel)
    // draw dashed gray line to course projected position
    // but do orange or red depending on alarm state
    else {
        boatProjectedCourseLine.setLatLngs([
            [target.latitude, target.longitude],
            projectedLocation([
                target.latitude, target.longitude],
                target.cog || 0,
                (target.sog || 0) * 60 * COURSE_PROJECTION_MINUTES)
        ]);

        boatProjectedCourseLine.setStyle({
            color: vesselIconColor,
            opacity: 0.7,
            interactive: false,
            dashArray: '20 10'
        });
    }
}

// 012345678
// 8MIDXXXXX   Diver’s radio (not used in the U.S. in 2013)
// MIDXXXXXX   Ship
// 0MIDXXXXX   Group of ships; the U.S. Coast Guard, for example, is 03699999
// 00MIDXXXX   Coastal stations
// 111MIDXXX   SAR (Search and Rescue) aircraft
// 99MIDXXXX   Aids to Navigation
// 98MIDXXXX   Auxiliary craft associated with a parent ship
// 970MIDXXX   AIS SART (Search and Rescue Transmitter) (might be bad info - might be no MID)
// 972XXXXXX   MOB (Man Overboard) device (no MID)
// 974XXXXXX   EPIRB (Emergency Position Indicating Radio Beacon) AIS (no MID)
function getMid(mmsi) {
    if (
        mmsi.startsWith('111')
        || mmsi.startsWith('970')
    ) {
        return mmsi.substring(3, 6);
    } else if (
        mmsi.startsWith('00')
        || mmsi.startsWith('98')
        || mmsi.startsWith('99')
    ) {
        return mmsi.substring(2, 5);
    } else if (
        mmsi.startsWith('0')
        || mmsi.startsWith('8')
    ) {
        return mmsi.substring(1, 4);
    } else {
        return mmsi.substring(0, 3);
    }
}

function ageOutOldTargets() {
    targets.forEach((target, mmsi) => {
        // dont age ourselves out. should never happen, but...
        if (mmsi == selfMmsi) {
            return;
        }

        if (target.lastSeen > TARGET_MAX_AGE) {
            console.log('aging out old target', mmsi, target.name, target.mmsi, target.lastSeen / 60);

            if (mmsi == selectedVesselMmsi) {
                blueBoxIcon.removeFrom(map);
                blueCircle1.removeFrom(map);
                blueCircle2.removeFrom(map);
                bsModalSelectedVesselProperties.hide();
                selectedVesselMmsi = null;
            }

            if (boatMarkers.has(mmsi)) {
                boatMarkers.get(mmsi).removeFrom(map);
                boatMarkers.delete(mmsi);
            }

            if (boatProjectedCourseLines.has(mmsi)) {
                boatProjectedCourseLines.get(mmsi).removeFrom(map);
                boatProjectedCourseLines.delete(mmsi);
            }
            labelToCollisionController.removeLabel(mmsi, null);
            targets.delete(mmsi);
        }
    });
}

function boatClicked(event) {
    //console.log('event', event);
    var boatMarker = event.target;
    var closebyBoatMarkers = findClosebyBoats(event.latlng);
    if (closebyBoatMarkers.length > 1) {
        closebyBoatMarkers.sort(function (a, b) {
            return a.distanceInPixels - b.distanceInPixels
        });

        var div = document.getElementById("listOfClosebyBoats");
        div.innerHTML = "";
        var target;
        var a;

        closebyBoatMarkers.forEach((closebyBoatMarker, i) => {
            target = targets.get(closebyBoatMarker.mmsi);
            //console.log(i, target.name, target.alarmState, closebyBoatMarker.distanceInPixels);
            a = document.createElement('a');
            a.href = "#";
            a.setAttribute("data-bs-toggle", "list");
            a.setAttribute("data-mmsi", target.mmsi);
            // list-group-item-danger list-group-item-warning
            a.classList = "list-group-item list-group-item-action";
            if (i == 0) {
                a.classList.add("active");
            }
            if (target.alarmState == "danger") {
                a.classList.add("list-group-item-danger");
            } else if (target.alarmState == "warning") {
                a.classList.add("list-group-item-warning");
            }
            a.appendChild(document.createTextNode(target.name));
            div.appendChild(a);
        });
        selectBoatMarker(closebyBoatMarkers[0]);
        positionModalWindow(boatMarker.getLatLng(), "modalClosebyBoats");
        bsModalClosebyBoats.show();
        return;
    }

    selectBoatMarker(boatMarker);
    positionModalWindow(boatMarker.getLatLng(), "modalSelectedVesselProperties");
    updateSelectedVesselProperties(targets.get(boatMarker.mmsi));
    bsModalSelectedVesselProperties.show();
}

function positionModalWindow(latLng, modalId) {
    var clickedBoatMarkerLocationInPixels = map.latLngToContainerPoint(latLng);
    var mapWidthInPixels = document.getElementById("map").clientWidth;

    // if its a narrow screen, show modal in the default centered manner
    // if boat is right of center, place modal on left
    // if boat is left of center, place modal on right
    var modalDialog = document.getElementById(modalId).children[0];
    if (mapWidthInPixels > 600) {
        if (clickedBoatMarkerLocationInPixels.x > mapWidthInPixels / 2) {
            modalDialog.style.marginLeft = "100px";
            modalDialog.style.marginRight = "auto";
        } else {
            modalDialog.style.marginLeft = "auto";
            modalDialog.style.marginRight = "100px";
        }
    } else {
        modalDialog.removeAttribute("style");
    }
}

function findClosebyBoats(latLng) {
    var mapHeightInPixels = map.getSize().y;
    var mapHeightInMeters = Math.abs(map.getBounds().getNorth() - map.getBounds().getSouth()) * 60 * METERS_PER_NM;
    var mapScaleMetersPerPixel = mapHeightInMeters / mapHeightInPixels;
    var closebyBoatMarkers = [];
    boatMarkers.forEach((boatMarker, mmsi) => {
        if (mmsi == selfMmsi) {
            return;
        }
        var distanceInMeters = latLng.distanceTo(boatMarker.getLatLng());
        var distanceInPixels = distanceInMeters / mapScaleMetersPerPixel;
        if (distanceInPixels < 30) {
            boatMarker.distanceInPixels = distanceInPixels;
            closebyBoatMarkers.push(boatMarker);
        }
    });

    return closebyBoatMarkers;
}

function handleListOfClosebyBoatsClick(event) {
    //console.log(event);
    var boatMarker = boatMarkers.get(event.target.dataset.mmsi);
    selectBoatMarker(boatMarker);
}

function selectBoatMarker(boatMarker) {
    // if my own boat was selected - quit
    // if clicking on the boat that is already selected - quit
    if (boatMarker.mmsi == selfMmsi
        || boatMarker.mmsi == selectedVesselMmsi) {
        return;
    }

    // clear previous blue box
    // if (blueBoxIcon) {
    //     blueBoxIcon.removeFrom(map);
    //     console.log('about to remove blueCircle1', blueCircle1);
    //     blueCircle1.removeFrom(map);
    //     blueCircle2.removeFrom(map);
    // }

    // add blue box to selected boat marker
    blueBoxIcon.setLatLng(boatMarker.getLatLng());
    blueBoxIcon.addTo(map);

    // bring boat to front - on top of the blue box - so that the boat can be clicked rather than the blue box
    boatMarker.setZIndexOffset(1000);

    var oldSelectedVesselMmsi;

    // get vessel that was selected before this new selection (if any)
    if (selectedVesselMmsi) {
        oldSelectedVesselMmsi = selectedVesselMmsi;
    }

    selectedVesselMmsi = boatMarker.mmsi;
    updateSingleVesselUI(targets.get(selectedVesselMmsi));

    if (oldSelectedVesselMmsi) {
        updateSingleVesselUI(targets.get(oldSelectedVesselMmsi));
    }

    // FIXME blueLayerGroup.addTo(map);
}

function handleMapClick(event) {
    blueBoxIcon.removeFrom(map);
    blueCircle1.removeFrom(map);
    blueCircle2.removeFrom(map);
    //blueLayerGroup.removeFrom(map);

    if (selectedVesselMmsi) {
        // update selected vessel (remove blue):
        var savedSelectedVesselMmsi = selectedVesselMmsi;
        selectedVesselMmsi = null;
        updateSingleVesselUI(targets.get(savedSelectedVesselMmsi));
        // update own vessel (remove blue):
        updateSingleVesselUI(targets.get(selfMmsi));
    }
}

function getTargetIcon(target, isLarge, color) {
    // self
    if (target.mmsi == selfMmsi) {
        return getSelfIcon();
    }
    // 111MIDXXX        SAR (Search and Rescue) aircraft
    // 970MIDXXX        AIS SART (Search and Rescue Transmitter)
    // 972XXXXXX        MOB (Man Overboard) device
    // 974XXXXXX        EPIRB (Emergency Position Indicating Radio Beacon) AIS
    else if (target.mmsi.startsWith('111')
        || target.mmsi.startsWith('970')
        || target.mmsi.startsWith('972')
        || target.mmsi.startsWith('974')
    ) {
        getSartIcon();
    }
    // 99MIDXXXX        Aids to Navigation
    else if (target.aisClass == 'ATON' || target.mmsi.startsWith('99')) {
        return getAtonIcon(target, isLarge, color);
    }
    // class A
    else if (target.aisClass == 'A') {
        return getClassAIcon(target, isLarge, color);
    }
    // BASE
    else if (target.aisClass == 'BASE') {
        return getBaseIcon(target, isLarge, color);
    }
    // class B
    else {
        return getClassBIcon(target, isLarge, color);
    }
}

function getClassBIcon(target, isLarge, color) {
    var boxSize = 50;
    var strokeWidth = 2;
    if (isLarge) {
        boxSize = 70;
        strokeWidth = 4;
    }
    var boatLengthToBeam = 1.8;
    var margin = 10;
    var boatLength = boxSize - 2 * margin;
    var boatCenterOffset = margin / 2;
    var boatBeam = boatLength / boatLengthToBeam;
    var crosshairLength = boxSize * 0.8;
    const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <polygon
            points="${boxSize / 2 - boatBeam / 2},  ${boxSize / 2 + boatLength / 2 - boatCenterOffset} 
                    ${boxSize / 2},                 ${boxSize / 2 - boatLength / 2 - boatCenterOffset} 
                    ${boxSize / 2 + boatBeam / 2},  ${boxSize / 2 + boatLength / 2 - boatCenterOffset}"
            fill="${color}"
            fill-opacity=0.3
            stroke-width=${strokeWidth}
            stroke="${color}"
            stroke-opacity=1
            pointer-events="all"
            transform="rotate(${toDegrees(target.hdg || target.cog) || 0} ${boxSize / 2} ${boxSize / 2})"
        />
        ${target.isLost ? `
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - crosshairLength / 2} v${crosshairLength} M${boxSize * 0.5 - crosshairLength / 2},${boxSize * 0.5} h${crosshairLength}"
            stroke="red"
            stroke-width=2
            stroke-opacity=1
            transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
        />` : ''}
    </svg>`;

    // we need the classname to prevent the div from becoming visible
    return L.divIcon({
        className: 'foobar',
        html: SVGIcon,
        iconAnchor: [boxSize / 2, boxSize / 2],
    });
}

function getClassAIcon(target, isLarge, color) {
    var boxSize = 50;
    var strokeWidth = 2;
    if (isLarge) {
        boxSize = 70;
        strokeWidth = 4;
    }
    var boatLengthToBeam = 2.2;
    var bowLengthToBoatLength = 0.4;
    var margin = 10;
    var boatLength = boxSize - 2 * margin;
    var boatBeam = boatLength / boatLengthToBeam;
    var crosshairLength = boxSize * 0.8;
    const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <polygon
            points="
                ${boxSize / 2 - boatBeam / 2},   ${boxSize / 2 + boatLength / 2} 
                ${boxSize / 2 - boatBeam / 2},   ${boxSize / 2 - boatLength / 2 + boatLength * bowLengthToBoatLength} 
                ${boxSize / 2},                  ${boxSize / 2 - boatLength / 2} 
                ${boxSize / 2 + boatBeam / 2},   ${boxSize / 2 - boatLength / 2 + boatLength * bowLengthToBoatLength} 
                ${boxSize / 2 + boatBeam / 2},   ${boxSize / 2 + boatLength / 2}"
            fill="${color}"
            fill-opacity=0.3
            stroke-width=${strokeWidth}
            stroke="${color}"
            stroke-opacity=1
            pointer-events="all"
            transform="rotate(${toDegrees(target.hdg || target.cog) || 0} ${boxSize / 2} ${boxSize / 2})"
        />
        ${target.isLost ? `
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - crosshairLength / 2} v${crosshairLength} M${boxSize * 0.5 - crosshairLength / 2},${boxSize * 0.5} h${crosshairLength}"
            stroke="red"
            stroke-width=2
            stroke-opacity=1
            transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
        />` : ''}
    </svg>`;

    // we need the classname to prevent the div from becoming visible
    return L.divIcon({
        className: 'foobar',
        html: SVGIcon,
        iconAnchor: [boxSize / 2, boxSize / 2],
    });
}

function getBlueBoxIcon() {
    var boxSize = 80;
    var margin = 10;
    var blueBoxSize = boxSize - 2 * margin;
    const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <rect
            style="stroke:#3c48be;stroke-width:5;stroke-dasharray:${blueBoxSize * 3 / 4} ${blueBoxSize / 4} ${blueBoxSize * 3 / 4} ${blueBoxSize / 4};stroke-dashoffset:${blueBoxSize * 3 / 8};stroke-opacity:1.0;fill-opacity:0"
            width="${blueBoxSize}"
            height="${blueBoxSize}"
            x="${margin}"
            y="${margin}" />
    </svg>`;

    return L.divIcon({
        className: 'foobar',
        html: SVGIcon,
        iconAnchor: [boxSize / 2, boxSize / 2],
    });
}

function getAtonIcon(target, isLarge, color) {
    var boxSize = 40;
    var strokeWidth = 2;
    if (isLarge) {
        boxSize = 50;
        strokeWidth = 4;
    }
    var margin = 12;
    var atonSize = boxSize - 2 * margin;
    var crosshairLength = atonSize * 0.6;
    var isLostCrosshairLength = boxSize * 0.8;

    const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <rect x="${margin}" y="${margin}" width="${atonSize}" height="${atonSize}" 
            transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
            fill="${color}"
            fill-opacity=0.3
            stroke-width=${strokeWidth}
            ${target.isVirtual ? 'stroke-dasharray="2 2"' : ''}
            stroke="${color}"
            stroke-opacity=1
        />
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - crosshairLength / 2} v${crosshairLength} M${boxSize * 0.5 - crosshairLength / 2},${boxSize * 0.5} h${crosshairLength}"
            stroke="${color}"
            stroke-width=2
            stroke-opacity=1
        />
        ${target.isLost ? `
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - isLostCrosshairLength / 2} v${isLostCrosshairLength} M${boxSize * 0.5 - isLostCrosshairLength / 2},${boxSize * 0.5} h${isLostCrosshairLength}"
            stroke="red"
            stroke-width=2
            stroke-opacity=1
            transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
        />` : ''}
    </svg>`;

    return L.divIcon({
        className: 'foobar',
        html: SVGIcon,
        iconAnchor: [boxSize / 2, boxSize / 2],
    });
}

function getBaseIcon(target, isLarge, color) {
    var boxSize = 40;
    var strokeWidth = 2;
    if (isLarge) {
        boxSize = 50;
        strokeWidth = 4;
    }
    var margin = 12;
    var atonSize = boxSize - 2 * margin;
    var crosshairLength = atonSize * 0.6;
    var isLostCrosshairLength = boxSize * 0.8;

    const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <rect x="${margin}" y="${margin}" width="${atonSize}" height="${atonSize}" 
            fill="${color}"
            fill-opacity=0.3
            stroke-width=${strokeWidth}
            stroke="${color}"
            stroke-opacity=1
        />
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - crosshairLength / 2} v${crosshairLength} M${boxSize * 0.5 - crosshairLength / 2},${boxSize * 0.5} h${crosshairLength}"
            stroke="${color}"
            stroke-width=2
            stroke-opacity=1
        />
        ${target.isLost ? `
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - isLostCrosshairLength / 2} v${isLostCrosshairLength} M${boxSize * 0.5 - isLostCrosshairLength / 2},${boxSize * 0.5} h${isLostCrosshairLength}"
            stroke="red"
            stroke-width=2
            stroke-opacity=1
            transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
        />` : ''}
    </svg>`;

    return L.divIcon({
        className: 'foobar',
        html: SVGIcon,
        iconAnchor: [boxSize / 2, boxSize / 2],
    });
}

function getSartIcon() {
    var boxSize = 40;
    var strokeWidth = 2;
    var radius = 15;

    const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <g
            fill-opacity=0
            stroke-width=${strokeWidth}
            stroke="red"
            stroke-opacity=1
        >
            <circle cx="${boxSize / 2}" cy="${boxSize / 2}" r="${radius}" />
            <path d="M${boxSize * 0.5},${boxSize * 0.5 - radius} v${radius * 2} M${boxSize * 0.5 - radius},${boxSize * 0.5} h${radius * 2}" 
                transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
            />
        </g>
    </svg>`;

    return L.divIcon({
        className: 'foobar',
        html: SVGIcon,
        iconAnchor: [boxSize / 2, boxSize / 2],
    });
}

function getSelfIcon() {
    var boxSize = 40;
    var strokeWidth = 2;

    const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <g
            fill-opacity=0
            stroke-width=${strokeWidth}
            stroke="gray"
            stroke-opacity=1
        >
            <circle cx="${boxSize / 2}" cy="${boxSize / 2}" r="17" />
            <circle cx="${boxSize / 2}" cy="${boxSize / 2}" r="7" />
        </g>
    </svg>`;

    return L.divIcon({
        className: 'foobar',
        html: SVGIcon,
        iconAnchor: [boxSize / 2, boxSize / 2],
    });
}

function addLabelToCollisionController(layer, id, weight) {
    var label = layer.getTooltip()._source._tooltip._container;
    if (label) {
        var rect = label.getBoundingClientRect();

        var bottomLeft = map.containerPointToLatLng([rect.left, rect.bottom]);
        var topRight = map.containerPointToLatLng([rect.right, rect.top]);
        var boundingBox = {
            bottomLeft: [bottomLeft.lng, bottomLeft.lat],
            topRight: [topRight.lng, topRight.lat]
        };

        labelToCollisionController.ingestLabel(
            boundingBox,
            id,
            -weight,
            label,
            id, // name
            false //being dragged
        );
    }
}

function toRadians(v) {
    return v * Math.PI / 180;
};

function toDegrees(v) {
    return v * 180 / Math.PI;
};

function projectedLocation(start, θ, distance) {
    const radius = 6371e3; // (Mean) radius of earth in meters
    const [lat, lon] = start

    // sinφ2 = sinφ1·cosδ + cosφ1·sinδ·cosθ
    // tanΔλ = sinθ·sinδ·cosφ1 / cosδ−sinφ1·sinφ2
    // see mathforum.org/library/drmath/view/52049.html for derivation

    const δ = Number(distance) / radius; // angular distance in radians

    const φ1 = toRadians(Number(lat));
    const λ1 = toRadians(Number(lon));

    const sinφ1 = Math.sin(φ1), cosφ1 = Math.cos(φ1);
    const sinδ = Math.sin(δ), cosδ = Math.cos(δ);
    const sinθ = Math.sin(θ), cosθ = Math.cos(θ);

    const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * cosθ;
    const φ2 = Math.asin(sinφ2);
    const y = sinθ * sinδ * cosφ1;
    const x = cosδ - sinφ1 * sinφ2;
    const λ2 = λ1 + Math.atan2(y, x);

    return [toDegrees(φ2), (toDegrees(λ2) + 540) % 360 - 180]; // normalise to −180..+180°
}

function calculateRangeAndBearing(target) {
    if (!selfPosition
        || !target.latitude
        || !target.longitude) {
        target.range = null;
        target.bearing = null;
        //console.log('cant calc range bearing', selfPosition, target);
        return;
    }

    target.range = Math.round(getDistanceFromLatLonInMeters(selfPosition.latitude, selfPosition.longitude, target.latitude, target.longitude));
    target.bearing = Math.round(getRhumbLineBearing(selfPosition.latitude, selfPosition.longitude, target.latitude, target.longitude));

    if (target.bearing >= 360) {
        target.bearing = 0;
    }
}

// from: http://geomalgorithms.com/a07-_distance.html
function updateCpa(target) {
    var selfTarget = targets.get(selfMmsi);
    if (selfTarget.x == null
        || selfTarget.y == null
        || selfTarget.vx == null
        || selfTarget.vy == null
        || selfTarget.cog == null
        || selfTarget.sog == null
        || target.x == null
        || target.y == null
        || target.vx == null
        || target.vy == null
        || target.cog == null
        || target.sog == null
    ) {
        //console.log('cant calc cpa: missing data', target.mmsi);
        target.cpa = null;
        target.tcpa = null;
        return;
    }

    // dv = Tr1.v - Tr2.v
    // this is relative speed
    // m/s
    var dv = {
        x: target.vx - selfTarget.vx,
        y: target.vy - selfTarget.vy,
    }

    // (m/s)^2
    var dv2 = dot(dv, dv);

    // guard against division by zero
    // the tracks are almost parallel
    // or there is almost no relative movement
    if (dv2 < 0.00000001) {
        // console.log('cant calc tcpa: ',target.mmsi);
        target.cpa = null;
        target.tcpa = null;
        return;
    }

    // w0 = Tr1.P0 - Tr2.P0
    // this is relative position
    // 111120 m / deg lat
    // m
    // FIXME isnt this the same as target.y - selfTarget.y
    var w0 = {
        // x: target.x - selfTarget.x,
        // y: target.y - selfTarget.y
        x: (target.longitude - selfPosition.longitude) * 111120 * Math.cos(toRadians(selfPosition.latitude)),
        y: (target.latitude - selfPosition.latitude) * 111120,
    }

    // in secs
    // m * m/s / (m/s)^2 = m / (m/s) = s
    var tcpa = -dot(w0, dv) / dv2;

    // if tcpa is in the past,
    // or if tcpa is more than 3 hours in the future
    // then dont calc cpa & tcpa
    if (!tcpa || tcpa < 0 || tcpa > 3 * 3600) {
        //console.log('discarding tcpa: ', target.mmsi, tcpa);
        target.cpa = null;
        target.tcpa = null;
        return;
    }

    // Point P1 = Tr1.P0 + (ctime * Tr1.v);
    // m
    var p1 = {
        x: selfTarget.x + tcpa * selfTarget.vx,
        y: selfTarget.y + tcpa * selfTarget.vy,
    }

    // Point P2 = Tr2.P0 + (ctime * Tr2.v);
    // m
    var p2 = {
        x: target.x + tcpa * target.vx,
        y: target.y + tcpa * target.vy,
    }

    // in meters
    var cpa = dist(p1, p2);

    // in meters
    target.cpa = Math.round(cpa);
    // in seconds
    target.tcpa = Math.round(tcpa);
}

// #define dot(u,v) ((u).x * (v).x + (u).y * (v).y + (u).z * (v).z)
function dot(u, v) {
    return u.x * v.x + u.y * v.y;
}

// #define norm(v) sqrt(dot(v,v))
// norm = length of vector
function norm(v) {
    return Math.sqrt(dot(v, v));
}

// #define d(u,v) norm(u-v)
// distance = norm of difference
function dist(u, v) {
    return norm({
        x: u.x - v.x,
        y: u.y - v.y,
    });
}

// FIXME duplicated in plugin
function evaluateAlarms(target) {
    try {
        // guard alarm
        target.guardAlarm =
            (target.range != null && target.range < collisionProfiles[collisionProfiles.current].guard.range * METERS_PER_NM)
            && (collisionProfiles[collisionProfiles.current].guard.speed == 0
                || (target.sog != null && target.sog > collisionProfiles[collisionProfiles.current].guard.speed / KNOTS_PER_M_PER_S));

        // collision alarm
        target.collisionAlarm =
            target.cpa != null && target.cpa < collisionProfiles[collisionProfiles.current].danger.cpa * METERS_PER_NM
            && target.tcpa != null && target.tcpa > 0 && target.tcpa < collisionProfiles[collisionProfiles.current].danger.tcpa
            && (collisionProfiles[collisionProfiles.current].danger.speed == 0
                || (target.sog != null && target.sog > collisionProfiles[collisionProfiles.current].danger.speed / KNOTS_PER_M_PER_S));

        // collision warning
        target.collisionWarning =
            target.cpa != null && target.cpa < collisionProfiles[collisionProfiles.current].warning.cpa * METERS_PER_NM
            && target.tcpa != null && target.tcpa > 0 && target.tcpa < collisionProfiles[collisionProfiles.current].warning.tcpa
            && (collisionProfiles[collisionProfiles.current].warning.speed == 0
                || (target.sog != null && target.sog > collisionProfiles[collisionProfiles.current].warning.speed / KNOTS_PER_M_PER_S));

        target.sartAlarm = (target.mmsi.startsWith('970'));
        target.mobAlarm = (target.mmsi.startsWith('972'));
        target.epirbAlarm = (target.mmsi.startsWith('974'));

        //FIXME - need to clean up this order logic. 
        // targets with alarm status must be at the top
        // targets with negative tcpa are very low priority

        // alarm
        if (target.guardAlarm
            || target.collisionAlarm
            || target.sartAlarm
            || target.mobAlarm
            || target.epirbAlarm) {
            target.alarmState = 'danger';
            target.order = 10000;
        }
        // warning
        else if (target.collisionWarning) {
            target.alarmState = 'warning';
            target.order = 20000;
        }
        // no alarm/warning - but has positive tcpa (closing)
        else if (target.tcpa != null && target.tcpa > 0) {
            target.alarmState = null;
            target.order = 30000;
        }
        // no alarm/warning and moving away)
        else {
            target.alarmState = null;
            target.order = 40000;
        }

        var alarms = [];

        if (target.guardAlarm) alarms.push('guard');
        if (target.collisionAlarm || target.collisionWarning) alarms.push('cpa');
        if (target.sartAlarm) alarms.push('sart');
        if (target.mobAlarm) alarms.push('mob');
        if (target.epirbAlarm) alarms.push('epirb');

        if (alarms.length > 0) {
            target.alarmType = alarms.join(',');
        } else {
            target.alarmType = null;
        }

        // sort sooner tcpa targets to top
        if (target.tcpa != null && target.tcpa > 0) {
            // sort vessels with any tcpa above vessels that dont have a tcpa
            target.order -= 1000;
            // tcpa of 0 seconds reduces order by 1000 (this is an arbitrary weighting)
            // tcpa of 60 minutes reduces order by 0
            var weight = 1000;
            target.order -= Math.max(0, Math.round(weight - weight * target.tcpa / 3600));
        }

        // sort closer cpa targets to top
        if (target.cpa != null && target.cpa > 0) {
            // cpa of 0 nm reduces order by 2000 (this is an arbitrary weighting)
            // cpa of 5 nm reduces order by 0
            var weight = 2000;
            target.order -= Math.max(0, Math.round(weight - weight * target.cpa / 5 / METERS_PER_NM));
        }

        // sort closer targets to top
        if (target.range != null && target.range > 0) {
            // range of 0 nm increases order by 0
            // range of 5 nm increases order by 500
            target.order += Math.round(100 * target.range / METERS_PER_NM);
        }

        // FIXME might be interesting to calculate rate of closure
        // high positive rate of close decreases order 

        // sort targets with no range to bottom
        if (target.range == null) {
            target.order += 99999;
        }
    }
    catch (err) {
        console.log('error in evaluateAlarms', err.message, err);
    }
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000; // Radius of the earth in meters
    var dLat = toRadians(lat2 - lat1);
    var dLon = toRadians(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
        ;
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c; // Distance in meters
    return d;
};

function getRhumbLineBearing(lat1, lon1, lat2, lon2) {
    // difference of longitude coords
    var diffLon = toRadians(lon2 - lon1);

    // difference latitude coords phi
    var diffPhi = Math.log(
        Math.tan(
            toRadians(lat2) / 2 + Math.PI / 4
        ) /
        Math.tan(
            toRadians(lat1) / 2 + Math.PI / 4
        )
    );

    // recalculate diffLon if it is greater than pi
    if (Math.abs(diffLon) > Math.PI) {
        if (diffLon > 0) {
            diffLon = (Math.PI * 2 - diffLon) * -1;
        }
        else {
            diffLon = Math.PI * 2 + diffLon;
        }
    }

    //return the angle, normalized
    return (toDegrees(Math.atan2(diffLon, diffPhi)) + 360) % 360;
};

// N 39° 57.0689
function formatLat(dec) {
    var decAbs = Math.abs(dec);
    var deg = ('0' + Math.floor(decAbs)).slice(-2);
    var min = ('0' + ((decAbs - deg) * 60).toFixed(4)).slice(-7);
    return (dec > 0 ? "N" : "S") + " " + deg + "° " + min;
}

// W 075° 08.3692
function formatLon(dec) {
    var decAbs = Math.abs(dec);
    var deg = ('00' + Math.floor(decAbs)).slice(-3);
    var min = ('0' + ((decAbs - deg) * 60).toFixed(4)).slice(-7);
    return (dec > 0 ? "E" : "W") + " " + deg + "° " + min;
}

// 1.53 NM
function formatCpa(cpa) {
    // if cpa is null it should be returned as blank. toFixed makes it '0.00'
    return cpa != null ? (cpa / METERS_PER_NM).toFixed(2) + ' NM' : '---';
}

// hh:mm:ss or mm:ss e.g. 01:15:23 or 51:37
function formatTcpa(tcpa) {
    if (tcpa == null || tcpa < 0) {
        return '---';
    }
    // when more than 60 mins, then format hh:mm:ss
    else if (Math.abs(tcpa) >= 3600) {
        return new Date(1000 * Math.abs(tcpa)).toISOString().substring(11, 19) // + ' hours'
    }
    // when less than 60 mins, then format mm:ss
    else {
        return new Date(1000 * Math.abs(tcpa)).toISOString().substring(14, 19) // + ' mins'
    }
}
