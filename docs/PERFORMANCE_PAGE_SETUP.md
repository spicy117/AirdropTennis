# Performance Page Setup

The Performance page (`pages/PerformancePage.tsx`) is a student-facing dashboard using Tailwind CSS, Framer Motion, Lucide icons, recharts, and react-calendar-heatmap.

## Dependencies

Already added to `package.json`:
- `framer-motion`
- `lucide-react`
- `react-calendar-heatmap`

Run `npm install` to install.

## Tailwind CSS

For Tailwind to work with Expo web:

1. Install: `npm install -D tailwindcss postcss autoprefixer`
2. Add to `App.js` (top of file): `import './styles/global.css';`
3. Ensure `postcss.config.js` and `tailwind.config.js` exist (already created).

If using a custom webpack config for Expo, add `css-loader` and `postcss-loader` for `.css` files.

## Integration

To add the Performance screen to your app:

1. Import `PerformanceScreen` and add it to your navigation/routing.
2. Pass `onBack` to navigate back.
3. On web, it renders the full page; on native, it shows a placeholder (web-only libraries).

Example in HomeScreen or App.js:
```js
import PerformanceScreen from './screens/PerformanceScreen';
// Add route/screen for 'performance' and pass onBack
```
