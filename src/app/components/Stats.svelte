<script>
  import { stats } from "../stats.svelte";
</script>

<div
  class="user-select-none pe-none w-64 text-left text-xs bg-surface-100-900 pl-4"
>
  <span
    >Updated {stats.count ?? 0} vessels in {(stats.time ?? 0).toFixed(1)} ms</span
  >
</div>
