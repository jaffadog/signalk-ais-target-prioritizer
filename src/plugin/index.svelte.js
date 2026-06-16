import fs from "node:fs";
import path from "node:path";
import * as npmPackage from "../../package.json";
import { queueVesselUpdates, subscription } from "../engine/ingestion.svelte";
import { updateVessels } from "../engine/refreshLoop.svelte";
import {
  deleteAllVessels,
  deleteVessel,
  vessels,
  vesselsState,
} from "../engine/vessels.svelte";
import {
  collisionProfiles,
  setCollisionProfiles,
} from "../engine/collisionProfiles.svelte";
import { muteAllAlarms, setAlarmIsMuted } from "../engine/alarms.svelte";
import { METERS_PER_NM } from "../engine/constants";

const AGE_OUT_OLD_TARGETS = true;
const TARGET_MAX_AGE = 30 * 60; // max age in seconds - 30 minutes
const NO_GPS_FIX_WARNING = 30; // seconds

const DEFAULT_UPDATE_INTERVAL_DELAY = 3; // seconds
const DEFAULT_MAXIMUM_TARGET_RANGE = 50; // NM
const DEFAULT_ENABLE_DATA_PUBLISHING = true;
const DEFAULT_ENABLE_ALARM_PUBLISHING = true;

function normalizeOptions(raw = {}) {
  return {
    updateIntervalDelay:
      raw.updateIntervalDelay ?? DEFAULT_UPDATE_INTERVAL_DELAY,
    maximumTargetRange: raw.maximumTargetRange ?? DEFAULT_MAXIMUM_TARGET_RANGE,
    enableDataPublishing:
      raw.enableDataPublishing ?? DEFAULT_ENABLE_DATA_PUBLISHING,
    enableAlarmPublishing:
      raw.enableAlarmPublishing ?? DEFAULT_ENABLE_ALARM_PUBLISHING,
  };
}

const myVessel = $derived(vessels[vesselsState.myVesselMmsi]);

let timeoutId;

let options;
let updateIntervalDelay;
let maximumTargetRange;
let enableDataPublishing;
let enableAlarmPublishing;

export default function (app) {
  let plugin = {};
  let unsubscribes = [];

  plugin.id = npmPackage.name;
  plugin.name = npmPackage.signalk.displayName;
  plugin.description = npmPackage.description;

  plugin.start = (_options) => {
    app.debug(`*** Starting plugin ${plugin.id} with options=`, _options);
    options = normalizeOptions(_options);
    updateIntervalDelay = options.updateIntervalDelay;
    maximumTargetRange = options.maximumTargetRange;
    enableDataPublishing = options.enableDataPublishing;
    enableAlarmPublishing = options.enableAlarmPublishing;
    loadCollisionProfiles();

    vesselsState.myVesselMmsi = app.getSelfPath("mmsi");

    if (enableDataPublishing || enableAlarmPublishing) {
      enablePluginCpaCalculations();
    } else {
      // if plugin was stopped and started again with options set to not perform calculations, then clear out old targets
      deleteAllVessels();
    }
  };

  plugin.stop = async () => {
    app.debug(`Stopping plugin ${plugin.id}`);
    unsubscribes.forEach((f) => f());
    unsubscribes = [];
    stopUpdating();
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
          "Publish AIS Target CPA, TCPA, Range, Bearing, Priority, and Alarm Status to Signal K (navigation.closestApproach). This is not required if just using the webapp.",
        description: `(default is ${DEFAULT_ENABLE_DATA_PUBLISHING}).`,
        type: "boolean",
        default: DEFAULT_ENABLE_DATA_PUBLISHING,
      },
      enableAlarmPublishing: {
        title:
          "Publish AIS Target CPA and Guard warning/alarm notifications to Signal K (notifications.navigation.closestApproach). This is not required if just using the webapp.",
        description: `(default is ${DEFAULT_ENABLE_ALARM_PUBLISHING}).`,
        type: "boolean",
        default: DEFAULT_ENABLE_ALARM_PUBLISHING,
      },
    },
  };

  plugin.registerWithRouter = (router) => {
    // GET /plugins/${plugin.id}/loadCollisionProfiles
    router.get("/loadCollisionProfiles", (_req, res) => {
      app.debug("loadCollisionProfiles", collisionProfiles);
      res.json(collisionProfiles);
    });

    // PUT /plugins/${plugin.id}/saveCollisionProfiles
    router.put("/saveCollisionProfiles", (req, res) => {
      try {
        const newCollisionProfiles = req.body;
        app.debug("saveCollisionProfiles", newCollisionProfiles);
        setCollisionProfiles(newCollisionProfiles);
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
      muteAllAlarms();
      res.json();
    });

    // GET /plugins/${plugin.id}/setAlarmIsMuted/:mmsi/:alarmIsMuted
    router.get("/setAlarmIsMuted/:mmsi/:alarmIsMuted", (req, res) => {
      const mmsi = req.params.mmsi;
      const alarmIsMuted = req.params.alarmIsMuted === "true";
      app.debug("setting alarmIsMuted", mmsi, alarmIsMuted);
      setAlarmIsMuted(mmsi, alarmIsMuted);
      res.json();
    });

    // GET /plugins/${plugin.id}/getVessels
    router.get("/getVessels", (_req, res) => {
      app.debug("getVessels");
      res.json(vessels);
    });

    // GET /plugins/${plugin.id}/getVessel/:mmsi
    router.get("/getVessel/:mmsi", (req, res) => {
      let mmsi = req.params.mmsi;
      app.debug("getVessel", mmsi);
      if (mmsi in vessels) {
        res.json(vessels[mmsi]);
      } else {
        res.status(404).end();
      }
    });
  };

  // load saved collision profiles from signalk server
  function loadCollisionProfiles() {
    try {
      const dataDirPath = app.getDataDirPath();
      const collisionProfilesPath = path.join(
        dataDirPath,
        "collisionProfiles.json",
      );
      if (fs.existsSync(collisionProfilesPath)) {
        app.debug("Reading file", collisionProfilesPath);
        const savedCollisionProfiles = JSON.parse(
          fs.readFileSync(collisionProfilesPath).toString(),
        );
        setCollisionProfiles(savedCollisionProfiles);
      } else {
        app.debug(
          "collisionProfiles.json not found, using defaultCollisionProfiles",
          collisionProfilesPath,
        );

        saveCollisionProfiles();
      }
    } catch (err) {
      app.error("Error reading collisionProfiles.json:", err);
      throw new Error("Error reading collisionProfiles.json:", err);
    }
  }

  function saveCollisionProfiles() {
    app.debug("saving ", collisionProfiles);

    let dataDirPath = app.getDataDirPath();

    if (!fs.existsSync(dataDirPath)) {
      try {
        fs.mkdirSync(dataDirPath, { recursive: true });
      } catch (err) {
        app.error("Error creating dataDirPath:", err);
        throw new Error("Error creating dataDirPath:", err);
      }
    }

    let collisionProfilesPath = path.join(
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
    app.subscriptionmanager.subscribe(
      subscription,
      unsubscribes,
      (subscriptionError) => {
        app.error(`Error:${subscriptionError}`);
      },
      (delta) => {
        queueVesselUpdates(delta.context, delta.updates);
      },
    );

    updateVesselsLoop();
  }

  function updateVesselsLoop() {
    const start = performance.now();

    updateVessels();
    evaluateVessels();

    app.debug(
      `refreshed ${Object.keys(vessels).length} targets in ${(performance.now() - start).toFixed(1)}ms`,
    );

    timeoutId = setTimeout(updateVesselsLoop, updateIntervalDelay * 1000);
  }

  function stopUpdating() {
    if (!timeoutId) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  }

  function evaluateVessels() {
    try {
      if (myVessel?.lastSeenSecondsAgo > NO_GPS_FIX_WARNING) {
        const message = `No GPS position received for more than ${myVessel?.lastSeenSecondsAgo} seconds`;
        app.debug(message); // we use app.debug rather than app.error so that the user can filter these out of the log
        app.setPluginError(message);
        sendNotification("alarm", message);
        return;
      }

      let hasAlarm = false;

      for (const vessel of Object.values(vessels)) {
        const ignore =
          vessel.range === null ||
          vessel.range / METERS_PER_NM > maximumTargetRange;

        // app.debug(
        //   ">>>>>>>>>>>>",
        //   enableDataPublishing,
        //   vessel.mmsi,
        //   vesselsState.myVesselMmsi,
        //   ignore,
        // );

        if (
          enableDataPublishing &&
          vessel.mmsi !== vesselsState.myVesselMmsi &&
          !ignore
        ) {
          pushTargetDataToSignalK(vessel);
        }

        // publish warning/alarm notifications
        // FIXME - should we send 1 notification for all targets? or separate notifications for each vessel?
        if (
          enableAlarmPublishing &&
          vessel.alarmState &&
          !vessel.alarmIsMuted &&
          !ignore
        ) {
          const message = (
            `${vessel.name || `<${vessel.mmsi}>`} - ` +
            `${vessel.alarmType} ` +
            `${vessel.alarmState === "danger" ? "alarm" : vessel.alarmState}`
          ).toUpperCase();
          if (vessel.alarmState === "warning") {
            sendNotification("warn", message);
          } else if (vessel.alarmState === "danger") {
            sendNotification("alarm", message);
          }
          hasAlarm = true;
        }

        if (AGE_OUT_OLD_TARGETS && vessel.lastSeenSecondsAgo > TARGET_MAX_AGE) {
          app.debug(
            "ageing out vessel",
            vessel.mmsi,
            vessel.name,
            vessel.lastSeenSecondsAgo,
          );
          deleteVessel(vessel.mmsi);
        }
      } // end loop

      // if there are no active alarms, yet still an alarm notification, then clean the alarm notification
      if (!hasAlarm && hasAlarmNotification()) {
        sendNotification("normal", "watching");
      }

      app.setPluginStatus(`Watching ${Object.keys(vessels).length} targets`);
    } catch (err) {
      app.debug("error in refreshDataModel", err.message, err);
    }
  }

  function pushTargetDataToSignalK(vessel) {
    app.handleMessage(plugin.id, {
      context: vessel.context,
      updates: [
        {
          values: [
            {
              path: "navigation.closestApproach",
              value: {
                distance: vessel.cpa,
                timeTo: vessel.tcpa,
                range: vessel.range,
                bearing: vessel.bearing,
                collisionRiskRating: vessel.order,
                collisionAlarmType: vessel.alarmType,
                collisionAlarmState: vessel.alarmState,
              },
            },
          ],
        },
      ],
    });
  }

  // FIXME - we should probably shift these to the vessel context rather than self
  // FIXME - need to research the current stste of signalk notificatuons with ack features and such
  function sendNotification(state, message) {
    // app.debug("sendNotification", state, message);
    let delta = {
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

  function hasAlarmNotification() {
    const notifications = app.getSelfPath(
      "notifications.navigation.closestApproach",
    );
    return notifications?.value?.state === "alarm";
  }

  return plugin;
}
