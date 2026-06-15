<script>
  import { getCounts } from "../../engine/alarms.svelte";
  let c = $derived(getCounts());
</script>

<div class="user-select-none pe-none w-32 text-center">
  <p class="mb-0 text-6xl font-extralight text-cyan-400">
    {c.total ?? 0}
  </p>
  <p class="mb-4 text-sm text-gray-300">TARGETS</p>
  <p class="mb-0 text-6xl font-extralight text-blue-400">
    {c.filtered ?? 0}
  </p>
  <p class="mb-4 text-sm text-gray-300">FILTERED</p>
  <p class="mb-0 text-6xl font-extralight text-red-600">
    {c.danger ?? 0}
  </p>
  <p class="text-sm text-gray-300">ALARMS</p>
</div>
