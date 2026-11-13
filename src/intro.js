// The guide of a mode: a dialog with its rules, the filters, the scale and the
// colors. It opens by itself on the first visit and again behind the "?" button.
import { INTROS } from './intro-content.js';
import { hasSeenIntro, markIntroSeen } from './storage.js';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function renderItem(item) {
  if (typeof item === 'string') return element('li', '', item);
  const row = element('li', 'intro-color');
  const samples = element('span', 'intro-swatches');
  samples.setAttribute('aria-hidden', 'true');
  for (const { color, label, ring } of item.swatches) {
    const swatch = element('span', ring ? 'swatch intro-ring' : 'swatch', label);
    swatch.style.background = color;
    samples.append(swatch);
  }
  row.append(samples, element('span', '', item.text));
  return row;
}

function buildDialog({ title, sections }) {
  const dialog = element('dialog', 'settings intro');
  dialog.id = 'intro';
  dialog.setAttribute('aria-labelledby', 'intro-title');

  const header = element('header', 'intro-header');
  const heading = element('h2', '', title);
  heading.id = 'intro-title';
  header.append(element('p', 'intro-kicker', 'So geht’s'), heading);

  const body = element('div', 'intro-body');
  for (const { heading: name, items } of sections) {
    const section = element('section', 'intro-section');
    const list = element('ul', 'intro-list');
    list.append(...items.map(renderItem));
    section.append(element('h3', '', name), list);
    body.append(section);
  }

  const close = element('button', 'primary', 'Los geht’s!');
  close.type = 'button';
  close.id = 'intro-close';
  close.autofocus = true;
  close.addEventListener('click', () => dialog.close());
  // A click on the dark backdrop around the dialog closes it too.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.append(header, body, close);
  return dialog;
}

// `onClose(first)` runs whenever the guide closes; `first` is true when it had
// opened by itself on the first visit.
export function setupIntro(mode, onClose) {
  const guide = INTROS[mode];
  if (!guide) return;
  const dialog = buildDialog(guide);
  document.body.append(dialog);
  let first = false;
  dialog.addEventListener('close', () => {
    markIntroSeen(mode);
    onClose(first);
    first = false;
  });
  document.getElementById('help-btn')?.addEventListener('click', () => {
    dialog.querySelector('.intro-body').scrollTop = 0;
    dialog.showModal();
  });
  if (!hasSeenIntro(mode)) {
    first = true;
    dialog.showModal();
  }
}
