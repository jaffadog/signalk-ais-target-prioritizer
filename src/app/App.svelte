<script lang="ts">
  import { onMount } from "svelte";
  import { toaster } from "./utils/toaster";
  import { Toast } from "@skeletonlabs/skeleton-svelte";
  import { fade } from "svelte/transition";

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
  import { resolveIsDark, ui } from "./ui.svelte";
  import { initCollisionProfiles } from "../engine/collisionProfiles.svelte";
  import { checkFontsAvailable, mapState } from "../engine/map.svelte";
  import { checkConnectivity, connectivity } from "./connectivity.svelte";
  import { CircleCheck, CircleX, Info, TriangleAlert } from "@lucide/svelte";
  import { basemaps, initBasemaps } from "./basemaps.svelte";
  import type { InitStep } from "../types";
  import ky, { HTTPError } from "ky";

  let ready = $state(false);
  let loadingVisible = $state(true);
  let authRequired = $state(false);

  const FADE_DURATION = 1000;

  $inspect({ basemapId: mapState.basemapId });
  $inspect({ openSeaMap: mapState.openSeaMap });
  $inspect({ styleId: mapState.styleId });
  $inspect({ darkMode: ui.darkMode });
  $inspect({ visible: ui.visible });
  $inspect({ width: ui.width });
  $inspect({ online: connectivity.online });
  $inspect({ ready: ready });

  // const [send, receive] = crossfade({
  //   duration: 5000,
  //   easing: quintOut,
  // });

  let initSteps = $state<InitStep[]>([
    {
      label: "Starting up",
      status: "pending",
      fn: async () => new Promise<void>((resolve) => setTimeout(resolve, 1500)),
    },
    { label: "Authenticating", status: "pending", fn: checkAuth },
    {
      label: "Connecting to Signal K",
      status: "pending",
      fn: () => startIngestion(location.host),
    },
    {
      label: "Checking internet connectivity",
      status: "pending",
      fn: checkConnectivity,
    },
    { label: "Loading basemaps", status: "pending", fn: initBasemaps },
    {
      label: "Loading collision profiles",
      status: "pending",
      fn: initCollisionProfiles,
    },
    { label: "Loading map fonts", status: "pending", fn: checkFontsAvailable },
  ]);

  let hasErrors = $derived(initSteps.some((s) => s.status === "error"));

  async function checkAuth() {
    try {
      // http://localhost:3000/skServer/loginStatus
      await ky.get("/signalk/v1/api/self", {
        credentials: "include",
      });
    } catch (err) {
      if (
        err instanceof HTTPError &&
        (err.response.status === 401 || err.response.status === 403)
      ) {
        authRequired = true;
        return new Promise<void>(() => {}); // hang so trackedInit shows error
      }
      throw err;
    }
  }

  async function trackedInit(index: number, fn: () => Promise<void>) {
    initSteps[index].status = "loading";
    try {
      await fn();
      initSteps[index].status = "done";
    } catch (err) {
      initSteps[index].status = "error";
      throw err;
    }
  }

  onMount(() => {
    console.log(">>> ONMOUNT app");

    // global error handlers:
    window.onerror = (message, source, line, col, error) => {
      console.error("Global error:", { message, source, line, col, error });
      toaster.error({
        title: "Unexpected Error",
        description: String(message),
        duration: Infinity,
      });
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    // initialize prereqs
    Promise.allSettled(
      initSteps.map((step, i) => trackedInit(i, step.fn)),
    ).then(() => {
      if (!hasErrors) {
        // make sure our default/current basemap is valid
        if (!(mapState.basemapId in basemaps)) {
          mapState.basemapId = "street";
        }
        ready = true;
        setTimeout(() => (loadingVisible = false), FADE_DURATION);
      }
    });

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
      duration: Infinity,
    });
  };

  // handle all local storage persistence with effects triggered by the corresponding $state

  $effect(() => {
    console.log("EFFECT themeMode changed - saving", ui.themeMode);
    ui.darkMode = resolveIsDark(ui.themeMode);
    localStorage.setItem("theme", ui.themeMode);
    document.documentElement.classList.toggle("dark", ui.darkMode);
  });

  $effect(() => {
    console.log(
      "EFFECT themeMode changed - setting up event listener",
      ui.themeMode,
    );
    if (ui.themeMode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      ui.darkMode = mq.matches;
      document.documentElement.classList.toggle("dark", ui.darkMode);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  });

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

{#if loadingVisible}
  <div
    class="fixed inset-0 z-50 flex flex-col items-center justify-center bg-surface-50-950 gap-6"
    // in:receive={{ key: "screen" }}
    // out:send={{ key: "screen" }}
    out:fade={{ duration: FADE_DURATION }}
  >
    <div class="text-2xl font-bold">AIS Target Prioritizer</div>
    <div class="flex flex-col gap-2 w-64">
      {#each initSteps as step (step.label)}
        <div class="flex items-center gap-3">
          {#if step.status === "pending"}
            <div class="size-4 rounded-full border-2 border-surface-300"></div>
          {:else if step.status === "loading"}
            <div
              class="size-4 animate-spin rounded-full border-2 border-primary-500 border-t-transparent"
            ></div>
          {:else if step.status === "done"}
            <CircleCheck class="size-4 text-success-500" />
          {:else if step.status === "error"}
            <CircleX class="size-4 text-error-500" />
          {/if}
          <span class="text-sm">{step.label}</span>
        </div>
      {/each}
    </div>
    {#if hasErrors}
      <div class="flex flex-col items-center gap-3">
        {#if authRequired}
          <p class="text-sm text-surface-400 text-center max-w-xs">
            Authentication required to use this app.
          </p>
          <a href="/admin/#/login" class="btn preset-filled-primary-500">
            Log In to Signal K
          </a>
        {:else}
          <p class="text-sm text-warning-500 text-center max-w-xs">
            Some initialization steps failed. The app may not function
            correctly.
          </p>
          <button
            class="btn preset-filled-warning-500"
            onclick={() => {
              if (!(mapState.basemapId in basemaps)) {
                mapState.basemapId = "street";
              }
              ready = true;
            }}
          >
            Continue Anyway
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}

{#if ready}
  <div
    class="relative h-dvh w-screen overflow-hidden"
    // in:receive={{ key: "screen" }}
    // out:send={{ key: "screen" }}
    in:fade={{ duration: FADE_DURATION }}
  >
    <!-- {/* MAP LAYER */} -->
    <div class="absolute inset-0 z-0">
      <Map />
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
{/if}
