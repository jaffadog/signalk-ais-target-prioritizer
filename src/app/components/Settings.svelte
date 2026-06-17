<script lang="ts">
  import { XIcon } from "@lucide/svelte";
  import { Dialog, Portal, Switch } from "@skeletonlabs/skeleton-svelte";
  import { name as PLUGIN_ID } from "../../../package.json";

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
  import { onMount } from "svelte";

  // console.log("ENTER Settings");

  let fullScreen = $state<boolean>(false);

  onMount(() => {
    checkFontsAvailable();
  });

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

  let fontsAvailable = $state<boolean | undefined>(undefined);
  let fontsDownloading = $state(false);

  async function checkFontsAvailable() {
    const res = await fetch(`/plugins/${PLUGIN_ID}/fonts-available`).catch(
      () => null,
    );
    fontsAvailable = res?.ok ?? false;
  }

  async function handleDownloadFonts() {
    fontsDownloading = true;
    await fetch(`/plugins/${PLUGIN_ID}/download-fonts`, { method: "POST" });
    fontsDownloading = false;
    await checkFontsAvailable();
  }

  async function handleRemoveFonts() {
    await fetch(`/plugins/${PLUGIN_ID}/remove-fonts`, { method: "POST" });
    await checkFontsAvailable();
  }
</script>

<Dialog
  open={ui.settings.visible}
  onOpenChange={(e) => {
    ui.settings.visible = e.open;
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

          <!-- map labels / font pack -->
          {#if fontsAvailable === undefined}
            <div class="flex items-center gap-2 p-2">
              <span class="text-sm">Checking map labels...</span>
            </div>
          {:else if fontsAvailable}
            <div class="flex justify-between items-center p-2">
              <span class="text-sm">Map Labels Installed</span>
              <button
                type="button"
                class="btn btn-sm preset-outlined-error-500"
                onclick={handleRemoveFonts}>Remove</button
              >
            </div>
          {:else}
            <div class="flex justify-between items-center p-2">
              <div class="flex flex-col">
                <span class="text-sm">Map Labels</span>
                <span class="text-xs text-surface-400">~28MB download</span>
              </div>
              <button
                type="button"
                class="btn btn-sm preset-filled-primary-500"
                onclick={handleDownloadFonts}
                disabled={fontsDownloading}
              >
                {fontsDownloading ? "Downloading..." : "Download"}
              </button>
            </div>
          {/if}
        </Dialog.Description>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
