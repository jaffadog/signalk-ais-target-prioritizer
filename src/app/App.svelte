<script lang="ts">
  import { onMount, type Snippet } from "svelte";
  import { toaster } from "./utils/toaster";
  import { Toast } from "@skeletonlabs/skeleton-svelte";

  // components:
  import Map from "./components/Map.svelte";
  import VesselCounts from "./components/VesselCounts.svelte";
  import VesselProperties from "./components/VesselProperties.svelte";
  import VesselTable from "./components/VesselTable.svelte";
  import Alarms from "./components/Alarms.svelte";
  import Notification from "./components/Notification.svelte";
  import Settings from "./components/Settings.svelte";
  import EditProfiles from "./components/EditProfiles.svelte";

  import {
    start as startIngestion,
    stop as stopIngestion,
  } from "../engine/ingestion.svelte";
  import { ui } from "./ui.svelte";
  import { loadCollisionProfiles, saveCollisionProfiles } from "./utils/api";
  import {
    collisionProfiles,
    resetCollisionProfiles,
    setCollisionProfiles,
  } from "../engine/collisionProfiles.svelte";
  import { isValidCollisionProfiles } from "../engine/validateCollisionProfiles";
  import { mapState } from "../engine/map.svelte";
  import { checkConnectivity, connectivity } from "./connectivity.svelte";

  interface Props {
    children?: Snippet;
  }

  const props: Props = $props();

  $inspect({ activeBasemapId: mapState.basemapId });
  $inspect({ openSeaMap: mapState.openSeaMap });
  $inspect({ styleId: mapState.styleId });
  $inspect({ darkMode: ui.darkMode });
  $inspect({ visible: ui.visible });
  $inspect({ width: ui.width });
  $inspect({ online: connectivity.online });

  onMount(() => {
    // check internet connectivity and disable basemaps that require it
    checkConnectivity();

    // get collision profile data from signalk plugin
    loadCollisionProfiles().then((loadedCollisionProfiles) => {
      if (isValidCollisionProfiles(loadedCollisionProfiles)) {
        setCollisionProfiles(loadedCollisionProfiles);
      } else {
        toaster.create({
          type: "error",
          title: "Error",
          description:
            "Unable to load configuration data from Signal K server. Using default values.",
          duration: Infinity,
        });
        resetCollisionProfiles();
        saveCollisionProfiles(collisionProfiles);
      }
    });

    // start getting streaming data from signalk
    startIngestion(location.host);

    return () => {
      console.log("EXIT App");
      stopIngestion();
    };
  });

  // handle all local storage persistence with effects triggered by the corresponding $state

  $effect(() => {
    console.log("EFFECT darkmode changed", ui.darkMode);
    document.documentElement.classList.toggle("dark", ui.darkMode);
    localStorage.setItem("theme", ui.darkMode ? "dark" : "light");
  });

  $effect(() => {
    console.log("EFFECT basemap changed", mapState.basemapId);
    localStorage.setItem("basemap", mapState.basemapId);
  });

  $effect(() => {
    console.log("EFFECT openseamap changed", mapState.openSeaMap);
    localStorage.setItem("openseamap", String(mapState.openSeaMap));
  });
</script>

<svelte:document bind:visibilityState={ui.visible} />
<svelte:window bind:innerWidth={ui.width} />

{@render props.children?.()}

<Toast.Group {toaster}>
  {#snippet children(toast)}
    <Toast {toast}>
      <Toast.Message>
        <Toast.Title>{toast.title}</Toast.Title>
        <Toast.Description>{toast.description}</Toast.Description>
      </Toast.Message>
      <Toast.CloseTrigger />
    </Toast>
  {/snippet}
</Toast.Group>

<div class="relative h-screen w-screen overflow-hidden">
  <!-- {/* MAP LAYER */} -->
  <div class="map-wrapper absolute inset-0 z-0">
    {#if connectivity.online !== undefined}
      <Map />
    {/if}
  </div>

  <!-- {/* UI LAYER */} -->
  <div class="pointer-events-none absolute top-0 right-0 z-10">
    <VesselCounts />
  </div>
  {#if ui.vesselTable.visible}
    <VesselTable />
  {/if}
  {#if ui.vesselProperties.visible}
    <VesselProperties />
  {/if}
  {#if ui.settings.visible}
    <Settings />
  {/if}
  {#if ui.editProfiles.visible}
    <EditProfiles />
  {/if}
  {#if ui.alarms.visible}
    <Alarms />
  {/if}
  {#if ui.notification.visible}
    <Notification />
  {/if}
</div>
