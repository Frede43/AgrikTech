export const formatBIF = (amount: number) => {
  return new Intl.NumberFormat("fr-BI", {
    style: "currency",
    currency: "BIF",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};