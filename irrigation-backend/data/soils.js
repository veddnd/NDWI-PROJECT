const soils = {

  sand: {
    fieldCapacity: 0.12,     // (0.07 – 0.17)
    wiltingPoint: 0.045      // (0.02 – 0.07)
  },

  loamy_sand: {
    fieldCapacity: 0.15,     // (0.11 – 0.19)
    wiltingPoint: 0.065      // (0.03 – 0.10)
  },

  sandy_loam: {
    fieldCapacity: 0.23,     // (0.18 – 0.28)
    wiltingPoint: 0.11       // (0.06 – 0.16)
  },

  loam: {
    fieldCapacity: 0.25,     // (0.20 – 0.30)
    wiltingPoint: 0.12       // (0.07 – 0.17)
  },

  silt_loam: {
    fieldCapacity: 0.29,     // (0.22 – 0.36)
    wiltingPoint: 0.15       // (0.09 – 0.21)
  },

  silt: {
    fieldCapacity: 0.32,     // (0.28 – 0.36)
    wiltingPoint: 0.17       // (0.12 – 0.22)
  },

  silt_clay_loam: {
    fieldCapacity: 0.34,     // (0.30 – 0.37)
    wiltingPoint: 0.20       // (0.17 – 0.24)
  },

  silty_clay: {
    fieldCapacity: 0.36,     // (0.30 – 0.42)
    wiltingPoint: 0.23       // (0.17 – 0.29)
  },

  clay: {
    fieldCapacity: 0.36,     // (0.32 – 0.40)
    wiltingPoint: 0.22       // (0.20 – 0.24)
  }

};

module.exports = soils;