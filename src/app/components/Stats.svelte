<script lang="ts">
  import { stats } from "../stats.svelte";
</script>

<div
  class="user-select-none pe-none w-64 text-left text-xs bg-surface-100-900 pl-4"
>
  <span
    >Updated {stats.count ?? 0} vessels in {Math.round(stats.time ?? 0)} ms</span
  >
</div>
