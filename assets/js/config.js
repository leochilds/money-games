export const defaultProperties = [
  {
    id: "studio",
    name: "Downtown Micro Loft",
    description: "Compact living in the heart of the city, perfect for commuters.",
    propertyType: "apartment",
    bedrooms: 1,
    bathrooms: 1,
    features: ["City View", "Shared Rooftop", "In-Unit Laundry"],
    locationDescriptor:
      "Transit-rich downtown block with nightlife and offices steps away.",
    demandScore: 9,
    location: {
      proximity: 0.95,
      schoolRating: 5,
      crimeScore: 4,
    },
    maintenanceLevel: "medium",
  },
  {
    id: "townhouse",
    name: "Historic Row Townhouse",
    description: "Updated interiors with charming brick facade and private entry.",
    propertyType: "townhouse",
    bedrooms: 3,
    bathrooms: 2,
    features: ["Private Patio", "Finished Basement", "Smart Thermostat"],
    locationDescriptor:
      "Tree-lined heritage street close to cafes and boutique shops.",
    demandScore: 7,
    location: {
      proximity: 0.75,
      schoolRating: 7,
      crimeScore: 3,
    },
    maintenanceLevel: "medium",
  },
  {
    id: "suburb",
    name: "Suburban Cul-de-sac Home",
    description: "Spacious single-family house in a top-rated school district.",
    propertyType: "single_family",
    bedrooms: 4,
    bathrooms: 3,
    features: ["Two-Car Garage", "Backyard Deck", "Home Office"],
    locationDescriptor:
      "Family-friendly cul-de-sac with parks and community amenities.",
    demandScore: 6,
    location: {
      proximity: 0.6,
      schoolRating: 9,
      crimeScore: 2,
    },
    maintenanceLevel: "low",
  },
  {
    id: "penthouse",
    name: "Skyline Signature Penthouse",
    description: "Expansive luxury residence with concierge and spa access.",
    propertyType: "luxury",
    bedrooms: 3,
    bathrooms: 3,
    features: [
      "Private Elevator",
      "Wraparound Terrace",
      "Floor-to-Ceiling Windows",
      "Concierge Service",
    ],
    locationDescriptor:
      "Top-floor suite in a premier downtown landmark tower.",
    demandScore: 10,
    location: {
      proximity: 0.98,
      schoolRating: 8,
      crimeScore: 2,
    },
    maintenanceLevel: "high",
  },
];

export const propertyTypeMultipliers = {
  apartment: 0.9,
  townhouse: 1.05,
  single_family: 1.15,
  luxury: 1.35,
};

export const maintenanceLevelMultipliers = {
  low: 1.1,
  medium: 1,
  high: 0.88,
};

export const FINANCE_CONFIG = {
  depositOptions: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5],
  termOptions: [2, 5, 10, 25],
  fixedPeriodOptions: [2, 5, 10],
  defaultDepositRatio: 0.2,
  defaultTermYears: 25,
  defaultFixedPeriodYears: 5,
  minimumRate: 0.025,
  maximumRate: 0.085,
  centralBank: {
    initialRate: 0.0375,
    minimumRate: 0.005,
    adjustmentIntervalDays: 30,
    maxStepPerAdjustment: 0.0015,
  },
  rateModel: {
    variableMarginBase: 0.015,
    variableMarginDepositFactor: 0.08,
    minimumMargin: 0.004,
    fixedRateIncentives: {
      2: -0.0035,
      5: -0.0025,
      10: -0.0015,
      25: 0,
    },
  },
};

export const featureAddOns = {
  "City View": 60,
  "Shared Rooftop": 40,
  "In-Unit Laundry": 55,
  "Private Patio": 65,
  "Finished Basement": 75,
  "Smart Thermostat": 30,
  "Two-Car Garage": 90,
  "Backyard Deck": 70,
  "Home Office": 50,
  "Private Elevator": 120,
  "Wraparound Terrace": 110,
  "Floor-to-Ceiling Windows": 85,
  "Concierge Service": 95,
};

export const proceduralPropertyArchetypes = [
  {
    key: "urban_loft",
    propertyType: "apartment",
    names: [
      "Canal View Loft",
      "Warehouse Loft Residence",
      "Transit Hub Micro Suite",
      "Riverside Skyline Flat",
    ],
    descriptions: [
      "Open-concept loft with exposed beams and industrial chic finishes.",
      "Bright studio with soaring ceilings and premium smart-home upgrades.",
      "Compact layout designed for efficient city living and quick commutes.",
    ],
    locationDescriptors: [
      "Converted warehouse district steps from artisanal cafes.",
      "Walkable neighbourhood beside major transit lines.",
      "Revitalised riverfront promenade with co-working hubs.",
    ],
    bedroomsRange: [1, 2],
    bathroomsRange: [1, 2],
    demandRange: [6, 9],
    proximityRange: [0.7, 0.96],
    schoolRange: [4, 7],
    crimeRange: [3, 5],
    maintenanceLevels: ["low", "medium"],
    featuresPool: [
      "City View",
      "Shared Rooftop",
      "In-Unit Laundry",
      "Smart Thermostat",
      "Home Office",
    ],
  },
  {
    key: "family_suburb",
    propertyType: "single_family",
    names: [
      "Meadowridge Colonial",
      "Lakeside Craftsman Retreat",
      "Willow Grove Residence",
      "Sunset Ridge Family Estate",
    ],
    descriptions: [
      "Spacious home with flexible floor plan tailored for growing families.",
      "Expansive backyard and updated chef's kitchen with breakfast nook.",
      "Light-filled interiors with formal dining and bonus recreation room.",
    ],
    locationDescriptors: [
      "Quiet cul-de-sac with playgrounds and community pool.",
      "Top-rated school catchment with weekly farmer's market.",
      "Lake-adjacent suburb boasting hiking paths and tennis courts.",
    ],
    bedroomsRange: [3, 5],
    bathroomsRange: [2, 4],
    demandRange: [5, 8],
    proximityRange: [0.5, 0.75],
    schoolRange: [7, 10],
    crimeRange: [1, 3],
    maintenanceLevels: ["low", "medium"],
    featuresPool: [
      "Two-Car Garage",
      "Backyard Deck",
      "Home Office",
      "Finished Basement",
      "Smart Thermostat",
    ],
  },
  {
    key: "luxury_highrise",
    propertyType: "luxury",
    names: [
      "Aurora Sky Penthouse",
      "Summit View Grand Suite",
      "Crown Heights Signature Residence",
      "Helios Tower Panorama",
    ],
    descriptions: [
      "Designer-curated interiors with private concierge and spa privileges.",
      "Panoramic skyline vistas paired with bespoke finishes throughout.",
      "Ultra-premium sky home with wine cellar and home automation package.",
    ],
    locationDescriptors: [
      "Iconic tower above luxury retail promenade and fine dining.",
      "Flagship high-rise neighbouring cultural and financial districts.",
      "Prestigious address with private club access and valet services.",
    ],
    bedroomsRange: [2, 4],
    bathroomsRange: [2, 4],
    demandRange: [8, 10],
    proximityRange: [0.9, 0.99],
    schoolRange: [6, 9],
    crimeRange: [1, 3],
    maintenanceLevels: ["medium", "high"],
    featuresPool: [
      "Private Elevator",
      "Wraparound Terrace",
      "Floor-to-Ceiling Windows",
      "Concierge Service",
      "Smart Thermostat",
    ],
  },
  {
    key: "urban_townhome",
    propertyType: "townhouse",
    names: [
      "Cobblestone Row Townhome",
      "Maple Terrace Brownstone",
      "Gallery District Duplex",
      "Heritage Row Garden Home",
    ],
    descriptions: [
      "Updated interiors blend classic masonry with modern conveniences.",
      "Multi-level plan with flexible workspace and rooftop garden.",
      "Sun-drenched living areas with custom millwork and smart lighting.",
    ],
    locationDescriptors: [
      "Historic street close to bistros and boutique galleries.",
      "Transit-friendly district lined with artisan markets.",
      "Corner row with private courtyard and neighbourhood cafés.",
    ],
    bedroomsRange: [2, 4],
    bathroomsRange: [2, 3],
    demandRange: [6, 9],
    proximityRange: [0.65, 0.85],
    schoolRange: [6, 9],
    crimeRange: [2, 4],
    maintenanceLevels: ["medium"],
    featuresPool: [
      "Private Patio",
      "Finished Basement",
      "Smart Thermostat",
      "In-Unit Laundry",
      "Home Office",
    ],
  },
];

export const MARKET_CONFIG = {
  maxSize: 8,
  minSize: 4,
  generationInterval: 30,
  batchSize: 2,
  maxAge: 120,
};

export const propertyTypeLabels = {
  apartment: "Apartment",
  townhouse: "Townhouse",
  single_family: "Single-Family Home",
  luxury: "Luxury Residence",
};
