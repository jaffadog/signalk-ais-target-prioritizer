// FIXME rot coming in in radians now

var aisUtilsPromise = import("../src/assets/js/ais-utils.js");
let toDegrees;

const express = require("express");
const expressApp = express();

var _ = require("lodash");

var SSE = require("express-sse");
var sse = new SSE();

const proxy = require("node-tcp-proxy");
//const { clearInterval } = require("timers");
const mdns = require("multicast-dns")();

const METERS_PER_NM = 1852;
const KNOTS_PER_M_PER_S = 1.94384;

const httpPort = 39151;

const enableNmeaOverTcpServer = true; // ios app will not connect without this
const nmeaOverTcpServerPort = 39150; // apps look for nmea traffic on 39150. this is not confurable in the apps. so we proxy signalk 10110 to 39150.
const proxySourceHostname = "127.0.0.1"; // signalk server address (localhost - same place this plugin is running)
const proxySourcePort = 10110; // signalk nmea over tcp port

const enableV3 = true; // ios app will keep on reinitializing without this
const enableSse = true; // ios app will keep on reinitializing without this
const debugSseComms = false;
const debugHttpComms = false;

var gps = {};
var targets = new Map();
var positions = [];
var app;
var collisionProfiles;
var selfMmsi, selfName, selfCallsign, selfTypeId;

var httpServer;
var tcpProxyServer;

var streamingHeartBeatInterval;
var streamingVesselPositionUnderwayInterval;
var streamingAnchorWatchControlInterval;
var streamingAnchorWatchInterval;
var streamingVesselPositionHistoryInterval;
var savePositionInterval;
var anchorWatchInterval;
var refreshInterval;

var anchorWatchControl = {
	setAnchor: 0,
	alarmRadius: 30,
	alarmsEnabled: 0,
	anchorLatitude: 0,
	anchorLongitude: 0,
	anchorCorrectedLat: 0,
	anchorCorrectedLong: 0,
	usingCorrected: 0,
	distanceToAnchor: 0,
	bearingToAnchor: 0,
	alarmTriggered: 0,
	anchorPosition: {
		a: 0,
		o: 0,
		t: 0,
	},
};

var saveCollisionProfiles;

// save position every 2 seconds when underway. this changes to every 30 seconds when anchored.
const savePositionDelayWhenUnderway = 2000;
const savePositionDelayWhenAnchored = 30000;
var savePositionDelay = savePositionDelayWhenUnderway;
// 86,400 seconds per 24 hour day. 86400/2 = 43200. 86400/30 = 2880.

// the mobile app is picky about the model number and version numbers
// you dont get all functionality unless you provide valid values
// serial number does not seem to matter
const aisDeviceModel = {
	connectedDeviceType: "XB-8000",
	connectedDeviceUiVersion: "3.04.17316",
	connectedDeviceTxVersion: "5.20.17443",
	connectedDeviceTxBbVersion: "1.2.4.0",
	connectedDeviceSerialNumber: "KW37001",
};

const stateMappingTextToNumeric = {
	motoring: 0,
	anchored: 1,
	"not under command": 2,
	"restricted manouverability": 3,
	"constrained by draft": 4,
	moored: 5,
	aground: 6,
	fishing: 7,
	sailing: 8,
	"hazardous material high speed": 9,
	"hazardous material wing in ground": 10,
	"ais-sart": 14,
	default: 15,
};

const stateMappingNumericToText = {
	0: "motoring",
	1: "anchored",
	2: "not under command",
	3: "restricted manouverability",
	4: "constrained by draft",
	5: "moored",
	6: "aground",
	7: "fishing",
	8: "sailing",
	9: "hazardous material high speed",
	10: "hazardous material wing in ground",
	14: "ais-sart",
	15: "default",
};

// setup auto-discovery
/*
mdns.on('query', function(query) {
    console.log('********** mdns query',query.questions);
    if (query.questions[0] && query.questions[0].name === '_vesper-nmea0183._tcp.local') {
        console.log('got a query packet:', query, '\n');
        mdns.respond({
            answers: [
                {
                    name: '_vesper-nmea0183._tcp.local',
                    type: 'PTR',
                    class: 'IN',
                    ttl: 300,
                    flush: true,
                    data: 'ribbit._vesper-nmea0183._tcp.local'
                }
            ],
            additionals: [
                {
                    name: 'ribbit.local',
                    type: 'A',
                    class: 'IN',
                    ttl: 300,
                    flush: true,
                    data: ip.address()
                    // FIXME: the ip6 block below result inthe mobile app
                    // reporting an additional
                    // discovery with ip 0.0.0.0
                    // },{
                    // name: 'ribbit.local',
                    // type: 'AAAA',
                    // class: 'IN',
                    // ttl: 300,
                    // flush: true,
                    // data: ip.address('public','ipv6')
                }, {
                    name: 'ribbit._vesper-nmea0183._tcp.local',
                    type: 'SRV',
                    class: 'IN',
                    ttl: 300,
                    flush: true,
                    data: {
                        port: 39150,
                        weigth: 0,
                        priority: 10,
                        target: 'ribbit.local'
                    }
                }, {
                    name: 'ribbit._vesper-nmea0183._tcp.local',
                    type: 'TXT',
                    class: 'IN',
                    ttl: 300,
                    flush: true,
                    data: 'nm=ribbit'
                }
            ]
        });
    }
});
*/

function getDeviceModelXml() {
	return `<?xml version='1.0' encoding='ISO-8859-1' ?>
<Watchmate version='1.0' priority='0'>
<DeviceModel>
<connectedDeviceType>${aisDeviceModel.connectedDeviceType}</connectedDeviceType>
<connectedDeviceUiVersion>${aisDeviceModel.connectedDeviceUiVersion}</connectedDeviceUiVersion>
<connectedDeviceTxVersion>${aisDeviceModel.connectedDeviceTxVersion}</connectedDeviceTxVersion>
<connectedDeviceTxBbVersion>${aisDeviceModel.connectedDeviceTxBbVersion}</connectedDeviceTxBbVersion>
<connectedDeviceSerialNumber>${aisDeviceModel.connectedDeviceSerialNumber}</connectedDeviceSerialNumber>
</DeviceModel>
</Watchmate>`;
}

function getGpsModelXml() {
	var xml = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<Watchmate version='1.0' priority='0'>
<GPSModel>`;
	if (gps && gps.isValid) {
		xml += `<hasGPS>1</hasGPS>
<latitudeText>${formatLat(gps.latitude)}</latitudeText>
<longitudeText>${formatLon(gps.longitude)}</longitudeText>
<COG>${formatCog(gps.cog)}</COG>
<SOG>${formatSog(gps.sog)}</SOG>
<HDGT>${formatCog(gps.hdg)}</HDGT>
<magvar>${formatFixed(toDegrees(gps.magvar, 2))}</magvar>
<hasBowPosition>0</hasBowPosition>
<sim>stop</sim>
`;
	} else {
		xml += `<hasGPS>0</hasGPS>`;
	}
	xml += `</GPSModel>
</Watchmate>`;

	return xml;
}

function getGpsModelAdvancedXml() {
	var xml = `<?xml version = '1.0' encoding = 'ISO-8859-1' ?>
        <Watchmate version='1.0' priority='0'>
            <GPSModel>`;
	if (gps && gps.isValid) {
		xml += `<hasGPS>1</hasGPS>
                <latitudeText>${formatLat(gps.latitude)}</latitudeText>
                <longitudeText>${formatLon(gps.longitude)}</longitudeText>
                <COG>${formatCog(gps.cog)}</COG>
                <SOG>${formatSog(gps.sog)}</SOG>
                <HDGT>${formatCog(gps.hdg)}</HDGT>
                <magvar>${formatFixed(toDegrees(gps.magvar, 2))}</magvar>
                <hasBowPosition>0</hasBowPosition>
                <sim>stop</sim>
                <Fix>
                    <fixType>2</fixType>
                    <AutoMode>1</AutoMode>
                    <HDOP>0.94</HDOP>
                    <PDOP>1.86</PDOP>
                    <VDOP>1.61</VDOP>
                    <metersAccuracy>1.9</metersAccuracy>
                    <fix_ids>2</fix_ids>
                    <fix_ids>5</fix_ids>
                    <fix_ids>6</fix_ids>
                    <fix_ids>9</fix_ids>
                    <fix_ids>12</fix_ids>
                    <fix_ids>17</fix_ids>
                    <fix_ids>19</fix_ids>
                    <fix_ids>23</fix_ids>
                    <fix_ids>25</fix_ids>
                </Fix>
                <GPSSatsInView>
                    <SatID>2</SatID>
                    <El>059</El>
                    <Az>296</Az>
                    <SNR>39</SNR>
                </GPSSatsInView>
                <GPSSatsInView>
                    <SatID>5</SatID>
                    <El>028</El>
                    <Az>210</Az>
                    <SNR>40</SNR>
                </GPSSatsInView>
                <GPSSatsInView>
                    <SatID>6</SatID>
                    <El>059</El>
                    <Az>042</Az>
                    <SNR>46</SNR>
                </GPSSatsInView>
                <GPSSatsInView>
                    <SatID>9</SatID>
                    <El>024</El>
                    <Az>079</Az>
                    <SNR>42</SNR>
                </GPSSatsInView>
                <GPSSatsInView>
                    <SatID>12</SatID>
                    <El>047</El>
                    <Az>274</Az>
                    <SNR>36</SNR>
                </GPSSatsInView>
                <GPSSatsInView>
                    <SatID>17</SatID>
                    <El>029</El>
                    <Az>121</Az>
                    <SNR>38</SNR>
                </GPSSatsInView>
                <GPSSatsInView>
                    <SatID>19</SatID>
                    <El>055</El>
                    <Az>111</Az>
                    <SNR>29</SNR>
                </GPSSatsInView>
                <GPSSatsInView>
                    <SatID>23</SatID>
                    <El>015</El>
                    <Az>053</Az>
                    <SNR>37</SNR>
                </GPSSatsInView>
                <GPSSatsInView>
                    <SatID>25</SatID>
                    <El>023</El>
                    <Az>312</Az>
                    <SNR>33</SNR>
                </GPSSatsInView>`;
	} else {
		xml += `<hasGPS>0</hasGPS>`;
	}
	xml += `</GPSModel >
        </Watchmate > `;

	return xml;
}

function getTxStatusModelXml() {
	return `<?xml version = '1.0' encoding = 'ISO-8859-1' ?>
        <Watchmate version='1.0' priority='0'>
            <TxStatus>
                <warnMMSI>0</warnMMSI>
                <warnSilent>0</warnSilent>
                <warnStartup>0</warnStartup>
                <warnGPS>0</warnGPS>
                <warnPosReportSent>0</warnPosReportSent>
                <statusVSWR>1</statusVSWR>
                <valueVSWR>6</valueVSWR>
                <antennaInUse>0</antennaInUse>
                <gpsSBAS>0</gpsSBAS>
                <gpsSmooth>1</gpsSmooth>
                <gpsFastUpdate>0</gpsFastUpdate>
                <nmeaInBaud>4800</nmeaInBaud>
                <nmeaOutBaud>38400</nmeaOutBaud>
                <nmeaEchoAIS>1</nmeaEchoAIS>
                <nmeaEchoVDO>1</nmeaEchoVDO>
                <nmeaEchoGPS>1</nmeaEchoGPS>
                <nmeaEchoN2K>1</nmeaEchoN2K>
                <nmeaEchoNMEA>1</nmeaEchoNMEA>
                <n2kBus>2</n2kBus>
                <n2kProdCode>9511</n2kProdCode>
                <n2kAdr>21</n2kAdr>
                <n2kDevInst>0</n2kDevInst>
                <n2kSysInst>0</n2kSysInst>
                <n2kPosRate>500</n2kPosRate>
                <n2kCogRate>500</n2kCogRate>
                <externalAlarm>2</externalAlarm>
                <extSwitchFunc>2</extSwitchFunc>
                <extSwitchState>0</extSwitchState>
                <channelStatus>
                    <frequency>161.975</frequency>
                    <mode>1</mode>
                    <rssi>-105</rssi>
                    <rxCount>118</rxCount>
                    <txCount>3</txCount>
                </channelStatus>
                <channelStatus>
                    <frequency>162.025</frequency>
                    <mode>1</mode>
                    <rssi>-104</rssi>
                    <rxCount>121</rxCount>
                    <txCount>0</txCount>
                </channelStatus>
            </TxStatus>
        </Watchmate>`;
}

// anchorLatitude of 399510671 == N 39° 57.0645
// 39.9510671 = 39 deg 57.064026 mins
function getAnchorWatchModelXml() {
	return `<?xml version = '1.0' encoding = 'ISO-8859-1' ?>
        <Watchmate version='1.0' priority='0'>
            <AnchorWatch>
                <setAnchor>${anchorWatchControl.setAnchor}</setAnchor>
                <alarmRadius>${anchorWatchControl.alarmRadius}</alarmRadius>
                <alarmsEnabled>${anchorWatchControl.alarmsEnabled}</alarmsEnabled>
                <anchorLatitude>${anchorWatchControl.anchorPosition.a}</anchorLatitude>
                <anchorLongitude>${anchorWatchControl.anchorPosition.o}</anchorLongitude>
                <anchorCorrectedLat></anchorCorrectedLat>
                <anchorCorrectedLong></anchorCorrectedLong>
                <usingCorrected>0</usingCorrected>
                <distanceToAnchor>${formatFixed(anchorWatchControl.distanceToAnchor, 1)}</distanceToAnchor>
                <bearingToAnchor>${anchorWatchControl.bearingToAnchor || ""}</bearingToAnchor>
                <alarmTriggered>${anchorWatchControl.alarmTriggered}</alarmTriggered>
            </AnchorWatch>
        </Watchmate>`;
}

function getPreferencesXml() {
	return `<?xml version = '1.0' encoding = 'ISO-8859-1' ?>
        <Watchmate version='1.0' priority='0'>
            <Prefs>
                <PrefsRequested>
                    {2, { "accept.demo_mode", ""}, { "profile.current", ""}}
                </PrefsRequested>
                <Pref prefname='accept.demo_mode'>0</Pref>
                <Pref prefname='profile.current'>${collisionProfiles.current.toUpperCase()}</Pref>
            </Prefs>
        </Watchmate>`;
}

function getAlarmsXml() {
	var response = `<?xml version = '1.0' encoding = 'ISO-8859-1' ?>
        <Watchmate version='1.0' priority='1'>`;

	for (var target of targets.values()) {
		if (target.alarmState) {
			response += `<Alarm MMSI='${target.mmsi}' state='${translateAlarmState(target.alarmState) || ""}' type='${target.alarmType || ""}'>
<Name>${xmlescape(target.name) || ""}</Name>
<COG>${formatCog(target.cog)}</COG>
<SOG>${formatSog(target.sog)}</SOG>
<CPA>${formatCpa(target.cpa)}</CPA>
<TCPA>${formatTcpa(target.tcpa)}</TCPA>
<Range>${formatCpa(target.range)}</Range>
<BearingTrue>${target.bearing || ""}</BearingTrue>
<TargetType>${target.vesperTargetType || ""}</TargetType>
</Alarm>`;
		}
	}

	response += "</Watchmate>";
	return response;
}

function getSimsXml() {
	return `<?xml version='1.0' encoding='ISO-8859-1' ?>
<Watchmate version='1.0' priority='0'>
<SimFiles>
<simfile>TamakiStrait.sim</simfile>
<simfile>TamakiStraitMOB.sim</simfile>
<simfile>VirginIslands.sim</simfile>
<simfile>AnchorWatch.sim</simfile>
</SimFiles>
<sim>stop</sim>
</Watchmate>`;
}

function getTargetsXml() {
	var response = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<Watchmate version='1.0' priority='0'>
`;

	for (var target of targets.values()) {
		if (target.isValid && target.mmsi != selfMmsi) {
			response += `<Target>
<MMSI>${target.mmsi}</MMSI>
<Name>${xmlescape(target.name) || ""}</Name>
<CallSign>${xmlescape(target.callsign) || ""}</CallSign> 
<VesselTypeString>${target.type || ""}</VesselTypeString>
<VesselType>${target.typeId || ""}</VesselType>
<TargetType>${target.vesperTargetType || ""}</TargetType>
<Order>${target.order || ""}</Order>
<TCPA>${formatTcpa(target.tcpa)}</TCPA>
<CPA>${formatCpa(target.cpa)}</CPA>
<Bearing>${target.bearing || ""}</Bearing>
<Range>${formatCpa(target.range)}</Range>
<COG2>${formatCog(target.cog)}</COG2>
<SOG>${formatSog(target.sog)}</SOG>
<DangerState>${translateAlarmState(target.alarmState) || ""}</DangerState>
<AlarmType>${target.alarmType || ""}</AlarmType>
<FilteredState>${target.filteredState || ""}</FilteredState>
</Target>
`;
		} else {
			//app.debug('getTargetsXml: not sending invalid target', target);
		}
	}
	response += "</Watchmate>";
	return response;
}

// ios app uses this data - LatitudeText + LongitudeText
// android app does not - i have no idea where the android app gets lat long. turns out they calculate it using range and bearing. nuts!
function getTargetDetailsXml(mmsi) {
	var response = `<?xml version='1.0' encoding='ISO-8859-1' ?>
<Watchmate version='1.0' priority='0'>
`;

	var target = targets.get(mmsi);

	if (!target || !target.isValid) {
		app.debug(
			"getTargetDetailsXml: undefined or invalid target:",
			mmsi,
			target,
		);
	} else {
		// FIXME vessel size renders as: <Dimensions>199m x 32m</Dimensions>
		// and this works well in the ios app - even letting you chose to display m or ft
		// but the android app refuses to show anything

		response += `<Target>
<IMO>${target.imo || "0"}</IMO>
<COG>${formatCog(target.cog)}</COG>
<HDG>${formatCog(target.hdg)}</HDG>
<ROT>${formatRot(target.rot)}</ROT>
<Altitude>-1</Altitude>
<latitudeText>${formatLat(target.latitude)}</latitudeText>
<longitudeText>${formatLon(target.longitude)}</longitudeText>
<OffPosition>${target.isOffPosition || "0"}</OffPosition>
<Virtual>${target.isVirtual || "0"}</Virtual>
<Dimensions>${target.length && target.width ? target.length + "m x " + target.width + "m" : "---"}</Dimensions >
<Draft>${target.draft ? target.draft + "m" : "---"}</Draft>
<ClassType>${target.aisClass || ""}</ClassType>
<Destination>${xmlescape(target.destination) || ""}</Destination>
<ETAText></ETAText>
<NavStatus>${stateMappingTextToNumeric[target.status] || ""}</NavStatus>
<MMSI>${mmsi || ""}</MMSI>
<Name>${xmlescape(target.name) || ""}</Name>
<CallSign>${xmlescape(target.callsign) || ""}</CallSign> 
<VesselTypeString>${target.type || ""}</VesselTypeString>
<VesselType>${target.typeId || ""}</VesselType>
<TargetType>${target.vesperTargetType || ""}</TargetType>
<Order>${target.order || ""}</Order>
<TCPA>${formatTcpa(target.tcpa)}</TCPA>
<CPA>${formatCpa(target.cpa)}</CPA>
<Bearing>${target.bearing || ""}</Bearing>
<Range>${formatCpa(target.range)}</Range>
<COG2>${formatCog(target.cog)}</COG2>
<SOG>${formatSog(target.sog)}</SOG>
<DangerState>${translateAlarmState(target.alarmState) || ""}</DangerState>
<AlarmType>${target.alarmType || ""}</AlarmType>
<FilteredState>${target.filteredState || ""}</FilteredState>
</Target >`;
	}

	response += "</Watchmate>";
	return response;
}

function getOwnStaticDataXml() {
	return `<?xml version = '1.0' encoding = 'ISO-8859-1' ?>
<Watchmate version='1.0' priority='0'>
<OwnStaticData>
<MMSI>${selfMmsi}</MMSI>
<Name>${selfName}</Name>
<CallSign>${selfCallsign}</CallSign>
<VesselType>${selfTypeId}</VesselType>
<VesselSize a='1' b='1' c='1' d='1'/>
</OwnStaticData>
</Watchmate>`;
}

function setupSse() {
	// ******************** SSE STUFF **********************
	// streaming protocol used in lieu of xml or json REST calls

	if (enableSse) {
		// send heartbeat
		streamingHeartBeatInterval = setInterval(() => {
			sendSseMsg("HeartBeat", { time: new Date().getTime() });
		}, 15000);

		// send VesselPositionUnderway - 15s?
		streamingVesselPositionUnderwayInterval = setInterval(() => {
			// 75:VesselPositionUnderway{"a":407106833,"o":-740460408,"cog":0,"sog":0.0,"var":-13,"t":1576639404}
			// 80:VesselPositionUnderway{"a":380704720,"o":-785886085,"cog":220.28,"sog":0,"var":-9.77,"t":1576873731}
			// sse.send("75:VesselPositionUnderway{\"a\":407106833,\"o\":-740460408,\"cog\":0,\"sog\":0.0,\"var\":-13,\"t\":1576639404}\n\n");

			if (gps && gps.isValid) {
				var vesselPositionUnderway = {
					a: Math.round(gps.latitude * 1e7),
					o: Math.round(gps.longitude * 1e7),
					cog: toDegrees(gps.cog),
					sog: gps.sog * KNOTS_PER_M_PER_S,
					var: toDegrees(gps.magvar),
					t: gps.lastSeenDate.getTime(),
				};

				sendSseMsg("VesselPositionUnderway", vesselPositionUnderway);
			}
		}, 500);

		// send AnchorWatchControl
		streamingAnchorWatchControlInterval = setInterval(() => {
			sendSseMsg("AnchorWatchControl", anchorWatchControl);
		}, 1000);

		// send AnchorWatch
		streamingAnchorWatchInterval = setInterval(() => {
			var anchorWatchJson = {
				outOfBounds: anchorWatchControl.alarmTriggered == 1,
				// FIXME: should we send "positions" for "anchorPreviousPositions"?
				anchorPreviousPositions: positions,
			};

			sendSseMsg("AnchorWatch", anchorWatchJson);
		}, 1000);

		// send VesselPositionHistory (BIG message)
		streamingVesselPositionHistoryInterval = setInterval(() => {
			sendSseMsg("VesselPositionHistory", positions);
		}, 5000);
	}

	function sendSseMsg(name, data) {
		if (debugSseComms) app.debug("SSE sending " + name);
		var json = JSON.stringify(data);
		sse.send(json.length + 2 + ":" + name + json + "\n\n");
	}

	// ******************** END SSE STUFF **********************
}

// save position - keep up to 2880 positions (24 hours at 30 sec cadence)
savePositionInterval = setInterval(() => {
	if (gps && gps.isValid) {
		positions.unshift({
			a: Math.round(gps.latitude * 1e7),
			o: Math.round(gps.longitude * 1e7),
			t: gps.lastSeenDate.getTime(),
		});

		if (positions.length > 2880) {
			positions.length = 2880;
		}
	}
}, savePositionDelay);

anchorWatchInterval = setInterval(() => {
	updateAnchorWatch();
	// collisionProfiles.setFromEmulator = Math.floor(new Date().getTime() / 1000);
	// app.debug('emulator: setFromIndex,setFromEmulator', collisionProfiles.setFromIndex, collisionProfiles.setFromEmulator, collisionProfiles.anchor.guard.range);
	// app.debug("collisionProfiles.anchor.guard.range - vesper", collisionProfiles.anchor.guard.range);
}, 1000);

async function updateAnchorWatch() {
	try {
		if (!anchorWatchControl.setAnchor || !gps || !gps.isValid) {
			return;
		}

		// in meters
		anchorWatchControl.distanceToAnchor = getDistanceFromLatLonInMeters(
			gps.latitude,
			gps.longitude,
			anchorWatchControl.anchorPosition.a / 1e7,
			anchorWatchControl.anchorPosition.o / 1e7,
		);

		anchorWatchControl.bearingToAnchor = Math.round(
			getRhumbLineBearing(
				gps.latitude,
				gps.longitude,
				anchorWatchControl.anchorPosition.a / 1e7,
				anchorWatchControl.anchorPosition.o / 1e7,
			),
		);

		anchorWatchControl.alarmTriggered =
			anchorWatchControl.distanceToAnchor > anchorWatchControl.alarmRadius
				? 1
				: 0;
	} catch (err) {
		app.debug(
			"error in updateAnchorWatch",
			err.message,
			err,
			anchorWatchControl,
			gps,
		);
	}
}

function setupHttpServer() {
	// ======================= HTTP SERVER ========================
	// listens to requests from mobile app on port 39151

	expressApp.set("x-powered-by", false);
	expressApp.set("etag", false);

	// enabling compression breaks SSE - so cant do that
	//expressApp.use(compression());

	// log all requests
	expressApp.use((req, res, next) => {
		if (debugHttpComms)
			app.debug(
				`received request ${req.method} ${req.originalUrl} ${JSON.stringify(req.query)} `,
			);
		next();
	});
	//}, compression());

	expressApp.use(express.json()); // for parsing application/json
	expressApp.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

	// sanity
	expressApp.get("/", (req, res) => res.send("Hello World!"));

	// GET /datamodel/getModel?*****
	expressApp.get("/datamodel/getModel", (req, res) => {
		//app.debug(req.query);

		// responding in native xml
		// https://www.npmjs.com/package/xml
		//var xml = require('xml');
		//response.set('Content-Type', 'text/xml');
		//response.send(xml(name_of_restaurants));

		// GET /datamodel/getModel?DeviceModel
		if (req.query.DeviceModel === "") {
			sendXmlResponse(res, getDeviceModelXml());
		}

		// GET /datamodel/getModel?GPSModel
		else if (req.query.GPSModel === "") {
			sendXmlResponse(res, getGpsModelXml());
		}

		// GET /datamodel/getModel?GPSModel.,Advanced
		// GET /datamodel/getModel?GPSModel.Advanced
		else if (
			req.query["GPSModel.,Advanced"] === "" ||
			req.query["GPSModel.Advanced"] === ""
		) {
			sendXmlResponse(res, getGpsModelAdvancedXml());
		}

		// GET /datamodel/getModel?TxStatus
		else if (req.query.TxStatus === "") {
			sendXmlResponse(res, getTxStatusModelXml());
		}

		// GET /datamodel/getModel?AnchorWatch
		else if (req.query.AnchorWatch === "") {
			sendXmlResponse(res, getAnchorWatchModelXml());
		}

		// GET /datamodel/getModel?OwnStaticData
		else if (req.query.OwnStaticData === "") {
			//app.debug('*** sending getOwnStaticDataXml');
			sendXmlResponse(res, getOwnStaticDataXml());
		}

		// 404
		else {
			app.debug(
				"** sending empty response",
				req.method,
				req.originalUrl,
				req.query,
			);
			res.status(404).end();
			/*
            res.set('Content-Type', 'text/xml');
            var xml = `<?xml version = '1.0' encoding = 'ISO-8859-1' ?>
                <Watchmate version='1.0' priority='0'>
                </Watchmate>`;
            res.send(Buffer.from(xml);
            */
		}
	});

	// GET /prefs/start_notifying
	// FIXME: "Hello" 200 text/html ????
	// not sure what this is supposed to do or what the response is supposed to be
	// would be nice to get a sample from a real xb-8000
	expressApp.get("/prefs/start_notifying", (req, res) => {
		res.json();
	});

	// GET /prefs/getPreferences?accept.demo_mode&profile.current
	expressApp.get("/prefs/getPreferences", (req, res) => {
		sendXmlResponse(res, getPreferencesXml());
	});

	// GET /alarms/get_current_list
	expressApp.get("/alarms/get_current_list", (req, res) => {
		sendXmlResponse(res, getAlarmsXml());

		// FIXME: testing response format when there are no alarms. the ios app makes excessive calls, so i dont think we have this quite right yet.
		//res.json();
		//res.status(204).end()
		// 204 No Content
		// 404 Not Found
	});

	// GET /test/getSimFiles
	expressApp.get("/test/getSimFiles", (req, res) => {
		sendXmlResponse(res, getSimsXml());
	});

	// GET /targets/getTargets
	expressApp.get("/targets/getTargets", (req, res) => {
		sendXmlResponse(res, getTargetsXml());
	});

	// GET /targets/getTargetDetails?MMSI=255805923
	expressApp.get("/targets/getTargetDetails", (req, res) => {
		var mmsi = req.query.MMSI;

		if (!mmsi || !/[0-9]{9}/.test(mmsi)) {
			app.debug(
				"ERROR: /targets/getTargetDetails request with invalid mmsi",
				req.query,
				mmsi,
			);
		}

		sendXmlResponse(res, getTargetDetailsXml(mmsi));
	});

	// GET /prefs/setPreferences?profile.current=OFFSHORE
	expressApp.get("/prefs/setPreferences", (req, res) => {
		if (req.query["profile.current"]) {
			collisionProfiles.current = req.query["profile.current"].toLowerCase();
			saveCollisionProfiles();
			sendXmlResponse(res, getPreferencesXml());
		} else {
			app.debug(`*** sending 404 for ${req.method} ${req.originalUrl}`);
			res.sendStatus(404);
		}
	});

	// GET /alarms/mute_alarm
	expressApp.get("/alarms/mute_alarm", (req, res) => {
		muteAlarms();
		res.json();
	});

	expressApp.get("/datamodel/propertyEdited", (req, res) => {
		// GET /datamodel/propertyEdited?AnchorWatch.setAnchor=1
		if (req.query["AnchorWatch.setAnchor"]) {
			var setAnchor = req.query["AnchorWatch.setAnchor"];

			if (setAnchor == 1) {
				setAnchored();
			} else {
				setUnderway();
			}
		}

		// GET /datamodel/propertyEdited?AnchorWatch.alarmsEnabled=1
		if (req.query["AnchorWatch.alarmsEnabled"]) {
			app.debug(
				"setting anchorWatchControl.alarmsEnabled",
				req.query["AnchorWatch.alarmsEnabled"],
			);
			anchorWatchControl.alarmsEnabled = req.query["AnchorWatch.alarmsEnabled"];
		}

		// GET /datamodel/propertyEdited?AnchorWatch.alarmRadius=38
		if (req.query["AnchorWatch.alarmRadius"]) {
			app.debug(
				"setting anchorWatchControl.alarmRadius",
				req.query["AnchorWatch.alarmRadius"],
			);
			anchorWatchControl.alarmRadius = req.query["AnchorWatch.alarmRadius"];
		}

		res.json();
	});

	// ******************** ALL V3 RELATED STUFF ************************
	// v3 is a streaming model
	// FIXME: what if we just didnt respond to this v3 stuff? do the apps switch to just regular REST?

	// ANDROID:                                             imple?  sse?
	// /v3/openChannel                                      y       y       -
	// /v3/subscribeChannel?Sensors                         y-all   NO      NO
	// /v3/subscribeChannel?HeartBeat                       y       y       5s
	// /v3/subscribeChannel?AnchorWatch                     y       y       1s
	// /v3/subscribeChannel?AnchorWatchControl              y       y       1s
	// /v3/subscribeChannel?VesselPositionUnderway          y       y       0.5s
	// /v3/subscribeChannel?VesselPositionHistory           y       y       5s

	// IOS:
	// GET /v3/openChannel                                  y       y       -
	// GET /v3/subscribeChannel?VesselPositionUnderway      y-all   y       0.5s
	// GET /v3/subscribeChannel?MobAlarm                    y
	// GET /v3/subscribeChannel?CollisionAlarm              y
	// GET /v3/subscribeChannel?VesselAlarm                 y
	// GET /v3/subscribeChannel?AnchorWatch                 y       y       1s
	// GET /v3/subscribeChannel?AnchorWatchControl          y       y       1s
	// GET /v3/subscribeChannel?HeartBeat                   y
	// GET /v3/subscribeChannel?VesselPositionHistory       y       y       5s
	// GET /v3/watchMate/collisionProfiles                  y

	// PUT /v3/anchorwatch/AnchorWatchControl               y
	// GET /v3/tickle?AnchorWatchControl                    y-all

	if (enableV3) {
		// /v3/openChannel
		// after adding this, we get poounded with GET /v3/subscribeChannel?VesselPositionUnderway
		expressApp.get("/v3/openChannel", sse.init);

		// GET /v3/subscribeChannel?<anything>
		expressApp.get("/v3/subscribeChannel", (req, res) => {
			res.json();
		});

		// GET /v3/watchMate/collisionProfiles
		// JSON.stringify(collisionProfiles,null,2);
		expressApp.get("/v3/watchMate/collisionProfiles", (req, res) => {
			res.json(collisionProfiles);
		});

		// PUT /v3/watchMate/collisionProfiles
		// PUT /v3/watchMate/collisionProfiles { '{"harbor":{"guard":{"range":0.5}}}': '' }
		// android:
		//      guard, danger, warning
		//      'content-type': 'application/x-www-form-urlencoded'
		// ios:
		//      guard, danger, warning... PLUS... threat. threat is same as warning.
		//      'content-type': 'application/json'
		expressApp.put("/v3/watchMate/collisionProfiles", (req, res) => {
			app.debug("PUT /v3/watchMate/collisionProfiles", req.body);
			//app.debug("before merge", collisionProfiles);
			mergePutData(req, collisionProfiles);
			//app.debug("after merge", collisionProfiles);
			// remove "threat" paths that watchmate adds:
			delete collisionProfiles.anchor.threat;
			delete collisionProfiles.harbor.threat;
			delete collisionProfiles.coastal.threat;
			delete collisionProfiles.offshore.threat;
			saveCollisionProfiles();
			res.json();
		});

		// GET /v3/tickle?xxxx
		// GET /v3/tickle?AnchorWatch
		// GET /v3/tickle?AnchorWatchControl

		expressApp.get("/v3/tickle", (req, res) => {
			//app.debug('req.query', req.query);

			// GET /v3/tickle?AnchorWatch
			if (req.query.AnchorWatch !== undefined) {
				sendSseMsg("VesselPositionHistory", positions);
				res.json();
			}
			// GET /v3/tickle?AnchorWatchControl
			else if (req.query.AnchorWatchControl !== undefined) {
				sendSseMsg("AnchorWatchControl", anchorWatchControl);
				res.json();
			}
			// OTHER
			else {
				app.debug(
					`*** unexpected tickle ${req.method} ${req.originalUrl} ${req.query} `,
				);
				res.json();
			}
		});

		// PUT /v3/anchorwatch/AnchorWatchControl [object Object]
		expressApp.put("/v3/anchorwatch/AnchorWatchControl", (req, res) => {
			app.debug("PUT /v3/anchorwatch/AnchorWatchControl", req.body);

			mergePutData(req, anchorWatchControl);

			/*
            anchorWatchControl.setAnchor = data.setAnchor;
            anchorWatchControl.alarmsEnabled = data.alarmsEnabled;
            anchorWatchControl.anchorPosition = data.anchorPosition;
            */

			anchorWatchControl.anchorLatitude = anchorWatchControl.anchorPosition.a;
			anchorWatchControl.anchorLongitude = anchorWatchControl.anchorPosition.o;

			app.debug("anchorWatchControl", anchorWatchControl);

			res.json();
		});
	}

	// catchall 404
	expressApp.all("*", (req, res) => {
		app.debug(
			"*** sending empty response",
			req.method,
			req.originalUrl,
			req.query,
		);
		res.status(404).end();
	});

	httpServer = expressApp.listen(httpPort, () =>
		app.debug(`HTTP server listening on port ${httpPort}`),
	);
}
// ======================= END HTTP SERVER ========================

// ======================= NMEA OVER TCP SERVER ========================
// listens to requests from mobile apps on port 39150 (not configurable in the mobile apps - otherwise we'd just point it to 10110)
// forwards nmea0183 messages to mobile apps
// the app wants to see traffic on port 39150. if it does not, it will
// periodically reinitialize. i guess this is a mechanism to try and restore
// what it perceives as lost connectivity with the Vesper AIS unit.
function setupTcpProxyServer() {
	if (enableNmeaOverTcpServer) {
		tcpProxyServer = proxy.createProxy(
			nmeaOverTcpServerPort,
			proxySourceHostname,
			proxySourcePort,
		);
		app.debug("Proxy server listening on port " + nmeaOverTcpServerPort);
	}
}
// ======================= END TCP SERVER ========================

function sendXmlResponse(res, xml) {
	res.set("Content-Type", "application/xml").send(Buffer.from(xml, "latin1"));
}

function mergePutData(req, originalObject) {
	var contentType = req.header("content-type");
	var update;

	//app.debug('contentType', contentType);
	//app.debug('req.body', req.body);

	if (contentType && contentType === "application/json") {
		update = req.body;
	} else {
		update = JSON.parse(Object.keys(req.body)[0]);
	}

	_.merge(originalObject, update);
}

function setAnchored() {
	app.debug("setting anchored");

	anchorWatchControl = {
		setAnchor: 1,
		alarmRadius: 30,
		alarmsEnabled: 1,
		alarmTriggered: 0,
		anchorLatitude: Math.round(gps.latitude * 1e7),
		anchorLongitude: Math.round(gps.longitude * 1e7),
		anchorCorrectedLat: 0,
		anchorCorrectedLong: 0,
		usingCorrected: 0,
		distanceToAnchor: 0,
		bearingToAnchor: 0,
		anchorPosition: {
			a: Math.round(gps.latitude * 1e7),
			o: Math.round(gps.longitude * 1e7),
			t: gps.lastSeenDate.getTime(),
		},
	};

	//collisionProfiles.current = "anchor";
	//saveCollisionProfiles();
	savePositionDelay = savePositionDelayWhenAnchored;
}

function setUnderway() {
	app.debug("setting underway");

	anchorWatchControl = {
		setAnchor: 0,
		alarmRadius: 30,
		alarmsEnabled: 0,
		alarmTriggered: 0,
		anchorLatitude: 0,
		anchorLongitude: 0,
		anchorCorrectedLat: 0,
		anchorCorrectedLong: 0,
		usingCorrected: 0,
		distanceToAnchor: 0,
		bearingToAnchor: 0,
		anchorPosition: {
			a: 0,
			o: 0,
			t: 0,
		},
	};

	//collisionProfiles.current = "coastal";
	//saveCollisionProfiles();
	savePositionDelay = savePositionDelayWhenUnderway;
}

function muteAlarms() {
	for (const target of targets.values()) {
		if (target.alarmState === "danger") {
			// FIXME nothing is consuming alarmIsMuted
			target.alarmIsMuted = true;
		}
	}

	// TODO: or should we just silence the anchor watch for 20 minutes? that
	// might be better
	if (
		anchorWatchControl.alarmsEnabled == 1 &&
		anchorWatchControl.alarmTriggered == 1
	) {
		anchorWatchControl.alarmsEnabled = 0;
	}
}

function translateAlarmState(alarmState) {
	return alarmState == "warning" ? "threat" : alarmState;
}

// latitudeText: 'N 39° 57.0689',
function formatLat(dec) {
	var decAbs = Math.abs(dec);
	var deg = ("0" + Math.floor(decAbs)).slice(-2);
	var min = ("0" + ((decAbs - deg) * 60).toFixed(4)).slice(-7);
	return (dec > 0 ? "N" : "S") + " " + deg + "° " + min;
}

// longitudeText: 'W 075° 08.3692',
function formatLon(dec) {
	var decAbs = Math.abs(dec);
	var deg = ("00" + Math.floor(decAbs)).slice(-3);
	var min = ("0" + ((decAbs - deg) * 60).toFixed(4)).slice(-7);
	return (dec > 0 ? "E" : "W") + " " + deg + "° " + min;
}

// return in knots
function formatSog(sog) {
	return formatFixed(sog * KNOTS_PER_M_PER_S, 1);
}

function formatCog(cog) {
	return cog === undefined ? "" : ("00" + Math.round(toDegrees(cog))).slice(-3);
}

function formatRot(rot) {
	// sample: 3°/min
	// to decode the field value, divide by 4.733and then square it. Sign of the field value should be preserved
	return rot === undefined || rot == 0 || rot == -128
		? ""
		: Math.round((rot / 4.733) ** 2) + "°/min";
}

function formatCpa(cpa) {
	return cpa === undefined || cpa === null
		? ""
		: formatFixed(cpa / METERS_PER_NM, 2);
}

function formatFixed(number, digits) {
	return number === undefined ? "" : number.toFixed(digits);
}

function formatTcpa(tcpa) {
	// returns hh:mm:ss, e.g. 01:15:23
	if (tcpa === undefined || tcpa === null || tcpa < 0) {
		return "";
	}
	// when more than 60 mins, then format hh:mm:ss
	else if (Math.abs(tcpa) >= 3600) {
		return (
			(tcpa < 0 ? "-" : "") +
			new Date(1000 * Math.abs(tcpa)).toISOString().substring(11, 19)
		);
	}
	// when less than 60 mins, then format mm:ss
	else {
		return (
			(tcpa < 0 ? "-" : "") +
			new Date(1000 * Math.abs(tcpa)).toISOString().substring(14, 19)
		);
	}
}

function xmlescape(string, ignore) {
	var pattern;

	var map = {
		">": "&gt;",
		"<": "&lt;",
		"'": "&apos;",
		'"': "&quot;",
		"&": "&amp;",
	};

	if (string === null || string === undefined) return;

	ignore = (ignore || "").replace(/[^&"<>']/g, "");
	pattern = "([&\"<>'])".replace(new RegExp("[" + ignore + "]", "g"), "");

	return string.replace(new RegExp(pattern, "g"), (str, item) => map[item]);
}

// derive target data this is only used by the vesper emulator
function refreshTargetData() {
	gps = targets.get(selfMmsi);

	targets.forEach((target, mmsi) => {
		// 111MIDXXX        SAR (Search and Rescue) aircraft
		if (mmsi.startsWith("111")) {
			target.vesperTargetType = 5;
		}
		// targetType determines what kind of symbol gets used to represent the target in the vesper mobile app
		// 970MIDXXX        AIS SART (Search and Rescue Transmitter)
		else if (mmsi.startsWith("970")) {
			target.vesperTargetType = 6;
		}
		// 972XXXXXX        MOB (Man Overboard) device
		else if (mmsi.startsWith("972")) {
			target.vesperTargetType = 7;
		}
		// 974XXXXXX        EPIRB (Emergency Position Indicating Radio Beacon) AIS
		else if (mmsi.startsWith("974")) {
			target.vesperTargetType = 8;
		}
		// Aid to Navigation
		// 99MIDXXXX        Aids to Navigation
		else if (target.aisClass == "ATON" || mmsi.startsWith("99")) {
			target.vesperTargetType = 4;
		}
		// class A
		else if (target.aisClass == "A") {
			target.vesperTargetType = 1;
		}
		// make evrything else class B
		else {
			target.vesperTargetType = 2;
		}
	});
}

module.exports.setCollisionProfiles = (_collisionProfiles) => {
	collisionProfiles = _collisionProfiles;
};

module.exports.start = (
	_app,
	_collisionProfiles,
	_selfMmsi,
	_selfName,
	_selfCallsign,
	_selfTypeId,
	_targets,
	_saveCollisionProfiles,
) => {
	//console.log('vesper.start received:',_collisionProfiles, _selfMmsi, _selfName, _selfCallsign, _selfTypeId, _gps, _targets, _saveCollisionProfiles)
	app = _app;
	collisionProfiles = _collisionProfiles;
	selfMmsi = _selfMmsi;
	selfName = _selfName;
	selfCallsign = _selfCallsign;
	selfTypeId = _selfTypeId;
	targets = _targets;
	saveCollisionProfiles = _saveCollisionProfiles;

	Promise.resolve(aisUtilsPromise).then((aisUtils) => {
		toDegrees = aisUtils.toDegrees;
		app.debug("starting vesper emulator", collisionProfiles);
		refreshTargetData();
		setupHttpServer();
		setupTcpProxyServer();
		setupSse();

		// update the data model every 1000 ms
		refreshInterval = setInterval(() => {
			refreshTargetData();
		}, 1000);
	});
};

module.exports.stop = () => {
	if (streamingHeartBeatInterval) clearInterval(streamingHeartBeatInterval);
	if (streamingVesselPositionUnderwayInterval)
		clearInterval(streamingVesselPositionUnderwayInterval);
	if (streamingAnchorWatchControlInterval)
		clearInterval(streamingAnchorWatchControlInterval);
	if (streamingAnchorWatchInterval) clearInterval(streamingAnchorWatchInterval);
	if (streamingVesselPositionHistoryInterval)
		clearInterval(streamingVesselPositionHistoryInterval);
	if (savePositionInterval) clearInterval(savePositionInterval);
	if (anchorWatchInterval) clearInterval(anchorWatchInterval);
	if (refreshInterval) clearInterval(refreshInterval);

	if (tcpProxyServer) {
		try {
			app.debug(
				"Stopping proxy server listening on port " + nmeaOverTcpServerPort,
			);
			tcpProxyServer.end();
		} catch (e) {
			app.debug(e);
		}
	}

	if (httpServer) {
		try {
			app.debug(`Stopping HTTP server listening on port ${httpPort}`);
			httpServer.close();
		} catch (e) {
			app.debug(e);
		}
	}
};
