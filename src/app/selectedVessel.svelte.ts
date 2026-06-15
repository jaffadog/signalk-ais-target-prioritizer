import { mapState } from "../engine/map.svelte";
import { vesselsState, vessels } from "../engine/vessels.svelte";

const selectedVessel = $derived(
  vesselsState.selectedVesselMmsi
    ? vessels[vesselsState.selectedVesselMmsi]
    : null,
);

export function getSelectedVesselScreenCoordinates() {
  if (
    !mapState.instance ||
    !selectedVessel ||
    selectedVessel.longitude === null ||
    selectedVessel.latitude === null
  )
    return null;
  return mapState.instance.project([
    selectedVessel.longitude,
    selectedVessel.latitude,
  ]);
}
