<script lang="ts">
  import { Info, XIcon } from "@lucide/svelte";
  import {
    Dialog,
    Popover,
    Portal,
    Switch,
  } from "@skeletonlabs/skeleton-svelte";
  import { version } from "../../../package.json";

  const animBackdrop =
    "transition transition-discrete opacity-0 starting:data-[state=open]:opacity-0 data-[state=open]:opacity-100";
  const animModal =
    "transition transition-discrete opacity-0 -translate-x-full starting:data-[state=open]:opacity-0 starting:data-[state=open]:-translate-x-full data-[state=open]:opacity-100 data-[state=open]:translate-x-0";

  import { muteAllAlarms } from "../../engine/alarms.svelte";
  import { ui } from "../ui.svelte";
  import { ns } from "../utils/noSleep.svelte";
  import { pushMuteAllAlarms, saveCollisionProfiles } from "../utils/api";
  import { collisionProfiles } from "../../engine/collisionProfiles.svelte";
  import { type ProfileName } from "../../types";
  import { onMount } from "svelte";
  import {
    checkFontsAvailable,
    handleDownloadFonts,
    handleRemoveFonts,
    mapState,
  } from "../../engine/map.svelte";
  import DarkModeSwith from "./DarkModeSwith.svelte";
  import { stats } from "../stats.svelte";

  // console.log("ENTER Settings");

  let fullScreen = $state<boolean>(false);

  onMount(() => {
    checkFontsAvailable();
  });

  async function handleActiveProfileChange(e: Event) {
    collisionProfiles.current = (e.currentTarget as HTMLSelectElement)
      .value as ProfileName;
    console.log(collisionProfiles.current);
    await saveCollisionProfiles(collisionProfiles);
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
  onOpenChange={(e) => (ui.settings.visible = e.open)}
>
  <Portal>
    <Dialog.Backdrop
      class="fixed inset-0 z-50 bg-black/50 transition transition-discrete {animBackdrop}"
    />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-start">
      <Dialog.Content
        class="flex flex-col h-screen card bg-surface-100-900 w-full sm:w-md gap-4 p-4 shadow-xl {animModal}"
      >
        <header class="flex justify-between items-center">
          <Dialog.Title class="text-lg font-bold">Settings</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon hover:preset-tonal">
            <XIcon class="size-4" />
          </Dialog.CloseTrigger>
        </header>

        <!-- body -->
        <Dialog.Description class="flex-1 overflow-y-auto flex flex-col gap-4">
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

          <!-- dark mode -->
          <DarkModeSwith />

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
          {#if mapState.protomapsFontsAvailable === undefined}
            <div class="flex items-center gap-2 p-2">
              <span class="text-sm">Checking map labels...</span>
            </div>
          {:else if mapState.protomapsFontsAvailable}
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
                <div class="flex align-middle">
                  <span class="text-sm">Map Labels</span>
                  <Popover>
                    <Popover.Trigger
                      ><Info
                        class="size-4 ml-1 stroke-primary-500"
                      /></Popover.Trigger
                    >
                    <Portal>
                      <Popover.Positioner class="z-50!">
                        <Popover.Content
                          class="card sm:max-w-sm max-w-[90dvw] p-4 bg-surface-100-900 shadow-xl"
                        >
                          <Popover.Description
                            >If using <a
                              href="https://protomaps.com/"
                              target="_blank"
                              class="anchor">Protomaps</a
                            > pmtiles offline maps, you can add map labels and symbols
                            by downloading this font pack. This has no effect on any
                            other map types.</Popover.Description
                          >
                          <Popover.Arrow
                            class="[--arrow-size:--spacing(2)] [--arrow-background:var(--color-surface-100-900)]"
                          >
                            <Popover.ArrowTip />
                          </Popover.Arrow>
                        </Popover.Content>
                      </Popover.Positioner>
                    </Portal>
                  </Popover>
                </div>
                <span class="text-xs text-surface-400-600">~28MB download</span>
              </div>
              <button
                type="button"
                class="btn btn-sm preset-filled-primary-500"
                onclick={handleDownloadFonts}
                disabled={mapState.fontsDownloading}
              >
                {mapState.fontsDownloading ? "Downloading..." : "Download"}
              </button>
            </div>
          {/if}

          <!-- spacer -->
          <div class="grow"></div>
          <!-- version & stats -->
          <div class="text-sm text-surface-400-600">
            <p>AIS Target Prioritizer v{version}</p>
            <p>
              Updated {stats.count ?? 0} vessels in {Math.round(
                stats.time ?? 0,
              )} ms
            </p>
          </div>
        </Dialog.Description>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
