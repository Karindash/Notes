(function () {
  const records = window.HCCTProfileRecords;
  const exports = window.HCCTProfileExport;
  if (!records || !exports) throw new Error('Profile record and export modules must be loaded before profile-engine.');

  window.HCCTProfileEngine = Object.freeze({
    collectTaskBlocks: records.collectTaskBlocks,
    metricValue: records.metricValue,
    toJSON: exports.toJSON,
    toCSV: exports.toCSV,
    calibrationStatus: records.calibrationStatus
  });
})();
