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
    flushPendingUpdates,
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
  import ky from "ky";
  import { vessels, vesselsState } from "../engine/vessels.svelte";
  import { getMutedVessels } from "./utils/api";
  import { mute } from "../engine/alarms.svelte";

  let authRequired = $state(false);

  const INIT_TIMEOUT = 5000;
  const FADE_DURATION = 750;

  const myVessel = $derived(
    vesselsState.myVesselMmsi ? vessels[vesselsState.myVesselMmsi] : undefined,
  );

  $inspect({ basemapId: mapState.basemapId });
  $inspect({ openSeaMap: mapState.openSeaMap });
  $inspect({ styleId: mapState.styleId });
  $inspect({ darkMode: ui.darkMode });
  $inspect({ documentVisibilityState: ui.documentVisibilityState });
  $inspect({ online: connectivity.online });

  // let initSteps = $state<InitStep[]>([
  const initSteps = $state<Record<string, InitStep>>({
    // {
    //   label: "Starting up",
    //   status: "pending",
    //   fn: async () => new Promise<void>((resolve) => setTimeout(resolve, 500)),
    // },
    checkAuth: { label: "Authenticating", status: "pending", fn: checkAuth },
    connectToSignalK: {
      label: "Connecting to Signal K",
      status: "pending",
      fn: connectToSignalK,
    },
    waitForMyVesselPosition: {
      label: "Checking my vessel position",
      status: "pending",
      fn: waitForMyVesselPosition,
    },
    backfillMutedVessels: {
      label: "Checking for existing muted vessels",
      status: "pending",
      fn: backfillMutedVessels,
    },
    checkConnectivity: {
      label: "Checking internet connectivity",
      status: "pending",
      fn: checkConnectivity,
    },
    initCollisionProfiles: {
      label: "Loading collision profiles",
      status: "pending",
      fn: initCollisionProfiles,
    },
    initBasemaps: {
      label: "Loading basemaps",
      status: "pending",
      fn: initBasemaps,
    },
    checkFontsAvailable: {
      label: "Checking for map fonts",
      status: "pending",
      fn: checkFontsAvailable,
    },
  });

  let hasErrors = $derived(
    Object.values(initSteps).some((s) => s.status === "error"),
  );

  async function connectToSignalK() {
    const start = Date.now();
    startIngestion(location.host);
    while (
      !["done", "error"].includes(initSteps["backfillMutedVessels"].status) ||
      !["done", "error"].includes(initSteps["waitForMyVesselPosition"].status)
    ) {
      flushPendingUpdates();
      if (Date.now() - start > INIT_TIMEOUT)
        throw new Error("No data received for my vessel");
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function waitForMyVesselPosition() {
    const start = Date.now();
    while (!myVessel || !myVessel.latitude || !myVessel.longitude) {
      if (Date.now() - start > INIT_TIMEOUT) {
        throw new Error("No data received for my vessel");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function backfillMutedVessels() {
    const start = Date.now();
    let mutedVessels = await getMutedVessels();

    while (mutedVessels.length > 0) {
      mutedVessels = mutedVessels.filter((mutedVessel) => {
        if (vessels[mutedVessel.mmsi]) {
          mute(mutedVessel.mmsi);
          return false; // remove from array
        }
        return true; // keep in item
      });

      if (Date.now() - start > INIT_TIMEOUT) {
        console.error(
          "Unable to backfill all previously  muted vessels",
          mutedVessels,
        );
        throw new Error("Unable to backfill all previously  muted vessels");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function checkAuth() {
    const loginStatus: { status: string } = await ky
      .get("/skServer/loginStatus", {
        credentials: "include",
      })
      .json();
    if (loginStatus.status !== "loggedIn") {
      authRequired = true;
      console.error("notlogged in", { loginStatus });
      throw new Error("Not logged in");
    }
  }

  async function trackedInit(initStep: InitStep) {
    initStep.status = "loading";
    try {
      await initStep.fn();
      initStep.status = "done";
    } catch (err) {
      initStep.status = "error";
      console.error(err);
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
      Object.values(initSteps).map((initStep) => trackedInit(initStep)),
    ).then(() => {
      if (!hasErrors) {
        showApp();
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

  function showApp() {
    // make sure our default/current basemap is valid, including
    // online/offline availability
    if (!(mapState.basemapId in basemaps)) {
      mapState.basemapId = "street";
    }
    ui.app.visible = true;
    setTimeout(() => (ui.loading.visible = false), FADE_DURATION);
  }

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
    console.log("EFFECT basemap changed", mapState.basemapId);
    localStorage.setItem("basemap", mapState.basemapId);
  });

  $effect(() => {
    console.log("EFFECT openseamap changed", mapState.openSeaMap);
    localStorage.setItem("openseamap", String(mapState.openSeaMap));
  });
</script>

<svelte:document bind:visibilityState={ui.documentVisibilityState} />
<svelte:window bind:innerWidth={ui.width} />

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

{#if ui.loading.visible}
  <div
    class="bg-white dark:bg-gray-900 p-8 pt-7 fixed inset-0 z-50 flex flex-col items-center justify-center"
    out:fade={{ duration: FADE_DURATION }}
  >
    <div
      class="flex flex-col items-center bg-white dark:bg-gray-800 rounded-lg w-full sm:w-sm max-h-[90dvh] overflow-y-auto gap-6 px-6 py-8 ring shadow-xl ring-gray-900/5"
    >
      <div>
        <img
          class="size-30 overflow-hidden rounded-2xl"
          src="assets/icon-120.png"
          alt="icon"
        />
      </div>
      <div class="text-2xl font-bold">Loading...</div>
      <div class="flex flex-col gap-2">
        {#each Object.values(initSteps) as step (step.label)}
          <div class="flex items-center gap-3">
            {#if step.status === "pending"}
              <div
                class="size-4 rounded-full border-2 border-surface-300"
              ></div>
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
            <button class="btn preset-filled-warning-500" onclick={showApp}>
              Continue Anyway
            </button>
          {/if}
        </div>
      {/if}
    </div>
  </div>
{/if}

{#if ui.app.visible}
  <div
    class="relative h-dvh w-screen overflow-hidden"
    in:fade={{ duration: FADE_DURATION }}
  >
    <div class="absolute inset-0 z-0">
      <Map />
    </div>

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
