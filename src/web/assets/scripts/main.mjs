// FIXME: need map rotation option to toggle between north-up and cog-up
// FIXME need to investigate node OOM issues - leak?

const DEFAULT_MAP_ZOOM = 14; // 14 gives us 2+ NM
const METERS_PER_NM = 1852;
const COURSE_PROJECTION_MINUTES = 10;
const AGE_OUT_OLD_TARGETS = true;
const TARGET_MAX_AGE = 30 * 60; // max age in seconds - 30 minutes
const SHOW_ALARMS_INTERVAL = 60 * 1000; // show alarms every 60 seconds
const PLUGIN_ID = "signalk-ais-target-prioritizer";

import * as bootstrap from "bootstrap";
import * as labelgun from "labelgun";
import * as L from "leaflet";
import * as protomapsL from "protomaps-leaflet";
import "leaflet-easybutton";
import * as basemaps from "@protomaps/basemaps";
import NoSleep from "nosleep.js";
import defaultCollisionProfiles from "../defaultCollisionProfiles.json";
import hornMp3Url from "../horn.mp3";
import pmtilesUrl from "../ne_10m_land.pmtiles?url&no-inline";
import * as aisIons from "./ais-icons.mjs";
import { toDegrees, toRadians, updateDerivedData } from "./ais-utils.mjs";
import * as targetSvgs from "./ship-icons.mjs";

var noSleep = new NoSleep();
var collisionProfiles;
var selfMmsi;
var selfTarget;
var offsetLatitude = 0;
var offsetLongitude = 0;
var disableMoveend = false;
var disableMapPanTo = false;
var targets = new Map();
var pluginTargets;
var boatMarkers = new Map();
var boatProjectedCourseLines = new Map();
var rangeRings = L.layerGroup();
var selectedVesselMmsi;
var blueBoxIcon;
var blueCircle1;
var blueCircle2;
var validTargetCount;
var filteredTargetCount;
var alarmTargetCount;
var lastAlarmTime;
// var tooltipList;
var sortTableBy = "priority";

var blueLayerGroup = L.layerGroup();
//blueLayerGroup.className = 'blueStuff';

const bsModalAlert = new bootstrap.Modal("#modalAlert");
const bsModalAlarm = new bootstrap.Modal("#modalAlarm");
const bsModalClosebyBoats = new bootstrap.Modal("#modalClosebyBoats");
const bsModalSelectedVesselProperties = new bootstrap.Modal(
	"#modalSelectedVesselProperties",
);
const bsOffcanvasSettings = new bootstrap.Offcanvas("#offcanvasSettings");
const bsOffcanvasEditProfiles = new bootstrap.Offcanvas(
	"#offcanvasEditProfiles",
);
const bsOffcanvasTargetList = new bootstrap.Offcanvas("#offcanvasTargetList");

// load collisionProfiles
// /plugins/${PLUGIN_ID}/getCollisionProfiles
collisionProfiles = await getHttpResponse(
	`/plugins/${PLUGIN_ID}/getCollisionProfiles`,
	{ throwErrors: true },
);

// console.log("collisionProfiles", collisionProfiles);
if (!collisionProfiles.current) {
	console.log("using default collisionProfiles");
	collisionProfiles = structuredClone(defaultCollisionProfiles);
	saveCollisionProfiles();
}

document.getElementById("selectActiveProfile").value =
	collisionProfiles.current;
document.getElementById("checkNoSleep").checked =
	localStorage.getItem("checkNoSleep") === "true";
configureNoSleep();

var charts = await getHttpResponse("/signalk/v1/api/resources/charts", {
	throwErrors: false,
	ignore404: true,
	ignoreEmptyResponse: true,
});

var data = await getHttpResponse("/signalk/v1/api/vessels/self", {
	throwErrors: true,
});
selfMmsi = data.mmsi;

pluginTargets = await getHttpResponse(`/plugins/${PLUGIN_ID}/getTargets`);

const map = L.map("map", {
	zoom: DEFAULT_MAP_ZOOM,
	minZoom: 9,
	maxZoom: 18,
});

L.easyButton("bi bi-cursor-fill", (_btn, map) => {
	if (selfTarget.isValid) {
		map.panTo([selfTarget.latitude, selfTarget.longitude]);
		offsetLatitude = 0;
		offsetLongitude = 0;
	}
}).addTo(map);

// protomaps color flavors: light dark white grayscale black
// make water transparent so that bootstrap light/dark mode backgroud comes through
var paintRules = protomapsL.paintRules({
	...basemaps.namedFlavor("light"),
	water: "rgba(0,0,0,0)",
});
var labelRules = protomapsL.labelRules(basemaps.namedFlavor("light"));

var osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
	maxZoom: 19,
	attribution: "© OpenStreetMap",
});

var openTopoMap = L.tileLayer(
	"https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
	{
		maxZoom: 19,
		attribution:
			"Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)",
	},
);

var satLayer = L.tileLayer(
	"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
	{
		maxNativeZoom: 17,
		maxZoom: 20,
		attribution: "© Esri © OpenStreetMap Contributors",
	},
);

var naturalEarth10m = protomapsL.leafletLayer({
	url: pmtilesUrl,
	maxDataZoom: 5,
	paintRules: paintRules,
	labelRules: labelRules,
});

var baseMaps = {
	Empty: L.tileLayer(""),
	OpenStreetMap: osm,
	OpenTopoMap: openTopoMap,
	Satellite: satLayer,
	"NaturalEarth (offline)": naturalEarth10m,
};

var chart;
var layer;
for (const key in charts) {
	chart = charts[key];
	if (chart.format === "mvt") {
		layer = protomapsL.leafletLayer({
			url: chart.tilemapUrl,
			maxDataZoom: chart.maxzoom,
			paintRules: paintRules,
			labelRules: labelRules,
		});
	} else {
		layer = L.tileLayer(chart.tilemapUrl, {
			maxZoom: chart.maxzoom,
			attribution: "",
		});
	}
	baseMaps[chart.name] = layer;
}

var OpenSeaMap = L.tileLayer(
	"https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png",
	{
		maxZoom: 19,
		attribution: "",
	},
);

var overlayMaps = {
	OpenSeaMap: OpenSeaMap,
};

L.control.layers(baseMaps, overlayMaps, { position: "topleft" }).addTo(map);

var layerControlLayersToggleEl = document.getElementsByClassName(
	"leaflet-control-layers-toggle",
)[0];

layerControlLayersToggleEl.classList.add("bi", "bi-layers-fill");

L.easyButton("bi bi-list-ul", () => {
	bsOffcanvasTargetList.show();
}).addTo(map);

L.easyButton("bi bi-gear-fill", () => {
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
	icon: aisIons.getBlueBoxIcon(),
});

blueCircle1 = L.circleMarker([], {
	radius: 6,
	color: "blue",
	opacity: 1.0,
	fillOpacity: 1.0,
	interactive: false,
	className: "blueStuff",
});

blueCircle2 = L.circleMarker([], {
	radius: 6,
	color: "blue",
	opacity: 1.0,
	fillOpacity: 1.0,
	interactive: false,
	className: "blueStuff",
});

// we're adding all the blue stuff to a layer group so that we can raise the z index of the whole group
// and turn visibility on/off in one shot
blueLayerGroup.addLayer(blueBoxIcon);
blueLayerGroup.addLayer(blueCircle1);
blueLayerGroup.addLayer(blueCircle2);

// setup vessel label collision avoidance
var hideLabel = (label) => {
	label.labelObject.style.opacity = 0;
};
var showLabel = (label) => {
	label.labelObject.style.opacity = 1;
};
var labelToCollisionController = new labelgun.default(hideLabel, showLabel);

const alertPlaceholder = document.getElementById("alertPlaceholder");

// *********************************************************************************************************
// ** REGISTER EVENT LISTENERS

map.on("baselayerchange", handleBaseLayerChange);
map.on("overlayadd", handleOverlayAdd);
map.on("overlayremove", handleOverlayRemove);

document
	.getElementById("tableOfTargetsBody")
	.addEventListener("click", handleTableOfTargetsBodyClick);

document
	.getElementById("listOfClosebyBoats")
	.addEventListener("click", handleListOfClosebyBoatsClick);

document
	.getElementById("selectActiveProfile")
	.addEventListener("input", (ev) => {
		collisionProfiles.current = ev.target.value;
		saveCollisionProfiles();
	});

document.getElementById("selectTableSort").addEventListener("input", (ev) => {
	sortTableBy = ev.target.value;
});

document.getElementById("buttonEditProfiles").addEventListener("click", () => {
	bsOffcanvasSettings.hide();
	selectProfileToEdit.value = selectActiveProfile.value;
	setupProfileEditView(selectProfileToEdit.value);
	bsOffcanvasEditProfiles.show();
});

document.getElementById("checkNoSleep").addEventListener("change", () => {
	configureNoSleep();
});

document
	.getElementById("checkDarkMode")
	.addEventListener("change", applyColorMode);

document.getElementById("checkFullScreen").addEventListener("change", () => {
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

document
	.getElementById("selectProfileToEdit")
	.addEventListener("input", (ev) => {
		setupProfileEditView(ev.target.value);
	});

document
	.getElementById("buttonRestoreDefaults")
	.addEventListener("click", () => {
		collisionProfiles = structuredClone(defaultCollisionProfiles);
		setupProfileEditView(selectProfileToEdit.value);
		saveCollisionProfiles();
	});

document
	.getElementById("buttonMuteAllAlarms")
	.addEventListener("click", muteAllAlarms);
document
	.getElementById("buttonMuteAllAlarms2")
	.addEventListener("click", muteAllAlarms);

document
	.getElementById("buttonMuteToggle")
	.addEventListener("click", handleButtonMuteToggle);

document.getElementsByClassName("");
// save config when offcanvasEditProfiles is closed
offcanvasEditProfiles.addEventListener("hide.bs.offcanvas", () => {
	saveCollisionProfiles();
});

// show modalSelectedVesselProperties when modalClosebyBoats is closed
modalClosebyBoats.addEventListener("hidden.bs.modal", () => {
	var boatMarker = boatMarkers.get(selectedVesselMmsi);
	positionModalWindow(boatMarker.getLatLng(), "modalSelectedVesselProperties");
	showModalSelectVesselProperties(targets.get(selectedVesselMmsi));
});

configWarningCpaRange.addEventListener("input", processDistanceRangeControl);
configWarningTcpaRange.addEventListener("input", processTcpaRangeControl);
configWarningSogRange.addEventListener("input", processSpeedRangeControl);

configAlarmCpaRange.addEventListener("input", processDistanceRangeControl);
configAlarmTcpaRange.addEventListener("input", processTcpaRangeControl);
configAlarmSogRange.addEventListener("input", processSpeedRangeControl);

configGuardRangeRange.addEventListener("input", processDistanceRangeControl);
configGuardSogRange.addEventListener("input", processSpeedRangeControl);

map.on("movestart", () => {
	disableMapPanTo = true;
});

map.on("moveend", () => {
	disableMapPanTo = false;

	if (disableMoveend) {
		return;
	}

	// if the map was panned, store the offsets from selfTarget
	if (selfTarget.isValid) {
		const mapCenter = map.getCenter();
		offsetLatitude = mapCenter.lat - selfTarget.latitude;
		offsetLongitude = mapCenter.lng - selfTarget.longitude;
	}
});

map.on("zoomend", () => {
	drawRangeRings();
	labelToCollisionController.update();
});

map.on("click", handleMapClick);

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
		// dark mode
		document.documentElement.setAttribute("data-bs-theme", "dark");
		const elements = document.querySelectorAll(".leaflet-layer");
		for (let i = 0; i < elements.length; i++) {
			elements[i].style.filter =
				"invert(1) hue-rotate(180deg) brightness(0.8) contrast(1.2)";
		}
	} else {
		// light mode
		document.documentElement.setAttribute("data-bs-theme", "light");
		const elements = document.querySelectorAll(".leaflet-layer");
		for (let i = 0; i < elements.length; i++) {
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

function handleOverlayRemove() {
	localStorage.removeItem("overlay");
}

// initialize profile edit screen on startup
setupProfileEditView("anchor");

refresh();
setInterval(refresh, 1000);

function setupProfileEditView(profile) {
	configWarningCpaRange.value = distanceToTick(
		collisionProfiles[profile].warning.cpa,
	);
	configWarningTcpaRange.value = timeToTick(
		collisionProfiles[profile].warning.tcpa / 60,
	);
	configWarningSogRange.value = speedToTick(
		collisionProfiles[profile].warning.speed,
	);

	configAlarmCpaRange.value = distanceToTick(
		collisionProfiles[profile].danger.cpa,
	);
	configAlarmTcpaRange.value = timeToTick(
		collisionProfiles[profile].danger.tcpa / 60,
	);
	configAlarmSogRange.value = speedToTick(
		collisionProfiles[profile].danger.speed,
	);

	configGuardRangeRange.value = distanceToTick(
		collisionProfiles[profile].guard.range,
	);
	configGuardSogRange.value = speedToTick(
		collisionProfiles[profile].guard.speed,
	);

	var inputEvent = new Event("input");

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
	console.log("*** save collisionProfiles to server", collisionProfiles);

	// /plugins/${PLUGIN_ID}/setCollisionProfiles
	var response = await fetch(`/plugins/${PLUGIN_ID}/setCollisionProfiles`, {
		credentials: "include",
		method: "PUT",
		body: JSON.stringify(collisionProfiles),
		headers: {
			"Content-Type": "application/json",
		},
	});
	if (response.status === 401) {
		location.href = "/admin/#/login";
	}
	if (!response.ok) {
		throw new Error(
			`Error saving collisionProfiles. Response status: ${response.status} from ${response.url}`,
		);
	}
	console.log("successfully saved config", collisionProfiles);
}

function showError(message) {
	//document.getElementById("errorMessage").textContent = message;
	document.getElementById("errorMessage").innerHTML = message;
	bsModalAlert.show();
}

function handleTableOfTargetsBodyClick(ev) {
	bsOffcanvasTargetList.hide();
	const tr = ev.target.closest("tr");
	const mmsi = tr.dataset.mmsi;
	const boatMarker = boatMarkers.get(mmsi);
	selectBoatMarker(boatMarker);
	// FIXME: maybe use blueLayerGroup here. looks like L.featureGroup would be what we need.
	map.fitBounds([
		boatMarker.getLatLng(),
		boatMarkers.get(selfMmsi).getLatLng(),
	]);
	positionModalWindow(boatMarker.getLatLng(), "modalSelectedVesselProperties");
	showModalSelectVesselProperties(targets.get(boatMarker.mmsi));
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
	var unitsSpan = document.getElementById(`${dataset.target}Units`);

	if (distance === 0) {
		unitsSpan.hidden = true;
	} else {
		unitsSpan.hidden = false;
	}

	valueStorageElement.textContent = distance || "OFF";
	collisionProfiles[selectProfileToEdit.value][dataset.alarmType][
		dataset.alarmCriteria
	] = distance;
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
	var time = tickToTime(tick);
	valueStorageElement.textContent = time;
	collisionProfiles[selectProfileToEdit.value][dataset.alarmType][
		dataset.alarmCriteria
	] = time * 60;
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
	collisionProfiles[selectProfileToEdit.value][dataset.alarmType][
		dataset.alarmCriteria
	] = speed;
}

function drawRangeRings() {
	if (!selfTarget.isValid) {
		return;
	}
	rangeRings.removeFrom(map);
	rangeRings.clearLayers();

	var mapHeightInNauticalMiles =
		60 * Math.abs(map.getBounds().getNorth() - map.getBounds().getSouth());

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

	for (let i = 1; i <= 6; i++) {
		rangeRings.addLayer(
			L.circle([selfTarget.latitude, selfTarget.longitude], {
				radius: i * step * METERS_PER_NM,
				color: "gray",
				weight: 1,
				opacity: 0.7,
				fill: false,
				interactive: false,
				zIndexOffset: -999,
			}),
		);

		rangeRings.addLayer(
			L.tooltip([selfTarget.latitude + (i * step) / 60, selfTarget.longitude], {
				content: `${i * step} NM`,
				permanent: true,
				direction: "center",
				opacity: 0.7,
				offset: [0, 15],
				className: "map-labels",
				interactive: false,
				zIndexOffset: -999,
			}),
		);

		rangeRings.addLayer(
			L.tooltip([selfTarget.latitude - (i * step) / 60, selfTarget.longitude], {
				content: `${i * step} NM`,
				permanent: true,
				direction: "center",
				opacity: 0.7,
				offset: [0, -15],
				className: "map-labels",
				interactive: false,
				zIndexOffset: -999,
			}),
		);
	}

	rangeRings.addTo(map);
}

async function refresh() {
	try {
		const startTime = new Date();

		// FIXME switch to the streaming api? does it send atons?

		let vessels = await getHttpResponse("/signalk/v1/api/vessels", {
			throwErrors: true,
		});
		//console.log(vessels);

		// we expect 404s from this when there are no atons:
		const atons = await getHttpResponse("/signalk/v1/api/atons", {
			ignore404: true,
		});
		vessels = Object.assign(vessels, atons);

		validTargetCount = 0;
		filteredTargetCount = 0;
		alarmTargetCount = 0;

		ingestRawVesselData(vessels);

		selfTarget = targets.get(selfMmsi);

		try {
			updateDerivedData(targets, selfTarget, collisionProfiles, TARGET_MAX_AGE);
		} catch (error) {
			console.error(error);
			showError(`No GPS position available. Verify that you are connected to the 
                SignalK server and that the SignalK server has a position for your vessel.<br><br>
                ${error}`);
		}

		// we need to do this after we get the initial round of targets
		UpdateTargetsWithMuteDataFromPlugin();

		updateUI();

		if (AGE_OUT_OLD_TARGETS) {
			ageOutOldTargets();
		}

		if (
			alarmTargetCount > 0 &&
			(lastAlarmTime == null ||
				Date.now() > lastAlarmTime + SHOW_ALARMS_INTERVAL)
		) {
			lastAlarmTime = Date.now();
			showAlarms();
		}

		// show error if were not getting gps position updates
		if (selfTarget.lastSeen > 20) {
			console.error(
				`No GPS position received for more than ${selfTarget.lastSeen} seconds`,
			);
			showError(`No GPS position received for more than ${selfTarget.lastSeen} seconds. Verify that you are connected to the 
                SignalK server and that the SignalK server has a position for your vessel.`);
		}

		// display performance metrics
		let layers = 0;
		map.eachLayer(() => {
			layers++;
		});
		const updateTimeInMillisecs = Date.now() - startTime.getTime();
		//console.log(updateTimeInMillisecs + ' msecs');
		// FIXME this does not work in ios: performance.memory.usedJSHeapSize
		// map.attributionControl.setPrefix(`${updateTimeInMillisecs} msecs / ${layers} layers / ${(performance.memory.usedJSHeapSize / Math.pow(1000, 2)).toFixed(1)} MB`);
		map.attributionControl.setPrefix(
			`${updateTimeInMillisecs} msecs / ${layers} layers`,
		);
	} catch (error) {
		console.error("Error in refresh:", error);
		//showError(`Encountered an error while refreshing: ${error}`);
	}
}

function UpdateTargetsWithMuteDataFromPlugin() {
	if (!pluginTargets) {
		return;
	}
	var pluginTarget;
	targets.forEach((target, mmsi) => {
		pluginTarget = pluginTargets[mmsi];

		if (pluginTarget?.alarmIsMuted) {
			console.log(
				`setting target ${mmsi} ${target.name} to muted because it is muted in the plugin`,
			);
			target.alarmIsMuted = true;
		}
	});
	pluginTargets = null;
}

function showAlarms() {
	var targetsWithAlarms = [];
	targets.forEach((target) => {
		if (target.isValid && target.alarmState && !target.alarmIsMuted) {
			targetsWithAlarms.push(target);
		}
	});

	if (targetsWithAlarms.length > 0) {
		document.getElementById("alarmDiv").innerHTML = " ";
		targetsWithAlarms.forEach((target) => {
			var message = `${target.name} - ${target.alarmType.toUpperCase()} - `;
			if (target.alarmType.includes("cpa")) {
				message += `${target.cpaFormatted} ${target.tcpaFormatted}`;
			} else {
				message += `${target.rangeFormatted}`;
			}
			document.getElementById("alarmDiv").innerHTML +=
				`<div class="alert alert-danger" role="alert">${message}</div>`;
		});
		bsModalAlarm.show();
		new Audio(hornMp3Url).play();
	}
}

async function muteAllAlarms() {
	console.log("muting all alarms");
	targets.forEach((target, mmsi) => {
		if (target.alarmState === "danger" && !target.alarmIsMuted) {
			console.log(
				"muting alarm for target",
				mmsi,
				target.name,
				target.alarmType,
				target.alarmState,
			);
			target.alarmIsMuted = true;
		}
	});

	// mute alarms in the plugin as well
	// /plugins/${PLUGIN_ID}/muteAllAlarms
	await getHttpResponse(`/plugins/${PLUGIN_ID}/muteAllAlarms`, {
		throwErrors: true,
		ignoreEmptyResponse: true,
	});
}

async function handleButtonMuteToggle() {
	var target = targets.get(selectedVesselMmsi);
	target.alarmIsMuted = !target.alarmIsMuted;
	updateButtonMuteToggleIcon(target);
	showAlert(`Target ${target.alarmIsMuted ? "" : "un"}muted`, "success");

	console.log(
		"setting alarmIsMuted",
		target.mmsi,
		target.name,
		target.alarmIsMuted,
	);

	// GET /plugins/${plugin.id}/setAlarmIsMuted/:mmsi/:alarmIsMuted
	await getHttpResponse(
		`/plugins/${PLUGIN_ID}/setAlarmIsMuted/${target.mmsi}/${target.alarmIsMuted}`,
		{ throwErrors: true, ignoreEmptyResponse: true },
	);
}

function updateButtonMuteToggleIcon(target) {
	if (target.alarmIsMuted) {
		document.querySelector("#buttonMuteToggle > i").className =
			"bi bi-volume-mute-fill";
	} else {
		document.querySelector("#buttonMuteToggle > i").className =
			"bi bi-volume-up-fill";
	}
}

function showAlert(message, type) {
	alertPlaceholder.innerHTML = [
		`<div class="alert alert-${type} alert-dismissible" role="alert">`,
		`   <div>${message}</div>`,
		'   <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>',
		"</div>",
	].join("");
}

// get vessel data into an easier to access data model
// values in their original data types - no text formatting of numeric values here
function ingestRawVesselData(vessels) {
	for (var vesselId in vessels) {
		const vessel = vessels[vesselId];

		let target = targets.get(vessel.mmsi);
		if (!target) {
			target = {};
		}

		target.lastSeenDate = new Date(vessel.navigation?.position?.timestamp);

		const lastSeen = Math.round((Date.now() - target.lastSeenDate) / 1000);

		// dont add targets that have already aged out
		if (lastSeen >= TARGET_MAX_AGE) {
			continue;
		}

		target.mmsi = String(vessel.mmsi);
		target.name = vessel.name || `<${vessel.mmsi}>`;
		target.sog = vessel.navigation?.speedOverGround?.value;
		target.cog = vessel.navigation?.courseOverGroundTrue?.value;
		target.hdg = vessel.navigation?.headingTrue?.value;
		target.rot = vessel.navigation?.rateOfTurn?.value;
		target.callsign = vessel.communication?.callsignVhf || "---";
		target.typeId =
			vessel.design?.aisShipType?.value.id || vessel.atonType?.value.id;
		target.type =
			(vessel.design?.aisShipType?.value.name || vessel.atonType?.value.name) ??
			"---";
		target.aisClass = vessel.sensors?.ais?.class?.value || "A";
		target.isVirtual = vessel.virtual?.value;
		target.isOffPosition = vessel.offPosition?.value;
		target.status = vessel.navigation?.state?.value ?? "---";
		target.length = vessel.design?.length?.value.overall;
		target.beam = vessel.design?.beam?.value;
		target.draft = vessel.design?.draft?.current ?? "---";
		target.destination =
			vessel.navigation?.destination?.commonName?.value ?? "---";
		target.eta = vessel.navigation?.destination?.eta?.value ?? "---";
		target.imo = vessel.registrations?.imo;
		target.latitude = vessel.navigation?.position?.value.latitude;
		target.longitude = vessel.navigation?.position?.value.longitude;

		// FIXME - override gps for testing with signalk team sample data (netherlands)
		// if (target.mmsi == selfMmsi) {
		//     target.latitude = 53.44;
		//     target.longitude = 4.86 //5.07;
		// }

		targets.set(target.mmsi, target);
	}
}

function updateSelectedVesselProperties(target) {
	updateButtonMuteToggleIcon(target);
	document.getElementById("target.name").textContent = target.name;
	document.getElementById("target.lastSeen").textContent = target.lastSeen;
	document.getElementById("target.cpaFormatted").textContent =
		target.cpaFormatted;
	document.getElementById("target.tcpaFormatted").textContent =
		target.tcpaFormatted;
	document.getElementById("target.rangeFormatted").textContent =
		target.rangeFormatted;
	document.getElementById("target.bearingFormatted").textContent =
		target.bearingFormatted;
	document.getElementById("target.sogFormatted").textContent =
		target.sogFormatted;
	document.getElementById("target.cogFormatted").textContent =
		target.cogFormatted;
	document.getElementById("target.hdgFormatted").textContent =
		target.hdgFormatted;
	document.getElementById("target.rotFormatted").textContent =
		target.rotFormatted;
	document.getElementById("target.callsign").textContent = target.callsign;
	document.getElementById("target.mmsi").textContent = target.mmsi;
	document.getElementById("target.mmsiCountryCode").textContent =
		target.mmsiCountryCode;
	document
		.getElementById("target.mmsiCountryCode")
		.setAttribute("data-bs-title", target.mmsiCountryName);
	document.getElementById("target.type").textContent = target.type;
	document.getElementById("target.aisClassFormatted").textContent =
		target.aisClassFormatted;
	document.getElementById("target.status").textContent = target.status;
	document.getElementById("target.sizeFormatted").textContent =
		target.sizeFormatted;
	document.getElementById("target.draft").textContent = target.draft;
	document.getElementById("target.destination").textContent =
		target.destination;
	document.getElementById("target.eta").textContent = target.eta;
	document.getElementById("target.imoFormatted").textContent =
		target.imoFormatted;
	document.getElementById("target.latitudeFormatted").textContent =
		target.latitudeFormatted;
	document.getElementById("target.longitudeFormatted").textContent =
		target.longitudeFormatted;
	// navigation.specialManeuver

	activateToolTips();

	var classARows = document.querySelectorAll(".ais-class-a");

	// show/hide class A fields:
	if (target.aisClass === "A") {
		[...classARows].map((row) => row.classList.remove("d-none"));
	} else {
		[...classARows].map((row) => row.classList.add("d-none"));
	}

	// show/hide alert:
	var selectedVesselAlert = document.getElementById("selectedVesselAlert");

	if (target.alarmState === "danger") {
		selectedVesselAlert.classList.remove("alert-warning");
		selectedVesselAlert.classList.add("alert-danger");
		selectedVesselAlert.textContent = `${target.alarmType} alarm`.toUpperCase();
		selectedVesselAlert.classList.remove("d-none");
	} else if (target.alarmState === "warning") {
		selectedVesselAlert.classList.remove("alert-danger");
		selectedVesselAlert.classList.add("alert-warning");
		selectedVesselAlert.textContent =
			`${target.alarmType} warning`.toUpperCase();
		selectedVesselAlert.classList.remove("d-none");
	} else {
		selectedVesselAlert.classList.add("d-none");
	}
}

// function deactivateToolTips() {
// 	if (tooltipList) {
// 		tooltipList.forEach((tooltip) => {
// 			tooltip.dispose();
// 		});
// 	}
// }

function activateToolTips() {
	const tooltipTriggerList = document.querySelectorAll(
		'[data-bs-toggle="tooltip"]',
	);
	// const tooltipList =
	[...tooltipTriggerList].map(
		(tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl),
	);
}

function updateUI() {
	// keep map centered on selfTarget as it moves
	// accomodates offsets if the user has panned the map
	if (selfTarget.isValid) {
		// we cant pan the map in code if the user is already panning the map by mouse
		if (!disableMapPanTo) {
			try {
				disableMoveend = true;
				map.panTo(
					[
						selfTarget.latitude + offsetLatitude,
						selfTarget.longitude + offsetLongitude,
					],
					{
						animate: false,
					},
				);
			} finally {
				disableMoveend = false;
			}
		}

		// keep the range rings centered on selfTarget - even if we didnt pan (above)
		drawRangeRings();
	}

	targets.forEach((target) => {
		//console.log(target);
		updateSingleVesselUI(target);

		// update data shown in modal properties screen
		if (target.mmsi === selectedVesselMmsi) {
			updateSelectedVesselProperties(target);
		}
	});

	labelToCollisionController.update();

	updateTableOfTargets();

	// update displayed target counts
	totalTargetCountUI.textContent = validTargetCount || 0;
	filteredTargetCountUI.textContent = filteredTargetCount || 0;
	alarmTargetCountUI.textContent = alarmTargetCount || 0;
}

function updateTableOfTargets() {
	var targetsArray = Array.from(targets.values());

	// NOTE - For testing table column widths
	// targetsArray.push({
	// 	mmsi: "333333333",
	// 	name: "ADRIATIC HIGHWAY",
	// 	isValid: true,
	// 	cpa: 99999,
	// 	tcpa: 99999,
	// 	range: 99999,
	// 	order: 99999,
	// 	alarmState: null,
	// 	cpaFormatted: "99.9 NM",
	// 	tcpaFormatted: "99:99:99",
	// 	rangeFormatted: "99.99 NM",
	// 	bearingFormatted: "999 T",
	// 	sogFormatted: "99.9 kn",
	// 	cogFormatted: "999 T",
	// });

	targetsArray.sort((a, b) => {
		try {
			if (sortTableBy === "tcpa") {
				return a.tcpa - b.tcpa;
			} else if (sortTableBy === "cpa") {
				return a.cpa - b.cpa;
			} else if (sortTableBy === "range") {
				return a.range - b.range;
			} else if (sortTableBy === "name") {
				return a.name > b.name ? 1 : -1;
			} else {
				return a.order - b.order;
			}
		} catch (error) {
			console.error(error);
			return 0;
		}
	});

	var tableBody = "";
	var rowCount = 0;

	for (var target of targetsArray) {
		if (target.mmsi !== selfMmsi && target.isValid) {
			tableBody += `
                <tr class="${
									target.alarmState === "danger"
										? "table-danger"
										: target.alarmState === "warning"
											? "table-warning"
											: ""
								}" data-mmsi="${target.mmsi}">
					<td scope="row">
						${getTargetSvg(target)}
					</td>
					<th>
						${target.name} ${target.alarmIsMuted ? '<i class="bi bi-volume-mute-fill"></i>' : ""}
					</th>
					<td class="text-end">${target.bearingFormatted}</td>
					<td class="text-end">${target.rangeFormatted}</td>
					<td class="text-end">${target.sogFormatted}</td>
					<td class="text-end">${target.cpa ? target.cpaFormatted : ""}</td>
					<td class="text-end">${target.cpa ? target.tcpaFormatted : ""}</td>
                </tr>`;
			rowCount++;
			// <td>${target.order}</td>
		}
	}

	document.getElementById("tableOfTargetsBody").innerHTML = tableBody;
	document.getElementById("numberOfAisTargets").textContent = rowCount;
}

function getTargetSvg(target) {
	// fishing
	if (target.typeId === 30) {
		targetSvgs.fishingboatSvg;
	}

	// sailing
	else if (target.typeId === 36) {
		return targetSvgs.sailboatSvg;
	}

	// pleasure
	else if (target.typeId === 37) {
		return targetSvgs.powerboatSvg;
	}

	// sar
	else if (
		target.typeId === 51 ||
		target.mmsi.startsWith("111") ||
		target.mmsi.startsWith("970") ||
		target.mmsi.startsWith("972") ||
		target.mmsi.startsWith("974")
	) {
		return targetSvgs.sarSvg;
	}

	// tug
	else if (target.typeId === 52) {
		return targetSvgs.tugboatSvg;
	}

	// other class A
	else if (target.aisClass === "A") {
		return targetSvgs.shipSvg;
	}

	// aton
	else if (target.aisClass === "ATON" || target.mmsi.startsWith("99")) {
		return targetSvgs.atonSvg;
	}

	// everything else
	else return targetSvgs.ufoSvg;
}

function updateSingleVesselUI(target) {
	// dont update (and dont add back in) old targets
	if (!target.isValid) {
		return;
	}

	var boatMarker = boatMarkers.get(target.mmsi);
	var boatProjectedCourseLine = boatProjectedCourseLines.get(target.mmsi);

	if (!boatMarker) {
		const icon = getTargetIcon(target, false, "gray");

		boatMarker = L.marker([0, 0], { icon: icon, riseOnHover: true }).addTo(map);
		boatMarkers.set(target.mmsi, boatMarker);

		boatMarker.bindTooltip("", {
			permanent: true,
			direction: "right",
			opacity: 0.7,
			offset: [25, 10],
			className: "map-labels",
			interactive: false,
			zIndexOffset: -999,
		});

		if (target.mmsi !== selfMmsi) {
			boatMarker.on("click", boatClicked);
		}

		boatProjectedCourseLine = L.polyline([[]], {
			color: "gray",
			opacity: 0.7,
			interactive: false,
			dashArray: "20 10",
			zIndexOffset: -999,
		}).addTo(map);
		boatProjectedCourseLines.set(target.mmsi, boatProjectedCourseLine);
	}

	boatMarker.setLatLng([target.latitude, target.longitude]);

	var vesselIconColor;
	var vesselIconIsLarge;

	if (target.mmsi === selectedVesselMmsi) {
		vesselIconColor = "blue";
		vesselIconIsLarge = true;
	} else if (target.alarmState === "danger") {
		vesselIconColor = "red";
		vesselIconIsLarge = true;
	} else if (target.alarmState === "warning") {
		vesselIconColor = "orange";
		vesselIconIsLarge = true;
	} else {
		vesselIconColor = "gray";
		vesselIconIsLarge = false;
	}

	boatMarker.setIcon(getTargetIcon(target, vesselIconIsLarge, vesselIconColor));

	// move the blue box with the selected boat over time
	if (target.mmsi === selectedVesselMmsi && blueBoxIcon) {
		blueBoxIcon.setLatLng([target.latitude, target.longitude]);
	}

	// store the whole vessel data model on the boat marker
	boatMarker.mmsi = target.mmsi;

	// FIXME add aton data for popup: isOffposition? or do the yellow box?

	if (target.mmsi !== selfMmsi) {
		// update counts
		validTargetCount++;
		if (target.alarmState) {
			filteredTargetCount++;
			if (target.alarmState === "danger") {
				alarmTargetCount++;
			}
		}

		// add tooltip text
		let tooltipText = `${target.name}<br/>`;
		if (target.sog > 0.1) {
			tooltipText += `${target.sogFormatted} `;
		}
		if (target.cpa) {
			tooltipText += `${target.cpaFormatted} `;
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
	if (target.mmsi === selfMmsi && selectedVesselMmsi) {
		//console.log(selectedVesselMmsi, targets.get(selectedVesselMmsi));
		const projectedCpaLocation = projectedLocation(
			[target.latitude, target.longitude],
			target.cog || 0,
			(target.sog || 0) * (targets.get(selectedVesselMmsi).tcpa || 0),
		);

		boatProjectedCourseLine.setLatLngs([
			[target.latitude, target.longitude],
			projectedCpaLocation,
		]);

		boatProjectedCourseLine.setStyle({
			color: "blue",
			opacity: 1.0,
			interactive: false,
			dashArray: "",
			className: "blueStuff",
		});

		blueCircle1.setLatLng(projectedCpaLocation);

		if (!map.hasLayer(blueCircle1)) {
			blueCircle1.addTo(map);
		}
	}

	// if this is the selected vessel
	// draw solid blue line to the cpa point from selected vessel
	else if (selectedVesselMmsi === target.mmsi) {
		const projectedCpaLocation = projectedLocation(
			[target.latitude, target.longitude],
			target.cog || 0,
			(target.sog || 0) * (target.tcpa || 0),
		);

		boatProjectedCourseLine.setLatLngs([
			[target.latitude, target.longitude],
			projectedCpaLocation,
		]);

		boatProjectedCourseLine.setStyle({
			color: "blue",
			opacity: 1.0,
			interactive: false,
			dashArray: "",
			className: "blueStuff",
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
			projectedLocation(
				[target.latitude, target.longitude],
				target.cog || 0,
				(target.sog || 0) * 60 * COURSE_PROJECTION_MINUTES,
			),
		]);

		boatProjectedCourseLine.setStyle({
			color: vesselIconColor,
			opacity: 0.7,
			interactive: false,
			dashArray: "20 10",
		});
	}
}

function ageOutOldTargets() {
	targets.forEach((target, mmsi) => {
		// dont age ourselves out. should never happen, but...
		if (mmsi === selfMmsi) {
			return;
		}

		if (target.lastSeen > TARGET_MAX_AGE) {
			console.log(
				"aging out old target",
				mmsi,
				target.name,
				target.mmsi,
				target.lastSeen / 60,
			);

			if (mmsi === selectedVesselMmsi) {
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
		closebyBoatMarkers.sort((a, b) => a.distanceInPixels - b.distanceInPixels);

		const div = document.getElementById("listOfClosebyBoats");
		div.innerHTML = "";
		let target;
		let a;

		closebyBoatMarkers.forEach((closebyBoatMarker, i) => {
			target = targets.get(closebyBoatMarker.mmsi);
			//console.log(i, target.name, target.alarmState, closebyBoatMarker.distanceInPixels);
			a = document.createElement("a");
			a.href = "#";
			a.setAttribute("data-bs-toggle", "list");
			a.setAttribute("data-mmsi", target.mmsi);
			// list-group-item-danger list-group-item-warning
			a.classList = "list-group-item list-group-item-action";
			if (i === 0) {
				a.classList.add("active");
			}
			if (target.alarmState === "danger") {
				a.classList.add("list-group-item-danger");
			} else if (target.alarmState === "warning") {
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
	showModalSelectVesselProperties(targets.get(boatMarker.mmsi));
}

function showModalSelectVesselProperties(target) {
	updateSelectedVesselProperties(target);
	alertPlaceholder.innerHTML = "";
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
	var mapHeightInMeters =
		Math.abs(map.getBounds().getNorth() - map.getBounds().getSouth()) *
		60 *
		METERS_PER_NM;
	var mapScaleMetersPerPixel = mapHeightInMeters / mapHeightInPixels;
	var closebyBoatMarkers = [];
	boatMarkers.forEach((boatMarker, mmsi) => {
		if (mmsi === selfMmsi) {
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
	if (boatMarker.mmsi === selfMmsi || boatMarker.mmsi === selectedVesselMmsi) {
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

function handleMapClick() {
	blueBoxIcon.removeFrom(map);
	blueCircle1.removeFrom(map);
	blueCircle2.removeFrom(map);
	//blueLayerGroup.removeFrom(map);

	if (selectedVesselMmsi) {
		// update selected vessel (remove blue):
		const savedSelectedVesselMmsi = selectedVesselMmsi;
		selectedVesselMmsi = null;
		updateSingleVesselUI(targets.get(savedSelectedVesselMmsi));
		// update own vessel (remove blue):
		updateSingleVesselUI(targets.get(selfMmsi));
	}
}

function getTargetIcon(target, isLarge, color) {
	// self
	if (target.mmsi === selfMmsi) {
		return aisIons.getSelfIcon();
	}
	// 111MIDXXX        SAR (Search and Rescue) aircraft
	// 970MIDXXX        AIS SART (Search and Rescue Transmitter)
	// 972XXXXXX        MOB (Man Overboard) device
	// 974XXXXXX        EPIRB (Emergency Position Indicating Radio Beacon) AIS
	else if (
		target.mmsi.startsWith("111") ||
		target.mmsi.startsWith("970") ||
		target.mmsi.startsWith("972") ||
		target.mmsi.startsWith("974")
	) {
		aisIons.getSartIcon();
	}
	// 99MIDXXXX        Aids to Navigation
	else if (target.aisClass === "ATON" || target.mmsi.startsWith("99")) {
		return aisIons.getAtonIcon(target, isLarge, color);
	}
	// class A
	else if (target.aisClass === "A") {
		return aisIons.getClassAIcon(target, isLarge, color);
	}
	// BASE
	else if (target.aisClass === "BASE") {
		return aisIons.getBaseIcon(target, isLarge, color);
	}
	// class B
	else {
		return aisIons.getClassBIcon(target, isLarge, color);
	}
}

function addLabelToCollisionController(layer, id, weight) {
	var label = layer.getTooltip()._source._tooltip._container;
	if (label) {
		const rect = label.getBoundingClientRect();

		const bottomLeft = map.containerPointToLatLng([rect.left, rect.bottom]);
		const topRight = map.containerPointToLatLng([rect.right, rect.top]);
		const boundingBox = {
			bottomLeft: [bottomLeft.lng, bottomLeft.lat],
			topRight: [topRight.lng, topRight.lat],
		};

		labelToCollisionController.ingestLabel(
			boundingBox,
			id,
			-weight,
			label,
			id, // name
			false, //being dragged
		);
	}
}

function projectedLocation(start, θ, distance) {
	const radius = 6371e3; // (Mean) radius of earth in meters
	const [lat, lon] = start;

	// sinφ2 = sinφ1·cosδ + cosφ1·sinδ·cosθ
	// tanΔλ = sinθ·sinδ·cosφ1 / cosδ−sinφ1·sinφ2
	// see mathforum.org/library/drmath/view/52049.html for derivation

	const δ = Number(distance) / radius; // angular distance in radians

	const φ1 = toRadians(Number(lat));
	const λ1 = toRadians(Number(lon));

	const sinφ1 = Math.sin(φ1),
		cosφ1 = Math.cos(φ1);
	const sinδ = Math.sin(δ),
		cosδ = Math.cos(δ);
	const sinθ = Math.sin(θ),
		cosθ = Math.cos(θ);

	const sinφ2 = sinφ1 * cosδ + cosφ1 * sinδ * cosθ;
	const φ2 = Math.asin(sinφ2);
	const y = sinθ * sinδ * cosφ1;
	const x = cosδ - sinφ1 * sinφ2;
	const λ2 = λ1 + Math.atan2(y, x);

	return [toDegrees(φ2), ((toDegrees(λ2) + 540) % 360) - 180]; // normalise to −180..+180°
}

async function getHttpResponse(url, options) {
	let response;
	let jsonResponse;
	try {
		response = await fetch(url, { credentials: "include" });
		if (response.status === 401) {
			location.href = "/admin/#/login";
		}
		if (!response.ok) {
			if (response.status === 404 && options?.ignore404) {
				//  ignore 404s if so directed
			} else {
				console.error(`Response status: ${response.status} from ${url}`);
				if (options?.throwErrors) {
					throw new Error(`Response status: ${response.status} from ${url}`);
				}
			}
		} else {
			const textResponse = await response.text();
			if (textResponse) {
				jsonResponse = JSON.parse(textResponse);
			} else if (!options?.ignoreEmptyResponse) {
				throw new Error(`Error: Got empty json response from ${url}`);
			}
		}
	} catch (error) {
		console.error(
			`Error in getHttpResponse: url=${url}, options=${options}, status=${
				response?.status || "none"
			}`,
			error,
		);
		if (options?.throwErrors) {
			//showError("The SignalK AIS Target Prioritizer plugin is not running. Please check the plugin status.");
			showError(`Encountered an error retrieving data from the SignalK server. Verify that you are connected to the SignalK server, that the SignalK 
                server is running, and that the AIS Target Prioritizer plugin is enabled.`);
			// <br><br>
			// 	<b>url</b>=${url},<br><b>options</b>=${JSON.stringify(
			// 	options,
			// 	)},<br><b>status</b>=${response?.status || "none"},<br><b>error</b>=${
			// 	error.message
			// 	}`);
			throw new Error(
				`Error in getHttpResponse: url=${url}, options=${JSON.stringify(
					options,
				)}, status=${response?.status || "none"}, error=${error.message}`,
			);
		}
	}
	return jsonResponse;
}
