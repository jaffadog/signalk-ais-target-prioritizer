<script lang="ts">
  import { Sun, Moon, Monitor } from "@lucide/svelte";
  import { ui } from "../ui.svelte";

  type ThemeMode = "light" | "dark" | "system";

  const options: { mode: ThemeMode; icon: typeof Sun; label: string }[] = [
    { mode: "system", icon: Monitor, label: "System" },
    { mode: "light", icon: Sun, label: "Light" },
    { mode: "dark", icon: Moon, label: "Dark" },
  ];

  function handleThemeChange(mode: ThemeMode) {
    ui.themeMode = mode;
  }
</script>

<div class="flex items-center justify-between gap-2 p-2">
  <span class="label-text text-sm">Theme</span>
  <div class="inline-flex rounded-full bg-surface-200-800 p-0.75 gap-0.5">
    {#each options as { mode, icon: Icon, label } (mode)}
      <button
        type="button"
        class="flex items-center justify-center rounded-full p-1.5 transition-colors
          {ui.themeMode === mode
          ? 'bg-surface-50-950 shadow-sm text-primary-500'
          : 'text-surface-400 hover:text-surface-600-400'}"
        onclick={() => handleThemeChange(mode)}
        aria-label={label}
        title={label}
      >
        <Icon class="size-4" />
      </button>
    {/each}
  </div>
</div>
