/* Tailwind CSS configuration: class-based dark mode and the two fonts used by the design. */
tailwind.config = {
  darkMode: 'class',
  theme: { extend: { fontFamily: {
    sans: ['Inter', 'system-ui', 'sans-serif'],
    display: ['Inter Tight', 'Inter', 'sans-serif'],
  } } },
};
