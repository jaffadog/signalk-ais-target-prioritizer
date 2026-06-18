import { KNOTS_PER_M_PER_S, METERS_PER_NM } from "../../engine/constants";
import { isValidNumber, toDeg } from "../../engine/calculations";

/** N 39° 57.0689 */
export function formatLat(dec: number): string | undefined {
  if (!isValidNumber(dec)) return;
  const decAbs = Math.abs(dec);
  const deg = `0${Math.floor(decAbs)}`.slice(-2);
  const min = `0${((decAbs - Number(deg)) * 60).toFixed(4)}`.slice(-7);
  return `${dec > 0 ? "N" : "S"} ${deg}° ${min}`;
}

/** W 075° 08.3692 */
export function formatLon(dec: number): string | undefined {
  if (!isValidNumber(dec)) return;
  const decAbs = Math.abs(dec);
  const deg = `00${Math.floor(decAbs)}`.slice(-3);
  const min = `0${((decAbs - Number(deg)) * 60).toFixed(4)}`.slice(-7);
  return `${dec > 0 ? "E" : "W"} ${deg}° ${min}`;
}

/** 1.53 NM */
export function formatDistance(
  distance: number | undefined,
): string | undefined {
  if (!isValidNumber(distance)) return;
  return `${(distance / METERS_PER_NM).toFixed(2)} NM`;
}

/** 128 T */
export function formatAngle(degs: number | undefined): string | undefined {
  if (!isValidNumber(degs)) return;
  return `${Math.round(degs)} T`;
}

/** 6.2 kn */
export function formatSpeed(
  metersPerSecond: number | null,
): string | undefined {
  if (!isValidNumber(metersPerSecond)) return;
  return `${(metersPerSecond * KNOTS_PER_M_PER_S).toFixed(1)} kn`;
}

/** 82.0 m x 12.0 m */
export function formatSize(length: number | null, beam: number | null): string {
  return `${isValidNumber(length) ? length.toFixed(1) : "---"} m x ${isValidNumber(beam) ? beam.toFixed(1) : "---"} m`;
}

/** 10.1 m */
export function formatDraft(draft: number): string | undefined {
  if (!isValidNumber(draft)) return;
  return `${draft?.toFixed(1)} m`;
}

/** 1.6 deg/s */
export function formatRateOfTurn(r: number): string | undefined {
  if (!isValidNumber(r)) return;
  return `${toDeg(r).toFixed(3)} deg/s`;
}

export function formatCpa(
  cpa: number | undefined,
  tcpa: number | undefined,
): string | undefined {
  if (!isValidNumber(tcpa) || tcpa < 0) return;
  return formatDistance(cpa);
}

/** hh:mm:ss or mm:ss e.g. 01:15:23 or 51:37 */
export function formatTcpa(tcpa: number | undefined): string | undefined {
  if (!isValidNumber(tcpa) || tcpa < 0) return;
  // when more than 60 mins, then format hh:mm:ss
  else if (Math.abs(tcpa) >= 3600) {
    return new Date(1000 * Math.abs(tcpa)).toISOString().substring(11, 19); // + ' hours'
  }
  // when less than 60 mins, then format mm:ss
  else {
    return new Date(1000 * Math.abs(tcpa)).toISOString().substring(14, 19); // + ' mins'
  }
}

export function formatName(mmsi: string, name: string): string {
  return `${name ? name.replaceAll("@", "") : `<${mmsi}>`}`;
}

export function formatVesselLabel(
  mmsi: string,
  name: string,
  sog: number | null,
  cpa: number | undefined,
  tcpa: number | undefined,
): string {
  let vesselLabelText = `${formatName(mmsi, name)}\n`;
  if (isValidNumber(sog) && sog > 0.1) {
    vesselLabelText += `${formatSpeed(sog)} `;
  }
  if (isValidNumber(tcpa) && tcpa > 0 && tcpa < 3600 && isValidNumber(cpa)) {
    vesselLabelText += `${formatCpa(cpa, tcpa)} `;
  }
  if (isValidNumber(tcpa) && tcpa > 0 && tcpa < 3600) {
    vesselLabelText += formatTcpa(tcpa);
  }
  return vesselLabelText.trim();
}
