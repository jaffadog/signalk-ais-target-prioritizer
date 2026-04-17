function toNmeaLat(lat) {
	const abs = Math.abs(lat);
	const degrees = Math.floor(abs);
	const minutes = (abs - degrees) * 60;
	const dir = lat >= 0 ? "N" : "S";

	return {
		value: `${String(degrees).padStart(2, "0")}${minutes.toFixed(4).padStart(7, "0")}`,
		dir,
	};
}

function toNmeaLon(lon) {
	const abs = Math.abs(lon);
	const degrees = Math.floor(abs);
	const minutes = (abs - degrees) * 60;
	const dir = lon >= 0 ? "E" : "W";

	return {
		value: `${String(degrees).padStart(3, "0")}${minutes.toFixed(4).padStart(7, "0")}`,
		dir,
	};
}

function formatTime(date) {
	const hh = String(date.getUTCHours()).padStart(2, "0");
	const mm = String(date.getUTCMinutes()).padStart(2, "0");
	const ss = String(date.getUTCSeconds()).padStart(2, "0");
	return `${hh}${mm}${ss}.000`;
}

function formatDate(date) {
	const dd = String(date.getUTCDate()).padStart(2, "0");
	const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
	const yy = String(date.getUTCFullYear() % 100).padStart(2, "0");
	return `${dd}${mm}${yy}`;
}

function checksum(sentence) {
	let cs = 0;
	for (let i = 0; i < sentence.length; i++) {
		cs ^= sentence.charCodeAt(i);
	}
	return cs.toString(16).toUpperCase().padStart(2, "0");
}

export function createGPRMC({
	date = new Date(),
	lat,
	lon,
	sog = 0, // knots
	cog = 0, // degrees
	variation = "", // magnetic variation (optional)
	variationDir = "", // E/W
}) {
	const time = formatTime(date);
	const d = formatDate(date);

	const latObj = toNmeaLat(lat);
	const lonObj = toNmeaLon(lon);

	const body = [
		"GPRMC",
		time,
		"A", // status A=valid, V=void
		latObj.value,
		latObj.dir,
		lonObj.value,
		lonObj.dir,
		sog.toFixed(1),
		cog.toFixed(1),
		d,
		variation,
		variationDir,
	].join(",");

	const cs = checksum(body);

	return `$${body}*${cs}`;
}
