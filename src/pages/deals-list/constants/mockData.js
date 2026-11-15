export const DEAL_COUNT = 50_000;
export const OWNER_COUNT = 30;

export const STAGE_DISTRIBUTION = {
  NEW_LEAD: 12_000,
  CONTACTED: 10_000,
  DEMO_DONE: 8_000,
  PROPOSAL_SENT: 7_000,
  NEGOTIATION: 6_000,
  WON: 4_000,
  LOST: 3_000,
};

export const OWNER_NAMES = [
  'Priya Sharma',
  'Arjun Mehta',
  'Ananya Rao',
  'Rohan Patel',
  'Meera Iyer',
  'Kabir Singh',
  'Isha Gupta',
  'Vikram Das',
  'Neha Shah',
  'Aditya Nair',
  'Sara Khan',
  'Dev Joshi',
  'Kavya Reddy',
  'Rahul Verma',
  'Tara Kapoor',
  'Nikhil Jain',
  'Aditi Bose',
  'Aman Sethi',
  'Diya Menon',
  'Sahil Malhotra',
  'Sneha Kulkarni',
  'Varun Bhat',
  'Pooja Desai',
  'Karan Sinha',
  'Riya Chawla',
  'Manav Saxena',
  'Anjali Pillai',
  'Harsh Agarwal',
  'Sana Ali',
  'Pranav Mukherjee',
];

export const OWNERS = OWNER_NAMES.slice(0, OWNER_COUNT).map((name, index) => ({
  id: `owner-${index + 1}`,
  name,
}));

export const OWNERS_BY_ID = Object.fromEntries(OWNERS.map((owner) => [owner.id, owner]));

export const COMPANY_NAMES = [
  'Acme',
  'Northstar',
  'Meridian',
  'Cedar',
  'Orbit',
  'Summit',
  'Atlas',
  'Evergreen',
  'Pioneer',
  'Bluebird',
  'Horizon',
  'Juniper',
  'Nova',
  'Vertex',
];
export const INDUSTRIES = ['Technologies', 'Labs', 'Systems', 'Logistics', 'Foods', 'Healthcare'];
