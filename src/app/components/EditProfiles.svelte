<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import { Dialog, Portal, Tabs } from "@skeletonlabs/skeleton-svelte";

  const animation =
    "transition transition-discrete opacity-0 translate-y-[100px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[100px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0";

  import { ui } from "../ui.svelte";
  import {
    collisionProfiles,
    resetCollisionProfiles,
    type ProfileName,
  } from "../../engine/collisionProfiles.svelte";
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
  onOpenChange={(e) => {
    ui.editProfiles.visible = e.open;
    if (!e.open) {
      saveCollisionProfiles(collisionProfiles);
      toaster.create({
        type: "success",
        title: "Saving configuration...",
        description: null,
        duration: 5000,
      });
    }
  }}
>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/50" />
    <Dialog.Positioner
      class="fixed inset-0 z-50 flex justify-center items-center p-4"
    >
      <Dialog.Content
        class="flex flex-col card bg-surface-100-900 w-full max-w-xl gap-4 p-4 shadow-xl {animation} h-122 max-h-[90vh]"
      >
        <!-- header -->
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-lg font-bold">Edit Profiles</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        <!-- body -->
        <div
          class="flex-1 overflow-y-scroll card w-full h-full preset-filled-surface-100-900 border border-surface-200-800 divide-surface-200-800 block divide-y"
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
              class="btn preset-filled-warning-500 basis-1/2"
              onclick={handleRestoreDefaults}>Restore Defaults</button
            >
          </div>

          <!-- tabs -->
          <Tabs defaultValue="collisionWarning" class="px-4 py-2">
            <!-- tab list -->
            <Tabs.List>
              <Tabs.Trigger value="collisionWarning"
                >Collision Warning</Tabs.Trigger
              >
              <Tabs.Trigger value="collisionAlarm">Collision Alarm</Tabs.Trigger
              >
              <Tabs.Trigger value="guardAlarm">Guard Alarm</Tabs.Trigger>
              <Tabs.Indicator />
            </Tabs.List>

            <!-- collisionWarning -->
            <Tabs.Content value="collisionWarning" class="flex flex-col gap-4">
              <p>
                Targets that meet all three of the conditions below will be set
                to a warning state and shown in <span
                  class="text-warning-700 font-bold">orange</span
                > in the plotter.
              </p>

              <EditCpaAlarm alarmState="warning" />
            </Tabs.Content>

            <!-- collisionAlarm -->
            <Tabs.Content value="collisionAlarm" class="flex flex-col gap-4">
              <p>
                Targets that meet all three of the conditions below will be set
                to a danger state and shown in <span
                  class="text-error-600 font-bold">red</span
                > in the plotter.
              </p>

              <EditCpaAlarm alarmState="danger" />
            </Tabs.Content>

            <!-- guardAlarm -->
            <Tabs.Content value="guardAlarm" class="flex flex-col gap-4">
              <p>
                Targets that meet both of the conditions below will be set to a
                danger state and shown in <span class="text-error-600 font-bold"
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
