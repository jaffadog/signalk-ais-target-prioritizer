<script lang="ts">
  import { Slider } from "@skeletonlabs/skeleton-svelte";

  import { collisionProfiles } from "../../engine/collisionProfiles.svelte";
  import {
    sliderToTcpa,
    sliderToZeroToTen,
    tcpaToSlider,
    zeroToTenToSlider,
  } from "../utils/sliderValueConverter";

  let { alarmState }: { alarmState: "warning" | "danger" } = $props();

  $inspect("ENTER EditProfile", alarmState);
</script>

<!-- CPA Less Than -->
<div class="flex items-end gap-1">
  <Slider
    class="mb-2"
    min={0}
    max={19}
    step={1}
    value={zeroToTenToSlider(
      collisionProfiles[collisionProfiles.current][alarmState].cpa,
    )}
    onValueChange={(e) => {
      collisionProfiles[collisionProfiles.current][alarmState].cpa =
        sliderToZeroToTen(e.value[0]) ?? 0;
    }}
  >
    <Slider.Label>CPA Less Than</Slider.Label>
    <Slider.Control>
      <Slider.Track>
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumb index={0}>
        <Slider.HiddenInput />
      </Slider.Thumb>
    </Slider.Control>
  </Slider>
  {#snippet cpaLabel(val: number)}
    {val === 0 ? "OFF" : `${val} NM`}
  {/snippet}
  <span class="w-18 text-right">
    {@render cpaLabel(
      collisionProfiles[collisionProfiles.current][alarmState].cpa,
    )}
  </span>
</div>
<!-- TCPA Less Than -->
<div class="flex items-end gap-1">
  <Slider
    class="mb-2"
    min={0}
    max={11}
    step={1}
    value={tcpaToSlider(
      collisionProfiles[collisionProfiles.current][alarmState].tcpa,
    )}
    onValueChange={(e) => {
      collisionProfiles[collisionProfiles.current][alarmState].tcpa =
        sliderToTcpa(e.value[0]) ?? 0;
    }}
  >
    <Slider.Label>TCPA Less Than</Slider.Label>
    <Slider.Control>
      <Slider.Track>
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumb index={0}>
        <Slider.HiddenInput />
      </Slider.Thumb>
    </Slider.Control>
  </Slider>
  <span class="w-18 text-right"
    >{collisionProfiles[collisionProfiles.current][alarmState].tcpa} Min</span
  >
</div>
<!-- Speed Exceeds -->
<div class="flex items-end gap-1">
  <Slider
    class="mb-2"
    defaultValue={[50]}
    min={0}
    max={19}
    step={1}
    value={zeroToTenToSlider(
      collisionProfiles[collisionProfiles.current][alarmState].speed,
    )}
    onValueChange={(e) => {
      collisionProfiles[collisionProfiles.current][alarmState].speed =
        sliderToZeroToTen(e.value[0]) ?? 0;
    }}
  >
    <Slider.Label>Speed Exceeds</Slider.Label>
    <Slider.Control>
      <Slider.Track>
        <Slider.Range />
      </Slider.Track>
      <Slider.Thumb index={0}>
        <Slider.HiddenInput />
      </Slider.Thumb>
    </Slider.Control>
  </Slider>
  <span class="w-18 text-right"
    >{collisionProfiles[collisionProfiles.current][alarmState].speed} kn</span
  >
</div>
