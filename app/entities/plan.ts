interface Plan {
  tokens: number;
  priceUSD: number;
}

export const plans: Plan[] = [
  {
    tokens: 10000,
    priceUSD: 3.99,
  },
  {
    tokens: 25000,
    priceUSD: 8.99,
  },
  {
    tokens: 50000,
    priceUSD: 14.99,
  },
];

export default Plan;
