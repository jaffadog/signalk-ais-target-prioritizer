import {
  DEFAULT_ENABLE_ALARM_PUBLISHING,
  DEFAULT_ENABLE_DATA_PUBLISHING,
  DEFAULT_MAXIMUM_TARGET_RANGE,
  DEFAULT_UPDATE_INTERVAL_DELAY,
} from "../engine/constants";

export const schema: object | (() => object) = {
  type: "object",
  description: "Note: edit CPA warning and alarm settings in the webapp.",
  properties: {
    updateIntervalDelay: {
      title: "Update Interval (Seconds)",
      description: `Number of seconds between target data updates (default is ${DEFAULT_UPDATE_INTERVAL_DELAY} seconds).`,
      type: "number",
      minimum: 1,
      default: DEFAULT_UPDATE_INTERVAL_DELAY,
    },
    maximumTargetRange: {
      title: "Ignore Targets Further Than (NM)",
      description: `(default is ${DEFAULT_MAXIMUM_TARGET_RANGE} NM).`,
      type: "number",
      minimum: 5,
      default: DEFAULT_MAXIMUM_TARGET_RANGE,
    },
    enableDataPublishing: {
      title:
        "Publish AIS Target CPA, TCPA, Range, Bearing, Priority, and Alarm Status to Signal K (navigation.closestApproach). This is not required if just using the webapp.",
      description: `(default is ${DEFAULT_ENABLE_DATA_PUBLISHING}).`,
      type: "boolean",
      default: DEFAULT_ENABLE_DATA_PUBLISHING,
    },
    enableAlarmPublishing: {
      title:
        "Publish AIS Target CPA and Guard warning/alarm notifications to Signal K (notifications.navigation.closestApproach). This is not required if just using the webapp.",
      description: `(default is ${DEFAULT_ENABLE_ALARM_PUBLISHING}).`,
      type: "boolean",
      default: DEFAULT_ENABLE_ALARM_PUBLISHING,
    },
  },
};
