const sections = [...document.querySelectorAll('[data-chapter]')];
const railLinks = [...document.querySelectorAll('[data-rail]')];
const railProgress = document.querySelector('#rail-progress');
const railCurrent = document.querySelector('#rail-current');
const railNext = document.querySelector('#rail-next');

function updateRailProgress(index) {
  const percent = sections.length > 1 ? (index / (sections.length - 1)) * 100 : 100;
  railProgress.style.width = '100%';
  railProgress.style.height = `${percent}%`;
}

function setCurrentSection(section) {
  const index = sections.indexOf(section);
  const number = section.dataset.chapter;
  const label = section.dataset.label;
  railCurrent.textContent = `${number} / ${label}`;
  railNext.textContent = `${section.dataset.next} ↘`;
  railNext.href = section.dataset.nextHref;
  railLinks.forEach((link, linkIndex) => {
    link.classList.toggle('is-current', link.getAttribute('href') === `#${section.id}`);
    link.classList.toggle('is-past', linkIndex < index);
    if (linkIndex === index) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  updateRailProgress(index);
}

setCurrentSection(sections[0]);
if ('IntersectionObserver' in window) {
  const chapterObserver = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) setCurrentSection(visible.target);
  }, { rootMargin: '-34% 0px -54% 0px', threshold: [0, .1, .25, .5] });
  sections.forEach((section) => chapterObserver.observe(section));
} else {
  const updateFromScroll = () => {
    const marker = window.innerHeight * .4;
    let active = sections[0];
    sections.forEach((section) => {
      if (section.getBoundingClientRect().top <= marker) active = section;
    });
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      active = sections[sections.length - 1];
    }
    setCurrentSection(active);
  };
  updateFromScroll();
  window.addEventListener('scroll', updateFromScroll, { passive: true });
  window.addEventListener('resize', updateFromScroll, { passive: true });
}
window.addEventListener('resize', () => {
  const activeIndex = Math.max(0, railLinks.findIndex((link) => link.classList.contains('is-current')));
  updateRailProgress(activeIndex);
}, { passive: true });

const revealItems = [...document.querySelectorAll('.reveal')];
if ('IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .08, rootMargin: '0px 0px -5% 0px' });
  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('is-visible'));
}

async function loadLeetCodeActivity() {
  const handle = 'bfcCpyaabO';
  const api = `https://leetcode-stats.tashif.codes/${handle}`;
  const calendar = document.querySelector('#calendar');
  const summary = document.querySelector('.leetcode-summary');
  const rangeLabel = document.querySelector('#leetcode-range');
  const status = document.querySelector('#leetcode-status');
  const controller = 'AbortController' in window ? new AbortController() : null;
  let requestTimeout;

  for (let day = 0; day < 371; day += 1) {
    const placeholder = document.createElement('i');
    placeholder.setAttribute('aria-hidden', 'true');
    calendar.append(placeholder);
  }

  try {
    const request = fetch(api, { headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller?.signal });
    const timeout = new Promise((resolve, reject) => {
      requestTimeout = window.setTimeout(() => {
        controller?.abort();
        reject(new Error('LeetCode profile request timed out'));
      }, 10000);
    });
    const response = await Promise.race([request, timeout]);
    if (!response.ok) throw new Error(`LeetCode profile request failed: ${response.status}`);
    const profile = await response.json();
    const data = profile.data || profile;
    let submissions = profile.submissionCalendar ?? data.submissionCalendar;
    if (typeof submissions === 'string') {
      try {
        submissions = JSON.parse(submissions);
      } catch {
        throw new Error('LeetCode submission history is malformed');
      }
    }
    if (!submissions || typeof submissions !== 'object' || Array.isArray(submissions)) {
      throw new Error('LeetCode submission history is unavailable');
    }

    const update = (selector, value) => {
      const element = document.querySelector(selector);
      if (element && value !== undefined && value !== null) element.textContent = value;
    };
    update('#leetcode-solved', profile.totalSolved ?? data.totalSolved ?? '—');
    const end = new Date();
    end.setUTCHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 364);
    const dateLabel = (date) => date.toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
    });
    rangeLabel.textContent = `${dateLabel(start)} — ${dateLabel(end)}`;

    const counts = new Map(Object.entries(submissions).map(([timestamp, count]) => [
      new Date(Number(timestamp) * 1000).toISOString().slice(0, 10), Number(count),
    ]));
    const leading = start.getUTCDay();
    const months = document.querySelector('#calendar-months');
    months.replaceChildren();
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    let monthIndex = 0;
    let firstMonth = new Date(start);
    while (firstMonth <= end) {
      const month = document.createElement('span');
      const offset = monthIndex === 0 ? 0 : Math.floor((Math.floor((firstMonth - start) / 86400000) + leading) / 7);
      month.textContent = monthNames[firstMonth.getUTCMonth()];
      month.style.left = `${(offset / 53) * 100}%`;
      months.append(month);
      monthIndex += 1;
      firstMonth = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + monthIndex, 1));
    }

    calendar.replaceChildren();
    for (let day = 0; day < leading; day += 1) {
      const empty = document.createElement('i');
      empty.setAttribute('aria-hidden', 'true');
      calendar.append(empty);
    }
    let annualSubmissions = 0;
    for (let day = 0; day < 365; day += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + day);
      const key = date.toISOString().slice(0, 10);
      const count = counts.get(key) || 0;
      annualSubmissions += count;
      const cell = document.createElement('i');
      const level = count === 0 ? 0 : count <= 3 ? 1 : count <= 7 ? 2 : count <= 15 ? 3 : 4;
      cell.dataset.level = String(level);
      cell.title = `${key}: ${count} submission${count === 1 ? '' : 's'}`;
      cell.setAttribute('aria-label', cell.title);
      calendar.append(cell);
    }
    update('#leetcode-submissions-year', annualSubmissions.toLocaleString('en-US'));
    calendar.classList.remove('is-loading');
    calendar.setAttribute('aria-busy', 'false');
    calendar.setAttribute('aria-label', 'LeetCode submissions during the last 365 days');
    summary.setAttribute('aria-busy', 'false');
    status.textContent = 'Activity refreshed from public profile data';
  } catch (error) {
    calendar.replaceChildren();
    for (let day = 0; day < 371; day += 1) {
      const cell = document.createElement('i');
      cell.dataset.level = '0';
      cell.setAttribute('aria-hidden', 'true');
      calendar.append(cell);
    }
    calendar.classList.remove('is-loading');
    calendar.setAttribute('aria-busy', 'false');
    calendar.setAttribute('aria-label', 'LeetCode activity could not be loaded');
    summary.querySelectorAll('strong').forEach((value) => { value.textContent = '—'; });
    summary.setAttribute('aria-busy', 'false');
    rangeLabel.textContent = 'Profile data unavailable';
    status.textContent = 'Live activity could not refresh · open profile ↗';
    console.warn('Could not refresh LeetCode activity.', error);
  } finally {
    window.clearTimeout(requestTimeout);
  }
}

loadLeetCodeActivity();
