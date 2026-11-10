import { ipcRenderer } from 'electron';

// Runs in every page's isolated world. It never sees saved passwords until
// the user picks one from the menu, and the main process decides the origin.
if (window === window.top && /^https?:$/.test(location.protocol)) {
  const textTypes = ['text', 'email', 'tel', ''];
  let typed: HTMLInputElement | null = null;
  const inputs = (scope: ParentNode) => [
    ...scope.querySelectorAll<HTMLInputElement>('input'),
  ];
  // The username is the last text field before the password in its form.
  const usernameField = (password: HTMLInputElement) => {
    const fields = inputs(password.form ?? document).filter(
      (input) =>
        textTypes.includes(input.getAttribute('type') ?? '') &&
        input.compareDocumentPosition(password) &
          Node.DOCUMENT_POSITION_FOLLOWING,
    );
    return fields.at(-1) ?? null;
  };
  const capture = () => {
    if (typed?.value)
      ipcRenderer.send(
        'drift:password-submit',
        usernameField(typed)?.value ?? '',
        typed.value,
      );
  };
  const fill = (input: HTMLInputElement, value: string) => {
    input.focus();
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  document.addEventListener(
    'input',
    (event) => {
      if (
        event.target instanceof HTMLInputElement &&
        event.target.type === 'password'
      )
        typed = event.target;
    },
    true,
  );
  document.addEventListener('submit', capture, true);
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter' && event.target === typed) capture();
    },
    true,
  );
  // Many sign-in pages never submit a form, so a submit-type button counts.
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target as Element;
      const button = target.closest?.('button, input[type="submit"]') as
        HTMLButtonElement | HTMLInputElement | null;
      if (button?.type === 'submit') return capture();
      if (!(target instanceof HTMLInputElement) || target.value) return;
      const password =
        target.type === 'password'
          ? target
          : textTypes.includes(target.getAttribute('type') ?? '')
            ? inputs(target.form ?? document).find(
                (input) => input.type === 'password',
              )
            : undefined;
      if (!password) return;
      const username = usernameField(password);
      if (target !== password && target !== username) return;
      void ipcRenderer
        .invoke('drift:password-suggest')
        .then((login: { username: string; password: string } | null) => {
          if (!login) return;
          if (username) fill(username, login.username);
          fill(password, login.password);
        })
        .catch(() => undefined);
    },
    true,
  );
}
