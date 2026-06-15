// SignalK WS parser, writes to vessels

import { WebSocket } from "partysocket";
import { createVessel, vessels, vesselsState } from "./vessels.svelte";

export const ingestion = $state({
  connectionState: "disconnected",
});

// eslint-disable-next-line svelte/prefer-svelte-reactivity
const pendingUpdates = new Map();
// let flushTimer = null;

// context: "vessels.urn:mrn:imo:mmsi:236333000"
export function extractMmsi(context) {
  if (!context) return null;
  return context.match(/mmsi:(\d{9})$/)?.[1] ?? null;
}

// ==============================
// Process Vessel Updates
// ==============================
function upsertVessel(context, updates) {
  if (!context) return;

  const mmsi = extractMmsi(context);
  if (!mmsi) return;

  if (!(mmsi in vessels)) {
    vessels[mmsi] = createVessel(mmsi, context);
  }

  const vessel = vessels[mmsi];

  if (!updates) return;
  for (const update of updates) {
    if (!update.values) return;
    for (const updateValue of update.values) {
      const value = updateValue.value;
      switch (updateValue.path) {
        case "":
          if (value.name) {
            vessel.name = value.name ?? "";
          } else if (value.communication?.callsignVhf) {
            vessel.callsign = value.communication.callsignVhf;
          } else if (value.registrations?.imo) {
            vessel.imo = value.registrations.imo.replace(/imo /i, "");
          }
          break;
        case "navigation.position":
          vessel.latitude = value.latitude;
          vessel.longitude = value.longitude;
          vessel.lastSeenDate = new Date(update.timestamp);
          // console.log("update position", mmsi);
          break;
        case "navigation.courseOverGroundTrue":
          vessel.cog = value ?? 0;
          break;
        case "navigation.speedOverGround":
          vessel.sog = value ?? 0;
          break;
        case "navigation.magneticVariation":
          vessel.magvar = value;
          break;
        case "navigation.headingTrue":
          vessel.hdg = value;
          break;
        case "navigation.rateOfTurn":
          vessel.rot = value;
          break;
        case "navigation.specialManeuver":
          vessel.specialManeuver = value;
          break;
        case "design.aisShipType":
          vessel.typeId = value.id;
          vessel.type = value.name;
          break;
        case "navigation.state":
          vessel.status = value;
          break;
        case "sensors.ais.class":
          vessel.aisClass = value;
          break;
        case "navigation.destination.commonName":
          vessel.destination = value;
          break;
        case "design.length":
          vessel.length = value.overall;
          break;
        case "design.beam":
          vessel.beam = value;
          break;
        case "design.draft":
          vessel.draft = value.current;
          break;
        case "atonType":
          vessel.typeId = value.id;
          vessel.type = value.name;
          vessel.status ??= "default";
          break;
        case "offPosition":
          vessel.isOffPosition = value ? 1 : 0;
          break;
        case "virtual":
          vessel.isVirtual = value ? 1 : 0;
          break;
        default:
        // console.warn("unexpected delta value", mmsi, value.path, v);
      }
    }
  }
}

// FIXME make this more efficient by aggregating by vessel and attribute
export function queueVesselUpdates(context, updates) {
  if (!context || !updates?.length) return;

  const current = pendingUpdates.get(context);
  if (current) {
    current.push(...updates);
  } else {
    pendingUpdates.set(context, [...updates]);
  }

  // if (flushTimer == null) {
  //   flushTimer = setTimeout(flushPendingUpdates, 1000);
  // }
}

// ==============================
// Signal-K Subscription
// ==============================
export const subscription = {
  context: "*",
  subscribe: [
    { path: "", period: 1000, policy: "fixed" },
    { path: "navigation.position", period: 1000, policy: "fixed" },
    {
      path: "navigation.courseOverGroundTrue",
      period: 1000,
      policy: "fixed",
    },
    {
      path: "navigation.speedOverGround",
      period: 1000,
      policy: "fixed",
    },
    {
      path: "navigation.magneticVariation",
      period: 1000,
      policy: "fixed",
    },
    { path: "navigation.headingTrue", period: 1000, policy: "fixed" },
    { path: "navigation.state", period: 1000, policy: "fixed" },
    {
      path: "navigation.destination.commonName",
      period: 1000,
      policy: "fixed",
    },
    {
      path: "navigation.rateOfTurn",
      period: 1000,
      policy: "fixed",
    },
    {
      path: "navigation.specialManeuver",
      period: 1000,
      policy: "fixed",
    },
    { path: "design.*", period: 1000, policy: "fixed" },
    { path: "sensors.ais.class", period: 1000, policy: "fixed" },
    { path: "atonType", period: 1000, policy: "fixed" },
    { path: "offPosition", period: 1000, policy: "fixed" },
    { path: "virtual", period: 1000, policy: "fixed" },
  ],
};

// ==============================
// Streaming with reconnect
// ==============================

function startStreaming(host) {
  ingestion.connectionState = "Connecting";
  const ws = new WebSocket(`ws://${host}/signalk/v1/stream?subscribe=none`);

  const onOpen = () => {
    console.log("connected");
    ingestion.connectionState = "Connected";
    ws.send(JSON.stringify(subscription));
  };

  const onMessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.self) {
      vesselsState.myVesselMmsi = extractMmsi(msg.self);
      return;
    }

    queueVesselUpdates(msg.context, msg.updates);
  };

  const onError = () => {
    console.log("WebSocket error", { retryCount: ws.retryCount });
    ingestion.connectionState = "Error connecting";
  };

  const onClose = (e) => {
    console.log("WebSocket closed", {
      code: e.code,
      reason: e.reason,
      wasClean: e.wasClean,
      retryCount: ws.retryCount,
    });
    ingestion.connectionState = e.wasClean ? "Disconnected" : "Reconnecting";
  };

  ws.addEventListener("open", onOpen);
  ws.addEventListener("message", onMessage);
  ws.addEventListener("error", onError);
  ws.addEventListener("close", onClose);

  return () => {
    ws.removeEventListener("open", onOpen);
    ws.removeEventListener("message", onMessage);
    ws.removeEventListener("error", onError);
    ws.removeEventListener("close", onClose);
    ws.close();
  };
}

// ==============================
// Public API
// ==============================

let stopWs = null;

export async function start(host) {
  // await bootstrap(baseUrl);
  if (stopWs) stop(); // close any existing connection first
  stopWs = startStreaming(host);
}

export function stop() {
  if (stopWs) {
    stopWs();
    stopWs = null;
  }
}

export function flushPendingUpdates() {
  // flushTimer = null;

  if (pendingUpdates.size === 0) return;

  for (const [context, updates] of pendingUpdates) {
    upsertVessel(context, updates);
  }

  pendingUpdates.clear();
}
