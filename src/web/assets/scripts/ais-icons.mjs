import { toDegrees } from "./ais-utils.mjs";

export function getClassBIcon(target, isLarge, color) {
	var boxSize = 50;
	var strokeWidth = 2;
	if (isLarge) {
		boxSize = 70;
		strokeWidth = 4;
	}
	var boatLengthToBeam = 1.8;
	var margin = 10;
	var boatLength = boxSize - 2 * margin;
	var boatCenterOffset = margin / 2;
	var boatBeam = boatLength / boatLengthToBeam;
	var crosshairLength = boxSize * 0.8;
	const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <polygon
            points="${boxSize / 2 - boatBeam / 2},  ${boxSize / 2 + boatLength / 2 - boatCenterOffset} 
                    ${boxSize / 2},                 ${boxSize / 2 - boatLength / 2 - boatCenterOffset} 
                    ${boxSize / 2 + boatBeam / 2},  ${boxSize / 2 + boatLength / 2 - boatCenterOffset}"
            fill="${color}"
            fill-opacity=0.3
            stroke-width=${strokeWidth}
            stroke="${color}"
            stroke-opacity=1
            pointer-events="all"
            transform="rotate(${toDegrees(target.hdg || target.cog) || 0} ${boxSize / 2} ${boxSize / 2})"
        />
        ${
					target.isLost
						? `
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - crosshairLength / 2} v${crosshairLength} M${boxSize * 0.5 - crosshairLength / 2},${boxSize * 0.5} h${crosshairLength}"
            stroke="red"
            stroke-width=2
            stroke-opacity=1
            transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
        />`
						: ""
				}
    </svg>`;

	// we need the classname to prevent the div from becoming visible
	return L.divIcon({
		className: "foobar",
		html: SVGIcon,
		iconAnchor: [boxSize / 2, boxSize / 2],
	});
}

export function getClassAIcon(target, isLarge, color) {
	var boxSize = 50;
	var strokeWidth = 2;
	if (isLarge) {
		boxSize = 70;
		strokeWidth = 4;
	}
	var boatLengthToBeam = 2.2;
	var bowLengthToBoatLength = 0.4;
	var margin = 10;
	var boatLength = boxSize - 2 * margin;
	var boatBeam = boatLength / boatLengthToBeam;
	var crosshairLength = boxSize * 0.8;
	const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <polygon
            points="
                ${boxSize / 2 - boatBeam / 2},   ${boxSize / 2 + boatLength / 2} 
                ${boxSize / 2 - boatBeam / 2},   ${boxSize / 2 - boatLength / 2 + boatLength * bowLengthToBoatLength} 
                ${boxSize / 2},                  ${boxSize / 2 - boatLength / 2} 
                ${boxSize / 2 + boatBeam / 2},   ${boxSize / 2 - boatLength / 2 + boatLength * bowLengthToBoatLength} 
                ${boxSize / 2 + boatBeam / 2},   ${boxSize / 2 + boatLength / 2}"
            fill="${color}"
            fill-opacity=0.3
            stroke-width=${strokeWidth}
            stroke="${color}"
            stroke-opacity=1
            pointer-events="all"
            transform="rotate(${toDegrees(target.hdg || target.cog) || 0} ${boxSize / 2} ${boxSize / 2})"
        />
        ${
					target.isLost
						? `
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - crosshairLength / 2} v${crosshairLength} M${boxSize * 0.5 - crosshairLength / 2},${boxSize * 0.5} h${crosshairLength}"
            stroke="red"
            stroke-width=2
            stroke-opacity=1
            transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
        />`
						: ""
				}
    </svg>`;

	// we need the classname to prevent the div from becoming visible
	return L.divIcon({
		className: "foobar",
		html: SVGIcon,
		iconAnchor: [boxSize / 2, boxSize / 2],
	});
}

export function getBlueBoxIcon() {
	var boxSize = 80;
	var margin = 10;
	var blueBoxSize = boxSize - 2 * margin;
	const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <rect
            style="stroke:#3c48be;stroke-width:5;stroke-dasharray:${(blueBoxSize * 3) / 4} ${blueBoxSize / 4} ${(blueBoxSize * 3) / 4} ${blueBoxSize / 4};stroke-dashoffset:${(blueBoxSize * 3) / 8};stroke-opacity:1.0;fill-opacity:0"
            width="${blueBoxSize}"
            height="${blueBoxSize}"
            x="${margin}"
            y="${margin}" />
    </svg>`;

	return L.divIcon({
		className: "foobar",
		html: SVGIcon,
		iconAnchor: [boxSize / 2, boxSize / 2],
	});
}

export function getAtonIcon(target, isLarge, color) {
	var boxSize = 40;
	var strokeWidth = 2;
	if (isLarge) {
		boxSize = 50;
		strokeWidth = 4;
	}
	var margin = 12;
	var atonSize = boxSize - 2 * margin;
	var crosshairLength = atonSize * 0.6;
	var isLostCrosshairLength = boxSize * 0.8;

	const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <rect x="${margin}" y="${margin}" width="${atonSize}" height="${atonSize}" 
            transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
            fill="${color}"
            fill-opacity=0.3
            stroke-width=${strokeWidth}
            ${target.isVirtual ? 'stroke-dasharray="2 2"' : ""}
            stroke="${color}"
            stroke-opacity=1
        />
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - crosshairLength / 2} v${crosshairLength} M${boxSize * 0.5 - crosshairLength / 2},${boxSize * 0.5} h${crosshairLength}"
            stroke="${color}"
            stroke-width=2
            stroke-opacity=1
        />
        ${
					target.isLost
						? `
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - isLostCrosshairLength / 2} v${isLostCrosshairLength} M${boxSize * 0.5 - isLostCrosshairLength / 2},${boxSize * 0.5} h${isLostCrosshairLength}"
            stroke="red"
            stroke-width=2
            stroke-opacity=1
            transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
        />`
						: ""
				}
    </svg>`;

	return L.divIcon({
		className: "foobar",
		html: SVGIcon,
		iconAnchor: [boxSize / 2, boxSize / 2],
	});
}

export function getBaseIcon(target, isLarge, color) {
	var boxSize = 40;
	var strokeWidth = 2;
	if (isLarge) {
		boxSize = 50;
		strokeWidth = 4;
	}
	var margin = 12;
	var atonSize = boxSize - 2 * margin;
	var crosshairLength = atonSize * 0.6;
	var isLostCrosshairLength = boxSize * 0.8;

	const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <rect x="${margin}" y="${margin}" width="${atonSize}" height="${atonSize}" 
            fill="${color}"
            fill-opacity=0.3
            stroke-width=${strokeWidth}
            stroke="${color}"
            stroke-opacity=1
        />
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - crosshairLength / 2} v${crosshairLength} M${boxSize * 0.5 - crosshairLength / 2},${boxSize * 0.5} h${crosshairLength}"
            stroke="${color}"
            stroke-width=2
            stroke-opacity=1
        />
        ${
					target.isLost
						? `
        <path d="M${boxSize * 0.5},${boxSize * 0.5 - isLostCrosshairLength / 2} v${isLostCrosshairLength} M${boxSize * 0.5 - isLostCrosshairLength / 2},${boxSize * 0.5} h${isLostCrosshairLength}"
            stroke="red"
            stroke-width=2
            stroke-opacity=1
            transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
        />`
						: ""
				}
    </svg>`;

	return L.divIcon({
		className: "foobar",
		html: SVGIcon,
		iconAnchor: [boxSize / 2, boxSize / 2],
	});
}

export function getSartIcon() {
	var boxSize = 40;
	var strokeWidth = 2;
	var radius = 15;

	const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <g
            fill-opacity=0
            stroke-width=${strokeWidth}
            stroke="red"
            stroke-opacity=1
        >
            <circle cx="${boxSize / 2}" cy="${boxSize / 2}" r="${radius}" />
            <path d="M${boxSize * 0.5},${boxSize * 0.5 - radius} v${radius * 2} M${boxSize * 0.5 - radius},${boxSize * 0.5} h${radius * 2}" 
                transform="rotate(45 ${boxSize / 2} ${boxSize / 2})"
            />
        </g>
    </svg>`;

	return L.divIcon({
		className: "foobar",
		html: SVGIcon,
		iconAnchor: [boxSize / 2, boxSize / 2],
	});
}

export function getSelfIcon() {
	var boxSize = 40;
	var strokeWidth = 2;

	const SVGIcon = `
    <svg width="${boxSize}px" height="${boxSize}px" pointerEvents="none">
        <g
            fill-opacity=0
            stroke-width=${strokeWidth}
            stroke="gray"
            stroke-opacity=1
        >
            <circle cx="${boxSize / 2}" cy="${boxSize / 2}" r="17" />
            <circle cx="${boxSize / 2}" cy="${boxSize / 2}" r="7" />
        </g>
    </svg>`;

	return L.divIcon({
		className: "foobar",
		html: SVGIcon,
		iconAnchor: [boxSize / 2, boxSize / 2],
	});
}
