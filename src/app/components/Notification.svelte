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
      class="fixed inset-0 z-50 flex justify-center items-center p-4"
    >
      <Dialog.Content
        class="card preset-filled-error-500 w-md p-4 space-y-2 shadow-xl"
      >
        <Dialog.Title class="text-xl font-semibold flex items-center gap-2"
          ><CircleX />{notificationState.title}</Dialog.Title
        >
        <Dialog.Description>
          {notificationState.message}
        </Dialog.Description>
      </Dialog.Content>
    </Dialog.Positioner>
  </Portal>
</Dialog>
