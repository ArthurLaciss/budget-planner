/* Adds the "light" or "dark" class to <html> before the page is drawn, using the theme saved in localStorage. */
(function () {
  try {
    var theme = localStorage.getItem('bp_theme') || 'light';
    document.documentElement.classList.add(theme === 'light' ? 'light' : 'dark');
  } catch (e) {
    document.documentElement.classList.add('light');
  }
})();
