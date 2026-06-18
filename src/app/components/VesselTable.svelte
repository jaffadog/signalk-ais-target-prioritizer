<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import { Dialog, Portal } from "@skeletonlabs/skeleton-svelte";

  // The following animations are optional.
  // These may also be included inline.
  const animBackdrop =
    "transition transition-discrete opacity-0 starting:data-[state=open]:opacity-0 data-[state=open]:opacity-100";
  const animModal =
    "transition transition-discrete opacity-0 -translate-x-full starting:data-[state=open]:opacity-0 starting:data-[state=open]:-translate-x-full data-[state=open]:opacity-100 data-[state=open]:translate-x-0";

  import {
    formatAngle,
    formatCpa,
    formatDistance,
    formatName,
    formatSpeed,
    formatTcpa,
  } from "../utils/formatUtils";
  import { getVesselSvg } from "../utils/svgUtils";
  import { muteSvg } from "../utils/svg";
  import { vessels, vesselsState } from "../../engine/vessels.svelte";
  import { type Vessel } from "../../types";
  import { ui } from "../ui.svelte";
  import { isValidNumber } from "../../engine/calculations";

  console.log("TABLE render");

  let tableContainer: HTMLElement | undefined = $state();
  let sortBy = $state("priority");

  // Sorted Data
  const sortedVessels = $derived.by(() =>
    Object.values(vessels)
      .filter((t) => t.mmsi !== vesselsState.myVesselMmsi && t.isValid)
      .sort((a, b) => {
        switch (sortBy) {
          case "tcpa":
            return (
              sortInvalidNumbersToBottom(a.tcpa) -
              sortInvalidNumbersToBottom(b.tcpa)
            );
          case "cpa":
            return (
              sortInvalidNumbersToBottom(a.cpa) -
              sortInvalidNumbersToBottom(b.cpa)
            );
          case "range":
            return (
              sortInvalidNumbersToBottom(a.range) -
              sortInvalidNumbersToBottom(b.range)
            );
          case "name":
            return a.name.localeCompare(b.name);
          case "priority":
          default:
            return (
              sortInvalidNumbersToBottom(a.order) -
              sortInvalidNumbersToBottom(b.order)
            );
        }
      }),
  );

  function sortInvalidNumbersToBottom(a: number | null | undefined) {
    return isValidNumber(a) ? a : Infinity;
  }

  function handleClickRow(mmsi: string) {
    vesselsState.selectedVesselMmsi = mmsi;
    ui.vesselProperties.visible = true;
    ui.vesselTable.visible = false;
  }

  function handleSortChange(e: Event) {
    sortBy = (e.currentTarget as HTMLSelectElement).value;
    tableContainer!.scrollTop = 0;
  }

  function getVesselColor(t: Vessel) {
    // if (t.alarmState === "danger")
    //   return "bg-yellow-100 dark:bg-yellow-950 font-medium";
    // if (t.alarmState === "danger")
    //   return "bg-red-100 dark:bg-red-950 font-medium";

    if (t.alarmState === "danger") return "preset-tonal-error font-medium";
    if (t.alarmState === "warning") return "preset-tonal-warning font-medium";
    return "bg-surface-50-950";
  }
</script>

/* eslint-disable svelte/no-at-html-tags */

<Dialog
  open={ui.vesselTable.visible}
  onOpenChange={(e) => {
    ui.vesselTable.visible = e.open;
    // if (!e.open) {
    //   close();
    // }
  }}
>
  <!-- <Dialog.Trigger class="btn preset-filled">Trigger</Dialog.Trigger> -->
  <Portal>
    <Dialog.Backdrop
      class="fixed inset-0 z-50 bg-black/50 transition transition-discrete {animBackdrop}"
    />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-start">
      <Dialog.Content
        class="flex flex-col h-screen card bg-surface-50-950 w-full p-4 space-y-4 shadow-xl {animModal}"
      >
        <!-- header -->
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-2xl font-bold"
            >AIS Targets ({sortedVessels.length})</Dialog.Title
          >
          <Dialog.CloseTrigger class="btn-icon preset-tonal">
            <XIcon />
          </Dialog.CloseTrigger>
        </header>

        <!-- sort by -->
        <label class="label">
          <span class="label-text">Sort By</span>
          <select class="select" value={sortBy} onchange={handleSortChange}>
            <option value="priority">Priority</option>
            <option value="tcpa">TCPA</option>
            <option value="cpa">CPA</option>
            <option value="range">Range</option>
            <option value="name">Name</option>
          </select>
        </label>

        <!-- table -->
        <div
          bind:this={tableContainer}
          class="flex-1 overflow-x-auto overflow-y-auto rounded border border-border shadow-sm"
        >
          <table class="w-full divide-y-2 divide-border">
            <thead class=" text-right">
              <tr class="z-20">
                <th
                  class="sticky top-0 left-0 z-30 w-auto px-3 py-2 text-left bg-surface-50-950 font-semibold"
                >
                  NAME
                </th>
                <th
                  class="sticky top-0 min-w-20 px-3 py-2 whitespace-nowrap bg-surface-50-950 font-semibold"
                >
                  BRG
                </th>
                <th
                  class="sticky top-0 min-w-24 px-3 py-2 whitespace-nowrap bg-surface-50-950 font-semibold"
                >
                  RNG
                </th>
                <th
                  class="sticky top-0 min-w-20 px-3 py-2 whitespace-nowrap bg-surface-50-950 font-semibold"
                >
                  SOG
                </th>
                <th
                  class="sticky top-0 min-w-24 px-3 py-2 whitespace-nowrap bg-surface-50-950 font-semibold"
                >
                  CPA
                </th>
                <th
                  class="sticky top-0 min-w-24 px-3 py-2 whitespace-nowrap bg-surface-50-950 font-semibold"
                >
                  TCPA
                </th>
              </tr>
            </thead>

            <tbody class="divide-y divide-border">
              {#each sortedVessels as vessel (vessel.mmsi)}
                <tr
                  class={`group cursor-pointer ${getVesselColor(vessel)} text-right`}
                  onclick={() => handleClickRow(vessel.mmsi)}
                >
                  <td
                    class={`sticky left-0 z-20 flex items-center text-left ${getVesselColor(vessel)} border-b-0 px-3 py-0.5 font-medium`}
                  >
                    <span
                      class="me-2 inline-flex h-10 w-10 items-center justify-center [&>svg]:h-full [&>svg]:w-full"
                    >
                      {@html getVesselSvg(
                        vessel.mmsi,
                        vessel.aisClass,
                        vessel.typeId,
                      )}
                    </span>
                    {formatName(vessel.mmsi, vessel.name)}
                    {#if vessel.alarmIsMuted}
                      <span class="ms-2 [&>svg]:h-4 [&>svg]:w-auto"
                        >{@html muteSvg}</span
                      >
                    {/if}
                  </td>

                  <td class="px-3 py-2 whitespace-nowrap">
                    {formatAngle(vessel.bearing)}
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    {formatDistance(vessel.range)}
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    {formatSpeed(vessel.sog)}
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    {formatCpa(vessel.cpa, vessel.tcpa)}
                  </td>
                  <td class="px-3 py-2 whitespace-nowrap">
                    {formatTcpa(vessel.tcpa)}
                  </td>
                  <!-- <td>{vessel.order}</td> -->
                  <!-- <td>{vessel.alarmState}</td> -->
                  <!-- <td>{vessel.alarmType}</td> -->
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
