<script lang="ts">
  import { CheckIcon } from "@lucide/svelte";
  import { ui } from "../ui.svelte";
  import { mapState } from "../../engine/map.svelte";
  import { basemaps } from "../basemaps.svelte";
  import { toggleOpenSeaMap } from "../mapLayers";
  import { Switch } from "@skeletonlabs/skeleton-svelte";
  import { connectivity } from "../connectivity.svelte";

  function selectBasemap(basemapId: string) {
    mapState.basemapId = basemapId;
    ui.layersMenu.visible = false;
  }
</script>

{#if ui.layersMenu.visible}
  <!-- backdrop - used to close the layers manu -->
  <button
    class="fixed inset-0 z-39 cursor-default touch-none"
    onclick={() => (ui.layersMenu.visible = false)}
    aria-label="Close layers menu"
  ></button>

  <div
    class="absolute z-40 top-38.75 left-12 card bg-surface-50-950 border border-surface-200-800 shadow-xl min-w-40"
  >
    {#each Object.values(basemaps) as basemap, i (basemap.id)}
      <button
        class="flex items-center gap-4 w-full ps-6 pe-4 py-2 hover:preset-tonal text-left {connectivity.online ===
          false && basemap.online
          ? 'opacity-40 pointer-events-none'
          : ''}"
        onclick={() => selectBasemap(basemap.id)}
      >
        {#if basemap.id === mapState.basemapId}
          <CheckIcon class="size-4 text-primary" />
        {:else}
          <div class="size-4"></div>
        {/if}
        {basemap.label}
      </button>
      {#if i === 3}
        <hr class="hr" />
      {/if}
    {/each}

    <hr class="hr" />

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
  </div>
{/if}
