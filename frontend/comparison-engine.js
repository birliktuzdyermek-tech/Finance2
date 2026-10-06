/* Pure comparison of two inputs under the same browser rules. No I/O. */
(function (root) {
  'use strict';
  const E = typeof module === 'object' && module.exports ? require('./analyzer.js') : root.QalqanEngine;
  function freeze(value) {
    if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  function evidence(result, code) {
    return (result.replies || [result]).flatMap((reply, index) =>
      reply.signals.filter(s => s.code === code).flatMap(s => s.matches.map(m => ({
        reply: result.replies ? index + 1 : null, ...m
      }))));
  }
  function createSession(input) {
    const mode = input.mode || 'single', channel = input.channel || 'sms';
    if (!['single', 'dialogue'].includes(mode)) throw new RangeError('mode');
    const run = text => mode === 'dialogue' ? E.analyzeDialogue(text, channel) : E.analyze(text, channel);
    // Recompute the anchor; never trust a supplied score or mutate a saved check.
    const original = freeze(run(input.text));
    function compare(text) {
      const edited = run(text), before = new Map(original.signals.map(s => [s.code, s]));
      const after = new Map(edited.signals.map(s => [s.code, s]));
      const added = edited.signals.filter(s => !before.has(s.code));
      const removed = original.signals.filter(s => !after.has(s.code));
      const retained = edited.signals.filter(s => before.has(s.code));
      const evidenceChanged = retained.filter(s => JSON.stringify(evidence(original, s.code)) !== JSON.stringify(evidence(edited, s.code)));
      const sum = result => result.signals.reduce((total, s) => total + s.weight, 0);
      const originalWeight = sum(original), editedWeight = sum(edited);
      return {original, edited, added, removed, retained, evidenceChanged, originalWeight, editedWeight,
        weightDelta: editedWeight - originalWeight, scoreDelta: edited.score - original.score,
        capped: originalWeight > 100 || editedWeight > 100};
    }
    return Object.freeze({original, mode, channel, compare});
  }
  const api = {createSession, evidence};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QalqanComparison = api;
})(typeof globalThis === 'object' ? globalThis : this);
