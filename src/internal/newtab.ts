import { resolveInput } from '../shared/navigation';
import './newtab.css';
const clock = document.getElementById('clock')!;
const date = document.getElementById('date')!;
function updateTime() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  date.textContent = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
updateTime();
setInterval(updateTime, 1000);
document.getElementById('search')!.addEventListener('submit', (event) => {
  event.preventDefault();
  const error = document.getElementById('error')!;
  error.textContent = '';
  try {
    window.location.assign(
      resolveInput(
        (document.getElementById('query') as HTMLInputElement).value,
      ),
    );
  } catch {
    error.textContent = 'Enter a valid address or search term.';
  }
});
