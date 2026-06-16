<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import { Dialog, Portal, Switch } from "@skeletonlabs/skeleton-svelte";

  // The following animation is optional.
  // This may also be included inline.
  const animation =
    "transition transition-discrete opacity-0 translate-y-[100px] starting:data-[state=open]:opacity-0 starting:data-[state=open]:translate-y-[100px] data-[state=open]:opacity-100 data-[state=open]:translate-y-0";

  import { muteAllAlarms } from "../../engine/alarms.svelte";
  import { ui } from "../ui.svelte";
  import { ns } from "../utils/noSleep.svelte";
  import { pushMuteAllAlarms, saveCollisionProfiles } from "../utils/api";
  import { collisionProfiles } from "../../engine/collisionProfiles.svelte";
  import { type ProfileName } from "../../types";

  // console.log("ENTER Settings");

  let fullScreen = $state<boolean>(false);

  function handleActiveProfileChange(e: Event) {
    collisionProfiles.current = (e.currentTarget as HTMLSelectElement)
      .value as ProfileName;
    console.log(collisionProfiles.current);
    saveCollisionProfiles(collisionProfiles);
  }

  function handleEditProfiles() {
    ui.editProfiles.visible = true;
    ui.settings.visible = false;
  }

  function handleMuteAllAlarms() {
    muteAllAlarms();
    pushMuteAllAlarms();
    ui.settings.visible = false;
  }

  function handleNoSleep(e: { checked: boolean }) {
    ui.noSleep = e.checked;
    if (e.checked) {
      ns.enable();
    } else {
      ns.disable();
    }
  }

  function handleDarkMode(e: { checked: boolean }) {
    ui.darkMode = e.checked;
    if (ui.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }

  function handleFullScreen(e: { checked: boolean }) {
    fullScreen = e.checked;
    if (fullScreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }
</script>

<Dialog
  open={ui.settings.visible}
  onOpenChange={(e) => {
    ui.settings.visible = e.open;
    // if (!e.open) {
    //   close();
    // }
  }}
>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/50" />
    <Dialog.Positioner
      class="fixed inset-0 z-50 flex justify-center items-center p-4"
    >
      <Dialog.Content
        class="card bg-surface-100-900 w-full max-w-sm p-4 space-y-4 shadow-xl {animation}"
      >
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-lg font-bold">Settings</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>
        <Dialog.Description class="flex flex-col gap-4">
          <!-- active profile -->
          <label class="label">
            <span class="label-text">Active Profile</span>
            <select
              class="select"
              value={collisionProfiles.current}
              onchange={handleActiveProfileChange}
            >
              <option value="anchor">Anchored</option>
              <option value="harbor">Harbor</option>
              <option value="coastal">Coastal</option>
              <option value="offshore">Offshore</option>
            </select>
          </label>

          <!-- edit profiles -->
          <button
            type="button"
            class="btn preset-filled-primary-500"
            onclick={handleEditProfiles}>Edit Profiles</button
          >

          <!-- mute all -->
          <button
            type="button"
            class="btn preset-filled-error-500"
            onclick={handleMuteAllAlarms}>Mute All Alarms</button
          >

          <!-- no sleep -->
          <Switch
            class="flex justify-between p-2"
            onCheckedChange={handleNoSleep}
            checked={ui.noSleep}
          >
            <Switch.Label
              >Prevent screen sleeping in iOS and Android</Switch.Label
            >
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>

          <!-- dark mode -->
          <Switch
            class="flex justify-between p-2"
            onCheckedChange={handleDarkMode}
            checked={ui.darkMode}
          >
            <Switch.Label>Dark Mode</Switch.Label>
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>

          <!-- full screen -->
          <Switch
            class="flex justify-between p-2"
            onCheckedChange={handleFullScreen}
            checked={fullScreen}
          >
            <Switch.Label>Fullscreen Mode</Switch.Label>
            <Switch.HiddenInput />
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch>
        </Dialog.Description>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
