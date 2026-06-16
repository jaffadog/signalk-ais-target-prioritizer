import { KNOTS_PER_M_PER_S, METERS_PER_NM } from "../../engine/constants";
import { toDeg } from "../../engine/calculations";

/** N 39° 57.0689 */
export function formatLat(dec: number): string | undefined {
  if (!Number.isFinite(dec)) return;
  const decAbs = Math.abs(dec);
  const deg = `0${Math.floor(decAbs)}`.slice(-2);
  const min = `0${((decAbs - Number(deg)) * 60).toFixed(4)}`.slice(-7);
  return `${dec > 0 ? "N" : "S"} ${deg}° ${min}`;
}

/** W 075° 08.3692 */
export function formatLon(dec: number): string | undefined {
  if (!Number.isFinite(dec)) return;
  const decAbs = Math.abs(dec);
  const deg = `00${Math.floor(decAbs)}`.slice(-3);
  const min = `0${((decAbs - Number(deg)) * 60).toFixed(4)}`.slice(-7);
  return `${dec > 0 ? "E" : "W"} ${deg}° ${min}`;
}

/** 1.53 NM */
export function formatDistance(distance: number): string | undefined {
  if (!Number.isFinite(distance)) return;
  return `${(distance / METERS_PER_NM).toFixed(2)} NM`;
}

/** 128 T */
export function formatAngle(degs: number): string | undefined {
  if (!Number.isFinite(degs)) return;
  return `${Math.round(degs)} T`;
}

/** 6.2 kn */
export function formatSpeed(metersPerSecond: number): string | undefined {
  if (!Number.isFinite(metersPerSecond)) return;
  return `${(metersPerSecond * KNOTS_PER_M_PER_S).toFixed(1)} kn`;
}

/** 82.0 m x 12.0 m */
export function formatSize(length: number, beam: number): string {
  return `${length?.toFixed(1) ?? "---"} m x ${beam?.toFixed(1) ?? "---"} m`;
}

/** 10.1 m */
export function formatDraft(draft: number): string | undefined {
  if (!Number.isFinite(draft)) return;
  return `${draft?.toFixed(1)} m`;
}

/** 1.6 deg/s */
export function formatRateOfTurn(r: number): string | undefined {
  if (!Number.isFinite(r)) return;
  return `${toDeg(r).toFixed(3)} deg/s`;
}

export function formatCpa(cpa: number, tcpa: number): string | undefined {
  if (!Number.isFinite(tcpa) || tcpa < 0) return;
  return formatDistance(cpa);
}

/** hh:mm:ss or mm:ss e.g. 01:15:23 or 51:37 */
export function formatTcpa(tcpa: number): string | undefined {
  if (!Number.isFinite(tcpa) || tcpa < 0) return;
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
  sog: number,
  cpa: number,
  tcpa: number,
): string {
  let vesselLabelText = `${formatName(mmsi, name)}\n`;
  if (sog > 0.1) {
    vesselLabelText += `${formatSpeed(sog)} `;
  }
  if (tcpa > 0 && tcpa < 3600 && Number.isFinite(cpa)) {
    vesselLabelText += `${formatCpa(cpa, tcpa)} `;
  }
  if (tcpa > 0 && tcpa < 3600) {
    vesselLabelText += formatTcpa(tcpa);
  }
  return vesselLabelText.trim();
}
