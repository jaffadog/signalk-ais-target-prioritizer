import fs from "node:fs";
import path from "node:path";
import defaultCollisionProfiles from "../src/assets/defaultCollisionProfiles.json" with {
	type: "json",
};
import * as aisUtils from "../src/assets/scripts/ais-utils.js";
import schema from "./schema.json" with { type: "json" };
import * as vesper from "./vesper-xb8000-emulator.js";

const AGE_OUT_OLD_TARGETS = true;
const TARGET_MAX_AGE = 30 * 60; // max age in seconds - 30 minutes

var selfMmsi;
var selfName;
var selfCallsign;
var selfTypeId;
var selfTarget;

var targets = new Map();
var collisionProfiles;
var options;

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
		options = _options;
		getCollisionProfiles();
		if (
			options.enableDataPublishing ||
			options.enableAlarmPublishing ||
			options.enableEmulator
		) {
			enablePluginCpaCalculations();
		} else {
			// if plugin was stopped and started again with options set to not perform calculations, then clear out old targets
			targets.clear();
		}
		if (options.enableEmulator) {
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

	plugin.stop = () => {
		app.debug(`Stopping plugin ${plugin.id}`);
		// unsubscribes.forEach((f) => f());
		unsubscribes = [];
		if (refreshDataModelInterval) {
			clearInterval(refreshDataModelInterval);
		}
		if (options?.enableEmulator) {
			vesper.stop();
		}
	};

	plugin.schema = schema;

	plugin.registerWithRouter = (router) => {
		// GET /plugins/${plugin.id}/getCollisionProfiles
		router.get("/getCollisionProfiles", (_req, res) => {
			app.debug("getCollisionProfiles", collisionProfiles);
			res.json(collisionProfiles);
		});

		// PUT /plugins/${plugin.id}/setCollisionProfiles
		router.put("/setCollisionProfiles", (req, res) => {
			var newCollisionProfiles = req.body;
			app.debug("setCollisionProfiles", newCollisionProfiles);
			// do some basic validation to ensure we have some real config data before saving it
			if (
				!newCollisionProfiles ||
				!newCollisionProfiles.current ||
				!newCollisionProfiles.anchor ||
				!newCollisionProfiles.harbor ||
				!newCollisionProfiles.coastal ||
				!newCollisionProfiles.offshore
			) {
				app.error(
					"ERROR - not saving invalid new collision profiles",
					newCollisionProfiles,
				);
				res.status(500).end();
				return;
			}
			// must use Object.assign rather than "collisionProfiles = newCollisionProfiles" to prevent breaking the reference we passed into the vesper emulator
			Object.assign(collisionProfiles, newCollisionProfiles);
			saveCollisionProfiles();
			res.json(collisionProfiles);
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
		selfMmsi = app.getSelfPath("mmsi");
		selfName = app.getSelfPath("name");
		selfCallsign = app.getSelfPath("communication")
			? app.getSelfPath("communication").callsignVhf
			: "";
		selfTypeId = app.getSelfPath("design.aisShipType")
			? app.getSelfPath("design.aisShipType").value.id
			: "";

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
		refreshDataModelInterval = setInterval(refreshDataModel, 1000);
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

		var target = targets.get(mmsi);
		if (!target) {
			target = {
				// initialize these to zero - because signal k may not set values if the target is stationary
				// and we may as well start computing CPAs assuming they're stationary
				sog: 0,
				cog: 0,
			};
			target.mmsi = mmsi;
		}

		target.context = delta.context;

		for (const update of updates) {
			const values = update.values;
			for (const value of values) {
				//app.debug('value', value);

				switch (value.path) {
					case "":
						if (value.value.name) {
							target.name = value.value.name;
						} else if (value.value.communication?.callsignVhf) {
							target.callsign = value.value.communication.callsignVhf;
						} else if (value.value.registrations?.imo) {
							target.imo = value.value.registrations.imo.replace(/imo/i, "");
						} else if (value.value.mmsi) {
							// we expected mmsi
						} else {
							//app.debug('received unexpected delta on root path', delta.context, value.path, value.value);
						}
						break;
					case "navigation.position":
						target.latitude = value.value.latitude;
						target.longitude = value.value.longitude;
						target.lastSeenDate = new Date(update.timestamp);
						break;
					case "navigation.courseOverGroundTrue":
						target.cog = value.value;
						break;
					case "navigation.speedOverGround":
						target.sog = value.value;
						break;
					case "navigation.magneticVariation":
						target.magvar = value.value;
						break;
					case "navigation.headingTrue":
						target.hdg = value.value;
						break;
					case "navigation.rateOfTurn":
						target.rot = value.value;
						break;
					case "design.aisShipType":
						target.typeId = value.value.id;
						target.type = value.value.name;
						break;
					case "navigation.state":
						target.status = value.value;
						break;
					case "sensors.ais.class":
						target.aisClass = value.value;
						break;
					case "navigation.destination.commonName":
						target.destination = value.value;
						break;
					case "design.length":
						target.length = value.value.overall;
						break;
					case "design.beam":
						target.width = value.value;
						break;
					case "design.draft":
						target.draft = value.value.current;
						break;
					case "atonType":
						target.typeId = value.value.id;
						target.type = value.value.name;
						if (target.status == null) {
							target.status = "default"; // 15 = "default"
						}
						break;
					case "offPosition":
						target.isOffPosition = value.value ? 1 : 0;
						break;
					case "virtual":
						target.isVirtual = value.value ? 1 : 0;
						break;

					default:
					//app.debug('received unexpected delta', delta.context, value.path, value.value);
				}
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
					aisUtils.updateDerivedData(
						targets,
						selfTarget,
						collisionProfiles,
						TARGET_MAX_AGE,
					);
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
				if (options.enableDataPublishing && mmsi !== selfMmsi) {
					pushTargetDataToSignalK(target);
				}

				// publish warning/alarm notifications
				// FIXME - should we send 1 notification for all targets? or separate notifications for each target?
				if (
					options.enableAlarmPublishing &&
					target.alarmState &&
					!target.alarmIsMuted
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
