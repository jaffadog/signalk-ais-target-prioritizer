import type { Map } from "maplibre-gl";
import type { CustomButtonControlOptions } from "../../types";

export class CustomButtonControl {
  private _title: string;
  private _svgIcon: string;
  private _svgClass: string;
  private _rotateWithBearing: boolean;
  private _onClick: (map: maplibregl.Map) => void;
  private _map?: maplibregl.Map;
  private _container?: HTMLDivElement;
  private _svg?: SVGElement;
  private _onRotate?: () => void;

  constructor({
    title = "Custom",
    svgIcon,
    svgClass = "w-4 h-4",
    rotateWithBearing = false,
    onClick = () => {},
  }: CustomButtonControlOptions) {
    this._title = title;
    this._svgIcon = svgIcon;
    this._svgClass = svgClass;
    this._rotateWithBearing = rotateWithBearing;
    this._onClick = onClick;
  }

  onAdd(map: Map) {
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

    this._svg = button.querySelector("svg") ?? undefined;
    if (this._svg) this._svg.setAttribute("class", this._svgClass);

    if (this._rotateWithBearing) {
      this._onRotate = () => {
        const bearing = this._map?.getBearing() ?? 0;
        if (this._svg) this._svg.style.transform = `rotate(${-bearing}deg)`;
      };
      map.on("rotate", this._onRotate);
    }

    button.addEventListener("click", (e) => {
      e.preventDefault();
      if (this._map) {
        this._onClick(this._map);
      }
    });

    this._container.appendChild(button);
    return this._container;
  }

  onRemove() {
    if (this._rotateWithBearing && this._map && this._onRotate) {
      this._map.off("rotate", this._onRotate);
    }
    if (this._container) this._container.remove();
    this._map = undefined;
  }
}
