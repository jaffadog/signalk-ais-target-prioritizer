import { mapState } from "../engine/map.svelte";
import { vesselsState, vessels } from "../engine/vessels.svelte";

const selectedVessel = $derived(
  vesselsState.selectedVesselContext
    ? vessels[vesselsState.selectedVesselContext]
    : null,
);

export function getSelectedVesselScreenCoordinates() {
  if (
    !mapState.instance ||
    !selectedVessel ||
    selectedVessel.longitude === null ||
    selectedVessel.latitude === null
  )
    return;
  return mapState.instance.project([
    selectedVessel.longitude,
    selectedVessel.latitude,
  ]);
}
