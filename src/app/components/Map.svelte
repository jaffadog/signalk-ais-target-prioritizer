<script lang="ts">
  import type { GeoJSON, Feature, Geometry, GeoJsonProperties } from "geojson";

  import {
    addProtocol,
    AttributionControl,
    GeoJSONSource,
    LngLat,
    LngLatBounds,
    Map,
    NavigationControl,
    type EaseToOptions,
    type LngLatLike,
  } from "maplibre-gl";
  import "maplibre-gl/dist/maplibre-gl.css";

  import { Protocol } from "pmtiles";

  import { CustomButtonControl } from "../utils/CustomButtonControl";

  import circle from "@turf/circle";
  import destination from "@turf/destination";

  import {
    COLOR_MAP,
    DATA_REFRESH_INTERVAL,
    DEFAULT_ZOOM,
    METERS_PER_NM,
    SHOW_ALARMS_INTERVAL,
    TRAIL_DOT_REFERENCE_SPEED,
    TRAIL_DOT_SPACING,
    TRAIL_LENGTH,
    WARM_UP_TIME,
  } from "../../engine/constants";
  import { formatVesselLabel } from "../utils/formatUtils";
  import { getVesselIconName, registerAllIcons } from "../utils/vesselIcons";
  import { compassSvg } from "../utils/svg";
  import { onMount, untrack } from "svelte";
  import { CONNECTED, ingestion } from "../../engine/ingestion.svelte";
  import { calcCpaLocation, toDeg } from "../../engine/calculations";
  import {
    alarmsState,
    getAlarmVesselList,
    getCounts,
  } from "../../engine/alarms.svelte";
  import { vessels, vesselsState } from "../../engine/vessels.svelte";
  import { getStyleId, mapState, setStyle } from "../map.svelte";
  import { ui } from "../ui.svelte";
  import { showNotification } from "../notification.svelte";
  import { updateVessels } from "../../engine/refreshLoop.svelte";
  import { stats } from "../stats.svelte";
  import LayersMenu from "./LayersMenu.svelte";
  import { toaster } from "../utils/toaster";
  import { buildStyle } from "../resolveMapConfig";
  import { isValidNumber } from "../../engine/calculations";
  import type { Position, Tracks, Vessel } from "../../types";
  import type { Context } from "@signalk/server-api";
  import type { Coord } from "@turf/helpers";
  import locateFixedSvg from "lucide-static/icons/locate-fixed.svg?raw";
  import layersSvg from "lucide-static/icons/layers.svg?raw";
  import listSvg from "lucide-static/icons/list.svg?raw";
  import settingsSvg from "lucide-static/icons/settings.svg?raw";
  import { addSharedSources as addSources } from "../sources";
  import { addSharedLayers as addLayers } from "../layers";
  import { getStored, setStored } from "../utils/storage";
  import {
    startTracksLoop,
    stopTracksLoop,
    tracksState,
  } from "../tracks.svelte";

  export const VESSEL_ICON_LAYERS = [
    "vessels-icons-viewport",
    "vessels-icons-map",
  ];

  function storedZoom(): number | undefined {
    const zoom = Number(getStored("zoom"));
    return Number.isFinite(zoom) && zoom > 0 ? zoom : undefined;
  }

  // allow 5 second warm up before reporting errors
  let startTime = performance.now();

  let isCourseUp = $state(false);
  let isMyVesselInCenter = $state(true);
  let container: HTMLElement | undefined = $state();

  const myVessel = $derived(
    vesselsState.myVesselContext
      ? vessels[vesselsState.myVesselContext]
      : undefined,
  );
  const selectedVessel = $derived(
    vesselsState.selectedVesselContext
      ? vessels[vesselsState.selectedVesselContext]
      : undefined,
  );

  // let map;

  let updateMapLoopTimeoutId: ReturnType<typeof setTimeout> | undefined;
  let myVesselPreviousPosition: LngLatLike;
  let programmaticMapCenter: LngLat;

  let updateMapInprogress = false;

  let updateCameraRunning = false;
  let updateCameraPending = false;

  let firstNotification = true;

  // let schduleUpdate = false;

  onMount(() => {
    console.log("ONMOUNT map");

    // TODO include maps loaded from signalk chart provider
    // OpenStreetMap
    // OpenTopoMap

    // TODO add indication of cpa ahead or behind my vessel

    // TODO look at using updateData rather than setData

    const protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);

    const style = buildStyle();
    mapState.styleId = getStyleId();

    console.log("setting up maplibre", mapState.basemapId, ui.darkMode, style);

    const map = new Map({
      container: container!,
      fadeDuration: 0, // prevents blinks
      style: style,
      attributionControl: false,
      center: [myVessel?.longitude ?? 0, myVessel?.latitude ?? 0],
      zoom: storedZoom() ?? DEFAULT_ZOOM,
    });

    map.once("load", () => {
      console.log("maplibre loaded");

      mapState.instance = map;
      mapState.loaded = true;

      addSources();
      addLayers();
      registerAllIcons(map);
      startUpdateMapLoop();

      // delay showing alarms for a sec... its a better user experience
      setTimeout(async () => {
        alarmsState.alarmsEnabled = true;
      }, 1000);

      // FIXME does this have to be in onLoad?
      map.addControl(
        new AttributionControl({
          compact: true,
        }),
      );

      // FIXME does this have to be in onLoad?
      // click to close/collapse/compact, because the above does not work
      const attrBtn = map
        .getContainer()
        .querySelector(".maplibregl-ctrl-attrib-button") as HTMLButtonElement;

      attrBtn?.click();
    }); // end map on load

    map.on("error", (e) => {
      console.error("MapLibre error:", e.error);
      if (e.error?.message?.includes("Failed to fetch")) return;
      toaster.error({
        title: "Map Error",
        description: e.error?.message ?? "Unknown map error",
      });
    });

    // button: zoom and rotation
    map.addControl(new NavigationControl({ showCompass: false }), "top-left");

    // button: north up or course up toggle
    // rotate icon with map
    map.addControl(
      new CustomButtonControl({
        title: "Toggle map rotation between north up and course up",
        svgIcon: compassSvg,
        svgClass: "w-full h-full",
        rotateWithBearing: true,
        onClick: () => {
          console.log("compass click event handler enter");
          isCourseUp = !isCourseUp;
          // also switch back to centered view
          isMyVesselInCenter = true;
          console.log("compass click event handler executing updateCamera");
          updateCamera();
          console.log("compass click event handler exit", { isCourseUp });
        },
      }),
      "top-left",
    );

    // button: center on my vessel button
    map.addControl(
      new CustomButtonControl({
        title: "Center on my vessel",
        svgIcon: locateFixedSvg,
        svgClass: "w-4 h-4 lucide-icon",
        onClick: () => {
          console.log("center on my vessel");
          isMyVesselInCenter = true;
          updateCamera();
        },
      }),
      "top-left",
    );

    // button: layers
    map.addControl(
      new CustomButtonControl({
        title: "Select cartography",
        svgIcon: layersSvg,
        svgClass: "w-4 h-4 lucide-icon",
        onClick: () => {
          ui.layersMenu.visible = true;
        },
      }),
      "top-left",
    );

    // button: vessel list button
    map.addControl(
      new CustomButtonControl({
        title: "Vessel list",
        svgIcon: listSvg,
        svgClass: "w-4 h-4 lucide-icon",
        onClick: () => {
          console.log("showVesselTable");
          ui.vesselTable.visible = true;
        },
      }),
      "top-left",
    );

    // button: settings button
    map.addControl(
      new CustomButtonControl({
        title: "Settings",
        svgIcon: settingsSvg,
        svgClass: "w-4 h-4 lucide-icon",
        onClick: () => {
          console.log("showSettings");
          ui.settings.visible = true;
        },
      }),
      "top-left",
    );

    // map background click - clear selected vessel
    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: VESSEL_ICON_LAYERS,
      });
      if (features.length === 0) {
        vesselsState.selectedVesselContext = null;
        updateMap();
      }
    });

    map.on("click", VESSEL_ICON_LAYERS, (event) => {
      const feature = event.features?.[0];
      const context = feature?.properties?.context;

      // if (!context || context === vesselsState.myVesselContext) return;
      if (!context) return;

      vesselsState.selectedVesselContext = context;
      ui.vesselProperties.visible = true;
      updateMap();
    });

    map.on("mouseenter", VESSEL_ICON_LAYERS, () => {
      map.getCanvas().style.cursor = "pointer";
    });

    map.on("mouseleave", VESSEL_ICON_LAYERS, () => {
      map.getCanvas().style.cursor = "";
    });

    map.on("moveend", (e) => {
      if (!e.originalEvent) {
        return; // programmatic move — ignore
      }

      console.log("moveend - user move", e);

      const center = map.getCenter();

      // check if user manually changed map center:
      if (programmaticMapCenter) {
        const tol = 1e-8;
        if (
          myVessel &&
          isValidNumber(myVessel.longitude) &&
          isValidNumber(myVessel.latitude) &&
          (Math.abs(center.lng - programmaticMapCenter.lng) > tol ||
            Math.abs(center.lat - programmaticMapCenter.lat) > tol)
        ) {
          isMyVesselInCenter = false;
          myVesselPreviousPosition = [myVessel.longitude, myVessel.latitude];
        }
      }
    });

    // update range rings after zooming
    map.on("zoomend", () => {
      setStored("zoom", String(map.getZoom()));
      updateRangeRingsFeatures();
    });

    return () => {
      console.warn("EXIT map");
      stopUpdateMapLoop();
      stopTracksLoop();
      mapState.instance = null;
      mapState.loaded = false;
      map.remove();
    };
  }); // end onmount

  // when a vessel is selected, make sure that both the selected vessel and my vessel are visible
  $effect(() => {
    //subscribe
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    vesselsState.selectedVesselContext;

    untrack(() => {
      console.log("EFFECT vessel selected");
      if (
        !mapState.instance ||
        !myVessel ||
        !selectedVessel ||
        !isValidNumber(selectedVessel.tcpa) ||
        !isValidNumber(myVessel.latitude) ||
        !isValidNumber(myVessel.longitude) ||
        !isValidNumber(selectedVessel.latitude) ||
        !isValidNumber(selectedVessel.longitude)
      )
        return;

      const lngLats: LngLatLike[] = [
        [myVessel.longitude, myVessel.latitude],
        [selectedVessel.longitude, selectedVessel.latitude],
      ];

      // instant update of cpalocation
      myVessel.cpaLocation = calcCpaLocation(myVessel, selectedVessel.tcpa);
      selectedVessel.cpaLocation = calcCpaLocation(
        selectedVessel,
        selectedVessel.tcpa,
      );

      if (myVessel.cpaLocation) lngLats.push(myVessel.cpaLocation);
      if (selectedVessel.cpaLocation) lngLats.push(selectedVessel.cpaLocation);

      const bounds = mapState.instance.getBounds();
      const allVisible = lngLats.every((lngLat) => bounds.contains(lngLat));

      if (!allVisible) {
        const bounds = lngLats.reduce(
          (b, p) => b.extend(p),
          new LngLatBounds(lngLats[0], lngLats[0]),
        );

        mapState.instance.fitBounds(bounds, {
          padding: 100,
          maxZoom: 14,
          duration: 1000,
        });

        isMyVesselInCenter = false;
      }
    });
  }); // end effect

  // only poll the tracks api while trails are switched on - no point pulling
  // history over a boat network for something we are not drawing
  $effect(() => {
    if (mapState.trails) {
      startTracksLoop();
    } else {
      stopTracksLoop();
    }
  });

  //  basemap or dark mode changes - re-evaluate maplibre styles
  $effect(() => {
    // subscribe:
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    mapState.basemapId;
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    ui.darkMode;

    untrack(() => {
      console.log(
        "EFFECT darkmode or basemap changed",
        mapState.basemapId,
        ui.darkMode,
      );

      setStyle();
    });
  });

  function startUpdateMapLoop() {
    console.log("START map update loop");
    if (!updateMapLoopTimeoutId) {
      updateMapLoop();
    } else {
      console.warn("updateMapLoop is already running", {
        updateMapLoopTimeoutId,
      });
    }
  }

  function updateMapLoop() {
    if (ui.documentVisibilityState === "visible") updateMap();
    updateMapLoopTimeoutId = setTimeout(updateMapLoop, DATA_REFRESH_INTERVAL);
  }

  function updateMap() {
    // FIXME consider adding try/catch to deal with basemap switches that might tyeardown layers while updateMap is running
    // if (updateMapInprogress || basemapSwitching)  return;
    if (updateMapInprogress) return;
    // console.log("updateMap start");
    updateMapInprogress = true;
    const start = performance.now();
    console.time("updateMap");

    updateVessels();

    updateRangeRingsFeatures();
    updateTrailFeatures();
    updateVesselFeatures();
    updatePredictorFeatures();
    updateCamera();

    checkForAlarms();
    checkForErrors();

    console.timeEnd("updateMap");
    stats.time = performance.now() - start;
    stats.count = getCounts().total;
    // console.log({ myVessel, selectedVessel });

    updateMapInprogress = false;
    // console.log("updateMap end");
  }

  function stopUpdateMapLoop() {
    console.log("STOP map update loop", { updateMapLoopTimeoutId });
    clearTimeout(updateMapLoopTimeoutId);
    updateMapLoopTimeoutId = undefined;
  }

  function updateVesselFeatures() {
    // console.log("ENTER updateVesselFeatures");
    if (!mapState.instance || !mapState.loaded) return;

    const features: Feature<Geometry, GeoJsonProperties>[] = [];

    for (const vessel of Object.values(vessels)) {
      const feature = vesselToFeature(vessel);
      if (feature) features.push(feature);
    }

    const vesselsSource = mapState.instance.getSource(
      "vessels",
    ) as GeoJSONSource;

    if (vesselsSource)
      vesselsSource.setData({
        type: "FeatureCollection",
        features,
      });

    // console.log("EXIT updateVesselFeatures");
  }

  // past positions from the tracks plugin. own ship is drawn as the MultiLineString
  // the api returns, so gaps between track segments stay as gaps rather than being
  // joined by a straight line. every other vessel contributes its points as dots.
  function updateTrailFeatures() {
    if (!mapState.instance || !mapState.loaded) return;

    const ownFeatures: Feature<Geometry, GeoJsonProperties>[] = [];
    const targetFeatures: Feature<Geometry, GeoJsonProperties>[] = [];
    // when trails are off we still fall through, so the sources get emptied
    const tracks = mapState.trails ? tracksState.tracks : {};
    const stride = dotStride();
    const maxPoints = Math.ceil(
      (TRAIL_LENGTH * 60_000) / tracksState.resolution,
    );

    for (const [context, geometry] of Object.entries(tracks) as [
      Context,
      Tracks[Context],
    ][]) {
      const segments = geometry?.coordinates;
      if (!segments?.length) continue;

      // only draw trails for vessels we are tracking - the api is not filtered
      const vessel = vessels[context];
      if (!vessel) continue;

      const recent = takeRecent(segments, maxPoints);

      if (context === vesselsState.myVesselContext) {
        ownFeatures.push({
          type: "Feature",
          geometry: { type: "MultiLineString", coordinates: recent },
          properties: { context },
        });
        continue;
      }

      const coordinates = thinDots(recent.flat(), stride);
      if (!coordinates.length) continue;

      targetFeatures.push({
        type: "Feature",
        geometry: { type: "MultiPoint", coordinates },
        properties: { context, color: trailColor(vessel) },
      });
    }

    const ownSource = mapState.instance.getSource("own-trail") as GeoJSONSource;
    if (ownSource)
      ownSource.setData({ type: "FeatureCollection", features: ownFeatures });

    const targetSource = mapState.instance.getSource(
      "target-trails",
    ) as GeoJSONSource;
    if (targetSource)
      targetSource.setData({
        type: "FeatureCollection",
        features: targetFeatures,
      });
  }

  // how many dots to skip so that a vessel doing TRAIL_DOT_REFERENCE_SPEED shows
  // dots roughly TRAIL_DOT_SPACING pixels apart, whatever the zoom. one stride for
  // every target keeps their time step identical - it just widens by a whole
  // multiple as you zoom out, so the dots stay equally spaced by time.
  function dotStride(): number {
    const map = mapState.instance;
    if (!map) return 1;

    // metres per pixel measured off the live projection, so latitude is accounted for
    const center = map.getCenter();
    const point = map.project(center);
    const metersPerPixel =
      center.distanceTo(map.unproject([point.x + 64, point.y])) / 64;
    if (!metersPerPixel) return 1;

    const metersPerDot =
      ((TRAIL_DOT_REFERENCE_SPEED * METERS_PER_NM) / 3600) *
      (tracksState.resolution / 1000);
    const pixelsPerDot = metersPerDot / metersPerPixel;
    if (!pixelsPerDot) return 1;

    return Math.max(1, Math.round(TRAIL_DOT_SPACING / pixelsPerDot));
  }

  // the newest maxPoints positions, keeping the api's segment boundaries so a gap
  // in the track stays a gap. own ship is the case that needs this: it is always
  // present, so it accumulates the plugin's full retention, unlike AIS targets
  // which VHF range limits to a few hours anyway.
  function takeRecent(segments: Position[][], maxPoints: number): Position[][] {
    const recent: Position[][] = [];
    let remaining = maxPoints;
    for (let i = segments.length - 1; i >= 0 && remaining > 0; i--) {
      const segment = segments[i];
      const take = Math.min(segment.length, remaining);
      recent.unshift(segment.slice(segment.length - take));
      remaining -= take;
    }
    return recent;
  }

  // keep every stride-th dot, counting back from the newest so the trail always
  // stays attached to the vessel rather than drifting behind it
  function thinDots(coordinates: Position[], stride: number): Position[] {
    if (stride <= 1) return coordinates;
    const thinned: Position[] = [];
    for (let i = coordinates.length - 1; i >= 0; i -= stride) {
      thinned.push(coordinates[i]);
    }
    return thinned;
  }

  // trails take the colour of the target they belong to
  function trailColor(vessel: Vessel): string {
    if (vessel.context === vesselsState.selectedVesselContext)
      return COLOR_MAP["blue"];
    if (vessel.alarmState === "danger") return COLOR_MAP["red"];
    if (vessel.alarmState === "warning") return COLOR_MAP["orange"];
    return COLOR_MAP["gray"];
  }

  function vesselToFeature(
    vessel: Vessel,
  ): Feature<Geometry, GeoJsonProperties> | undefined {
    if (
      !vessel.isValid ||
      !isValidNumber(vessel.latitude) ||
      !isValidNumber(vessel.longitude)
    )
      return;

    const iconName = getVesselIconName(vessel);

    return {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [vessel.longitude, vessel.latitude],
      },
      properties: {
        context: vessel.context,
        icon: iconName,
        // low numbers on the bottom of z-index, big numbers on the top
        // so we flip our "order"
        order: vessel.order ? 999999 - vessel.order : 0,
        isLarge:
          (vessel.alarmState !== null ||
            vessel.context === vesselsState.selectedVesselContext) &&
          vessel.context !== vesselsState.myVesselContext,
        isLost: vessel.isLost,
        isSelected:
          vessel.context === vesselsState.selectedVesselContext &&
          vessel.context !== vesselsState.myVesselContext,
        labelText: formatVesselLabel(vessel),
        alignment:
          iconName.startsWith("vessel-aton") ||
          iconName.startsWith("vessel-base") ||
          iconName.startsWith("vessel-sart")
            ? "viewport"
            : "map",
        rotate: isValidNumber(vessel.hdg)
          ? toDeg(vessel.hdg)
          : isValidNumber(vessel.cog)
            ? toDeg(vessel.cog)
            : 0,
      },
    };
  }

  function updateRangeRingsFeatures() {
    // console.log("ENTER updateRangeRingsFeatures");

    if (!mapState.instance || !mapState.loaded || !myVessel) return;

    // subscriptions:
    const lat = myVessel.latitude;
    const lon = myVessel.longitude;

    if (!mapState.instance || !lat || !lon) return;

    const bounds = mapState.instance.getBounds();
    const north = bounds.getNorth();
    const south = bounds.getSouth();

    var mapHeightNm = 60 * Math.abs(north - south);

    // aiming for 3 visible range rings vertically
    var stepNm = mapHeightNm / 6;

    if (stepNm < 0.125) {
      stepNm = 0.125;
    } else if (stepNm < 0.25) {
      stepNm = 0.25;
    } else if (stepNm < 0.5) {
      stepNm = 0.5;
    } else if (stepNm < 1) {
      stepNm = 1;
    } else {
      stepNm = 2 * Math.round(stepNm / 2);
    }

    const radii: number[] = [];
    for (let i = 1; i <= 10; i++) {
      radii.push(i * stepNm);
    }

    const rangeRingFeatures: GeoJSON<Geometry, GeoJsonProperties> = {
      type: "FeatureCollection",
      features: radii.map((radiusNm) =>
        circle([lon, lat], radiusNm, {
          units: "nauticalmiles",
          steps: 64,
        }),
      ),
    };

    const rangeRimgsSource = mapState.instance.getSource(
      "range-rings",
    ) as GeoJSONSource;

    if (rangeRimgsSource) rangeRimgsSource.setData(rangeRingFeatures);

    const rangeLebelsSource = mapState.instance.getSource(
      "range-labels",
    ) as GeoJSONSource;

    if (rangeLebelsSource)
      rangeLebelsSource.setData(buildLabels([lon, lat], radii));
  }

  async function updateCamera() {
    // console.log("updateCamera start");

    if (!mapState.instance || !mapState.loaded) return;

    if (updateCameraRunning) {
      console.log("updateCamera is deferring");
      updateCameraPending = true;
      return;
    }
    updateCameraRunning = true;

    try {
      const lon = myVessel?.longitude;
      const lat = myVessel?.latitude;
      const cog = myVessel?.cog;
      const isDragPanActive = mapState.instance.dragPan.isActive();
      const isMapMoving = mapState.instance.isMoving();

      // dont do a programmatic move if:
      // - manual dragpan is in progress (which includes just click hold and not moving yet)
      // - any move is in progress (manual + programmatic)
      if (
        isDragPanActive ||
        isMapMoving ||
        !myVessel ||
        !isValidNumber(lon) ||
        !isValidNumber(lat) ||
        !isValidNumber(cog)
      ) {
        // console.log("cancelling updateCamera", {
        //   isDragPanActive,
        //   isMapMoving,
        // });
        return;
      }

      if (isMyVesselInCenter) {
        // keep my vessel in the center of the map
        // and rotate about the center
        // mapState.instance.jumpTo({
        //   center: [lon, lat],
        //   bearing: isCourseUp ? toDeg(cog) : 0,
        // });
        // console.log("updateCamera executing easeTo");
        // mapState.instance.easeTo({
        //   center: [lon, lat],
        //   bearing: isCourseUp ? toDeg(cog) : 0,
        // });
        await easeToAsync(mapState.instance, {
          center: [lon, lat],
          bearing: isCourseUp ? toDeg(cog) : 0,
        });

        firstNotification = true;
      } else {
        // if my vessel is not in the center of the map, then:
        // keep my vessel in the same position on screen
        // rotate the screen around my vessel (not map center)
        const newLngLat = new LngLat(lon, lat);

        if (myVesselPreviousPosition) {
          const myVesselScreenPos = mapState.instance.project(
            myVesselPreviousPosition,
          );
          const centerScreenPos = mapState.instance.project(
            mapState.instance.getCenter(),
          );
          const dx = centerScreenPos.x - myVesselScreenPos.x;
          const dy = centerScreenPos.y - myVesselScreenPos.y;
          const newMyVesselScreenPos = mapState.instance.project(newLngLat);
          const newCenter = mapState.instance.unproject([
            newMyVesselScreenPos.x + dx,
            newMyVesselScreenPos.y + dy,
          ]);

          if (isCourseUp && firstNotification) {
            firstNotification = false;
            toaster.success({
              title: "Map Rotation Frozen",
              description: `Map rotation will remain frozen while panning. Click "Center on my vessel" button to recenter your vessel and resume rotation.`,
              duration: 10000,
            });
          }

          // console.log("updateCamera executing setcenter");
          // mapState.instance.setCenter(newCenter);
          await easeToAsync(mapState.instance, {
            center: newCenter,
          });

          // NOTE... or maybe we just freeze map rotation once you
          // pan your vessel off center. some chart plotters are like that.
          // setBearingAroundPoint(map, isCourseUp ? toDeg(cog) : 0, newLngLat);
        }

        myVesselPreviousPosition = newLngLat;
      }

      programmaticMapCenter = mapState.instance.getCenter();
    } finally {
      updateCameraRunning = false;
      if (updateCameraPending) {
        console.log("updateCamera found pending execution");
        updateCameraPending = false;
        updateCamera();
      }
    }
    // console.log("updateCamera finish");
  }

  function easeToAsync(map: Map, options: EaseToOptions): Promise<void> {
    return new Promise<void>((resolve) => {
      map.easeTo(options);
      if (map.isMoving()) {
        map.once("moveend", () => resolve());
      } else {
        resolve();
      }
    });
  }

  function labelPoints(
    center: Coord,
    radiusNm: number,
  ): Feature<Geometry, GeoJsonProperties>[] {
    const top = destination(center, radiusNm, 0, {
      units: "nauticalmiles",
    });
    const bottom = destination(center, radiusNm, 180, {
      units: "nauticalmiles",
    });

    return [
      {
        type: "Feature",
        geometry: top.geometry,
        properties: { label: `${radiusNm} NM`, direction: "top" },
      },
      {
        type: "Feature",
        geometry: bottom.geometry,
        properties: { label: `${radiusNm} NM`, direction: "bottom" },
      },
    ];
  }

  function buildLabels(
    center: Coord,
    radii: number[],
  ): GeoJSON<Geometry, GeoJsonProperties> {
    return {
      type: "FeatureCollection",
      features: radii.flatMap((r) => labelPoints(center, r)),
    };
  }

  function updatePredictorFeatures() {
    // console.log("ENTER predictorFeatures computed");
    if (!mapState.instance || !mapState.loaded) return;

    const features: Feature<Geometry, GeoJsonProperties>[] = [];

    for (const vessel of Object.values(vessels)) {
      const lat = vessel.latitude;
      const lon = vessel.longitude;

      // set true for selected vessel and my vessel (when there is a selected vessel)
      const inspectCpa =
        vesselsState.selectedVesselContext &&
        [
          vesselsState.myVesselContext,
          vesselsState.selectedVesselContext,
        ].includes(vessel.context);

      const end = inspectCpa ? vessel.cpaLocation : vessel.predictedLocation;

      if (!lat || !lon || !end) continue;

      features.push({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [[lon, lat], end],
        },
        properties: {
          context: vessel.context,
          color: inspectCpa
            ? COLOR_MAP["blue"]
            : vessel.alarmState === "danger"
              ? COLOR_MAP["red"]
              : vessel.alarmState === "warning"
                ? COLOR_MAP["orange"]
                : COLOR_MAP["gray"],
        },
      });

      // add blue circles at cpa location for my vesseland the selected vessel
      if (inspectCpa) {
        features.push({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: end,
          },
          properties: {
            context: vessel.context,
            isCircle: true,
          },
        });
      }
    }

    const predictorsSource = mapState.instance.getSource(
      "predictors",
    ) as GeoJSONSource;

    if (predictorsSource)
      predictorsSource.setData({
        type: "FeatureCollection",
        features,
      });

    // console.log("EXIT predictorFeatures computed");
  }

  function checkForAlarms() {
    const alarms = getAlarmVesselList();

    const hasAlarms = alarms.length > 0;
    const hasNotBeenRaised = alarmsState.lastAlarmTime === null;
    const canReRaise =
      alarmsState.lastAlarmTime !== null &&
      performance.now() - alarmsState.lastAlarmTime > SHOW_ALARMS_INTERVAL;

    // NOTE working around a svelte bug that drops parentheses in boolean expressions
    const canShow = hasNotBeenRaised || canReRaise;

    if (hasAlarms && canShow && alarmsState.alarmsEnabled) {
      ui.alarms.visible = true;
    }
  }

  let stickyToaster: string | null;

  function checkForErrors() {
    // dont report any errors until past warmup
    if (performance.now() - startTime < WARM_UP_TIME) return;

    if (ingestion.connectionState !== CONNECTED) {
      showNotification(
        "Error",
        `Not connected to Signal K server.\nCurrent connection status: ${ingestion.connectionState}`,
      );
    } else if (!vesselsState.myVesselContext) {
      showNotification(
        "Error",
        "No data for our own vessel received from Signal K server",
      );
    } else {
      ui.notification.visible = false;
    }

    if (ingestion.connectionState === CONNECTED && getCounts().total === 0) {
      if (!stickyToaster) {
        stickyToaster = toaster.create({
          type: "info",
          title: "No Other Vessels",
          description: "No other vessels detected. You're all alone out here.",
        });
        console.log({ stickyToaster });
      }
    } else if (stickyToaster) {
      console.log("removing skicky toaster");
      toaster.remove(stickyToaster);
      stickyToaster = null;
    }
  }
</script>

<div bind:this={container} class="h-full w-full"></div>

{#if ui.layersMenu.visible}
  <LayersMenu />
{/if}
