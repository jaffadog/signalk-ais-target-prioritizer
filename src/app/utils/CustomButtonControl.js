export class CustomButtonControl {
  constructor({
    title = "Custom",
    svgIcon,
    svgClass = "w-4 h-4",
    rotateWithBearing = false,
    onClick = () => {},
  }) {
    this._title = title;
    this._svgIcon = svgIcon;
    this._svgClass = svgClass;
    this._rotateWithBearing = rotateWithBearing;
    this._onClick = onClick;
  }

  onAdd(map) {
    this._map = map;

    // Container with the same styling as NavigationControl
    this._container = document.createElement("div");
    this._container.className = "maplibregl-ctrl maplibregl-ctrl-group";

    // Button styled like zoom +/- buttons
    const button = document.createElement("button");
    button.style.cssText =
      "display: flex; align-items: center; justify-content: center;";
    button.type = "button";
    button.title = this._title;
    button.setAttribute("aria-label", this._title);

    // You can use text, emoji, or SVG
    button.innerHTML = this._svgIcon;

    this._svg = button.querySelector("svg");
    if (this._svg) this._svg.setAttribute("class", this._svgClass);

    if (this._rotateWithBearing) {
      this._onRotate = () => {
        const bearing = this._map.getBearing();
        this._svg.style.transform = `rotate(${-bearing}deg)`;
      };
      map.on("rotate", this._onRotate);
    }

    button.addEventListener("click", (e) => {
      e.preventDefault();
      this._onClick(this._map);
    });

    this._container.appendChild(button);
    return this._container;
  }

  onRemove() {
    if (this._rotateWithBearing && this._map) {
      this._map.off("rotate", this._onRotate);
    }
    this._container.remove();
    this._map = undefined;
  }
}
