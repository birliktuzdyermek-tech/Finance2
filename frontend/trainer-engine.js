/* Pure exercise review: keep human, analyzer and author evidence separate. */
(function(root) {
  'use strict';
  const E = typeof module === 'object' && module.exports ? require('./analyzer.js') : root.QalqanEngine;
  function tokens(text) { return [...text.matchAll(/\S+/gu)].map((m, id) => ({id,start:m.index,end:m.index+m[0].length,text:m[0]})); }
  function review(exercise, selectedIds, noSignals = false) {
    const words = tokens(exercise.text), selected = new Set(selectedIds);
    if (selected.size !== selectedIds.length || [...selected].some(id => !Number.isInteger(id) || id < 0 || id >= words.length)) throw new RangeError('selection');
    if ((!selected.size && !noSignals) || (selected.size && noSignals)) throw new RangeError('answer_required');
    // This is the complete analyzer call. Author labels and answers cannot alter it.
    const result = E.analyze(exercise.text, exercise.channel);
    const systemSpans = result.signals.flatMap(s => s.matches);
    const overlap = (word, span) => word.start < span.end && word.end > span.start;
    const author = new Set(words.filter(word => exercise.author.spans.some(span => overlap(word, span))).map(w => w.id));
    const system = new Set(words.filter(word => systemSpans.some(span => overlap(word, span))).map(w => w.id));
    const only = (a, b) => words.filter(w => a.has(w.id) && !b.has(w.id));
    return {result, user:{spans:words.filter(w => selected.has(w.id)),noSignals}, author:exercise.author,
      differences:{userOnly:only(selected,author),authorMissed:only(author,selected),systemOnly:only(system,author),authorOnly:only(author,system)}};
  }
  const api = {tokens, review};
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.QalqanTrainerEngine = api;
})(typeof globalThis === 'object' ? globalThis : this);
