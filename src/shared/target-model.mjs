export function createTarget(mmsi) {
	return {
		mmsi: String(mmsi),
		name: undefined,
		callsign: undefined,
		imo: undefined,
		sog: 0,
		cog: 0,
		hdg: undefined,
		rot: undefined,
		magvar: undefined,
		latitude: undefined,
		longitude: undefined,
		lastSeenDate: undefined,
		typeId: undefined,
		type: "---",
		aisClass: "A",
		status: "---",
		length: undefined,
		beam: undefined,
		draft: undefined,
		destination: "---",
		eta: "---",
		isVirtual: 0,
		isOffPosition: 0,
	};
}

export function applySnapshotToTarget(target, vessel) {
	target.mmsi = String(vessel.mmsi);
	target.name = vessel.name || `<${vessel.mmsi}>`;
	target.callsign = vessel.communication?.callsignVhf || "---";
	target.imo = vessel.registrations?.imo;
	target.sog = vessel.navigation?.speedOverGround?.value ?? 0;
	target.cog = vessel.navigation?.courseOverGroundTrue?.value ?? 0;
	target.hdg = vessel.navigation?.headingTrue?.value;
	target.rot = vessel.navigation?.rateOfTurn?.value;
	target.latitude = vessel.navigation?.position?.value.latitude;
	target.longitude = vessel.navigation?.position?.value.longitude;
	target.lastSeenDate = new Date(vessel.navigation?.position?.timestamp);
	target.typeId =
		vessel.design?.aisShipType?.value.id ?? vessel.atonType?.value.id;
	target.type =
		vessel.design?.aisShipType?.value.name ??
		vessel.atonType?.value.name ??
		"---";
	target.aisClass = vessel.sensors?.ais?.class?.value || "A";
	target.status = vessel.navigation?.state?.value ?? "---";
	target.length = vessel.design?.length?.value.overall;
	target.beam = vessel.design?.beam?.value;
	target.draft = vessel.design?.draft?.current ?? "---";
	target.destination =
		vessel.navigation?.destination?.commonName?.value ?? "---";
	target.eta = vessel.navigation?.destination?.eta?.value ?? "---";
	target.isVirtual = vessel.virtual?.value ? 1 : 0;
	target.isOffPosition = vessel.offPosition?.value ? 1 : 0;

	return target;
}

export function applyDeltaValue(target, { path, value, timestamp }) {
	switch (path) {
		case "":
			if (value.name) {
				target.name = value.name;
			} else if (value.communication?.callsignVhf) {
				target.callsign = value.communication.callsignVhf;
			} else if (value.registrations?.imo) {
				target.imo = value.registrations.imo.replace(/imo/i, "");
			}
			break;
		case "navigation.position":
			target.latitude = value.latitude;
			target.longitude = value.longitude;
			target.lastSeenDate = new Date(timestamp);
			break;
		case "navigation.courseOverGroundTrue":
			target.cog = value ?? 0;
			break;
		case "navigation.speedOverGround":
			target.sog = value ?? 0;
			break;
		case "navigation.magneticVariation":
			target.magvar = value;
			break;
		case "navigation.headingTrue":
			target.hdg = value;
			break;
		case "navigation.rateOfTurn":
			target.rot = value;
			break;
		case "design.aisShipType":
			target.typeId = value.id;
			target.type = value.name;
			break;
		case "navigation.state":
			target.status = value;
			break;
		case "sensors.ais.class":
			target.aisClass = value;
			break;
		case "navigation.destination.commonName":
			target.destination = value;
			break;
		case "design.length":
			target.length = value.overall;
			break;
		case "design.beam":
			target.beam = value;
			break;
		case "design.draft":
			target.draft = value.current;
			break;
		case "atonType":
			target.typeId = value.id;
			target.type = value.name;
			target.status ??= "default";
			break;
		case "offPosition":
			target.isOffPosition = value ? 1 : 0;
			break;
		case "virtual":
			target.isVirtual = value ? 1 : 0;
			break;
		default:
	}

	return target;
}
