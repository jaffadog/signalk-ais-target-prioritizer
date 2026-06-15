import { COLOR_MAP, COLORS } from "../../engine/constants";
import { vesselsState } from "../../engine/vessels.svelte";

const LOGICAL_SIZE = 32; // how big the icon appears on the map
export const PIXEL_RATIO = 2; // for retina/HiDPI
const CANVAS_SIZE = LOGICAL_SIZE * PIXEL_RATIO; // → 64 canvas pixels

const SHIP_TYPES = ["class-a", "class-b", "aton", "base"];
const LINE_WIDTH = 4;
const FILL_OPACITY = 0.5;

export function getVesselIconName(vessel) {
  let iconType;
  let color;

  // my vessel
  if (vessel.mmsi === vesselsState.myVesselMmsi) {
    return "vessel-my-vessel";
  }
  // 111MIDXXX        SAR (Search and Rescue) aircraft
  // 970MIDXXX        AIS SART (Search and Rescue Transmitter)
  // 972XXXXXX        MOB (Man Overboard) device
  // 974XXXXXX        EPIRB (Emergency Position Indicating Radio Beacon) AIS
  else if (
    vessel.mmsi.startsWith("111") ||
    vessel.mmsi.startsWith("970") ||
    vessel.mmsi.startsWith("972") ||
    vessel.mmsi.startsWith("974")
  ) {
    return "vessel-sart";
  }
  // 99MIDXXXX        Aids to Navigation
  else if (vessel.aisClass === "ATON" || vessel.mmsi.startsWith("99")) {
    iconType = "aton";
  }
  // class A
  else if (vessel.aisClass === "A") {
    iconType = "class-a";
  }
  // BASE
  else if (vessel.aisClass === "BASE") {
    iconType = "base";
  }
  // class B
  else {
    iconType = "class-b";
  }

  if (vessel.mmsi === vesselsState.selectedVesselMmsi) {
    color = "blue";
  } else if (vessel.alarmState === "danger") {
    color = "red";
  } else if (vessel.alarmState === "warning") {
    color = "orange";
  } else {
    color = "gray";
  }

  return `vessel-${iconType}-${color}`;
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function registerAllIcons(map) {
  // create gray, orange, red, and blue variants
  // of class A, B, ATON, and BASE vessel icons
  for (const type of SHIP_TYPES) {
    for (const color of COLORS) {
      addImage(
        map,
        `vessel-${type}-${color}`,
        createVesselIcon(type, COLOR_MAP[color]),
      );
    }
  }

  // my vessel icon is always gray
  addImage(map, "vessel-my-vessel", createMyVessel());

  // sart icon is always red
  addImage(map, "vessel-sart", createSart());

  // vessel lost icon is always red
  addImage(map, "vessel-lost-x", createLostX());

  // vessel selected icon is always blue
  addImage(map, "vessel-selected", createBlueBox());
}

function addImage(map, imageName, image) {
  if (!map.hasImage(imageName)) {
    map.addImage(imageName, image, {
      pixelRatio: PIXEL_RATIO,
    });
  }
}

function createVesselIcon(type, hexColor) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);

  switch (type) {
    case "class-a":
      drawClassA(ctx);
      break;
    case "class-b":
      drawClassB(ctx);
      break;
    case "aton":
      drawAton(ctx);
      break;
    case "base":
      drawBase(ctx);
      break;
    default:
      drawClassA(ctx);
  }

  ctx.fillStyle = hexToRgba(hexColor, FILL_OPACITY);
  ctx.strokeStyle = hexColor;
  ctx.lineWidth = LINE_WIDTH;
  ctx.fill();
  ctx.stroke();

  return ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

function drawClassA(ctx) {
  var boatLengthToBeam = 2.2;
  var bowLengthToBoatLength = 0.4;
  var margin = 10;
  var boatLength = CANVAS_SIZE - 2 * margin;
  var boatBeam = boatLength / boatLengthToBeam;

  ctx.beginPath();
  ctx.moveTo(-boatBeam / 2, boatLength / 2);
  ctx.lineTo(
    -boatBeam / 2,
    -boatLength / 2 + boatLength * bowLengthToBoatLength,
  );
  ctx.lineTo(0, -boatLength / 2);
  ctx.lineTo(
    boatBeam / 2,
    -boatLength / 2 + boatLength * bowLengthToBoatLength,
  );
  ctx.lineTo(boatBeam / 2, boatLength / 2);
  ctx.closePath();
}

function drawClassB(ctx) {
  const boatLengthToBeam = 1.8;
  const margin = 10;
  const boatLength = CANVAS_SIZE - 2 * margin;
  const boatCenterOffset = margin / 2;
  const boatBeam = boatLength / boatLengthToBeam;

  ctx.beginPath();
  ctx.moveTo(-boatBeam / 2, boatLength / 2 - boatCenterOffset);
  ctx.lineTo(0, -boatLength / 2 - boatCenterOffset);
  ctx.lineTo(boatBeam / 2, boatLength / 2 - boatCenterOffset);
  ctx.closePath();
}

function drawAton(ctx) {
  const margin = 22;
  const atonSize = CANVAS_SIZE - 2 * margin;
  const crosshairLength = atonSize * 0.6;

  // inner plus symbol
  ctx.beginPath();
  ctx.moveTo(0, -crosshairLength / 2);
  ctx.lineTo(0, crosshairLength / 2);
  ctx.moveTo(-crosshairLength / 2, 0);
  ctx.lineTo(crosshairLength / 2, 0);

  // outer diamond
  ctx.rotate((45 * Math.PI) / 180);
  ctx.rect(-atonSize / 2, -atonSize / 2, atonSize, atonSize);
}

function drawBase(ctx) {
  const margin = 20;
  const baseSize = CANVAS_SIZE - 2 * margin;
  const crosshairLength = baseSize * 0.6;

  // inner plus symbol
  ctx.beginPath();
  ctx.moveTo(0, -crosshairLength / 2);
  ctx.lineTo(0, crosshairLength / 2);
  ctx.moveTo(-crosshairLength / 2, 0);
  ctx.lineTo(crosshairLength / 2, 0);

  // outer box
  ctx.rect(-baseSize / 2, -baseSize / 2, baseSize, baseSize);
}

function createLostX() {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);

  const pad = 30;

  ctx.strokeStyle = COLOR_MAP["red"];
  ctx.lineWidth = LINE_WIDTH;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(-(CANVAS_SIZE - pad) / 2, -(CANVAS_SIZE - pad) / 2);
  ctx.lineTo((CANVAS_SIZE - pad) / 2, (CANVAS_SIZE - pad) / 2);
  ctx.moveTo(-(CANVAS_SIZE - pad) / 2, (CANVAS_SIZE - pad) / 2);
  ctx.lineTo((CANVAS_SIZE - pad) / 2, -(CANVAS_SIZE - pad) / 2);
  ctx.stroke();

  return ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

function createMyVessel() {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);

  ctx.strokeStyle = COLOR_MAP["gray"];
  ctx.lineWidth = LINE_WIDTH;

  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, 2 * Math.PI);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, 2 * Math.PI);
  ctx.stroke();

  return ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

function createSart() {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);

  ctx.strokeStyle = COLOR_MAP["red"];
  ctx.lineWidth = LINE_WIDTH;

  const radius = 30;

  // outer circle
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, 2 * Math.PI);
  ctx.stroke();

  // inner cross
  ctx.rotate((45 * Math.PI) / 180);
  ctx.beginPath();
  ctx.moveTo(0, -radius);
  ctx.lineTo(0, radius);
  ctx.moveTo(-radius, 0);
  ctx.lineTo(radius, 0);
  ctx.stroke();

  return ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

function createBlueBox() {
  const size = CANVAS_SIZE * 2;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.translate(size / 2, size / 2);

  ctx.strokeStyle = COLOR_MAP["blue"];
  ctx.lineWidth = 10;

  var margin = 16;
  var blueBoxSize = size - 2 * margin;

  ctx.setLineDash([
    (blueBoxSize * 3) / 4,
    blueBoxSize / 4,
    (blueBoxSize * 3) / 4,
    blueBoxSize / 4,
  ]);

  ctx.lineDashOffset = (blueBoxSize * 3) / 8;

  ctx.beginPath();
  ctx.rect(-blueBoxSize / 2, -blueBoxSize / 2, blueBoxSize, blueBoxSize);
  ctx.stroke();

  return ctx.getImageData(0, 0, size, size);
}
