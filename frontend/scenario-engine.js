/* Only visible text and channel cross the analyzer boundary. No author labels. */
(function (root) {
  'use strict';
  const engine = typeof module === 'object' && module.exports ? require('./analyzer.js') : root.QalqanEngine;

  function analyzePrefix(scenario, step) {
    if (step === 0) return null;
    const content = scenario.turns.slice(0, step).map(turn => turn.text).join('\n\n');
    return step === 1 ? engine.analyze(content, scenario.channel, true) : engine.analyzeDialogue(content, scenario.channel);
  }

  function snapshot(scenario, step) {
    if (!Number.isInteger(step) || step < 0 || step > scenario.turns.length) throw new RangeError('scenario_step');
    const result = analyzePrefix(scenario, step);
    const previous = analyzePrefix(scenario, Math.max(0, step - 1));
    const oldCodes = new Set(previous?.signals.map(signal => signal.code) || []);
    return {
      scenarioId: scenario.id, step, total: scenario.turns.length, result,
      previousScore: previous?.score ?? 0,
      scoreDelta: result ? result.score - (previous?.score ?? 0) : 0,
      newSignals: result?.signals.filter(signal => !oldCodes.has(signal.code)) || []
    };
  }

  function createSession(scenario) {
    let current = snapshot(scenario, 0);
    const visited = new Map();
    return {
      get current() { return current; },
      // A rewound view never includes results of later replies.
      get steps() { return [...visited.values()].filter(s => s.step <= current.step).sort((a, b) => a.step - b.step); },
      seek(step) {
        current = snapshot(scenario, step);
        if (step > 0) visited.set(step, current);
        return current;
      },
      reset() { visited.clear(); current = snapshot(scenario, 0); return current; }
    };
  }
  const api = {snapshot, createSession};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QalqanScenarioEngine = api;
})(typeof globalThis === 'object' ? globalThis : this);
