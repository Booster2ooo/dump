/*
 * Requires mapboxgl and mapboxgl-geocoder pluging
 * https://api.tiles.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.js
 * https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.min.js
 *
 * https://api.tiles.mapbox.com/mapbox-gl-js/v2.14.1/mapbox-gl.css
 * https://api.mapbox.com/mapbox-gl-js/plugins/mapbox-gl-geocoder/v5.0.0/mapbox-gl-geocoder.css
 *
 */


(async () => {
  
  /*
   * Haversine implementation taken from https://github.com/dcousens/haversine-distance
   * MIT LICENSE : https://github.com/dcousens/haversine-distance/blob/main/LICENSE
   */
  const asin = Math.asin
  const cos = Math.cos
  const sin = Math.sin
  const sqrt = Math.sqrt
  const PI = Math.PI
  // equatorial mean radius of Earth (in meters)
  const R = 6378137
  function squared (x) { return x * x }
  function toRad (x) { return x * PI / 180.0 }
  function hav (x) {
    return squared(sin(x / 2))
  }
  // hav(theta) = hav(bLat - aLat) + cos(aLat) * cos(bLat) * hav(bLon - aLon)
  function haversine(a, b) {
    const aLat = toRad(Array.isArray(a) ? a[1] : a.latitude ?? a.lat)
    const bLat = toRad(Array.isArray(b) ? b[1] : b.latitude ?? b.lat)
    const aLng = toRad(Array.isArray(a) ? a[0] : a.longitude ?? a.lng ?? a.lon)
    const bLng = toRad(Array.isArray(b) ? b[0] : b.longitude ?? b.lng ?? b.lon)

    const ht = hav(bLat - aLat) + cos(aLat) * cos(bLat) * hav(bLng - aLng)
    return 2 * R * asin(sqrt(ht))
  }
  /* END OF HAVERSINE */
  
  const getLogoFileExtension = (partner) => {
    switch (partner) {
      case 'co-op':
      case 'evf':
      case 'gleaners':
      case 'iq':
      case 'manx_petroleums':
      case 'mol':
      case 'pace':
      case 'smartdiesel':
      case 'regent':
      case 'evf':
      case 'power':
      case 'scottish_fuels':
      case 'argos':
        return 'png'
      case 'air_liquide':
        return 'jpg'
      default:
        return 'svg';
    }
  }

  const svgMime = 'image/svg+xml';
  const markerUrl = 'https://raw.githubusercontent.com/Booster2ooo/dump/main/yellow_marker2.svg';
  const markerSrc = await fetch(markerUrl)
    .then(resp => resp.text())
    .then(svgSrc => {
      const svgDoc = new DOMParser().parseFromString(svgSrc, svgMime);
      return URL.createObjectURL(
        new Blob([new XMLSerializer().serializeToString(svgDoc)], { type: svgMime })
      );
    });

  const createPartnerMarker = async (partner) => {
    //const markerUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.networkfleetapp.com/assets/images/yellow_marker2.svg')}`;
    //const logoUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.networkfleetapp.com/assets/images/${partner}_square.svg`)}`;
    //const markerUrl = 'https://raw.githubusercontent.com/Booster2ooo/dump/main/yellow_marker2.svg';
    const logoFileExtension = getLogoFileExtension(partner);
    const logoUrl = `https://raw.githubusercontent.com/Booster2ooo/dump/main/${partner}.${logoFileExtension}`;
    //const svgMime = 'image/svg+xml';
    const canvas = document.createElement('canvas');
    canvas.width = 35;
    canvas.height = 48;
    const context = canvas.getContext('2d');
    const markerImg = new Image(35, 48);
    const logoImg = new Image(20, 20);
    const markerLoaded = new Promise((resolve, reject) => {
      markerImg.onload = () => {
        context.drawImage(markerImg, 0, 0);
        resolve();
      };
    });
    const logoLoaded = new Promise((resolve, reject) => {
      logoImg.onload = () => {
        context.drawImage(logoImg, 7.5, 7.5, 20, 20);
        resolve();
      };
    });
    markerImg.src = markerSrc;
    try {
      return markerLoaded
        .then(() => {
          if (logoFileExtension === 'svg') {
            return fetch(logoUrl)
              .then(resp => resp.text())
              .then(svgSrc => {
                const svgDoc = new DOMParser().parseFromString(svgSrc, svgMime);
                svgDoc.documentElement.setAttribute('width', 20);
                svgDoc.documentElement.setAttribute('height', 20);
                logoImg.src = URL.createObjectURL(
                  new Blob([new XMLSerializer().serializeToString(svgDoc)], { type: svgMime })
                );
              });
          }
          else {
            return fetch(logoUrl)
              .then(resp => resp.blob())
              .then(blob => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function () { resolve(this.result) };
                reader.readAsDataURL(blob)
              }))
              .then(base64 => {
                logoImg.src = base64;
              });
          }
        })
        .then(() => logoLoaded)
        .then(() => canvas.toDataURL())
        ;
    }
    catch (ex) {
      return Promise.reject(ex);
    }
  };

  const asGeoJsonFeature = station => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [parseFloat(station.lng), parseFloat(station.lat)]
    },
    properties: {
      name: `${station.partner} ${station.city.toLowerCase()}`,
      icon: `${station.partner}_image`,
      ...station
    }
  });
  
  const toHumanCase = (source) => source
    .toLowerCase()
    .replace(
      /\s+(.)(\w+)/g,
      ($1, $2, $3) => ` ${$2.toUpperCase()}${$3.toLowerCase()}`
    )
    .replace(/\w/, (s) => s.toUpperCase())
    ;

  const clusterZoomLevel = 12;
  mapboxgl.accessToken = 'pk.eyJ1IjoiYm9vc3RlcjJvb28iLCJhIjoiY2xoaXk0NGJsMGNpcTNsbnhxcXZqMTBjbiJ9.KNkQ27TkoAYTb3j3KBlTaQ';

  const getUserGeolocation = () => new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition((position) => {
      resolve([position.coords.longitude, position.coords.latitude]);
    }, reject);
  })

  let center = [4.3053507, 50.8549541];
  if (!!navigator.geolocation) {
    /* non blocking instead, see after map initialization
    try {
      center = await getUserGeolocation() || center;
    }
    catch(ex) {}
    */
  }

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/greenpigsprl/cjq6ixeml987l2smmt7d5jb0f',
    zoom: 12,
    center
  });
  
  navigator.geolocation.getCurrentPosition((position) => {
    map.flyTo({
      center: [position.coords.longitude, position.coords.latitude]
    });
  });

  map.addControl(
    new MapboxGeocoder({
      accessToken: mapboxgl.accessToken,
      mapboxgl: mapboxgl
    })
  );
  
  const mapLoaded = new Promise((resolve, reject) => map.on('load', resolve));

  const stationsCollection = await fetch('https://raw.githubusercontent.com/Booster2ooo/dump/main/stations.json')
    .then(res => res.json())
    .then(stations => stations
      .reduce((acc, station) => {
        const lng = parseFloat(station.lng);
        const lat = parseFloat(station.lat);
        const valid = !!lng && !!lat && lng > -180 && lng < 180 && lat > -90 && lat < 90;
        if (!valid) {
          //console.log(station);
          return acc;
        }
        const feature = asGeoJsonFeature(station);
        acc.features.push(feature);
        return acc;
      }, { type: 'FeatureCollection', features: [] })
    );

  const partners = stationsCollection.features
    .reduce((acc, feature) => {
      if (acc.includes(feature.properties.partner)) {
        return acc;
      }
      acc.push(feature.properties.partner);
      return acc;
    }, []);

  await mapLoaded;

  for (const partner of partners) {
    const marker = await createPartnerMarker(partner);
    map.loadImage(
      marker,
      (error, image) => {
        if (error) throw error;
        map.addImage(partner + '_image', image);
      }
    );
  }

  map.addSource('stations', {
    type: 'geojson',
    data: stationsCollection,
    cluster: true,
    clusterMaxZoom: clusterZoomLevel,
    clusterRadius: 50
  });
  map.addLayer({
    id: 'stations_clustered',
    type: 'circle',
    source: 'stations',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': '#fedf32',
      'circle-radius': ['step', ['get', 'point_count'], 30, 100, 30, 200, 30, 300, 30, 750, 30]
    }
  });
  map.addLayer({
    id: 'stations_marker',
    type: 'symbol',
    source: 'stations',
    filter: ['!', ['has', 'point_count']],
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-anchor': 'bottom',
      'icon-allow-overlap': true
    }
  });
  map.addLayer({
    id: 'stations_count',
    type: 'symbol',
    source: 'stations',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['get', 'point_count_abbreviated'],
      'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
      'text-size': 18
    },
    paint: { 'text-color': '#ED1C24' }
  });
  map.on('click', 'stations_marker', (e) => {
    console.log(e.features[0]);
    const { geometry, properties } = e.features[0];
    const { name, partner, street, city, zip } = properties;
    const coordinates = geometry.coordinates.slice();
    const content = `
    <div class="custom-content">
      <img src="https://raw.githubusercontent.com/Booster2ooo/dump/main/${partner}.${getLogoFileExtension(partner)}" />
      <div class="info">
        <h3>${name.toUpperCase()}</h3>
        <address>
          <p><a target="_blank" href="geo:${coordinates[1]},${coordinates[0]}">
            ${toHumanCase(street + ', ')}<br/>
            ${toHumanCase(zip + ' - ' + city)}
          </a></p>
          <p>${(haversine({lat: center[1], lng: center[0]}, {lat: coordinates[1], lng: coordinates[0]}) / 1000).toFixed(2)}km à vol d'oiseau</p>
        </address>
      </div>
    </div>
    `;

    // Ensure that if the map is zoomed out such that multiple
    // copies of the feature are visible, the popup appears
    // over the copy being pointed to.
    while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
      coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
    }

    new mapboxgl.Popup()
      .setLngLat(coordinates)
      .setHTML(content)
      .addTo(map);
  });
  map.on('mouseenter', 'stations_marker', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'stations_marker', () => {
    map.getCanvas().style.cursor = '';
  });
})();
