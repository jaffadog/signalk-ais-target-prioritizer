<script lang="ts">
  import { Dialog, Portal } from "@skeletonlabs/skeleton-svelte";
  import { formatCpa, formatName, formatTcpa } from "../utils/formatUtils";
  import hornMp3Url from "../assets/horn.mp3";
  import {
    alarmsState,
    getAlarmList,
    muteAllAlarms,
  } from "../../engine/alarms.svelte";
  import { ui } from "../ui.svelte";
  import { vesselsState } from "../../engine/vessels.svelte";
  import { TriangleAlert } from "@lucide/svelte";
  import { pushMuteAllAlarms } from "../utils/api";
  import { onMount } from "svelte";

  // get static static snaphost so that this dialog doesnt jump
  // around jump around with updates, additions, removals
  const alarms = $state.snapshot(getAlarmList());

  const horn = new Audio(hornMp3Url);

  onMount(() => {
    horn.play().catch((e) => console.log("suppressed horn sound:", e.message));
  });

  function handleClick(mmsi: string) {
    vesselsState.selectedVesselMmsi = mmsi;
    ui.vesselProperties.visible = true;
    close();
  }

  function handleMuteAllAlarms() {
    muteAllAlarms();
    pushMuteAllAlarms();
    close();
  }

  function close() {
    ui.alarms.visible = false;
    alarmsState.lastAlarmTime = performance.now();
  }
</script>

<Dialog
  role="alertdialog"
  open={ui.alarms.visible}
  onOpenChange={(e) => {
    ui.alarms.visible = e.open;
    if (!e.open) {
      close();
    }
  }}
>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-error-50-950/50" />
    <Dialog.Positioner
      class="fixed inset-0 z-50 flex justify-center items-center p-4"
    >
      <Dialog.Content
        class="flex flex-col card preset-filled-error-500 w-md p-4 space-y-2 shadow-xl max-h-[90vh]"
      >
        <Dialog.Title class="text-xl font-semibold flex items-center gap-2"
          ><TriangleAlert />Alarms</Dialog.Title
        >
        <Dialog.Description class="flex-1 overflow-y-auto">
          {#each alarms as a (a.mmsi)}
            <button
              class="w-full text-left hover:preset-tonal-error rounded px-2 py-1 uppercase"
              onclick={() => handleClick(a.mmsi)}
            >
              {formatName(a.mmsi, a.name)} -
              {a.alarmType} -
              {formatCpa(a.cpa, a.tcpa)}
              {formatTcpa(a.tcpa)}
            </button>
          {:else}
            <p
              class="w-full text-left hover:preset-tonal-error rounded px-2 py-1"
            >
              No current alarms.
            </p>
          {/each}
        </Dialog.Description>
        <footer class="flex justify-end gap-2">
          <Dialog.CloseTrigger class="btn preset-tonal-error"
            >Close</Dialog.CloseTrigger
          >
          <button
            type="button"
            class="btn preset-tonal-error"
            onclick={handleMuteAllAlarms}>Mute All</button
          >
        </footer>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
