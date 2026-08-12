<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import { Dialog, Portal, Tabs } from "@skeletonlabs/skeleton-svelte";

  const animBackdrop =
    "transition transition-discrete opacity-0 starting:data-[state=open]:opacity-0 data-[state=open]:opacity-100";
  const animModal =
    "transition transition-discrete opacity-0 -translate-x-full starting:data-[state=open]:opacity-0 starting:data-[state=open]:-translate-x-full data-[state=open]:opacity-100 data-[state=open]:translate-x-0";

  import { ui } from "../ui.svelte";
  import {
    collisionProfiles,
    resetCollisionProfiles,
  } from "../../engine/collisionProfiles.svelte";
  import { type ProfileName } from "../../types";
  import EditCpaAlarm from "./EditCpaAlarm.svelte";
  import EditGuardAlarm from "./EditGuardAlarm.svelte";
  import { saveCollisionProfiles } from "../utils/api";
  import { toaster } from "../utils/toaster";

  console.log("ENTER EditProfiles");

  function handleProfileChange(e: Event) {
    collisionProfiles.current = (e.currentTarget as HTMLSelectElement)
      .value as ProfileName;
    console.log(collisionProfiles.current);
  }

  function handleRestoreDefaults() {
    resetCollisionProfiles();
  }
</script>

<Dialog
  open={ui.editProfiles.visible}
  onOpenChange={async (e) => {
    ui.editProfiles.visible = e.open;
    if (!e.open) {
      toaster.success({
        title: "Saving configuration...",
        description: null,
        duration: 5000,
      });

      const result = await saveCollisionProfiles(collisionProfiles);

      if (!result.success) {
        toaster.error({
          title: "Error",
          description: `Unable to save configuration data: ${result.reason}`,
          duration: Infinity,
        });
      }
    }
  }}
>
  <Portal>
    <Dialog.Backdrop
      class="fixed inset-0 z-50 bg-black/50 transition transition-discrete {animBackdrop}"
    />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-start">
      <Dialog.Content
        class="flex h-dvh w-full flex-col gap-4 card bg-surface-100-900 p-4 shadow-xl md:w-xl {animModal}"
      >
        <!-- header -->
        <header class="flex items-center justify-between">
          <Dialog.Title class="text-lg font-bold">Edit Profiles</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        <!-- body -->
        <div
          class="block h-full w-full flex-1 divide-y divide-surface-200-800 overflow-y-scroll card border preset-outlined-surface-500 border-surface-200-800"
        >
          <!-- buttons -->
          <div class="flex items-end gap-4 p-4">
            <!-- active profile -->
            <label class="label basis-1/2">
              <span class="label-text">Active Profile</span>
              <select
                class="select"
                value={collisionProfiles.current}
                onchange={handleProfileChange}
              >
                <option value="anchor">Anchored</option>
                <option value="harbor">Harbor</option>
                <option value="coastal">Coastal</option>
                <option value="offshore">Offshore</option>
              </select>
            </label>

            <!-- restore defaults -->
            <button
              type="button"
              class="btn basis-1/2 preset-filled-warning-500"
              onclick={handleRestoreDefaults}>Restore Defaults</button
            >
          </div>

          <!-- tabs -->
          <Tabs defaultValue="collisionWarning" class="px-4 py-2">
            <!-- tab list -->
            <Tabs.List class="flex">
              <Tabs.Trigger
                class="flex-1 text-wrap whitespace-normal"
                value="collisionWarning">Collision Warning</Tabs.Trigger
              >
              <Tabs.Trigger
                class="flex-1 text-wrap whitespace-normal"
                value="collisionAlarm">Collision Alarm</Tabs.Trigger
              >
              <Tabs.Trigger
                class="flex-1 text-wrap whitespace-normal"
                value="guardAlarm">Guard Alarm</Tabs.Trigger
              >
              <Tabs.Indicator />
            </Tabs.List>

            <!-- collisionWarning -->
            <Tabs.Content value="collisionWarning" class="flex flex-col gap-4">
              <p>
                Targets that meet all three of the conditions below will be set
                to a warning state and shown in <span
                  class="font-bold text-warning-700">orange</span
                > in the plotter.
              </p>

              <EditCpaAlarm alarmState="warning" />
            </Tabs.Content>

            <!-- collisionAlarm -->
            <Tabs.Content value="collisionAlarm" class="flex flex-col gap-4">
              <p>
                Targets that meet all three of the conditions below will be set
                to a danger state and shown in <span
                  class="font-bold text-error-600">red</span
                > in the plotter.
              </p>

              <EditCpaAlarm alarmState="danger" />
            </Tabs.Content>

            <!-- guardAlarm -->
            <Tabs.Content value="guardAlarm" class="flex flex-col gap-4">
              <p>
                Targets that meet both of the conditions below will be set to a
                danger state and shown in <span class="font-bold text-error-600"
                  >red</span
                > in the plotter.
              </p>
              <EditGuardAlarm />
            </Tabs.Content>
          </Tabs>
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
