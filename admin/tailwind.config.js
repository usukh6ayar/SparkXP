/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── SparkXP brand — matches mobile/src/theme/theme.ts exactly ──
        primary:     '#6C3BFF', // purple 500 (mobile: primary)
        primaryDark: '#5A28F0', // purple 600 (mobile: primaryDark)
        primarySoft: '#F1EEFF', // light purple tint (mobile: primarySoft)

        navy:     '#18244A', // deep ink — headings / text (mobile: navy)
        navySoft: '#4A5578', // secondary text (mobile: navySoft)

        // Sidebar — very dark purple (feels like navy but on-brand)
        sidebar: '#170F3D',

        // Gamification accents
        amber:  '#F5A623', // XP gold (mobile: xp)
        sparks: '#38BDF8', // Gems / Sparks — diamond blue (mobile: sparks)
        streak: '#FF8A00', // streak orange (mobile: streak / warning)

        // Surfaces
        cream: '#FFF6E8', // warm accent (mobile: cream)
      },
    },
  },
  plugins: [],
};
