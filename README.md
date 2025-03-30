[![npm version](https://img.shields.io/npm/v/signalk-ais-target-prioritizer.svg)](https://www.npmjs.com/package/signalk-ais-target-prioritizer)

# SignalK AIS Target Prioritizer ...and Vesper XB-8000 AIS Emulator

A [SignalK](https://signalk.org/) plugin that prioritizes AIS targets according to guard and CPA criteria.

## What Does It Do?

The SignalK AIS Target Prioritizer plugin processes SignalK AIS data and applies configurable collision risk criteria to each AIS target. It establishes a collision risk rating for each AIS target. This rating can be used to rank AIS targets and highlight those targets that represent the most present risk/danger. The plugin will also trigger warnings and alarms when AIS target vessels meet the collision risk criteria.

The plugin emits the following deltas on the AIS targets in the SignalK data model:

| Data | Description | SignalK Path |
| --- | --- | --- |
| CPA | Closest point of approach | navigation.closestApproach<br/>Object value with property: **distance** (m)
| TCPA | Time to closest point of approach | navigation.closestApproach<br/> Object value with property: **timeTo** (s)
| Collision Risk Rating | A numerical rating of collision risk. A low number represents higher risk. | navigation.collisionRisk<br/>Object value with property: **rating**
| Collision Alarm Type | "guard", "cpa" | navigation.collisionRisk<br/>Object value with property: **alarmType**
| Collision Alarm State | "warn", "danger" | navigation.collisionRisk<br/>Object value with property: **alarmState**

## Configuration

The configuration consists of the **Collision Profile** criteria used to evaluate collision risk:

* **Collision Warning** - Configured using CPA, TCPA, and target SOG threshholds. Trips an **CPA Warning** when a target vessel meets these conditions. Intended to warn you of targets approaching your **Collision Alarm** thresholds. 
* **Collision Alarm** - Configured using CPA, TCPA, and target SOG threshholds. Trips an **CPA Alarm** when a target vessel meets these conditions.
* **Guard Alarm** - Configured using target Range and SOG threshholds. Trips an **Guard Alarm** when a target vessel meets these conditions.

There are four sets of the above criteria for different navigation situations:

* **Anchored** - where you might not want any alarms
* **Harbor** - where the warning and alarm thresholds might be quite tight given heavy harbor traffic
* **Coastal**
* **Offshore** - where the thresholds might be set quite large to get long advance warning while navigating in an environment where you might not be expecting any traffic

You can manage this configuration either on the SignalK plugin configuration page, or in the Vesper WatchMate mobile apps described below.

## Extras

This plugin also emulates the Vesper XB-8000 AIS - for the purpose of using the very nice Vesper WatchMate mobile apps for iOS and Android to get a nice visual representation of the AIS targets and their associated collision risk. Install the Watchmate app on your mobile device, point it at the IP of your SignalK server, and the app will merrily connect as if it were a Vesper AIS. The Watchmate app will display the live AIS data from your SignalK server with the target prioritization. The sample screenshot below is from my development using the SignalK team's sample NMEA/AIS data.

Note that not everything works in these apps when used this way. This is a work in progress. Stuff that works at this point:

* AIS Plotter
* Target List / Table
* Trigger alarms for Guard, CPA, and MOB/EPIRB/SART transponder detections
* Select and edit collision profiles (guard and CPA alarm thresholds)
* Anchor Watch works on the Android app, but not the iOS app

Proprietary functionality intended for configuring the Vesper AIS obviously does not and never will.

![](resources/watchmate-800.png)

The Vesper Watchmate mobile app can be installed using the links below.

[![](/resources/google-play-store-40.png)](https://play.google.com/store/apps/details?id=com.bhs.watchmate&hl=en_NZ) [![](/resources/apple-app-store-40.png)](https://apps.apple.com/us/app/watchmate/id557485481)

## Other Ideas

Not implemented, but possible:

* Activate a piezo buffer on the Raspberry Pi running SignalK when an alarm is triggered
* Use a physical momentary switch on the Raspberry Pi to ack and hush alarms
* Automatically switch from an underway profile (e.g. coastal) to the anchored profile when the vessel stops moving. Could also automatically turn on the anchor alarm as well. And vice-versa - turn off the anchor alarm and switch back to an underway profile when you get going again. 
* Create a webapp for this plugin that provides the same functionality as the Vesper Watchmate mobile app.

