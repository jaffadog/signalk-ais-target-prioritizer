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
  import { initCollisionProfiles } from "../engine/collisionProfiles.svelte";
  import { mapState } from "../engine/map.svelte";
  import { checkConnectivity, connectivity } from "./connectivity.svelte";
  import { CircleCheck, CircleX, Info, TriangleAlert } from "@lucide/svelte";
  import { basemaps, initBasemaps } from "./basemaps.svelte";

  let ready = $state(false);

  // interface Props {
  //   children?: Snippet;
  // }

  // const props: Props = $props();

  $inspect({ basemapId: mapState.basemapId });
  $inspect({ openSeaMap: mapState.openSeaMap });
  $inspect({ styleId: mapState.styleId });
  $inspect({ darkMode: ui.darkMode });
  $inspect({ visible: ui.visible });
  $inspect({ width: ui.width });
  $inspect({ online: connectivity.online });
  $inspect({ ready: ready });

  onMount(() => {
    console.log(">>> ONMOUNT app");

    window.onerror = (message, source, line, col, error) => {
      console.error("Global error:", { message, source, line, col, error });
      toaster.error({
        title: "Unexpected Error",
        description: String(message),
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // wait on stuff we need before permitting Map to load
    Promise.all([checkConnectivity(), initBasemaps(), initCollisionProfiles()])
      .then(() => {
        console.log(">>> promise all resolved", mapState.basemapId, basemaps);

        // make sure out default/current basemap is valid
        if (!(mapState.basemapId in basemaps)) {
          mapState.basemapId = "street";
        }
        ready = true;
      })
      .catch((err) => {
        console.error(">>> promise all failed", err);
        ready = true; // still allow map to load
      });

    // FIXME considering adding detection of protomaps font pack:
    // const fontsAvailable = await fetch(
    //   "/plugins/signalk-ais-target-prioritizer/fonts-available",
    // )
    //   .then((r) => r.ok)
    //   .catch(() => false);

    // start getting streaming data from signalk
    startIngestion(location.host);

    console.log(">>> ONMOUNT app exit");

    return () => {
      console.log("EXIT App");
      stopIngestion();
      window.onerror = null;
      window.removeEventListener(
        "unhandledrejection",
        handleUnhandledRejection,
      );
    };
  });

  const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
    console.error("Unhandled rejection:", event.reason);
    toaster.error({
      title: "Unexpected Error",
      description: String(event.reason),
    });
  };

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

<!-- {@render props.children?.()} -->

<Toast.Group {toaster}>
  {#snippet children(toast)}
    <Toast {toast}>
      <Toast.Message>
        <Toast.Title>
          <div class="flex items-center gap-2">
            {#if toast.type === "info" || toast.type === "loading"}
              <Info class="size-4" />
            {:else if toast.type === "warning"}
              <TriangleAlert class="size-4" />
            {:else if toast.type === "error"}
              <CircleX class="size-4" />
            {:else if toast.type === "success"}
              <CircleCheck class="size-4" />
            {/if}
            {toast.title}
          </div>
        </Toast.Title>
        <Toast.Description>{toast.description}</Toast.Description>
      </Toast.Message>
      <Toast.CloseTrigger />
    </Toast>
  {/snippet}
</Toast.Group>

<div class="relative h-dvh w-screen overflow-hidden">
  <!-- {/* MAP LAYER */} -->
  <div class="absolute inset-0 z-0">
    {#if ready}
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
