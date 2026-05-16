const crops = {
  wheat: {
    duration: 120,
    kc: { initial: 0.35, mid: 1.15, end: 0.30 },
    rootDepthMax: 1.2,
    depletionFraction: 0.55
  },

  maize: {
    duration: 110,
    kc: { initial: 0.30, mid: 1.20, end: 0.50 },
    rootDepthMax: 1.5,
    depletionFraction: 0.50
  },

  rice: {
    duration: 130,
    kc: { initial: 1.05, mid: 1.20, end: 0.90 },
    rootDepthMax: 0.6,
    depletionFraction: 0.20
  },

  cotton: {
    duration: 160,
    kc: { initial: 0.35, mid: 1.20, end: 0.60 },
    rootDepthMax: 1.8,
    depletionFraction: 0.65
  },

  sugarcane: {
    duration: 300,
    kc: { initial: 0.40, mid: 1.25, end: 0.75 },
    rootDepthMax: 2.0,
    depletionFraction: 0.65
  }

};

module.exports = crops;