/** Placeholder when a product has no image yet.
 * Source: https://fr.pinterest.com/pin/6473993212477096/
 */
export const FOOD_PLACEHOLDER_IMAGE = "/images/food-placeholder.jpg";

export function resolveFoodImage(imageUrl?: string | null): string {
  return imageUrl?.trim() || FOOD_PLACEHOLDER_IMAGE;
}
