const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crops = require("./data/crops");
const soils = require("./data/soils");
const { ee, initializeEarthEngine } = require("./gee");

const app = express();

app.use(cors());
app.use(express.json());

initializeEarthEngine()
  .then(() => {
    app.listen(5000, () => {
      console.log("Server running on port 5000");
    });
  })
  .catch((err) => {
    console.error("GEE Initialization failed", err);
  });

/* ----------------------------
   Wheat Growth Stage Functions
---------------------------- */

// function getWheatKc(days) {
//   if (days <= 20) return 0.3;
//   if (days <= 50) return 0.75;
//   if (days <= 90) return 1.15;
//   if (days <= 120) return 0.4;
//   return 0;
// }

// function getWheatRootDepth(days) {
//   if (days <= 20) return 0.3;
//   if (days <= 50) return 0.6;
//   if (days <= 120) return 1.2;
//   return 0;
// }

function calculateDAS(sowingDate) {
  const sowDate = new Date(sowingDate);
  const today = new Date();
  const diff = today - sowDate;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function getKc(crop, das) {
  const duration = crop.duration;

  if (das <= duration * 0.2) return crop.kc.initial;
  if (das <= duration * 0.7) return crop.kc.mid;
  return crop.kc.end;
}

function getRootDepth(crop, das) {
  const zr = (crop.rootDepthMax * das) / crop.duration;
  return Math.min(zr, crop.rootDepthMax);
}

/* ----------------------------
   Fetch ETo from NASA
---------------------------- */

async function fetchETO(lat, lon) {
  const today = new Date();
  today.setDate(today.getDate() - 2);

  const endDate = today.toISOString().slice(0, 10).replace(/-/g, "");

  const start = new Date(today);
  start.setDate(start.getDate() - 7);

  const startDate = start.toISOString().slice(0, 10).replace(/-/g, "");

  const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=EVPTRNS&community=AG&longitude=${lon}&latitude=${lat}&start=${startDate}&end=${endDate}&format=JSON`;

  const response = await axios.get(url);

  const data = response.data.properties.parameter.EVPTRNS;

  const dates = Object.keys(data).sort().reverse();

  let eto = null;

  for (let date of dates) {
    if (data[date] !== -999 && data[date] !== undefined) {
      eto = data[date];
      break;
    }
  }

  if (eto === null) {
    throw new Error("No valid ETo data found");
  }

  return eto;
}

/* ----------------------------
   NDWI Tile Map
---------------------------- */

app.post("/ndwi-map", async (req, res) => {
  try {

    const { polygon } = req.body;

    if (!polygon || polygon.length < 3) {
      return res.status(400).json({ error: "Invalid polygon" });
    }

    const geometry = ee.Geometry.Polygon([polygon]);

    const image = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
      .filterBounds(geometry)
      .filterDate(
        ee.Date(Date.now()).advance(-15, "day"),
        ee.Date(Date.now())
      )
      .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
      .sort("system:time_start", false)
      .first();

    const ndwi = image
      .normalizedDifference(["B3", "B8"])
      .rename("NDWI")
      .clip(geometry);

    const visParams = {
      min: -0.5,
      max: 0.5,
      palette: [
        "brown",
        "yellow",
        "lightblue",
        "blue"
      ]
    };

    const mapId = ndwi.getMap(visParams);

    res.json({
      tileUrl: mapId.urlFormat
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "NDWI map error" });
  }
});

/* ----------------------------
   NDWI Mean Value
---------------------------- */

app.post("/ndwi", async (req, res) => {
  try {

    const { polygon } = req.body;

    if (!polygon || polygon.length < 3) {
      return res.status(400).json({ error: "Invalid polygon" });
    }

    const geometry = ee.Geometry.Polygon([polygon]);

    const image = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
      .filterBounds(geometry)
      .filterDate("2024-01-01", "2024-12-31")
      .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
      .sort("system:time_start", false)
      .first();

    const ndwi = image
      .normalizedDifference(["B3", "B8"])
      .rename("NDWI")
      .clip(geometry);

    const stats = ndwi.reduceRegion({
      reducer: ee.Reducer.mean(),
      geometry: geometry,
      scale: 10,
      maxPixels: 1e9
    });

    stats.get("NDWI").evaluate((result) => {

      if (result === null) {
        return res.json({ message: "No image found" });
      }

      res.json({
        meanNDWI: result
      });

  });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "NDWI calculation error" });
  }
});



app.post("/ndwi-point", async (req, res) => {
    try {
        const { lat, lon } = req.body;

        const point = ee.Geometry.Point([lon, lat]);

        const image = ee.ImageCollection("COPERNICUS/S2_SR")
            .filterBounds(point)
            .filterDate(ee.Date(Date.now()).advance(-15, 'day'), ee.Date(Date.now()))
            .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
            .sort("system:time_start", false)
            .first();

        const ndwi = image.normalizedDifference(["B3", "B8"]);

        const value = ndwi.reduceRegion({
            reducer: ee.Reducer.first(),
            geometry: point,
            scale: 10
        });

        value.get("nd").evaluate((result) => {

            if (result === null) {
                return res.json({ ndwi: null });
            }

            res.json({ ndwi: result });

        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Point NDWI error" });
    }
});


// // -----------------------------
// // NDWI SEASONAL ANALYSIS
// // -----------------------------

// async function getNDWISeasonal(geometry, startDate, endDate) {

//     const image = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
//         .filterBounds(geometry)
//         .filterDate(startDate, endDate)
//         .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
//         .median();   // IMPORTANT

//     const ndwi = image.normalizedDifference(["B3", "B8"]);

//     const stats = ndwi.reduceRegion({
//         reducer: ee.Reducer.mean(),
//         geometry: geometry,
//         scale: 10,
//         maxPixels: 1e9
//     });

//     return new Promise((resolve) => {
//         stats.get("nd").evaluate((val) => {
//             resolve(val);
//         });
//     });
// }


// // -----------------------------
// // NEW ROUTE (SAFE ADD)
// // -----------------------------
// app.post("/ndwi-analysis", async (req, res) => {

//     try {

//         const { polygon } = req.body;

//         if (!polygon || polygon.length < 3) {
//             return res.status(400).json({ error: "Invalid polygon" });
//         }

//         const geometry = ee.Geometry.Polygon([polygon]);

//         const periods = {
//             yearly: ["2024-01-01", "2024-12-31"],
//             summer: ["2024-03-01", "2024-06-30"],
//             monsoon: ["2024-07-01", "2024-10-31"],
//             winter: ["2024-11-01", "2025-02-28"]
//         };

//         const result = {};

//         for (const [season, dates] of Object.entries(periods)) {
//             result[season] = await getNDWISeasonal(
//                 geometry,
//                 dates[0],
//                 dates[1]
//             );
//         }

//         res.json(result);

//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ error: "NDWI analysis failed" });
//     }
// });

/* ----------------------------
   Irrigation Calculation
---------------------------- */


// app.post("/calculate", async (req, res) => {

//   try {

//     const {
//       cropType,
//       soilType,
//       sowingDate,
//       latitude,
//       longitude,
//       ndwi   // ✅ receive NDWI from frontend
//     } = req.body;

//     const crop = crops[cropType];
//     const soil = soils[soilType];

//     if (!crop || !soil) {
//       return res.status(400).json({ error: "Invalid crop or soil type" });
//     }

//     // -----------------------------
//     // 1. ETo
//     // -----------------------------
//     const eto = await fetchETO(latitude, longitude);

//     // -----------------------------
//     // 2. DAS
//     // -----------------------------
//     const das = calculateDAS(sowingDate);

//     // -----------------------------
//     // 3. Crop Parameters
//     // -----------------------------
//     const kc = getWheatKc(das);
//     const zrMax = getWheatRootDepth(das);

//     const D_total = 120; // total crop duration (days)

//     // ✅ dynamic root depth
//     const zr = zrMax * (das / D_total);

//     if (kc === 0 || zr <= 0) {
//       return res.json({
//         message: "Crop cycle completed",
//         irrigationRequired: false
//       });
//     }
//     // -----------------------------
//     // 4. ETc
//     // -----------------------------
//     const etc = kc * eto;
//     // -----------------------------
//     // 5. TAW
//     // -----------------------------
//     const taw =
//       1000 * (soil.fieldCapacity - soil.wiltingPoint) * zr;

//     // -----------------------------
//     // 6. RAW
//     // -----------------------------
//     const raw = crop.depletionFraction * taw;

//     // -----------------------------
//     // 7. NDWI → Available Water
//     // -----------------------------

//     // normalize NDWI (-1 → +1) → (0 → 1)
//     const normalizedNDWI = (ndwi + 1) / 2;

//     const AW_current = normalizedNDWI * taw;

//     // -----------------------------
//     // 8. Depletion
//     // -----------------------------
//     const Dr = taw - AW_current;

//     // -----------------------------
//     // 9. Irrigation Decision
//     // -----------------------------
//     const irrigationRequired = Dr >= raw;

//     const irrigationDepth = irrigationRequired ? Dr : 0;

//     const irrigationInterval = etc > 0 ? raw / etc : 0;

//     // -----------------------------
//     // RESPONSE
//     // -----------------------------
//     res.json({
//       eto,
//       daysAfterSowing: das,
//       kc,
//       zr,
//       etc,
//       TAW: taw,
//       RAW: raw,
//       NDWI: ndwi,
//       normalizedNDWI,
//       AW_current,
//       depletion: Dr,
//       irrigationRequired,
//       irrigationDepth,
//       irrigationInterval
//     });

//   } catch (error) {

//     console.error(error);

//     res.status(500).json({
//       error: "Calculation error"
//     });

//   }

// });



app.post("/calculate", async (req, res) => {

  try {

    const {
      cropType,
      soilType,
      sowingDate,
      latitude,
      longitude,
      ndwi
    } = req.body;

    const crop = crops[cropType];
    const soil = soils[soilType];

    if (!crop || !soil) {
      return res.status(400).json({ error: "Invalid crop or soil type" });
    }

    // -----------------------------
    // 1. ETo
    // -----------------------------
    const eto = await fetchETO(latitude, longitude);

    // -----------------------------
    // 2. DAS
    // -----------------------------
    const das = calculateDAS(sowingDate);

    // -----------------------------
    // 3. Dynamic Crop Parameters
    // -----------------------------
    const kc = getKc(crop, das);
    const zr = getRootDepth(crop, das);

    if (kc === 0 || zr <= 0) {
      return res.json({
        message: "Crop cycle completed",
        irrigationRequired: false
      });
    }

    // -----------------------------
    // 4. ETc
    // -----------------------------
    const etc = kc * eto;

    // -----------------------------
    // 5. TAW
    // -----------------------------
    const taw =
      1000 * (soil.fieldCapacity - soil.wiltingPoint) * zr;

    // -----------------------------
    // 6. RAW
    // -----------------------------
    const raw = crop.depletionFraction * taw;

    // -----------------------------
    // 7. NDWI → Available Water
    // -----------------------------
    const normalizedNDWI = (ndwi + 1) / 2;
    const AW_current = normalizedNDWI * taw;

    // -----------------------------
    // 8. Depletion
    // -----------------------------
    const Dr = taw - AW_current;

    // -----------------------------
    // 9. Irrigation Decision
    // -----------------------------
    const irrigationRequired = Dr >= raw;
    const irrigationDepth = irrigationRequired ? Dr : 0;
    const irrigationInterval = etc > 0 ? raw / etc : 0;

    // -----------------------------
    // RESPONSE
    // -----------------------------
    res.json({
      eto,
      daysAfterSowing: das,
      kc,
      rootDepth: zr,
      etc,
      TAW: taw,
      RAW: raw,
      NDWI: ndwi,
      normalizedNDWI,
      AW_current,
      depletion: Dr,
      irrigationRequired,
      irrigationDepth,
      irrigationInterval
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      error: "Calculation error"
    });

  }

});