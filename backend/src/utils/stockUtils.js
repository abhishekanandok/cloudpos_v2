/**
 * Unified Stock Multiplier Logic
 * Centralized utility to ensure Sales, Purchases, and Driver Settlements calculate
 * stock equivalence (base units) using the exact same mathematics.
 *
 * Data structure: units = [{name:'BOX', quantity:1}, {name:'ROLL', quantity:30}]
 * quantity here means: how many of the NEXT (smaller) unit fit in one of this unit.
 * So: units[idx+1].quantity * units[idx+2].quantity * ... = total base units for units[idx]
 *
 * Example: BOX(qty:1) > ROLL(qty:30)
 *   - getBaseMultiplier(tiers, 'BOX') = 30   (1 BOX = 30 ROLL)
 *   - getBaseMultiplier(tiers, 'ROLL') = 1   (ROLL is the base unit)
 */

// Normalize unit name / sale type: trim, lowercase, remove spaces, hyphens, and underscores for unified comparison
export const normalizeString = (s) => (s || '').toString().trim().toLowerCase().replace(/[-_\s]/g, '');

export const findPricingTier = (pricingTiers, saleType) => {
  if (!Array.isArray(pricingTiers)) return null;
  const targetNorm = normalizeString(saleType);
  return pricingTiers.find(t => t.name && normalizeString(t.name) === targetNorm) || null;
};

export const getBaseMultiplier = (pricingTiers, targetUnitName, saleType = 'RETAIL') => {
  let baseMultiplier = 1;

  if (!Array.isArray(pricingTiers) || pricingTiers.length === 0) {
    return baseMultiplier;
  }

  const targetNorm = normalizeString(targetUnitName);

  // 1. Try to find the tier matching saleType
  let tier = findPricingTier(pricingTiers, saleType);

  // 2. Fallback to first tier if saleType not matched
  if (!tier || !Array.isArray(tier.units) || tier.units.length === 0) {
    tier = pricingTiers[0];
  }

  let allUnits = (tier && Array.isArray(tier.units) && tier.units.length > 0) ? tier.units : null;

  // 3. If the target unit is not found in the matched tier, search ALL tiers
  if (!allUnits || !allUnits.find(u => normalizeString(u.name) === targetNorm)) {
    for (const t of pricingTiers) {
      if (Array.isArray(t.units) && t.units.find(u => normalizeString(u.name) === targetNorm)) {
        allUnits = t.units;
        break;
      }
    }
  }

  if (!allUnits) return baseMultiplier;

  const matchNorm = targetNorm || normalizeString(allUnits[0]?.name);
  const uIdx = allUnits.findIndex(u => normalizeString(u.name) === matchNorm);

  // Multiply from uIdx+1 to end: each next unit's quantity = how many fit in one of uIdx
  if (uIdx !== -1) {
    for (let j = uIdx + 1; j < allUnits.length; j++) {
      const unitQty = Number(allUnits[j].quantity);
      baseMultiplier *= (isNaN(unitQty) || unitQty <= 0 ? 1 : unitQty);
    }
  }

  return baseMultiplier;
};

