export function estimateMinutesFromSteps(steps) {
  const joined = (steps || []).join(' ');
  let total = 0;
  for (const match of joined.matchAll(/(\d+)\s*分/g)) {
    total += parseInt(match[1], 10);
  }
  for (const match of joined.matchAll(/(\d+)\s*時間/g)) {
    total += parseInt(match[1], 10) * 60;
  }
  return total > 0 ? total : null;
}

/**
 * Guarded update: only overwrite cookingMinutesText if it's empty or still
 * equals the last auto-estimated value. Returns { text, lastAutoText }.
 */
export function applyAutoCookingMinutes(currentText, lastAutoText, steps) {
  const estimated = estimateMinutesFromSteps(steps);
  const estimatedText = estimated === null ? '' : String(estimated);
  if (currentText !== '' && currentText !== lastAutoText) {
    return { text: currentText, lastAutoText };
  }
  return { text: estimatedText, lastAutoText: estimatedText === '' ? null : estimatedText };
}
