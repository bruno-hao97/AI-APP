import { route, startRouter, navigate } from './router.js';
import { renderDashboard } from './views/dashboard.js';
import { renderMediaPlayground } from './views/media-playground.js';
import { renderSettings, refreshSidebarStatus } from './views/settings.js';
import { renderHistory } from './views/history.js';
import { renderFeatures } from './views/features.js';
import { renderModels } from './views/models.js';
import { renderModelMatrix } from './views/model-matrix.js';
import { renderSupport } from './views/support.js';
import { renderPrivacy } from './views/privacy.js';
import { renderDocs } from './views/docs.js';
import { initFeatureMenu } from './feature-menu.js';
import { JOB_TYPES } from './ui-labels.js';

function renderCreate({ main, params, query }) {
  renderMediaPlayground({ main, params, query });
  const saved = sessionStorage.getItem('hero_prompt');
  if (saved && params.type === 'image') {
    setTimeout(() => {
      const el = document.getElementById('pgPrompt');
      if (el && !el.value) el.value = saved;
      sessionStorage.removeItem('hero_prompt');
    }, 100);
  }
}

function bindShell() {
  document.getElementById('headerStart')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/create');
  });

  document.getElementById('topbarHome')?.addEventListener('click', (e) => {
    e.preventDefault();
    navigate('/');
  });

  document.querySelectorAll('[data-topnav]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.topnav);
    });
  });
}

route('', renderDashboard);
route('/', renderDashboard);
route('features', renderFeatures);
route('models', renderModels);
route('matrix', renderModelMatrix);
route('support', renderSupport);
route('privacy', renderPrivacy);
route('docs', renderDocs);
route('create', renderCreate);
route('history', renderHistory);
route('settings', ({ main }) => {
  renderSettings({ main });
  refreshSidebarStatus();
});

document.addEventListener('settings:saved', refreshSidebarStatus);

bindShell();
initFeatureMenu();
refreshSidebarStatus();
startRouter();

export { navigate, JOB_TYPES };
