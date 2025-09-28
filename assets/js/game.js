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
    properties: [],
    history: [],
    tickLength: 1000,
    timerId: null,
    lastRentCollectionDay: 0,
  };

  const elements = {};

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

  function formatPropertyType(type) {
    return propertyTypeLabels[type] ?? type;
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
        owned: false,
      };
    });
  }

  function initialiseGameState(logInitialMessage = true) {
    state.balance = 1000;
    state.day = 1;
    state.properties = cloneDefaultProperties();
    state.history = [];
    state.lastRentCollectionDay = 0;
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
      const rentCollected = calculateRentPerMonth() * monthsElapsed;
      state.balance += rentCollected;
      const startMonth = Math.floor(state.lastRentCollectionDay / 30) + 1;
      const endMonth = startMonth + monthsElapsed - 1;
      state.lastRentCollectionDay += monthsElapsed * 30;
      const monthRange = monthsElapsed > 1 ? `${startMonth}-${endMonth}` : `${startMonth}`;
      const monthLabel = monthsElapsed > 1 ? `${monthsElapsed} months` : "1 month";
      addHistoryEntry(
        `Month${monthsElapsed > 1 ? "s" : ""} ${monthRange}: Collected ${formatCurrency(rentCollected)} in rent for ${monthLabel}.`
      );
    }

    updateUI();
  }

  function calculateRentPerMonth() {
    return state.properties
      .filter((property) => property.owned)
      .reduce((total, property) => total + property.monthlyRent, 0);
  }

  function handlePurchase(propertyId) {
    const property = state.properties.find((item) => item.id === propertyId);
    if (!property || property.owned) {
      return;
    }

    if (state.balance < property.cost) {
      addHistoryEntry(
        `Attempted to buy ${property.name} but lacked funds (${formatCurrency(
          property.cost
        )}).`
      );
      return;
    }

    state.balance -= property.cost;
    property.owned = true;
    addHistoryEntry(
      `Purchased ${property.name} for ${formatCurrency(property.cost)}.`
    );
    updateUI();
  }

  function renderProperties() {
    elements.propertyList.innerHTML = "";
    state.properties.forEach((property) => {
      const col = document.createElement("div");
      col.className = "col-sm-6";

      const card = document.createElement("div");
      card.className = "card property-card h-100";
      if (property.owned) {
        card.classList.add("owned");
      }

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
      rent.className = "mb-3";
      rent.innerHTML = `<strong>Rent / month:</strong> ${formatCurrency(
        property.monthlyRent
      )}`;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-primary w-100 mt-auto";
      button.textContent = property.owned ? "Owned" : "Buy property";
      button.disabled = property.owned || state.balance < property.cost;
      button.addEventListener("click", () => handlePurchase(property.id));

      const detailSection = document.createElement("div");
      detailSection.className = "mb-3 flex-grow-1";
      detailSection.append(
        summary,
        ...(features.childElementCount ? [features] : []),
        locationDetails,
        demand,
        maintenance
      );

      cardBody.append(title, description, detailSection, cost, rent, button);
      card.append(cardBody);
      col.append(card);
      elements.propertyList.append(col);
    });
  }

  function renderIncomeStatus() {
    elements.incomeStatus.innerHTML = "";
    const ownedProperties = state.properties.filter((property) => property.owned);

    if (ownedProperties.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "list-group-item py-3";
      emptyItem.textContent = "No properties owned yet. Buy your first home to start earning rent.";
      elements.incomeStatus.append(emptyItem);
      return;
    }

    ownedProperties.forEach((property) => {
      const item = document.createElement("li");
      item.className = "list-group-item d-flex justify-content-between align-items-center";
      item.innerHTML = `
        <span>
          <strong>${property.name}</strong>
          <small class="d-block text-muted">${property.description}</small>
        </span>
        <span class="badge bg-success rounded-pill">Rent / month: ${formatCurrency(property.monthlyRent)}</span>
      `;
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
    const rentPerMonth = calculateRentPerMonth();
    elements.rentPerMonth.textContent = formatCurrency(rentPerMonth);
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
