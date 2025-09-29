(() => {
  const defaultProperties = [
    {
      id: "studio",
      name: "Downtown Micro Loft",
      description: "Compact living in the heart of the city, perfect for commuters.",
      propertyType: "apartment",
      bedrooms: 1,
      bathrooms: 1,
      features: ["City View", "Shared Rooftop", "In-Unit Laundry"],
      locationDescriptor: "Transit-rich downtown block with nightlife and offices steps away.",
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
      locationDescriptor: "Tree-lined heritage street close to cafes and boutique shops.",
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
      locationDescriptor: "Family-friendly cul-de-sac with parks and community amenities.",
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
      locationDescriptor: "Top-floor suite in a premier downtown landmark tower.",
      demandScore: 10,
      location: {
        proximity: 0.98,
        schoolRating: 8,
        crimeScore: 2,
      },
      maintenanceLevel: "high",
    },
  ];

  const propertyTypeMultipliers = {
    apartment: 0.9,
    townhouse: 1.05,
    single_family: 1.15,
    luxury: 1.35,
  };

  const maintenanceLevelMultipliers = {
    low: 1.1,
    medium: 1,
    high: 0.88,
  };

  const FINANCE_CONFIG = {
    depositOptions: [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5],
    termOptions: [2, 5, 10, 25],
    defaultDepositRatio: 0.2,
    defaultTermYears: 25,
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

  const featureAddOns = {
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

  const proceduralPropertyArchetypes = [
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

  const MARKET_CONFIG = {
    maxSize: 8,
    minSize: 4,
    generationInterval: 30,
    batchSize: 2,
    maxAge: 120,
  };

  function calculatePropertyValue(property) {
    const weights = {
      base: 220,
      bedrooms: 95,
      bathrooms: 80,
      proximity: 160,
      schoolRating: 22,
      safety: 18,
    };

    const { bedrooms = 0, bathrooms = 0, propertyType, features = [], location = {}, maintenanceLevel } = property;

    const proximityScore = (location.proximity ?? 0) * weights.proximity;
    const schoolScore = (location.schoolRating ?? 0) * weights.schoolRating;
    const safetyScore = (10 - (location.crimeScore ?? 5)) * weights.safety;

    const featureScore = features.reduce(
      (total, feature) => total + (featureAddOns[feature] ?? 35),
      0
    );

    const baseValue =
      weights.base +
      bedrooms * weights.bedrooms +
      bathrooms * weights.bathrooms +
      proximityScore +
      schoolScore +
      safetyScore +
      featureScore;

    const typeMultiplier = propertyTypeMultipliers[propertyType] ?? 1;
    const maintenanceMultiplier = maintenanceLevelMultipliers[maintenanceLevel] ?? 1;

    return Math.round(baseValue * typeMultiplier * maintenanceMultiplier);
  }

  const state = {
    balance: 0,
    day: 1,
    market: [],
    portfolio: [],
    history: [],
    centralBankRate: FINANCE_CONFIG.centralBank.initialRate,
    lastCentralBankAdjustmentDay: 0,
    tickLength: 1000,
    timerId: null,
    lastRentCollectionDay: 0,
    lastMarketGenerationDay: 0,
  };

  const elements = {};

  const financeState = {
    propertyId: null,
    depositRatio: FINANCE_CONFIG.defaultDepositRatio,
    termYears: FINANCE_CONFIG.defaultTermYears,
    annualInterestRate: FINANCE_CONFIG.centralBank.initialRate,
    rateProfile: null,
  };

  let financeModalInstance = null;

  let generatedIdCounter = 1;

  function getRandomInt(min, max) {
    const lower = Math.ceil(min);
    const upper = Math.floor(max);
    return Math.floor(Math.random() * (upper - lower + 1)) + lower;
  }

  function getRandomNumber(min, max, precision = 2) {
    const value = Math.random() * (max - min) + min;
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  }

  function pickRandom(items) {
    return items[getRandomInt(0, items.length - 1)];
  }

  function selectFeatureSubset(featuresPool) {
    if (!Array.isArray(featuresPool) || featuresPool.length === 0) {
      return [];
    }
    const maxSelectable = Math.min(featuresPool.length, 4);
    const minSelectable = Math.min(2, maxSelectable);
    const subsetSize = getRandomInt(minSelectable, maxSelectable);
    const poolCopy = [...featuresPool];
    const selected = [];
    while (selected.length < subsetSize && poolCopy.length > 0) {
      const index = getRandomInt(0, poolCopy.length - 1);
      selected.push(poolCopy.splice(index, 1)[0]);
    }
    return selected;
  }

  function generateUniquePropertyId() {
    const usedIds = new Set([
      ...state.market.map((property) => property.id),
      ...state.portfolio.map((property) => property.id),
    ]);

    let nextId = `generated-${generatedIdCounter}`;
    while (usedIds.has(nextId)) {
      generatedIdCounter += 1;
      nextId = `generated-${generatedIdCounter}`;
    }

    generatedIdCounter += 1;
    return nextId;
  }

  function createProceduralProperty() {
    const archetype = pickRandom(proceduralPropertyArchetypes);
    const bedrooms = getRandomInt(archetype.bedroomsRange[0], archetype.bedroomsRange[1]);
    const bathrooms = getRandomInt(archetype.bathroomsRange[0], archetype.bathroomsRange[1]);
    const demandScore = getRandomInt(archetype.demandRange[0], archetype.demandRange[1]);
    const location = {
      proximity: getRandomNumber(archetype.proximityRange[0], archetype.proximityRange[1], 2),
      schoolRating: getRandomInt(archetype.schoolRange[0], archetype.schoolRange[1]),
      crimeScore: getRandomInt(archetype.crimeRange[0], archetype.crimeRange[1]),
    };

    const baseProperty = {
      id: generateUniquePropertyId(),
      name: pickRandom(archetype.names),
      description: pickRandom(archetype.descriptions),
      propertyType: archetype.propertyType,
      bedrooms,
      bathrooms,
      features: selectFeatureSubset(archetype.featuresPool),
      locationDescriptor: pickRandom(archetype.locationDescriptors),
      demandScore,
      location,
      maintenanceLevel: pickRandom(archetype.maintenanceLevels),
      marketAge: 0,
      introducedOnDay: state.day,
    };

    const cost = calculatePropertyValue(baseProperty);
    const annualYield = mapDemandToAnnualYield(baseProperty.demandScore);
    const monthlyRent = Math.round((cost * annualYield) / 12);

    return {
      ...baseProperty,
      cost,
      annualYield,
      monthlyRent,
    };
  }

  function generateMarketListings(count = 1, { updateUI: shouldUpdateUI = true } = {}) {
    if (state.market.length >= MARKET_CONFIG.maxSize) {
      return [];
    }

    const listingsToGenerate = Math.min(
      count,
      Math.max(MARKET_CONFIG.maxSize - state.market.length, 0)
    );

    const newListings = [];
    for (let index = 0; index < listingsToGenerate; index += 1) {
      const property = createProceduralProperty();
      state.market.push(property);
      newListings.push(property);
    }

    if (newListings.length > 0 && shouldUpdateUI) {
      updateUI();
    }

    return newListings;
  }

  function progressMarketListings() {
    let marketChanged = false;
    const retainedMarket = [];
    const expiredListings = [];

    state.market.forEach((property) => {
      const currentAge = (property.marketAge ?? 0) + 1;
      if (currentAge > MARKET_CONFIG.maxAge) {
        expiredListings.push(property);
        marketChanged = true;
        return;
      }
      retainedMarket.push({ ...property, marketAge: currentAge });
    });

    if (expiredListings.length > 0) {
      const removedNames = expiredListings.map((property) => property.name).join(", ");
      addHistoryEntry(
        expiredListings.length > 1
          ? `Listings expired and left the market: ${removedNames}.`
          : `Listing expired and left the market: ${removedNames}.`
      );
    }

    state.market = retainedMarket;

    const daysSinceGeneration = state.day - state.lastMarketGenerationDay;
    const spaceAvailable = Math.max(MARKET_CONFIG.maxSize - state.market.length, 0);
    const readyForNewListings = daysSinceGeneration >= MARKET_CONFIG.generationInterval;

    let requiredListings = 0;
    if (readyForNewListings && spaceAvailable > 0) {
      const minimumShortfall = Math.max(MARKET_CONFIG.minSize - state.market.length, 0);
      if (minimumShortfall > 0) {
        requiredListings = minimumShortfall;
      } else {
        requiredListings = getRandomInt(1, MARKET_CONFIG.batchSize);
      }
    }

    const listingsNeeded = Math.min(requiredListings, spaceAvailable);
    let newListings = [];
    if (listingsNeeded > 0 && spaceAvailable > 0) {
      newListings = generateMarketListings(listingsNeeded, { updateUI: false });
      if (newListings.length > 0) {
        const newNames = newListings.map((property) => property.name).join(", ");
        addHistoryEntry(
          newListings.length > 1
            ? `New listings have entered the market: ${newNames}.`
            : `New listing has entered the market: ${newNames}.`
        );
        state.lastMarketGenerationDay = state.day;
        marketChanged = true;
      }
    }

    if (marketChanged) {
      updateUI();
    }

    return marketChanged;
  }

  function cacheElements() {
    elements.balance = document.getElementById("playerBalance");
    elements.day = document.getElementById("currentDay");
    elements.centralBankRate = document.getElementById("centralBankRate");
    elements.rentPerMonth = document.getElementById("rentPerMonth");
    elements.propertyList = document.getElementById("propertyList");
    elements.incomeStatus = document.getElementById("incomeStatus");
    elements.historyLog = document.getElementById("historyLog");
    elements.resetButton = document.getElementById("resetButton");
    elements.speedControl = document.getElementById("speedControl");
    elements.financeModal = document.getElementById("financePropertyModal");
    elements.financePropertyName = document.getElementById("financePropertyName");
    elements.financePropertySummary = document.getElementById("financePropertySummary");
    elements.financeDepositOptions = document.getElementById("financeDepositOptions");
    elements.financeTermOptions = document.getElementById("financeTermOptions");
    elements.financePaymentPreview = document.getElementById("financePaymentPreview");
    elements.financeAffordabilityNote = document.getElementById("financeAffordabilityNote");
    elements.confirmFinanceButton = document.getElementById("confirmFinanceButton");
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  }

  const propertyTypeLabels = {
    apartment: "Apartment",
    townhouse: "Townhouse",
    single_family: "Single-Family Home",
    luxury: "Luxury Residence",
  };

  function roundCurrency(amount) {
    return Math.round(amount * 100) / 100;
  }

  function roundRate(value) {
    return Math.round(value * 10000) / 10000;
  }

  function formatPropertyType(type) {
    return propertyTypeLabels[type] ?? type;
  }

  function formatPercentage(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }
    return `${Math.round(value * 100)}%`;
  }

  function formatInterestRate(value) {
    if (!Number.isFinite(value)) {
      return "-";
    }
    return `${(value * 100).toFixed(2)}%`;
  }

  function deriveMortgageRateProfile({ depositRatio, termYears, baseRate } = {}) {
    const { centralBank, rateModel, maximumRate, minimumRate } = FINANCE_CONFIG;
    const minDeposit = FINANCE_CONFIG.depositOptions[0];
    const maxDeposit = FINANCE_CONFIG.depositOptions[FINANCE_CONFIG.depositOptions.length - 1];
    const resolvedDepositRatio = Number.isFinite(depositRatio)
      ? Math.min(Math.max(depositRatio, minDeposit), maxDeposit)
      : FINANCE_CONFIG.defaultDepositRatio;
    const resolvedFixedYears = Number.isFinite(termYears)
      ? Math.max(Math.round(termYears), 1)
      : FINANCE_CONFIG.defaultTermYears;
    const resolvedBaseRate = Number.isFinite(baseRate)
      ? baseRate
      : state.centralBankRate ?? centralBank.initialRate;

    const depositAdjustment =
      (FINANCE_CONFIG.defaultDepositRatio - resolvedDepositRatio) * rateModel.variableMarginDepositFactor;
    const rawMargin = rateModel.variableMarginBase + depositAdjustment;
    const variableMargin = Math.max(rateModel.minimumMargin, roundRate(rawMargin));
    const fixedIncentive = rateModel.fixedRateIncentives[resolvedFixedYears] ?? 0;

    const provisionalFixed = roundRate(resolvedBaseRate + variableMargin + fixedIncentive);
    const fixedRate = roundRate(
      Math.max(
        resolvedBaseRate,
        Math.max(minimumRate ?? 0, Math.min(maximumRate, provisionalFixed))
      )
    );
    const reversionRate = roundRate(
      Math.max(
        resolvedBaseRate,
        Math.min(maximumRate, roundRate(resolvedBaseRate + variableMargin))
      )
    );

    return {
      baseRate: roundRate(resolvedBaseRate),
      fixedPeriodYears: resolvedFixedYears,
      fixedRate,
      variableRateMargin: roundRate(Math.max(0, reversionRate - resolvedBaseRate)),
      reversionRate,
    };
  }

  function calculateMortgageDeposit(cost, depositRatio = FINANCE_CONFIG.defaultDepositRatio) {
    if (!Number.isFinite(cost)) {
      return 0;
    }
    const ratio = Number.isFinite(depositRatio) ? depositRatio : FINANCE_CONFIG.defaultDepositRatio;
    return roundCurrency(cost * ratio);
  }

  function calculateMortgageMonthlyPayment(principal, annualInterestRate, termYears) {
    if (!Number.isFinite(principal) || principal <= 0) {
      return 0;
    }

    const termMonths = Math.round(termYears * 12);
    if (termMonths <= 0) {
      return principal;
    }

    const monthlyRate = annualInterestRate / 12;

    if (monthlyRate <= 0) {
      return Math.round((principal / termMonths) * 100) / 100;
    }

    const factor = (1 + monthlyRate) ** termMonths;
    const payment = (principal * monthlyRate * factor) / (factor - 1);
    return roundCurrency(payment);
  }

  function createMortgageForCost(
    cost,
    {
      depositRatio = FINANCE_CONFIG.defaultDepositRatio,
      termYears = FINANCE_CONFIG.defaultTermYears,
      annualInterestRate,
      rateProfile,
      baseRate,
      interestOnly = false,
    } = {}
  ) {
    const deposit = calculateMortgageDeposit(cost, depositRatio);
    const principal = Math.max(cost - deposit, 0);
    const termMonths = Math.round((Number.isFinite(termYears) ? termYears : FINANCE_CONFIG.defaultTermYears) * 12);
    const resolvedTermYears = termMonths / 12;
    const resolvedProfile = rateProfile ?? deriveMortgageRateProfile({
      depositRatio,
      termYears: resolvedTermYears,
      baseRate,
    });
    const fixedPeriodMonths = Math.max(
      Math.round((resolvedProfile.fixedPeriodYears ?? resolvedTermYears) * 12),
      0
    );
    const fixedRateOverride = Number.isFinite(annualInterestRate)
      ? roundRate(
          Math.max(
            resolvedProfile.baseRate,
            Math.min(FINANCE_CONFIG.maximumRate, annualInterestRate)
          )
        )
      : resolvedProfile.fixedRate;
    const rate = Math.max(resolvedProfile.baseRate, fixedRateOverride);
    const monthlyRate = rate / 12;
    let monthlyPayment;

    if (interestOnly) {
      monthlyPayment = roundCurrency(principal * monthlyRate);
    } else {
      monthlyPayment = calculateMortgageMonthlyPayment(
        principal,
        rate,
        resolvedTermYears
      );
    }

    return {
      deposit,
      principal,
      termYears: resolvedTermYears,
      termMonths,
      annualInterestRate: rate,
      monthlyInterestRate: monthlyRate,
      monthlyPayment,
      remainingBalance: principal,
      remainingTermMonths: termMonths,
      interestOnly: Boolean(interestOnly),
      depositRatio,
      baseRate: resolvedProfile.baseRate,
      fixedPeriodYears: resolvedProfile.fixedPeriodYears,
      fixedPeriodMonths,
      fixedRate: rate,
      variableRateMargin: resolvedProfile.variableRateMargin,
      reversionRate: resolvedProfile.reversionRate,
      variableRateActive: false,
      productKey: null,
      productLabel: "Custom mortgage",
    };
  }

  function resolveFixedPeriodMonths(mortgage) {
    if (!mortgage) {
      return 0;
    }
    if (Number.isFinite(mortgage.fixedPeriodMonths)) {
      return Math.max(Math.round(mortgage.fixedPeriodMonths), 0);
    }
    const fallbackYears = mortgage.fixedPeriodYears ?? mortgage.termYears ?? 0;
    const computed = Math.max(Math.round(fallbackYears * 12), 0);
    mortgage.fixedPeriodMonths = computed;
    return computed;
  }

  function calculateMortgageReversionRate(mortgage) {
    if (!mortgage) {
      return 0;
    }
    const explicit = Number.isFinite(mortgage.reversionRate)
      ? mortgage.reversionRate
      : null;
    const baseRateValue = Number.isFinite(mortgage.baseRate) ? mortgage.baseRate : 0;
    const margin = Number.isFinite(mortgage.variableRateMargin)
      ? mortgage.variableRateMargin
      : 0;
    const resolved = explicit ?? roundRate(baseRateValue + margin);
    if (!Number.isFinite(resolved) || resolved < 0) {
      return 0;
    }
    return resolved;
  }

  function activateMortgageVariablePhase(mortgage) {
    if (!mortgage || mortgage.variableRateActive || mortgage.remainingBalance <= 0.5) {
      return { activated: false };
    }

    const reversionRate = calculateMortgageReversionRate(mortgage);
    const margin = Number.isFinite(mortgage.variableRateMargin)
      ? mortgage.variableRateMargin
      : 0;
    const baseRateValue = Number.isFinite(mortgage.baseRate) ? mortgage.baseRate : reversionRate - margin;

    mortgage.variableRateActive = true;
    mortgage.annualInterestRate = reversionRate;
    mortgage.monthlyInterestRate = reversionRate / 12;
    mortgage.reversionRate = reversionRate;

    if (mortgage.interestOnly) {
      mortgage.monthlyPayment = roundCurrency(
        mortgage.remainingBalance * mortgage.monthlyInterestRate
      );
    } else {
      const remainingYears = Math.max(mortgage.remainingTermMonths, 0) / 12;
      if (remainingYears > 0 && mortgage.remainingBalance > 0.5) {
        mortgage.monthlyPayment = calculateMortgageMonthlyPayment(
          mortgage.remainingBalance,
          reversionRate,
          remainingYears
        );
      } else {
        mortgage.monthlyPayment = roundCurrency(mortgage.remainingBalance);
      }
    }

    return {
      activated: true,
      baseRate: baseRateValue,
      margin,
      reversionRate,
    };
  }

  function getNextMortgagePayment(mortgage) {
    if (!mortgage || mortgage.remainingTermMonths <= 0 || mortgage.remainingBalance <= 0) {
      return 0;
    }

    if (mortgage.interestOnly) {
      if (mortgage.remainingTermMonths > 0) {
        return roundCurrency(mortgage.remainingBalance * mortgage.monthlyInterestRate);
      }
      return roundCurrency(mortgage.remainingBalance);
    }

    const interestDue = mortgage.remainingBalance * mortgage.monthlyInterestRate;
    const scheduledPayment = roundCurrency(mortgage.monthlyPayment);
    const totalDue = mortgage.remainingBalance + interestDue;
    return Math.min(scheduledPayment, roundCurrency(totalDue));
  }

  function getMortgagePaymentBreakdown(mortgage) {
    const emptyBreakdown = {
      monthlyPayment: 0,
      interestComponent: 0,
      principalComponent: 0,
      principalRemaining: 0,
      fixedPeriod: {
        monthsRemaining: 0,
        paymentsRemaining: 0,
        totalInterestRemaining: 0,
        totalPrincipalScheduled: 0,
        totalPaymentsRemaining: 0,
        projectedBalanceAfter: 0,
      },
      variablePhase: {
        startsInMonths: 0,
        isActive: false,
        baseRate: mortgage?.baseRate ?? 0,
        margin: mortgage?.variableRateMargin ?? 0,
        reversionRate:
          mortgage?.reversionRate ??
          (mortgage?.baseRate ?? 0) + (mortgage?.variableRateMargin ?? 0),
        estimatedPayment: 0,
      },
      isInterestOnly: Boolean(mortgage?.interestOnly),
    };

    if (!mortgage || mortgage.remainingTermMonths <= 0 || mortgage.remainingBalance <= 0) {
      return emptyBreakdown;
    }

    const outstandingPrincipal = roundCurrency(mortgage.remainingBalance);
    const nextInterestDue = roundCurrency(outstandingPrincipal * mortgage.monthlyInterestRate);
    const scheduledPayment = roundCurrency(mortgage.monthlyPayment);
    const totalDueNext = roundCurrency(outstandingPrincipal + nextInterestDue);
    const monthlyPayment = mortgage.interestOnly
      ? nextInterestDue
      : Math.min(scheduledPayment, totalDueNext);
    const interestComponent = Math.min(nextInterestDue, monthlyPayment);
    const principalComponent = roundCurrency(Math.max(monthlyPayment - interestComponent, 0));
    const adjustedPrincipalComponent = Math.min(principalComponent, outstandingPrincipal);

    const remainingTermMonths = Math.max(mortgage.remainingTermMonths ?? 0, 0);
    const totalTermMonthsRaw = Number.isFinite(mortgage.termMonths)
      ? mortgage.termMonths
      : Math.round((mortgage.termYears ?? 0) * 12);
    const totalTermMonths = Math.max(Math.round(totalTermMonthsRaw ?? 0), remainingTermMonths);
    const fixedPeriodMonths = resolveFixedPeriodMonths(mortgage);
    const monthsElapsed = Math.max(totalTermMonths - remainingTermMonths, 0);
    const fixedMonthsRemaining = Math.max(fixedPeriodMonths - monthsElapsed, 0);
    const paymentsRemainingInFixed = Math.max(
      Math.min(remainingTermMonths, fixedMonthsRemaining),
      0
    );

    if (mortgage.interestOnly) {
      const fixedInterestRemaining = roundCurrency(nextInterestDue * paymentsRemainingInFixed);
      const paymentsRemaining = remainingTermMonths;
      const isVariableActive = Boolean(mortgage.variableRateActive) || paymentsRemainingInFixed <= 0;
      const variableStartsInMonths = isVariableActive ? 0 : Math.max(fixedMonthsRemaining, 0);
      const fixedTotals = {
        monthsRemaining: fixedMonthsRemaining,
        paymentsRemaining: paymentsRemainingInFixed,
        totalInterestRemaining: fixedInterestRemaining,
        totalPrincipalScheduled: 0,
        totalPaymentsRemaining: fixedInterestRemaining,
        projectedBalanceAfter: outstandingPrincipal,
      };

      const monthsAfterFixed = Math.max(remainingTermMonths - paymentsRemainingInFixed, 0);
      const variableAnnualRate =
        mortgage.reversionRate ?? (mortgage.baseRate ?? 0) + (mortgage.variableRateMargin ?? 0);
      const variableMonthlyRate = variableAnnualRate / 12;
      const estimatedVariablePayment = monthsAfterFixed > 0
        ? roundCurrency(outstandingPrincipal * variableMonthlyRate)
        : 0;

      return {
        monthlyPayment: paymentsRemaining > 0 ? nextInterestDue : outstandingPrincipal,
        interestComponent: paymentsRemaining > 0 ? nextInterestDue : 0,
        principalComponent: paymentsRemaining > 0 ? 0 : outstandingPrincipal,
        principalRemaining: outstandingPrincipal,
        fixedPeriod: fixedTotals,
        variablePhase: {
          startsInMonths: variableStartsInMonths,
          isActive: isVariableActive && mortgage.remainingBalance > 0,
          baseRate: mortgage.baseRate,
          margin: mortgage.variableRateMargin,
          reversionRate: variableAnnualRate,
          estimatedPayment: estimatedVariablePayment,
        },
        isInterestOnly: true,
      };
    }

    let simulatedBalance = outstandingPrincipal;
    let projectedInterestCents = 0;
    let projectedPrincipalCents = 0;
    let projectedPayments = 0;

    while (simulatedBalance > 0 && projectedPayments < paymentsRemainingInFixed) {
      const interestDue = roundCurrency(simulatedBalance * mortgage.monthlyInterestRate);
      projectedInterestCents += Math.round(interestDue * 100);

      let payment = scheduledPayment;
      const totalDue = roundCurrency(simulatedBalance + interestDue);
      if (payment > totalDue) {
        payment = totalDue;
      }

      const principalPaid = Math.min(
        roundCurrency(Math.max(payment - interestDue, 0)),
        simulatedBalance
      );

      projectedPrincipalCents += Math.round(principalPaid * 100);
      simulatedBalance = roundCurrency(simulatedBalance - principalPaid);
      projectedPayments += 1;

      if (simulatedBalance <= 0.005) {
        simulatedBalance = 0;
        break;
      }
    }

    const fixedInterestRemaining = roundCurrency(projectedInterestCents / 100);
    const fixedPrincipalScheduled = roundCurrency(projectedPrincipalCents / 100);
    const fixedTotals = {
      monthsRemaining: fixedMonthsRemaining,
      paymentsRemaining: paymentsRemainingInFixed,
      totalInterestRemaining: fixedInterestRemaining,
      totalPrincipalScheduled: fixedPrincipalScheduled,
      totalPaymentsRemaining: roundCurrency((projectedInterestCents + projectedPrincipalCents) / 100),
      projectedBalanceAfter: simulatedBalance,
    };

    const isVariableActive = Boolean(mortgage.variableRateActive) || paymentsRemainingInFixed <= 0;
    const monthsAfterFixed = Math.max(remainingTermMonths - paymentsRemainingInFixed, 0);
    let estimatedVariablePayment = 0;
    if (monthsAfterFixed > 0 && simulatedBalance > 0) {
      const remainingYearsAfterFixed = monthsAfterFixed / 12;
      const reversionRate =
        mortgage.reversionRate ?? (mortgage.baseRate ?? 0) + (mortgage.variableRateMargin ?? 0);
      estimatedVariablePayment = calculateMortgageMonthlyPayment(
        simulatedBalance,
        reversionRate,
        remainingYearsAfterFixed
      );
    }

    return {
      monthlyPayment,
      interestComponent,
      principalComponent: adjustedPrincipalComponent,
      principalRemaining: outstandingPrincipal,
      fixedPeriod: fixedTotals,
      variablePhase: {
        startsInMonths: isVariableActive ? 0 : Math.max(fixedMonthsRemaining, 0),
        isActive: isVariableActive && mortgage.remainingBalance > 0,
        baseRate: mortgage.baseRate,
        margin: mortgage.variableRateMargin,
        reversionRate:
          mortgage.reversionRate ??
          (mortgage.baseRate ?? 0) + (mortgage.variableRateMargin ?? 0),
        estimatedPayment: estimatedVariablePayment,
      },
      isInterestOnly: false,
    };
  }

  function mapDemandToAnnualYield(demandScore) {
    const minYield = 0.03;
    const maxYield = 0.08;
    if (!Number.isFinite(demandScore)) {
      return minYield;
    }

    const clampedScore = Math.min(Math.max(demandScore, 1), 10);
    const progression = (clampedScore - 1) / 9;

    return minYield + progression * (maxYield - minYield);
  }

  function cloneDefaultProperties() {
    return defaultProperties.map((property) => {
      const cost = calculatePropertyValue(property);
      const annualYield = mapDemandToAnnualYield(property.demandScore);
      const monthlyRent = Math.round((cost * annualYield) / 12);

      return {
        ...property,
        cost,
        annualYield,
        monthlyRent,
        marketAge: 0,
        introducedOnDay: state.day,
      };
    });
  }

  function initialiseGameState(logInitialMessage = true) {
    state.balance = 1000;
    state.day = 1;
    state.market = cloneDefaultProperties();
    state.portfolio = [];
    state.history = [];
    state.centralBankRate = FINANCE_CONFIG.centralBank.initialRate;
    state.lastCentralBankAdjustmentDay = 0;
    state.lastRentCollectionDay = 0;
    state.lastMarketGenerationDay = state.day;
    financeState.rateProfile = null;
    if (logInitialMessage) {
      addHistoryEntry("New game started with $1,000 in capital.");
      addHistoryEntry(
        `Central bank base rate set at ${(state.centralBankRate * 100).toFixed(2)}% to start the simulation.`
      );
    } else {
      renderHistory();
    }
    updateUI();
    restartTimer();
  }

  function addHistoryEntry(message) {
    const timestamp = new Date().toLocaleTimeString();
    state.history.push({ message, timestamp });
    if (state.history.length > 50) {
      state.history.shift();
    }
    renderHistory();
  }

  function restartTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
    }
    state.timerId = setInterval(handleDayTick, state.tickLength);
  }

  function handleSpeedChange(event) {
    const newLength = Number.parseInt(event.target.value, 10);
    if (Number.isFinite(newLength) && newLength > 0) {
      state.tickLength = newLength;
      restartTimer();
      addHistoryEntry(`Game speed set to ${(1000 / newLength).toFixed(1)}x.`);
    }
  }

  function adjustCentralBankRateIfNeeded() {
    const { centralBank } = FINANCE_CONFIG;
    const interval = centralBank.adjustmentIntervalDays ?? 30;
    if (!interval || interval <= 0) {
      return false;
    }

    const daysSinceAdjustment = state.day - state.lastCentralBankAdjustmentDay;
    if (daysSinceAdjustment < interval) {
      return false;
    }

    const stepRange = Math.max(centralBank.maxStepPerAdjustment ?? 0, 0);
    const delta = stepRange > 0 ? roundRate(getRandomNumber(-stepRange, stepRange, 4)) : 0;
    const minimumRate = Math.max(centralBank.minimumRate ?? 0, 0);
    const rawNextRate = state.centralBankRate + delta;
    const nextRate = roundRate(
      Math.max(minimumRate, Math.min(FINANCE_CONFIG.maximumRate, rawNextRate))
    );
    const change = roundRate(nextRate - state.centralBankRate);

    state.centralBankRate = nextRate;
    state.lastCentralBankAdjustmentDay = state.day;

    if (Math.abs(change) > 0) {
      const direction = change >= 0 ? "increased" : "decreased";
      addHistoryEntry(
        `Central bank base rate ${direction} to ${(nextRate * 100).toFixed(2)}% (${change >= 0 ? "+" : ""}${(change * 100).toFixed(2)} pp).`
      );
    } else {
      addHistoryEntry(
        `Central bank held the base rate at ${(nextRate * 100).toFixed(2)}%.`
      );
    }

    if (financeState.propertyId) {
      updateFinancePreview();
    }

    return true;
  }

  function handleDayTick() {
    state.day += 1;
    const rateChanged = adjustCentralBankRateIfNeeded();
    const daysSinceLastCollection = state.day - state.lastRentCollectionDay;
    const monthsElapsed = Math.floor(daysSinceLastCollection / 30);

    if (monthsElapsed > 0) {
      const grossRentPerMonth = calculateRentPerMonth();
      const rentCollected = grossRentPerMonth * monthsElapsed;
      state.balance += rentCollected;
      const startMonth = Math.floor(state.lastRentCollectionDay / 30) + 1;
      const endMonth = startMonth + monthsElapsed - 1;
      state.lastRentCollectionDay += monthsElapsed * 30;
      const monthRange = monthsElapsed > 1 ? `${startMonth}-${endMonth}` : `${startMonth}`;
      const monthLabel = monthsElapsed > 1 ? `${monthsElapsed} months` : "1 month";
      addHistoryEntry(
        `Month${monthsElapsed > 1 ? "s" : ""} ${monthRange}: Collected ${formatCurrency(rentCollected)} in rent for ${monthLabel}.`
      );

      const {
        totalPaid: mortgagePaid,
        mortgagesCleared,
        forcedSales,
      } = processMortgagePayments(monthsElapsed);
      if (mortgagePaid > 0) {
        state.balance -= mortgagePaid;
        addHistoryEntry(
          `Month${monthsElapsed > 1 ? "s" : ""} ${monthRange}: Paid ${formatCurrency(
            mortgagePaid
          )} towards mortgage obligations.`
        );
      }

      if (mortgagesCleared.length > 0) {
        const clearedNames = mortgagesCleared.join(", ");
        addHistoryEntry(
          mortgagesCleared.length > 1
            ? `Mortgages fully repaid: ${clearedNames}.`
            : `Mortgage fully repaid: ${clearedNames}.`
        );
      }

      forcedSales.forEach(({ propertyName, salePrice, outstanding, netProceeds }) => {
        state.balance += netProceeds;
        const resultText =
          netProceeds >= 0
            ? `netted ${formatCurrency(netProceeds)}`
            : `covered a shortfall of ${formatCurrency(Math.abs(netProceeds))}`;
        addHistoryEntry(
          `Forced sale of ${propertyName}: Sold for ${formatCurrency(
            salePrice
          )} to settle ${formatCurrency(outstanding)} remaining on the interest-only mortgage and ${resultText}.`
        );
      });

      state.balance = Math.round(state.balance * 100) / 100;
    }

    const marketUpdated = progressMarketListings();

    if (!marketUpdated || rateChanged) {
      updateUI();
    }
  }

  function calculateRentPerMonth() {
    return state.portfolio.reduce(
      (total, property) => total + property.monthlyRent,
      0
    );
  }

  function calculateMonthlyMortgageOutgoings() {
    const total = state.portfolio.reduce((sum, property) => {
      const payment = getNextMortgagePayment(property.mortgage);
      return sum + payment;
    }, 0);
    return roundCurrency(total);
  }

  function calculateNetCashflowPerMonth() {
    const net = calculateRentPerMonth() - calculateMonthlyMortgageOutgoings();
    return roundCurrency(net);
  }

  function calculateNetCashForProperty(property) {
    if (!property) {
      return 0;
    }
    const mortgagePayment = getNextMortgagePayment(property.mortgage);
    const net = property.monthlyRent - mortgagePayment;
    return roundCurrency(net);
  }

  function processMortgagePayments(monthsElapsed) {
    if (monthsElapsed <= 0) {
      return { totalPaid: 0, mortgagesCleared: [], forcedSales: [] };
    }

    let totalPaid = 0;
    const mortgagesCleared = [];
    const forcedSales = [];
    const variableTransitions = [];
    let realizedNetProceeds = 0;

    for (let index = state.portfolio.length - 1; index >= 0; index -= 1) {
      const property = state.portfolio[index];
      const mortgage = property.mortgage;
      if (!mortgage || mortgage.remainingBalance <= 0) {
        continue;
      }

      const totalTermMonths = Number.isFinite(mortgage.termMonths)
        ? Math.max(Math.round(mortgage.termMonths), 0)
        : Math.max(Math.round((mortgage.termYears ?? 0) * 12), 0);
      const fixedPeriodMonths = resolveFixedPeriodMonths(mortgage);

      if (
        fixedPeriodMonths <= 0 &&
        !mortgage.variableRateActive &&
        mortgage.remainingBalance > 0.5 &&
        mortgage.remainingTermMonths > 0
      ) {
        const activation = activateMortgageVariablePhase(mortgage);
        if (activation.activated) {
          variableTransitions.push({
            propertyName: property.name,
            ...activation,
          });
        }
      }

      for (let month = 0; month < monthsElapsed; month += 1) {
        if (mortgage.remainingTermMonths <= 0 || mortgage.remainingBalance <= 0) {
          break;
        }

        const interestDueRaw = mortgage.remainingBalance * mortgage.monthlyInterestRate;
        const interestDue = roundCurrency(interestDueRaw);
        let payment = roundCurrency(mortgage.monthlyPayment);
        const totalDue = mortgage.remainingBalance + interestDue;
        if (!mortgage.interestOnly && payment > totalDue) {
          payment = roundCurrency(totalDue);
        }

        const principalPaid = mortgage.interestOnly
          ? 0
          : roundCurrency(Math.max(payment - interestDue, 0));
        mortgage.remainingBalance = Math.max(
          roundCurrency(mortgage.remainingBalance - principalPaid),
          0
        );
        mortgage.remainingTermMonths = Math.max(mortgage.remainingTermMonths - 1, 0);
        totalPaid += payment;

        if (
          !mortgage.variableRateActive &&
          mortgage.remainingBalance > 0.5 &&
          mortgage.remainingTermMonths > 0
        ) {
          const monthsCompleted = Math.max(totalTermMonths - mortgage.remainingTermMonths, 0);
          if (monthsCompleted >= fixedPeriodMonths && fixedPeriodMonths > 0) {
            const activation = activateMortgageVariablePhase(mortgage);
            if (activation.activated) {
              variableTransitions.push({
                propertyName: property.name,
                ...activation,
              });
            }
          }
        }
      }

      if (mortgage.interestOnly && mortgage.remainingTermMonths <= 0 && mortgage.remainingBalance > 0.5) {
        const outstanding = roundCurrency(mortgage.remainingBalance);
        const availableBalance = roundCurrency(
          state.balance + realizedNetProceeds - totalPaid
        );
        if (availableBalance >= outstanding) {
          totalPaid += outstanding;
          mortgage.remainingBalance = 0;
          mortgagesCleared.push(property.name);
          property.mortgage = null;
        } else {
          const salePrice = calculateSalePrice(property);
          const netProceeds = roundCurrency(salePrice - outstanding);
          realizedNetProceeds = roundCurrency(realizedNetProceeds + netProceeds);
          forcedSales.push({
            propertyName: property.name,
            salePrice,
            outstanding,
            netProceeds,
          });
          state.portfolio.splice(index, 1);
          continue;
        }
      }

      if (
        !mortgage.interestOnly &&
        (mortgage.remainingBalance <= 0.5 || mortgage.remainingTermMonths <= 0)
      ) {
        mortgagesCleared.push(property.name);
        property.mortgage = null;
      }
    }

    variableTransitions.forEach(({ propertyName, baseRate, margin, reversionRate }) => {
      const rateLabel = Number.isFinite(reversionRate)
        ? `${(reversionRate * 100).toFixed(2)}%`
        : "variable rate";
      const marginLabel = Number.isFinite(margin)
        ? `${(margin * 100).toFixed(2)}%`
        : null;
      const baseLabel = Number.isFinite(baseRate) ? `${(baseRate * 100).toFixed(2)}%` : null;
      let message = `${propertyName} mortgage reverted to variable rate at ${rateLabel}`;
      if (baseLabel && marginLabel) {
        message += ` (${baseLabel} base + ${marginLabel} margin).`;
      } else if (marginLabel) {
        message += ` (${marginLabel} margin applied).`;
      } else {
        message += ".";
      }
      addHistoryEntry(message);
    });

    return {
      totalPaid: roundCurrency(totalPaid),
      mortgagesCleared,
      forcedSales,
    };
  }

  function calculateSalePrice(property) {
    if (!property) {
      return 0;
    }

    const baseCost = Number.isFinite(property.cost)
      ? property.cost
      : calculatePropertyValue(property);

    return Math.max(Math.round(baseCost), 0);
  }

  function handleCashPurchase(propertyId) {
    const propertyIndex = state.market.findIndex((item) => item.id === propertyId);
    if (propertyIndex === -1) {
      return;
    }

    const property = state.market[propertyIndex];

    if (state.balance < property.cost) {
      addHistoryEntry(
        `Attempted to buy ${property.name} but lacked funds (${formatCurrency(
          property.cost
        )}).`
      );
      return;
    }

    state.balance -= property.cost;
    state.market.splice(propertyIndex, 1);
    const purchasedProperty = { ...property, mortgage: null };
    state.portfolio.push(purchasedProperty);
    addHistoryEntry(
      `Purchased ${property.name} outright for ${formatCurrency(property.cost)}.`
    );
    updateUI();
  }

  function handleMortgagePurchase(
    propertyId,
    {
      depositRatio = FINANCE_CONFIG.defaultDepositRatio,
      termYears = FINANCE_CONFIG.defaultTermYears,
      rateProfile,
      interestOnly = false,
    } = {}
  ) {
    const propertyIndex = state.market.findIndex((item) => item.id === propertyId);
    if (propertyIndex === -1) {
      return false;
    }

    const property = state.market[propertyIndex];
    const resolvedProfile = rateProfile ?? deriveMortgageRateProfile({
      depositRatio,
      termYears,
    });
    const mortgage = createMortgageForCost(property.cost, {
      depositRatio,
      termYears,
      rateProfile: resolvedProfile,
      interestOnly,
    });
    const deposit = mortgage.deposit;

    if (state.balance < deposit) {
      addHistoryEntry(
        `Attempted to finance ${property.name} with a ${formatPercentage(
          depositRatio
        )} deposit but lacked the ${formatCurrency(deposit)} required upfront.`
      );
      return false;
    }

    state.balance -= deposit;
    state.market.splice(propertyIndex, 1);
    const purchasedProperty = { ...property, mortgage };
    state.portfolio.push(purchasedProperty);
    const fixedRateLabel = (mortgage.fixedRate * 100).toFixed(2);
    const baseRateLabel = (mortgage.baseRate * 100).toFixed(2);
    const marginLabel = (mortgage.variableRateMargin * 100).toFixed(2);
    const reversionRateLabel = (mortgage.reversionRate * 100).toFixed(2);
    const fixedPeriodLabel = `${mortgage.fixedPeriodYears} year${
      mortgage.fixedPeriodYears === 1 ? "" : "s"
    }`;
    const financingSummary = mortgage.interestOnly
      ? `interest-only payments of ${formatCurrency(mortgage.monthlyPayment)} for ${mortgage.termYears} years with ${formatCurrency(
          mortgage.principal
        )} due at term end`
      : `monthly payment ${formatCurrency(mortgage.monthlyPayment)} over ${mortgage.termYears} years`;
    addHistoryEntry(
      `Mortgaged ${property.name}: Paid ${formatCurrency(deposit)} (${formatPercentage(
        mortgage.depositRatio
      )} deposit) and financed ${formatCurrency(
        property.cost - deposit
      )} at fixed ${fixedRateLabel}% for ${fixedPeriodLabel} (reverts to base ${baseRateLabel}% + ${marginLabel}% = ${reversionRateLabel}%). Payments: ${financingSummary}.`
    );
    updateUI();
    return true;
  }

  function handleSale(propertyId) {
    const propertyIndex = state.portfolio.findIndex((item) => item.id === propertyId);
    if (propertyIndex === -1) {
      return;
    }

    const property = state.portfolio[propertyIndex];
    const salePrice = calculateSalePrice(property);
    let mortgagePayoff = 0;
    let outstandingInterest = 0;
    if (property.mortgage && property.mortgage.remainingBalance > 0) {
      const breakdown = getMortgagePaymentBreakdown(property.mortgage);
      mortgagePayoff = breakdown.principalRemaining;
      outstandingInterest = breakdown.fixedPeriod?.totalInterestRemaining ?? 0;
    }

    const totalMortgageSettlement = roundCurrency(mortgagePayoff);
    const netProceeds = roundCurrency(salePrice - totalMortgageSettlement);
    state.balance += netProceeds;
    state.portfolio.splice(propertyIndex, 1);
    if (totalMortgageSettlement > 0) {
      let historyMessage = `Sold ${property.name} for ${formatCurrency(
        salePrice
      )}, repaid ${formatCurrency(mortgagePayoff)} remaining on the mortgage principal (net ${formatCurrency(
        netProceeds
      )}).`;
      if (outstandingInterest > 0) {
        historyMessage += ` Avoided ${formatCurrency(
          outstandingInterest
        )} in upcoming fixed-period interest charges.`;
      }
      addHistoryEntry(historyMessage);
    } else {
      addHistoryEntry(`Sold ${property.name} for ${formatCurrency(salePrice)}.`);
    }
    state.balance = roundCurrency(state.balance);
    updateUI();
  }

  function renderProperties() {
    elements.propertyList.innerHTML = "";
    state.market.forEach((property) => {
      const col = document.createElement("div");
      col.className = "col";

      const card = document.createElement("div");
      card.className = "card property-card h-100";

      const cardBody = document.createElement("div");
      cardBody.className = "card-body d-flex flex-column";

      const title = document.createElement("h5");
      title.className = "card-title";
      title.textContent = property.name;

      const description = document.createElement("p");
      description.className = "card-text";
      description.textContent = property.description;

      const summary = document.createElement("p");
      summary.className = "mb-2 small";
      summary.innerHTML = `<strong>${property.bedrooms}</strong> bed · <strong>${property.bathrooms}</strong> bath · ${formatPropertyType(
        property.propertyType
      )}`;

      const features = document.createElement("ul");
      features.className = "list-inline small text-muted mb-2";
      (property.features ?? []).forEach((feature) => {
        const item = document.createElement("li");
        item.className = "list-inline-item badge bg-light text-dark border";
        item.textContent = feature;
        features.append(item);
      });

      const locationDetails = document.createElement("p");
      locationDetails.className = "small text-muted mb-2";
      const location = property.location ?? {};
      const proximityPercent = ((location.proximity ?? 0) * 100).toFixed(0);
      const schoolRating = location.schoolRating ?? "-";
      const crimeScore = location.crimeScore ?? "-";
      const descriptor = property.locationDescriptor
        ? `${property.locationDescriptor} · `
        : "";
      locationDetails.innerHTML = `<strong>Location:</strong> ${descriptor}${proximityPercent}% transit access · Schools ${schoolRating}/10 · Crime score ${crimeScore}/10`;

      const maintenance = document.createElement("p");
      maintenance.className = "small text-muted mb-2";
      const maintenanceLabel = (property.maintenanceLevel ?? "").replace(
        /(^|_)([a-z])/g,
        (_, prefix, char) => `${prefix === "_" ? " " : ""}${char.toUpperCase()}`
      );
      maintenance.innerHTML = `<strong>Maintenance:</strong> ${maintenanceLabel || "Unknown"}`;

      const demand = document.createElement("p");
      demand.className = "small text-muted mb-2";
      const annualYieldPercent = ((property.annualYield ?? 0) * 100).toFixed(1);
      demand.innerHTML = `<strong>Demand:</strong> ${property.demandScore ?? "-"}/10 · Estimated yield ${annualYieldPercent}%`;

      const cost = document.createElement("p");
      cost.className = "mb-1";
      cost.innerHTML = `<strong>Cost:</strong> ${formatCurrency(property.cost)}`;

      const rent = document.createElement("p");
      rent.className = "mb-1";
      rent.innerHTML = `<strong>Rent / month:</strong> ${formatCurrency(
        property.monthlyRent
      )}`;

      const mortgageInfo = document.createElement("div");
      mortgageInfo.className = "small text-muted mb-3";
      const defaultDepositRatio = FINANCE_CONFIG.defaultDepositRatio;
      const defaultTermYears = FINANCE_CONFIG.defaultTermYears;
      const previewProfile = deriveMortgageRateProfile({
        depositRatio: defaultDepositRatio,
        termYears: defaultTermYears,
      });
      const mortgagePreview = createMortgageForCost(property.cost, {
        depositRatio: defaultDepositRatio,
        termYears: defaultTermYears,
        rateProfile: previewProfile,
      });
      const fixedPeriodLabel = `${previewProfile.fixedPeriodYears} year${
        previewProfile.fixedPeriodYears === 1 ? "" : "s"
      }`;
      mortgageInfo.innerHTML = `
        <div>
          <strong>Finance preview:</strong>
          ${formatCurrency(mortgagePreview.deposit)} deposit (${formatPercentage(
            defaultDepositRatio
          )}) → ${formatCurrency(mortgagePreview.monthlyPayment)} / month over ${defaultTermYears} years.
        </div>
        <div class="mt-1">
          Rate: fixed ${(previewProfile.fixedRate * 100).toFixed(2)}% for ${fixedPeriodLabel}, then base ${(previewProfile.baseRate * 100).toFixed(2)}% + ${(previewProfile.variableRateMargin * 100).toFixed(2)}% (${(previewProfile.reversionRate * 100).toFixed(2)}%).
        </div>
        <div class="mt-1">Adjust deposit (5%-50%) and term (2-25 years) in the financing panel.</div>
      `;

      const buttonGroup = document.createElement("div");
      buttonGroup.className = "d-grid gap-2 mt-auto";

      const cashButton = document.createElement("button");
      cashButton.type = "button";
      cashButton.className = "btn btn-outline-primary";
      cashButton.textContent = "Buy with cash";
      cashButton.disabled = state.balance < property.cost;
      cashButton.addEventListener("click", () => handleCashPurchase(property.id));

      const financeButton = document.createElement("button");
      financeButton.type = "button";
      financeButton.className = "btn btn-primary";
      financeButton.textContent = "Finance property";
      financeButton.addEventListener("click", () => openFinanceModal(property.id));

      buttonGroup.append(cashButton, financeButton);

      const detailSection = document.createElement("div");
      detailSection.className = "mb-3 flex-grow-1";
      detailSection.append(
        summary,
        ...(features.childElementCount ? [features] : []),
        locationDetails,
        demand,
        maintenance
      );

      cardBody.append(title, description, detailSection, cost, rent, mortgageInfo, buttonGroup);
      card.append(cardBody);
      col.append(card);
      elements.propertyList.append(col);
    });
  }

  function getActiveFinanceProperty() {
    if (!financeState.propertyId) {
      return null;
    }
    return (
      state.market.find((property) => property.id === financeState.propertyId) ?? null
    );
  }

  function renderFinanceDepositOptions(property) {
    if (!elements.financeDepositOptions) {
      return;
    }
    elements.financeDepositOptions.innerHTML = FINANCE_CONFIG.depositOptions
      .map((ratio) => {
        const depositAmount = calculateMortgageDeposit(property.cost, ratio);
        const isActive = Math.abs(ratio - financeState.depositRatio) < 1e-6;
        return `
          <button
            type="button"
            class="btn btn-outline-primary${isActive ? " active" : ""}"
            data-deposit-ratio="${ratio}"
            aria-pressed="${isActive}"
          >
            ${formatPercentage(ratio)} (${formatCurrency(depositAmount)})
          </button>
        `;
      })
      .join("");
  }

  function renderFinanceTermOptions() {
    if (!elements.financeTermOptions) {
      return;
    }
    elements.financeTermOptions.innerHTML = FINANCE_CONFIG.termOptions
      .map((years) => {
        const isActive = Math.abs(years - financeState.termYears) < 1e-6;
        return `
          <button
            type="button"
            class="btn btn-outline-secondary${isActive ? " active" : ""}"
            data-term-years="${years}"
            aria-pressed="${isActive}"
          >
            ${years} years
          </button>
        `;
      })
      .join("");
  }

  function updateFinancePreview() {
    if (!elements.financePaymentPreview) {
      return;
    }
    const property = getActiveFinanceProperty();
    if (!property) {
      elements.financePaymentPreview.textContent = "Select a property to view payment details.";
      if (elements.financeAffordabilityNote) {
        elements.financeAffordabilityNote.textContent = "";
      }
      if (elements.confirmFinanceButton) {
        elements.confirmFinanceButton.disabled = true;
      }
      financeState.rateProfile = null;
      return;
    }

    const rateProfile = deriveMortgageRateProfile({
      depositRatio: financeState.depositRatio,
      termYears: financeState.termYears,
    });
    financeState.annualInterestRate = rateProfile.fixedRate;
    financeState.rateProfile = rateProfile;
    const mortgage = createMortgageForCost(property.cost, {
      depositRatio: financeState.depositRatio,
      termYears: financeState.termYears,
      rateProfile,
    });
    const canAffordDeposit = state.balance >= mortgage.deposit;

    elements.financePaymentPreview.innerHTML = `
      <p class="mb-1"><strong>Deposit:</strong> ${formatCurrency(mortgage.deposit)} (${formatPercentage(
        financeState.depositRatio
      )})</p>
      <p class="mb-1"><strong>Financed amount:</strong> ${formatCurrency(mortgage.principal)}</p>
      <p class="mb-1"><strong>Payments:</strong> ${formatCurrency(
        mortgage.monthlyPayment
      )} / month over ${mortgage.termYears} years</p>
      <p class="mb-0"><strong>Rate:</strong> Fixed ${(rateProfile.fixedRate * 100).toFixed(2)}% for ${
        rateProfile.fixedPeriodYears
      } year${rateProfile.fixedPeriodYears === 1 ? "" : "s"}, then base ${(rateProfile.baseRate * 100).toFixed(2)}% + ${(
        rateProfile.variableRateMargin * 100
      ).toFixed(2)}% (${(rateProfile.reversionRate * 100).toFixed(2)}%)</p>
    `;

    if (elements.financeAffordabilityNote) {
      elements.financeAffordabilityNote.textContent = canAffordDeposit
        ? `You can cover the deposit and will have ${formatCurrency(
            roundCurrency(state.balance - mortgage.deposit)
          )} remaining.`
        : `You need ${formatCurrency(
            roundCurrency(mortgage.deposit - state.balance)
          )} more to cover the selected deposit.`;
      elements.financeAffordabilityNote.className = `small mt-2 ${canAffordDeposit ? "text-success" : "text-danger"}`;
    }

    if (elements.confirmFinanceButton) {
      elements.confirmFinanceButton.disabled = !canAffordDeposit;
    }
  }

  function openFinanceModal(propertyId) {
    if (!elements.financeModal) {
      return;
    }
    const property = state.market.find((item) => item.id === propertyId);
    if (!property) {
      return;
    }

    financeState.propertyId = propertyId;
    if (
      !FINANCE_CONFIG.depositOptions.some(
        (ratio) => Math.abs(ratio - financeState.depositRatio) < 1e-6
      )
    ) {
      financeState.depositRatio = FINANCE_CONFIG.defaultDepositRatio;
    }
    if (
      !FINANCE_CONFIG.termOptions.some((years) => Math.abs(years - financeState.termYears) < 1e-6)
    ) {
      financeState.termYears = FINANCE_CONFIG.defaultTermYears;
    }

    if (elements.financePropertyName) {
      elements.financePropertyName.textContent = property.name;
    }
    if (elements.financePropertySummary) {
      elements.financePropertySummary.textContent = `Price ${formatCurrency(
        property.cost
      )} · Rent ${formatCurrency(property.monthlyRent)} / month`;
    }

    renderFinanceDepositOptions(property);
    renderFinanceTermOptions();
    updateFinancePreview();

    if (!financeModalInstance && window.bootstrap?.Modal) {
      financeModalInstance = new window.bootstrap.Modal(elements.financeModal, {
        backdrop: "static",
      });
    }

    if (financeModalInstance) {
      financeModalInstance.show();
    } else {
      elements.financeModal.classList.add("show", "d-block");
    }
  }

  function renderIncomeStatus() {
    elements.incomeStatus.innerHTML = "";
    const ownedProperties = state.portfolio;

    if (ownedProperties.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "list-group-item py-3";
      emptyItem.textContent = "No properties owned yet. Buy your first home to start earning rent.";
      elements.incomeStatus.append(emptyItem);
      return;
    }

    ownedProperties.forEach((property) => {
      const item = document.createElement("li");
      item.className =
        "list-group-item d-flex flex-column flex-sm-row align-items-sm-center gap-3";

      const info = document.createElement("div");
      info.className = "flex-grow-1";

      const nameElement = document.createElement("div");
      nameElement.className = "fw-semibold d-flex flex-wrap align-items-center gap-2";
      const nameText = document.createElement("span");
      nameText.textContent = property.name;
      nameElement.append(nameText);
      const mortgage = property.mortgage;
      if (mortgage?.variableRateActive) {
        item.classList.add("variable-rate-mortgage");
        const variableBadge = document.createElement("span");
        variableBadge.className = "badge badge-variable-rate text-uppercase";
        variableBadge.textContent = "Variable rate";
        nameElement.append(variableBadge);
      }
      info.append(nameElement);

      if (property.description) {
        const descriptionElement = document.createElement("small");
        descriptionElement.className = "d-block text-muted";
        descriptionElement.textContent = property.description;
        info.append(descriptionElement);
      }

      const cashflowDetails = document.createElement("div");
      cashflowDetails.className = "small text-muted";
      let mortgageBreakdown = null;
      if (mortgage) {
        mortgageBreakdown = getMortgagePaymentBreakdown(mortgage);
        const breakdown = mortgageBreakdown;
        const fixedTotals = breakdown.fixedPeriod ?? {};
        const variablePhase = breakdown.variablePhase ?? {};

        const formatCountdown = (months) => {
          if (!Number.isFinite(months) || months <= 0) {
            return "0 months";
          }
          const wholeMonths = Math.round(months);
          const years = Math.floor(wholeMonths / 12);
          const remainingMonths = wholeMonths % 12;
          const parts = [];
          if (years > 0) {
            parts.push(`${years} year${years === 1 ? "" : "s"}`);
          }
          if (remainingMonths > 0 || parts.length === 0) {
            parts.push(`${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`);
          }
          return parts.join(" ");
        };

        const summaryLine = document.createElement("div");
        if (breakdown.isInterestOnly) {
          summaryLine.textContent = `Rent ${formatCurrency(
            property.monthlyRent
          )} · Interest-only ${formatCurrency(breakdown.monthlyPayment)} / month`;
        } else {
          summaryLine.textContent = `Rent ${formatCurrency(property.monthlyRent)} · Mortgage ${formatCurrency(
            breakdown.monthlyPayment
          )} / month`;
        }

        const principalLine = document.createElement("div");
        if (breakdown.isInterestOnly) {
          principalLine.textContent = `Principal outstanding: ${formatCurrency(
            breakdown.principalRemaining
          )} (due after interest-only term)`;
        } else {
          principalLine.textContent = `Principal remaining: ${formatCurrency(
            breakdown.principalRemaining
          )}`;
        }

        const fixedPeriodLine = document.createElement("div");
        if (breakdown.isInterestOnly) {
          if ((fixedTotals.paymentsRemaining ?? 0) > 0) {
            const plural = fixedTotals.paymentsRemaining === 1 ? "" : "s";
            fixedPeriodLine.textContent = `Fixed period: ${fixedTotals.paymentsRemaining} payment${plural} left (${formatCurrency(
              fixedTotals.totalPaymentsRemaining ?? 0
            )} interest remaining).`;
          } else {
            fixedPeriodLine.textContent = `Interest-only fixed period complete; principal will roll onto variable terms.`;
          }
        } else if ((fixedTotals.paymentsRemaining ?? 0) > 0) {
          const plural = fixedTotals.paymentsRemaining === 1 ? "" : "s";
          fixedPeriodLine.textContent = `Fixed period: ${fixedTotals.paymentsRemaining} payment${plural} left (${formatCurrency(
            fixedTotals.totalPrincipalScheduled ?? 0
          )} principal + ${formatCurrency(fixedTotals.totalInterestRemaining ?? 0)} interest).`;
        } else {
          fixedPeriodLine.textContent = `Fixed period finished; ${formatCurrency(
            fixedTotals.projectedBalanceAfter ?? breakdown.principalRemaining
          )} principal continues on variable rate.`;
        }

        const paymentSplitLine = document.createElement("div");
        if (breakdown.isInterestOnly) {
          paymentSplitLine.textContent = `This month's payment: ${formatCurrency(
            breakdown.interestComponent
          )} interest-only`;
        } else {
          paymentSplitLine.textContent = `This month's payment: ${formatCurrency(
            breakdown.principalComponent
          )} principal + ${formatCurrency(breakdown.interestComponent)} interest`;
        }

        const variableLine = document.createElement("div");
        const baseRate = Number.isFinite(variablePhase.baseRate) ? variablePhase.baseRate : 0;
        const margin = Number.isFinite(variablePhase.margin) ? variablePhase.margin : 0;
        const reversionRate = Number.isFinite(variablePhase.reversionRate)
          ? variablePhase.reversionRate
          : baseRate + margin;
        const estimatedPayment = variablePhase.estimatedPayment ?? 0;

        if (variablePhase.isActive) {
          let message = `Variable margin active at ${(reversionRate * 100).toFixed(2)}% (${(baseRate * 100).toFixed(2)}% base + ${(margin * 100).toFixed(2)}% margin).`;
          if (estimatedPayment > 0) {
            message += ` Estimated payment ${formatCurrency(estimatedPayment)} / month.`;
          }
          variableLine.textContent = message;
        } else if ((variablePhase.startsInMonths ?? 0) > 0) {
          const countdownLabel = formatCountdown(variablePhase.startsInMonths ?? 0);
          let message = `Variable rate ${(reversionRate * 100).toFixed(2)}% begins in ${countdownLabel} (${(baseRate * 100).toFixed(2)}% base + ${(margin * 100).toFixed(2)}% margin).`;
          if (estimatedPayment > 0) {
            message += ` Estimated payment ${formatCurrency(estimatedPayment)} / month.`;
          }
          variableLine.textContent = message;
        } else {
          variableLine.textContent = `Variable margin available at ${(reversionRate * 100).toFixed(2)}% (${(baseRate * 100).toFixed(2)}% base + ${(margin * 100).toFixed(2)}% margin).`;
        }

        cashflowDetails.append(
          summaryLine,
          principalLine,
          fixedPeriodLine,
          paymentSplitLine,
          variableLine
        );
      } else {
        const summaryLine = document.createElement("div");
        summaryLine.textContent = `Rent ${formatCurrency(property.monthlyRent)} · No mortgage obligations`;
        cashflowDetails.append(summaryLine);
      }
      info.append(cashflowDetails);

      const actionWrapper = document.createElement("div");
      actionWrapper.className =
        "d-flex flex-column flex-sm-row align-items-sm-center gap-2 ms-sm-auto text-sm-end";

      const rentBadge = document.createElement("span");
      const netCash = calculateNetCashForProperty(property);
      rentBadge.className = `badge ${netCash >= 0 ? "bg-success" : "bg-danger"} rounded-pill`;
      rentBadge.textContent = `Net / month: ${formatCurrency(netCash)}`;

      const salePrice = calculateSalePrice(property);
      let netSaleLabel = `Sell for ${formatCurrency(salePrice)}`;
      if (mortgageBreakdown) {
        const settlement = mortgageBreakdown.principalRemaining ?? 0;
        if (settlement > 0) {
          const netProceeds = roundCurrency(salePrice - settlement);
          netSaleLabel = `Sell for ${formatCurrency(salePrice)} (net ${formatCurrency(netProceeds)})`;
        }
      }
      const sellButton = document.createElement("button");
      sellButton.type = "button";
      sellButton.className = "btn btn-outline-danger btn-sm";
      sellButton.textContent = netSaleLabel;
      sellButton.addEventListener("click", () => handleSale(property.id));

      actionWrapper.append(rentBadge, sellButton);

      item.append(info, actionWrapper);
      elements.incomeStatus.append(item);
    });
  }

  function renderHistory() {
    if (!elements.historyLog) return;
    const recentEvents = state.history.slice(-20).reverse();
    elements.historyLog.innerHTML = recentEvents
      .map(
        ({ message, timestamp }) =>
          `<div class="history-entry"><span class="text-muted">[${timestamp}]</span> ${message}</div>`
      )
      .join("");
  }

  function updateUI() {
    elements.balance.textContent = formatCurrency(state.balance);
    elements.day.textContent = state.day.toString();
    if (elements.centralBankRate) {
      elements.centralBankRate.textContent = formatInterestRate(state.centralBankRate);
    }
    const grossRent = calculateRentPerMonth();
    const mortgageOutgoings = calculateMonthlyMortgageOutgoings();
    const netCashflow = calculateNetCashflowPerMonth();
    elements.rentPerMonth.innerHTML = `${formatCurrency(netCashflow)} <small class="text-muted">(rent ${formatCurrency(
      grossRent
    )} - mortgages ${formatCurrency(mortgageOutgoings)})</small>`;
    renderProperties();
    renderIncomeStatus();
    renderHistory();
  }

  function resetGame() {
    initialiseGameState(false);
    addHistoryEntry("Game reset. Starting over with fresh capital.");
    addHistoryEntry("New game started with $1,000 in capital.");
    addHistoryEntry(
      `Central bank base rate set at ${(state.centralBankRate * 100).toFixed(2)}% to start the simulation.`
    );
  }

  function wireUpFinanceModal() {
    if (elements.financeDepositOptions) {
      elements.financeDepositOptions.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-deposit-ratio]");
        if (!button) {
          return;
        }
        const ratio = Number.parseFloat(button.dataset.depositRatio);
        if (!Number.isFinite(ratio)) {
          return;
        }
        financeState.depositRatio = ratio;
        const property = getActiveFinanceProperty();
        if (property) {
          renderFinanceDepositOptions(property);
        }
        updateFinancePreview();
      });
    }

    if (elements.financeTermOptions) {
      elements.financeTermOptions.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-term-years]");
        if (!button) {
          return;
        }
        const years = Number.parseInt(button.dataset.termYears, 10);
        if (!Number.isFinite(years)) {
          return;
        }
        financeState.termYears = years;
        renderFinanceTermOptions();
        updateFinancePreview();
      });
    }

    if (elements.confirmFinanceButton) {
      elements.confirmFinanceButton.addEventListener("click", (event) => {
        event.preventDefault();
        const property = getActiveFinanceProperty();
        if (!property) {
          return;
        }
        const profile =
          financeState.rateProfile ??
          deriveMortgageRateProfile({
            depositRatio: financeState.depositRatio,
            termYears: financeState.termYears,
          });
        const success = handleMortgagePurchase(property.id, {
          depositRatio: financeState.depositRatio,
          termYears: financeState.termYears,
          rateProfile: profile,
        });
        if (success) {
          financeState.propertyId = null;
          financeState.rateProfile = null;
          if (financeModalInstance) {
            financeModalInstance.hide();
          } else if (elements.financeModal) {
            elements.financeModal.classList.remove("show", "d-block");
          }
        }
      });
    }

    if (elements.financeModal) {
      elements.financeModal.addEventListener("hidden.bs.modal", () => {
        financeState.propertyId = null;
        financeState.rateProfile = null;
      });
    }
  }

  function wireUpEvents() {
    elements.resetButton.addEventListener("click", () => {
      resetGame();
    });

    elements.speedControl.addEventListener("change", handleSpeedChange);
    wireUpFinanceModal();
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    wireUpEvents();
    initialiseGameState();
  });
})();
