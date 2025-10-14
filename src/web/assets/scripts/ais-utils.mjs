import { mmsiMidToCountry } from "./mmsi-mid-decoder.mjs";

const METERS_PER_NM = 1852;
const KNOTS_PER_M_PER_S = 1.94384;
const LOST_TARGET_WARNING_AGE = 10 * 60; // in seconds - 10 minutes

export function updateDerivedData(
	targets,
	selfTarget,
	collisionProfiles,
	TARGET_MAX_AGE,
) {
	// update self first
	if (!selfTarget) {
		console.warn(
			"No GPS position available (no data for our own vessel)",
			selfTarget,
		);
		throw new Error("No GPS position available (no data for our own vessel)");
		// FIXME: raise an alarm notification for this
		// FIXME: post a plugin error status for this
		//return;
	}

	updateSingleTargetDerivedData(
		selfTarget,
		selfTarget,
		collisionProfiles,
		TARGET_MAX_AGE,
	);

	if (!selfTarget.isValid) {
		console.warn("No GPS position available (data is invalid)", selfTarget);
		throw new Error("No GPS position available (data is invalid)");
		// FIXME: raise an alarm notification for this
		// FIXME: post a plugin error status for this
		//return;
	}

	// then update all other targets
	targets.forEach((target, mmsi) => {
		if (mmsi !== selfTarget.mmsi) {
			updateSingleTargetDerivedData(
				target,
				selfTarget,
				collisionProfiles,
				TARGET_MAX_AGE,
			);
		}
	});
}

export function toRadians(v) {
	return (v * Math.PI) / 180;
}

export function toDegrees(v) {
	return (v * 180) / Math.PI;
}

function updateSingleTargetDerivedData(
	target,
	selfTarget,
	collisionProfiles,
	TARGET_MAX_AGE,
) {
	target.y = target.latitude * 111120;
	// FIXME this might work better using an average of the latitudes of the target and selfTarget
	target.x =
		target.longitude * 111120 * Math.cos(toRadians(selfTarget.latitude));
	target.vy = target.sog * Math.cos(target.cog); // cog is in radians
	target.vx = target.sog * Math.sin(target.cog); // cog is in radians

	if (target.mmsi !== selfTarget.mmsi) {
		calculateRangeAndBearing(selfTarget, target);
		updateCpa(selfTarget, target);
		evaluateAlarms(target, collisionProfiles);
	}

	var lastSeen = Math.round((Date.now() - target.lastSeenDate) / 1000);
	if (lastSeen < 0) {
		lastSeen = 0;
	}

	var mmsiMid = getMid(target.mmsi);

	target.lastSeen = lastSeen;
	target.isLost = lastSeen > LOST_TARGET_WARNING_AGE;
	target.mmsiCountryCode = mmsiMidToCountry.get(mmsiMid)?.code;
	target.mmsiCountryName = mmsiMidToCountry.get(mmsiMid)?.name;
	target.cpaFormatted = formatCpa(target.cpa);
	target.tcpaFormatted = formatTcpa(target.tcpa);
	target.rangeFormatted =
		target.range != null
			? `${(target.range / METERS_PER_NM).toFixed(2)} NM`
			: "---";
	target.bearingFormatted =
		target.bearing != null ? `${target.bearing} T` : "---";
	target.sogFormatted =
		target.sog != null
			? `${(target.sog * KNOTS_PER_M_PER_S).toFixed(1)} kn`
			: "---";
	target.cogFormatted =
		target.cog != null ? `${Math.round(toDegrees(target.cog))} T` : "---";
	target.hdgFormatted =
		target.hdg != null ? `${Math.round(toDegrees(target.hdg))} T` : "---";
	target.rotFormatted = Math.round(toDegrees(target.rot)) || "---";
	target.aisClassFormatted =
		target.aisClass + (target.isVirtual ? " (virtual)" : "");
	target.sizeFormatted = `${target.length?.toFixed(1) ?? "---"} m x ${target.beam?.toFixed(1) ?? "---"} m`;
	target.imoFormatted = target.imo?.replace(/imo/i, "") || "---";
	target.latitudeFormatted = formatLat(target.latitude);
	target.longitudeFormatted = formatLon(target.longitude);

	if (
		!target.latitude ||
		!target.longitude ||
		target.lastSeen > TARGET_MAX_AGE
	) {
		//console.log("invalid target", target.mmsi, target.latitude, target.longitude, target.lastSeen);
		target.isValid = false;
	} else {
		target.isValid = true;
	}
}

function calculateRangeAndBearing(selfTarget, target) {
	if (!selfTarget.isValid || !target.latitude || !target.longitude) {
		target.range = null;
		target.bearing = null;
		// console.log('cant calc range bearing', selfTarget, target);
		return;
	}

	target.range = Math.round(
		getDistanceFromLatLonInMeters(
			selfTarget.latitude,
			selfTarget.longitude,
			target.latitude,
			target.longitude,
		),
	);
	target.bearing = Math.round(
		getRhumbLineBearing(
			selfTarget.latitude,
			selfTarget.longitude,
			target.latitude,
			target.longitude,
		),
	);

	if (target.bearing >= 360) {
		target.bearing = 0;
	}
}

// from: http://geomalgorithms.com/a07-_distance.html
function updateCpa(selfTarget, target) {
	if (
		selfTarget.x == null ||
		selfTarget.y == null ||
		selfTarget.vx == null ||
		selfTarget.vy == null ||
		target.x == null ||
		target.y == null ||
		target.vx == null ||
		target.vy == null
	) {
		//console.log('cant calc cpa: missing data', target.mmsi);
		target.cpa = null;
		target.tcpa = null;
		return;
	}

	// dv = Tr1.v - Tr2.v
	// this is relative speed
	// m/s
	var dv = {
		x: target.vx - selfTarget.vx,
		y: target.vy - selfTarget.vy,
	};

	// (m/s)^2
	var dv2 = dot(dv, dv);

	// guard against division by zero
	// the tracks are almost parallel
	// or there is almost no relative movement
	if (dv2 < 0.00000001) {
		// console.log('cant calc tcpa: ',target.mmsi);
		target.cpa = null;
		target.tcpa = null;
		return;
	}

	// w0 = Tr1.P0 - Tr2.P0
	// this is relative position
	// 111120 m / deg lat
	// m
	// FIXME isnt this the same as target.y - selfTarget.y
	var w0 = {
		x: target.x - selfTarget.x,
		y: target.y - selfTarget.y,
		// x: (target.longitude - selfTarget.longitude) * 111120 * Math.cos(toRadians(selfTarget.latitude)),
		// y: (target.latitude - selfTarget.latitude) * 111120,
	};

	// in secs
	// m * m/s / (m/s)^2 = m / (m/s) = s
	var tcpa = -dot(w0, dv) / dv2;

	// if tcpa is in the past,
	// or if tcpa is more than 3 hours in the future
	// then dont calc cpa & tcpa
	if (!tcpa || tcpa < 0 || tcpa > 3 * 3600) {
		//console.log('discarding tcpa: ', target.mmsi, tcpa);
		target.cpa = null;
		target.tcpa = null;
		return;
	}

	// Point P1 = Tr1.P0 + (ctime * Tr1.v);
	// m
	var p1 = {
		x: selfTarget.x + tcpa * selfTarget.vx,
		y: selfTarget.y + tcpa * selfTarget.vy,
	};

	// Point P2 = Tr2.P0 + (ctime * Tr2.v);
	// m
	var p2 = {
		x: target.x + tcpa * target.vx,
		y: target.y + tcpa * target.vy,
	};

	// in meters
	var cpa = dist(p1, p2);

	// in meters
	target.cpa = Math.round(cpa);
	// in seconds
	target.tcpa = Math.round(tcpa);
}

// #define dot(u,v) ((u).x * (v).x + (u).y * (v).y + (u).z * (v).z)
function dot(u, v) {
	return u.x * v.x + u.y * v.y;
}

// #define norm(v) sqrt(dot(v,v))
// norm = length of vector
function norm(v) {
	return Math.sqrt(dot(v, v));
}

// #define d(u,v) norm(u-v)
// distance = norm of difference
function dist(u, v) {
	return norm({
		x: u.x - v.x,
		y: u.y - v.y,
	});
}

function evaluateAlarms(target, collisionProfiles) {
	try {
		// guard alarm
		target.guardAlarm =
			target.range != null &&
			target.range <
				collisionProfiles[collisionProfiles.current].guard.range *
					METERS_PER_NM &&
			(collisionProfiles[collisionProfiles.current].guard.speed === 0 ||
				(target.sog != null &&
					target.sog >
						collisionProfiles[collisionProfiles.current].guard.speed /
							KNOTS_PER_M_PER_S));

		// collision alarm
		target.collisionAlarm =
			target.cpa != null &&
			target.cpa <
				collisionProfiles[collisionProfiles.current].danger.cpa *
					METERS_PER_NM &&
			target.tcpa != null &&
			target.tcpa > 0 &&
			target.tcpa < collisionProfiles[collisionProfiles.current].danger.tcpa &&
			(collisionProfiles[collisionProfiles.current].danger.speed === 0 ||
				(target.sog != null &&
					target.sog >
						collisionProfiles[collisionProfiles.current].danger.speed /
							KNOTS_PER_M_PER_S));

		// collision warning
		target.collisionWarning =
			target.cpa != null &&
			target.cpa <
				collisionProfiles[collisionProfiles.current].warning.cpa *
					METERS_PER_NM &&
			target.tcpa != null &&
			target.tcpa > 0 &&
			target.tcpa < collisionProfiles[collisionProfiles.current].warning.tcpa &&
			(collisionProfiles[collisionProfiles.current].warning.speed === 0 ||
				(target.sog != null &&
					target.sog >
						collisionProfiles[collisionProfiles.current].warning.speed /
							KNOTS_PER_M_PER_S));

		target.sartAlarm = target.mmsi.startsWith("970");
		target.mobAlarm = target.mmsi.startsWith("972");
		target.epirbAlarm = target.mmsi.startsWith("974");

		//FIXME - need to clean up this order logic.
		// targets with alarm status must be at the top
		// targets with negative tcpa are very low priority

		// alarm
		if (
			target.guardAlarm ||
			target.collisionAlarm ||
			target.sartAlarm ||
			target.mobAlarm ||
			target.epirbAlarm
		) {
			target.alarmState = "danger";
			target.order = 10000;
		}
		// warning
		else if (target.collisionWarning) {
			target.alarmState = "warning";
			target.order = 20000;
		}
		// no alarm/warning - but has positive tcpa (closing)
		else if (target.tcpa != null && target.tcpa > 0) {
			target.alarmState = null;
			target.order = 30000;
		}
		// no alarm/warning and moving away)
		else {
			target.alarmState = null;
			target.order = 40000;
		}

		const alarms = [];

		if (target.guardAlarm) alarms.push("guard");
		if (target.collisionAlarm || target.collisionWarning) alarms.push("cpa");
		if (target.sartAlarm) alarms.push("sart");
		if (target.mobAlarm) alarms.push("mob");
		if (target.epirbAlarm) alarms.push("epirb");

		if (alarms.length > 0) {
			target.alarmType = alarms.join(",");
		} else {
			target.alarmType = null;
		}

		// sort sooner tcpa targets to top
		if (target.tcpa != null && target.tcpa > 0) {
			// sort vessels with any tcpa above vessels that dont have a tcpa
			target.order -= 1000;
			// tcpa of 0 seconds reduces order by 1000 (this is an arbitrary weighting)
			// tcpa of 60 minutes reduces order by 0
			const weight = 1000;
			target.order -= Math.max(
				0,
				Math.round(weight - (weight * target.tcpa) / 3600),
			);
		}

		// sort closer cpa targets to top
		if (target.cpa != null && target.cpa > 0) {
			// cpa of 0 nm reduces order by 2000 (this is an arbitrary weighting)
			// cpa of 5 nm reduces order by 0
			const weight = 2000;
			target.order -= Math.max(
				0,
				Math.round(weight - (weight * target.cpa) / 5 / METERS_PER_NM),
			);
		}

		// sort closer targets to top
		if (target.range != null && target.range > 0) {
			// range of 0 nm increases order by 0
			// range of 5 nm increases order by 500
			target.order += Math.round((100 * target.range) / METERS_PER_NM);
		}

		// FIXME might be interesting to calculate rate of closure
		// high positive rate of close decreases order

		// sort targets with no range to bottom
		if (target.range == null) {
			target.order += 99999;
		}
	} catch (err) {
		console.error("error in evaluateAlarms", err.message, err);
	}
}

function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
	var R = 6371000; // Radius of the earth in meters
	var dLat = toRadians(lat2 - lat1);
	var dLon = toRadians(lon2 - lon1);
	var a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRadians(lat1)) *
			Math.cos(toRadians(lat2)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	var d = R * c; // Distance in meters
	return d;
}

function getRhumbLineBearing(lat1, lon1, lat2, lon2) {
	// difference of longitude coords
	var diffLon = toRadians(lon2 - lon1);

	// difference latitude coords phi
	var diffPhi = Math.log(
		Math.tan(toRadians(lat2) / 2 + Math.PI / 4) /
			Math.tan(toRadians(lat1) / 2 + Math.PI / 4),
	);

	// recalculate diffLon if it is greater than pi
	if (Math.abs(diffLon) > Math.PI) {
		if (diffLon > 0) {
			diffLon = (Math.PI * 2 - diffLon) * -1;
		} else {
			diffLon = Math.PI * 2 + diffLon;
		}
	}

	//return the angle, normalized
	return (toDegrees(Math.atan2(diffLon, diffPhi)) + 360) % 360;
}

// 012345678
// 8MIDXXXXX   Diver’s radio (not used in the U.S. in 2013)
// MIDXXXXXX   Ship
// 0MIDXXXXX   Group of ships; the U.S. Coast Guard, for example, is 03699999
// 00MIDXXXX   Coastal stations
// 111MIDXXX   SAR (Search and Rescue) aircraft
// 99MIDXXXX   Aids to Navigation
// 98MIDXXXX   Auxiliary craft associated with a parent ship
// 970MIDXXX   AIS SART (Search and Rescue Transmitter) (might be bad info - might be no MID)
// 972XXXXXX   MOB (Man Overboard) device (no MID)
// 974XXXXXX   EPIRB (Emergency Position Indicating Radio Beacon) AIS (no MID)
function getMid(mmsi) {
	if (mmsi.startsWith("111") || mmsi.startsWith("970")) {
		return mmsi.substring(3, 6);
	} else if (
		mmsi.startsWith("00") ||
		mmsi.startsWith("98") ||
		mmsi.startsWith("99")
	) {
		return mmsi.substring(2, 5);
	} else if (mmsi.startsWith("0") || mmsi.startsWith("8")) {
		return mmsi.substring(1, 4);
	} else {
		return mmsi.substring(0, 3);
	}
}

// N 39° 57.0689
function formatLat(dec) {
	var decAbs = Math.abs(dec);
	var deg = `0${Math.floor(decAbs)}`.slice(-2);
	var min = `0${((decAbs - deg) * 60).toFixed(4)}`.slice(-7);
	return `${dec > 0 ? "N" : "S"} ${deg}° ${min}`;
}

// W 075° 08.3692
function formatLon(dec) {
	var decAbs = Math.abs(dec);
	var deg = `00${Math.floor(decAbs)}`.slice(-3);
	var min = `0${((decAbs - deg) * 60).toFixed(4)}`.slice(-7);
	return `${dec > 0 ? "E" : "W"} ${deg}° ${min}`;
}

// 1.53 NM
function formatCpa(cpa) {
	// if cpa is null it should be returned as blank. toFixed makes it '0.00'
	return cpa != null ? `${(cpa / METERS_PER_NM).toFixed(2)} NM` : "---";
}

// hh:mm:ss or mm:ss e.g. 01:15:23 or 51:37
function formatTcpa(tcpa) {
	if (tcpa == null || tcpa < 0) {
		return "---";
	}
	// when more than 60 mins, then format hh:mm:ss
	else if (Math.abs(tcpa) >= 3600) {
		return new Date(1000 * Math.abs(tcpa)).toISOString().substring(11, 19); // + ' hours'
	}
	// when less than 60 mins, then format mm:ss
	else {
		return new Date(1000 * Math.abs(tcpa)).toISOString().substring(14, 19); // + ' mins'
	}
}
