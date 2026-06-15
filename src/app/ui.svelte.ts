export const ui = $state({
  visible: undefined,
  width: undefined,
  noSleep: false,
  darkMode: localStorage.getItem("theme") === "dark",
  vesselProperties: {
    visible: false,
  },
  vesselTable: {
    visible: false,
  },
  settings: {
    visible: false,
  },
  editProfiles: {
    visible: false,
  },
  notification: {
    visible: false,
  },
  alarms: {
    visible: false,
  },
  layersMenu: {
    visible: false,
  },
});
