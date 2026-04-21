import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency: string = '$') {
  if (!currency) currency = '$';
  const c = currency.toUpperCase();
  
  // Map common currency codes/symbols to zero decimal places
  const noDecimalCodes = ['VND', 'VNĐ', 'JPY', 'KRW'];
  const noDecimalSymbols = ['₫', '¥', '₩'];
  
  const hasNoDecimals = noDecimalCodes.includes(c) || noDecimalSymbols.includes(currency);

  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: hasNoDecimals ? 0 : 2,
    maximumFractionDigits: hasNoDecimals ? 0 : 2,
  }).format(amount);
}
