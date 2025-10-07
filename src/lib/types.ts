export type PropertyStatusChip = {
  label: string;
  variant?: string;
};

export type PropertyCard = {
  id: string;
  name: string;
  description: string;
  summaryHtml?: string;
  featureTags?: string[];
  locationDetailsHtml?: string;
  maintenanceLabel?: string;
  maintenancePercent?: number;
  demandHtml?: string;
  costHtml?: string;
  rentHtml?: string;
  statusChips?: PropertyStatusChip[];
  owned?: boolean;
  disablePurchase?: boolean;
  manageLabel?: string;
};

export type RentalItem = {
  id: string;
  contentHtml: string;
};

export type HistoryEntry = {
  id: string;
  contentHtml: string;
};
