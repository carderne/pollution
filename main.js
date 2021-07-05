/* global data mapboxgl turf */

const get = document.getElementById.bind(document);

const btnPlay = get("play");
const btnSkip = get("skip");
const divTime = get("time");
const divNO2 = get("no2");
const spanNO2 = get("no2-val");
const divMsg = get("msg");
const divIntro = get("intro");

const hideInfo = () => {
  divIntro.classList.add("hidden");
};
divIntro.onclick = hideInfo;

const boundsPadding = 20;
const animDelay = 30; // ms
const numPts = data.features.length;
const boundsLag = 15;
const boundsLead = 15;

const live = { type: "FeatureCollection", features: [] };
const liveLine = { type: "FeatureCollection", features: [] };
let idx = 0;
let playing = false;
let reset = false;

const startBounds = turf.bbox(
  turf.buffer(turf.featureCollection(data.features.slice(0, 15)), 1, {
    steps: 1,
  })
);

mapboxgl.accessToken =
  "pk.eyJ1IjoiY3Jpc3RpYW50cnVqaWxsbyIsImEiOiJja29iNnRhNncyd3ZrMndscDNueG91cXZoIn0.3MuxWlOJI8rW1g-8mgb4yA";
const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/streets-v11",
  bounds: startBounds,
  fitBoundsOptions: { padding: boundsPadding },
  maxBounds: [-2.2, 51.6, -0.5, 52.2], // W S E N
});

const line = turf.featureCollection(
  data.features
    .slice(0, -1)
    .map((e, i) =>
      turf.lineString(
        [e.geometry.coordinates, data.features[i + 1].geometry.coordinates],
        e.properties
      )
    )
);

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

const end = () => {
  idx = 0;
  playing = false;
  reset = true;
  btnPlay.innerText = "Start again";
  toggleInteractive();
};

const getColor = (val) => {
  const h = 300 + ((334 - 300) * val) / 300;
  const s = 31 + ((100 - 31) * val) / 300;
  const l = 78 + ((30 - 78) * val) / 300;
  return `hsl(${h}, ${s}%, ${l}%)`;
};

const animatePoints = () => {
  const next = data.features[idx];
  const nextLine = line.features[idx];
  divTime.innerText = next.properties.date;

  live.features.push(next);
  liveLine.features.push(nextLine);

  live.features.forEach((el, i) => {
    // eslint-disable-next-line
    el.properties.stamp = numPts - idx + i;
  });

  if (next.properties.msg) divMsg.innerText = next.properties.msg;

  divNO2.style = `background-color: ${getColor(next.properties.NO2_ppb)}`;
  spanNO2.innerText = next.properties.NO2_ppb;

  if (idx % 15 === 0)
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
          1,
          { steps: 1 }
        )
      ),
      { linear: true, padding: boundsPadding }
    );
  map.getSource("point").setData(live);
  map.getSource("line").setData(liveLine);

  // Go slower when further from home
  const mult = next.properties.fast ? 1 : 10;

  idx += 1;
  if (idx < line.features.length) {
    if (playing)
      setTimeout(() => requestAnimationFrame(animatePoints), animDelay * mult);
  } else {
    // reset
    end();
  }
};

const skip = () => {
  live.features = data.features;
  liveLine.features = line.features;
  map.getSource("point").setData(live);
  map.getSource("line").setData(liveLine);
  end();
};

const togglePlay = () => {
  if (reset) {
    reset = false;
    live.features = [];
    liveLine.features = [];
  }
  playing = !playing;
  if (playing) requestAnimationFrame(animatePoints);
  btnPlay.innerText = playing ? "Pause" : "Start";
  toggleInteractive();
};

map.on("load", () => {
  btnPlay.onclick = togglePlay;
  btnSkip.onclick = skip;

  map.addSource("line", {
    type: "geojson",
    data: liveLine,
  });

  const colorStyle = [
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
  ];

  map.addLayer({
    id: "line-animation",
    type: "line",
    source: "line",
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": colorStyle,
      "line-width": 7,
      "line-opacity": 0.8,
    },
  });

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
      "circle-radius": 10,
      "circle-color": colorStyle,
      "circle-opacity": 0.5,
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
