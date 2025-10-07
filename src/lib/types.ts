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

export type RentalItemAction = {
  type: 'manage';
  label: string;
  propertyId?: string;
  ariaLabel?: string;
  className?: string;
};

export type RentalItem = {
  id: string;
  propertyId?: string;
  contentHtml: string;
  actions?: RentalItemAction[];
};

export type HistoryEntry = {
  id: string;
  contentHtml: string;
};
