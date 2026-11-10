// On a computer the left and right arrow keys move between the answer field and
// the buttons beside it. In the field they only leave it at the edge of the text,
// so they still move the cursor while typing. Disabled buttons are skipped.
export function enableArrowKeys(form) {
  form.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    // Shift selects text, the others are shortcuts of the browser or system.
    if (event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const controls = [...form.querySelectorAll('input, button')].filter((control) => !control.disabled);
    const current = event.target;
    const index = controls.indexOf(current);
    if (index < 0) return;
    const step = event.key === 'ArrowRight' ? 1 : -1;
    if (current.tagName === 'INPUT') {
      const edge = step > 0 ? current.value.length : 0;
      if (current.selectionStart !== edge || current.selectionEnd !== edge) return;
    }
    const next = controls[index + step];
    if (!next) return;
    event.preventDefault();
    next.focus({ preventScroll: true });
    if (next.tagName === 'INPUT') next.setSelectionRange(next.value.length, next.value.length);
  });
}
