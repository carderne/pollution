/* global data mapboxgl turf */

const boundsPadding = 20;
const animDelay = 20; // ms
const numPts = data.features.length;
const boundsLag = 15;
const boundsLead = 5;

const live = { type: "FeatureCollection", features: [] };
let idx = 0;
let playing = false;

mapboxgl.accessToken =
  "pk.eyJ1IjoiY3Jpc3RpYW50cnVqaWxsbyIsImEiOiJja29iNnRhNncyd3ZrMndscDNueG91cXZoIn0.3MuxWlOJI8rW1g-8mgb4yA";
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v11",
  bounds: turf.bbox(turf.buffer(data.features[0], 1)),
  fitBoundsOptions: { padding: boundsPadding },
  maxBounds: [-2.2, 51.6, -0.5, 52.2], // W S E N
});

const start = data.features[0].geometry.coordinates;
const animatePoints = () => {
  const next = data.features[idx];
  document.getElementById("text").innerText = next.properties.date;

  live.features.push(next);
  data.features.forEach((el, i) => {
    data.features[i].properties.stamp = numPts - idx + i;
  });

  map.fitBounds(
    turf.bbox(
      turf.buffer(
        turf.featureCollection(
          data.features.filter(
            (el) =>
              el.properties.stamp > numPts - boundsLag &&
              el.properties.stamp < numPts + boundsLead
          )
        ),
        1
      )
    ),
    { linear: true, padding: boundsPadding, easing: (t) => t }
  );
  map.getSource("point").setData(live);

  // Go slower when further from home
  const latLng = next.geometry.coordinates;
  const dist =
    ((start[0] - latLng[0]) ** 2 + (start[1] - latLng[1]) ** 2) ** 0.5 * 100;
  const mult = dist < 1 ? 1 : 10;

  idx += 1;
  if (idx < data.features.length) {
    if (playing)
      setTimeout(() => requestAnimationFrame(animatePoints), animDelay * mult);
  } else {
    // reset
    idx = 0;
    playing = false;
    live.features = [];
    document.getElementById("btn").innerText = "Start again";
  }
};

const toggleInteractive = () => {
  if (playing) {
    map.boxZoom.disable();
    map.scrollZoom.disable();
    map.dragPan.disable();
    map.dragRotate.disable();
    map.keyboard.disable();
    map.doubleClickZoom.disable();
    map.touchZoomRotate.disable();
  } else {
    map.boxZoom.enable();
    map.scrollZoom.enable();
    map.dragPan.enable();
    map.dragRotate.enable();
    map.keyboard.enable();
    map.doubleClickZoom.enable();
    map.touchZoomRotate.enable();
  }
};

const togglePlay = () => {
  playing = !playing;
  if (playing) requestAnimationFrame(animatePoints);
  document.getElementById("btn").innerText = playing ? "Pause" : "Start";
  toggleInteractive();
};

map.on("load", () => {
  document.getElementById("btn").onclick = togglePlay;

  map.addSource("point", {
    type: "geojson",
    data: live,
  });

  map.addLayer({
    id: "point",
    source: "point",
    type: "circle",

    paint: {
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-radius": [
        "interpolate",
        ["exponential", 1.5],
        ["get", "stamp"],
        1,
        8,
        numPts,
        20,
      ],
      "circle-color": [
        "interpolate",
        ["linear"],
        ["get", "NO2_ppb"],
        0,
        "#d7b5d8",
        50,
        "#df65b0",
        100,
        "#dd1c77",
        289,
        "#980043",
      ],
      "circle-opacity": [
        "interpolate",
        ["exponential", 1.02],
        ["get", "stamp"],
        1,
        0.5,
        numPts,
        1.0,
      ],
    },
  });

  const popup = new mapboxgl.Popup({
    closeButton: false,
    closeOnClick: false,
  });

  map.on("mouseenter", "point", (e) => {
    if (!playing) {
      map.getCanvas().style.cursor = "pointer";
      const coordinates = e.features[0].geometry.coordinates.slice();
      const props = e.features[0].properties;
      const description = `
        <p><strong>${props.date}</strong></p>
        <p>NO2:<span>${props.NO2_ppb} ppb</span></p>
        <p>VOCs:<span>${props.VOC_ppb} ppb</span></p>
        <p>PM1:<span>${props.pm1_ugm3.toFixed(1)} μg/m<sup>3</sup></span></p>
        <p>PM2.5:<span>${props.pm25_ugm3.toFixed(1)} μg/m<sup>3</sup></span></p>
        <p>PM10: <span>${props.pm10_ugm3.toFixed(1)} μg/m<sup>3</sup></span></p>
      `;
      popup.setLngLat(coordinates).setHTML(description).addTo(map);
    }
  });

  map.on("mouseleave", "point", () => {
    map.getCanvas().style.cursor = "";
    popup.remove();
  });

  animatePoints();
});
