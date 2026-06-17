import {
  type Plugin,
  type ServerAPI,
  type Context,
  type Path,
  type Unsubscribes,
  type Notification,
} from "@signalk/server-api";
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
import {
  AGE_OUT_OLD_TARGETS,
  DEFAULT_ENABLE_ALARM_PUBLISHING,
  DEFAULT_ENABLE_DATA_PUBLISHING,
  DEFAULT_MAXIMUM_TARGET_RANGE,
  DEFAULT_UPDATE_INTERVAL_DELAY,
  METERS_PER_NM,
  NO_GPS_FIX_WARNING,
  TARGET_MAX_AGE,
} from "../engine/constants";
import { registerAssetEndpoints } from "./font-downloader";
import { schema } from "./schema";
import type { Vessel } from "../types";

const myVessel = $derived(
  vesselsState.myVesselMmsi !== undefined
    ? vessels[vesselsState.myVesselMmsi]
    : null,
);

interface Options {
  enabled: boolean;
  updateIntervalDelay: number;
  maximumTargetRange: number;
  enableDataPublishing: boolean;
  enableAlarmPublishing: boolean;
}

let timeoutId: NodeJS.Timeout | null;

let updateIntervalDelay: number;
let maximumTargetRange: number;
let enableDataPublishing: boolean;
let enableAlarmPublishing: boolean;

export default function (app: ServerAPI) {
  let unsubscribes: Unsubscribes = [];

  const plugin: Plugin = {
    id: npmPackage.name,
    name: npmPackage.signalk.displayName,
    description: npmPackage.description,
    schema,
    start,
    stop,
  };

  function start(
    options: Options,
    _restart: (newConfiguration: object) => void,
  ) {
    app.debug(`*** Starting plugin ${plugin.id}`, { options });
    updateIntervalDelay =
      options.updateIntervalDelay ?? DEFAULT_UPDATE_INTERVAL_DELAY;
    maximumTargetRange =
      options.maximumTargetRange ?? DEFAULT_MAXIMUM_TARGET_RANGE;
    enableDataPublishing =
      options.enableDataPublishing ?? DEFAULT_ENABLE_DATA_PUBLISHING;
    enableAlarmPublishing =
      options.enableAlarmPublishing ?? DEFAULT_ENABLE_ALARM_PUBLISHING;
    loadCollisionProfiles();

    const mmsi: string = app.getSelfPath("mmsi") as string;

    if (!mmsi) {
      app.error("ERROR - no mmsi set for our vessel");
      throw new Error("ERROR - no mmsi set for our vessel");
    }

    vesselsState.myVesselMmsi = mmsi;

    if (enableDataPublishing || enableAlarmPublishing) {
      enablePluginCpaCalculations();
    } else {
      // if plugin was stopped and started again with options set to not perform calculations, then clear out old targets
      deleteAllVessels();
    }
  }

  function stop() {
    app.debug(`Stopping plugin ${plugin.id}`);
    unsubscribes.forEach((f) => f());
    unsubscribes = [];
    stopUpdating();
    app.debug(`Stopped plugin ${plugin.id}`);
  }

  plugin.registerWithRouter = (router) => {
    router.get("/loadCollisionProfiles", (_req, res) => {
      app.debug("loadCollisionProfiles", collisionProfiles);
      res.json(collisionProfiles);
    });

    router.put("/saveCollisionProfiles", (req, res) => {
      try {
        const newCollisionProfiles = req.body;
        app.debug("saveCollisionProfiles", newCollisionProfiles);
        setCollisionProfiles(newCollisionProfiles);
        saveCollisionProfiles();
        res.json(collisionProfiles);
      } catch (error) {
        app.error("ERROR - not saving invalid new collision profiles");
        res.status(400).json({ error });
      }
    });

    router.get("/muteAllAlarms", (_req, res) => {
      app.debug("muteAllAlarms");
      muteAllAlarms();
      res.json();
    });

    router.get("/setAlarmIsMuted/:mmsi/:alarmIsMuted", (req, res) => {
      const mmsi = req.params.mmsi;
      const alarmIsMuted = req.params.alarmIsMuted === "true";
      app.debug("setting alarmIsMuted", mmsi, alarmIsMuted);
      setAlarmIsMuted(mmsi, alarmIsMuted);
      res.json();
    });

    router.get("/getVessels", (_req, res) => {
      app.debug("getVessels");
      res.json(vessels);
    });

    router.get("/getVessel/:mmsi", (req, res) => {
      const mmsi = req.params.mmsi;
      app.debug("getVessel", mmsi);
      if (mmsi in vessels) {
        res.json(vessels[mmsi]);
      } else {
        res.status(404).end();
      }
    });

    registerAssetEndpoints(router);
  };

  // FIXME dupe
  // function start(options: Options, restartPlugin: () => void): void {
  //   app.debug(`*** Starting plugin ${plugin.id}`, { options });
  //   updateIntervalDelay =
  //     options.updateIntervalDelay ?? DEFAULT_UPDATE_INTERVAL_DELAY;
  //   maximumTargetRange =
  //     options.maximumTargetRange ?? DEFAULT_MAXIMUM_TARGET_RANGE;
  //   enableDataPublishing =
  //     options.enableDataPublishing ?? DEFAULT_ENABLE_DATA_PUBLISHING;
  //   enableAlarmPublishing =
  //     options.enableAlarmPublishing ?? DEFAULT_ENABLE_ALARM_PUBLISHING;

  //   loadCollisionProfiles();

  //   const mmsi: string = app.getSelfPath("mmsi") as string;

  //   if (!mmsi) {
  //     app.error("ERROR - no mmsi set for our vessel");
  //     throw new Error("ERROR - no mmsi set for our vessel");
  //   }

  //   vesselsState.myVesselMmsi = mmsi;

  //   if (enableDataPublishing || enableAlarmPublishing) {
  //     enablePluginCpaCalculations();
  //   } else {
  //     // if plugin was stopped and started again with options set to not perform calculations, then clear out old targets
  //     deleteAllVessels();
  //   }
  // }

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
      app.error("Error reading collisionProfiles.json");
      throw new Error("Error reading collisionProfiles.json:", { cause: err });
    }
  }

  function saveCollisionProfiles() {
    app.debug("saving ", collisionProfiles);

    const dataDirPath = app.getDataDirPath();

    if (!fs.existsSync(dataDirPath)) {
      try {
        fs.mkdirSync(dataDirPath, { recursive: true });
      } catch (err) {
        app.error("Error creating dataDirPath");
        throw new Error("Error creating dataDirPath:", { cause: err });
      }
    }

    const collisionProfilesPath: string = path.join(
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
      app.error("Error writing collisionProfiles.json");
      throw new Error("Error writing collisionProfiles.json:", { cause: err });
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
        if (delta.context) queueVesselUpdates(delta.context, delta.updates);
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
      if (
        myVessel &&
        myVessel.lastSeenSecondsAgo !== undefined &&
        myVessel.lastSeenSecondsAgo > NO_GPS_FIX_WARNING
      ) {
        const message = `No GPS position received for more than ${myVessel?.lastSeenSecondsAgo} seconds`;
        app.debug(message); // we use app.debug rather than app.error so that the user can filter these out of the log
        app.setPluginError(message);
        sendNotification("alarm", message);
        return;
      }

      let hasAlarm = false;

      for (const vessel of Object.values(vessels)) {
        const ignore =
          vessel.range === undefined ||
          vessel.range / METERS_PER_NM > maximumTargetRange;

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

        if (
          AGE_OUT_OLD_TARGETS &&
          vessel.lastSeenSecondsAgo !== undefined &&
          vessel.lastSeenSecondsAgo > TARGET_MAX_AGE
        ) {
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
      app.debug("error in refreshDataModel", err);
    }
  }

  function pushTargetDataToSignalK(vessel: Vessel): void {
    app.handleMessage(plugin.id, {
      context: vessel.context as Context,
      updates: [
        {
          values: [
            {
              path: "navigation.closestApproach" as Path,
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
  function sendNotification(state: string, message: string): void {
    // app.debug("sendNotification", state, message);
    const delta = {
      updates: [
        {
          values: [
            {
              path: "notifications.navigation.closestApproach" as Path,
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
    ) as Notification;
    return notifications?.state === "alarm";
  }

  return plugin;
}
