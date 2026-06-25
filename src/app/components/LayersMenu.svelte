<script lang="ts">
  import { CheckIcon } from "@lucide/svelte";
  import { ui } from "../ui.svelte";
  import { mapState } from "../map.svelte";
  import { basemaps } from "../basemaps.svelte";
  import { toggleOpenSeaMap } from "../mapLayers";
  import { Switch } from "@skeletonlabs/skeleton-svelte";
  import { connectivity } from "../connectivity.svelte";
  import { XIcon } from "@lucide/svelte";
  import { Dialog, Portal } from "@skeletonlabs/skeleton-svelte";

  const animBackdrop =
    "transition transition-discrete opacity-0 starting:data-[state=open]:opacity-0 data-[state=open]:opacity-100";
  const animModal =
    "transition transition-discrete opacity-0 -translate-x-full starting:data-[state=open]:opacity-0 starting:data-[state=open]:-translate-x-full data-[state=open]:opacity-100 data-[state=open]:translate-x-0";

  function selectBasemap(basemapId: string) {
    mapState.basemapId = basemapId;
    ui.layersMenu.visible = false;
  }
</script>

<Dialog
  open={ui.layersMenu.visible}
  onOpenChange={(e) => (ui.layersMenu.visible = e.open)}
>
  <!-- <Dialog.Trigger class="btn preset-filled">Trigger</Dialog.Trigger> -->
  <Portal>
    <Dialog.Backdrop
      class="fixed inset-0 z-50 bg-black/50 transition transition-discrete {animBackdrop}"
    />
    <Dialog.Positioner class="fixed inset-0 z-50 flex justify-start">
      <Dialog.Content
        class="flex flex-col h-dvh card bg-surface-100-900 w-2xs p-4 shadow-xl {animModal}"
      >
        <!-- header -->
        <header class="flex justify-between items-center mb-4">
          <Dialog.Title class="text-lg font-bold">Layers</Dialog.Title>
          <Dialog.CloseTrigger class="btn-icon preset-tonal">
            <XIcon />
          </Dialog.CloseTrigger>
        </header>

        <!-- body -->
        <div class="grow overflow-y-auto">
          {#each Object.values(basemaps) as basemap, i (basemap.identifier)}
            <button
              class="flex items-center gap-4 w-full ps-6 pe-4 py-2 hover:preset-tonal text-left {connectivity.online ===
                false && basemap.online
                ? 'opacity-40 pointer-events-none'
                : ''}"
              onclick={() => selectBasemap(basemap.identifier)}
            >
              {#if basemap.identifier === mapState.basemapId}
                <CheckIcon class="size-4 text-primary" />
              {:else}
                <div class="size-4"></div>
              {/if}
              {basemap.name}
            </button>
            {#if i === 3}
              <hr class="hr" />
              <!-- open sea map button -->
              <Switch
                class="flex p-2 {connectivity.online === false
                  ? 'opacity-40 pointer-events-none'
                  : ''}"
                onCheckedChange={(e) => {
                  mapState.openSeaMap = e.checked;
                  toggleOpenSeaMap(e.checked);
                }}
                checked={mapState.openSeaMap}
              >
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Label class="text-sm font-normal justify-self-start"
                  >Open Sea Map</Switch.Label
                >
                <Switch.HiddenInput />
              </Switch>
              <hr class="hr" />
            {/if}
          {/each}
        </div>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
