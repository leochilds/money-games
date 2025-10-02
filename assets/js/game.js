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
    const clamped = Math.min(Math.max(value, 0), 100);
    return Math.round(clamped * 10) / 10;
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

  function getMaintenanceStartDelay(property) {
    if (!property?.maintenanceWork) {
      return 0;
    }
    const delay = property.maintenanceWork.startDelayMonths;
    if (!Number.isFinite(delay)) {
      return 0;
    }
    return Math.max(delay, 0);
  }

  function isMaintenanceScheduled(property) {
    return Boolean(property?.maintenanceWork);
  }

  function isPropertyVacant(property) {
    if (!property?.maintenanceWork) {
      return false;
    }
    if (getMaintenanceStartDelay(property) > 0) {
      return false;
    }
    return (property.maintenanceWork.monthsRemaining ?? 0) > 0;
  }

  function getMaintenanceThreshold() {
    const threshold = MAINTENANCE_CONFIG.criticalThreshold;
    return Number.isFinite(threshold) ? threshold : 25;
  }

  function isMaintenanceBelowRentalThreshold(property) {
    if (!property) {
      return false;
    }
    const maintenancePercent = clampMaintenancePercent(property.maintenancePercent ?? 0);
    return maintenancePercent < getMaintenanceThreshold();
  }

  function canAdvertiseForRent(property) {
    if (!property) {
      return false;
    }
    if (isPropertyVacant(property)) {
      return false;
    }
    if (isMaintenanceScheduled(property)) {
      return false;
    }
    return !isMaintenanceBelowRentalThreshold(property);
  }

  function hasActiveTenant(property) {
    return Boolean(property?.tenant && (property.tenant.leaseMonthsRemaining ?? 0) > 0);
  }

  function getTenantMonthsRemaining(property) {
    if (!hasActiveTenant(property)) {
      return 0;
    }
    const tenant = property.tenant ?? {};
    const remaining = tenant.leaseMonthsRemaining ?? property.leaseMonthsRemaining ?? tenant.leaseLengthMonths ?? 0;
    const numericRemaining = Number(remaining);
    if (!Number.isFinite(numericRemaining)) {
      return 0;
    }
    return Math.max(Math.round(numericRemaining), 0);
  }

  function forecastMaintenancePercent(property, { maintenancePercent, delayMonths } = {}) {
    let basePercentCandidate;
    if (Number.isFinite(maintenancePercent)) {
      basePercentCandidate = maintenancePercent;
    } else if (Number.isFinite(property?.maintenancePercent)) {
      basePercentCandidate = property.maintenancePercent;
    } else if (
      Array.isArray(MAINTENANCE_CONFIG.initialPercentRange) &&
      MAINTENANCE_CONFIG.initialPercentRange.length === 2
    ) {
      const [minPercent, maxPercent] = MAINTENANCE_CONFIG.initialPercentRange;
      basePercentCandidate = Number.isFinite(maxPercent)
        ? maxPercent
        : Number.isFinite(minPercent)
        ? minPercent
        : 100;
    } else {
      basePercentCandidate = 100;
    }
    const currentPercent = clampMaintenancePercent(basePercentCandidate);

    const delay = Number.isFinite(delayMonths)
      ? Math.max(delayMonths, 0)
      : getTenantMonthsRemaining(property);

    if (delay <= 0) {
      return currentPercent;
    }

    const occupiedDecay = MAINTENANCE_CONFIG.occupiedDecayPerMonth ?? 0;
    const projected = currentPercent - occupiedDecay * delay;
    return clampMaintenancePercent(projected);
  }

  function estimateMaintenanceCost(property, { delayMonths } = {}) {
    if (!property) {
      return {
        baseValue: 0,
        projectedCost: 0,
        projectedPercent: 0,
        deficiencyRatio: 0,
      };
    }

    const baseValue = Number.isFinite(property.baseValue)
      ? property.baseValue
      : calculatePropertyValue(property);
    const projectedPercent = forecastMaintenancePercent(property, { delayMonths });
    const deficiencyRatio = Math.max(0, 100 - projectedPercent) / 100;
    const costRatio = MAINTENANCE_CONFIG.refurbishmentCostRatio ?? 0.25;
    const projectedCost = roundCurrency(baseValue * costRatio * deficiencyRatio);

    return { baseValue, projectedCost, projectedPercent, deficiencyRatio };
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

  const LEASE_LENGTH_CHOICES = [6, 12, 18, 24, 36];
  const RENT_RATE_OFFSETS = [
    0.01,
    0.02,
    0.03,
    0.04,
    0.05,
    0.06,
    0.07,
    0.08,
    0.09,
    0.1,
  ];

  function createRentPlanKey(leaseMonths, rateOffset) {
    const leaseValue = Number.isFinite(leaseMonths) ? Math.round(leaseMonths) : 12;
    const offsetPercent = Math.round((rateOffset ?? 0.05) * 100);
    return `lease-${leaseValue}-rate-${offsetPercent}`;
  }

  function parseRentPlanKey(optionKey) {
    if (typeof optionKey !== "string") {
      return null;
    }
    const match = /^lease-(\d+)-rate-(\d+)$/.exec(optionKey);
    if (!match) {
      return null;
    }
    const leaseMonths = Number.parseInt(match[1], 10);
    const ratePercent = Number.parseInt(match[2], 10);
    if (!Number.isFinite(leaseMonths) || !Number.isFinite(ratePercent)) {
      return null;
    }
    return {
      leaseMonths,
      rateOffset: ratePercent / 100,
    };
  }

  function normaliseChoice(value, choices, fallback) {
    if (!Array.isArray(choices) || choices.length === 0) {
      return fallback;
    }
    const validFallback = choices.includes(fallback) ? fallback : choices[Math.floor(choices.length / 2)];
    if (choices.includes(value)) {
      return value;
    }
    const numericValue = Number.isFinite(value) ? Number(value) : Number.NaN;
    if (Number.isNaN(numericValue)) {
      return validFallback;
    }
    return choices.reduce((closest, option) => {
      if (!Number.isFinite(option)) {
        return closest;
      }
      const currentDistance = Math.abs(option - numericValue);
      const bestDistance = Math.abs(closest - numericValue);
      return currentDistance < bestDistance ? option : closest;
    }, choices[0]);
  }

  function resolveLeaseMonths(value) {
    return normaliseChoice(value, LEASE_LENGTH_CHOICES, 12);
  }

  function resolveRateOffset(value) {
    return normaliseChoice(value, RENT_RATE_OFFSETS, 0.05);
  }

  function resolveRentSettings(property, overrides = {}) {
    const parsed = parseRentPlanKey(property?.askingRentOption);
    const settings = {
      leaseMonths:
        overrides.leaseMonths ??
        property?.rentSettings?.leaseMonths ??
        parsed?.leaseMonths ??
        property?.tenant?.leaseLengthMonths ??
        12,
      rateOffset:
        overrides.rateOffset ??
        property?.rentSettings?.rateOffset ??
        parsed?.rateOffset ??
        0.05,
    };

    return {
      leaseMonths: resolveLeaseMonths(settings.leaseMonths),
      rateOffset: resolveRateOffset(settings.rateOffset),
    };
  }

  function calculateTenantProbability(property, leaseMonths, rateOffset) {
    const demandScore = clampDemandScore(property?.demandScore);
    const baseProbability = Math.min(0.2 + (demandScore / 10) * 0.6, 0.95);

    const rentIndex = Math.max(RENT_RATE_OFFSETS.indexOf(rateOffset), 0);
    const rentRatio = RENT_RATE_OFFSETS.length > 1
      ? rentIndex / (RENT_RATE_OFFSETS.length - 1)
      : 0;
    const rentFactor = Math.max(1 - rentRatio * 0.5, 0.35);

    const leaseIndex = Math.max(LEASE_LENGTH_CHOICES.indexOf(leaseMonths), 0);
    const leaseRatio = LEASE_LENGTH_CHOICES.length > 1
      ? leaseIndex / (LEASE_LENGTH_CHOICES.length - 1)
      : 0;

    let leaseFactor = 1;
    if (rateOffset < 0.05) {
      leaseFactor += (leaseRatio - 0.5) * 0.4;
    } else if (rateOffset > 0.06) {
      leaseFactor += (0.5 - leaseRatio) * 0.4;
    }

    const probability = Math.min(
      Math.max(baseProbability * rentFactor * Math.max(leaseFactor, 0.6), 0.05),
      0.95
    );

    return Math.round(probability * 1000) / 1000;
  }

  function buildRentPlan(property, leaseMonths, rateOffset) {
    const resolvedLease = resolveLeaseMonths(leaseMonths);
    const resolvedRate = resolveRateOffset(rateOffset);
    const propertyCost = Number.isFinite(property?.cost)
      ? property.cost
      : calculateMaintenanceAdjustedValue(
          Number.isFinite(property?.baseValue)
            ? property.baseValue
            : calculatePropertyValue(property),
          property?.maintenancePercent ?? getInitialMaintenancePercent()
        );

    const defaultBaseRate = FINANCE_CONFIG?.centralBank?.initialRate ?? 0;
    const baseRateCandidate = Number.isFinite(state.centralBankRate)
      ? state.centralBankRate
      : defaultBaseRate;
    const baseRate = Math.max(baseRateCandidate ?? 0, 0);
    const annualRate = Math.max(baseRate + resolvedRate, 0.001);
    const monthlyRent = roundCurrency((propertyCost * annualRate) / 12);
    const probability = calculateTenantProbability(property, resolvedLease, resolvedRate);
    const offsetPercent = Math.round(resolvedRate * 100);

    return {
      key: createRentPlanKey(resolvedLease, resolvedRate),
      leaseMonths: resolvedLease,
      rateOffset: resolvedRate,
      monthlyRent,
      annualRate,
      probability,
      label: `Lease ${resolvedLease} months · Base +${offsetPercent}%`,
    };
  }

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

    return RENT_RATE_OFFSETS.flatMap((rateOffset) =>
      LEASE_LENGTH_CHOICES.map((leaseMonths) => buildRentPlan(property, leaseMonths, rateOffset))
    );
  }

  function initialiseManagementFinancingState() {
    Object.assign(managementState.financing, {
      depositRatio: FINANCE_CONFIG.defaultDepositRatio,
      termYears: FINANCE_CONFIG.defaultTermYears,
      fixedPeriodYears: FINANCE_CONFIG.defaultFixedPeriodYears,
      interestOnly: false,
      rateProfile: null,
      previewMortgage: null,
      canAffordDeposit: false,
    });
    Object.assign(managementState.refinance, {
      fixedPeriodYears: FINANCE_CONFIG.defaultFixedPeriodYears,
      rateProfile: null,
      preview: null,
    });
  }

  function setManagementSection(sectionKey) {
    const sections = elements.managementSections ?? {};
    const availableSections = Object.keys(sections);
    const resolvedSection = availableSections.includes(sectionKey)
      ? sectionKey
      : availableSections[0] ?? "overview";
    managementState.activeSection = resolvedSection;

    if (elements.managementSectionNav) {
      const navButtons = elements.managementSectionNav.querySelectorAll(
        ".management-nav-link"
      );
      navButtons.forEach((button) => {
        const isActive = button.dataset.section === resolvedSection;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-selected", isActive ? "true" : "false");
      });
    }

    availableSections.forEach((key) => {
      const panel = sections[key];
      if (panel) {
        panel.classList.toggle("active", key === resolvedSection);
      }
    });
  }

  function resolveManagedProperty() {
    const { propertyId } = managementState;
    if (!propertyId) {
      return { property: null, scope: managementState.scope };
    }

    const priorityScopes = managementState.scope === "portfolio"
      ? ["portfolio", "market"]
      : managementState.scope === "market"
        ? ["market", "portfolio"]
        : ["portfolio", "market"];

    for (const scope of priorityScopes) {
      const collection = scope === "portfolio" ? state.portfolio : state.market;
      const match = collection.find((item) => item.id === propertyId);
      if (match) {
        managementState.scope = scope;
        return { property: match, scope };
      }
    }

    return { property: null, scope: null };
  }

  function makeManagementTag(label, className = "badge bg-secondary") {
    const tag = document.createElement("span");
    tag.className = `badge rounded-pill ${className}`;
    tag.textContent = label;
    return tag;
  }

  function createManagementStatCard(title, value, description = "") {
    const card = document.createElement("div");
    card.className = "stat-card";
    const heading = document.createElement("h6");
    heading.textContent = title;
    const valueNode = document.createElement("strong");
    valueNode.textContent = value;
    card.append(heading, valueNode);
    if (description) {
      const descriptionNode = document.createElement("div");
      descriptionNode.className = "small text-muted";
      descriptionNode.textContent = description;
      card.append(descriptionNode);
    }
    return card;
  }

  function renderManagementSummary(property, scope) {
    if (!elements.managementModalSummary) {
      return;
    }

    elements.managementModalSummary.innerHTML = "";

    const tagContainer = document.createElement("div");
    tagContainer.className = "management-tags";

    const scopeLabel = scope === "portfolio" ? "Owned asset" : "Market listing";
    const scopeClass = scope === "portfolio" ? "bg-success" : "bg-info text-dark";
    tagContainer.append(makeManagementTag(scopeLabel, scopeClass));

    if (hasActiveTenant(property)) {
      tagContainer.append(makeManagementTag("Occupied", "bg-success"));
    } else {
      tagContainer.append(makeManagementTag("Vacant", "bg-secondary"));
    }

    if (property.rentalMarketingActive) {
      tagContainer.append(makeManagementTag("Advertising", "bg-warning text-dark"));
    }

    if (property.mortgage) {
      tagContainer.append(makeManagementTag("Financed", "bg-primary"));
      if (property.mortgage.variableRateActive) {
        tagContainer.append(makeManagementTag("Variable rate", "bg-warning text-dark"));
      }
    }

    const rentOption = findRentStrategyOption(property, property.askingRentOption);
    const activeTenant = hasActiveTenant(property);
    const rentLabel = activeTenant
      ? formatCurrency(property.tenant?.rent ?? 0)
      : formatCurrency(rentOption?.monthlyRent ?? 0);
    const rentDescription = activeTenant
      ? "Current rent"
      : rentOption
        ? `${Math.round((rentOption.probability ?? 0) * 100)}% monthly placement · ${rentOption.leaseMonths}-month lease · Base +${Math.round((rentOption.rateOffset ?? 0) * 100)}%`
        : "Target rent";
    const maintenancePercent = clampMaintenancePercent(property.maintenancePercent ?? 0);
    let maintenanceDescription = "Condition rating";
    if (property.maintenanceWork) {
      const delay = getMaintenanceStartDelay(property);
      maintenanceDescription = delay > 0
        ? "Maintenance scheduled after lease"
        : "Maintenance scheduled";
    }

    const statsContainer = document.createElement("div");
    statsContainer.className = "management-summary-stats";
    statsContainer.append(
      createManagementStatCard("Value", formatCurrency(property.cost), "Maintenance-adjusted price"),
      createManagementStatCard("Rent", rentLabel, rentDescription),
      createManagementStatCard("Maintenance", `${maintenancePercent}%`, maintenanceDescription)
    );

    if (scope === "portfolio") {
      const netCash = calculateNetCashForProperty(property);
      const netDescription = netCash >= 0 ? "Positive cash flow" : "Negative cash flow";
      statsContainer.append(
        createManagementStatCard("Net / month", formatCurrency(netCash), netDescription)
      );
    } else {
      const demandScore = property.demandScore ?? "-";
      statsContainer.append(
        createManagementStatCard("Demand", `${demandScore}/10`, "Local interest level")
      );
    }

    elements.managementModalSummary.append(tagContainer, statsContainer);

    if (elements.managementModalLabel) {
      elements.managementModalLabel.textContent = property.name;
    }

    if (elements.managementModalSubtitle) {
      const summaryParts = [
        `${property.bedrooms} bed`,
        `${property.bathrooms} bath`,
        formatPropertyType(property.propertyType),
      ];
      if (property.locationDescriptor) {
        summaryParts.push(property.locationDescriptor);
      }
      elements.managementModalSubtitle.textContent = summaryParts.filter(Boolean).join(" · ");
    }
  }

  function renderManagementOverviewSection(property, scope) {
    if (!elements.managementOverview) {
      return;
    }
    elements.managementOverview.innerHTML = "";

    const basicsCard = document.createElement("div");
    basicsCard.className = "section-card";
    basicsCard.innerHTML = "<h6>Property details</h6>";

    const detailsList = document.createElement("ul");
    detailsList.className = "list-unstyled small mb-0";
    const location = property.location ?? {};
    const proximityPercent = ((location.proximity ?? 0) * 100).toFixed(0);
    const schoolRating = location.schoolRating ?? "-";
    const crimeScore = location.crimeScore ?? "-";

    const detailItems = [
      `<strong>Type:</strong> ${formatPropertyType(property.propertyType)}`,
      `<strong>Bedrooms:</strong> ${property.bedrooms}`,
      `<strong>Bathrooms:</strong> ${property.bathrooms}`,
      property.locationDescriptor
        ? `<strong>Neighborhood:</strong> ${property.locationDescriptor}`
        : null,
      `<strong>Transit access:</strong> ${proximityPercent}%`,
      `<strong>Schools:</strong> ${schoolRating}/10`,
      `<strong>Crime score:</strong> ${crimeScore}/10`,
    ].filter(Boolean);

    detailItems.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = item;
      detailsList.append(li);
    });

    if ((property.features ?? []).length > 0) {
      const featuresRow = document.createElement("li");
      featuresRow.innerHTML = "<strong>Features:</strong>";
      const featureList = document.createElement("div");
      featureList.className = "d-flex flex-wrap gap-2 mt-1";
      property.features.forEach((feature) => {
        featureList.append(makeManagementTag(feature, "bg-light text-dark border"));
      });
      featuresRow.append(featureList);
      detailsList.append(featuresRow);
    }

    if (property.description) {
      const descriptionItem = document.createElement("li");
      descriptionItem.innerHTML = `<strong>Description:</strong> ${property.description}`;
      detailsList.append(descriptionItem);
    }

    basicsCard.append(detailsList);

    const performanceCard = document.createElement("div");
    performanceCard.className = "section-card";
    performanceCard.innerHTML = "<h6>Performance snapshot</h6>";

    const performanceList = document.createElement("ul");
    performanceList.className = "list-unstyled small mb-0";

    const vacancyMonths = property.vacancyMonths ?? 0;
    const marketingStatus = property.rentalMarketingActive ? "Active advertising" : "Not advertising";
    const demandScore = property.demandScore ?? "-";
    const annualYieldPercent = Number.isFinite(property.annualYield)
      ? `${(property.annualYield * 100).toFixed(1)}%`
      : "-";

    const performanceItems = [
      `<strong>Demand:</strong> ${demandScore}/10`,
      `<strong>Estimated yield:</strong> ${annualYieldPercent}`,
      `<strong>Vacancy months:</strong> ${vacancyMonths}`,
      `<strong>Marketing:</strong> ${marketingStatus}`,
    ];

    if (scope === "market" && Number.isFinite(property.marketAge)) {
      performanceItems.push(`<strong>Days on market:</strong> ${property.marketAge}`);
    }

    performanceItems.forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = item;
      performanceList.append(li);
    });

    performanceCard.append(performanceList);

    elements.managementOverview.append(basicsCard, performanceCard);
  }

  function renderManagementLeasingSection(property, scope) {
    if (!elements.managementLeasing) {
      return;
    }
    elements.managementLeasing.innerHTML = "";

    const statusCard = document.createElement("div");
    statusCard.className = "section-card";
    statusCard.innerHTML = "<h6>Leasing status</h6>";

    const statusList = document.createElement("ul");
    statusList.className = "list-unstyled small mb-0";
    const activeTenant = hasActiveTenant(property);
    const rentOption = findRentStrategyOption(property, property.askingRentOption);
    const maintenanceVacant = isPropertyVacant(property);
    const maintenanceScheduled = isMaintenanceScheduled(property);
    const maintenanceDelay = maintenanceScheduled
      ? getMaintenanceStartDelay(property)
      : 0;
    const maintenanceRestricted = isMaintenanceBelowRentalThreshold(property);
    const maintenanceThreshold = getMaintenanceThreshold();

    if (activeTenant) {
      statusList.innerHTML = `
        <li><strong>Status:</strong> Occupied (${formatLeaseCountdown(
          property.leaseMonthsRemaining
        )} remaining)</li>
        <li><strong>Rent:</strong> ${formatCurrency(property.tenant?.rent ?? 0)}</li>
      `;
    } else {
      const chance = rentOption
        ? `${Math.round((rentOption.probability ?? 0) * 100)}%`
        : "-";
      const statusNotes = [];
      if (maintenanceVacant) {
        statusNotes.push("maintenance in progress");
      } else if (maintenanceScheduled) {
        statusNotes.push(
          maintenanceDelay > 0
            ? "maintenance scheduled after current lease"
            : "maintenance scheduled"
        );
      }
      if (maintenanceRestricted && !maintenanceVacant) {
        statusNotes.push(`maintenance below ${maintenanceThreshold}%`);
      }
      const statusSuffix = statusNotes.length > 0 ? ` (${statusNotes.join("; ")})` : "";
      const rateLabel = rentOption
        ? ` · Base +${Math.round((rentOption.rateOffset ?? 0) * 100)}%`
        : "";
      const leaseLabel = rentOption ? ` · ${rentOption.leaseMonths}-month lease` : "";
      statusList.innerHTML = `
        <li><strong>Status:</strong> Vacant${statusSuffix}</li>
        <li><strong>Target rent:</strong> ${formatCurrency(
          rentOption?.monthlyRent ?? 0
        )} (${chance} monthly placement${leaseLabel}${rateLabel})</li>
      `;
    }
    if (maintenanceRestricted && activeTenant) {
      statusList.innerHTML += `<li><strong>Note:</strong> Maintenance must reach ${maintenanceThreshold}% before new tenancies can begin.</li>`;
    }
    statusList.innerHTML += `<li><strong>Auto-relist:</strong> ${
      property.autoRelist ? "Enabled" : "Disabled"
    }</li>`;
    statusList.innerHTML += `<li><strong>Marketing:</strong> ${
      property.rentalMarketingActive ? "Advertising" : "Idle"
    }</li>`;

    statusCard.append(statusList);

    const controlsCard = document.createElement("div");
    controlsCard.className = "section-card";
    controlsCard.innerHTML = "<h6>Leasing controls</h6>";

    if (rentOption) {
      const leaseGroup = document.createElement("div");
      leaseGroup.className = "mb-3";
      const leaseLabel = document.createElement("label");
      leaseLabel.className = "form-label small fw-semibold";
      leaseLabel.setAttribute("for", `management-lease-${property.id}`);
      leaseLabel.textContent = activeTenant ? "Next lease length" : "Lease length";
      const leaseSlider = document.createElement("input");
      leaseSlider.type = "range";
      leaseSlider.className = "form-range";
      leaseSlider.min = "0";
      leaseSlider.max = String(LEASE_LENGTH_CHOICES.length - 1);
      leaseSlider.step = "1";
      const leaseIndex = Math.max(LEASE_LENGTH_CHOICES.indexOf(rentOption.leaseMonths), 0);
      leaseSlider.value = String(leaseIndex);
      leaseSlider.id = `management-lease-${property.id}`;
      const leaseValue = document.createElement("div");
      leaseValue.className = "small text-muted";
      leaseValue.textContent = `${rentOption.leaseMonths} months`;
      leaseSlider.addEventListener("input", (event) => {
        const index = Number.parseInt(event.target.value, 10);
        const months = LEASE_LENGTH_CHOICES[index] ?? rentOption.leaseMonths;
        leaseValue.textContent = `${months} months`;
      });
      leaseSlider.addEventListener("change", (event) => {
        const index = Number.parseInt(event.target.value, 10);
        const months = LEASE_LENGTH_CHOICES[index] ?? rentOption.leaseMonths;
        handleRentOptionChange(
          property.id,
          { leaseMonths: months },
          { scope }
        );
        refreshManagementContext({ closeIfMissing: false });
      });
      leaseGroup.append(leaseLabel, leaseSlider, leaseValue);

      const rentGroup = document.createElement("div");
      rentGroup.className = "mb-3";
      const rentLabel = document.createElement("label");
      rentLabel.className = "form-label small fw-semibold";
      rentLabel.setAttribute("for", `management-rate-${property.id}`);
      rentLabel.textContent = activeTenant ? "Next rent premium" : "Rent premium";
      const rentSlider = document.createElement("input");
      rentSlider.type = "range";
      rentSlider.className = "form-range";
      rentSlider.min = "0";
      rentSlider.max = String(RENT_RATE_OFFSETS.length - 1);
      rentSlider.step = "1";
      const rateIndex = Math.max(RENT_RATE_OFFSETS.indexOf(rentOption.rateOffset), 0);
      rentSlider.value = String(rateIndex);
      rentSlider.id = `management-rate-${property.id}`;
      const rentValue = document.createElement("div");
      rentValue.className = "small text-muted";
      rentValue.textContent = `Base +${Math.round(rentOption.rateOffset * 100)}%`;
      rentSlider.addEventListener("input", (event) => {
        const index = Number.parseInt(event.target.value, 10);
        const rate = RENT_RATE_OFFSETS[index] ?? rentOption.rateOffset;
        rentValue.textContent = `Base +${Math.round(rate * 100)}%`;
      });
      rentSlider.addEventListener("change", (event) => {
        const index = Number.parseInt(event.target.value, 10);
        const rate = RENT_RATE_OFFSETS[index] ?? rentOption.rateOffset;
        handleRentOptionChange(
          property.id,
          { rateOffset: rate },
          { scope }
        );
        refreshManagementContext({ closeIfMissing: false });
      });
      rentGroup.append(rentLabel, rentSlider, rentValue);

      const rentSummary = document.createElement("div");
      rentSummary.className = "management-note";
      const chance = Math.round((rentOption.probability ?? 0) * 100);
      rentSummary.innerHTML = `
        <strong>Monthly rent:</strong> ${formatCurrency(rentOption.monthlyRent)}<br />
        <strong>Placement chance:</strong> ${chance}% per month<br />
        <strong>Lease length:</strong> ${rentOption.leaseMonths} months<br />
        <strong>Premium:</strong> Base +${Math.round((rentOption.rateOffset ?? 0) * 100)}%
      `;

      const rentHelp = document.createElement("div");
      rentHelp.className = "form-text small";
      rentHelp.textContent = activeTenant
        ? "Changes apply after the current lease ends."
        : "Lower premiums improve placement. Longer leases help below base +5%, while shorter leases help above base +6%.";

      controlsCard.append(leaseGroup, rentGroup, rentSummary, rentHelp);
    }

    const autoWrapper = document.createElement("div");
    autoWrapper.className = "form-check form-switch mb-3";
    const autoInput = document.createElement("input");
    autoInput.type = "checkbox";
    autoInput.className = "form-check-input";
    autoInput.id = `management-autorelist-${property.id}`;
    autoInput.checked = Boolean(property.autoRelist);
    autoInput.addEventListener("change", (event) => {
      handleAutoRelistToggle(property.id, event.target.checked, { scope });
      refreshManagementContext({ closeIfMissing: false });
    });
    const autoLabel = document.createElement("label");
    autoLabel.className = "form-check-label small";
    autoLabel.setAttribute("for", autoInput.id);
    autoLabel.textContent = "Auto-relist when vacant";
    autoWrapper.append(autoInput, autoLabel);
    controlsCard.append(autoWrapper);

    if (scope === "portfolio" && !activeTenant) {
      const marketingButton = document.createElement("button");
      marketingButton.type = "button";
      marketingButton.className = "btn btn-outline-primary";
      marketingButton.textContent = property.rentalMarketingActive
        ? "Pause advertising"
        : "List for rent";
      const maintenanceHolding = maintenanceVacant || maintenanceScheduled;
      marketingButton.disabled = maintenanceHolding || maintenanceRestricted;
      marketingButton.addEventListener("click", () => {
        handleMarketingToggle(property.id, !property.rentalMarketingActive);
        refreshManagementContext({ closeIfMissing: false });
      });
      controlsCard.append(marketingButton);
      if (maintenanceHolding || maintenanceRestricted) {
        const note = document.createElement("div");
        note.className = "management-note mt-2";
        if (maintenanceVacant) {
          note.textContent = "Advertising resumes once maintenance is complete.";
        } else if (maintenanceRestricted) {
          note.textContent = `Increase maintenance above ${maintenanceThreshold}% before advertising.`;
        } else {
          note.textContent = maintenanceDelay > 0
            ? "Advertising will resume after the scheduled maintenance window following the current lease."
            : "Advertising resumes once the scheduled maintenance is completed.";
        }
        controlsCard.append(note);
      }
    }

    elements.managementLeasing.append(statusCard, controlsCard);
  }

  function renderManagementFinancingSection(property, scope) {
    if (!elements.managementFinancing) {
      return;
    }
    elements.managementFinancing.innerHTML = "";

    if (scope === "portfolio") {
      const card = document.createElement("div");
      card.className = "section-card";
      card.innerHTML = "<h6>Mortgage status</h6>";
      const mortgage = property.mortgage;
      if (mortgage) {
        const breakdown = getMortgagePaymentBreakdown(mortgage);
        const lines = document.createElement("ul");
        lines.className = "list-unstyled small mb-0";
        lines.innerHTML = `
          <li><strong>Payment:</strong> ${formatCurrency(breakdown.monthlyPayment)} / month</li>
          <li><strong>Remaining term:</strong> ${formatLeaseCountdown(
            mortgage.remainingTermMonths / 12
          )}</li>
          <li><strong>Principal remaining:</strong> ${formatCurrency(
            breakdown.principalRemaining ?? mortgage.remainingBalance ?? 0
          )}</li>
        `;
        if (breakdown.variablePhase?.isActive) {
          lines.innerHTML += `<li><strong>Variable rate:</strong> ${(breakdown.variablePhase.reversionRate * 100).toFixed(2)}%</li>`;
        }
        card.append(lines);
      } else {
        const emptyState = document.createElement("div");
        emptyState.className = "management-empty-state";
        emptyState.textContent = "This property is owned outright with no active mortgage.";
        card.append(emptyState);
      }
      elements.managementFinancing.append(card);

      if (
        mortgage &&
        mortgage.variableRateActive &&
        mortgage.remainingBalance > 0.5 &&
        mortgage.remainingTermMonths > 0
      ) {
        const refinanceCard = document.createElement("div");
        refinanceCard.className = "section-card";
        refinanceCard.innerHTML = "<h6>Re-lock fixed rate</h6>";

        const { value, equity, ratio, outstanding } = calculatePropertyEquity(property);
        const equityLine = document.createElement("p");
        equityLine.className = "mb-1";
        equityLine.innerHTML = `<strong>Equity:</strong> ${formatCurrency(equity)} (${formatPercentage(
          ratio
        )} of ${formatCurrency(value)})`;

        const baseRateLine = document.createElement("p");
        baseRateLine.className = "mb-1 text-muted";
        baseRateLine.innerHTML = `<strong>Central bank base rate:</strong> ${formatInterestRate(
          state.centralBankRate
        )}`;

        const remainingTermYears = Math.max(mortgage.remainingTermMonths / 12, 1 / 12);
        let selectedFixedYears = managementState.refinance.fixedPeriodYears;
        if (!Number.isFinite(selectedFixedYears) || selectedFixedYears <= 0) {
          selectedFixedYears = Math.min(
            FINANCE_CONFIG.defaultFixedPeriodYears ?? remainingTermYears,
            remainingTermYears
          );
        }
        if (selectedFixedYears > remainingTermYears) {
          selectedFixedYears = remainingTermYears;
        }
        managementState.refinance.fixedPeriodYears = selectedFixedYears;

        const profile = deriveMortgageRateProfile({
          depositRatio: ratio,
          termYears: remainingTermYears,
          fixedPeriodYears: selectedFixedYears,
          baseRate: state.centralBankRate,
          allowFlexibleDepositRatio: true,
        });
        managementState.refinance.rateProfile = profile;

        const upcomingPayment = getNextMortgagePayment(mortgage);
        const newMonthlyPayment = mortgage.interestOnly
          ? roundCurrency(outstanding * (profile.fixedRate / 12))
          : calculateMortgageMonthlyPayment(
              outstanding,
              profile.fixedRate,
              remainingTermYears
            );
        const paymentDelta = roundCurrency(newMonthlyPayment - upcomingPayment);
        managementState.refinance.preview = {
          monthlyPayment: newMonthlyPayment,
          paymentDelta,
          equityRatio: ratio,
        };

        const fixedOptionsWrapper = document.createElement("div");
        fixedOptionsWrapper.className = "management-finance-options mt-2";
        let hasActiveOption = false;
        (FINANCE_CONFIG.fixedPeriodOptions ?? []).forEach((years) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "btn btn-outline-secondary";
          button.textContent = `${years} years`;
          button.dataset.refiFixedYears = years.toString();
          const disabled = years > remainingTermYears;
          if (disabled) {
            button.disabled = true;
          }
          const isActive = !disabled && Math.abs(years - selectedFixedYears) < 1e-6;
          if (isActive) {
            button.classList.add("active");
            button.setAttribute("aria-pressed", "true");
            hasActiveOption = true;
          } else {
            button.setAttribute("aria-pressed", "false");
          }
          fixedOptionsWrapper.append(button);
        });

        if (remainingTermYears > 0) {
          const roundedRemaining = Number(remainingTermYears.toFixed(2));
          const remainingButton = document.createElement("button");
          remainingButton.type = "button";
          remainingButton.className = "btn btn-outline-secondary";
          remainingButton.dataset.refiFixedYears = remainingTermYears.toString();
          remainingButton.textContent = `Full remaining term (${roundedRemaining}y)`;
          const isActive = Math.abs(selectedFixedYears - remainingTermYears) < 1e-6;
          if (isActive || !hasActiveOption) {
            remainingButton.classList.add("active");
            remainingButton.setAttribute("aria-pressed", "true");
            hasActiveOption = true;
          } else {
            remainingButton.setAttribute("aria-pressed", "false");
          }
          fixedOptionsWrapper.append(remainingButton);
        }

        fixedOptionsWrapper.addEventListener("click", (event) => {
          const button = event.target.closest("button[data-refi-fixed-years]");
          if (!button || button.disabled) {
            return;
          }
          const years = Number.parseFloat(button.dataset.refiFixedYears);
          if (!Number.isFinite(years) || years <= 0) {
            return;
          }
          managementState.refinance.fixedPeriodYears = years;
          refreshManagementContext({ closeIfMissing: false });
        });

        const rateSummary = document.createElement("p");
        rateSummary.className = "mb-1";
        const fixedDisplayYears = Number(selectedFixedYears.toFixed(2));
        rateSummary.innerHTML = `<strong>New fixed rate:</strong> ${(profile.fixedRate * 100).toFixed(
          2
        )}% for ${fixedDisplayYears} year${
          Math.abs(fixedDisplayYears - 1) < 1e-6 ? "" : "s"
        }`;

        const reversionSummary = document.createElement("p");
        reversionSummary.className = "mb-1 text-muted";
        reversionSummary.innerHTML = `<strong>Reversion:</strong> ${(profile.reversionRate * 100).toFixed(
          2
        )}% (base ${(profile.baseRate * 100).toFixed(2)}% + ${(profile.variableRateMargin * 100).toFixed(2)}%)`;

        const paymentSummary = document.createElement("p");
        paymentSummary.className = "mb-1";
        paymentSummary.innerHTML = `<strong>Payment with new fix:</strong> ${formatCurrency(
          newMonthlyPayment
        )} / month`;

        const deltaSummary = document.createElement("p");
        deltaSummary.className = `mb-2 ${
          paymentDelta < 0 ? "text-success" : paymentDelta > 0 ? "text-danger" : "text-muted"
        }`;
        const deltaText = paymentDelta === 0
          ? "no change"
          : `${paymentDelta > 0 ? "+" : ""}${formatCurrency(paymentDelta)}`;
        deltaSummary.innerHTML = `<strong>Change vs current payment:</strong> ${deltaText}`;

        const actionRow = document.createElement("div");
        actionRow.className = "management-actions";
        const actionButton = document.createElement("button");
        actionButton.type = "button";
        actionButton.className = "btn btn-primary";
        actionButton.textContent = "Lock new fixed rate";
        actionButton.addEventListener("click", () => {
          const success = handleMortgageRefinance(property.id, {
            fixedPeriodYears: managementState.refinance.fixedPeriodYears,
            rateProfile: managementState.refinance.rateProfile,
          });
          if (success) {
            managementState.refinance.fixedPeriodYears = FINANCE_CONFIG.defaultFixedPeriodYears;
            managementState.refinance.rateProfile = null;
            managementState.refinance.preview = null;
            const updated = refreshManagementContext({ closeIfMissing: false });
            if (!updated) {
              closeManagementModal();
            }
          }
        });
        actionRow.append(actionButton);

        refinanceCard.append(
          equityLine,
          baseRateLine,
          fixedOptionsWrapper,
          rateSummary,
          reversionSummary,
          paymentSummary,
          deltaSummary,
          actionRow
        );
        elements.managementFinancing.append(refinanceCard);
      } else {
        managementState.refinance.rateProfile = null;
        managementState.refinance.preview = null;
      }
      return;
    }

    managementState.financing.fixedPeriodYears = resolveFixedPeriodSelection(
      managementState.financing.termYears,
      managementState.financing.fixedPeriodYears
    );

    const rentOption = findRentStrategyOption(property, property.askingRentOption);
    const projectedRent = hasActiveTenant(property)
      ? property.tenant?.rent ?? 0
      : rentOption?.monthlyRent ?? 0;

    const rateProfile = deriveMortgageRateProfile({
      depositRatio: managementState.financing.depositRatio,
      termYears: managementState.financing.termYears,
      fixedPeriodYears: managementState.financing.fixedPeriodYears,
    });
    managementState.financing.rateProfile = rateProfile;

    const mortgage = createMortgageForCost(property.cost, {
      depositRatio: managementState.financing.depositRatio,
      termYears: managementState.financing.termYears,
      fixedPeriodYears: managementState.financing.fixedPeriodYears,
      interestOnly: managementState.financing.interestOnly,
      rateProfile,
    });
    managementState.financing.previewMortgage = mortgage;
    managementState.financing.canAffordDeposit = state.balance >= mortgage.deposit;

    const controlsCard = document.createElement("div");
    controlsCard.className = "section-card";
    controlsCard.innerHTML = "<h6>Financing controls</h6>";

    const depositGroup = document.createElement("div");
    depositGroup.className = "mb-3";
    const depositLabel = document.createElement("div");
    depositLabel.className = "small fw-semibold mb-2";
    depositLabel.textContent = "Deposit";
    const depositOptions = document.createElement("div");
    depositOptions.className = "management-finance-options";
    depositOptions.innerHTML = (FINANCE_CONFIG.depositOptions ?? [])
      .map((ratio) => {
        const isActive = Math.abs(ratio - managementState.financing.depositRatio) < 1e-6;
        return `
          <button type="button" class="btn btn-outline-secondary${
            isActive ? " active" : ""
          }" data-deposit-ratio="${ratio}" aria-pressed="${isActive}">
            ${formatPercentage(ratio)}
          </button>
        `;
      })
      .join("");
    depositOptions.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-deposit-ratio]");
      if (!button) {
        return;
      }
      const ratio = Number.parseFloat(button.dataset.depositRatio);
      if (!Number.isFinite(ratio)) {
        return;
      }
      managementState.financing.depositRatio = ratio;
      refreshManagementContext({ closeIfMissing: false });
    });
    depositGroup.append(depositLabel, depositOptions);
    controlsCard.append(depositGroup);

    const termGroup = document.createElement("div");
    termGroup.className = "mb-3";
    const termLabel = document.createElement("div");
    termLabel.className = "small fw-semibold mb-2";
    termLabel.textContent = "Term length";
    const termOptions = document.createElement("div");
    termOptions.className = "management-finance-options";
    termOptions.innerHTML = (FINANCE_CONFIG.termOptions ?? [])
      .map((years) => {
        const isActive = Math.abs(years - managementState.financing.termYears) < 1e-6;
        return `
          <button type="button" class="btn btn-outline-secondary${
            isActive ? " active" : ""
          }" data-term-years="${years}" aria-pressed="${isActive}">
            ${years} years
          </button>
        `;
      })
      .join("");
    termOptions.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-term-years]");
      if (!button) {
        return;
      }
      const years = Number.parseInt(button.dataset.termYears, 10);
      if (!Number.isFinite(years)) {
        return;
      }
      managementState.financing.termYears = years;
      managementState.financing.fixedPeriodYears = resolveFixedPeriodSelection(
        managementState.financing.termYears,
        managementState.financing.fixedPeriodYears
      );
      refreshManagementContext({ closeIfMissing: false });
    });
    termGroup.append(termLabel, termOptions);
    controlsCard.append(termGroup);

    const fixedGroup = document.createElement("div");
    fixedGroup.className = "mb-3";
    const fixedLabel = document.createElement("div");
    fixedLabel.className = "small fw-semibold mb-2";
    fixedLabel.textContent = "Fixed-rate period";
    const fixedOptions = document.createElement("div");
    fixedOptions.className = "management-finance-options";
    fixedOptions.innerHTML = (FINANCE_CONFIG.fixedPeriodOptions ?? [])
      .map((years) => {
        const disabled = years > managementState.financing.termYears;
        const isActive =
          !disabled && Math.abs(years - managementState.financing.fixedPeriodYears) < 1e-6;
        return `
          <button type="button" class="btn btn-outline-secondary${
            isActive ? " active" : ""
          }" data-fixed-period-years="${years}" aria-pressed="${isActive}" ${
            disabled ? "disabled" : ""
          }>
            ${years} years
          </button>
        `;
      })
      .join("");
    fixedOptions.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-fixed-period-years]");
      if (!button || button.disabled) {
        return;
      }
      const years = Number.parseInt(button.dataset.fixedPeriodYears, 10);
      if (!Number.isFinite(years)) {
        return;
      }
      managementState.financing.fixedPeriodYears = resolveFixedPeriodSelection(
        managementState.financing.termYears,
        years
      );
      refreshManagementContext({ closeIfMissing: false });
    });
    fixedGroup.append(fixedLabel, fixedOptions);
    controlsCard.append(fixedGroup);

    const paymentTypeGroup = document.createElement("div");
    paymentTypeGroup.className = "mb-3";
    const paymentLabel = document.createElement("div");
    paymentLabel.className = "small fw-semibold mb-2";
    paymentLabel.textContent = "Payment structure";
    const paymentOptions = document.createElement("div");
    paymentOptions.className = "management-finance-options";
    paymentOptions.innerHTML = `
      <button type="button" class="btn btn-outline-secondary${
        managementState.financing.interestOnly ? "" : " active"
      }" data-interest-only="false" aria-pressed="${
      managementState.financing.interestOnly ? "false" : "true"
    }">
        Repayment
      </button>
      <button type="button" class="btn btn-outline-secondary${
        managementState.financing.interestOnly ? " active" : ""
      }" data-interest-only="true" aria-pressed="${
      managementState.financing.interestOnly ? "true" : "false"
    }">
        Interest-only
      </button>
    `;
    paymentOptions.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-interest-only]");
      if (!button) {
        return;
      }
      managementState.financing.interestOnly = button.dataset.interestOnly === "true";
      refreshManagementContext({ closeIfMissing: false });
    });
    paymentTypeGroup.append(paymentLabel, paymentOptions);
    controlsCard.append(paymentTypeGroup);

    const preview = document.createElement("div");
    preview.className = "management-finance-preview";
    const netCashFlow = roundCurrency(projectedRent - mortgage.monthlyPayment);
    const previewLines = [
      `<p class="mb-1"><strong>Deposit:</strong> ${formatCurrency(mortgage.deposit)} (${formatPercentage(
        managementState.financing.depositRatio
      )})</p>`,
      `<p class="mb-1"><strong>Financed amount:</strong> ${formatCurrency(mortgage.principal)}</p>`,
      `<p class="mb-1"><strong>Payments:</strong> ${formatCurrency(
        mortgage.monthlyPayment
      )} / month${managementState.financing.interestOnly ? " (interest-only)" : ""}</p>`,
      `<p class="mb-1"><strong>Fixed rate:</strong> ${(rateProfile.fixedRate * 100).toFixed(
        2
      )}% for ${managementState.financing.fixedPeriodYears} year${
        managementState.financing.fixedPeriodYears === 1 ? "" : "s"
      }</p>`,
      `<p class="mb-0"><strong>Reversion rate:</strong> ${(rateProfile.reversionRate * 100).toFixed(
        2
      )}% (base ${(rateProfile.baseRate * 100).toFixed(2)}% + ${(rateProfile.variableRateMargin * 100).toFixed(2)}%)</p>`,
    ];
    if (!managementState.financing.interestOnly && projectedRent > 0) {
      const netLabel = netCashFlow >= 0 ? "text-success" : "text-danger";
      previewLines.splice(
        3,
        0,
        `<p class="mb-1 ${netLabel}"><strong>Net cash (rent - payment):</strong> ${
          netCashFlow >= 0
            ? `+${formatCurrency(netCashFlow)}`
            : formatCurrency(netCashFlow)
        }</p>`
      );
    }
    preview.innerHTML = previewLines.join("");
    if (!managementState.financing.canAffordDeposit) {
      preview.innerHTML += `<p class="mt-2 text-danger mb-0">Requires ${formatCurrency(
        roundCurrency(mortgage.deposit - state.balance)
      )} additional cash for the deposit.</p>`;
    } else {
      preview.innerHTML += `<p class="mt-2 text-success mb-0">Deposit affordable with ${formatCurrency(
        roundCurrency(state.balance - mortgage.deposit)
      )} remaining.</p>`;
    }
    if (managementState.financing.interestOnly) {
      preview.innerHTML += `<p class="mt-2 mb-0 text-muted">Principal of ${formatCurrency(
        mortgage.principal
      )} remains due at term end.</p>`;
    }

    controlsCard.append(preview);

    elements.managementFinancing.append(controlsCard);
  }

  function renderManagementTransactionsSection(property, scope) {
    if (!elements.managementTransactions) {
      return;
    }
    elements.managementTransactions.innerHTML = "";

    if (scope === "market") {
      const card = document.createElement("div");
      card.className = "section-card";
      card.innerHTML = "<h6>Purchase options</h6>";

      const cashLine = document.createElement("p");
      cashLine.className = "mb-1";
      const canAffordCash = state.balance >= property.cost;
      cashLine.innerHTML = `<strong>Cash purchase:</strong> ${formatCurrency(property.cost)} (${canAffordCash ? "Affordable" : "Insufficient funds"})`;

      const mortgage = managementState.financing.previewMortgage;
      const financeLine = document.createElement("p");
      financeLine.className = "mb-1";
      if (mortgage) {
        financeLine.innerHTML = `<strong>Mortgage:</strong> ${formatCurrency(
          mortgage.deposit
        )} deposit (${formatPercentage(managementState.financing.depositRatio)}) → ${formatCurrency(
          mortgage.monthlyPayment
        )} / month`;
      } else {
        financeLine.textContent = "Adjust deposit or term to preview financing.";
      }

      const actionRow = document.createElement("div");
      actionRow.className = "management-actions mt-3";

      const cashButton = document.createElement("button");
      cashButton.type = "button";
      cashButton.className = "btn btn-outline-primary";
      cashButton.textContent = "Buy with cash";
      cashButton.disabled = !canAffordCash;
      cashButton.addEventListener("click", () => {
        handleCashPurchase(property.id);
        const updated = refreshManagementContext({ closeIfMissing: false });
        if (!updated) {
          closeManagementModal();
        }
      });

      const financeButton = document.createElement("button");
      financeButton.type = "button";
      financeButton.className = "btn btn-primary";
      financeButton.textContent = "Confirm mortgage";
      financeButton.disabled = !managementState.financing.canAffordDeposit;
      financeButton.addEventListener("click", () => {
        const profile =
          managementState.financing.rateProfile ??
          deriveMortgageRateProfile({
            depositRatio: managementState.financing.depositRatio,
            termYears: managementState.financing.termYears,
            fixedPeriodYears: managementState.financing.fixedPeriodYears,
          });
        const success = handleMortgagePurchase(property.id, {
          depositRatio: managementState.financing.depositRatio,
          termYears: managementState.financing.termYears,
          fixedPeriodYears: managementState.financing.fixedPeriodYears,
          rateProfile: profile,
          interestOnly: managementState.financing.interestOnly,
        });
        if (success) {
          const updated = refreshManagementContext({ closeIfMissing: false });
          if (!updated) {
            closeManagementModal();
          }
        }
      });

      actionRow.append(cashButton, financeButton);
      card.append(cashLine, financeLine, actionRow);
      elements.managementTransactions.append(card);
      return;
    }

    const card = document.createElement("div");
    card.className = "section-card";
    card.innerHTML = "<h6>Ownership actions</h6>";

    const salePrice = calculateSalePrice(property);
    const maintenanceThreshold = MAINTENANCE_CONFIG.criticalThreshold ?? 25;
    const maintenancePercent = clampMaintenancePercent(property.maintenancePercent ?? 0);
    const mortgageBreakdown = property.mortgage
      ? getMortgagePaymentBreakdown(property.mortgage)
      : null;
    const outstanding = mortgageBreakdown?.principalRemaining ?? 0;
    const netProceeds = roundCurrency(salePrice - outstanding);
    const canSell =
      maintenancePercent >= maintenanceThreshold && !isPropertyVacant(property);

    const saleInfo = document.createElement("p");
    saleInfo.className = "mb-1";
    saleInfo.innerHTML = `<strong>Projected sale:</strong> ${formatCurrency(
      salePrice
    )}${outstanding > 0 ? ` (net ${formatCurrency(netProceeds)})` : ""}`;

    const restrictions = [];
    if (maintenancePercent < maintenanceThreshold) {
      restrictions.push(
        `Maintenance must be at least ${maintenanceThreshold}%.`
      );
    }
    if (isPropertyVacant(property)) {
      restrictions.push("Maintenance work must be complete before selling.");
    }

    const actionRow = document.createElement("div");
    actionRow.className = "management-actions mt-3";

    const sellButton = document.createElement("button");
    sellButton.type = "button";
    sellButton.className = "btn btn-outline-danger";
    sellButton.textContent = "Sell property";
    sellButton.disabled = !canSell;
    sellButton.addEventListener("click", () => {
      handleSale(property.id);
      const updated = refreshManagementContext({ closeIfMissing: true });
      if (!updated) {
        closeManagementModal();
      }
    });

    actionRow.append(sellButton);

    card.append(saleInfo);
    if (restrictions.length > 0) {
      const restrictionList = document.createElement("ul");
      restrictionList.className = "small text-muted mb-2";
      restrictions.forEach((message) => {
        const item = document.createElement("li");
        item.textContent = message;
        restrictionList.append(item);
      });
      card.append(restrictionList);
    }
    card.append(actionRow);
    elements.managementTransactions.append(card);
  }

  function renderManagementMaintenanceSection(property, scope) {
    if (!elements.managementMaintenance) {
      return;
    }
    elements.managementMaintenance.innerHTML = "";

    const card = document.createElement("div");
    card.className = "section-card";
    card.innerHTML = "<h6>Maintenance planning</h6>";

    const maintenancePercent = clampMaintenancePercent(property.maintenancePercent ?? 0);
    const progressWrapper = document.createElement("div");
    progressWrapper.className = "mb-3";
    const progressLabel = document.createElement("div");
    progressLabel.className = "small fw-semibold mb-1";
    progressLabel.textContent = `Condition: ${maintenancePercent}%`;
    const progressBar = document.createElement("div");
    progressBar.className = "management-progress";
    progressBar.role = "progressbar";
    progressBar.setAttribute("aria-valuenow", maintenancePercent.toString());
    progressBar.setAttribute("aria-valuemin", "0");
    progressBar.setAttribute("aria-valuemax", "100");
    const bar = document.createElement("div");
    bar.className = "management-progress-bar";
    bar.style.width = `${maintenancePercent}%`;
    progressBar.append(bar);
    progressWrapper.append(progressLabel, progressBar);
    card.append(progressWrapper);

    if (scope === "portfolio") {
      if (property.maintenanceWork) {
        const work = property.maintenanceWork;
        const workInfo = document.createElement("p");
        workInfo.className = "management-note mb-3";
        const delay = getMaintenanceStartDelay(property);
        if (delay > 0) {
          const leaseLabel = formatLeaseCountdown(delay);
          workInfo.textContent = `Maintenance scheduled to begin after the current lease (${leaseLabel} remaining). Estimated downtime 1 month (cost ${formatCurrency(
            work.cost ?? 0
          )}).`;
        } else {
          workInfo.textContent = `Maintenance underway: ${work.monthsRemaining} month(s) remaining (cost ${formatCurrency(
            work.cost ?? 0
          )}). Property is temporarily vacant.`;
        }
        card.append(workInfo);
      }

      const scheduleButton = document.createElement("button");
      scheduleButton.type = "button";
      scheduleButton.className = "btn btn-outline-secondary";
      scheduleButton.textContent = "Schedule maintenance";
      const tenantMonthsRemaining = getTenantMonthsRemaining(property);
      const { projectedCost, projectedPercent } = estimateMaintenanceCost(property, {
        delayMonths: tenantMonthsRemaining,
      });
      const canSchedule =
        !isMaintenanceScheduled(property) && maintenancePercent < 100 && projectedCost <= state.balance;
      scheduleButton.disabled = !canSchedule;
      scheduleButton.addEventListener("click", () => {
        scheduleMaintenance(property.id);
        refreshManagementContext({ closeIfMissing: false });
      });
      card.append(scheduleButton);

      const notes = document.createElement("div");
      notes.className = "management-note mt-3";
      if (maintenancePercent >= 100) {
        notes.textContent = "Property already at 100% maintenance.";
      } else if (isMaintenanceScheduled(property)) {
        const delay = getMaintenanceStartDelay(property);
        notes.textContent =
          delay > 0
            ? "Maintenance already scheduled to begin after the current lease."
            : "Maintenance already scheduled.";
      } else if (projectedCost > state.balance) {
        notes.textContent = `Requires ${formatCurrency(
          projectedCost
        )}, but balance is insufficient.`;
      } else {
        if (tenantMonthsRemaining > 0) {
          const leaseLabel = formatLeaseCountdown(tenantMonthsRemaining);
          notes.textContent = `Estimated cost ${formatCurrency(
            projectedCost
          )} (condition forecast to reach ${projectedPercent}% once work begins after ${leaseLabel}).`;
        } else {
          notes.textContent = `Estimated cost ${formatCurrency(projectedCost)} (paid upfront).`;
        }
      }
      card.append(notes);
    } else {
      const note = document.createElement("div");
      note.className = "management-note";
      note.textContent = "Maintenance scheduling becomes available once the property is owned.";
      card.append(note);
    }

    elements.managementMaintenance.append(card);
  }

  function renderManagementModal(property, scope) {
    if (!property) {
      if (elements.managementModalSummary) {
        elements.managementModalSummary.innerHTML = "<div class=\"management-empty-state\">This property is no longer available.</div>";
      }
      return;
    }

    renderManagementSummary(property, scope);
    renderManagementOverviewSection(property, scope);
    renderManagementLeasingSection(property, scope);
    renderManagementFinancingSection(property, scope);
    renderManagementTransactionsSection(property, scope);
    renderManagementMaintenanceSection(property, scope);
    setManagementSection(managementState.activeSection ?? "overview");
  }

  function refreshManagementContext({ closeIfMissing = true } = {}) {
    const { property, scope } = resolveManagedProperty();
    if (!property) {
      if (closeIfMissing) {
        closeManagementModal();
      } else if (elements.managementModalSummary) {
        elements.managementModalSummary.innerHTML = "<div class=\"management-empty-state\">Property details unavailable.</div>";
      }
      return null;
    }
    renderManagementModal(property, scope);
    return property;
  }

  function closeManagementModal() {
    if (managementModalInstance) {
      managementModalInstance.hide();
    } else if (elements.managementModal) {
      elements.managementModal.classList.remove("show", "d-block");
    }
    initialiseManagementFinancingState();
    managementState.propertyId = null;
    managementState.scope = null;
    managementState.activeSection = "overview";
  }

  function openManagementModal(propertyId, scope = "market") {
    managementState.propertyId = propertyId;
    managementState.scope = scope;
    managementState.activeSection = "overview";
    initialiseManagementFinancingState();

    const property = refreshManagementContext({ closeIfMissing: false });
    if (!property) {
      return;
    }

    if (!managementModalInstance && elements.managementModal && window.bootstrap?.Modal) {
      managementModalInstance = new window.bootstrap.Modal(elements.managementModal, {
        backdrop: "static",
      });
    }

    if (managementModalInstance) {
      managementModalInstance.show();
    } else if (elements.managementModal) {
      elements.managementModal.classList.add("show", "d-block");
    }
  }

  function findRentStrategyOption(property, optionKey) {
    if (!property) {
      return null;
    }

    const overrides =
      typeof optionKey === "string" ? parseRentPlanKey(optionKey) ?? {} : {};
    const settings = resolveRentSettings(property, overrides);
    return buildRentPlan(property, settings.leaseMonths, settings.rateOffset);
  }

  function ensurePropertyRentSettings(property) {
    if (!property) {
      return null;
    }

    const rentPlan = findRentStrategyOption(property, property.askingRentOption);
    if (!rentPlan) {
      return null;
    }

    property.rentSettings = {
      leaseMonths: rentPlan.leaseMonths,
      rateOffset: rentPlan.rateOffset,
    };
    property.askingRentOption = rentPlan.key;
    property.desiredMonthlyRent = rentPlan.monthlyRent;
    property.annualYield = rentPlan.annualRate;

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
        property.tenant.leaseMonthsRemaining ??
        property.leaseMonthsRemaining ??
        rentPlan.leaseMonths;
      property.tenant.leaseLengthMonths =
        property.tenant.leaseLengthMonths ?? property.tenant.leaseMonthsRemaining;
      property.tenant.optionKey = property.tenant.optionKey ?? rentPlan.key;
      property.monthlyRent = property.tenant.rent ?? rentPlan.monthlyRent;
      property.leaseMonthsRemaining = property.tenant.leaseMonthsRemaining;
      property.rentalMarketingActive = false;
      property.vacancyMonths = 0;
    }

    return rentPlan;
  }

  function startRentalMarketing(property) {
    if (!property) {
      return false;
    }
    ensurePropertyRentSettings(property);
    if (!canAdvertiseForRent(property)) {
      property.rentalMarketingActive = false;
      property.vacancyMonths = 0;
      if (
        property.autoRelist &&
        !isPropertyVacant(property) &&
        isMaintenanceBelowRentalThreshold(property)
      ) {
        property.rentalMarketingPausedForMaintenance = true;
      }
      return false;
    }
    property.rentalMarketingActive = true;
    property.vacancyMonths = 0;
    property.rentalMarketingPausedForMaintenance = false;
    return true;
  }

  function stopRentalMarketing(property) {
    if (!property) {
      return;
    }
    property.rentalMarketingActive = false;
    property.vacancyMonths = 0;
    property.rentalMarketingPausedForMaintenance = false;
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
    const maintenanceRestricted = isMaintenanceBelowRentalThreshold(property);
    const maintenanceThreshold = getMaintenanceThreshold();

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
        if (isMaintenanceScheduled(property)) {
          property.rentalMarketingActive = false;
          property.vacancyMonths = 0;
          property.rentalMarketingPausedForMaintenance = true;
          if (property.autoRelist) {
            events.push({
              type: "autoRelistDeferredMaintenance",
              property,
            });
          }
        } else if (property.autoRelist) {
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

    if (maintenanceVacancy) {
      if (property.rentalMarketingActive) {
        property.vacancyMonths = (property.vacancyMonths ?? 0) + 1;
      }
      return rentCollected;
    }

    if (maintenanceRestricted) {
      if (property.rentalMarketingActive) {
        property.rentalMarketingActive = false;
        property.vacancyMonths = 0;
        property.rentalMarketingPausedForMaintenance = true;
        events.push({
          type: "marketingPausedMaintenance",
          property,
          maintenancePercent: clampMaintenancePercent(property.maintenancePercent ?? 0),
          threshold: maintenanceThreshold,
        });
      }
      return rentCollected;
    }

    if (!property.rentalMarketingActive) {
      if (property.autoRelist && property.rentalMarketingPausedForMaintenance) {
        property.rentalMarketingActive = true;
        property.vacancyMonths = 0;
        property.rentalMarketingPausedForMaintenance = false;
        events.push({
          type: "marketingResumedMaintenance",
          property,
          maintenancePercent: clampMaintenancePercent(property.maintenancePercent ?? 0),
          threshold: maintenanceThreshold,
        });
      } else {
        return rentCollected;
      }
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
      const propertyVacant = isPropertyVacant(property);
      const tenantActive = hasActiveTenant(property);
      const decayRate = propertyVacant || !tenantActive
        ? MAINTENANCE_CONFIG.unoccupiedDecayPerMonth ?? 0
        : MAINTENANCE_CONFIG.occupiedDecayPerMonth ?? 0;

      property.maintenancePercent = clampMaintenancePercent(
        currentPercent - decayRate
      );

      rentCollected += progressPropertyTenancy(property, tenancyEvents);

      if (property.maintenanceWork) {
        const work = property.maintenanceWork;
        const delay = getMaintenanceStartDelay(property);
        if (delay > 0) {
          work.startDelayMonths = delay - 1;
          if (work.startDelayMonths <= 0) {
            work.startDelayMonths = 0;
            work.monthsRemaining = Math.max(work.monthsRemaining ?? 1, 1);
            property.rentalMarketingActive = false;
            property.vacancyMonths = 0;
            property.rentalMarketingPausedForMaintenance = true;
            tenancyEvents.push({
              type: "maintenanceBegan",
              property,
            });
          }
        }
      }

      if (propertyVacant && property.maintenanceWork) {
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
    pauseDepth: 0,
    isPaused: false,
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

  const managementState = {
    propertyId: null,
    scope: null,
    activeSection: "overview",
    financing: {
      depositRatio: FINANCE_CONFIG.defaultDepositRatio,
      termYears: FINANCE_CONFIG.defaultTermYears,
      fixedPeriodYears: FINANCE_CONFIG.defaultFixedPeriodYears,
      interestOnly: false,
      rateProfile: null,
      previewMortgage: null,
      canAffordDeposit: false,
    },
    refinance: {
      fixedPeriodYears: FINANCE_CONFIG.defaultFixedPeriodYears,
      rateProfile: null,
      preview: null,
    },
  };

  const uiState = {
    dirty: {
      market: true,
      income: true,
    },
  };

  let managementModalInstance = null;

  let generatedIdCounter = 1;

  function markMarketDirty() {
    uiState.dirty.market = true;
  }

  function markIncomeDirty() {
    uiState.dirty.income = true;
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
      marketAge: 0,
      introducedOnDay: state.day,
    };

    const baseValue = calculatePropertyValue(baseProperty);
    const maintenancePercent = deriveMaintenancePercent(
      archetype.maintenancePercentRange,
      getInitialMaintenancePercent()
    );
    const cost = calculateMaintenanceAdjustedValue(baseValue, maintenancePercent);
    const defaultPlan = buildRentPlan(
      {
        ...baseProperty,
        baseValue,
        cost,
        maintenancePercent,
      },
      resolveLeaseMonths(12),
      resolveRateOffset(0.05)
    );
    const estimatedYield = defaultPlan?.annualRate ?? mapDemandToAnnualYield(baseProperty.demandScore);
    const inheritedChance = 0.25 + (clampDemandScore(baseProperty.demandScore) / 10) * 0.35;
    const hasInheritedTenant = Math.random() < Math.min(Math.max(inheritedChance, 0), 0.75);

    let tenant = null;
    let leaseMonthsRemaining = 0;
    let monthlyRent = 0;

    if (hasInheritedTenant && defaultPlan) {
      const minLease = Math.max(defaultPlan.leaseMonths - 3, 6);
      const maxLease = defaultPlan.leaseMonths + 6;
      const leaseMonths = getRandomInt(minLease, maxLease);
      tenant = {
        rent: defaultPlan.monthlyRent,
        leaseMonthsRemaining: leaseMonths,
        leaseLengthMonths: leaseMonths,
        startedOnDay: Math.max(state.day - getRandomInt(0, Math.min(leaseMonths - 1, 6)), 1),
        inherited: true,
        optionKey: defaultPlan.key,
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
      desiredMonthlyRent:
        defaultPlan?.monthlyRent ?? Math.round((cost * (estimatedYield ?? 0.05)) / 12),
      askingRentOption: defaultPlan?.key ?? null,
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

    if (newListings.length > 0) {
      markMarketDirty();
      if (shouldUpdateUI) {
        updateUI({ refreshMarket: true });
      }
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
      markMarketDirty();
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
    elements.pauseBadge = document.getElementById("gamePausedBadge");
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
    elements.managementModal = document.getElementById("managementModal");
    elements.managementModalLabel = document.getElementById("managementModalLabel");
    elements.managementModalSubtitle = document.getElementById("managementModalSubtitle");
    elements.managementModalSummary = document.getElementById("managementModalSummary");
    elements.managementOverview = document.getElementById("managementOverview");
    elements.managementLeasing = document.getElementById("managementLeasing");
    elements.managementFinancing = document.getElementById("managementFinancing");
    elements.managementTransactions = document.getElementById("managementTransactions");
    elements.managementMaintenance = document.getElementById("managementMaintenance");
    elements.managementSectionNav = document.getElementById("managementSectionNav");
    elements.managementSections = {
      overview: document.getElementById("management-panel-overview"),
      leasing: document.getElementById("management-panel-leasing"),
      financing: document.getElementById("management-panel-financing"),
      transactions: document.getElementById("management-panel-transactions"),
      maintenance: document.getElementById("management-panel-maintenance"),
    };
  }

  function deriveMortgageRateProfile({
    depositRatio,
    termYears,
    fixedPeriodYears,
    baseRate,
    allowFlexibleDepositRatio = false,
  } = {}) {
    const { centralBank, rateModel, maximumRate, minimumRate } = FINANCE_CONFIG;
    const minDeposit = FINANCE_CONFIG.depositOptions[0];
    const maxDepositOption =
      FINANCE_CONFIG.depositOptions[FINANCE_CONFIG.depositOptions.length - 1];
    const flexibleUpperBound = allowFlexibleDepositRatio && Number.isFinite(depositRatio)
      ? Math.min(Math.max(depositRatio, maxDepositOption), 0.95)
      : maxDepositOption;
    const resolvedDepositRatio = Number.isFinite(depositRatio)
      ? Math.min(Math.max(depositRatio, minDeposit), flexibleUpperBound)
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

  function calculatePropertyEquity(property) {
    if (!property) {
      return { value: 0, outstanding: 0, equity: 0, ratio: 0 };
    }

    const value = Math.max(Number.isFinite(property.cost) ? property.cost : 0, 0);
    const outstanding = Math.max(
      Number.isFinite(property?.mortgage?.remainingBalance)
        ? property.mortgage.remainingBalance
        : 0,
      0
    );
    const equity = Math.max(value - outstanding, 0);
    const ratio = value > 0 ? Math.min(Math.max(equity / value, 0), 0.95) : 0;

    return { value, outstanding, equity, ratio };
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
      const defaultPlan = buildRentPlan(
        {
          ...property,
          baseValue,
          maintenancePercent,
          cost,
        },
        resolveLeaseMonths(12),
        resolveRateOffset(0.05)
      );
      const estimatedYield = defaultPlan?.annualRate ?? mapDemandToAnnualYield(property.demandScore);
      const inheritedChance = 0.25 + (clampDemandScore(property.demandScore) / 10) * 0.35;
      const hasTenant = Math.random() < Math.min(Math.max(inheritedChance, 0), 0.75);

      let tenant = null;
      let leaseMonthsRemaining = 0;
      let monthlyRent = 0;

      if (hasTenant && defaultPlan) {
        const minLease = Math.max(defaultPlan.leaseMonths - 3, 6);
        const maxLease = defaultPlan.leaseMonths + 6;
        const leaseMonths = getRandomInt(minLease, maxLease);
        tenant = {
          rent: defaultPlan.monthlyRent,
          leaseMonthsRemaining: leaseMonths,
          leaseLengthMonths: leaseMonths,
          startedOnDay: state.day,
          inherited: true,
          optionKey: defaultPlan.key,
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
        desiredMonthlyRent:
          defaultPlan?.monthlyRent ?? Math.round((cost * (estimatedYield ?? 0.05)) / 12),
        askingRentOption: defaultPlan?.key ?? null,
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
    state.pauseDepth = 0;
    state.isPaused = false;
    financeState.rateProfile = null;
    if (logInitialMessage) {
      addHistoryEntry("New game started with $1,000 in capital.");
      addHistoryEntry(
        `Central bank base rate set at ${(state.centralBankRate * 100).toFixed(2)}% to start the simulation.`
      );
    } else {
      renderHistory();
    }
    markMarketDirty();
    markIncomeDirty();
    updateUI({ refreshMarket: true, refreshIncome: true });
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
    if (state.isPaused) {
      state.timerId = null;
      return;
    }
    state.timerId = setInterval(handleDayTick, state.tickLength);
  }

  function pauseGame() {
    if (!Number.isFinite(state.pauseDepth)) {
      state.pauseDepth = 0;
    }
    state.pauseDepth += 1;
    if (state.pauseDepth === 1) {
      state.isPaused = true;
      if (state.timerId) {
        clearInterval(state.timerId);
        state.timerId = null;
      }
    }
    updatePauseUI();
  }

  function resumeGame() {
    if (!Number.isFinite(state.pauseDepth)) {
      state.pauseDepth = 0;
    }
    if (state.pauseDepth > 0) {
      state.pauseDepth -= 1;
    }
    if (state.pauseDepth <= 0) {
      state.pauseDepth = 0;
      if (state.isPaused) {
        state.isPaused = false;
        restartTimer();
      }
    }
    updatePauseUI();
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
    let marketChanged = false;
    let portfolioChanged = false;
    const rateChanged = adjustCentralBankRateIfNeeded();
    const daysSinceLastCollection = state.day - state.lastRentCollectionDay;
    const monthsElapsed = Math.floor(daysSinceLastCollection / 30);

    if (monthsElapsed > 0) {
      marketChanged = true;
      portfolioChanged = true;
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
                messageParts.push(`after ${chanceLabel} monthly placement chance.`);
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
            case "autoRelistDeferredMaintenance": {
              addHistoryEntry(
                `Auto-relisting paused for ${event.property.name}: maintenance has been scheduled to begin after the current lease.`
              );
              break;
            }
            case "marketingPausedMaintenance": {
              const maintenanceLabel = `${(event.maintenancePercent ?? 0).toFixed(1)}%`;
              addHistoryEntry(
                `Paused advertising for ${event.property.name}: maintenance at ${maintenanceLabel} is below the required ${event.threshold}%.`
              );
              break;
            }
            case "marketingResumedMaintenance": {
              const maintenanceLabel = `${(event.maintenancePercent ?? 0).toFixed(1)}%`;
              addHistoryEntry(
                `Resumed advertising for ${event.property.name}: maintenance improved to ${maintenanceLabel}, clearing the ${event.threshold}%.`
              );
              break;
            }
            case "maintenanceBegan": {
              addHistoryEntry(
                `Maintenance work began on ${event.property.name}. Property unavailable for tenants until work completes.`
              );
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

    if (marketUpdated) {
      marketChanged = true;
    }

    if (marketChanged) {
      markMarketDirty();
    }
    if (portfolioChanged) {
      markIncomeDirty();
    }

    updateUI({
      refreshMarket: marketChanged || rateChanged,
      refreshIncome: portfolioChanged,
    });
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

  function handleRentOptionChange(
    propertyId,
    settings,
    { scope, updateUI: shouldUpdateUI = true } = {}
  ) {
    const effectiveScope = scope === "portfolio" ? "portfolio" : "market";
    const collection = effectiveScope === "portfolio" ? state.portfolio : state.market;
    const property = collection.find((item) => item.id === propertyId);
    if (!property) {
      return null;
    }

    const overrides =
      typeof settings === "string" ? parseRentPlanKey(settings) ?? {} : settings ?? {};
    const currentPlan = ensurePropertyRentSettings(property);
    const leaseMonths = resolveLeaseMonths(
      overrides.leaseMonths ?? currentPlan?.leaseMonths
    );
    const rateOffset = resolveRateOffset(overrides.rateOffset ?? currentPlan?.rateOffset);
    const option = buildRentPlan(property, leaseMonths, rateOffset);
    if (!option) {
      return null;
    }

    property.rentSettings = {
      leaseMonths: option.leaseMonths,
      rateOffset: option.rateOffset,
    };
    property.askingRentOption = option.key;
    property.desiredMonthlyRent = option.monthlyRent;
    ensurePropertyRentSettings(property);
    if (!hasActiveTenant(property)) {
      property.vacancyMonths = 0;
    }

    if (effectiveScope === "portfolio") {
      const chance = Math.round((option.probability ?? 0) * 100);
      const rateLabel = `base +${Math.round(option.rateOffset * 100)}%`;
      const leaseLabel = `${option.leaseMonths}-month lease`;
      const timingNote = hasActiveTenant(property)
        ? " (applies after current lease)."
        : ".";
      addHistoryEntry(
        `Updated rent plan for ${property.name}: ${formatCurrency(option.monthlyRent)} (${rateLabel}, ${leaseLabel}, ${chance}% monthly placement)${timingNote}`
      );
    }

    if (effectiveScope === "portfolio") {
      markIncomeDirty();
    } else {
      markMarketDirty();
    }

    if (shouldUpdateUI) {
      if (effectiveScope === "portfolio") {
        updateUI({ refreshIncome: true });
      } else {
        updateUI({ refreshMarket: true });
      }
    }

    return option;
  }

  function handleAutoRelistToggle(propertyId, enabled, { scope } = {}) {
    const effectiveScope = scope === "portfolio" ? "portfolio" : "market";
    const collection = effectiveScope === "portfolio" ? state.portfolio : state.market;
    const property = collection.find((item) => item.id === propertyId);
    if (!property) {
      return;
    }

    property.autoRelist = Boolean(enabled);

    if (effectiveScope === "portfolio") {
      if (enabled && !hasActiveTenant(property) && !property.rentalMarketingActive) {
        const started = startRentalMarketing(property);
        if (started) {
          const option = findRentStrategyOption(property, property.askingRentOption);
          addHistoryEntry(
            `Auto-relisting enabled for ${property.name}: targeting ${formatCurrency(
              option?.monthlyRent ?? 0
            )} (${Math.round((option?.probability ?? 0) * 100)}% monthly placement · ${
              option?.leaseMonths ?? 0
            }-month lease · base +${Math.round((option?.rateOffset ?? 0) * 100)}%).`
          );
        } else {
          const maintenancePercent = clampMaintenancePercent(property.maintenancePercent ?? 0);
          const threshold = getMaintenanceThreshold();
          addHistoryEntry(
            `Auto-relisting enabled for ${property.name}, but maintenance at ${maintenancePercent.toFixed(1)}% must reach ${threshold}% before advertising can resume.`
          );
        }
      } else if (!enabled) {
        stopRentalMarketing(property);
        addHistoryEntry(`Auto-relisting disabled for ${property.name}.`);
      }
    }

    if (effectiveScope === "portfolio") {
      markIncomeDirty();
      updateUI({ refreshIncome: true });
    } else {
      markMarketDirty();
      updateUI({ refreshMarket: true });
    }
  }

  function handleMarketingToggle(propertyId, shouldMarket) {
    const property = state.portfolio.find((item) => item.id === propertyId);
    if (!property || hasActiveTenant(property)) {
      return;
    }

    if (shouldMarket) {
      const started = startRentalMarketing(property);
      if (started) {
        const option = findRentStrategyOption(property, property.askingRentOption);
        addHistoryEntry(
          `Listed ${property.name} for rent at ${formatCurrency(option?.monthlyRent ?? 0)} (${Math.round(
            (option?.probability ?? 0) * 100
          )}% monthly placement · ${option?.leaseMonths ?? 0}-month lease · base +${Math.round((option?.rateOffset ?? 0) * 100)}%).`
        );
      } else {
        const maintenancePercent = clampMaintenancePercent(property.maintenancePercent ?? 0);
        const threshold = getMaintenanceThreshold();
        addHistoryEntry(
          `Unable to list ${property.name} for rent: maintenance at ${maintenancePercent.toFixed(1)}% must reach ${threshold}%.`
        );
      }
    } else {
      stopRentalMarketing(property);
      addHistoryEntry(`Paused advertising for ${property.name}.`);
    }

    markIncomeDirty();
    updateUI({ refreshIncome: true });
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

    purchased.rentalMarketingPausedForMaintenance = false;

    if (purchased.tenant) {
      purchased.tenant.inherited = true;
      purchased.rentalMarketingActive = false;
      purchased.vacancyMonths = 0;
    } else {
      purchased.monthlyRent = 0;
      purchased.leaseMonthsRemaining = 0;
      if (purchased.autoRelist) {
        const started = startRentalMarketing(purchased);
        if (!started) {
          purchased.rentalMarketingActive = false;
          purchased.vacancyMonths = 0;
        }
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
    markMarketDirty();
    markIncomeDirty();
    updateUI({ refreshMarket: true, refreshIncome: true });
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
    markMarketDirty();
    markIncomeDirty();
    updateUI({ refreshMarket: true, refreshIncome: true });
    return true;
  }

  function handleMortgageRefinance(
    propertyId,
    { fixedPeriodYears, rateProfile } = {}
  ) {
    const property = state.portfolio.find((item) => item.id === propertyId);
    if (!property || !property.mortgage) {
      return false;
    }

    const mortgage = property.mortgage;
    if (!mortgage.variableRateActive || mortgage.remainingBalance <= 0.5) {
      return false;
    }

    const remainingTermMonths = Math.max(mortgage.remainingTermMonths ?? 0, 0);
    if (remainingTermMonths <= 0) {
      return false;
    }

    const { value, outstanding, equity, ratio } = calculatePropertyEquity(property);
    if (value <= 0 || outstanding <= 0) {
      return false;
    }

    const remainingTermYears = Math.max(remainingTermMonths / 12, 1 / 12);
    const requestedFixedYears = Number.isFinite(fixedPeriodYears)
      ? Math.max(Math.min(fixedPeriodYears, remainingTermYears), 1 / 12)
      : Math.min(
          FINANCE_CONFIG.defaultFixedPeriodYears ?? remainingTermYears,
          remainingTermYears
        );

    const profile = rateProfile
      ?? deriveMortgageRateProfile({
        depositRatio: ratio,
        termYears: remainingTermYears,
        fixedPeriodYears: requestedFixedYears,
        baseRate: state.centralBankRate,
        allowFlexibleDepositRatio: true,
      });

    const fixedRate = profile.fixedRate;
    const monthlyRate = fixedRate / 12;
    let monthlyPayment;

    if (mortgage.interestOnly) {
      monthlyPayment = roundCurrency(outstanding * monthlyRate);
    } else {
      monthlyPayment = calculateMortgageMonthlyPayment(
        outstanding,
        fixedRate,
        remainingTermYears
      );
    }

    const fixedYearsResolved = Math.min(
      profile.fixedPeriodYears ?? requestedFixedYears,
      remainingTermYears
    );
    const fixedPeriodMonths = Math.max(
      Math.min(Math.round(fixedYearsResolved * 12), remainingTermMonths),
      1
    );

    mortgage.baseRate = roundRate(profile.baseRate);
    mortgage.fixedRate = fixedRate;
    mortgage.annualInterestRate = fixedRate;
    mortgage.monthlyInterestRate = monthlyRate;
    mortgage.variableRateMargin = profile.variableRateMargin;
    mortgage.reversionRate = profile.reversionRate;
    mortgage.termMonths = remainingTermMonths;
    mortgage.termYears = Math.max(remainingTermMonths / 12, 1 / 12);
    mortgage.fixedPeriodYears = fixedYearsResolved;
    mortgage.fixedPeriodMonths = fixedPeriodMonths;
    mortgage.monthlyPayment = monthlyPayment;
    mortgage.variableRateActive = false;

    const equityPercent = formatPercentage(ratio);
    const fixedRateLabel = (fixedRate * 100).toFixed(2);
    const baseRateLabel = (profile.baseRate * 100).toFixed(2);
    const marginLabel = (profile.variableRateMargin * 100).toFixed(2);
    const reversionLabel = (profile.reversionRate * 100).toFixed(2);
    const fixedYearsLabel = Number(fixedYearsResolved.toFixed(2));
    const fixedPeriodLabel = `${fixedYearsLabel} year${
      Math.abs(fixedYearsLabel - 1) < 1e-6 ? "" : "s"
    }`;

    addHistoryEntry(
      `Locked a new fixed rate on ${property.name}: ${formatPercentage(
        ratio
      )} equity unlocked ${fixedRateLabel}% for ${fixedPeriodLabel} (base ${baseRateLabel}% + ${marginLabel}% = ${reversionLabel}% thereafter). New payment ${formatCurrency(
        monthlyPayment
      )} / month on ${formatCurrency(outstanding)} outstanding.`
    );

    if (equity > 0) {
      addHistoryEntry(
        `${property.name} now has ${formatCurrency(equity)} equity (${equityPercent} of current value ${formatCurrency(
          value
        )}).`
      );
    }

    markIncomeDirty();
    updateUI({ refreshIncome: true });
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
    markIncomeDirty();
    updateUI({ refreshIncome: true });
  }

  function scheduleMaintenance(propertyId) {
    const property = state.portfolio.find((item) => item.id === propertyId);
    if (!property) {
      return;
    }

    if (isMaintenanceScheduled(property)) {
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

    const tenantMonthsRemaining = getTenantMonthsRemaining(property);
    const { projectedCost, projectedPercent } = estimateMaintenanceCost(property, {
      delayMonths: tenantMonthsRemaining,
    });

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
      startDelayMonths: tenantMonthsRemaining,
    };

    if (tenantMonthsRemaining > 0) {
      const leaseLabel = formatLeaseCountdown(tenantMonthsRemaining);
      addHistoryEntry(
        `Scheduled maintenance for ${property.name}: work will begin once the current lease ends (${leaseLabel} remaining) and will require 1 month of vacancy (estimated cost ${formatCurrency(projectedCost)} based on an expected condition of ${projectedPercent}%).`
      );
    } else {
      addHistoryEntry(
        `Scheduled maintenance for ${property.name}: property will be vacant for 1 month (estimated cost ${formatCurrency(projectedCost)}).`
      );
    }
    markIncomeDirty();
    updateUI({ refreshIncome: true });
  }

  function renderProperties() {
    elements.propertyList.innerHTML = "";
    state.market.forEach((property) => {
      const col = document.createElement("div");
      col.className = "col";

      const card = document.createElement("div");
      card.className = "card property-card h-100";

      const cardBody = document.createElement("div");
      cardBody.className = "card-body d-flex flex-column gap-2";

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
      if (activeTenant) {
        rent.innerHTML = `<strong>Current rent:</strong> ${formatCurrency(
          property.tenant.rent
        )} <span class="text-muted">(${formatLeaseCountdown(
          property.leaseMonthsRemaining
        )} remaining)</span>`;
      } else {
        const chance = Number.isFinite(rentOption?.probability)
          ? `${Math.round((rentOption.probability ?? 0) * 100)}%`
          : "-";
        const leaseMonths = rentOption?.leaseMonths ?? 0;
        const rateLabel = rentOption
          ? ` · Base +${Math.round((rentOption.rateOffset ?? 0) * 100)}%`
          : "";
        rent.innerHTML = `<strong>Target rent:</strong> ${formatCurrency(
          rentOption?.monthlyRent ?? 0
        )} <span class="text-muted">(${chance} monthly placement · ${leaseMonths}-month lease${rateLabel})</span>`;
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
        statusWrapper.append(
          createStatusChip(
            property.autoRelist ? "Auto-relist on" : "Auto-relist off",
            property.autoRelist ? "bg-success" : "bg-light text-muted border"
          )
        );
      }

      const detailSection = document.createElement("div");
      detailSection.className = "mb-3 flex-grow-1";
      detailSection.append(
        summary,
        ...(features.childElementCount ? [features] : []),
        locationDetails,
        demand,
        maintenanceWrapper
      );

      const manageButton = document.createElement("button");
      manageButton.type = "button";
      manageButton.className = "btn btn-primary mt-auto";
      manageButton.textContent = "Manage";
      manageButton.setAttribute("aria-label", `Manage ${property.name}`);
      manageButton.addEventListener("click", () => {
        openManagementModal(property.id, "market");
      });

      [title, description, detailSection, cost, statusWrapper, rent, manageButton]
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
          )}% monthly placement · ${rentOption?.leaseMonths ?? 0}-month lease · base +${Math.round(
            (rentOption?.rateOffset ?? 0) * 100
          )}%)`;
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
        tenantStatusWrapper.append(
          createStatusChip(
            property.autoRelist ? "Auto-relist on" : "Auto-relist off",
            property.autoRelist ? "bg-success" : "bg-light text-muted border"
          )
        );
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
      const formatPortfolioRentMeta = (option) => {
        const chance = Number.isFinite(option?.probability)
          ? `${Math.round((option.probability ?? 0) * 100)}%`
          : "-";
        const leaseMonths = option?.leaseMonths ?? 0;
        const rateLabel = option
          ? ` · Base +${Math.round((option.rateOffset ?? 0) * 100)}%`
          : "";
        return ` · ${chance} monthly placement · ${leaseMonths}-month lease${rateLabel}`;
      };
      let portfolioRentValueNode = null;
      let portfolioRentMetaNode = null;
      if (activeTenant) {
        tenancyDetails.innerHTML = `<strong>Current rent:</strong> ${formatCurrency(
          property.tenant.rent
        )} (lease ${formatLeaseCountdown(property.leaseMonthsRemaining)} remaining)`;
      } else {
        const tenancyLabel = document.createElement("strong");
        tenancyLabel.textContent = "Target rent:";
        portfolioRentValueNode = document.createElement("span");
        portfolioRentValueNode.textContent = formatCurrency(targetRentAmount);
        portfolioRentMetaNode = document.createElement("span");
        portfolioRentMetaNode.textContent = formatPortfolioRentMeta(rentOption);
        tenancyDetails.append(
          tenancyLabel,
          document.createTextNode(" "),
          portfolioRentValueNode,
          portfolioRentMetaNode
        );
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
      if (property.maintenanceWork) {
        maintenanceNotes.push(
          getMaintenanceStartDelay(property) > 0
            ? "maintenance scheduled after lease"
            : "maintenance scheduled"
        );
      }
      if (isMaintenanceBelowRentalThreshold(property)) {
        maintenanceNotes.push(`below ${getMaintenanceThreshold()}% (leasing paused)`);
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
          : `Vacant (target ${formatCurrency(rentOption?.monthlyRent ?? 0)})`;
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
        const rentDescriptor = activeTenant
          ? `Rent ${formatCurrency(activeRentAmount)}`
          : `Vacant (target ${formatCurrency(rentOption?.monthlyRent ?? 0)})`;
        summaryLine.textContent = `${rentDescriptor} · No mortgage obligations`;
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

      const manageButton = document.createElement("button");
      manageButton.type = "button";
      manageButton.className = "btn btn-primary btn-sm";
      manageButton.textContent = "Manage";
      manageButton.setAttribute("aria-label", `Manage ${property.name}`);
      manageButton.addEventListener("click", () => {
        openManagementModal(property.id, "portfolio");
      });

      actionWrapper.append(rentBadge, manageButton);

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

  function updatePauseUI() {
    if (elements.speedControl) {
      elements.speedControl.disabled = Boolean(state.isPaused);
    }
    if (elements.pauseBadge) {
      elements.pauseBadge.classList.toggle("d-none", !state.isPaused);
    }
  }

  function updateUI({ refreshMarket, refreshIncome } = {}) {
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
    const shouldRenderMarket =
      typeof refreshMarket === "boolean" ? refreshMarket : uiState.dirty.market;
    if (shouldRenderMarket) {
      renderProperties();
      uiState.dirty.market = false;
    }

    const shouldRenderIncome =
      typeof refreshIncome === "boolean" ? refreshIncome : uiState.dirty.income;
    if (shouldRenderIncome) {
      renderIncomeStatus();
      uiState.dirty.income = false;
    }

    renderHistory();
    updatePauseUI();
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
      elements.financeModal.addEventListener("show.bs.modal", pauseGame);
      elements.financeModal.addEventListener("hidden.bs.modal", () => {
        financeState.propertyId = null;
        financeState.rateProfile = null;
        resumeGame();
      });
    }
  }

  function wireUpManagementModal() {
    if (elements.managementSectionNav) {
      elements.managementSectionNav.addEventListener("click", (event) => {
        const button = event.target.closest(".management-nav-link");
        if (!button) {
          return;
        }
        const section = button.dataset.section;
        if (section) {
          setManagementSection(section);
        }
      });
    }

    if (elements.managementModal) {
      elements.managementModal.addEventListener("show.bs.modal", pauseGame);
      elements.managementModal.addEventListener("hide.bs.modal", () => {
        managementState.activeSection = "overview";
      });
      elements.managementModal.addEventListener("hidden.bs.modal", () => {
        initialiseManagementFinancingState();
        managementState.propertyId = null;
        managementState.scope = null;
        resumeGame();
      });
    }
  }

  function wireUpEvents() {
    elements.resetButton.addEventListener("click", () => {
      resetGame();
    });

    elements.speedControl.addEventListener("change", handleSpeedChange);
    wireUpFinanceModal();
    wireUpManagementModal();
  }

  document.addEventListener("DOMContentLoaded", () => {
    cacheElements();
    wireUpEvents();
    initialiseGameState();
  });
})();
