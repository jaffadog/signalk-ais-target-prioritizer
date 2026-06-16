export function getCssColor(varName: string) {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();

  // use a temporary element to resolve to rgb
  const el = document.createElement("div");
  el.style.color = value;
  document.body.appendChild(el);
  const resolved = getComputedStyle(el).color;
  document.body.removeChild(el);
  return resolved;
}
