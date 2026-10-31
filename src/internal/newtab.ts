import { resolveInput } from '../shared/navigation';
import './newtab.css';
document.getElementById('search')!.addEventListener('submit', (event) => {
  event.preventDefault();
  const error = document.getElementById('error')!;
  error.textContent = '';
  try {
    window.location.assign(
      resolveInput(
        (document.getElementById('query') as HTMLInputElement).value,
        document.documentElement.dataset.search,
      ),
    );
  } catch {
    error.textContent = 'Enter a valid address or search term.';
  }
});
