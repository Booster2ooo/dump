(async () => {
  const asFeature = station => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [parseFloat(station.lng), parseFloat(station.lat)]
    },
    properties: {
      name: `${station.partner} ${station.city.toLowerCase()}`,
      ...station
    }
  });

  const getExtension = (partner) => {
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

  const createPartnerLogo = async (partner) => {
    //const markerUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent('https://www.networkfleetapp.com/assets/images/yellow_marker2.svg')}`;
    //const logoUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.networkfleetapp.com/assets/images/${partner}_square.svg`)}`;
    //const markerUrl = 'https://raw.githubusercontent.com/Booster2ooo/dump/main/yellow_marker2.svg';
    const logoUrl = `https://raw.githubusercontent.com/Booster2ooo/dump/main/${partner}.${getExtension(partner)}`;
    //const svgMime = 'image/svg+xml';
    const canvas = document.createElement('canvas');
    canvas.width = 35;
    canvas.height = 48;
    const context = canvas.getContext("2d");
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
      return Promise.resolve()
        .then(() => {
          if (getExtension(partner) === 'svg') {
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
        .then(() => Promise.all([markerLoaded, logoLoaded]).then(() => canvas.toDataURL()));
    }
    catch (ex) {
      return Promise.reject(ex);
    }
  };

  mapboxgl.accessToken = 'pk.eyJ1IjoiYm9vc3RlcjJvb28iLCJhIjoiY2xoaXk0NGJsMGNpcTNsbnhxcXZqMTBjbiJ9.KNkQ27TkoAYTb3j3KBlTaQ';

  const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/greenpigsprl/cjq6ixeml987l2smmt7d5jb0f',
    center: [4.3053507, 50.8549541],
    zoom: 12
  });

  const mapLoaded = new Promise((resolve, reject) => map.on('load', resolve));

  const collections = await fetch("https://raw.githubusercontent.com/Booster2ooo/dump/main/stations.json")
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
        const feat = asFeature(station);
        acc[feat.properties.partner] = acc[feat.properties.partner] || {
          type: 'FeatureCollection',
          features: []
        };
        acc[feat.properties.partner].features.push(feat);
        return acc;
      }, {})
    );

  await mapLoaded;

  for (const [partner, data] of Object.entries(collections)) {
    const logo = await createPartnerLogo(partner);
    map.loadImage(
      logo,
      (error, image) => {
        if (error) throw error;
        map.addImage(partner + '_image', image);
        map.addSource(partner + '_source', {
          type: 'geojson',
          data
        });
        map.addLayer({
          id: partner + '_layer',
          type: 'symbol',
          source: partner + '_source',
          layout: {
            'icon-image': partner + '_image',
            'icon-size': 1
          }
        });
      }
    );
  }
})();

