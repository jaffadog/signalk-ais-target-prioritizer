import fs from "node:fs";
import path from "node:path";
import defaultCollisionProfiles from "../web/assets/defaultCollisionProfiles.json" with {
	type: "json",
};
import { assertCollisionProfiles } from "../shared/guards.mjs";
import * as aisUtils from "../shared/ais-utils.mjs";
import { applyDeltaValue, createTarget } from "../shared/target-model.mjs";
import * as vesper from "./vesper-xb8000-emulator.mjs";

const AGE_OUT_OLD_TARGETS = true;
const TARGET_MAX_AGE = 30 * 60; // max age in seconds - 30 minutes

const DEFAULT_UPDATE_INTERVAL_DELAY = 3;
const DEFAULT_MAXIMUM_TARGET_RANGE = 50;
const DEFAULT_ENABLE_DATA_PUBLISHING = true;
const DEFAULT_ENABLE_ALARM_PUBLISHING = true;
const DEFAULT_ENABLE_EMULATOR = false;

function normalizeOptions(raw = {}) {
	return {
		updateIntervalDelay:
			raw.updateIntervalDelay ?? DEFAULT_UPDATE_INTERVAL_DELAY,
		maximumTargetRange: raw.maximumTargetRange ?? DEFAULT_MAXIMUM_TARGET_RANGE,
		enableDataPublishing:
			raw.enableDataPublishing ?? DEFAULT_ENABLE_DATA_PUBLISHING,
		enableAlarmPublishing:
			raw.enableAlarmPublishing ?? DEFAULT_ENABLE_ALARM_PUBLISHING,
		enableEmulator: raw.enableEmulator ?? DEFAULT_ENABLE_EMULATOR,
	};
}

var selfMmsi;
var selfName;
var selfCallsign;
var selfTypeId;
var selfTarget;

var targets = new Map();
var collisionProfiles;
var options;
var updateIntervalDelay;
var maximumTargetRange;
var enableDataPublishing;
var enableAlarmPublishing;
var enableEmulator;

export default function (app) {
	var plugin = {};
	var unsubscribes = [];

	var refreshDataModelInterval;

	plugin.id = "signalk-ais-target-prioritizer";
	plugin.name = "SignalK AIS Target Prioritizer";
	plugin.description =
		"A SignalK plugin that priorizes AIS targets according to guard and CPA criteria";

	plugin.start = (_options) => {
		app.debug(`*** Starting plugin ${plugin.id} with options=`, _options);
		options = normalizeOptions(_options);
		updateIntervalDelay = options.updateIntervalDelay;
		maximumTargetRange = options.maximumTargetRange;
		enableDataPublishing = options.enableDataPublishing;
		enableAlarmPublishing = options.enableAlarmPublishing;
		enableEmulator = options.enableEmulator;
		getCollisionProfiles();

		selfMmsi = app.getSelfPath("mmsi");
		selfName = app.getSelfPath("name");
		selfCallsign = app.getSelfPath("communication")
			? app.getSelfPath("communication").callsignVhf
			: "";
		selfTypeId = app.getSelfPath("design.aisShipType")
			? app.getSelfPath("design.aisShipType").value.id
			: "";

		if (enableDataPublishing || enableAlarmPublishing || enableEmulator) {
			enablePluginCpaCalculations();
		} else {
			// if plugin was stopped and started again with options set to not perform calculations, then clear out old targets
			targets.clear();
		}

		if (enableEmulator) {
			//app.debug("collisionProfiles in index.js", collisionProfiles);
			//vesper.collisionProfiles = collisionProfiles;
			//vesper.setCollisionProfiles(collisionProfiles);
			vesper.start(
				app,
				collisionProfiles,
				selfMmsi,
				selfName,
				selfCallsign,
				selfTypeId,
				targets,
				saveCollisionProfiles,
			);
		}
	};

	plugin.stop = async () => {
		app.debug(`Stopping plugin ${plugin.id}`);
		unsubscribes.forEach((f) => f());
		unsubscribes = [];
		if (refreshDataModelInterval) {
			clearInterval(refreshDataModelInterval);
		}
		if (enableEmulator) {
			await vesper.stop();
		}
		app.debug(`Stopped plugin ${plugin.id}`);
	};

	plugin.schema = {
		type: "object",
		description: "Note: edit CPA warning and alarm settings in the webapp.",
		properties: {
			updateIntervalDelay: {
				title: "Update Interval (Seconds)",
				description: `Number of seconds between target data updates (default is ${DEFAULT_UPDATE_INTERVAL_DELAY} seconds).`,
				type: "number",
				minimum: 1,
				default: DEFAULT_UPDATE_INTERVAL_DELAY,
			},
			maximumTargetRange: {
				title: "Ignore Targets Further Than (NM)",
				description: `(default is ${DEFAULT_MAXIMUM_TARGET_RANGE} NM).`,
				type: "number",
				minimum: 5,
				default: DEFAULT_MAXIMUM_TARGET_RANGE,
			},
			enableDataPublishing: {
				title:
					"Publish AIS Target CPA, TCPA, Range, Bearing, Priority, and Alarm Status to SignalK (navigation.closestApproach). This is not required if just using the webapp.",
				description: `(default is ${DEFAULT_ENABLE_DATA_PUBLISHING}).`,
				type: "boolean",
				default: DEFAULT_ENABLE_DATA_PUBLISHING,
			},
			enableAlarmPublishing: {
				title:
					"Publish AIS Target CPA and Guard warning/alarm notifications to SignalK (notifications.navigation.closestApproach). This is not required if just using the webapp.",
				description: `(default is ${DEFAULT_ENABLE_ALARM_PUBLISHING}).`,
				type: "boolean",
				default: DEFAULT_ENABLE_ALARM_PUBLISHING,
			},
			enableEmulator: {
				title:
					"Enable Vesper XB-8000 Emulation. Turn this on if you intend to use the Vesper WatchMate mobile apps.",
				description: `(default is ${DEFAULT_ENABLE_EMULATOR}).`,
				type: "boolean",
				default: DEFAULT_ENABLE_EMULATOR,
			},
		},
	};

	plugin.registerWithRouter = (router) => {
		// GET /plugins/${plugin.id}/getCollisionProfiles
		router.get("/getCollisionProfiles", (_req, res) => {
			app.debug("getCollisionProfiles", collisionProfiles);
			res.json(collisionProfiles);
		});

		// PUT /plugins/${plugin.id}/setCollisionProfiles
		router.put("/setCollisionProfiles", (req, res) => {
			try {
				const newCollisionProfiles = assertCollisionProfiles(req.body);
				app.debug("setCollisionProfiles", newCollisionProfiles);
				// must use Object.assign rather than "collisionProfiles = newCollisionProfiles" to prevent breaking the reference we passed into the vesper emulator
				Object.assign(collisionProfiles, newCollisionProfiles);
				saveCollisionProfiles();
				res.json(collisionProfiles);
			} catch (error) {
				app.error(
					"ERROR - not saving invalid new collision profiles",
					req.body,
				);
				res.status(400).json({ error: error.message });
			}
		});

		// GET /plugins/${plugin.id}/muteAllAlarms
		router.get("/muteAllAlarms", (_req, res) => {
			app.debug("muteAllAlarms");
			targets.forEach((target, mmsi) => {
				if (target.alarmState === "danger" && !target.alarmIsMuted) {
					app.debug(
						"muting alarm for target",
						mmsi,
						target.name,
						target.alarmType,
						target.alarmState,
					);
					target.alarmIsMuted = true;
				}
			});
			res.json();
		});

		// GET /plugins/${plugin.id}/setAlarmIsMuted/:mmsi/:alarmIsMuted
		router.get("/setAlarmIsMuted/:mmsi/:alarmIsMuted", (req, res) => {
			var mmsi = req.params.mmsi;
			var alarmIsMuted = req.params.alarmIsMuted === "true";
			app.debug("setting alarmIsMuted", mmsi, alarmIsMuted);
			if (targets.has(mmsi)) {
				targets.get(mmsi).alarmIsMuted = alarmIsMuted;
				res.json();
			} else {
				res.status(404).end();
			}
		});

		// GET /plugins/${plugin.id}/getTargets
		router.get("/getTargets", (_req, res) => {
			app.debug("getTargets", targets.size);
			res.json(Object.fromEntries(targets));
		});

		// GET /plugins/${plugin.id}/getTarget/:mmsi
		router.get("/getTarget/:mmsi", (req, res) => {
			var mmsi = req.params.mmsi;
			app.debug("getTarget", mmsi);
			if (targets.has(mmsi)) {
				res.json(targets.get(mmsi));
			} else {
				res.status(404).end();
			}
		});
	};

	function getCollisionProfiles() {
		try {
			const dataDirPath = app.getDataDirPath();
			const collisionProfilesPath = path.join(
				dataDirPath,
				"collisionProfiles.json",
			);
			if (fs.existsSync(collisionProfilesPath)) {
				app.debug("Reading file", collisionProfilesPath);
				collisionProfiles = JSON.parse(
					fs.readFileSync(collisionProfilesPath).toString(),
				);
			} else {
				app.debug(
					"collisionProfiles.json not found, using defaultCollisionProfiles",
					collisionProfilesPath,
				);
				collisionProfiles = defaultCollisionProfiles;
				saveCollisionProfiles();
			}
		} catch (err) {
			app.error("Error reading collisionProfiles.json:", err);
			throw new Error("Error reading collisionProfiles.json:", err);
		}
	}

	function saveCollisionProfiles() {
		app.debug("saving ", collisionProfiles);

		var dataDirPath = app.getDataDirPath();

		if (!fs.existsSync(dataDirPath)) {
			try {
				fs.mkdirSync(dataDirPath, { recursive: true });
			} catch (err) {
				app.error("Error creating dataDirPath:", err);
				throw new Error("Error creating dataDirPath:", err);
			}
		}

		var collisionProfilesPath = path.join(
			dataDirPath,
			"collisionProfiles.json",
		);
		app.debug("Writing file", collisionProfilesPath);
		try {
			fs.writeFileSync(
				collisionProfilesPath,
				JSON.stringify(collisionProfiles, null, 2),
			);
		} catch (err) {
			app.error("Error writing collisionProfiles.json:", err);
			throw new Error("Error writing collisionProfiles.json:", err);
		}
	}

	function enablePluginCpaCalculations() {
		// *
		// atons.*
		// vessels.*
		// vessels.self
		var localSubscription = {
			context: "*", // we need both vessels and atons
			subscribe: [
				{
					// "name" is in the root path
					// and "communication.callsignVhf"
					// and imo
					path: "",
					period: 1000,
				},
				{
					path: "navigation.position",
					period: 1000,
				},
				{
					path: "navigation.courseOverGroundTrue",
					period: 1000,
				},
				{
					path: "navigation.speedOverGround",
					period: 1000,
				},
				{
					path: "navigation.magneticVariation",
					period: 1000,
				},
				{
					path: "navigation.headingTrue",
					period: 1000,
				},
				{
					path: "navigation.state",
					period: 1000,
				},
				{
					path: "navigation.destination.commonName",
					period: 1000,
				},
				{
					path: "navigation.rateOfTurn",
					period: 1000,
				},
				{
					path: "design.*",
					period: 1000,
				},
				{
					path: "sensors.ais.class",
					period: 1000,
				},
				{
					path: "atonType",
					period: 1000,
				},
				{
					path: "offPosition",
					period: 1000,
				},
				{
					path: "virtual",
					period: 1000,
				},
			],
		};

		app.subscriptionmanager.subscribe(
			localSubscription,
			unsubscribes,
			(subscriptionError) => {
				app.error(`Error:${subscriptionError}`);
			},
			(delta) => processDelta(delta),
		);

		// update data model every 1 second
		refreshDataModelInterval = setInterval(
			refreshDataModel,
			updateIntervalDelay * 1000,
		);
	}

	function processDelta(delta) {
		var updates = delta.updates;
		var mmsi = delta.context.slice(-9);

		//app.debug('processDelta', mmsi, delta.updates.length, delta.updates[0].values[0]);

		if (!mmsi || !/[0-9]{9}/.test(mmsi)) {
			app.debug(
				"ERROR: received a delta with an invalid mmsi",
				JSON.stringify(delta, null, "\t"),
			);
			return;
		}

		var target = targets.get(mmsi) ?? createTarget(mmsi);

		target.context = delta.context;

		for (const update of updates) {
			for (const value of update.values) {
				applyDeltaValue(target, {
					path: value.path,
					value: value.value,
					timestamp: update.timestamp,
				});
			}
		}

		targets.set(mmsi, target);
	}

	async function refreshDataModel() {
		try {
			// collisionProfiles.setFromIndex = Math.floor(new Date().getTime() / 1000);
			// app.debug('index.js: setFromIndex,setFromEmulator', collisionProfiles.setFromIndex, collisionProfiles.setFromEmulator, collisionProfiles.anchor.guard.range);
			// app.debug("collisionProfiles.anchor.guard.range - index ",collisionProfiles.anchor.guard.range);

			selfTarget = targets.get(selfMmsi);

			if (aisUtils) {
				try {
					aisUtils.updateDerivedData({
						targets,
						selfTarget,
						collisionProfiles,
						maximumTargetRange,
						targetMaxAge: TARGET_MAX_AGE,
					});
				} catch (error) {
					app.debug(error); // we use app.debug rather than app.error so that the user can filter these out of the log
					app.setPluginError(error.message);
					sendNotification("alarm", error.message);
					return;
				}
			} else {
				app.debug("aisUtils not ready...");
				return;
			}

			if (selfTarget.lastSeen > 30) {
				const message = `No GPS position received for more than ${selfTarget.lastSeen} seconds`;
				app.debug(message); // we use app.debug rather than app.error so that the user can filter these out of the log
				app.setPluginError(message);
				sendNotification("alarm", message);
				return;
			}

			let isCurrentAlarm = false;

			targets.forEach((target, mmsi) => {
				if (enableDataPublishing && mmsi !== selfMmsi && !target.ignore) {
					pushTargetDataToSignalK(target);
				}

				// publish warning/alarm notifications
				// FIXME - should we send 1 notification for all targets? or separate notifications for each target?
				if (
					enableAlarmPublishing &&
					target.alarmState &&
					!target.alarmIsMuted &&
					!target.ignore
				) {
					const message = (
						`${target.name || `<${target.mmsi}>`} - ` +
						`${target.alarmType} ` +
						`${target.alarmState === "danger" ? "alarm" : target.alarmState}`
					).toUpperCase();
					if (target.alarmState === "warning") {
						sendNotification("warn", message);
					} else if (target.alarmState === "danger") {
						sendNotification("alarm", message);
					}
					isCurrentAlarm = true;
				}

				if (AGE_OUT_OLD_TARGETS && target.lastSeen > TARGET_MAX_AGE) {
					app.debug(
						"ageing out target",
						target.mmsi,
						target.name,
						target.lastSeen,
					);
					targets.delete(target.mmsi);
				}
			});

			// if there are no active alarms, yet still an alarm notification, then clean the alarm notification
			if (!isCurrentAlarm && isCurrentAlarmNotification()) {
				sendNotification("normal", "watching");
			}

			app.setPluginStatus(`Watching ${targets.size - 1} targets`);
		} catch (err) {
			app.debug("error in refreshDataModel", err.message, err);
		}
	}

	function pushTargetDataToSignalK(target) {
		app.handleMessage(plugin.id, {
			context: target.context,
			updates: [
				{
					values: [
						{
							path: "navigation.closestApproach",
							value: {
								distance: target.cpa,
								timeTo: target.tcpa,
								range: target.range,
								bearing: target.bearing,
								collisionRiskRating: target.order,
								collisionAlarmType: target.alarmType,
								collisionAlarmState: target.alarmState,
							},
						},
					],
				},
			],
		});
	}

	function sendNotification(state, message) {
		app.debug("sendNotification", state, message);
		var delta = {
			updates: [
				{
					values: [
						{
							path: "notifications.navigation.closestApproach",
							value: {
								state: state,
								method: ["visual", "sound"],
								message: message,
							},
						},
					],
				},
			],
		};

		app.handleMessage(plugin.id, delta);
	}

	function isCurrentAlarmNotification() {
		const notifications = app.getSelfPath(
			"notifications.navigation.closestApproach",
		);
		return notifications?.value?.state === "alarm";
	}

	return plugin;
}
