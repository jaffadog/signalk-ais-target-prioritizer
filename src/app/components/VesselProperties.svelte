<script lang="ts">
  import { Info, TriangleAlert, Volume2, VolumeX, XIcon } from "@lucide/svelte";
  import { Dialog, Popover, Portal } from "@skeletonlabs/skeleton-svelte";

  // The following animation is optional.
  // This may also be included inline.
  const animation =
    "transition transition-discrete opacity-0 translate-y-[100px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[100px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0";

  import {
    formatAngle,
    formatCpa,
    formatDistance,
    formatDraft,
    formatLat,
    formatLon,
    formatName,
    formatRateOfTurn,
    formatSize,
    formatSpeed,
    formatTcpa,
  } from "../utils/formatUtils";
  import { getCountryFromMMSI } from "mmsi-country-lookup";
  import { isValidNumber, toDeg } from "../../engine/calculations";
  import { ui } from "../ui.svelte";
  import { vessels, vesselsState } from "../../engine/vessels.svelte";
  import { setAlarmIsMuted } from "../../engine/alarms.svelte";
  import { pushAlarmIsMuted } from "../utils/api";
  import { onMount } from "svelte";
  import { getSelectedVesselScreenCoordinates } from "../selectedVessel.svelte";

  let modalPosition = $state<string>("");
  let alertMessage = $state<string | null>(null);

  console.log("ENTER VesselProperties");

  const selectedVessel = $derived(
    vesselsState.selectedVesselContext
      ? vessels[vesselsState.selectedVesselContext]
      : null,
  );

  // position the modal left or right
  onMount(() => {
    if (!selectedVessel)
      throw new Error("VesselProperties requires a valid selectedVessel");

    // decide on the left/right positioning of this modal
    const selectedVesselScreenPosition = getSelectedVesselScreenCoordinates();
    // if its a narrow screen, show modal in the default centered manner
    // if boat is right of center, place modal on left
    // if boat is left of center, place modal on right
    if (ui.width && ui.width > 600) {
      if (
        selectedVesselScreenPosition &&
        selectedVesselScreenPosition?.x > ui.width / 2
      ) {
        modalPosition = "ml-24 mr-auto";
      } else {
        modalPosition = "ml-auto mr-24";
      }
    }
  });

  const handleToggleMute = () => {
    if (selectedVessel) {
      const alarmIsMuted = $state.snapshot(selectedVessel.alarmIsMuted);
      setAlarmIsMuted(selectedVessel.context, !alarmIsMuted);
      pushAlarmIsMuted(selectedVessel.context, !alarmIsMuted);
      alertMessage = `Vessel ${selectedVessel.alarmIsMuted ? "" : "un"}muted`;
    }
  };

  function close() {
    alertMessage = null;
    ui.vesselProperties.visible = false;
  }
</script>

{#if selectedVessel}
  <Dialog
    open={ui.vesselProperties.visible}
    onOpenChange={(e) => {
      ui.vesselProperties.visible = e.open;
      if (!e.open) {
        close();
      }
    }}
  >
    <Portal>
      <!-- 
        FIXME consider removing the backdrop and allowing the user to interact 
        with the map while the properties dialog is visible 
      -->
      <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/50" />
      <Dialog.Positioner
        class="fixed inset-0 z-50 flex justify-center items-center p-4"
      >
        <Dialog.Content
          class="flex flex-col card bg-surface-100-900 w-full sm:w-md p-4 space-y-4 shadow-xl {animation} max-h-[90dvh] {modalPosition}"
        >
          <!-- header -->
          <header class="flex justify-between items-center">
            {#if selectedVessel.context !== vesselsState.myVesselContext}
              <button
                class="btn btn-icon p-0 preset-filled-primary-500 inline-flex h-10 w-10 items-center justify-center rounded-full text-lg font-semibold"
                type="button"
                title="Toggle alarm mute"
                onclick={handleToggleMute}
              >
                {#if selectedVessel.alarmIsMuted}
                  <VolumeX size={18} />
                {:else}
                  <Volume2 size={18} />
                {/if}
              </button>
            {/if}
            <Dialog.Title class="text-lg font-bold"
              >{formatName(selectedVessel)}</Dialog.Title
            >
            <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
              <XIcon class="size-4" />
            </Dialog.CloseTrigger>
          </header>

          <!-- alarms -->
          {#if alertMessage}
            <div class="card p-4 preset-tonal-primary flex items-center gap-2">
              <Info />
              <span class="flex-1">{alertMessage}</span>
              <button
                class="btn-icon hover:preset-tonal"
                onclick={() => (alertMessage = null)}
              >
                <XIcon class="size-4" />
              </button>
            </div>
          {/if}

          {#if selectedVessel.alarmState}
            <div
              class={`card p-4 flex items-center justify-center gap-2 ${
                selectedVessel.alarmState === "danger"
                  ? "preset-tonal-error"
                  : "preset-tonal-warning"
              }`}
            >
              <TriangleAlert />
              <span class="uppercase font-semibold">
                {selectedVessel.alarmType}
                {selectedVessel.alarmState}
              </span>
            </div>
          {/if}

          <!-- body -->
          <Dialog.Description class="flex-1 overflow-y-auto">
            <!-- {/* vessel data */} -->
            <dl class="divide-y">
              <div class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt class="font-medium">Last Seen</dt>

                <dd class="xs:col-span-2">
                  {selectedVessel.lastSeenSecondsAgo ?? "---"} secs
                </dd>
              </div>

              <div class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt class="font-medium">CPA</dt>

                <dd class=" sm:col-span-2">
                  {formatCpa(selectedVessel.cpa, selectedVessel.tcpa) ?? "---"}
                </dd>
              </div>

              <div class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt class="font-medium">TCPA</dt>

                <dd class=" sm:col-span-2">
                  {formatTcpa(selectedVessel.tcpa) ?? "---"}
                </dd>
              </div>

              <div class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt class="font-medium">Range</dt>

                <dd class=" sm:col-span-2">
                  {formatDistance(selectedVessel.range) ?? "---"}
                </dd>
              </div>

              <div class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt class="font-medium">Bearing</dt>

                <dd class=" sm:col-span-2">
                  {formatAngle(selectedVessel.bearing) ?? "---"}
                </dd>
              </div>

              {#if !selectedVessel.aisClass || !["ATON", "BASE"].includes(selectedVessel.aisClass)}
                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">SOG</dt>

                  <dd class=" sm:col-span-2">
                    {formatSpeed(selectedVessel.sog) ?? "---"}
                  </dd>
                </div>

                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">COG</dt>

                  <dd class=" sm:col-span-2">
                    {isValidNumber(selectedVessel.cog)
                      ? formatAngle(toDeg(selectedVessel.cog))
                      : "---"}
                  </dd>
                </div>

                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">HDG</dt>

                  <dd class=" sm:col-span-2">
                    {isValidNumber(selectedVessel.hdg)
                      ? formatAngle(toDeg(selectedVessel.hdg))
                      : "---"}
                  </dd>
                </div>
              {/if}

              {#if selectedVessel.aisClass === "A"}
                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">Rate of Turn</dt>

                  <dd class=" sm:col-span-2">
                    {isValidNumber(selectedVessel.rot)
                      ? formatRateOfTurn(toDeg(selectedVessel.rot))
                      : "---"}
                  </dd>
                </div>
              {/if}

              {#if !selectedVessel.aisClass || !["ATON", "BASE"].includes(selectedVessel.aisClass)}
                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">Callsign</dt>

                  <dd class=" sm:col-span-2">
                    {selectedVessel.callsign ?? "---"}
                  </dd>
                </div>
              {/if}

              <div class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt class="font-medium">MMSI</dt>

                <dd class=" sm:col-span-2">
                  {selectedVessel.mmsi ?? "---"}
                  <Popover>
                    <Popover.Trigger
                      >(<span class="anchor"
                        >{getCountryFromMMSI(selectedVessel.mmsi)?.alpha2 ??
                          "--"}</span
                      >)</Popover.Trigger
                    >
                    <Portal>
                      <Popover.Positioner class="z-50!">
                        <Popover.Content
                          class="card max-w-md p-2.5 bg-surface-950-50 text-surface-50-950 shadow-xl"
                        >
                          <Popover.Description
                            >{getCountryFromMMSI(selectedVessel.mmsi)
                              ?.country ?? "---"}</Popover.Description
                          >
                          <Popover.Arrow
                            class="[--arrow-size:--spacing(2)] [--arrow-background:var(--color-surface-950-50)]"
                          >
                            <Popover.ArrowTip />
                          </Popover.Arrow>
                        </Popover.Content>
                      </Popover.Positioner>
                    </Portal>
                  </Popover>
                </dd>
              </div>

              <div class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt class="font-medium">Type</dt>

                <dd class=" sm:col-span-2">
                  {selectedVessel.type ?? "---"}
                </dd>
              </div>

              <div class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt class="font-medium">Class</dt>

                <dd class=" sm:col-span-2">
                  {selectedVessel.aisClass ?? "---"}
                </dd>
              </div>

              {#if selectedVessel.aisClass === "A"}
                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">Status</dt>

                  <dd class=" sm:col-span-2">
                    {selectedVessel.status ?? "---"}
                  </dd>
                </div>

                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">Special Maneuver</dt>

                  <dd class=" sm:col-span-2">
                    {selectedVessel.specialManeuver ?? "---"}
                  </dd>
                </div>
              {/if}

              {#if selectedVessel.aisClass !== "BASE"}
                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">Size</dt>

                  <dd class=" sm:col-span-2">
                    {formatSize(selectedVessel.length, selectedVessel.beam)}
                  </dd>
                </div>
              {/if}

              {#if selectedVessel.aisClass === "A"}
                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">Draft</dt>

                  <dd class=" sm:col-span-2">
                    {isValidNumber(selectedVessel.draft)
                      ? formatDraft(selectedVessel.draft)
                      : "---"}
                  </dd>
                </div>

                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">Destination</dt>

                  <dd class=" sm:col-span-2">
                    {selectedVessel.destination ?? "---"}
                  </dd>
                </div>

                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">ETA</dt>

                  <dd class=" sm:col-span-2">
                    {selectedVessel.eta ?? "---"}
                  </dd>
                </div>

                <div
                  class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4"
                >
                  <dt class="font-medium">IMO</dt>

                  <dd class=" sm:col-span-2">
                    {(selectedVessel.imo ?? "").replace(/imo/i, "") || "---"}
                  </dd>
                </div>
              {/if}

              <div class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt class="font-medium">Lat</dt>

                <dd class=" sm:col-span-2">
                  {isValidNumber(selectedVessel.latitude)
                    ? formatLat(selectedVessel.latitude)
                    : "---"}
                </dd>
              </div>

              <div class="grid grid-cols-1 gap-1 py-3 sm:grid-cols-3 sm:gap-4">
                <dt class="font-medium">Lon</dt>

                <dd class=" sm:col-span-2">
                  {isValidNumber(selectedVessel.longitude)
                    ? formatLon(selectedVessel.longitude)
                    : "---"}
                </dd>
              </div>
            </dl>
          </Dialog.Description>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog>
{/if}
