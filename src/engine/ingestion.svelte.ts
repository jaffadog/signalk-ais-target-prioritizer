// Signal K WS parser, writes to vessels

import { WebSocket } from "partysocket";
import { createVessel, vessels, vesselsState } from "./vessels.svelte";
import type {
  Context,
  Delta,
  PathValue,
  SubscribeMessage,
  Update,
} from "@signalk/server-api";

const hasValues = (
  update: Update,
): update is Update & { values: PathValue[] } => "values" in update;

export const CONNECTING = "connecting";
export const CONNECTED = "connected";
export const ERROR_CONNECTING = "error_connecting";
export const DISCONNECTED = "disconnected";
export const RECONNECTING = "reconnecting";

export type ConnectionState =
  | typeof CONNECTING
  | typeof CONNECTED
  | typeof ERROR_CONNECTING
  | typeof DISCONNECTED
  | typeof RECONNECTING;

export const ingestion = $state({
  connectionState: DISCONNECTED as ConnectionState,
});

// eslint-disable-next-line svelte/prefer-svelte-reactivity
const pendingUpdates = new Map();

// ==============================
// Process Vessel Updates
// ==============================
function upsertVessel(context: Context, updates: Update[]) {
  if (!context) return;

  if (!(context in vessels)) {
    vessels[context] = createVessel(context);
  }

  const vessel = vessels[context];

  if (!updates) return;
  for (const update of updates) {
    if (hasValues(update)) {
      for (const { path, value } of update.values) {
        if (value !== null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const v = value as any;
          switch (path) {
            case "":
              if (v.mmsi) {
                vessel.mmsi = v.mmsi ?? "";
              } else if (v.name) {
                vessel.name = v.name ?? "";
              } else if (v.communication?.callsignVhf) {
                vessel.callsign = v.communication.callsignVhf;
              } else if (v.registrations?.imo) {
                vessel.imo = v.registrations.imo.replace(/imo /i, "");
              }
              break;
            case "navigation.position":
              vessel.latitude = v.latitude;
              vessel.longitude = v.longitude;
              vessel.lastSeenDate = update.timestamp
                ? new Date(update.timestamp as string)
                : new Date();
              break;
            case "navigation.courseOverGroundTrue":
              vessel.cog = v ?? 0;
              break;
            case "navigation.speedOverGround":
              vessel.sog = v ?? 0;
              break;
            case "navigation.magneticVariation":
              vessel.magvar = v;
              break;
            case "navigation.headingTrue":
              vessel.hdg = v;
              break;
            case "navigation.rateOfTurn":
              vessel.rot = v;
              break;
            case "navigation.specialManeuver":
              vessel.specialManeuver = v;
              break;
            case "design.aisShipType":
              vessel.typeId = v.id;
              vessel.type = v.name;
              break;
            case "navigation.state":
              vessel.status = v;
              break;
            case "sensors.ais.class":
              vessel.aisClass = v;
              break;
            case "navigation.destination.commonName":
              vessel.destination = v;
              break;
            case "design.length":
              vessel.length = v.overall;
              break;
            case "design.beam":
              vessel.beam = v;
              break;
            case "design.draft":
              vessel.draft = v.current;
              break;
            case "atonType":
              vessel.typeId = v.id;
              vessel.type = v.name;
              vessel.status ??= "default";
              break;
            case "offPosition":
              vessel.isOffPosition = v ? 1 : 0;
              break;
            case "virtual":
              vessel.isVirtual = v ? 1 : 0;
              break;
            default:
            // console.warn("unexpected delta value", mmsi, value.path, v);
          }
        }
      }
    }
  }
}

// TODO make this more efficient by aggregating by vessel and attribute
export function queueVesselUpdates(context: Context, updates: Update[]) {
  if (!context || !updates?.length) return;

  const current = pendingUpdates.get(context);
  if (current) {
    current.push(...updates);
  } else {
    pendingUpdates.set(context, [...updates]);
  }
}

// ==============================
// Signal K Subscription
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
} as SubscribeMessage;

// ==============================
// Streaming with reconnect
// ==============================

function startStreaming(host: string) {
  ingestion.connectionState = CONNECTING;
  const ws = new WebSocket(`ws://${host}/signalk/v1/stream?subscribe=none`);

  const onOpen = () => {
    console.log("connected");
    ingestion.connectionState = CONNECTED;
    ws.send(JSON.stringify(subscription));
  };

  const onMessage = (event: MessageEvent) => {
    const msg = JSON.parse(event.data) as Delta & { self?: string };

    if (msg.self) {
      vesselsState.myVesselContext = msg.self as Context;
      return;
    }

    if (msg.context) queueVesselUpdates(msg.context, msg.updates);
  };

  const onError = () => {
    console.log("WebSocket error", { retryCount: ws.retryCount });
    ingestion.connectionState = ERROR_CONNECTING;
  };

  const onClose = (event: CloseEvent) => {
    console.log("WebSocket closed", {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      retryCount: ws.retryCount,
    });
    ingestion.connectionState = event.wasClean ? DISCONNECTED : RECONNECTING;
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

let stopWs: (() => void) | null = null;

export async function start(host: string) {
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

let flushInProgress = false;

export function flushPendingUpdates() {
  // console.log("ENTER flushPendingUpdates", flushInProgress);
  if (flushInProgress) {
    return;
  }
  flushInProgress = true;

  // const start = performance.now();
  const updateCount = pendingUpdates.size;

  if (updateCount > 0) {
    for (const [context, updates] of pendingUpdates) {
      upsertVessel(context, updates);
    }

    pendingUpdates.clear();
    // console.log(
    //   `flushed ${updateCount} updates in ${(performance.now() - start).toFixed(1)} ms`,
    // );
  }

  // console.log("EXIT flushPendingUpdates");
  flushInProgress = false;
}
