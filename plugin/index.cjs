'use strict';

var fs = require('node:fs');
var path = require('node:path');
var express = require('express');
var SSE = require('express-sse');
var _ = require('lodash');
var proxy = require('node-tcp-proxy');

var current = "harbor";
var anchor = {
	warning: {
		cpa: 0,
		tcpa: 3600,
		speed: 0
	},
	danger: {
		cpa: 0,
		tcpa: 3600,
		speed: 0
	},
	guard: {
		range: 0,
		speed: 0
	}
};
var harbor = {
	warning: {
		cpa: 0.5,
		tcpa: 600,
		speed: 0.5
	},
	danger: {
		cpa: 0.1,
		tcpa: 300,
		speed: 3
	},
	guard: {
		range: 0,
		speed: 0
	}
};
var coastal = {
	warning: {
		cpa: 2,
		tcpa: 1800,
		speed: 0
	},
	danger: {
		cpa: 1,
		tcpa: 600,
		speed: 0.5
	},
	guard: {
		range: 0,
		speed: 0
	}
};
var offshore = {
	warning: {
		cpa: 4,
		tcpa: 1800,
		speed: 0
	},
	danger: {
		cpa: 2,
		tcpa: 900,
		speed: 0
	},
	guard: {
		range: 0,
		speed: 0
	}
};
var defaultCollisionProfiles = {
	current: current,
	anchor: anchor,
	harbor: harbor,
	coastal: coastal,
	offshore: offshore
};

const mmsiMidToCountry = new Map([
	["401", { code: "AF", name: "Afghanistan" }],
	["201", { code: "AL", name: "Albania" }],
	["605", { code: "DZ", name: "Algeria" }],
	["202", { code: "AD", name: "Andorra" }],
	["603", { code: "AO", name: "Angola" }],
	["304", { code: "AG", name: "Antigua and Barbuda" }],
	["305", { code: "AG", name: "Antigua and Barbuda" }],
	["701", { code: "AR", name: "Argentina" }],
	["216", { code: "AM", name: "Armenia" }],
	["503", { code: "AU", name: "Australia" }],
	["516", { code: "AU", name: "Australia - Christmas Island" }],
	["523", { code: "AU", name: "Australia - Cocos Islands" }],
	["203", { code: "AT", name: "Austria" }],
	["423", { code: "AZ", name: "Azerbaijan" }],
	["308", { code: "BS", name: "Bahamas" }],
	["309", { code: "BS", name: "Bahamas" }],
	["311", { code: "BS", name: "Bahamas" }],
	["408", { code: "BH", name: "Bahrain" }],
	["405", { code: "BD", name: "Bangladesh" }],
	["314", { code: "BB", name: "Barbados" }],
	["206", { code: "BY", name: "Belarus" }],
	["205", { code: "BE", name: "Belgium" }],
	["312", { code: "BZ", name: "Belize" }],
	["610", { code: "BJ", name: "Benin" }],
	["410", { code: "BT", name: "Bhutan" }],
	["720", { code: "BO", name: "Bolivia" }],
	["478", { code: "BA", name: "Bosnia and Herzegovina" }],
	["611", { code: "BW", name: "Botswana" }],
	["710", { code: "BR", name: "Brazil" }],
	["508", { code: "BN", name: "Brunei Darussalam" }],
	["207", { code: "BG", name: "Bulgaria" }],
	["633", { code: "BF", name: "Burkina Faso" }],
	["609", { code: "BI", name: "Burundi" }],
	["617", { code: "CV", name: "Cabo Verde" }],
	["514", { code: "KH", name: "Cambodia" }],
	["515", { code: "KH", name: "Cambodia" }],
	["613", { code: "CM", name: "Cameroon" }],
	["316", { code: "CA", name: "Canada" }],
	["612", { code: "CF", name: "Central African Republic" }],
	["670", { code: "TD", name: "Chad" }],
	["725", { code: "CL", name: "Chile" }],
	["412", { code: "CN", name: "China" }],
	["413", { code: "CN", name: "China" }],
	["414", { code: "CN", name: "China" }],
	["416", { code: "CN", name: "China" }],
	["453", { code: "CN", name: "China" }],
	["477", { code: "CN", name: "China" }],
	["730", { code: "CO", name: "Colombia" }],
	["616", { code: "KM", name: "Comoros" }],
	["620", { code: "KM", name: "Comoros" }],
	["615", { code: "CD", name: "Congo" }],
	["321", { code: "CR", name: "Costa Rica" }],
	["619", { code: "CI", name: "Côte d'Ivoire" }],
	["238", { code: "HR", name: "Croatia" }],
	["323", { code: "CU", name: "Cuba" }],
	["209", { code: "CY", name: "Cyprus" }],
	["210", { code: "CY", name: "Cyprus" }],
	["212", { code: "CY", name: "Cyprus" }],
	["270", { code: "CZ", name: "Czech Republic" }],
	["445", { code: "KR", name: "Democratic People's Republic of Korea" }],
	["676", { code: "CD", name: "Democratic Republic of the Congo" }],
	["219", { code: "DK", name: "Denmark" }],
	["220", { code: "DK", name: "Denmark" }],
	["231", { code: "DK", name: "Denmark - Faroe Islands" }],
	["331", { code: "DK", name: "Denmark - Greenland" }],
	["621", { code: "DJ", name: "Djibouti" }],
	["325", { code: "DM", name: "Dominica" }],
	["327", { code: "DO", name: "Dominican Republic" }],
	["735", { code: "EC", name: "Ecuador" }],
	["622", { code: "EG", name: "Egypt" }],
	["359", { code: "SV", name: "El Salvador" }],
	["631", { code: "GQ", name: "Equatorial Guinea" }],
	["625", { code: "ER", name: "Eritrea" }],
	["276", { code: "EE", name: "Estonia" }],
	["669", { code: "SZ", name: "Eswatini" }],
	["624", { code: "ET", name: "Ethiopia" }],
	["520", { code: "FJ", name: "Fiji" }],
	["230", { code: "FI", name: "Finland" }],
	["226", { code: "FR", name: "France" }],
	["227", { code: "FR", name: "France" }],
	["228", { code: "FR", name: "France" }],
	["501", { code: "FR", name: "France - Adelie Land" }],
	["618", { code: "FR", name: "France - Crozet Archipelago" }],
	["546", { code: "FR", name: "France - French Polynesia" }],
	["329", { code: "FR", name: "France - Guadeloupe" }],
	["745", { code: "FR", name: "France - Guiana" }],
	["635", { code: "FR", name: "France - Kerguelen Islands" }],
	["347", { code: "FR", name: "France - Martinique" }],
	["540", { code: "FR", name: "France - New Caledonia" }],
	["660", { code: "FR", name: "France - Reunion" }],
	["607", { code: "FR", name: "France - Saint Paul and Amsterdam Islands" }],
	["361", { code: "FR", name: "France - Saint Pierre and Miquelon" }],
	["578", { code: "FR", name: "France - Wallis and Futuna Islands" }],
	["626", { code: "GA", name: "Gabonese Republic" }],
	["629", { code: "GM", name: "Gambia" }],
	["213", { code: "GE", name: "Georgia" }],
	["211", { code: "DE", name: "Germany" }],
	["218", { code: "DE", name: "Germany" }],
	["627", { code: "GH", name: "Ghana" }],
	["237", { code: "GR", name: "Greece" }],
	["239", { code: "GR", name: "Greece" }],
	["240", { code: "GR", name: "Greece" }],
	["241", { code: "GR", name: "Greece" }],
	["330", { code: "GD", name: "Grenada" }],
	["332", { code: "GT", name: "Guatemala" }],
	["632", { code: "GN", name: "Guinea" }],
	["630", { code: "GW", name: "Guinea-Bissau" }],
	["750", { code: "GY", name: "Guyana" }],
	["336", { code: "HT", name: "Haiti" }],
	["334", { code: "HN", name: "Honduras" }],
	["243", { code: "HU", name: "Hungary" }],
	["251", { code: "IS", name: "Iceland" }],
	["419", { code: "IN", name: "India" }],
	["525", { code: "ID", name: "Indonesia" }],
	["422", { code: "IR", name: "Iran" }],
	["425", { code: "IQ", name: "Iraq" }],
	["250", { code: "IE", name: "Ireland" }],
	["428", { code: "IL", name: "Israel" }],
	["247", { code: "IT", name: "Italy" }],
	["339", { code: "JM", name: "Jamaica" }],
	["431", { code: "JP", name: "Japan" }],
	["432", { code: "JP", name: "Japan" }],
	["438", { code: "JO", name: "Jordan" }],
	["436", { code: "KZ", name: "Kazakhstan" }],
	["634", { code: "KE", name: "Kenya" }],
	["529", { code: "KI", name: "Kiribati" }],
	["440", { code: "KR", name: "Korea" }],
	["441", { code: "KR", name: "Korea" }],
	["447", { code: "KW", name: "Kuwait" }],
	["451", { code: "KG", name: "Kyrgyz Republic" }],
	["531", { code: "LA", name: "Lao People's Democratic Republic" }],
	["275", { code: "LV", name: "Latvia" }],
	["450", { code: "LB", name: "Lebanon" }],
	["644", { code: "LS", name: "Lesotho" }],
	["636", { code: "LR", name: "Liberia" }],
	["637", { code: "LR", name: "Liberia" }],
	["642", { code: "LY", name: "Libya" }],
	["252", { code: "LI", name: "Liechtenstein" }],
	["277", { code: "LT", name: "Lithuania" }],
	["253", { code: "LU", name: "Luxembourg" }],
	["647", { code: "MG", name: "Madagascar" }],
	["655", { code: "MW", name: "Malawi" }],
	["533", { code: "MY", name: "Malaysia" }],
	["455", { code: "MV", name: "Maldives" }],
	["649", { code: "ML", name: "Mali" }],
	["215", { code: "MT", name: "Malta" }],
	["229", { code: "MT", name: "Malta" }],
	["248", { code: "MT", name: "Malta" }],
	["249", { code: "MT", name: "Malta" }],
	["256", { code: "MT", name: "Malta" }],
	["538", { code: "MH", name: "Marshall Islands" }],
	["654", { code: "MR", name: "Mauritania" }],
	["645", { code: "MU", name: "Mauritius" }],
	["345", { code: "MX", name: "Mexico" }],
	["510", { code: "FM", name: "Micronesia" }],
	["214", { code: "MD", name: "Moldova" }],
	["254", { code: "MC", name: "Monaco" }],
	["457", { code: "MN", name: "Mongolia" }],
	["262", { code: "ME", name: "Montenegro" }],
	["242", { code: "MA", name: "Morocco" }],
	["650", { code: "MZ", name: "Mozambique" }],
	["506", { code: "MM", name: "Myanmar" }],
	["659", { code: "NA", name: "Namibia" }],
	["544", { code: "NR", name: "Nauru" }],
	["459", { code: "NP", name: "Nepal" }],
	["244", { code: "NL", name: "Netherlands" }],
	["245", { code: "NL", name: "Netherlands" }],
	["246", { code: "NL", name: "Netherlands" }],
	["306", { code: "NL", name: "Netherlands" }],
	["307", { code: "NL", name: "Netherlands - Aruba" }],
	[
		"306",
		{ code: "NL", name: "Netherlands - Bonaire, Sint Eustatius and Saba" },
	],
	["306", { code: "NL", name: "Netherlands - Curaçao" }],
	["512", { code: "NZ", name: "New Zealand" }],
	["518", { code: "NZ", name: "New Zealand - Cook Islands" }],
	["542", { code: "NZ", name: "New Zealand - Niue" }],
	["350", { code: "NI", name: "Nicaragua" }],
	["656", { code: "NE", name: "Niger" }],
	["657", { code: "NG", name: "Nigeria" }],
	["274", { code: "MK", name: "North Macedonia" }],
	["257", { code: "NO", name: "Norway" }],
	["258", { code: "NO", name: "Norway" }],
	["259", { code: "NO", name: "Norway" }],
	["461", { code: "OM", name: "Oman" }],
	["463", { code: "PK", name: "Pakistan" }],
	["511", { code: "PW", name: "Palau" }],
	["351", { code: "PA", name: "Panama" }],
	["352", { code: "PA", name: "Panama" }],
	["353", { code: "PA", name: "Panama" }],
	["354", { code: "PA", name: "Panama" }],
	["355", { code: "PA", name: "Panama" }],
	["356", { code: "PA", name: "Panama" }],
	["357", { code: "PA", name: "Panama" }],
	["370", { code: "PA", name: "Panama" }],
	["371", { code: "PA", name: "Panama" }],
	["372", { code: "PA", name: "Panama" }],
	["373", { code: "PA", name: "Panama" }],
	["374", { code: "PA", name: "Panama" }],
	["553", { code: "PG", name: "Papua New Guinea" }],
	["755", { code: "PY", name: "Paraguay" }],
	["760", { code: "PE", name: "Peru" }],
	["548", { code: "PH", name: "Philippines" }],
	["261", { code: "PL", name: "Poland" }],
	["263", { code: "PT", name: "Portugal" }],
	["204", { code: "PT", name: "Portugal - Azores" }],
	["255", { code: "PT", name: "Portugal - Madeira" }],
	["466", { code: "QA", name: "Qatar" }],
	["271", { code: "TR", name: "Republic of Türkiye" }],
	["264", { code: "RO", name: "Romania" }],
	["273", { code: "RU", name: "Russian Federation" }],
	["661", { code: "RW", name: "Rwanda" }],
	["341", { code: "KN", name: "Saint Kitts and Nevis" }],
	["343", { code: "LC", name: "Saint Lucia" }],
	["375", { code: "VC", name: "Saint Vincent and the Grenadines" }],
	["376", { code: "VC", name: "Saint Vincent and the Grenadines" }],
	["377", { code: "VC", name: "Saint Vincent and the Grenadines" }],
	["561", { code: "WS", name: "Samoa" }],
	["268", { code: "SM", name: "San Marino" }],
	["668", { code: "ST", name: "Sao Tome and Principe" }],
	["403", { code: "SA", name: "Saudi Arabia" }],
	["663", { code: "SN", name: "Senegal" }],
	["279", { code: "RS", name: "Serbia" }],
	["664", { code: "SC", name: "Seychelles" }],
	["667", { code: "SL", name: "Sierra Leone" }],
	["563", { code: "SG", name: "Singapore" }],
	["564", { code: "SG", name: "Singapore" }],
	["565", { code: "SG", name: "Singapore" }],
	["566", { code: "SG", name: "Singapore" }],
	["267", { code: "SK", name: "Slovak Republic" }],
	["278", { code: "SI", name: "Slovenia" }],
	["557", { code: "SB", name: "Solomon Islands" }],
	["666", { code: "SO", name: "Somalia" }],
	["601", { code: "ZA", name: "South Africa" }],
	["638", { code: "SS", name: "South Sudan" }],
	["224", { code: "ES", name: "Spain" }],
	["225", { code: "ES", name: "Spain" }],
	["417", { code: "LK", name: "Sri Lanka" }],
	["443", { code: "PS", name: "State of Palestine" }],
	["662", { code: "SD", name: "Sudan" }],
	["765", { code: "SR", name: "Suriname" }],
	["265", { code: "SE", name: "Sweden" }],
	["266", { code: "SE", name: "Sweden" }],
	["269", { code: "CH", name: "Switzerland" }],
	["468", { code: "SY", name: "Syrian Arab Republic" }],
	["472", { code: "TJ", name: "Tajikistan" }],
	["674", { code: "TZ", name: "Tanzania" }],
	["677", { code: "TZ", name: "Tanzania" }],
	["567", { code: "TH", name: "Thailand" }],
	["550", { code: "TL", name: "Timor-Leste" }],
	["671", { code: "TG", name: "Togolese Republic" }],
	["570", { code: "TO", name: "Tonga" }],
	["362", { code: "TT", name: "Trinidad and Tobago" }],
	["672", { code: "TN", name: "Tunisia" }],
	["434", { code: "TM", name: "Turkmenistan" }],
	["572", { code: "TV", name: "Tuvalu" }],
	["675", { code: "UG", name: "Uganda" }],
	["272", { code: "UA", name: "Ukraine" }],
	["470", { code: "AE", name: "United Arab Emirates" }],
	["471", { code: "AE", name: "United Arab Emirates" }],
	[
		"232",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland",
		},
	],
	[
		"233",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland",
		},
	],
	[
		"234",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland",
		},
	],
	[
		"235",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland",
		},
	],
	[
		"301",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - Anguilla",
		},
	],
	[
		"608",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - Ascension Island",
		},
	],
	[
		"310",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - Bermuda",
		},
	],
	[
		"378",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - British Virgin Islands",
		},
	],
	[
		"319",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - Cayman Islands",
		},
	],
	[
		"740",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - Falkland Islands",
		},
	],
	[
		"236",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - Gibraltar",
		},
	],
	[
		"348",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - Montserrat",
		},
	],
	[
		"555",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - Pitcairn Island",
		},
	],
	[
		"665",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - Saint Helena",
		},
	],
	[
		"364",
		{
			code: "GB",
			name: "United Kingdom of Great Britain and Northern Ireland - Turks and Caicos Islands",
		},
	],
	["338", { code: "US", name: "United States of America" }],
	["366", { code: "US", name: "United States of America" }],
	["367", { code: "US", name: "United States of America" }],
	["368", { code: "US", name: "United States of America" }],
	["369", { code: "US", name: "United States of America" }],
	["303", { code: "US", name: "United States of America - Alaska" }],
	["559", { code: "US", name: "United States of America - American Samoa" }],
	[
		"536",
		{ code: "US", name: "United States of America - Northern Mariana Islands" },
	],
	["358", { code: "US", name: "United States of America - Puerto Rico" }],
	[
		"379",
		{
			code: "US",
			name: "United States of America - United States Virgin Islands",
		},
	],
	["770", { code: "UY", name: "Uruguay" }],
	["437", { code: "UZ", name: "Uzbekistan" }],
	["576", { code: "VU", name: "Vanuatu" }],
	["577", { code: "VU", name: "Vanuatu" }],
	["208", { code: "VA", name: "Vatican City State" }],
	["775", { code: "VE", name: "Venezuela" }],
	["574", { code: "VN", name: "Viet Nam" }],
	["473", { code: "YE", name: "Yemen" }],
	["475", { code: "YE", name: "Yemen" }],
	["678", { code: "ZM", name: "Zambia" }],
	["679", { code: "ZW", name: "Zimbabwe" }],
]);

const METERS_PER_NM$1 = 1852;
const KNOTS_PER_M_PER_S$1 = 1.94384;
const LOST_TARGET_WARNING_AGE = 10 * 60; // in seconds - 10 minutes

function updateDerivedData(
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

function toRadians(v) {
	return (v * Math.PI) / 180;
}

function toDegrees$1(v) {
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
	target.cpaFormatted = formatCpa$1(target.cpa);
	target.tcpaFormatted = formatTcpa$1(target.tcpa);
	target.rangeFormatted =
		target.range != null
			? `${(target.range / METERS_PER_NM$1).toFixed(2)} NM`
			: "---";
	target.bearingFormatted =
		target.bearing != null ? `${target.bearing} T` : "---";
	target.sogFormatted =
		target.sog != null
			? `${(target.sog * KNOTS_PER_M_PER_S$1).toFixed(1)} kn`
			: "---";
	target.cogFormatted =
		target.cog != null ? `${Math.round(toDegrees$1(target.cog))} T` : "---";
	target.hdgFormatted =
		target.hdg != null ? `${Math.round(toDegrees$1(target.hdg))} T` : "---";
	target.rotFormatted = Math.round(toDegrees$1(target.rot)) || "---";
	target.aisClassFormatted =
		target.aisClass + (target.isVirtual ? " (virtual)" : "");
	target.sizeFormatted = `${target.length?.toFixed(1) ?? "---"} m x ${target.beam?.toFixed(1) ?? "---"} m`;
	target.imoFormatted = target.imo?.replace(/imo/i, "") || "---";
	target.latitudeFormatted = formatLat$1(target.latitude);
	target.longitudeFormatted = formatLon$1(target.longitude);

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
		getDistanceFromLatLonInMeters$1(
			selfTarget.latitude,
			selfTarget.longitude,
			target.latitude,
			target.longitude,
		),
	);
	target.bearing = Math.round(
		getRhumbLineBearing$1(
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
					METERS_PER_NM$1 &&
			(collisionProfiles[collisionProfiles.current].guard.speed === 0 ||
				(target.sog != null &&
					target.sog >
						collisionProfiles[collisionProfiles.current].guard.speed /
							KNOTS_PER_M_PER_S$1));

		// collision alarm
		target.collisionAlarm =
			target.cpa != null &&
			target.cpa <
				collisionProfiles[collisionProfiles.current].danger.cpa *
					METERS_PER_NM$1 &&
			target.tcpa != null &&
			target.tcpa > 0 &&
			target.tcpa < collisionProfiles[collisionProfiles.current].danger.tcpa &&
			(collisionProfiles[collisionProfiles.current].danger.speed === 0 ||
				(target.sog != null &&
					target.sog >
						collisionProfiles[collisionProfiles.current].danger.speed /
							KNOTS_PER_M_PER_S$1));

		// collision warning
		target.collisionWarning =
			target.cpa != null &&
			target.cpa <
				collisionProfiles[collisionProfiles.current].warning.cpa *
					METERS_PER_NM$1 &&
			target.tcpa != null &&
			target.tcpa > 0 &&
			target.tcpa < collisionProfiles[collisionProfiles.current].warning.tcpa &&
			(collisionProfiles[collisionProfiles.current].warning.speed === 0 ||
				(target.sog != null &&
					target.sog >
						collisionProfiles[collisionProfiles.current].warning.speed /
							KNOTS_PER_M_PER_S$1));

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
				Math.round(weight - (weight * target.cpa) / 5 / METERS_PER_NM$1),
			);
		}

		// sort closer targets to top
		if (target.range != null && target.range > 0) {
			// range of 0 nm increases order by 0
			// range of 5 nm increases order by 500
			target.order += Math.round((100 * target.range) / METERS_PER_NM$1);
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

function getDistanceFromLatLonInMeters$1(lat1, lon1, lat2, lon2) {
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

function getRhumbLineBearing$1(lat1, lon1, lat2, lon2) {
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
	return (toDegrees$1(Math.atan2(diffLon, diffPhi)) + 360) % 360;
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
function formatLat$1(dec) {
	var decAbs = Math.abs(dec);
	var deg = `0${Math.floor(decAbs)}`.slice(-2);
	var min = `0${((decAbs - deg) * 60).toFixed(4)}`.slice(-7);
	return `${dec > 0 ? "N" : "S"} ${deg}° ${min}`;
}

// W 075° 08.3692
function formatLon$1(dec) {
	var decAbs = Math.abs(dec);
	var deg = `00${Math.floor(decAbs)}`.slice(-3);
	var min = `0${((decAbs - deg) * 60).toFixed(4)}`.slice(-7);
	return `${dec > 0 ? "E" : "W"} ${deg}° ${min}`;
}

// 1.53 NM
function formatCpa$1(cpa) {
	// if cpa is null it should be returned as blank. toFixed makes it '0.00'
	return cpa != null ? `${(cpa / METERS_PER_NM$1).toFixed(2)} NM` : "---";
}

// hh:mm:ss or mm:ss e.g. 01:15:23 or 51:37
function formatTcpa$1(tcpa) {
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

var aisUtils = /*#__PURE__*/Object.freeze({
	__proto__: null,
	toDegrees: toDegrees$1,
	toRadians: toRadians,
	updateDerivedData: updateDerivedData
});

var type = "object";
var description = "Note: edit CPA warning and alarm settings in the webapp.";
var properties = {
	enableDataPublishing: {
		type: "boolean",
		title: "Publish AIS Target CPA, TCPA, Range, Bearing, Priority, and Alarm Status to SignalK (navigation.closestApproach). This is not required if just using the webapp.",
		"default": true
	},
	enableAlarmPublishing: {
		type: "boolean",
		title: "Publish AIS Target CPA and Guard warning/alarm notifications to SignalK (notifications.navigation.closestApproach). This is not required if just using the webapp.",
		"default": true
	},
	enableEmulator: {
		type: "boolean",
		title: "Enable Vesper XB-8000 Emulation. Turn this on if you intend to use the Vesper WatchMate mobile apps.",
		"default": false
	}
};
var schema = {
	type: type,
	description: description,
	properties: properties
};

// FIXME rot coming in in radians now

var aisUtilsPromise = Promise.resolve().then(function () { return aisUtils; });
let toDegrees;

const expressApp = express();

var sse = new SSE();

// import { clearInterval } from "timers";
// import mdns from "multicast-dns";

const METERS_PER_NM = 1852;
const KNOTS_PER_M_PER_S = 1.94384;

const httpPort = 39151;
const nmeaOverTcpServerPort = 39150; // apps look for nmea traffic on 39150. this is not confurable in the apps. so we proxy signalk 10110 to 39150.
const proxySourceHostname = "127.0.0.1"; // signalk server address (localhost - same place this plugin is running)
const proxySourcePort = 10110; // signalk nmea over tcp port

var gps = {};
var targets$1 = new Map();
var positions = [];
var app;
var collisionProfiles$1;
var selfMmsi$1, selfName$1, selfCallsign$1, selfTypeId$1;

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

// const stateMappingNumericToText = {
// 	0: "motoring",
// 	1: "anchored",
// 	2: "not under command",
// 	3: "restricted manouverability",
// 	4: "constrained by draft",
// 	5: "moored",
// 	6: "aground",
// 	7: "fishing",
// 	8: "sailing",
// 	9: "hazardous material high speed",
// 	10: "hazardous material wing in ground",
// 	14: "ais-sart",
// 	15: "default",
// };

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
	if (gps?.isValid) {
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
	if (gps?.isValid) {
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
                <alarmsEnabled>${
									anchorWatchControl.alarmsEnabled
								}</alarmsEnabled>
                <anchorLatitude>${
									anchorWatchControl.anchorPosition.a
								}</anchorLatitude>
                <anchorLongitude>${
									anchorWatchControl.anchorPosition.o
								}</anchorLongitude>
                <anchorCorrectedLat></anchorCorrectedLat>
                <anchorCorrectedLong></anchorCorrectedLong>
                <usingCorrected>0</usingCorrected>
                <distanceToAnchor>${formatFixed(
									anchorWatchControl.distanceToAnchor,
									1,
								)}</distanceToAnchor>
                <bearingToAnchor>${
									anchorWatchControl.bearingToAnchor || ""
								}</bearingToAnchor>
                <alarmTriggered>${
									anchorWatchControl.alarmTriggered
								}</alarmTriggered>
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
                <Pref prefname='profile.current'>${collisionProfiles$1.current.toUpperCase()}</Pref>
            </Prefs>
        </Watchmate>`;
}

function getAlarmsXml() {
	var response = `<?xml version = '1.0' encoding = 'ISO-8859-1' ?>
        <Watchmate version='1.0' priority='1'>`;

	for (var target of targets$1.values()) {
		if (target.alarmState) {
			response += `<Alarm MMSI='${target.mmsi}' state='${
				translateAlarmState(target.alarmState) || ""
			}' type='${target.alarmType || ""}'>
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

	for (var target of targets$1.values()) {
		if (target.isValid && target.mmsi !== selfMmsi$1) {
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

	var target = targets$1.get(mmsi);

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
<Dimensions>${
			target.length && target.width
				? `${target.length}m x ${target.width}m`
				: "---"
		}</Dimensions >
<Draft>${target.draft ? `${target.draft}m` : "---"}</Draft>
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
<MMSI>${selfMmsi$1}</MMSI>
<Name>${selfName$1}</Name>
<CallSign>${selfCallsign$1}</CallSign>
<VesselType>${selfTypeId$1}</VesselType>
<VesselSize a='1' b='1' c='1' d='1'/>
</OwnStaticData>
</Watchmate>`;
}

function setupSse() {
	// ******************** SSE STUFF **********************
	// streaming protocol used in lieu of xml or json REST calls

	{
		// send heartbeat
		streamingHeartBeatInterval = setInterval(() => {
			sendSseMsg("HeartBeat", { time: Date.now() });
		}, 15000);

		// send VesselPositionUnderway - 15s?
		streamingVesselPositionUnderwayInterval = setInterval(() => {
			// 75:VesselPositionUnderway{"a":407106833,"o":-740460408,"cog":0,"sog":0.0,"var":-13,"t":1576639404}
			// 80:VesselPositionUnderway{"a":380704720,"o":-785886085,"cog":220.28,"sog":0,"var":-9.77,"t":1576873731}
			// sse.send("75:VesselPositionUnderway{\"a\":407106833,\"o\":-740460408,\"cog\":0,\"sog\":0.0,\"var\":-13,\"t\":1576639404}\n\n");

			if (gps?.isValid) {
				const vesselPositionUnderway = {
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
				outOfBounds: anchorWatchControl.alarmTriggered === 1,
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
		var json = JSON.stringify(data);
		sse.send(`${json.length + 2}:${name}${json}\n\n`);
	}

	// ******************** END SSE STUFF **********************
}

// save position - keep up to 2880 positions (24 hours at 30 sec cadence)
savePositionInterval = setInterval(() => {
	if (gps?.isValid) {
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
	expressApp.use((req, _res, next) => {
		next();
	});
	//}, compression());

	expressApp.use(express.json()); // for parsing application/json
	expressApp.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

	// sanity
	expressApp.get("/", (_req, res) => res.send("Hello World!"));

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
	expressApp.get("/prefs/start_notifying", (_req, res) => {
		res.json();
	});

	// GET /prefs/getPreferences?accept.demo_mode&profile.current
	expressApp.get("/prefs/getPreferences", (_req, res) => {
		sendXmlResponse(res, getPreferencesXml());
	});

	// GET /alarms/get_current_list
	expressApp.get("/alarms/get_current_list", (_req, res) => {
		sendXmlResponse(res, getAlarmsXml());

		// FIXME: testing response format when there are no alarms. the ios app makes excessive calls, so i dont think we have this quite right yet.
		//res.json();
		//res.status(204).end()
		// 204 No Content
		// 404 Not Found
	});

	// GET /test/getSimFiles
	expressApp.get("/test/getSimFiles", (_req, res) => {
		sendXmlResponse(res, getSimsXml());
	});

	// GET /targets/getTargets
	expressApp.get("/targets/getTargets", (_req, res) => {
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
			collisionProfiles$1.current = req.query["profile.current"].toLowerCase();
			saveCollisionProfiles();
			sendXmlResponse(res, getPreferencesXml());
		} else {
			app.debug(`*** sending 404 for ${req.method} ${req.originalUrl}`);
			res.sendStatus(404);
		}
	});

	// GET /alarms/mute_alarm
	expressApp.get("/alarms/mute_alarm", (_req, res) => {
		muteAlarms();
		res.json();
	});

	expressApp.get("/datamodel/propertyEdited", (req, res) => {
		// GET /datamodel/propertyEdited?AnchorWatch.setAnchor=1
		if (req.query["AnchorWatch.setAnchor"]) {
			const setAnchor = req.query["AnchorWatch.setAnchor"];

			if (setAnchor === 1) {
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

	{
		// /v3/openChannel
		// after adding this, we get poounded with GET /v3/subscribeChannel?VesselPositionUnderway
		expressApp.get("/v3/openChannel", sse.init);

		// GET /v3/subscribeChannel?<anything>
		expressApp.get("/v3/subscribeChannel", (_req, res) => {
			res.json();
		});

		// GET /v3/watchMate/collisionProfiles
		// JSON.stringify(collisionProfiles,null,2);
		expressApp.get("/v3/watchMate/collisionProfiles", (_req, res) => {
			res.json(collisionProfiles$1);
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
			mergePutData(req, collisionProfiles$1);
			//app.debug("after merge", collisionProfiles);
			// remove "threat" paths that watchmate adds:
			delete collisionProfiles$1.anchor.threat;
			delete collisionProfiles$1.harbor.threat;
			delete collisionProfiles$1.coastal.threat;
			delete collisionProfiles$1.offshore.threat;
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
	{
		tcpProxyServer = proxy.createProxy(
			nmeaOverTcpServerPort,
			proxySourceHostname,
			proxySourcePort,
		);
		app.debug(`Proxy server listening on port ${nmeaOverTcpServerPort}`);
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
	for (const target of targets$1.values()) {
		if (target.alarmState === "danger") {
			// FIXME nothing is consuming alarmIsMuted
			target.alarmIsMuted = true;
		}
	}

	// TODO: or should we just silence the anchor watch for 20 minutes? that
	// might be better
	if (
		anchorWatchControl.alarmsEnabled === 1 &&
		anchorWatchControl.alarmTriggered === 1
	) {
		anchorWatchControl.alarmsEnabled = 0;
	}
}

function translateAlarmState(alarmState) {
	return alarmState === "warning" ? "threat" : alarmState;
}

// latitudeText: 'N 39° 57.0689',
function formatLat(dec) {
	var decAbs = Math.abs(dec);
	var deg = `0${Math.floor(decAbs)}`.slice(-2);
	var min = `0${((decAbs - deg) * 60).toFixed(4)}`.slice(-7);
	return `${dec > 0 ? "N" : "S"} ${deg}° ${min}`;
}

// longitudeText: 'W 075° 08.3692',
function formatLon(dec) {
	var decAbs = Math.abs(dec);
	var deg = `00${Math.floor(decAbs)}`.slice(-3);
	var min = `0${((decAbs - deg) * 60).toFixed(4)}`.slice(-7);
	return `${dec > 0 ? "E" : "W"} ${deg}° ${min}`;
}

// return in knots
function formatSog(sog) {
	return formatFixed(sog * KNOTS_PER_M_PER_S, 1);
}

function formatCog(cog) {
	return cog === undefined ? "" : `00${Math.round(toDegrees(cog))}`.slice(-3);
}

function formatRot(rot) {
	// sample: 3°/min
	// to decode the field value, divide by 4.733and then square it. Sign of the field value should be preserved
	return rot === undefined || rot === 0 || rot === -128
		? ""
		: `${Math.round((rot / 4.733) ** 2)}°/min`;
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
	pattern = "([&\"<>'])".replace(new RegExp(`[${ignore}]`, "g"), "");

	return string.replace(new RegExp(pattern, "g"), (_str, item) => map[item]);
}

// derive target data this is only used by the vesper emulator
function refreshTargetData() {
	gps = targets$1.get(selfMmsi$1);

	targets$1.forEach((target, mmsi) => {
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
		else if (target.aisClass === "ATON" || mmsi.startsWith("99")) {
			target.vesperTargetType = 4;
		}
		// class A
		else if (target.aisClass === "A") {
			target.vesperTargetType = 1;
		}
		// make evrything else class B
		else {
			target.vesperTargetType = 2;
		}
	});
}

function start(
	_app,
	_collisionProfiles,
	_selfMmsi,
	_selfName,
	_selfCallsign,
	_selfTypeId,
	_targets,
	_saveCollisionProfiles,
) {
	//console.log('vesper.start received:',_collisionProfiles, _selfMmsi, _selfName, _selfCallsign, _selfTypeId, _gps, _targets, _saveCollisionProfiles)
	app = _app;
	collisionProfiles$1 = _collisionProfiles;
	selfMmsi$1 = _selfMmsi;
	selfName$1 = _selfName;
	selfCallsign$1 = _selfCallsign;
	selfTypeId$1 = _selfTypeId;
	targets$1 = _targets;
	saveCollisionProfiles = _saveCollisionProfiles;

	// FIXME
	Promise.resolve(aisUtilsPromise).then((aisUtils) => {
		toDegrees = aisUtils.toDegrees;
		app.debug("starting vesper emulator", collisionProfiles$1);
		refreshTargetData();
		setupHttpServer();
		setupTcpProxyServer();
		setupSse();

		// update the data model every 1000 ms
		refreshInterval = setInterval(() => {
			refreshTargetData();
		}, 1000);
	});
}

function stop() {
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
				`Stopping proxy server listening on port ${nmeaOverTcpServerPort}`,
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
}

const AGE_OUT_OLD_TARGETS = true;
const TARGET_MAX_AGE = 30 * 60; // max age in seconds - 30 minutes

var selfMmsi;
var selfName;
var selfCallsign;
var selfTypeId;
var selfTarget;

var targets = new Map();
var collisionProfiles;
var options;

function index (app) {
	var plugin = {};
	var unsubscribes = [];

	var refreshDataModelInterval;

	plugin.id = "signalk-ais-target-prioritizer";
	plugin.name = "SignalK AIS Target Prioritizer";
	plugin.description =
		"A SignalK plugin that priorizes AIS targets according to guard and CPA criteria";

	plugin.start = (_options) => {
		app.debug(`*** Starting plugin ${plugin.id} with options=`, _options);
		options = _options;
		getCollisionProfiles();
		if (
			options.enableDataPublishing ||
			options.enableAlarmPublishing ||
			options.enableEmulator
		) {
			enablePluginCpaCalculations();
		} else {
			// if plugin was stopped and started again with options set to not perform calculations, then clear out old targets
			targets.clear();
		}
		if (options.enableEmulator) {
			//app.debug("collisionProfiles in index.js", collisionProfiles);
			//vesper.collisionProfiles = collisionProfiles;
			//vesper.setCollisionProfiles(collisionProfiles);
			start(
				app,
				collisionProfiles,
				selfMmsi,
				selfName,
				selfCallsign,
				selfTypeId,
				targets,
				saveCollisionProfiles,
			);
		}
	};

	plugin.stop = () => {
		app.debug(`Stopping plugin ${plugin.id}`);
		// unsubscribes.forEach((f) => f());
		unsubscribes = [];
		if (refreshDataModelInterval) {
			clearInterval(refreshDataModelInterval);
		}
		if (options?.enableEmulator) {
			stop();
		}
	};

	plugin.schema = schema;

	plugin.registerWithRouter = (router) => {
		// GET /plugins/${plugin.id}/getCollisionProfiles
		router.get("/getCollisionProfiles", (_req, res) => {
			app.debug("getCollisionProfiles", collisionProfiles);
			res.json(collisionProfiles);
		});

		// PUT /plugins/${plugin.id}/setCollisionProfiles
		router.put("/setCollisionProfiles", (req, res) => {
			var newCollisionProfiles = req.body;
			app.debug("setCollisionProfiles", newCollisionProfiles);
			// do some basic validation to ensure we have some real config data before saving it
			if (
				!newCollisionProfiles ||
				!newCollisionProfiles.current ||
				!newCollisionProfiles.anchor ||
				!newCollisionProfiles.harbor ||
				!newCollisionProfiles.coastal ||
				!newCollisionProfiles.offshore
			) {
				app.error(
					"ERROR - not saving invalid new collision profiles",
					newCollisionProfiles,
				);
				res.status(500).end();
				return;
			}
			// must use Object.assign rather than "collisionProfiles = newCollisionProfiles" to prevent breaking the reference we passed into the vesper emulator
			Object.assign(collisionProfiles, newCollisionProfiles);
			saveCollisionProfiles();
			res.json(collisionProfiles);
		});

		// GET /plugins/${plugin.id}/muteAllAlarms
		router.get("/muteAllAlarms", (_req, res) => {
			app.debug("muteAllAlarms");
			targets.forEach((target, mmsi) => {
				if (target.alarmState === "danger" && !target.alarmIsMuted) {
					app.debug(
						"muting alarm for target",
						mmsi,
						target.name,
						target.alarmType,
						target.alarmState,
					);
					target.alarmIsMuted = true;
				}
			});
			res.json();
		});

		// GET /plugins/${plugin.id}/setAlarmIsMuted/:mmsi/:alarmIsMuted
		router.get("/setAlarmIsMuted/:mmsi/:alarmIsMuted", (req, res) => {
			var mmsi = req.params.mmsi;
			var alarmIsMuted = req.params.alarmIsMuted === "true";
			app.debug("setting alarmIsMuted", mmsi, alarmIsMuted);
			if (targets.has(mmsi)) {
				targets.get(mmsi).alarmIsMuted = alarmIsMuted;
				res.json();
			} else {
				res.status(404).end();
			}
		});

		// GET /plugins/${plugin.id}/getTargets
		router.get("/getTargets", (_req, res) => {
			app.debug("getTargets", targets.size);
			res.json(Object.fromEntries(targets));
		});

		// GET /plugins/${plugin.id}/getTarget/:mmsi
		router.get("/getTarget/:mmsi", (req, res) => {
			var mmsi = req.params.mmsi;
			app.debug("getTarget", mmsi);
			if (targets.has(mmsi)) {
				res.json(targets.get(mmsi));
			} else {
				res.status(404).end();
			}
		});
	};

	function getCollisionProfiles() {
		try {
			const dataDirPath = app.getDataDirPath();
			const collisionProfilesPath = path.join(
				dataDirPath,
				"collisionProfiles.json",
			);
			if (fs.existsSync(collisionProfilesPath)) {
				app.debug("Reading file", collisionProfilesPath);
				collisionProfiles = JSON.parse(
					fs.readFileSync(collisionProfilesPath).toString(),
				);
			} else {
				app.debug(
					"collisionProfiles.json not found, using defaultCollisionProfiles",
					collisionProfilesPath,
				);
				collisionProfiles = defaultCollisionProfiles;
				saveCollisionProfiles();
			}
		} catch (err) {
			app.error("Error reading collisionProfiles.json:", err);
			throw new Error("Error reading collisionProfiles.json:", err);
		}
	}

	function saveCollisionProfiles() {
		app.debug("saving ", collisionProfiles);

		var dataDirPath = app.getDataDirPath();

		if (!fs.existsSync(dataDirPath)) {
			try {
				fs.mkdirSync(dataDirPath, { recursive: true });
			} catch (err) {
				app.error("Error creating dataDirPath:", err);
				throw new Error("Error creating dataDirPath:", err);
			}
		}

		var collisionProfilesPath = path.join(
			dataDirPath,
			"collisionProfiles.json",
		);
		app.debug("Writing file", collisionProfilesPath);
		try {
			fs.writeFileSync(
				collisionProfilesPath,
				JSON.stringify(collisionProfiles, null, 2),
			);
		} catch (err) {
			app.error("Error writing collisionProfiles.json:", err);
			throw new Error("Error writing collisionProfiles.json:", err);
		}
	}

	function enablePluginCpaCalculations() {
		selfMmsi = app.getSelfPath("mmsi");
		selfName = app.getSelfPath("name");
		selfCallsign = app.getSelfPath("communication")
			? app.getSelfPath("communication").callsignVhf
			: "";
		selfTypeId = app.getSelfPath("design.aisShipType")
			? app.getSelfPath("design.aisShipType").value.id
			: "";

		// *
		// atons.*
		// vessels.*
		// vessels.self
		var localSubscription = {
			context: "*", // we need both vessels and atons
			subscribe: [
				{
					// "name" is in the root path
					// and "communication.callsignVhf"
					// and imo
					path: "",
					period: 1000,
				},
				{
					path: "navigation.position",
					period: 1000,
				},
				{
					path: "navigation.courseOverGroundTrue",
					period: 1000,
				},
				{
					path: "navigation.speedOverGround",
					period: 1000,
				},
				{
					path: "navigation.magneticVariation",
					period: 1000,
				},
				{
					path: "navigation.headingTrue",
					period: 1000,
				},
				{
					path: "navigation.state",
					period: 1000,
				},
				{
					path: "navigation.destination.commonName",
					period: 1000,
				},
				{
					path: "navigation.rateOfTurn",
					period: 1000,
				},
				{
					path: "design.*",
					period: 1000,
				},
				{
					path: "sensors.ais.class",
					period: 1000,
				},
				{
					path: "atonType",
					period: 1000,
				},
				{
					path: "offPosition",
					period: 1000,
				},
				{
					path: "virtual",
					period: 1000,
				},
			],
		};

		app.subscriptionmanager.subscribe(
			localSubscription,
			unsubscribes,
			(subscriptionError) => {
				app.error(`Error:${subscriptionError}`);
			},
			(delta) => processDelta(delta),
		);

		// update data model every 1 second
		refreshDataModelInterval = setInterval(refreshDataModel, 1000);
	}

	function processDelta(delta) {
		var updates = delta.updates;
		var mmsi = delta.context.slice(-9);

		//app.debug('processDelta', mmsi, delta.updates.length, delta.updates[0].values[0]);

		if (!mmsi || !/[0-9]{9}/.test(mmsi)) {
			app.debug(
				"ERROR: received a delta with an invalid mmsi",
				JSON.stringify(delta, null, "\t"),
			);
			return;
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

		for (const update of updates) {
			const values = update.values;
			for (const value of values) {
				//app.debug('value', value);

				switch (value.path) {
					case "":
						if (value.value.name) {
							target.name = value.value.name;
						} else if (value.value.communication?.callsignVhf) {
							target.callsign = value.value.communication.callsignVhf;
						} else if (value.value.registrations?.imo) {
							target.imo = value.value.registrations.imo.replace(/imo/i, "");
						} else if (value.value.mmsi) ; else ;
						break;
					case "navigation.position":
						target.latitude = value.value.latitude;
						target.longitude = value.value.longitude;
						target.lastSeenDate = new Date(update.timestamp);
						break;
					case "navigation.courseOverGroundTrue":
						target.cog = value.value;
						break;
					case "navigation.speedOverGround":
						target.sog = value.value;
						break;
					case "navigation.magneticVariation":
						target.magvar = value.value;
						break;
					case "navigation.headingTrue":
						target.hdg = value.value;
						break;
					case "navigation.rateOfTurn":
						target.rot = value.value;
						break;
					case "design.aisShipType":
						target.typeId = value.value.id;
						target.type = value.value.name;
						break;
					case "navigation.state":
						target.status = value.value;
						break;
					case "sensors.ais.class":
						target.aisClass = value.value;
						break;
					case "navigation.destination.commonName":
						target.destination = value.value;
						break;
					case "design.length":
						target.length = value.value.overall;
						break;
					case "design.beam":
						target.width = value.value;
						break;
					case "design.draft":
						target.draft = value.value.current;
						break;
					case "atonType":
						target.typeId = value.value.id;
						target.type = value.value.name;
						if (target.status == null) {
							target.status = "default"; // 15 = "default"
						}
						break;
					case "offPosition":
						target.isOffPosition = value.value ? 1 : 0;
						break;
					case "virtual":
						target.isVirtual = value.value ? 1 : 0;
						break;
					//app.debug('received unexpected delta', delta.context, value.path, value.value);
				}
			}
		}

		targets.set(mmsi, target);
	}

	async function refreshDataModel() {
		try {
			// collisionProfiles.setFromIndex = Math.floor(new Date().getTime() / 1000);
			// app.debug('index.js: setFromIndex,setFromEmulator', collisionProfiles.setFromIndex, collisionProfiles.setFromEmulator, collisionProfiles.anchor.guard.range);
			// app.debug("collisionProfiles.anchor.guard.range - index ",collisionProfiles.anchor.guard.range);

			selfTarget = targets.get(selfMmsi);

			if (aisUtils) {
				try {
					updateDerivedData(
						targets,
						selfTarget,
						collisionProfiles,
						TARGET_MAX_AGE,
					);
				} catch (error) {
					app.debug(error); // we use app.debug rather than app.error so that the user can filter these out of the log
					app.setPluginError(error.message);
					sendNotification("alarm", error.message);
					return;
				}
			} else {
				app.debug("aisUtils not ready...");
				return;
			}

			if (selfTarget.lastSeen > 30) {
				const message = `No GPS position received for more than ${selfTarget.lastSeen} seconds`;
				app.debug(message); // we use app.debug rather than app.error so that the user can filter these out of the log
				app.setPluginError(message);
				sendNotification("alarm", message);
				return;
			}

			let isCurrentAlarm = false;

			targets.forEach((target, mmsi) => {
				if (options.enableDataPublishing && mmsi !== selfMmsi) {
					pushTargetDataToSignalK(target);
				}

				// publish warning/alarm notifications
				// FIXME - should we send 1 notification for all targets? or separate notifications for each target?
				if (
					options.enableAlarmPublishing &&
					target.alarmState &&
					!target.alarmIsMuted
				) {
					const message = (
						`${target.name || `<${target.mmsi}>`} - ` +
						`${target.alarmType} ` +
						`${target.alarmState === "danger" ? "alarm" : target.alarmState}`
					).toUpperCase();
					if (target.alarmState === "warning") {
						sendNotification("warn", message);
					} else if (target.alarmState === "danger") {
						sendNotification("alarm", message);
					}
					isCurrentAlarm = true;
				}

				if (AGE_OUT_OLD_TARGETS && target.lastSeen > TARGET_MAX_AGE) {
					app.debug(
						"ageing out target",
						target.mmsi,
						target.name,
						target.lastSeen,
					);
					targets.delete(target.mmsi);
				}
			});

			// if there are no active alarms, yet still an alarm notification, then clean the alarm notification
			if (!isCurrentAlarm && isCurrentAlarmNotification()) {
				sendNotification("normal", "watching");
			}

			app.setPluginStatus(`Watching ${targets.size - 1} targets`);
		} catch (err) {
			app.debug("error in refreshDataModel", err.message, err);
		}
	}

	function pushTargetDataToSignalK(target) {
		app.handleMessage(plugin.id, {
			context: target.context,
			updates: [
				{
					values: [
						{
							path: "navigation.closestApproach",
							value: {
								distance: target.cpa,
								timeTo: target.tcpa,
								range: target.range,
								bearing: target.bearing,
								collisionRiskRating: target.order,
								collisionAlarmType: target.alarmType,
								collisionAlarmState: target.alarmState,
							},
						},
					],
				},
			],
		});
	}

	function sendNotification(state, message) {
		app.debug("sendNotification", state, message);
		var delta = {
			updates: [
				{
					values: [
						{
							path: "notifications.navigation.closestApproach",
							value: {
								state: state,
								method: ["visual", "sound"],
								message: message,
							},
						},
					],
				},
			],
		};

		app.handleMessage(plugin.id, delta);
	}

	function isCurrentAlarmNotification() {
		const notifications = app.getSelfPath(
			"notifications.navigation.closestApproach",
		);
		return notifications?.value?.state === "alarm";
	}

	return plugin;
}

module.exports = index;
