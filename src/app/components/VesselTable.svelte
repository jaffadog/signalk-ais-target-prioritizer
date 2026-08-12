<script lang="ts">
  import { VolumeX, XIcon } from "@lucide/svelte";
  import { Dialog, Portal } from "@skeletonlabs/skeleton-svelte";

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
  import { vessels, vesselsState } from "../../engine/vessels.svelte";
  import { type Vessel } from "../../types";
  import { ui } from "../ui.svelte";
  import { isValidNumber } from "../../engine/calculations";
  import type { Context } from "@signalk/server-api";
  import { vesselTableState } from "../vesselTable.svelte";

  console.log("TABLE render");

  let tableContainer: HTMLElement | undefined = $state();

  // Sorted Data
  const sortedVessels = $derived.by(() =>
    Object.values(vessels)
      .filter(
        (vessel) =>
          vessel.context !== vesselsState.myVesselContext && vessel.isValid,
      )
      .sort((a, b) => {
        switch (vesselTableState.sortBy) {
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
            return (a.name ?? "").localeCompare(b.name ?? "");
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

  function handleClickRow(context: Context) {
    vesselsState.selectedVesselContext = context;
    ui.vesselProperties.visible = true;
    ui.vesselTable.visible = false;
  }

  function handleSortChange(e: Event) {
    vesselTableState.sortBy = (e.currentTarget as HTMLSelectElement).value;
    tableContainer!.scrollTop = 0;
  }

  function getVesselColor(t: Vessel) {
    // if (t.alarmState === "danger")
    //   return "bg-yellow-100 dark:bg-yellow-950 font-medium";
    // if (t.alarmState === "danger")
    //   return "bg-red-100 dark:bg-red-950 font-medium";

    if (t.alarmState === "danger") return "table-row-danger font-medium";
    if (t.alarmState === "warning") return "table-row-warning font-medium";
    return "bg-surface-100-900";
  }
</script>

<!-- FIXME persis sort order -->

<!-- FIXME clickable col headers? -->

<Dialog
  open={ui.vesselTable.visible}
  onOpenChange={(e) => {
    ui.vesselTable.visible = e.open;
    // if (!e.open) {
    //   close();
    // }
  }}
>
  <Portal>
    <Dialog.Backdrop
      class="fixed inset-0 z-50 bg-black/50 transition transition-discrete {animBackdrop}"
    />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-start">
      <Dialog.Content
        class="flex h-dvh w-full flex-col space-y-4 card bg-surface-100-900  p-4 shadow-xl md:w-3xl {animModal}"
      >
        <!-- header -->
        <header class="flex items-center justify-between">
          <Dialog.Title class="text-lg font-bold"
            >AIS Targets ({sortedVessels.length})</Dialog.Title
          >
          <Dialog.CloseTrigger class="btn-icon preset-tonal">
            <XIcon />
          </Dialog.CloseTrigger>
        </header>

        <!-- sort by -->
        <label class="label">
          <span class="label-text">Sort By</span>
          <select
            class="select"
            value={vesselTableState.sortBy}
            onchange={handleSortChange}
          >
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
          class="table-wrap flex-1 overflow-x-auto overflow-y-auto rounded border border-surface-200-800 shadow-sm"
        >
          <table class="table">
            <thead>
              <tr class="z-20">
                <th
                  class="sticky top-0 left-0 z-30 w-auto bg-surface-100-900 ps-4! font-semibold"
                >
                  NAME
                </th>
                <th
                  class="sticky top-0 min-w-5 bg-surface-100-900 text-right! font-semibold"
                ></th>
                <th
                  class="sticky top-0 min-w-16 bg-surface-100-900 text-right! font-semibold"
                  >BRG</th
                >
                <th
                  class="sticky top-0 min-w-24 bg-surface-100-900 text-right! font-semibold"
                  >RNG</th
                >
                <th
                  class="sticky top-0 min-w-20 bg-surface-100-900 text-right! font-semibold"
                  >SOG</th
                >
                <th
                  class="sticky top-0 min-w-24 bg-surface-100-900 text-right! font-semibold"
                  >CPA</th
                >
                <th
                  class="sticky top-0 min-w-24 bg-surface-100-900 pe-4! text-right! font-semibold"
                  >TCPA</th
                >
              </tr>
            </thead>

            <tbody>
              {#each sortedVessels as vessel (vessel.context)}
                <tr
                  class={`group z-10 cursor-pointer hover:preset-tonal-primary! ${getVesselColor(vessel)}`}
                  onclick={() => handleClickRow(vessel.context)}
                >
                  <td
                    class={`sticky left-0 z-20 flex items-center text-left group-hover:preset-tonal-primary!  ${getVesselColor(vessel)} border-b-0 px-3 py-0.5 ps-4! font-medium`}
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
                    {formatName(vessel)}
                  </td>

                  <td class="text-right!">
                    {#if vessel.alarmIsMuted}
                      <VolumeX class="size-4" />
                    {/if}
                  </td>
                  <td class="text-right!">
                    {formatAngle(vessel.bearing)}
                  </td>
                  <td class="text-right!">
                    {formatDistance(vessel.range)}
                  </td>
                  <td class="text-right!">
                    {formatSpeed(vessel.sog)}
                  </td>
                  <td class="text-right!">
                    {formatCpa(vessel.cpa, vessel.tcpa)}
                  </td>
                  <td class="pe-4! text-right!">
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
