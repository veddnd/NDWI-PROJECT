const ee = require("@google/earthengine");
const privateKey = require("./gee-key.json");

function initializeEarthEngine() {
  return new Promise((resolve, reject) => {

    ee.data.authenticateViaPrivateKey(
      privateKey,
      () => {

        ee.initialize(
          null,
          null,
          () => {
            console.log("Earth Engine initialized successfully");
            resolve();
          },
          (err) => {
            console.error("Earth Engine initialization error:", err);
            reject(err);
          }
        );

      },
      (err) => {
        console.error("Earth Engine authentication failed:", err);
        reject(err);
      }
    );

  });
}

module.exports = { ee, initializeEarthEngine };