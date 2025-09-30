import {
  defaultProperties,
  propertyTypeMultipliers,
  FINANCE_CONFIG,
  featureAddOns,
  proceduralPropertyArchetypes,
  MARKET_CONFIG,
  MAINTENANCE_CONFIG,
} from "./config.js";
import {
  getRandomInt,
  getRandomNumber,
  pickRandom,
  selectFeatureSubset,
  formatCurrency,
  roundCurrency,
  roundRate,
  formatPropertyType,
  formatPercentage,
  formatInterestRate,
} from "./utils.js";

(() => {
  function calculatePropertyValue(property) {
    const weights = {
      base: 220,
      bedrooms: 95,
      bathrooms: 80,
      proximity: 160,
      schoolRating: 22,
      safety: 18,
    };

    const {
      bedrooms = 0,
      bathrooms = 0,
      propertyType,
      features = [],
      location = {},
    } = property;

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

    return Math.round(baseValue * typeMultiplier);
  }

  function clampMaintenancePercent(value) {
    if (!Number.isFinite(value)) {
      return 0;
    }
    return Math.min(Math.max(Math.round(value), 0), 100);
  }

  function calculateMaintenanceAdjustedValue(baseValue, maintenancePercent) {
    const percent = clampMaintenancePercent(maintenancePercent);
    return Math.max(Math.round((baseValue * percent) / 100), 0);
  }

  function getInitialMaintenancePercent(preferred) {
    if (Number.isFinite(preferred)) {
      return clampMaintenancePercent(preferred);
    }

    const [minPercent, maxPercent] = MAINTENANCE_CONFIG.initialPercentRange ?? [25, 75];
    const lower = Number.isFinite(minPercent) ? minPercent : 25;
    const upper = Number.isFinite(maxPercent) ? maxPercent : 75;
    if (lower >= upper) {
      return clampMaintenancePercent(lower);
    }
    return clampMaintenancePercent(getRandomInt(lower, upper));
  }

  function deriveMaintenancePercent(range, fallback) {
    if (Array.isArray(range) && range.length === 2) {
      const [min, max] = range;
      const lower = Number.isFinite(min) ? min : fallback ?? MAINTENANCE_CONFIG.initialPercentRange?.[0];
      const upper = Number.isFinite(max) ? max : fallback ?? MAINTENANCE_CONFIG.initialPercentRange?.[1];
      if (Number.isFinite(lower) && Number.isFinite(upper) && lower < upper) {
        return clampMaintenancePercent(getRandomInt(lower, upper));
      }
    }
    return getInitialMaintenancePercent(fallback);
  }

  function refreshPropertyMarketValue(property) {
    if (!property) {
      return 0;
    }

    if (!Number.isFinite(property.baseValue)) {
      property.baseValue = calculatePropertyValue(property);
    }

    property.cost = calculateMaintenanceAdjustedValue(
      property.baseValue,
      property.maintenancePercent
    );

    return property.cost;
  }

  function isPropertyVacant(property) {
    return (property?.maintenanceWork?.monthsRemaining ?? 0) > 0;
  }

  function hasActiveTenant(property) {
    return Boolean(property?.tenant && (property.tenant.leaseMonthsRemaining ?? 0) > 0);
  }

  function getEffectiveRent(property) {
    if (!property) {
      return 0;
    }
    if (isPropertyVacant(property)) {
      return 0;
    }
    return hasActiveTenant(property) ? property.tenant.rent ?? 0 : 0;
  }

  function formatLeaseCountdown(months) {
    if (!Number.isFinite(months) || months <= 0) {
      return "0 months";
    }
    const rounded = Math.round(months);
    const years = Math.floor(rounded / 12);
    const remainingMonths = rounded % 12;
    const parts = [];
    if (years > 0) {
      parts.push(`${years} year${years === 1 ? "" : "s"}`);
    }
    if (remainingMonths > 0 || parts.length === 0) {
      parts.push(`${remainingMonths} month${remainingMonths === 1 ? "" : "s"}`);
    }
    return parts.join(" ");
  }

  const RENT_STRATEGY_PROFILES = [
    {
      key: "value",
      label: "Value seeker",
      rateOffset: -0.0075,
      probabilityScale: 1.15,
      leaseMonths: 9,
      description: "Lower rent, faster tenant placement.",
    },
    {
      key: "market",
      label: "Market rate",
      rateOffset: 0,
      probabilityScale: 1,
      leaseMonths: 12,
      description: "Balanced rent aligned with base rate.",
    },
    {
      key: "premium",
      label: "Premium",
      rateOffset: 0.01,
      probabilityScale: 0.7,
      leaseMonths: 15,
      description: "Higher rent with slower tenant uptake.",
    },
  ];

  function clampDemandScore(score) {
    if (!Number.isFinite(score)) {
      return 5;
    }
    return Math.min(Math.max(score, 1), 10);
  }

  function getRentStrategyOptions(property) {
    if (!property) {
      return [];
    }

    const demandScore = clampDemandScore(property.demandScore);
    const demandFactor = demandScore / 10;
    const baseAnnualYield = Math.max(0.01 + (state.centralBankRate ?? 0), 0.01);
    const propertyCost = Number.isFinite(property.cost)
      ? property.cost
      : calculateMaintenanceAdjustedValue(
          Number.isFinite(property.baseValue)
            ? property.baseValue
            : calculatePropertyValue(property),
          property.maintenancePercent ?? getInitialMaintenancePercent()
        );

    const baseProbability = Math.min(0.2 + demandFactor * 0.6, 0.95);

    return RENT_STRATEGY_PROFILES.map((profile) => {
      const annualYield = Math.max(baseAnnualYield + profile.rateOffset, 0.005);
      const monthlyRent = roundCurrency((propertyCost * annualYield) / 12);
      const probability = Math.min(
        Math.max(baseProbability * profile.probabilityScale, 0.05),
        0.95
      );

      return {
        ...profile,
        annualYield,
        monthlyRent,
        probability,
      };
    });
  }

  function findRentStrategyOption(property, optionKey) {
    const options = getRentStrategyOptions(property);
    if (options.length === 0) {
      return null;
    }

    if (optionKey) {
      const match = options.find((option) => option.key === optionKey);
      if (match) {
        return match;
      }
    }

    const marketOption = options.find((option) => option.key === "market");
    if (marketOption) {
      return marketOption;
    }

    return options[0];
  }

  function ensurePropertyRentSettings(property) {
    if (!property) {
      return null;
    }

    const selectedOption = findRentStrategyOption(property, property.askingRentOption);
    if (!selectedOption) {
      return null;
    }

    property.askingRentOption = selectedOption.key;
    property.desiredMonthlyRent = selectedOption.monthlyRent;

    if (typeof property.autoRelist !== "boolean") {
      property.autoRelist = true;
    }

    if (!Number.isFinite(property.vacancyMonths)) {
      property.vacancyMonths = 0;
    }

    if (!property.tenant) {
      property.leaseMonthsRemaining = 0;
      property.monthlyRent = 0;
      if (typeof property.rentalMarketingActive !== "boolean") {
        property.rentalMarketingActive = true;
      }
    } else {
      property.tenant.leaseMonthsRemaining =
        property.tenant.leaseMonthsRemaining ?? property.leaseMonthsRemaining ?? selectedOption.leaseMonths;
      property.tenant.leaseLengthMonths =
        property.tenant.leaseLengthMonths ?? property.tenant.leaseMonthsRemaining;
      property.tenant.optionKey = property.tenant.optionKey ?? selectedOption.key;
      property.monthlyRent = property.tenant.rent ?? selectedOption.monthlyRent;
      property.leaseMonthsRemaining = property.tenant.leaseMonthsRemaining;
      property.rentalMarketingActive = false;
      property.vacancyMonths = 0;
    }

    return selectedOption;
  }

  function startRentalMarketing(property) {
    if (!property) {
      return;
    }
    ensurePropertyRentSettings(property);
    property.rentalMarketingActive = true;
    property.vacancyMonths = 0;
  }

  function stopRentalMarketing(property) {
    if (!property) {
      return;
    }
    property.rentalMarketingActive = false;
    property.vacancyMonths = 0;
  }

  function createStatusChip(text, className = "bg-secondary") {
    const badge = document.createElement("span");
    badge.className = `badge rounded-pill ${className}`;
    badge.textContent = text;
    return badge;
  }

  function progressPropertyTenancy(property, tenancyEvents) {
    if (!property) {
      return 0;
    }

    const events = tenancyEvents ?? [];
    let rentCollected = 0;

    const maintenanceVacancy = isPropertyVacant(property);

    if (hasActiveTenant(property)) {
      if (!maintenanceVacancy) {
        rentCollected += property.tenant.rent ?? 0;
      }

      const remaining = Math.max((property.tenant.leaseMonthsRemaining ?? property.leaseMonthsRemaining ?? 0) - 1, 0);
      property.tenant.leaseMonthsRemaining = remaining;
      property.leaseMonthsRemaining = remaining;

      if (remaining <= 0) {
        const completedLease = {
          type: "leaseEnded",
          property,
          rent: property.tenant.rent ?? 0,
          leaseLength: property.tenant.leaseLengthMonths ?? 0,
          optionKey: property.tenant.optionKey ?? property.askingRentOption,
          inherited: Boolean(property.tenant.inherited),
        };
        events.push(completedLease);
        property.tenant = null;
        property.monthlyRent = 0;
        property.leaseMonthsRemaining = 0;
        if (property.autoRelist) {
          property.rentalMarketingActive = true;
          property.vacancyMonths = 0;
          events.push({
            type: "autoRelist",
            property,
            optionKey: property.askingRentOption,
          });
        } else {
          property.rentalMarketingActive = false;
        }
      }
      return rentCollected;
    }

    property.monthlyRent = 0;
    property.leaseMonthsRemaining = 0;

    if (maintenanceVacancy || !property.rentalMarketingActive) {
      if (property.rentalMarketingActive) {
        property.vacancyMonths = (property.vacancyMonths ?? 0) + 1;
      }
      return rentCollected;
    }

    property.vacancyMonths = (property.vacancyMonths ?? 0) + 1;
    const rentOption = ensurePropertyRentSettings(property);
    if (!rentOption) {
      return rentCollected;
    }

    const vacancyBoost = Math.min(Math.max((property.vacancyMonths - 1) * 0.08, 0), 0.3);
    const demandAdjustment = Math.min((clampDemandScore(property.demandScore) - 5) * 0.02, 0.2);
    const adjustedProbability = Math.min(
      Math.max(rentOption.probability + vacancyBoost + demandAdjustment, 0.01),
      0.98
    );

    if (Math.random() < adjustedProbability) {
      const leaseMonths = rentOption.leaseMonths;
      property.tenant = {
        rent: rentOption.monthlyRent,
        leaseMonthsRemaining: leaseMonths,
        leaseLengthMonths: leaseMonths,
        startedOnDay: state.day,
        inherited: false,
        optionKey: rentOption.key,
      };
      property.monthlyRent = rentOption.monthlyRent;
      property.leaseMonthsRemaining = leaseMonths;
      property.rentalMarketingActive = false;
      property.vacancyMonths = 0;
      events.push({
        type: "tenantSecured",
        property,
        rent: rentOption.monthlyRent,
        leaseMonths,
        option: rentOption,
        probability: adjustedProbability,
      });
      if (!maintenanceVacancy) {
        rentCollected += rentOption.monthlyRent;
      }
    }

    return rentCollected;
  }

  function advancePropertiesForMonth() {
    let rentCollected = 0;
    const maintenanceCompletions = [];
    const tenancyEvents = [];

    state.portfolio.forEach((property) => {
      ensurePropertyRentSettings(property);
      const currentPercent =
        property.maintenancePercent ?? getInitialMaintenancePercent();
      const underMaintenance = isPropertyVacant(property);
      const decayRate = underMaintenance
        ? MAINTENANCE_CONFIG.unoccupiedDecayPerMonth ?? 0
        : MAINTENANCE_CONFIG.occupiedDecayPerMonth ?? 0;

      property.maintenancePercent = clampMaintenancePercent(
        currentPercent - decayRate
      );

      rentCollected += progressPropertyTenancy(property, tenancyEvents);

      if (underMaintenance && property.maintenanceWork) {
        property.maintenanceWork.monthsRemaining = Math.max(
          (property.maintenanceWork.monthsRemaining ?? 0) - 1,
          0
        );
        if (property.maintenanceWork.monthsRemaining <= 0) {
          const cost = roundCurrency(property.maintenanceWork.cost ?? 0);
          property.maintenancePercent = 100;
          maintenanceCompletions.push({ property, cost });
          property.maintenanceWork = null;
        }
      }

      refreshPropertyMarketValue(property);
    });

    state.market.forEach((property) => {
      const currentPercent =
        property.maintenancePercent ?? getInitialMaintenancePercent();
      const decayRate = MAINTENANCE_CONFIG.unoccupiedDecayPerMonth ?? 0;
      property.maintenancePercent = clampMaintenancePercent(
        currentPercent - decayRate
      );
      refreshPropertyMarketValue(property);
      ensurePropertyRentSettings(property);
    });

    return {
      rentCollected: roundCurrency(rentCollected),
      maintenanceCompletions,
      tenancyEvents,
    };
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
    fixedPeriodYears: FINANCE_CONFIG.defaultFixedPeriodYears,
    annualInterestRate: FINANCE_CONFIG.centralBank.initialRate,
    rateProfile: null,
    interestOnly: false,
  };

  let financeModalInstance = null;

  let generatedIdCounter = 1;

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
      marketAge: 0,
      introducedOnDay: state.day,
    };

    const baseValue = calculatePropertyValue(baseProperty);
    const maintenancePercent = deriveMaintenancePercent(
      archetype.maintenancePercentRange,
      getInitialMaintenancePercent()
    );
    const cost = calculateMaintenanceAdjustedValue(baseValue, maintenancePercent);
    const annualYield = mapDemandToAnnualYield(baseProperty.demandScore);
    const rentOptions = getRentStrategyOptions({
      ...baseProperty,
      baseValue,
      cost,
      maintenancePercent,
    });
    const defaultOption = rentOptions.find((option) => option.key === "market") ?? rentOptions[0];
    const estimatedYield = defaultOption?.annualYield ?? annualYield;
    const inheritedChance = 0.25 + (clampDemandScore(baseProperty.demandScore) / 10) * 0.35;
    const hasInheritedTenant = Math.random() < Math.min(Math.max(inheritedChance, 0), 0.75);

    let tenant = null;
    let leaseMonthsRemaining = 0;
    let monthlyRent = 0;

    if (hasInheritedTenant && defaultOption) {
      const minLease = Math.max(defaultOption.leaseMonths - 3, 6);
      const maxLease = defaultOption.leaseMonths + 6;
      const leaseMonths = getRandomInt(minLease, maxLease);
      tenant = {
        rent: defaultOption.monthlyRent,
        leaseMonthsRemaining: leaseMonths,
        leaseLengthMonths: leaseMonths,
        startedOnDay: Math.max(state.day - getRandomInt(0, Math.min(leaseMonths - 1, 6)), 1),
        inherited: true,
        optionKey: defaultOption.key,
      };
      leaseMonthsRemaining = leaseMonths;
      monthlyRent = tenant.rent;
    }

    const property = {
      ...baseProperty,
      baseValue,
      maintenancePercent,
      cost,
      annualYield: estimatedYield,
      monthlyRent,
      tenant,
      leaseMonthsRemaining,
      desiredMonthlyRent: defaultOption?.monthlyRent ?? Math.round((cost * annualYield) / 12),
      askingRentOption: defaultOption?.key ?? null,
      autoRelist: true,
      rentalMarketingActive: !tenant,
      vacancyMonths: tenant ? 0 : getRandomInt(0, 2),
      maintenanceWork: null,
    };

    ensurePropertyRentSettings(property);

    return property;
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
    elements.financeFixedPeriodOptions = document.getElementById(
      "financeFixedPeriodOptions"
    );
    elements.financeTermOptions = document.getElementById("financeTermOptions");
    elements.financePaymentTypeOptions = document.getElementById(
      "financePaymentTypeOptions"
    );
    elements.financePaymentPreview = document.getElementById("financePaymentPreview");
    elements.financeAffordabilityNote = document.getElementById("financeAffordabilityNote");
    elements.confirmFinanceButton = document.getElementById("confirmFinanceButton");
  }

  function deriveMortgageRateProfile({
    depositRatio,
    termYears,
    fixedPeriodYears,
    baseRate,
  } = {}) {
    const { centralBank, rateModel, maximumRate, minimumRate } = FINANCE_CONFIG;
    const minDeposit = FINANCE_CONFIG.depositOptions[0];
    const maxDeposit = FINANCE_CONFIG.depositOptions[FINANCE_CONFIG.depositOptions.length - 1];
    const resolvedDepositRatio = Number.isFinite(depositRatio)
      ? Math.min(Math.max(depositRatio, minDeposit), maxDeposit)
      : FINANCE_CONFIG.defaultDepositRatio;
    const resolvedTermYears = Number.isFinite(termYears)
      ? Math.max(Math.round(termYears), 1)
      : FINANCE_CONFIG.defaultTermYears;
    const desiredFixedYears = Number.isFinite(fixedPeriodYears)
      ? Math.max(Math.round(fixedPeriodYears), 1)
      : FINANCE_CONFIG.defaultFixedPeriodYears ?? resolvedTermYears;
    const resolvedFixedYearsCandidate = resolveFixedPeriodSelection(
      resolvedTermYears,
      desiredFixedYears
    );
    const resolvedFixedYears = Math.max(
      1,
      Math.min(
        Number.isFinite(resolvedFixedYearsCandidate)
          ? resolvedFixedYearsCandidate
          : resolvedTermYears,
        resolvedTermYears
      )
    );
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
      fixedPeriodYears = FINANCE_CONFIG.defaultFixedPeriodYears,
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
      fixedPeriodYears,
      baseRate,
    });
    const resolvedFixedPeriodYears = Math.min(
      resolvedProfile.fixedPeriodYears ?? resolvedTermYears,
      resolvedTermYears
    );
    const fixedPeriodMonths = Math.max(
      Math.round(resolvedFixedPeriodYears * 12),
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
      fixedPeriodYears: resolvedFixedPeriodYears,
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
      const baseValue = calculatePropertyValue(property);
      const maintenancePercent = getInitialMaintenancePercent(
        property.maintenancePercent
      );
      const cost = calculateMaintenanceAdjustedValue(baseValue, maintenancePercent);
      const annualYield = mapDemandToAnnualYield(property.demandScore);
      const rentOptions = getRentStrategyOptions({
        ...property,
        baseValue,
        maintenancePercent,
        cost,
      });
      const defaultOption = rentOptions.find((option) => option.key === "market") ?? rentOptions[0];
      const estimatedYield = defaultOption?.annualYield ?? annualYield;
      const inheritedChance = 0.25 + (clampDemandScore(property.demandScore) / 10) * 0.35;
      const hasTenant = Math.random() < Math.min(Math.max(inheritedChance, 0), 0.75);

      let tenant = null;
      let leaseMonthsRemaining = 0;
      let monthlyRent = 0;

      if (hasTenant && defaultOption) {
        const minLease = Math.max(defaultOption.leaseMonths - 3, 6);
        const maxLease = defaultOption.leaseMonths + 6;
        const leaseMonths = getRandomInt(minLease, maxLease);
        tenant = {
          rent: defaultOption.monthlyRent,
          leaseMonthsRemaining: leaseMonths,
          leaseLengthMonths: leaseMonths,
          startedOnDay: state.day,
          inherited: true,
          optionKey: defaultOption.key,
        };
        leaseMonthsRemaining = leaseMonths;
        monthlyRent = tenant.rent;
      }

      const cloned = {
        ...property,
        baseValue,
        maintenancePercent,
        cost,
        annualYield: estimatedYield,
        monthlyRent,
        tenant,
        leaseMonthsRemaining,
        desiredMonthlyRent: defaultOption?.monthlyRent ?? Math.round((cost * annualYield) / 12),
        askingRentOption: defaultOption?.key ?? null,
        autoRelist: true,
        rentalMarketingActive: !tenant,
        vacancyMonths: tenant ? 0 : getRandomInt(0, 1),
        marketAge: 0,
        introducedOnDay: state.day,
        maintenanceWork: null,
      };

      ensurePropertyRentSettings(cloned);

      return cloned;
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
      let rentCollected = 0;
      const maintenanceCompletions = [];
      const tenancyEvents = [];

      for (let month = 0; month < monthsElapsed; month += 1) {
        const result = advancePropertiesForMonth();
        rentCollected += result.rentCollected;
        maintenanceCompletions.push(...result.maintenanceCompletions);
        tenancyEvents.push(...(result.tenancyEvents ?? []));
      }

      state.balance += rentCollected;
      const startMonth = Math.floor(state.lastRentCollectionDay / 30) + 1;
      const endMonth = startMonth + monthsElapsed - 1;
      state.lastRentCollectionDay += monthsElapsed * 30;
      const monthRange = monthsElapsed > 1 ? `${startMonth}-${endMonth}` : `${startMonth}`;
      const monthLabel = monthsElapsed > 1 ? `${monthsElapsed} months` : "1 month";
      addHistoryEntry(
        `Month${monthsElapsed > 1 ? "s" : ""} ${monthRange}: Collected ${formatCurrency(rentCollected)} in rent for ${monthLabel}.`
      );

      maintenanceCompletions.forEach(({ property, cost }) => {
        if (cost > 0) {
          state.balance -= cost;
        }
        const costLabel = cost > 0 ? ` at a cost of ${formatCurrency(cost)}` : "";
        addHistoryEntry(
          `Maintenance completed on ${property.name}${costLabel}. Condition restored to 100%.`
        );
        state.balance = roundCurrency(state.balance);
      });

      tenancyEvents.forEach((event) => {
          const rentOption = event.option ?? findRentStrategyOption(event.property, event.optionKey);
          switch (event.type) {
            case "tenantSecured": {
              const chanceLabel = rentOption
                ? `${Math.round((event.probability ?? rentOption.probability) * 100)}%`
                : null;
              const leaseLabel = formatLeaseCountdown(event.leaseMonths);
              const messageParts = [
                `New tenant secured for ${event.property.name}`,
                `at ${formatCurrency(event.rent)} / month`,
                `(${leaseLabel} lease)`,
              ];
              if (chanceLabel) {
                messageParts.push(`after ${chanceLabel} monthly hit chance.`);
              }
              const summary = messageParts.join(" ");
              addHistoryEntry(chanceLabel ? summary : `${summary}.`);
              break;
            }
            case "leaseEnded": {
              const leaseLength = formatLeaseCountdown(event.leaseLength ?? 0);
              addHistoryEntry(
                `Lease completed for ${event.property.name} (${leaseLength}). Property is now vacant.`
              );
              break;
            }
            case "autoRelist": {
              const chanceLabel = rentOption
                ? `${Math.round(rentOption.probability * 100)}% monthly placement`
                : null;
              const summary = chanceLabel
                ? `Auto-relisted ${event.property.name} targeting ${chanceLabel}.`
                : `Auto-relisted ${event.property.name} for new tenants.`;
              addHistoryEntry(summary);
              break;
            }
            default:
              break;
          }
        });

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
      (total, property) => total + getEffectiveRent(property),
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
    const effectiveRent = getEffectiveRent(property);
    const net = effectiveRent - mortgagePayment;
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

    const baseValue = Number.isFinite(property.baseValue)
      ? property.baseValue
      : calculatePropertyValue(property);
    const maintenancePercent =
      property.maintenancePercent ?? getInitialMaintenancePercent();

    return calculateMaintenanceAdjustedValue(baseValue, maintenancePercent);
  }

  function handleRentOptionChange(propertyId, optionKey, { scope } = {}) {
    const collection = scope === "portfolio" ? state.portfolio : state.market;
    const property = collection.find((item) => item.id === propertyId);
    if (!property) {
      return;
    }

    const option = findRentStrategyOption(property, optionKey);
    if (!option) {
      return;
    }

    property.askingRentOption = option.key;
    property.desiredMonthlyRent = option.monthlyRent;
    ensurePropertyRentSettings(property);
    if (!hasActiveTenant(property)) {
      property.vacancyMonths = 0;
    }

    if (scope === "portfolio") {
      addHistoryEntry(
        `Updated rent strategy for ${property.name}: ${option.label} at ${formatCurrency(
          option.monthlyRent
        )} (${Math.round((option.probability ?? 0) * 100)}% monthly hit).`
      );
    }

    updateUI();
  }

  function handleAutoRelistToggle(propertyId, enabled, { scope } = {}) {
    const collection = scope === "portfolio" ? state.portfolio : state.market;
    const property = collection.find((item) => item.id === propertyId);
    if (!property) {
      return;
    }

    property.autoRelist = Boolean(enabled);

    if (scope === "portfolio") {
      if (enabled && !hasActiveTenant(property) && !property.rentalMarketingActive) {
        startRentalMarketing(property);
        const option = findRentStrategyOption(property, property.askingRentOption);
        addHistoryEntry(
          `Auto-relisting enabled for ${property.name}: targeting ${formatCurrency(
            option?.monthlyRent ?? 0
          )} (${Math.round((option?.probability ?? 0) * 100)}% monthly hit).`
        );
      } else if (!enabled) {
        stopRentalMarketing(property);
        addHistoryEntry(`Auto-relisting disabled for ${property.name}.`);
      }
      updateUI();
      return;
    }

    updateUI();
  }

  function handleMarketingToggle(propertyId, shouldMarket) {
    const property = state.portfolio.find((item) => item.id === propertyId);
    if (!property || hasActiveTenant(property)) {
      return;
    }

    if (shouldMarket) {
      startRentalMarketing(property);
      const option = findRentStrategyOption(property, property.askingRentOption);
      addHistoryEntry(
        `Listed ${property.name} for rent at ${formatCurrency(option?.monthlyRent ?? 0)} (${Math.round(
          (option?.probability ?? 0) * 100
        )}% monthly hit).`
      );
    } else {
      stopRentalMarketing(property);
      addHistoryEntry(`Paused advertising for ${property.name}.`);
    }

    updateUI();
  }

  function preparePurchasedProperty(property, { mortgage = null } = {}) {
    if (!property) {
      return null;
    }

    const clonedTenant = property.tenant
      ? {
          ...property.tenant,
        }
      : null;
    const clonedMaintenance = property.maintenanceWork
      ? { ...property.maintenanceWork }
      : null;

    const purchased = {
      ...property,
      tenant: clonedTenant,
      mortgage,
      maintenanceWork: clonedMaintenance,
    };

    ensurePropertyRentSettings(purchased);

    if (purchased.tenant) {
      purchased.tenant.inherited = true;
      purchased.rentalMarketingActive = false;
      purchased.vacancyMonths = 0;
    } else {
      purchased.monthlyRent = 0;
      purchased.leaseMonthsRemaining = 0;
      if (purchased.autoRelist) {
        startRentalMarketing(purchased);
      } else {
        stopRentalMarketing(purchased);
      }
    }

    return purchased;
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
    const purchasedProperty = preparePurchasedProperty(property, { mortgage: null });
    state.portfolio.push(purchasedProperty);
    addHistoryEntry(
      `Purchased ${property.name} outright for ${formatCurrency(property.cost)}.`
    );
    if (purchasedProperty.tenant) {
      addHistoryEntry(
        `Lease transfers with purchase: ${purchasedProperty.name} continues at ${formatCurrency(
          purchasedProperty.tenant.rent
        )} per month (${formatLeaseCountdown(
          purchasedProperty.leaseMonthsRemaining
        )} remaining).`
      );
    }
    updateUI();
  }

  function handleMortgagePurchase(
    propertyId,
    {
      depositRatio = FINANCE_CONFIG.defaultDepositRatio,
      termYears = FINANCE_CONFIG.defaultTermYears,
      fixedPeriodYears = FINANCE_CONFIG.defaultFixedPeriodYears,
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
      fixedPeriodYears,
    });
    const mortgage = createMortgageForCost(property.cost, {
      depositRatio,
      termYears,
      fixedPeriodYears,
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
    const purchasedProperty = preparePurchasedProperty(property, { mortgage });
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
    if (purchasedProperty.tenant) {
      addHistoryEntry(
        `Lease transfers with purchase: ${purchasedProperty.name} continues at ${formatCurrency(
          purchasedProperty.tenant.rent
        )} per month (${formatLeaseCountdown(
          purchasedProperty.leaseMonthsRemaining
        )} remaining).`
      );
    }
    updateUI();
    return true;
  }

  function handleSale(propertyId) {
    const propertyIndex = state.portfolio.findIndex((item) => item.id === propertyId);
    if (propertyIndex === -1) {
      return;
    }

    const property = state.portfolio[propertyIndex];
    const maintenanceThreshold = MAINTENANCE_CONFIG.criticalThreshold ?? 25;
    const currentMaintenance = property.maintenancePercent ?? 0;
    if (currentMaintenance < maintenanceThreshold) {
      addHistoryEntry(
        `Unable to sell ${property.name}: maintenance at ${currentMaintenance}% is below the required ${maintenanceThreshold}%.`
      );
      return;
    }

    if (isPropertyVacant(property)) {
      addHistoryEntry(
        `Unable to sell ${property.name} while maintenance work is underway.`
      );
      return;
    }

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

  function scheduleMaintenance(propertyId) {
    const property = state.portfolio.find((item) => item.id === propertyId);
    if (!property) {
      return;
    }

    if (isPropertyVacant(property)) {
      addHistoryEntry(
        `${property.name} already has maintenance scheduled.`
      );
      return;
    }

    const currentPercent = property.maintenancePercent ?? 0;
    if (currentPercent >= 100) {
      addHistoryEntry(`${property.name} is already at 100% maintenance.`);
      return;
    }

    const baseValue = Number.isFinite(property.baseValue)
      ? property.baseValue
      : calculatePropertyValue(property);
    const deficiencyRatio = Math.max(0, 100 - currentPercent) / 100;
    const costRatio = MAINTENANCE_CONFIG.refurbishmentCostRatio ?? 0.25;
    const projectedCost = roundCurrency(baseValue * costRatio * deficiencyRatio);

    if (projectedCost > state.balance) {
      addHistoryEntry(
        `Unable to schedule maintenance for ${property.name}: requires ${formatCurrency(projectedCost)} but only ${formatCurrency(state.balance)} is available.`
      );
      return;
    }

    property.maintenanceWork = {
      monthsRemaining: 1,
      cost: projectedCost,
      scheduledOnDay: state.day,
    };

    addHistoryEntry(
      `Scheduled maintenance for ${property.name}: property will be vacant for 1 month (estimated cost ${formatCurrency(projectedCost)}).`
    );
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

      const maintenanceWrapper = document.createElement("div");
      maintenanceWrapper.className = "mb-2";
      const maintenanceLabel = document.createElement("p");
      maintenanceLabel.className = "small text-muted mb-1";
      const maintenancePercentLabel = clampMaintenancePercent(
        property.maintenancePercent ?? 0
      );
      maintenanceLabel.innerHTML = `<strong>Maintenance:</strong> ${maintenancePercentLabel}% condition`;
      const maintenanceProgress = document.createElement("div");
      maintenanceProgress.className = "progress maintenance-progress";
      const maintenanceProgressBar = document.createElement("div");
      maintenanceProgressBar.className = "progress-bar";
      maintenanceProgressBar.role = "progressbar";
      maintenanceProgressBar.style.width = `${maintenancePercentLabel}%`;
      maintenanceProgressBar.setAttribute("aria-valuenow", maintenancePercentLabel.toString());
      maintenanceProgressBar.setAttribute("aria-valuemin", "0");
      maintenanceProgressBar.setAttribute("aria-valuemax", "100");
      maintenanceProgressBar.textContent = `${maintenancePercentLabel}%`;
      maintenanceProgress.append(maintenanceProgressBar);
      maintenanceWrapper.append(maintenanceLabel, maintenanceProgress);

      const demand = document.createElement("p");
      demand.className = "small text-muted mb-2";
      const annualYieldPercent = ((property.annualYield ?? 0) * 100).toFixed(1);
      demand.innerHTML = `<strong>Demand:</strong> ${property.demandScore ?? "-"}/10 · Estimated yield ${annualYieldPercent}%`;

      const cost = document.createElement("p");
      cost.className = "mb-1";
      cost.innerHTML = `<strong>Cost:</strong> ${formatCurrency(property.cost)}`;

      const rent = document.createElement("p");
      rent.className = "mb-1";
      const activeTenant = hasActiveTenant(property);
      const rentOption = findRentStrategyOption(property, property.askingRentOption);
      const probabilityLabel = rentOption
        ? `${Math.round((rentOption.probability ?? 0) * 100)}%`
        : null;
      if (activeTenant) {
        rent.innerHTML = `<strong>Current rent:</strong> ${formatCurrency(
          property.tenant.rent
        )} <span class="text-muted">(${formatLeaseCountdown(
          property.leaseMonthsRemaining
        )} remaining)</span>`;
      } else {
        rent.innerHTML = `<strong>Target rent:</strong> ${formatCurrency(
          rentOption?.monthlyRent ?? 0
        )} <span class="text-muted">(${probabilityLabel ?? "-"} monthly hit · ${
          rentOption?.leaseMonths ?? 0
        }-month lease)</span>`;
      }

      const statusWrapper = document.createElement("div");
      statusWrapper.className = "d-flex flex-wrap gap-2 mb-2";
      if (activeTenant) {
        const occupiedLabel = `Tenant in place${
          property.leaseMonthsRemaining > 0
            ? ` (${formatLeaseCountdown(property.leaseMonthsRemaining)} remaining)`
            : ""
        }`;
        statusWrapper.append(createStatusChip(occupiedLabel, "bg-success"));
        if (property.tenant?.inherited) {
          statusWrapper.append(createStatusChip("Lease transfers", "bg-info text-dark"));
        }
      } else {
        statusWrapper.append(createStatusChip("Vacant", "bg-secondary"));
        if (property.rentalMarketingActive) {
          statusWrapper.append(createStatusChip("Advertising", "bg-warning text-dark"));
        }
      }

      const rentControls = document.createElement("div");
      rentControls.className = "mb-3";
      if (rentOption) {
        const rentLabel = document.createElement("label");
        rentLabel.className = "form-label small fw-semibold";
        rentLabel.textContent = activeTenant ? "Next rent strategy" : "Rent strategy";
        rentLabel.setAttribute("for", `rent-option-${property.id}`);

        const rentSelect = document.createElement("select");
        rentSelect.className = "form-select form-select-sm";
        rentSelect.id = `rent-option-${property.id}`;
        getRentStrategyOptions(property).forEach((option) => {
          const optionElement = document.createElement("option");
          optionElement.value = option.key;
          const chance = Math.round((option.probability ?? 0) * 100);
          optionElement.textContent = `${option.label} · ${formatCurrency(
            option.monthlyRent
          )} (${chance}% hit · ${option.leaseMonths}-mo lease)`;
          rentSelect.append(optionElement);
        });
        rentSelect.value = rentOption.key;
        rentSelect.addEventListener("change", (event) => {
          handleRentOptionChange(property.id, event.target.value, { scope: "market" });
        });
        const rentHelp = document.createElement("div");
        rentHelp.className = "form-text small";
        rentHelp.textContent = activeTenant
          ? "Applies after the inherited lease ends."
          : "Adjust to balance rent against vacancy risk.";
        rentControls.append(rentLabel, rentSelect, rentHelp);
      }

      const autoRelistWrapper = document.createElement("div");
      autoRelistWrapper.className = "form-check form-switch form-check-reverse mb-3";
      const autoRelistCheckbox = document.createElement("input");
      autoRelistCheckbox.className = "form-check-input";
      autoRelistCheckbox.type = "checkbox";
      autoRelistCheckbox.id = `market-autorelist-${property.id}`;
      autoRelistCheckbox.checked = Boolean(property.autoRelist);
      autoRelistCheckbox.addEventListener("change", (event) => {
        handleAutoRelistToggle(property.id, event.target.checked, { scope: "market" });
      });
      const autoRelistLabel = document.createElement("label");
      autoRelistLabel.className = "form-check-label small";
      autoRelistLabel.setAttribute("for", autoRelistCheckbox.id);
      autoRelistLabel.textContent = "Auto-relist when vacant";
      autoRelistWrapper.append(autoRelistCheckbox, autoRelistLabel);

      const mortgageInfo = document.createElement("div");
      mortgageInfo.className = "small text-muted mb-3";
      const defaultDepositRatio = FINANCE_CONFIG.defaultDepositRatio;
      const defaultTermYears = FINANCE_CONFIG.defaultTermYears;
      const previewProfile = deriveMortgageRateProfile({
        depositRatio: defaultDepositRatio,
        termYears: defaultTermYears,
        fixedPeriodYears: FINANCE_CONFIG.defaultFixedPeriodYears,
      });
      const mortgagePreview = createMortgageForCost(property.cost, {
        depositRatio: defaultDepositRatio,
        termYears: defaultTermYears,
        fixedPeriodYears: FINANCE_CONFIG.defaultFixedPeriodYears,
        rateProfile: previewProfile,
      });
      const previewFixedYears = Math.min(
        previewProfile.fixedPeriodYears,
        defaultTermYears
      );
      const fixedPeriodLabel = `${previewFixedYears} year${
        previewFixedYears === 1 ? "" : "s"
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
        maintenanceWrapper
      );

      const rentControlsNode = rentControls.childNodes.length > 0 ? rentControls : null;

      [
        title,
        description,
        detailSection,
        cost,
        statusWrapper,
        rent,
        rentControlsNode,
        autoRelistWrapper,
        mortgageInfo,
        buttonGroup,
      ]
        .filter(Boolean)
        .forEach((node) => cardBody.append(node));
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

  function resolveFixedPeriodSelection(termYears, desiredYears) {
    const options = FINANCE_CONFIG.fixedPeriodOptions ?? [];
    const fallback = FINANCE_CONFIG.defaultFixedPeriodYears ?? termYears;
    const roundedDesired = Number.isFinite(desiredYears)
      ? Math.max(Math.round(desiredYears), 1)
      : null;

    if (options.length === 0) {
      return Math.min(roundedDesired ?? fallback, termYears);
    }

    if (roundedDesired) {
      const matchedOption = options.find(
        (option) => Math.abs(option - roundedDesired) < 1e-6 && option <= termYears
      );
      if (matchedOption) {
        return matchedOption;
      }
    }

    const eligibleOptions = options.filter((option) => option <= termYears);
    if (eligibleOptions.length > 0) {
      return eligibleOptions[eligibleOptions.length - 1];
    }

    const smallestOption = options[0];
    return Math.min(smallestOption, termYears);
  }

  function renderFinanceFixedPeriodOptions() {
    if (!elements.financeFixedPeriodOptions) {
      return;
    }

    const effectiveSelection = resolveFixedPeriodSelection(
      financeState.termYears,
      financeState.fixedPeriodYears
    );
    if (Math.abs(effectiveSelection - financeState.fixedPeriodYears) > 1e-6) {
      financeState.fixedPeriodYears = effectiveSelection;
    }

    elements.financeFixedPeriodOptions.innerHTML = (FINANCE_CONFIG.fixedPeriodOptions ?? [])
      .map((years) => {
        const disabled = years > financeState.termYears;
        const isActive = !disabled && Math.abs(years - financeState.fixedPeriodYears) < 1e-6;
        return `
          <button
            type="button"
            class="btn btn-outline-secondary${isActive ? " active" : ""}"
            data-fixed-period-years="${years}"
            aria-pressed="${isActive}"
            ${disabled ? "disabled" : ""}
          >
            ${years} years
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

  function renderFinancePaymentTypeOptions() {
    if (!elements.financePaymentTypeOptions) {
      return;
    }
    const buttons = elements.financePaymentTypeOptions.querySelectorAll(
      "button[data-interest-only]"
    );
    buttons.forEach((button) => {
      const isInterestOnly = button.dataset.interestOnly === "true";
      const isActive = isInterestOnly === financeState.interestOnly;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", isActive ? "true" : "false");
    });
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
      fixedPeriodYears: financeState.fixedPeriodYears,
    });
    financeState.annualInterestRate = rateProfile.fixedRate;
    financeState.rateProfile = rateProfile;
    const mortgage = createMortgageForCost(property.cost, {
      depositRatio: financeState.depositRatio,
      termYears: financeState.termYears,
      fixedPeriodYears: financeState.fixedPeriodYears,
      rateProfile,
      interestOnly: financeState.interestOnly,
    });
    const canAffordDeposit = state.balance >= mortgage.deposit;

    const paymentSummary = financeState.interestOnly
      ? `<p class="mb-1"><strong>Payments:</strong> Interest-only ${formatCurrency(
          mortgage.monthlyPayment
        )} / month for ${mortgage.termYears} years</p>`
      : `<p class="mb-1"><strong>Payments:</strong> ${formatCurrency(
          mortgage.monthlyPayment
        )} / month over ${mortgage.termYears} years</p>`;
    const monthlyRent = Number.isFinite(property.monthlyRent)
      ? property.monthlyRent
      : 0;
    const monthlyNetCashFlow = roundCurrency(monthlyRent - mortgage.monthlyPayment);
    const netCashFlowFormatted =
      monthlyNetCashFlow > 0
        ? `+${formatCurrency(monthlyNetCashFlow)}`
        : formatCurrency(monthlyNetCashFlow);
    const netCashFlowClass =
      monthlyNetCashFlow >= 0 ? "text-success" : "text-danger";
    const displayFixedYears = mortgage.fixedPeriodYears;
    const rateLine = `<p class="mb-1"><strong>Rate:</strong> Fixed ${(rateProfile.fixedRate * 100).toFixed(
      2
    )}% for ${displayFixedYears} year${
      displayFixedYears === 1 ? "" : "s"
    }, then base ${(rateProfile.baseRate * 100).toFixed(2)}% + ${(
      rateProfile.variableRateMargin * 100
    ).toFixed(2)}% (${(rateProfile.reversionRate * 100).toFixed(2)}%)</p>`;
    const variableTransitionNote = `<p class="mb-0 small text-muted">Net cash flow shown applies during the fixed ${(rateProfile.fixedRate * 100).toFixed(
      2
    )}% period (${displayFixedYears} year${displayFixedYears === 1 ? "" : "s"}). Afterward payments follow base ${(rateProfile.baseRate * 100).toFixed(
      2
    )}% + ${(rateProfile.variableRateMargin * 100).toFixed(2)}% (${(rateProfile.reversionRate * 100).toFixed(2)}%), so your returns may change.</p>`;
    const interestOnlyNote = financeState.interestOnly
      ? `<p class="mb-0 text-muted">Principal of ${formatCurrency(
          mortgage.principal
        )} remains due at the end of the term. Plan to refinance, sell, or repay the balance.</p>`
      : "";

    elements.financePaymentPreview.innerHTML = `
      <p class="mb-1"><strong>Deposit:</strong> ${formatCurrency(mortgage.deposit)} (${formatPercentage(
        financeState.depositRatio
      )})</p>
      <p class="mb-1"><strong>Financed amount:</strong> ${formatCurrency(mortgage.principal)}</p>
      ${paymentSummary}
      <p class="mb-1 ${netCashFlowClass}"><strong>Monthly net cash flow (fixed period):</strong> ${netCashFlowFormatted}</p>
      ${rateLine}
      ${variableTransitionNote}
      ${interestOnlyNote}
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
    financeState.fixedPeriodYears = resolveFixedPeriodSelection(
      financeState.termYears,
      financeState.fixedPeriodYears
    );

    if (elements.financePropertyName) {
      elements.financePropertyName.textContent = property.name;
    }
    if (elements.financePropertySummary) {
      const rentOption = findRentStrategyOption(property, property.askingRentOption);
      const activeTenant = hasActiveTenant(property);
      const rentAmount = activeTenant
        ? property.tenant.rent
        : rentOption?.monthlyRent ?? 0;
      const rentSummary = activeTenant
        ? `${formatCurrency(rentAmount)} / month (lease ${formatLeaseCountdown(
            property.leaseMonthsRemaining
          )} remaining)`
        : `${formatCurrency(rentAmount)} target (${Math.round(
            (rentOption?.probability ?? 0) * 100
          )}% monthly hit)`;
      elements.financePropertySummary.textContent = `Price ${formatCurrency(
        property.cost
      )} · Rent ${rentSummary}`;
    }

    renderFinanceDepositOptions(property);
    renderFinanceTermOptions();
    renderFinanceFixedPeriodOptions();
    renderFinancePaymentTypeOptions();
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

      const tenantStatusWrapper = document.createElement("div");
      tenantStatusWrapper.className = "d-flex flex-wrap gap-2 mb-2";
      const activeTenant = hasActiveTenant(property);
      if (activeTenant) {
        const remainingLabel = property.leaseMonthsRemaining > 0
          ? ` (${formatLeaseCountdown(property.leaseMonthsRemaining)} remaining)`
          : "";
        tenantStatusWrapper.append(
          createStatusChip(`Occupied${remainingLabel}`, "bg-success")
        );
        if (property.tenant?.inherited) {
          tenantStatusWrapper.append(
            createStatusChip("Inherited lease", "bg-info text-dark")
          );
        }
      } else {
        tenantStatusWrapper.append(createStatusChip("Vacant", "bg-secondary"));
        if (property.rentalMarketingActive) {
          tenantStatusWrapper.append(
            createStatusChip("Advertising", "bg-warning text-dark")
          );
        } else {
          tenantStatusWrapper.append(
            createStatusChip("Idle", "bg-light text-muted border")
          );
        }
      }
      info.append(tenantStatusWrapper);

      if (property.description) {
        const descriptionElement = document.createElement("small");
        descriptionElement.className = "d-block text-muted";
        descriptionElement.textContent = property.description;
        info.append(descriptionElement);
      }

      const rentOption = findRentStrategyOption(property, property.askingRentOption);
      const activeRentAmount = getEffectiveRent(property);
      const targetRentAmount = rentOption?.monthlyRent ?? 0;
      const tenancyDetails = document.createElement("div");
      tenancyDetails.className = "small mb-2";
      if (activeTenant) {
        tenancyDetails.innerHTML = `<strong>Current rent:</strong> ${formatCurrency(
          property.tenant.rent
        )} (lease ${formatLeaseCountdown(property.leaseMonthsRemaining)} remaining)`;
      } else {
        tenancyDetails.innerHTML = `<strong>Target rent:</strong> ${formatCurrency(
          targetRentAmount
        )} · ${Math.round((rentOption?.probability ?? 0) * 100)}% monthly hit · ${
          rentOption?.leaseMonths ?? 0
        }-month lease`;
      }
      info.append(tenancyDetails);

      const maintenancePercent = clampMaintenancePercent(
        property.maintenancePercent ?? 0
      );
      const maintenanceBlock = document.createElement("div");
      maintenanceBlock.className = "maintenance-status";
      const maintenanceLabel = document.createElement("div");
      maintenanceLabel.className = "small text-muted mb-1";
      const maintenanceNotes = [];
      if (isPropertyVacant(property)) {
        maintenanceNotes.push("maintenance scheduled");
      }
      const notesSuffix = maintenanceNotes.length
        ? ` (${maintenanceNotes.join(", ")})`
        : "";
      maintenanceLabel.innerHTML = `<strong>Maintenance:</strong> ${maintenancePercent}% condition${notesSuffix}`;
      const maintenanceProgress = document.createElement("div");
      maintenanceProgress.className = "progress maintenance-progress";
      const maintenanceProgressBar = document.createElement("div");
      maintenanceProgressBar.className = "progress-bar";
      maintenanceProgressBar.role = "progressbar";
      maintenanceProgressBar.style.width = `${maintenancePercent}%`;
      maintenanceProgressBar.setAttribute("aria-valuenow", maintenancePercent.toString());
      maintenanceProgressBar.setAttribute("aria-valuemin", "0");
      maintenanceProgressBar.setAttribute("aria-valuemax", "100");
      maintenanceProgressBar.textContent = `${maintenancePercent}%`;
      maintenanceProgress.append(maintenanceProgressBar);
      maintenanceBlock.append(maintenanceLabel, maintenanceProgress);
      info.append(maintenanceBlock);

      const rentControlsRow = document.createElement("div");
      rentControlsRow.className = "d-flex flex-column flex-lg-row align-items-lg-center gap-3 mb-3";

      const rentControlNodes = [];

      if (rentOption) {
        const rentGroup = document.createElement("div");
        rentGroup.className = "flex-grow-1";
        const rentLabel = document.createElement("label");
        rentLabel.className = "form-label small fw-semibold mb-1";
        rentLabel.textContent = activeTenant ? "Next rent strategy" : "Rent strategy";
        rentLabel.setAttribute("for", `portfolio-rent-option-${property.id}`);
        const rentSelect = document.createElement("select");
        rentSelect.className = "form-select form-select-sm";
        rentSelect.id = `portfolio-rent-option-${property.id}`;
        getRentStrategyOptions(property).forEach((option) => {
          const optionElement = document.createElement("option");
          optionElement.value = option.key;
          const chance = Math.round((option.probability ?? 0) * 100);
          optionElement.textContent = `${option.label} · ${formatCurrency(
            option.monthlyRent
          )} (${chance}% hit · ${option.leaseMonths}-mo lease)`;
          rentSelect.append(optionElement);
        });
        rentSelect.value = rentOption.key;
        rentSelect.addEventListener("change", (event) => {
          handleRentOptionChange(property.id, event.target.value, { scope: "portfolio" });
        });
        const rentHelp = document.createElement("div");
        rentHelp.className = "form-text small";
        rentHelp.textContent = activeTenant
          ? "Applies once the current lease ends."
          : "Adjust to balance rent against vacancy risk.";
        rentGroup.append(rentLabel, rentSelect, rentHelp);
        rentControlNodes.push(rentGroup);
      }

      const autoWrapper = document.createElement("div");
      autoWrapper.className = "form-check form-switch mb-0";
      const autoCheckbox = document.createElement("input");
      autoCheckbox.className = "form-check-input";
      autoCheckbox.type = "checkbox";
      autoCheckbox.id = `portfolio-autorelist-${property.id}`;
      autoCheckbox.checked = Boolean(property.autoRelist);
      autoCheckbox.addEventListener("change", (event) => {
        handleAutoRelistToggle(property.id, event.target.checked, { scope: "portfolio" });
      });
      const autoLabel = document.createElement("label");
      autoLabel.className = "form-check-label small";
      autoLabel.setAttribute("for", autoCheckbox.id);
      autoLabel.textContent = "Auto-relist when vacant";
      autoWrapper.append(autoCheckbox, autoLabel);
      rentControlNodes.push(autoWrapper);

      if (!activeTenant) {
        const marketingButton = document.createElement("button");
        marketingButton.type = "button";
        marketingButton.className = "btn btn-outline-primary btn-sm";
        marketingButton.textContent = property.rentalMarketingActive
          ? "Pause advertising"
          : "List for rent";
        const maintenanceVacant = isPropertyVacant(property);
        marketingButton.disabled = maintenanceVacant;
        marketingButton.addEventListener("click", () => {
          handleMarketingToggle(property.id, !property.rentalMarketingActive);
        });
        rentControlNodes.push(marketingButton);
      }

      if (rentControlNodes.length > 0) {
        rentControlNodes.forEach((node) => rentControlsRow.append(node));
        info.append(rentControlsRow);
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
        const rentDescriptor = activeTenant
          ? `Rent ${formatCurrency(activeRentAmount)}`
          : `Vacant (target ${formatCurrency(targetRentAmount)})`;
        if (breakdown.isInterestOnly) {
          summaryLine.textContent = `${rentDescriptor} · Interest-only ${formatCurrency(
            breakdown.monthlyPayment
          )} / month`;
        } else {
          summaryLine.textContent = `${rentDescriptor} · Mortgage ${formatCurrency(
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
        summaryLine.textContent = activeTenant
          ? `Rent ${formatCurrency(activeRentAmount)} · No mortgage obligations`
          : `Vacant (target ${formatCurrency(targetRentAmount)}) · No mortgage obligations`;
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

      const maintenanceButton = document.createElement("button");
      maintenanceButton.type = "button";
      maintenanceButton.className = "btn btn-outline-secondary btn-sm";
      maintenanceButton.textContent = "Schedule maintenance";
      const canSchedule = !isPropertyVacant(property) && maintenancePercent < 100;
      maintenanceButton.disabled = !canSchedule;
      maintenanceButton.addEventListener("click", () => scheduleMaintenance(property.id));

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

      actionWrapper.append(rentBadge, maintenanceButton, sellButton);

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
        financeState.fixedPeriodYears = resolveFixedPeriodSelection(
          financeState.termYears,
          financeState.fixedPeriodYears
        );
        renderFinanceTermOptions();
        renderFinanceFixedPeriodOptions();
        updateFinancePreview();
      });
    }

    if (elements.financeFixedPeriodOptions) {
      elements.financeFixedPeriodOptions.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-fixed-period-years]");
        if (!button || button.disabled) {
          return;
        }
        const years = Number.parseInt(button.dataset.fixedPeriodYears, 10);
        if (!Number.isFinite(years)) {
          return;
        }
        financeState.fixedPeriodYears = resolveFixedPeriodSelection(
          financeState.termYears,
          years
        );
        renderFinanceFixedPeriodOptions();
        updateFinancePreview();
      });
    }

    if (elements.financePaymentTypeOptions) {
      elements.financePaymentTypeOptions.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-interest-only]");
        if (!button) {
          return;
        }
        const isInterestOnly = button.dataset.interestOnly === "true";
        financeState.interestOnly = isInterestOnly;
        renderFinancePaymentTypeOptions();
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
            fixedPeriodYears: financeState.fixedPeriodYears,
          });
        const success = handleMortgagePurchase(property.id, {
          depositRatio: financeState.depositRatio,
          termYears: financeState.termYears,
          fixedPeriodYears: financeState.fixedPeriodYears,
          rateProfile: profile,
          interestOnly: financeState.interestOnly,
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
