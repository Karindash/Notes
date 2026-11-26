(function () {
  const settings = window.HCCTSettings;
  const editor = document.querySelector('#settingsConfig');
  const status = document.querySelector('#settingsStatus');
  const fileInput = document.querySelector('#settingsFile');
  if (!settings || !editor || !status || !fileInput) {
    throw new Error('Settings store and settings controls must be loaded before settings-ui.');
  }

  function showStatus(message, isError) {
    status.textContent = message;
    status.classList.toggle('error', !!isError);
  }

  function render() {
    editor.value = JSON.stringify(settings.makeConfiguration(), null, 2);
    const warnings = settings.getWarnings();
    showStatus(warnings.length ? warnings.join(' ') : 'Settings are stored locally on this device.', warnings.length > 0);
  }

  function downloadConfiguration() {
    const blob = new Blob([JSON.stringify(settings.makeConfiguration(), null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'HCCT-settings.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function applyConfiguration() {
    let candidate;
    try {
      candidate = settings.validateConfiguration(JSON.parse(editor.value));
    } catch (error) {
      showStatus(error.message, true);
      return;
    }
    const result = settings.saveConfiguration(candidate);
    if (!result.ok) {
      showStatus(result.error, true);
      return;
    }
    showStatus('Settings saved. Reloading with the updated configuration…', false);
    window.location.reload();
  }

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-settings-action]');
    if (!button) return;
    if (button.dataset.settingsAction === 'export') downloadConfiguration();
    if (button.dataset.settingsAction === 'apply') applyConfiguration();
    if (button.dataset.settingsAction === 'reset' &&
        window.confirm('Reset settings to defaults? Recorded task data will not be deleted.')) {
      const result = settings.resetConfiguration();
      if (!result.ok) showStatus(result.error, true);
      else window.location.reload();
    }
    if (button.dataset.settingsAction === 'import') fileInput.click();
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      editor.value = String(reader.result || '');
      showStatus('Configuration loaded into the editor. Validate and apply it to save.', false);
    };
    reader.onerror = () => showStatus('The selected configuration file could not be read.', true);
    reader.readAsText(file);
    fileInput.value = '';
  });

  render();
  window.HCCTSettingsUI = Object.freeze({render});
})();
