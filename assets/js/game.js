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

  const MORTGAGE_CONFIG = {
    depositRatio: 0.25,
    termYears: 25,
    annualInterestRate: 0.045,
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
    tickLength: 1000,
    timerId: null,
    lastRentCollectionDay: 0,
    lastMarketGenerationDay: 0,
  };

  const elements = {};

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
    elements.rentPerMonth = document.getElementById("rentPerMonth");
    elements.propertyList = document.getElementById("propertyList");
    elements.incomeStatus = document.getElementById("incomeStatus");
    elements.historyLog = document.getElementById("historyLog");
    elements.resetButton = document.getElementById("resetButton");
    elements.speedControl = document.getElementById("speedControl");
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

  function formatPropertyType(type) {
    return propertyTypeLabels[type] ?? type;
  }

  function calculateMortgageDeposit(cost) {
    if (!Number.isFinite(cost)) {
      return 0;
    }
    return Math.round(cost * MORTGAGE_CONFIG.depositRatio);
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

  function createMortgageForCost(cost) {
    const deposit = calculateMortgageDeposit(cost);
    const principal = Math.max(cost - deposit, 0);
    const termMonths = Math.round(MORTGAGE_CONFIG.termYears * 12);
    const monthlyRate = MORTGAGE_CONFIG.annualInterestRate / 12;
    const monthlyPayment = calculateMortgageMonthlyPayment(
      principal,
      MORTGAGE_CONFIG.annualInterestRate,
      MORTGAGE_CONFIG.termYears
    );

    return {
      deposit,
      principal,
      termYears: MORTGAGE_CONFIG.termYears,
      termMonths,
      annualInterestRate: MORTGAGE_CONFIG.annualInterestRate,
      monthlyInterestRate: monthlyRate,
      monthlyPayment,
      remainingBalance: principal,
      remainingTermMonths: termMonths,
    };
  }

  function getNextMortgagePayment(mortgage) {
    if (!mortgage || mortgage.remainingTermMonths <= 0 || mortgage.remainingBalance <= 0) {
      return 0;
    }

    const interestDue = mortgage.remainingBalance * mortgage.monthlyInterestRate;
    const scheduledPayment = roundCurrency(mortgage.monthlyPayment);
    const totalDue = mortgage.remainingBalance + interestDue;
    return Math.min(scheduledPayment, roundCurrency(totalDue));
  }

  function getMortgagePaymentBreakdown(mortgage) {
    if (!mortgage || mortgage.remainingTermMonths <= 0 || mortgage.remainingBalance <= 0) {
      return {
        monthlyPayment: 0,
        interestComponent: 0,
        principalComponent: 0,
        outstandingPrincipal: 0,
        outstandingInterest: 0,
        totalOutstanding: 0,
        paymentsRemaining: 0,
      };
    }

    const outstandingPrincipal = roundCurrency(mortgage.remainingBalance);
    const nextInterestDue = roundCurrency(outstandingPrincipal * mortgage.monthlyInterestRate);
    const scheduledPayment = roundCurrency(mortgage.monthlyPayment);
    const totalDueNext = roundCurrency(outstandingPrincipal + nextInterestDue);
    const monthlyPayment = Math.min(scheduledPayment, totalDueNext);
    const interestComponent = Math.min(nextInterestDue, monthlyPayment);
    const principalComponent = roundCurrency(Math.max(monthlyPayment - interestComponent, 0));
    const adjustedPrincipalComponent = Math.min(principalComponent, outstandingPrincipal);

    let simulatedBalance = outstandingPrincipal;
    let simulatedTerm = mortgage.remainingTermMonths;
    let projectedInterestCents = 0;
    let projectedPayments = 0;
    const maxIterations = Math.max(simulatedTerm + 120, 1);

    while (simulatedBalance > 0 && projectedPayments < maxIterations) {
      if (simulatedTerm <= 0 && simulatedBalance > 0) {
        simulatedTerm = 1;
      }

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

      simulatedBalance = roundCurrency(simulatedBalance - principalPaid);
      simulatedTerm -= 1;
      projectedPayments += 1;

      if (simulatedBalance <= 0.005) {
        simulatedBalance = 0;
        break;
      }
    }

    if (simulatedBalance > 0) {
      const interestDue = roundCurrency(simulatedBalance * mortgage.monthlyInterestRate);
      projectedInterestCents += Math.round(interestDue * 100);
      projectedPayments += 1;
      simulatedBalance = 0;
    }

    const outstandingInterest = roundCurrency(projectedInterestCents / 100);
    const paymentsRemaining = projectedPayments;

    return {
      monthlyPayment,
      interestComponent,
      principalComponent: adjustedPrincipalComponent,
      outstandingPrincipal,
      outstandingInterest,
      totalOutstanding: roundCurrency(outstandingPrincipal + outstandingInterest),
      paymentsRemaining,
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
    state.lastRentCollectionDay = 0;
    state.lastMarketGenerationDay = state.day;
    if (logInitialMessage) {
      addHistoryEntry("New game started with $1,000 in capital.");
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

  function handleDayTick() {
    state.day += 1;
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

      const { totalPaid: mortgagePaid, mortgagesCleared } = processMortgagePayments(monthsElapsed);
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

      state.balance = Math.round(state.balance * 100) / 100;
    }

    const marketUpdated = progressMarketListings();

    if (!marketUpdated) {
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
      return { totalPaid: 0, mortgagesCleared: [] };
    }

    let totalPaid = 0;
    const mortgagesCleared = [];

    state.portfolio.forEach((property) => {
      const mortgage = property.mortgage;
      if (!mortgage || mortgage.remainingTermMonths <= 0 || mortgage.remainingBalance <= 0) {
        return;
      }

      for (let month = 0; month < monthsElapsed; month += 1) {
        if (mortgage.remainingTermMonths <= 0 || mortgage.remainingBalance <= 0) {
          break;
        }

        const interestDueRaw = mortgage.remainingBalance * mortgage.monthlyInterestRate;
        const interestDue = roundCurrency(interestDueRaw);
        let payment = roundCurrency(mortgage.monthlyPayment);
        const totalDue = mortgage.remainingBalance + interestDue;
        if (payment > totalDue) {
          payment = roundCurrency(totalDue);
        }

        const principalPaid = roundCurrency(payment - interestDue);
        mortgage.remainingBalance = Math.max(roundCurrency(mortgage.remainingBalance - principalPaid), 0);
        mortgage.remainingTermMonths -= 1;
        totalPaid += payment;
      }

      if (mortgage.remainingBalance <= 0.5 || mortgage.remainingTermMonths <= 0) {
        mortgagesCleared.push(property.name);
        property.mortgage = null;
      }
    });

    return { totalPaid: roundCurrency(totalPaid), mortgagesCleared };
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

  function handleMortgagePurchase(propertyId) {
    const propertyIndex = state.market.findIndex((item) => item.id === propertyId);
    if (propertyIndex === -1) {
      return;
    }

    const property = state.market[propertyIndex];
    const mortgage = createMortgageForCost(property.cost);
    const deposit = mortgage.deposit;

    if (state.balance < deposit) {
      addHistoryEntry(
        `Attempted to mortgage ${property.name} but lacked the ${formatCurrency(deposit)} deposit.`
      );
      return;
    }

    state.balance -= deposit;
    state.market.splice(propertyIndex, 1);
    const purchasedProperty = { ...property, mortgage };
    state.portfolio.push(purchasedProperty);
    addHistoryEntry(
      `Mortgaged ${property.name}: Paid ${formatCurrency(deposit)} deposit and financed ${formatCurrency(
        property.cost - deposit
      )} at ${(MORTGAGE_CONFIG.annualInterestRate * 100).toFixed(1)}% for ${
        MORTGAGE_CONFIG.termYears
      } years (monthly payment ${formatCurrency(mortgage.monthlyPayment)}).`
    );
    updateUI();
  }

  function handleSale(propertyId) {
    const propertyIndex = state.portfolio.findIndex((item) => item.id === propertyId);
    if (propertyIndex === -1) {
      return;
    }

    const property = state.portfolio[propertyIndex];
    const salePrice = calculateSalePrice(property);
    let mortgagePayoff = 0;
    let mortgageInterestDue = 0;
    if (property.mortgage && property.mortgage.remainingBalance > 0) {
      const breakdown = getMortgagePaymentBreakdown(property.mortgage);
      mortgagePayoff = breakdown.outstandingPrincipal;
      mortgageInterestDue = breakdown.outstandingInterest;
    }

    const totalMortgageSettlement = roundCurrency(mortgagePayoff + mortgageInterestDue);
    const netProceeds = roundCurrency(salePrice - totalMortgageSettlement);
    state.balance += netProceeds;
    state.portfolio.splice(propertyIndex, 1);
    if (totalMortgageSettlement > 0) {
      const components = [];
      if (mortgagePayoff > 0) {
        components.push(`${formatCurrency(mortgagePayoff)} loan balance`);
      }
      if (mortgageInterestDue > 0) {
        components.push(`${formatCurrency(mortgageInterestDue)} interest`);
      }
      const settlementSummary = components.join(" and ");
      addHistoryEntry(
        `Sold ${property.name} for ${formatCurrency(salePrice)}, repaid ${settlementSummary} remaining on the mortgage (net ${formatCurrency(
          netProceeds
        )}).`
      );
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

      const mortgagePreview = createMortgageForCost(property.cost);
      const mortgageInfo = document.createElement("p");
      mortgageInfo.className = "small text-muted mb-3";
      mortgageInfo.innerHTML = `Mortgage option: ${formatCurrency(
        mortgagePreview.deposit
      )} deposit, ${formatCurrency(mortgagePreview.monthlyPayment)} / month for ${
        MORTGAGE_CONFIG.termYears
      } years at ${(MORTGAGE_CONFIG.annualInterestRate * 100).toFixed(1)}%`;

      const buttonGroup = document.createElement("div");
      buttonGroup.className = "d-grid gap-2 mt-auto";

      const cashButton = document.createElement("button");
      cashButton.type = "button";
      cashButton.className = "btn btn-outline-primary";
      cashButton.textContent = "Buy with cash";
      cashButton.disabled = state.balance < property.cost;
      cashButton.addEventListener("click", () => handleCashPurchase(property.id));

      const mortgageButton = document.createElement("button");
      mortgageButton.type = "button";
      mortgageButton.className = "btn btn-primary";
      mortgageButton.textContent = `Mortgage (Pay ${formatCurrency(mortgagePreview.deposit)})`;
      mortgageButton.disabled = state.balance < mortgagePreview.deposit;
      mortgageButton.addEventListener("click", () => handleMortgagePurchase(property.id));

      buttonGroup.append(cashButton, mortgageButton);

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
      nameElement.className = "fw-semibold";
      nameElement.textContent = property.name;
      info.append(nameElement);

      if (property.description) {
        const descriptionElement = document.createElement("small");
        descriptionElement.className = "d-block text-muted";
        descriptionElement.textContent = property.description;
        info.append(descriptionElement);
      }

      const mortgage = property.mortgage;
      const cashflowDetails = document.createElement("div");
      cashflowDetails.className = "small text-muted";
      let mortgageBreakdown = null;
      if (mortgage) {
        mortgageBreakdown = getMortgagePaymentBreakdown(mortgage);
        const breakdown = mortgageBreakdown;
        const summaryLine = document.createElement("div");
        summaryLine.textContent = `Rent ${formatCurrency(property.monthlyRent)} · Mortgage ${formatCurrency(
          breakdown.monthlyPayment
        )} / month`;

        const outstandingLine = document.createElement("div");
        outstandingLine.textContent = `Outstanding: ${formatCurrency(
          breakdown.outstandingPrincipal
        )} loan + ${formatCurrency(breakdown.outstandingInterest)} interest (${formatCurrency(
          breakdown.totalOutstanding
        )} total)`;

        const paymentSplitLine = document.createElement("div");
        paymentSplitLine.textContent = `This month's payment: ${formatCurrency(
          breakdown.principalComponent
        )} loan + ${formatCurrency(breakdown.interestComponent)} interest`;

        const paymentsRemainingLine = document.createElement("div");
        paymentsRemainingLine.textContent = `${breakdown.paymentsRemaining} payments remaining`;

        cashflowDetails.append(
          summaryLine,
          outstandingLine,
          paymentSplitLine,
          paymentsRemainingLine
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
        const settlement = mortgageBreakdown.totalOutstanding;
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
  }

  function wireUpEvents() {
    elements.resetButton.addEventListener("click", () => {
      resetGame();
    });

    elements.speedControl.addEventListener("change", handleSpeedChange);
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    wireUpEvents();
    initialiseGameState();
  });
})();
