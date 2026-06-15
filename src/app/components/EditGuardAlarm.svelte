<script lang="ts">
  import { Slider } from "@skeletonlabs/skeleton-svelte";

  import { collisionProfiles } from "../../engine/collisionProfiles.svelte";
  import {
    sliderToZeroToTen,
    zeroToTenToSlider,
  } from "../utils/sliderValueConverter";

  console.log("ENTER EditGuardAlarm");
</script>

<!-- Range Within -->
<div class="flex items-end gap-1">
  <Slider
    class="mb-2"
    min={0}
    max={19}
    step={1}
    value={zeroToTenToSlider(
      collisionProfiles[collisionProfiles.current].guard.range,
    )}
    onValueChange={(e) => {
      collisionProfiles[collisionProfiles.current].guard.range =
        sliderToZeroToTen(e.value[0]) ?? 0;
    }}
  >
    <Slider.Label>Range Within</Slider.Label>
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
    {@render cpaLabel(collisionProfiles[collisionProfiles.current].guard.range)}
  </span>
</div>
<!-- Speed Exceeds -->
<div class="flex items-end gap-1">
  <Slider
    class="mb-2"
    min={0}
    max={19}
    step={1}
    value={zeroToTenToSlider(
      collisionProfiles[collisionProfiles.current].guard.speed,
    )}
    onValueChange={(e) => {
      collisionProfiles[collisionProfiles.current].guard.speed =
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
    >{collisionProfiles[collisionProfiles.current].guard.speed} kn</span
  >
</div>
