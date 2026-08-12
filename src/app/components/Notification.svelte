<script lang="ts">
  import { notificationState } from "../notification.svelte";
  import { Dialog, Portal } from "@skeletonlabs/skeleton-svelte";
  import { CircleX } from "@lucide/svelte";
  import { ui } from "../ui.svelte";
</script>

<Dialog
  role="alertdialog"
  open={ui.notification.visible}
  onOpenChange={(e) => {
    ui.notification.visible = e.open;
  }}
>
  <Portal>
    <Dialog.Backdrop class="fixed inset-0 z-50 bg-error-50-950/50" />
    <Dialog.Positioner
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <Dialog.Content
        class="w-md space-y-2 card preset-filled-error-500 p-4 shadow-xl"
      >
        <Dialog.Title class="flex items-center gap-2 text-xl font-semibold"
          ><CircleX />{notificationState.title}</Dialog.Title
        >
        <Dialog.Description>
          {notificationState.message}
        </Dialog.Description>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
