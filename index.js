/*
 * signalk-ais-target-prioritizer
 * Jeremy Waters <jaffadog@gmail.com>"
 */

"use strict";

const vesper = require("./vesper-xb8000-emulator.js");
const schema = require('./schema')
const fs = require('fs');
const path = require('path');
const defaultCollisionProfiles = require('./public/assets/js/defaultCollisionProfiles.json')

const METERS_PER_NM = 1852;
const KNOTS_PER_M_PER_S = 1.94384;

var selfMmsi;
var selfName;
var selfCallsign;
var selfType;

var gps = {};
var targets = new Map();
var collisionProfiles;
var options;

// how long to keep old targets that we have not seen in a while
// in minutes
const ageOldTargets = true;
const ageOldTargetsTTL = 20;

module.exports = function (app) {

    var plugin = {};
    var unsubscribes = [];

    var refreshDataModelInterval;

    plugin.id = "signalk-ais-target-prioritizer";
    plugin.name = "SignalK AIS Target Prioritizer";
    plugin.description = "A SignalK plugin that priorizes AIS targets according to guard and CPA criteria";

    plugin.start = function (_options) {
        app.debug('*** Plugin started with options=', _options);
        options = _options;
        getCollisionProfiles();
        if (options.enableDataPublishing || options.enableAlarmPublishing || options.enableEmulator) {
            enablePluginCpaCalculations();
        }
        if (options.enableEmulator) {
            //app.debug("collisionProfiles in index.js", collisionProfiles);
            //vesper.collisionProfiles = collisionProfiles;
            //vesper.setCollisionProfiles(collisionProfiles);
            vesper.start(app, collisionProfiles, selfMmsi, selfName, selfCallsign, selfType, gps, targets, saveCollisionProfiles);
        }
    };

    plugin.stop = function () {
        app.debug(`Stopping the plugin`);
        unsubscribes.forEach(f => f());
        unsubscribes = [];
        if (refreshDataModelInterval) { clearInterval(refreshDataModelInterval); }
        if (options?.enableEmulator) { vesper.stop(); }
    };

    plugin.schema = schema;

    plugin.registerWithRouter = (router) => {

        // /plugins/${plugin.id}/getCollisionProfiles
        router.get('/getCollisionProfiles', (req, res) => {
            app.debug('getCollisionProfiles', collisionProfiles);
            res.json(collisionProfiles);
        });

        // /plugins/${plugin.id}/setCollisionProfiles
        router.put('/setCollisionProfiles', (req, res) => {
            var newCollisionProfiles = req.body;
            app.debug('setCollisionProfiles', newCollisionProfiles);
            // do some basic validation to ensure we have some real config data before saving it
            if (!newCollisionProfiles
                || !newCollisionProfiles.current
                || !newCollisionProfiles.anchor
                || !newCollisionProfiles.harbor
                || !newCollisionProfiles.coastal
                || !newCollisionProfiles.offshore
            ) {
                app.error('ERROR - not saving invalid new collision profiles', newCollisionProfiles);
                res.status(500).end();
                return;
            }
            // must use Object.assign rather than "collisionProfiles = newCollisionProfiles" to prevent breaking the reference we passed into the vesper emulator
            Object.assign(collisionProfiles, newCollisionProfiles);
            saveCollisionProfiles();
            res.json(collisionProfiles);
        });

        // /plugins/${plugin.id}/muteAllAlarms
        router.get('/muteAllAlarms', (req, res) => {
            app.debug('muteAllAlarms');
            targets.forEach((target, mmsi) => {
                if (target.alarmState) {
                    app.debug('muting alarm for target', mmsi, target.name, target.alarmState);
                    target.alarmMuted = true;
                }
            });
            res.json();
        });
    };

    function getCollisionProfiles() {
        try {
            var dataDirPath = app.getDataDirPath();
            var collisionProfilesPath = path.join(dataDirPath, "collisionProfiles.json");
            if (fs.existsSync(collisionProfilesPath)) {
                app.debug('Reading file', collisionProfilesPath);
                collisionProfiles = JSON.parse(fs.readFileSync(collisionProfilesPath).toString());
            } else {
                app.debug('collisionProfiles.json not found, using defaultCollisionProfiles', collisionProfilesPath);
                collisionProfiles = defaultCollisionProfiles;
                saveCollisionProfiles();
            }
        } catch (err) {
            app.error('Error reading collisionProfiles.json:', err);
            throw new Error('Error reading collisionProfiles.json:', err);
        }
    }

    function saveCollisionProfiles() {
        app.debug("saving ", collisionProfiles);

        var dataDirPath = app.getDataDirPath();

        if (!fs.existsSync(dataDirPath)) {
            try {
                fs.mkdirSync(dataDirPath, { recursive: true });
            } catch (err) {
                app.error('Error creating dataDirPath:', err);
                throw new Error('Error creating dataDirPath:', err);
            }
        }

        var collisionProfilesPath = path.join(dataDirPath, "collisionProfiles.json");
        app.debug('Writing file', collisionProfilesPath);
        try {
            fs.writeFileSync(collisionProfilesPath, JSON.stringify(collisionProfiles, null, 2));
        } catch (err) {
            app.error('Error writing collisionProfiles.json:', err);
            throw new Error('Error writing collisionProfiles.json:', err);
        }
    }

    function enablePluginCpaCalculations() {
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
                    period: 1000,
                },
                {
                    path: 'navigation.position',
                    period: 1000,
                },
                {
                    path: 'navigation.courseOverGroundTrue',
                    period: 1000,
                },
                {
                    path: 'navigation.speedOverGround',
                    period: 1000,
                },
                {
                    path: 'navigation.magneticVariation',
                    period: 1000,
                },
                {
                    path: 'navigation.headingTrue',
                    period: 1000,
                },
                {
                    path: 'navigation.state',
                    period: 1000,
                },
                {
                    path: 'navigation.destination.commonName',
                    period: 1000,
                },
                {
                    path: 'navigation.rateOfTurn',
                    period: 1000,
                },
                {
                    path: 'design.*',
                    period: 1000,
                },
                {
                    path: 'sensors.ais.class',
                    period: 1000,
                },
                {
                    path: 'atonType',
                    period: 1000,
                },
                {
                    path: 'offPosition',
                    period: 1000,
                },
                {
                    path: 'virtual',
                    period: 1000,
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

        // update data model every 1 second
        refreshDataModelInterval = setInterval(refreshDataModel, 1000);
    }

    function processDelta(delta) {
        var updates = delta.updates;
        var mmsi = delta.context.slice(-9);

        //app.debug('processDelta', mmsi, delta.updates.length, delta.updates[0].values[0]);

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
                        target.navstatus = value.value;
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
                        if (target.navstatus == null) {
                            target.navstatus = 'default'; // 15 = "default"
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
        else if (target.classType == 'ATON' || mmsi.startsWith('99')) {
            target.targetType = 4;
        }
        // class A
        else if (target.classType == 'A') {
            target.targetType = 1;
        }
        // make evrything else class B
        else {
            target.targetType = 2;
        }

        targets.set(mmsi, target);

        // FIXME - override gps to testing with signalk team sample data (netherlands)
        // gps.lat = 53.5;
        // gps.lon = 5.0;
    }

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
        try {
            // collisionProfiles.setFromIndex = Math.floor(new Date().getTime() / 1000);
            // app.debug('index.js: setFromIndex,setFromEmulator', collisionProfiles.setFromIndex, collisionProfiles.setFromEmulator, collisionProfiles.anchor.guard.range);
            // app.debug("collisionProfiles.anchor.guard.range - index ",collisionProfiles.anchor.guard.range);

            addCoords(gps);
            addSpeed(gps);

            for (var target of targets.values()) {
                if (ageOldTargets && (new Date() - new Date(target.lastSeen)) / 1000 / 60 > ageOldTargetsTTL) {
                    app.debug('ageing out target', target.mmsi, target.name, target.lastSeen);
                    targets.delete(target.mmsi);
                    continue;
                }

                if (target.mmsi != selfMmsi) {
                    calculateRangeAndBearing(target);
                    updateCpa(target);
                    target.isValid = isValidTarget(target);
                    evaluateAlarms(target);
                    if (options.enableDataPublishing) {
                        pushTargetDataToSignalK(target);
                    }
                }
            }
        }
        catch (err) {
            app.debug('error in refreshDataModel', err.message, err);
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
                                "collisionAlarmState": target.alarmState,
                            }
                        }
                    ]
                }
            ]
        });
    }

    function calculateRangeAndBearing(target) {
        if (gps.lat == null
            || gps.lon == null
            || target.lat == null
            || target.lon == null) {
            target.range = null;
            target.bearing = null;
            //app.debug('cant calc range bearing', gps, target);
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
        if (gps.lat == null
            || gps.lon == null
            || gps.sog == null
            || gps.cog == null
            || target.lat == null
            || target.lon == null
            || target.sog == null
            || target.cog == null) {
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

    // FIXME duplicated in webapp
    function evaluateAlarms(target) {
        try {
            // guard alarm
            target.guardAlarm =
                (target.range != null && target.range < collisionProfiles[collisionProfiles.current].guard.range * METERS_PER_NM)
                && (collisionProfiles[collisionProfiles.current].guard.speed == 0
                    || (target.sog != null && target.sog > collisionProfiles[collisionProfiles.current].guard.speed / KNOTS_PER_M_PER_S));

            // collision alarm
            target.collisionAlarm =
                target.cpa != null && target.cpa < collisionProfiles[collisionProfiles.current].danger.cpa * METERS_PER_NM
                && target.tcpa != null && target.tcpa > 0 && target.tcpa < collisionProfiles[collisionProfiles.current].danger.tcpa
                && (collisionProfiles[collisionProfiles.current].danger.speed == 0
                    || (target.sog != null && target.sog > collisionProfiles[collisionProfiles.current].danger.speed / KNOTS_PER_M_PER_S));

            // collision warning
            target.collisionWarning =
                target.cpa != null && target.cpa < collisionProfiles[collisionProfiles.current].warning.cpa * METERS_PER_NM
                && target.tcpa != null && target.tcpa > 0 && target.tcpa < collisionProfiles[collisionProfiles.current].warning.tcpa
                && (collisionProfiles[collisionProfiles.current].warning.speed == 0
                    || (target.sog != null && target.sog > collisionProfiles[collisionProfiles.current].warning.speed / KNOTS_PER_M_PER_S));

            target.sartAlarm = (target.mmsi.startsWith('970'));
            target.mobAlarm = (target.mmsi.startsWith('972'));
            target.epirbAlarm = (target.mmsi.startsWith('974'));

            // alarm
            if (target.guardAlarm
                || target.collisionAlarm
                || target.sartAlarm
                || target.mobAlarm
                || target.epirbAlarm) {
                target.alarmState = 'danger';
                target.filteredState = 'show';
                target.order = 10000;
            }
            // threat
            else if (target.collisionWarning) {
                // "warning" does not produce orange icons or alarms in the app, but
                // "threat" does :)
                target.alarmState = 'warning';
                target.filteredState = 'show';
                target.order = 20000;
            }
            // no alarm/warning - but has positive tcpa (closing)
            else if (target.tcpa != null && target.tcpa > 0) {
                target.alarmState = null;
                target.filteredState = 'hide';
                target.order = 30000;
            }
            // no alarm/warning and moving away)
            else {
                target.alarmState = null;
                target.filteredState = 'hide';
                target.order = 40000;
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
            if (target.tcpa != null && target.tcpa > 0) {
                // sort vessels with any tcpa above vessels that dont have a tcpa
                target.order -= 1000;
                // tcpa of 0 seconds reduces order by 1000 (this is an arbitrary
                // weighting)
                // tcpa of 60 minutes reduces order by 0
                var weight = 1000;
                target.order -= Math.max(0, Math.round(weight - weight * target.tcpa / 3600));
            }

            // sort closer cpa targets to top
            if (target.cpa != null && target.cpa > 0) {
                // cpa of 0 nm reduces order by 2000 (this is an arbitrary weighting)
                // cpa of 5 nm reduces order by 0
                var weight = 2000;
                target.order -= Math.max(0, Math.round(weight - weight * target.cpa / 5 / METERS_PER_NM));
            }

            // sort closer targets to top
            if (target.range != null && target.range > 0) {
                // range of 0 nm increases order by 0
                // range of 5 nm increases order by 500
                target.order += Math.round(100 * target.range / METERS_PER_NM);
            }

            // sort targets with no range to bottom
            if (target.range == null) {
                target.order += 99999;
            }

            // publish warning/alarm notifications
            // FIXME add sog, cpa, tcpa
            // FIXME need to get formatting functions from webapp - and maybe the data model approach too
            if (options.enableAlarmPublishing && target.alarmState && !target.alarmMuted) {
                var message = (`${target.name || '<' + target.mmsi + '>'} - `
                    + `${target.alarmType} `
                    + `${(target.alarmState == "danger" ? "alarm" : target.alarmState)}`).toUpperCase();
                // + `${(target.sog * KNOTS_PER_M_PER_S).toFixed(1)} kn `
                // + `${(target.cpa / METERS_PER_NM).toFixed(2)} NM `
                // + `${new Date(1000 * Math.abs(target.tcpa)).toISOString().substring(14, 19)}`;
                if (target.alarmState == "warning") {
                    sendNotification("warn", message);
                }
                else if (target.alarmState == "danger") {
                    sendNotification("alarm", message);
                }
            }
        }
        catch (err) {
            app.debug('error in evaluateAlarms', err.message, err);
        }
    }

    function sendNotification(state, message) {
        var delta = {
            "updates": [
                {
                    "values": [
                        {
                            "path": "notifications.navigation.closestApproach",
                            "value": {
                                "state": state,
                                "method": ["visual", "sound"],
                                "message": message,
                            }
                        }]
                }
            ]
        }

        app.handleMessage(plugin.id, delta);
    }

    function isValidTarget(target) {

        // if (!(target.mmsi
        //     && /[0-9]{9}/.test(target.mmsi)
        //     && target.classType
        //     && target.lat
        //     && target.lon
        //     && target.range
        //     && target.bearing)) {
        //     app.debug(`*** invalid target ${ target.mmsi } classType = ${ target.classType } lat = ${ target.lat } lon = ${ target.lon } range = ${ target.range } bearing = ${ target.bearing } `);
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
            //     (target.classType == 'ATON' || target.classType == 'BASE')
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



    return plugin;
};
