/*
 * signalk-ais-target-prioritizer
 * Jeremy Waters <jaffadog@gmail.com>"
 */

"use strict";

const express = require('express');
const expressApp = express();

var net = require('net');
var _ = require('lodash');

var SSE = require('./sse.js')
var sse = new SSE();

const proxy = require("node-tcp-proxy");
const mdns = require('multicast-dns')();

const schema = require('./schema')

const METERS_PER_NM = 1852;
const KNOTS_PER_M_PER_S = 1.94384;

const httpPort = 39151;

const enableNmeaOverTcpServer = true; // ios app will not connect without this
const nmeaOverTcpServerPort = 39150; // apps look for nmea traffic on 39150. this is not confurable in the apps. so we proxy signalk 10110 to 39150.
const proxySourceHostname = '127.0.0.1'; // signalk server address (localhost - same place this plugin is running)
const proxySourcePort = 10110; // signalk nmea over tcp port

const enableV3 = true; // ios app will keep on reinitializing without this
const enableSse = true; // ios app will keep on reinitializing without this
const debugSseComms = false;
const debugHttpComms = false;

var selfMmsi;
var selfName;
var selfCallsign;
var selfType;

var gps = {};
var targets = new Map();
var positions = [];
var collisionProfiles;

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
        t: 0
    }
};

// save position every 2 seconds when underway. this changes to every 30 seconds when anchored.
const savePositionIntervalWhenUnderway = 2000;
const savePositionIntervalWhenAnchored = 30000;
var savePositionInterval = savePositionIntervalWhenUnderway;
// 86,400 seconds per 24 hour day. 86400/2 = 43200. 86400/30 = 2880.

// how long to keep old targets that we have not seen in a while
// in minutes
const ageOldTargets = true;
const ageOldTargetsTTL = 20;

// the mobile app is picky about the model number and version numbers
// you dont get all functionality unless you provide valid values
// serial number does not seem to matter
const aisDeviceModel = {
    connectedDeviceType: 'XB-8000',
    connectedDeviceUiVersion: '3.04.17316',
    connectedDeviceTxVersion: '5.20.17443',
    connectedDeviceTxBbVersion: '1.2.4.0',
    connectedDeviceSerialNumber: 'KW37001'
};

const stateMappingTextToNumeric = {
    'motoring': 0,
    'anchored': 1,
    'not under command': 2,
    'restricted manouverability': 3,
    'constrained by draft': 4,
    'moored': 5,
    'aground': 6,
    'fishing': 7,
    'sailing': 8,
    'hazardous material high speed': 9,
    'hazardous material wing in ground': 10,
    'ais-sart': 14,
    'default': 15,
}

const stateMappingNumericToText = {
    0: 'motoring',
    1: 'anchored',
    2: 'not under command',
    3: 'restricted manouverability',
    4: 'constrained by draft',
    5: 'moored',
    6: 'aground',
    7: 'fishing',
    8: 'sailing',
    9: 'hazardous material high speed',
    10: 'hazardous material wing in ground',
    14: 'ais-sart',
    15: 'default',
}

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

module.exports = function (app) {

    var plugin = {};
    var unsubscribes = [];

    var httpServer;
    var tcpProxyServer;

    var heartBeatInterval;
    var vesselPositionUnderwayInterval;
    var anchorWatchControlInterval;
    var anchorWatchInterval;
    var vesselPositionHistoryInterval;
    var savePositionInterval2;
    var refreshDataModelInterval;

    plugin.id = "signalk-ais-target-prioritizer";
    plugin.name = "SignalK AIS Target Prioritizer";
    plugin.description = "A SignalK plugin that priorizes AIS targets according to guard and CPA criteria";

    plugin.start = function (options) {
        app.debug('Plugin started with options=', options);
        collisionProfiles = options;

        selfMmsi = app.getSelfPath('mmsi');
        selfName = app.getSelfPath('name');
        selfCallsign = app.getSelfPath('communication') ? app.getSelfPath('communication').callsignVhf : '';
        selfType = app.getSelfPath('design.aisShipType') ? app.getSelfPath('design.aisShipType').value.id : '';

        // *
        // atons.*
        // vessels.*
        // vessels.self
        var localSubscription = {
            context: '*', // we need both vessels and atons
            subscribe: [
                {
                    // "name" is in the root path
                    // and "communication.callsignVhf"
                    // and imo
                    path: '',
                    period: 1000
                },
                {
                    path: 'navigation.position',
                    period: 1000
                },
                {
                    path: 'navigation.courseOverGroundTrue',
                    period: 1000
                },
                {
                    path: 'navigation.speedOverGround',
                    period: 1000
                },
                {
                    path: 'navigation.magneticVariation',
                    period: 1000
                },
                {
                    path: 'navigation.headingTrue',
                    period: 1000
                },
                {
                    path: 'navigation.state',
                    period: 1000
                },
                {
                    path: 'navigation.destination.commonName',
                    period: 1000
                },
                {
                    path: 'navigation.rateOfTurn',
                    period: 1000
                },
                {
                    path: 'design.*',
                    period: 1000
                },
                {
                    path: 'sensors.ais.class',
                    period: 1000
                },
                {
                    path: 'atonType',
                    period: 1000
                },
                {
                    path: 'offPosition',
                    period: 1000
                },
                {
                    path: 'virtual',
                    period: 1000
                },
            ]
        };

        app.subscriptionmanager.subscribe(
            localSubscription,
            unsubscribes,
            subscriptionError => {
                app.error('Error:' + subscriptionError);
            },
            delta => processDelta(delta)
        );

        setupHttpServer();
        setupTcpProxyServer();
        setupSse();
    };

    plugin.stop = function () {
        app.debug(`Stopping the plugin`);
        unsubscribes.forEach(f => f());
        unsubscribes = [];

        if (heartBeatInterval) clearInterval(heartBeatInterval);
        if (vesselPositionUnderwayInterval) clearInterval(vesselPositionUnderwayInterval);
        if (anchorWatchControlInterval) clearInterval(anchorWatchControlInterval);
        if (anchorWatchInterval) clearInterval(anchorWatchInterval);
        if (vesselPositionHistoryInterval) clearInterval(vesselPositionHistoryInterval);
        if (savePositionInterval2) clearInterval(savePositionInterval2);
        if (refreshDataModelInterval) clearInterval(refreshDataModelInterval);

        if (tcpProxyServer) {
            try {
                tcpProxyServer.end();
            } catch (e) {
                app.debug(e);
            }
        }

        if (httpServer) {
            try {
                httpServer.close();
            } catch (e) {
                app.debug(e);
            }
        }
    };

    plugin.schema = schema;

    function processDelta(delta) {
        var updates = delta.updates;
        var mmsi = delta.context.slice(-9);

        if (!mmsi || !/[0-9]{9}/.test(mmsi)) {
            app.debug('ERROR: received a delta with an invalid mmsi', JSON.stringify(delta, null, "\t"));
            return
        }

        var target = targets.get(mmsi);
        if (!target) {
            target = {
                // initialize these to zero - because signal k may not set values if the target is stationary
                // and we may as well start computing CPAs assuming they're stationary
                sog: 0,
                cog: 0,
            };
            target.mmsi = mmsi;
        }

        target.context = delta.context;
        target.lastSeen = new Date().toISOString();

        for (let update of updates) {
            let values = update.values;
            for (let value of values) {
                //app.debug('value', value);

                switch (value.path) {
                    case '':
                        if (value.value.name) {
                            target.name = value.value.name;
                        }
                        else if (value.value.communication && value.value.communication.callsignVhf) {
                            target.callsign = value.value.communication.callsignVhf;
                        }
                        else if (value.value.registrations && value.value.registrations.imo) {
                            target.imo = value.value.registrations.imo.replace(/imo/i, '');
                        }
                        else if (value.value.mmsi) {
                            // we expected mmsi]
                        }
                        else {
                            //app.debug('received unexpected delta on root path', delta.context, value.path, value.value);
                        }
                        break;
                    case 'navigation.position':
                        target.lat = value.value.latitude;
                        target.lon = value.value.longitude;

                        if (mmsi == selfMmsi) {
                            gps.lat = value.value.latitude;
                            gps.lon = value.value.longitude;
                            gps.time = Date.now();
                        }

                        // used by test targets:
                        if (value.value.targetType) {
                            target.targetType = value.value.targetType;
                        }
                        break;
                    case 'navigation.courseOverGroundTrue':
                        target.cog = Math.round(rad2deg(value.value));
                        if (mmsi == selfMmsi) {
                            gps.cog = Math.round(rad2deg(value.value));
                        }
                        break;
                    case 'navigation.speedOverGround':
                        target.sog = value.value;
                        if (mmsi == selfMmsi) {
                            gps.sog = value.value;
                        }
                        break;
                    case 'navigation.magneticVariation':
                        if (mmsi == selfMmsi) {
                            gps.magvar = rad2deg(value.value);
                        }
                        break;
                    case 'navigation.headingTrue':
                        target.hdg = Math.round(rad2deg(value.value));
                        if (mmsi == selfMmsi) {
                            gps.hdg = Math.round(rad2deg(value.value));
                        }
                        break;
                    case 'navigation.rateOfTurn':
                        target.rot = rad2deg(value.value);
                        break;
                    case 'design.aisShipType':
                        target.vesselType = value.value.id;
                        target.vesselTypeString = value.value.name;
                        break;
                    case 'navigation.state':
                        target.navstatus = stateMappingTextToNumeric[value.value];
                        break;
                    case 'sensors.ais.class':
                        target.classType = value.value;
                        break;
                    case 'navigation.destination.commonName':
                        target.destination = value.value;
                        break;
                    case 'design.length':
                        target.length = value.value.overall;
                        break;
                    case 'design.beam':
                        target.width = value.value;
                        break;
                    case 'design.draft':
                        target.draught = value.value.current;
                        break;
                    case 'atonType':
                        target.vesselType = value.value.id;
                        target.vesselTypeString = value.value.name;
                        if (target.navstatus === undefined) {
                            target.navstatus = 15; // 15 = "undefined"
                        }
                        break;
                    case 'offPosition':
                        target.offPosition = value.value ? 1 : 0;
                        break;
                    case 'virtual':
                        target.virtual = value.value ? 1 : 0;
                        break;

                    default:
                    // do something or not
                    //app.debug('received unexpected delta', delta.context, value.path, value.value);
                }
            }
        }

        // if (target.targetType) {
        //     // target.targetType is already set (test targets), dont change it
        // }
        // 111MIDXXX        SAR (Search and Rescue) aircraft
        if (mmsi.startsWith('111')) {
            target.targetType = 5;
        }
        // targetType determines what kind of symbol gets used to represent the target in the vesper mobile app
        // 970MIDXXX        AIS SART (Search and Rescue Transmitter)
        else if (mmsi.startsWith('970')) {
            target.targetType = 6;
        }
        // 972XXXXXX        MOB (Man Overboard) device
        else if (mmsi.startsWith('972')) {
            target.targetType = 7;
        }
        // 974XXXXXX        EPIRB (Emergency Position Indicating Radio Beacon) AIS
        else if (mmsi.startsWith('974')) {
            target.targetType = 8;
        }
        // Aid to Navigation
        // 99MIDXXXX        Aids to Navigation
        else if (target.classType === 'ATON' || mmsi.startsWith('99')) {
            target.targetType = 4;
        }
        // class A
        else if (target.classType === 'A') {
            target.targetType = 1;
        }
        // make evrything else class B
        else {
            target.targetType = 2;
        }

        targets.set(mmsi, target);

        // FIXME - override gps to testing with signalk team sample data (netherlands)
        //gps.lat = 53.2;
        //gps.lon = 5.4;
    }

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
        return `<?xml version='1.0' encoding='ISO-8859-1' ?>
<Watchmate version='1.0' priority='0'>
<GPSModel>
<hasGPS>1</hasGPS>
<latitudeText>${formatLat(gps.lat)}</latitudeText>
<longitudeText>${formatLon(gps.lon)}</longitudeText>
<COG>${formatCog(gps.cog)}</COG>
<SOG>${formatSog(gps.sog)}</SOG>
<HDGT>${formatCog(gps.hdg)}</HDGT>
<magvar>${formatFixed(gps.magvar, 2)}</magvar>
<hasBowPosition>0</hasBowPosition>
<sim>stop</sim>
</GPSModel>
</Watchmate>`;
    }

    function getGpsModelAdvancedXml() {
        return `<?xml version='1.0' encoding='ISO-8859-1' ?>
<Watchmate version='1.0' priority='0'>
<GPSModel>
<hasGPS>1</hasGPS>
<latitudeText>${formatLat(gps.lat)}</latitudeText>
<longitudeText>${formatLon(gps.lon)}</longitudeText>
<COG>${formatCog(gps.cog)}</COG>
<SOG>${formatSog(gps.sog)}</SOG>
<HDGT>${formatCog(gps.hdg)}</HDGT>
<magvar>${formatFixed(gps.magvar, 2)}</magvar>
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
</GPSSatsInView>
</GPSModel>
</Watchmate>`;
    }


    function getTxStatusModelXml() {
        return `<?xml version='1.0' encoding='ISO-8859-1' ?>
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
        return `<?xml version='1.0' encoding='ISO-8859-1' ?>
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
<bearingToAnchor>${anchorWatchControl.bearingToAnchor || ''}</bearingToAnchor>
<alarmTriggered>${anchorWatchControl.alarmTriggered}</alarmTriggered>
</AnchorWatch>
</Watchmate>`;
    }

    function getPreferencesXml() {
        return `<?xml version='1.0' encoding='ISO-8859-1' ?>
<Watchmate version='1.0' priority='0'>
<Prefs>
<PrefsRequested>
{2,{"accept.demo_mode",""},{"profile.current",""}}
</PrefsRequested>
<Pref prefname='accept.demo_mode'>0</Pref>
<Pref prefname='profile.current'>${collisionProfiles.current.toUpperCase()}</Pref>
</Prefs>
</Watchmate>`;
    }

    function getAlarmsXml() {
        var response =
            `<?xml version='1.0' encoding='ISO-8859-1' ?>
<Watchmate version='1.0' priority='1'>`;

        for (var target of targets.values()) {
            if (target.dangerState) {
                response +=
                    `<Alarm MMSI='${target.mmsi}' state='${target.dangerState || ''}' type='${target.alarmType || ''}'>
<Name>${xmlescape(target.name) || ''}</Name>
<COG>${formatCog(target.cog)}</COG>
<SOG>${formatSog(target.sog)}</SOG>
<CPA>${formatCpa(target.cpa)}</CPA>
<TCPA>${formatTcpa(target.tcpa)}</TCPA>
<Range>${formatCpa(target.range)}</Range>
<BearingTrue>${target.bearing || ''}</BearingTrue>
<TargetType>${target.targetType || ''}</TargetType>
</Alarm>`;
            }
        }

        response += '</Watchmate>';
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
</Watchmate>`
    }

    function getTargetsXml() {
        var response =
            `<?xml version='1.0' encoding='ISO-8859-1' ?>
    <Watchmate version='1.0' priority='0'>
    `;

        for (var target of targets.values()) {
            if (target.isValid && target.mmsi != selfMmsi) {
                response +=
                    `<Target>
<MMSI>${target.mmsi}</MMSI>
<Name>${xmlescape(target.name) || ''}</Name>
<CallSign>${xmlescape(target.callsign) || ''}</CallSign> 
<VesselTypeString>${target.vesselTypeString || ''}</VesselTypeString>
<VesselType>${target.vesselType || ''}</VesselType>
<TargetType>${target.targetType || ''}</TargetType>
<Order>${target.order || ''}</Order>
<TCPA>${formatTcpa(target.tcpa)}</TCPA>
<CPA>${formatCpa(target.cpa)}</CPA>
<Bearing>${target.bearing || ''}</Bearing>
<Range>${formatCpa(target.range)}</Range>
<COG2>${formatCog(target.cog)}</COG2>
<SOG>${formatSog(target.sog)}</SOG>
<DangerState>${target.dangerState || ''}</DangerState>
<AlarmType>${target.alarmType || ''}</AlarmType>
<FilteredState>${target.filteredState || ''}</FilteredState>
</Target>
`;
            } else {
                //app.debug('getTargetsXml: not sending invalid target', target);
            }

        }

        response += '</Watchmate>';
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
            app.debug('getTargetDetailsXml: undefined or invalid target:', mmsi, target);
        } else {

            // FIXME vessel size renders as: <Dimensions>199m x 32m</Dimensions>
            // and this works well in the ios app - even letting you chose to display m or ft
            // but the android app refuses to show anything

            response += `<Target>
<IMO>${target.imo || '0'}</IMO>
<COG>${formatCog(target.cog)}</COG>
<HDG>${formatCog(target.hdg)}</HDG>
<ROT>${formatRot(target.rot)}</ROT>
<Altitude>-1</Altitude>
<latitudeText>${formatLat(target.lat)}</latitudeText>
<longitudeText>${formatLon(target.lon)}</longitudeText>
<OffPosition>${target.offPosition || '0'}</OffPosition>
<Virtual>${target.virtual || '0'}</Virtual>
<Dimensions>${target.length && target.width ? target.length + 'm x ' + target.width + 'm' : '---'}</Dimensions >
<Draft>${target.draught ? target.draught + 'm' : '---'}</Draft>
<ClassType>${target.classType || ''}</ClassType>
<Destination>${xmlescape(target.destination) || ''}</Destination>
<ETAText></ETAText>
<NavStatus>${target.navstatus || ''}</NavStatus>
<MMSI>${mmsi || ''}</MMSI>
<Name>${xmlescape(target.name) || ''}</Name>
<CallSign>${xmlescape(target.callsign) || ''}</CallSign> 
<VesselTypeString>${target.vesselTypeString || ''}</VesselTypeString>
<VesselType>${target.vesselType || ''}</VesselType>
<TargetType>${target.targetType || ''}</TargetType>
<Order>${target.order || ''}</Order>
<TCPA>${formatTcpa(target.tcpa)}</TCPA>
<CPA>${formatCpa(target.cpa)}</CPA>
<Bearing>${target.bearing || ''}</Bearing>
<Range>${formatCpa(target.range)}</Range>
<COG2>${formatCog(target.cog)}</COG2>
<SOG>${formatSog(target.sog)}</SOG>
<DangerState>${target.dangerState || ''}</DangerState>
<AlarmType>${target.alarmType || ''}</AlarmType>
<FilteredState>${target.filteredState || ''}</FilteredState>
</Target >`;
        }

        response += '</Watchmate>';
        return response;
    }

    function getOwnStaticDataXml() {
        return `<?xml version = '1.0' encoding = 'ISO-8859-1' ?>
<Watchmate version='1.0' priority='0'>
<OwnStaticData>
<MMSI>${selfMmsi}</MMSI>
<Name>${selfName}</Name>
<CallSign>${selfCallsign}</CallSign>
<VesselType>${selfType}</VesselType>
<VesselSize a='1' b='1' c='1' d='1'/>
</OwnStaticData>
</Watchmate>`;
    }

    function setupSse() {
        // ******************** SSE STUFF **********************
        // streaming protocol used in lieu of xml or json REST calls

        if (enableSse) {

            // send heartbeat
            heartBeatInterval = setInterval(() => {
                sendSseMsg("HeartBeat", { "time": new Date().getTime() });
            }, 15000);

            // send VesselPositionUnderway - 15s?
            vesselPositionUnderwayInterval = setInterval(() => {
                // 75:VesselPositionUnderway{"a":407106833,"o":-740460408,"cog":0,"sog":0.0,"var":-13,"t":1576639404}
                // 80:VesselPositionUnderway{"a":380704720,"o":-785886085,"cog":220.28,"sog":0,"var":-9.77,"t":1576873731}
                // sse.send("75:VesselPositionUnderway{\"a\":407106833,\"o\":-740460408,\"cog\":0,\"sog\":0.0,\"var\":-13,\"t\":1576639404}\n\n");

                var vesselPositionUnderway = {
                    "a": Math.round(gps.lat * 1e7),
                    "o": Math.round(gps.lon * 1e7),
                    "cog": gps.cog,
                    "sog": gps.sog * KNOTS_PER_M_PER_S,
                    "var": gps.magvar,
                    "t": gps.time
                };

                sendSseMsg("VesselPositionUnderway", vesselPositionUnderway);
            }, 500);

            // send AnchorWatchControl
            anchorWatchControlInterval = setInterval(() => {
                sendSseMsg("AnchorWatchControl", anchorWatchControl);
            }, 1000);

            // send AnchorWatch
            anchorWatchInterval = setInterval(() => {
                var anchorWatchJson = {
                    "outOfBounds": (anchorWatchControl.alarmTriggered == 1),
                    // FIXME: should we send "positions" for "anchorPreviousPositions"?
                    "anchorPreviousPositions": positions
                };

                sendSseMsg("AnchorWatch", anchorWatchJson);
            }, 1000);

            // send VesselPositionHistory (BIG message)
            vesselPositionHistoryInterval = setInterval(() => {
                sendSseMsg("VesselPositionHistory", positions);
            }, 5000);

        }

        function sendSseMsg(name, data) {
            if (debugSseComms) app.debug('SSE sending ' + name);
            var json = JSON.stringify(data);
            sse.send((json.length + 2) + ":" + name + json + "\n\n");
        }

        // ******************** END SSE STUFF **********************
    }

    // save position - keep up to 2880 positions (24 hours at 30 sec cadence)
    savePositionInterval2 = setInterval(() => {
        if (gps.lat) {
            positions.unshift({
                a: Math.round(gps.lat * 1e7),
                o: Math.round(gps.lon * 1e7),
                t: gps.time
            });

            if (positions.length > 2880) {
                positions.length = 2880;
            }
        }
    }, savePositionInterval);

    // update data model every 1 second
    refreshDataModelInterval = setInterval(refreshDataModel, 1000);

    // used to create dummy vessels for testing purposes
    function sendVesselDelta(mmsi, lat, lon, cog, sog, aisClass, targetType, navState, shipTypeId, shipTypeName) {
        app.handleMessage(plugin.id, {
            "context": 'vessels.urn:mrn:imo:mmsi:' + mmsi,
            "updates": [
                {
                    "values": [
                        {
                            "path": "navigation.position",
                            "value": {
                                "latitude": lat,
                                "longitude": lon,
                                // this is not part of the signalk schema, but we use it for force targetType on test targets
                                "targetType": targetType
                            },
                        },
                        {
                            "path": "design.aisShipType",
                            "value": {
                                "id": shipTypeId,
                                "name": shipTypeName
                            },
                        },
                        {
                            "path": "",
                            "value": {
                                "name": mmsi.toString()
                            }
                        },
                        {
                            "path": "navigation.courseOverGroundTrue",
                            "value": deg2rad(cog)
                        },
                        {
                            "path": "navigation.speedOverGround",
                            "value": sog / 1.9438
                        },
                        {
                            "path": "sensors.ais.class",
                            "value": aisClass
                        },
                        {
                            "path": "navigation.state",
                            "value": navState
                        },
                    ]
                }
            ]
        });
    }

    async function refreshDataModel() {
        //var startTime = new Date();
        await updateAllTargets();
        await updateAnchorWatch();
        //app.debug(`update loop complete in ${(new Date()).getTime() - startTime.getTime()} msec`);
    }

    async function updateAllTargets() {
        try {
            addCoords(gps);
            addSpeed(gps);

            for (var target of targets.values()) {
                if (ageOldTargets && (new Date() - new Date(target.lastSeen)) / 1000 / 60 > ageOldTargetsTTL) {
                    app.debug('ageing out target', target.mmsi, target.lastSeen, new Date().toISOString());
                    targets.delete(target.mmsi);
                    continue;
                }

                if (target.mmsi != selfMmsi) {
                    calculateRangeAndBearing(target);
                    updateCpa(target);
                    target.isValid = isValidTarget(target);
                    evaluateAlarms(target);
                    pushTargetDataToSignalK(target);
                }
            }
        }
        catch (err) {
            app.debug('error in updateAllTargets', err.message, err);
        }
    }

    function pushTargetDataToSignalK(target) {
        app.handleMessage(plugin.id, {
            "context": target.context,
            "updates": [
                {
                    "values": [
                        {
                            "path": "navigation.closestApproach",
                            "value": {
                                "distance": target.cpa,
                                "timeTo": target.tcpa,
                                "range": target.range,
                                "bearing": target.bearing,
                                "collisionRiskRating": target.order,
                                "collisionAlarmType": target.alarmType,
                                "collisionAlarmState": target.dangerState,
                            }
                        }
                    ]
                }
            ]
        });
    }

    function saveCollisionProfiles() {
        try {
            app.savePluginOptions(collisionProfiles, () => { app.debug('collisionProfiles saved') });
        }
        catch (err) {
            app.debug('There has been an error saving your configuration data.')
            app.debug(err);
        }
    }

    async function updateAnchorWatch() {

        try {
            //app.debug('anchorWatchControl',anchorWatchControl,savePositionInterval);

            // if anchored, then record position every 30 secs
            // otherwise if underway, then record position every 2 secs
            savePositionInterval = (anchorWatchControl.setAnchor) ? savePositionIntervalWhenAnchored : savePositionIntervalWhenUnderway;

            if (!anchorWatchControl.setAnchor) {
                return;
            }

            // in meters
            anchorWatchControl.distanceToAnchor = getDistanceFromLatLonInMeters(
                gps.lat, gps.lon,
                anchorWatchControl.anchorPosition.a / 1e7, anchorWatchControl.anchorPosition.o / 1e7);

            anchorWatchControl.bearingToAnchor = Math.round(getRhumbLineBearing(
                gps.lat, gps.lon,
                anchorWatchControl.anchorPosition.a / 1e7, anchorWatchControl.anchorPosition.o / 1e7));


            anchorWatchControl.alarmTriggered = (anchorWatchControl.distanceToAnchor > anchorWatchControl.alarmRadius) ? 1 : 0;
        }
        catch (err) {
            app.debug('error in updateAnchorWatch', err.message, err, anchorWatchControl, gps);
        }
    }

    function calculateRangeAndBearing(target) {
        if (gps.lat === undefined
            || gps.lon === undefined
            || target.lat === undefined
            || target.lon === undefined) {
            target.range = null;
            target.bearing = null;
            return;
        }

        target.range = Math.round(getDistanceFromLatLonInMeters(gps.lat, gps.lon, target.lat, target.lon));
        target.bearing = Math.round(getRhumbLineBearing(gps.lat, gps.lon, target.lat, target.lon));

        if (target.bearing >= 360) {
            target.bearing = 0;
        }
    }

    // from: http://geomalgorithms.com/a07-_distance.html
    function updateCpa(target) {
        if (gps.lat === undefined
            || gps.lon === undefined
            || gps.sog === undefined
            || gps.cog === undefined
            || target.lat === undefined
            || target.lon === undefined
            || target.sog === undefined
            || target.cog === undefined) {
            //app.debug('cant calc cpa: missing data',target.mmsi);
            target.cpa = null;
            target.tcpa = null;
            return;
        }

        // add x,y in meters
        addCoords(target);
        // add vx,vy in m/H
        addSpeed(target);

        // dv = Tr1.v - Tr2.v
        // this is relative speed
        // m/s
        var dv = {
            x: target.vx - gps.vx,
            y: target.vy - gps.vy,
        }

        // (m/s)^2
        var dv2 = dot(dv, dv);

        // guard against division by zero
        // the tracks are almost parallel
        // or there is almost no relative movement
        if (dv2 < 0.00000001) {
            // app.debug('cant calc tcpa: ',target.mmsi);
            target.cpa = null;
            target.tcpa = null;
            return;
        }

        // w0 = Tr1.P0 - Tr2.P0
        // this is relative position
        // 111120 m / deg lat
        // m
        var w0 = {
            x: (target.lon - gps.lon) * 111120 * Math.cos(gps.lat * Math.PI / 180),
            y: (target.lat - gps.lat) * 111120,
        }

        // in secs
        // m * m/s / (m/s)^2 = m / (m/s) = s
        var tcpa = -dot(w0, dv) / dv2;

        // if tcpa is in the past,
        // or if tcpa is more than 3 hours in the future
        // then dont calc cpa & tcpa
        if (!tcpa || tcpa < 0 || tcpa > 3 * 3600) {
            // app.debug('cant calc tcpa: ',target.mmsi);
            target.cpa = null;
            target.tcpa = null;
            return;
        }

        // Point P1 = Tr1.P0 + (ctime * Tr1.v);
        // m
        var p1 = {
            x: gps.x + tcpa * gps.vx,
            y: gps.y + tcpa * gps.vy,
        }

        // Point P2 = Tr2.P0 + (ctime * Tr2.v);
        // m
        var p2 = {
            x: target.x + tcpa * target.vx,
            y: target.y + tcpa * target.vy,
        }

        // in meters
        var cpa = dist(p1, p2);

        // in meters
        target.cpa = Math.round(cpa);
        // in seconds
        target.tcpa = Math.round(tcpa);
    }

    // add x,y in m
    function addCoords(target) {
        target.y = target.lat * 111120;
        target.x = target.lon * 111120 * Math.cos(gps.lat * Math.PI / 180);
    }

    // add vx,vy in m/s
    function addSpeed(target) {
        target.vy = target.sog * Math.cos(target.cog * Math.PI / 180);
        target.vx = target.sog * Math.sin(target.cog * Math.PI / 180);
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

    function evaluateAlarms(target) {
        try {
            // guard alarm
            target.guardAlarm = (
                (target.range !== undefined && target.range < collisionProfiles[collisionProfiles.current].guard.range * METERS_PER_NM)
                && (collisionProfiles[collisionProfiles.current].guard.speed == 0
                    || (target.sog !== undefined && target.sog > collisionProfiles[collisionProfiles.current].guard.speed / KNOTS_PER_M_PER_S))
            );

            // collision alarm
            target.collisionAlarm = (
                target.cpa !== undefined && target.cpa < collisionProfiles[collisionProfiles.current].danger.cpa * METERS_PER_NM
                && target.tcpa !== undefined && target.tcpa > 0 && target.tcpa < collisionProfiles[collisionProfiles.current].danger.tcpa
                && (collisionProfiles[collisionProfiles.current].danger.speed == 0
                    || (target.sog !== undefined && target.sog > collisionProfiles[collisionProfiles.current].danger.speed / KNOTS_PER_M_PER_S))
            );

            // collision warning
            target.collisionWarning = (
                target.cpa !== undefined && target.cpa < collisionProfiles[collisionProfiles.current].warning.cpa * METERS_PER_NM
                && target.tcpa !== undefined && target.tcpa > 0 && target.tcpa < collisionProfiles[collisionProfiles.current].warning.tcpa
                && (collisionProfiles[collisionProfiles.current].warning.speed == 0
                    || (target.sog !== undefined && target.sog > collisionProfiles[collisionProfiles.current].warning.speed / KNOTS_PER_M_PER_S))
            );

            target.sartAlarm = (target.mmsi.startsWith('970'));
            target.mobAlarm = (target.mmsi.startsWith('972'));
            target.epirbAlarm = (target.mmsi.startsWith('974'));

            // alarm
            if (target.guardAlarm
                || target.collisionAlarm
                || target.sartAlarm
                || target.mobAlarm
                || target.epirbAlarm) {
                target.dangerState = 'danger';
                target.filteredState = 'show';
                target.order = 8190;
            }
            // threat
            else if (target.collisionWarning) {
                // "warning" does not produce orange icons or alarms in the app, but
                // "threat" does :)
                target.dangerState = 'threat';
                target.filteredState = 'show';
                target.order = 16382;
            }
            // none
            else {
                target.dangerState = null;
                target.filteredState = 'hide';
                target.order = 36862;
            }

            var alarms = [];

            if (target.guardAlarm) alarms.push('guard');
            if (target.collisionAlarm || target.collisionWarning) alarms.push('cpa');
            if (target.sartAlarm) alarms.push('sart');
            if (target.mobAlarm) alarms.push('mob');
            if (target.epirbAlarm) alarms.push('epirb');

            if (alarms.length > 0) {
                target.alarmType = alarms.join(',');
            } else {
                target.alarmType = null;
            }

            // sort sooner tcpa targets to top
            if (target.tcpa !== undefined && target.tcpa > 0) {
                // sort vessels with any tcpa above vessels that dont have a tcpa
                target.order -= 1000;
                // tcpa of 0 seconds reduces order by 1000 (this is an arbitrary
                // weighting)
                // tcpa of 60 minutes reduces order by 0
                var weight = 1000;
                target.order -= Math.max(0, Math.round(weight - weight * target.tcpa / 3600));
            }

            // sort closer cpa targets to top
            if (target.cpa !== undefined && target.cpa > 0) {
                // cpa of 0 nm reduces order by 2000 (this is an arbitrary weighting)
                // cpa of 5 nm reduces order by 0
                var weight = 2000;
                target.order -= Math.max(0, Math.round(weight - weight * target.cpa / 5));
            }

            // sort closer targets to top
            if (target.range !== undefined && target.range > 0) {
                target.order += Math.round(100 * target.range);
            }

            // sort targets with no range to bottom
            if (target.range === undefined) {
                target.order += 99999;
            }
        }
        catch (err) {
            app.debug('error in evaluateAlarms', err.message);
        }
    }

    function setupHttpServer() {
        // ======================= HTTP SERVER ========================
        // listens to requests from mobile app on port 39151

        expressApp.set('x-powered-by', false);
        expressApp.set('etag', false);

        // enabling compression breaks SSE - so cant do that
        //expressApp.use(compression());

        // log all requests
        expressApp.use(function (req, res, next) {
            if (debugHttpComms) app.debug(`received request ${req.method} ${req.originalUrl} ${JSON.stringify(req.query)} `);
            next();
        });
        //}, compression());

        expressApp.use(express.json()) // for parsing application/json
        expressApp.use(express.urlencoded({ extended: true })) // for parsing application/x-www-form-urlencoded

        // sanity
        expressApp.get('/', (req, res) => res.send('Hello World!'));

        // GET /datamodel/getModel?*****
        expressApp.get('/datamodel/getModel', (req, res) => {
            //app.debug(req.query);

            // responding in native xml
            // https://www.npmjs.com/package/xml
            //var xml = require('xml');
            //response.set('Content-Type', 'text/xml');
            //response.send(xml(name_of_restaurants));

            // GET /datamodel/getModel?DeviceModel
            if (req.query.DeviceModel === '') {
                sendXmlResponse(res, getDeviceModelXml());
            }

            // GET /datamodel/getModel?GPSModel
            else if (req.query.GPSModel === '') {
                sendXmlResponse(res, getGpsModelXml());
            }

            // GET /datamodel/getModel?GPSModel.,Advanced
            // GET /datamodel/getModel?GPSModel.Advanced
            else if (req.query["GPSModel.,Advanced"] === '' || req.query["GPSModel.Advanced"] === '') {
                sendXmlResponse(res, getGpsModelAdvancedXml());
            }

            // GET /datamodel/getModel?TxStatus
            else if (req.query.TxStatus === '') {
                sendXmlResponse(res, getTxStatusModelXml());
            }

            // GET /datamodel/getModel?AnchorWatch
            else if (req.query.AnchorWatch === '') {
                sendXmlResponse(res, getAnchorWatchModelXml());
            }

            // GET /datamodel/getModel?OwnStaticData
            else if (req.query.OwnStaticData === '') {
                //app.debug('*** sending getOwnStaticDataXml');
                sendXmlResponse(res, getOwnStaticDataXml());
            }

            // 404
            else {
                app.debug('** sending empty response', req.method, req.originalUrl, req.query);
                res.status(404).end();
                /*
                res.set('Content-Type', 'text/xml');
                var xml = `<? xml version = '1.0' encoding = 'ISO-8859-1' ?>
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
        expressApp.get('/prefs/start_notifying', (req, res) => {
            res.json();
        });

        // GET /prefs/getPreferences?accept.demo_mode&profile.current
        expressApp.get('/prefs/getPreferences', (req, res) => {
            sendXmlResponse(res, getPreferencesXml());
        });

        // GET /alarms/get_current_list
        expressApp.get('/alarms/get_current_list', (req, res) => {
            sendXmlResponse(res, getAlarmsXml());

            // FIXME: testing response format when there are no alarms. the ios app makes excessive calls, so i dont think we have this quite right yet.
            //res.json();
            //res.status(204).end()
            // 204 No Content
            // 404 Not Found
        });

        // GET /test/getSimFiles
        expressApp.get('/test/getSimFiles', (req, res) => {
            sendXmlResponse(res, getSimsXml());
        });

        // GET /targets/getTargets
        expressApp.get('/targets/getTargets', (req, res) => {
            sendXmlResponse(res, getTargetsXml());
        });

        // GET /targets/getTargetDetails?MMSI=255805923
        expressApp.get('/targets/getTargetDetails', (req, res) => {
            var mmsi = req.query.MMSI;

            if (!mmsi || !/[0-9]{9}/.test(mmsi)) {
                app.debug('ERROR: /targets/getTargetDetails request with invalid mmsi', req.query, mmsi);
            }

            sendXmlResponse(res, getTargetDetailsXml(mmsi));
        });

        // GET /prefs/setPreferences?profile.current=OFFSHORE
        expressApp.get('/prefs/setPreferences', (req, res) => {
            if (req.query["profile.current"]) {
                collisionProfiles.current = req.query["profile.current"].toLowerCase();
                saveCollisionProfiles();
                sendXmlResponse(res, getPreferencesXml());
            }

            else {
                app.debug(`*** sending 404 for ${req.method} ${req.originalUrl}`);
                res.sendStatus(404);
            }
        });

        // GET /alarms/mute_alarm
        expressApp.get('/alarms/mute_alarm', (req, res) => {
            muteAlarms();
            res.json();
        });

        expressApp.get('/datamodel/propertyEdited', (req, res) => {

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
                app.debug('setting anchorWatchControl.alarmsEnabled', req.query["AnchorWatch.alarmsEnabled"]);
                anchorWatchControl.alarmsEnabled = req.query["AnchorWatch.alarmsEnabled"];
            }

            // GET /datamodel/propertyEdited?AnchorWatch.alarmRadius=38
            if (req.query["AnchorWatch.alarmRadius"]) {
                app.debug('setting anchorWatchControl.alarmRadius', req.query["AnchorWatch.alarmRadius"]);
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
            expressApp.get('/v3/openChannel', sse.init);

            // GET /v3/subscribeChannel?<anything>
            expressApp.get('/v3/subscribeChannel', (req, res) => {
                res.json();
            });

            // GET /v3/watchMate/collisionProfiles
            // JSON.stringify(collisionProfiles,null,2);
            expressApp.get('/v3/watchMate/collisionProfiles', (req, res) => {
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
            expressApp.put('/v3/watchMate/collisionProfiles', (req, res) => {
                app.debug('PUT /v3/watchMate/collisionProfiles', req.body);

                mergePutData(req, collisionProfiles);

                saveCollisionProfiles();
                res.json();
            });

            // GET /v3/tickle?xxxx
            // GET /v3/tickle?AnchorWatch
            // GET /v3/tickle?AnchorWatchControl

            expressApp.get('/v3/tickle', (req, res) => {
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
                    app.debug(`*** unexpected tickle ${req.method} ${req.originalUrl} ${req.query} `);
                    res.json();
                }
            });

            // PUT /v3/anchorwatch/AnchorWatchControl [object Object]
            expressApp.put('/v3/anchorwatch/AnchorWatchControl', (req, res) => {
                app.debug('PUT /v3/anchorwatch/AnchorWatchControl', req.body);

                mergePutData(req, anchorWatchControl);

                /*
                anchorWatchControl.setAnchor = data.setAnchor;
                anchorWatchControl.alarmsEnabled = data.alarmsEnabled;
                anchorWatchControl.anchorPosition = data.anchorPosition;
                */

                anchorWatchControl.anchorLatitude = anchorWatchControl.anchorPosition.a;
                anchorWatchControl.anchorLongitude = anchorWatchControl.anchorPosition.o;

                app.debug('anchorWatchControl', anchorWatchControl);

                res.json();
            });

        }

        // catchall 404
        expressApp.all('*', function (req, res) {
            app.debug('*** sending empty response', req.method, req.originalUrl, req.query);
            res.status(404).end();
        });

        httpServer = expressApp.listen(httpPort, () => app.debug(`HTTP server listening on port ${httpPort}`))
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
            tcpProxyServer = proxy.createProxy(nmeaOverTcpServerPort, proxySourceHostname, proxySourcePort);
            app.debug('Proxy server listening on port ' + nmeaOverTcpServerPort);
        }
    }
    // ======================= END TCP SERVER ========================

    function sendXmlResponse(res, xml) {
        res.set('Content-Type', 'application/xml').send(Buffer.from(xml, 'latin1'));
    }

    function mergePutData(req, originalObject) {
        var contentType = req.header('content-type');
        var update = undefined;

        //app.debug('contentType', contentType);
        //app.debug('req.body', req.body);

        if (contentType && contentType === 'application/json') {
            update = req.body;
        } else {
            update = JSON.parse(Object.keys(req.body)[0])
        }

        _.merge(originalObject, update);
    }

    function setAnchored() {
        app.debug('setting anchored');

        anchorWatchControl = {
            setAnchor: 1,
            alarmRadius: 30,
            alarmsEnabled: 1,
            alarmTriggered: 0,
            anchorLatitude: Math.round(gps.lat * 1e7),
            anchorLongitude: Math.round(gps.lon * 1e7),
            anchorCorrectedLat: 0,
            anchorCorrectedLong: 0,
            usingCorrected: 0,
            distanceToAnchor: 0,
            bearingToAnchor: 0,
            anchorPosition: {
                a: Math.round(gps.lat * 1e7),
                o: Math.round(gps.lon * 1e7),
                t: gps.time
            }
        };

        //collisionProfiles.current = "anchor";
        //saveCollisionProfiles();
        savePositionInterval = savePositionIntervalWhenAnchored;
    }

    function setUnderway() {
        app.debug('setting underway');

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
                t: 0
            }
        };

        //collisionProfiles.current = "coastal";
        //saveCollisionProfiles();
        savePositionInterval = savePositionIntervalWhenUnderway;
    }

    function muteAlarms() {
        for (let target of targets.values()) {
            if (target.dangerState === 'danger') {
                target.alarmMuted = true;
            }
        }

        // TODO: or should we just silence the anchor watch for 20 minutes? that
        // might be better
        if (anchorWatchControl.alarmsEnabled == 1 && anchorWatchControl.alarmTriggered == 1) {
            anchorWatchControl.alarmsEnabled = 0;
        }
    }

    function isValidTarget(target) {

        // if (!(target.mmsi
        //     && /[0-9]{9}/.test(target.mmsi)
        //     && target.classType
        //     && target.lat
        //     && target.lon
        //     && target.range
        //     && target.bearing)) {
        //     app.debug(`*** invalid target ${target.mmsi} classType=${target.classType} lat=${target.lat} lon=${target.lon} range=${target.range} bearing=${target.bearing}`);
        // }

        return (target.mmsi
            && /[0-9]{9}/.test(target.mmsi)
            && target.classType
            && target.lat
            && target.lon
            && target.range
            && target.bearing
            // cog and sog only required for type A and B, and not ATON and BASE:
            // although we initialize these to zero now... so this always passes
            // && (
            //     (target.cog && target.sog)
            //     ||
            //     (target.classType === 'ATON' || target.classType === 'BASE')
            // )
        );
    }

    function getDistanceFromLatLonInMeters(lat1, lon1, lat2, lon2) {
        var R = 6371000; // Radius of the earth in meters
        var dLat = deg2rad(lat2 - lat1);
        var dLon = deg2rad(lon2 - lon1);
        var a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
            ;
        var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        var d = R * c; // Distance in meters
        return d;
    };

    function getRhumbLineBearing(lat1, lon1, lat2, lon2) {

        // difference of longitude coords
        var diffLon = deg2rad(lon2 - lon1);

        // difference latitude coords phi
        var diffPhi = Math.log(
            Math.tan(
                deg2rad(lat2) / 2 + Math.PI / 4
            ) /
            Math.tan(
                deg2rad(lat1) / 2 + Math.PI / 4
            )
        );

        // recalculate diffLon if it is greater than pi
        if (Math.abs(diffLon) > Math.PI) {
            if (diffLon > 0) {
                diffLon = (Math.PI * 2 - diffLon) * -1;
            }
            else {
                diffLon = Math.PI * 2 + diffLon;
            }
        }

        //return the angle, normalized
        return (rad2deg(Math.atan2(diffLon, diffPhi)) + 360) % 360;
    };

    function deg2rad(deg) {
        return deg * (Math.PI / 180)
    };

    function rad2deg(rad) {
        return rad * (180 / Math.PI)
    };

    // latitudeText: 'N 39° 57.0689',
    function formatLat(dec) {
        var decAbs = Math.abs(dec);
        var deg = ('0' + Math.floor(decAbs)).slice(-2);
        var min = ('0' + ((decAbs - deg) * 60).toFixed(4)).slice(-7);
        return (dec > 0 ? "N" : "S") + " " + deg + "° " + min;
    }

    // longitudeText: 'W 075° 08.3692',
    function formatLon(dec) {
        var decAbs = Math.abs(dec);
        var deg = ('00' + Math.floor(decAbs)).slice(-3);
        var min = ('0' + ((decAbs - deg) * 60).toFixed(4)).slice(-7);
        return (dec > 0 ? "E" : "W") + " " + deg + "° " + min;
    }

    // return in knots
    function formatSog(sog) {
        return formatFixed(sog * KNOTS_PER_M_PER_S, 1);
    }

    function formatCog(cog) {
        return cog === undefined ? '' : ('00' + Math.round(cog)).slice(-3);
    }

    function formatRot(rot) {
        // sample: 3°/min
        return rot === undefined || rot == 0 || rot == -128 ? '' : Math.round(Math.pow(rot / 4.733, 2)) + '°/min';
    }

    function formatCpa(cpa) {
        return cpa === undefined || cpa === null ? '' : formatFixed(cpa / METERS_PER_NM, 2);
    }

    function formatFixed(number, digits) {
        return number === undefined ? '' : number.toFixed(digits);
    }

    function formatTcpa(tcpa) {
        // returns hh:mm:ss, e.g. 01:15:23
        if (tcpa === undefined || tcpa === null || tcpa < 0) {
            return '';
        }
        // when more than 60 mins, then format hh:mm:ss
        else if (Math.abs(tcpa) >= 3600) {
            return (tcpa < 0 ? '-' : '') + new Date(1000 * Math.abs(tcpa)).toISOString().substring(11, 19)
        }
        // when less than 60 mins, then format mm:ss
        else {
            return (tcpa < 0 ? '-' : '') + new Date(1000 * Math.abs(tcpa)).toISOString().substring(14, 19)
        }
    }

    function xmlescape(string, ignore) {
        var pattern;

        var map = {
            '>': '&gt;',
            '<': '&lt;',
            "'": '&apos;',
            '"': '&quot;',
            '&': '&amp;'
        };

        if (string === null || string === undefined) return;

        ignore = (ignore || '').replace(/[^&"<>\']/g, '');
        pattern = '([&"<>\'])'.replace(new RegExp('[' + ignore + ']', 'g'), '');

        return string.replace(new RegExp(pattern, 'g'), function (str, item) {
            return map[item];
        })
    }

    return plugin;
};
