(() => {
  const defaultProperties = [
    {
      id: "studio",
      name: "Studio Apartment",
      description: "An affordable entry into the market.",
      cost: 350,
      rent: 35,
    },
    {
      id: "townhouse",
      name: "City Townhouse",
      description: "Popular with young professionals.",
      cost: 650,
      rent: 85,
    },
    {
      id: "suburb",
      name: "Suburban Family Home",
      description: "Stable tenants, steady rent flow.",
      cost: 900,
      rent: 125,
    },
    {
      id: "penthouse",
      name: "Luxury Penthouse",
      description: "High maintenance, higher reward.",
      cost: 1400,
      rent: 240,
    },
  ];

  const state = {
    balance: 0,
    day: 1,
    properties: [],
    history: [],
    tickLength: 1000,
    timerId: null,
  };

  const elements = {};

  function cacheElements() {
    elements.balance = document.getElementById("playerBalance");
    elements.day = document.getElementById("currentDay");
    elements.rentPerDay = document.getElementById("rentPerDay");
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

  function cloneDefaultProperties() {
    return defaultProperties.map((property) => ({ ...property, owned: false }));
  }

  function initialiseGameState(logInitialMessage = true) {
    state.balance = 1000;
    state.day = 1;
    state.properties = cloneDefaultProperties();
    state.history = [];
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
    const rentCollected = calculateRentPerDay();
    if (rentCollected > 0) {
      state.balance += rentCollected;
      addHistoryEntry(
        `Day ${state.day}: Collected ${formatCurrency(rentCollected)} in rent.`
      );
    } else {
      addHistoryEntry(`Day ${state.day}: No rent collected yet.`);
    }
    updateUI();
  }

  function calculateRentPerDay() {
    return state.properties
      .filter((property) => property.owned)
      .reduce((total, property) => total + property.rent, 0);
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
      description.className = "card-text flex-grow-1";
      description.textContent = property.description;

      const cost = document.createElement("p");
      cost.className = "mb-1";
      cost.innerHTML = `<strong>Cost:</strong> ${formatCurrency(property.cost)}`;

      const rent = document.createElement("p");
      rent.className = "mb-3";
      rent.innerHTML = `<strong>Rent / day:</strong> ${formatCurrency(
        property.rent
      )}`;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-primary w-100 mt-auto";
      button.textContent = property.owned ? "Owned" : "Buy property";
      button.disabled = property.owned || state.balance < property.cost;
      button.addEventListener("click", () => handlePurchase(property.id));

      cardBody.append(title, description, cost, rent, button);
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
        <span class="badge bg-success rounded-pill">${formatCurrency(property.rent)}</span>
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
    const rentPerDay = calculateRentPerDay();
    elements.rentPerDay.textContent = formatCurrency(rentPerDay);
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
