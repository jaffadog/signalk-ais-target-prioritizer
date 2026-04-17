export function isPresent(value) {
	return value !== null && value !== undefined;
}

export function isFiniteNumber(value) {
	return typeof value === "number" && Number.isFinite(value);
}

export function isFiniteCoord(lat, lon) {
	return isFiniteNumber(lat) && isFiniteNumber(lon);
}

export function hasPath(obj, key) {
	return Object.hasOwn(obj, key);
}

export function assertCollisionProfiles(profiles) {
	if (!profiles || typeof profiles !== "object") {
		throw new Error("Collision profiles must be an object");
	}

	const requiredProfiles = [
		"current",
		"anchor",
		"harbor",
		"coastal",
		"offshore",
	];

	for (const key of requiredProfiles) {
		if (!hasPath(profiles, key) || !isPresent(profiles[key])) {
			throw new Error(`Collision profiles missing required key: ${key}`);
		}
	}

	return profiles;
}
