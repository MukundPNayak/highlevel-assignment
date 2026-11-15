export const STAGES = [
  { id: 'NEW_LEAD', label: 'New Lead' },
  { id: 'CONTACTED', label: 'Contacted' },
  { id: 'DEMO_DONE', label: 'Demo Done' },
  { id: 'PROPOSAL_SENT', label: 'Proposal Sent' },
  { id: 'NEGOTIATION', label: 'Negotiation' },
  { id: 'WON', label: 'Won' },
  { id: 'LOST', label: 'Lost' },
];

export const STAGE_LABELS = Object.fromEntries(STAGES.map(({ id, label }) => [id, label]));
export const CLOSED_STAGES = new Set(['WON', 'LOST']);
