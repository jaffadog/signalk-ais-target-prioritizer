import { ui } from "./ui.svelte";

export const notificationState = $state<{
  title: string | null;
  message: string | null;
}>({
  title: null,
  message: null,
});

export function showNotification(title: string, message: string) {
  notificationState.title = title;
  notificationState.message = message;
  ui.notification.visible = true;
}
