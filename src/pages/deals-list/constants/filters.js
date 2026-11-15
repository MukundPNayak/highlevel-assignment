export const INITIAL_QUERY = {
  search: '',
  stages: [],
  ownerId: '',
  inactiveDays: '',
  sort: 'activity-asc',
};

export const SORT_OPTIONS = [
  { id: 'activity-asc', label: 'Oldest activity' },
  { id: 'activity-desc', label: 'Newest activity' },
  { id: 'value-desc', label: 'Highest value' },
  { id: 'value-asc', label: 'Lowest value' },
  { id: 'company-asc', label: 'Company A–Z' },
  { id: 'company-desc', label: 'Company Z–A' },
];

export const INACTIVITY_OPTIONS = [7, 30, 60, 90];
