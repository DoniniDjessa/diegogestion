const FIRST_CODE_YEAR = 2026;

function yearLetters(year: number): string {
  let index = Math.max(0, year - FIRST_CODE_YEAR);
  let result = "";

  do {
    result = String.fromCharCode(97 + (index % 26)) + result;
    index = Math.floor(index / 26) - 1;
  } while (index >= 0);

  return result;
}

export function orderCode(orderNumber: number, createdAt: string): string {
  const date = new Date(createdAt);
  return `${yearLetters(date.getFullYear())}${date.getMonth() + 1}${orderNumber}`;
}
