# 🎨 Tailwind CSS Setup for VoiceWise

Tailwind CSS has been successfully integrated into your VoiceWise frontend!

## ✅ What's Installed

- **tailwindcss** v4.1.16 - The utility-first CSS framework
- **postcss** v8.5.6 - CSS transformations
- **autoprefixer** v10.4.21 - Automatic vendor prefixes

## 📁 Configuration Files

### `tailwind.config.js`
```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f1ff',
          // ... custom primary color palette
          500: '#646cff', // VoiceWise brand color
          // ...
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
    },
  },
  plugins: [],
}
```

### `postcss.config.js`
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

### `src/index.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## 🎨 Custom Colors

VoiceWise includes a custom primary color palette based on the brand colors:

```jsx
// Use in your components
<div className="bg-primary-500 text-white">
  Primary Button
</div>

<div className="text-primary-400 border-primary-500/20">
  Styled Text
</div>
```

## 🚀 Using Tailwind in Your Components

### Example Component

```jsx
function MyComponent() {
  return (
    <div className="container mx-auto px-4">
      {/* Card */}
      <div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8">
        <h2 className="text-2xl font-bold text-primary-400 mb-4">
          Heading
        </h2>
        <p className="text-gray-400">
          Content goes here
        </p>
      </div>

      {/* Button */}
      <button className="bg-primary-500 hover:bg-primary-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200">
        Click Me
      </button>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </div>
    </div>
  )
}
```

## 📚 Common Tailwind Patterns for VoiceWise

### Gradient Backgrounds
```jsx
<div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
  // Dark gradient background like the main app
</div>
```

### Card with Hover Effect
```jsx
<div className="bg-primary-500/5 border border-primary-500/20 rounded-xl p-8 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary-500/20">
  // Feature card
</div>
```

### Gradient Text
```jsx
<h1 className="text-6xl font-bold bg-gradient-to-r from-primary-400 to-primary-600 bg-clip-text text-transparent">
  VoiceWise
</h1>
```

### Responsive Grid
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  // Automatically adjusts from 1 to 4 columns
</div>
```

## 🎯 Utility Classes Reference

### Spacing
- `p-4` - padding 1rem
- `px-6` - padding left/right 1.5rem
- `py-3` - padding top/bottom 0.75rem
- `m-4` - margin 1rem
- `gap-6` - gap 1.5rem

### Colors
- `text-gray-400` - gray text
- `bg-primary-500` - primary background
- `border-primary-500/20` - primary border with 20% opacity

### Typography
- `text-xl` - font size 1.25rem
- `text-2xl` - font size 1.5rem
- `font-bold` - bold font weight
- `font-semibold` - semi-bold font weight

### Flexbox & Grid
- `flex` - display flex
- `flex-col` - flex direction column
- `items-center` - align items center
- `justify-center` - justify content center
- `grid` - display grid
- `grid-cols-2` - 2 columns

### Responsive Design
- `md:text-4xl` - applies at medium screens and up
- `lg:grid-cols-4` - 4 columns on large screens
- `sm:px-6` - padding on small screens

### Effects
- `hover:bg-primary-600` - background on hover
- `transition-all` - transition all properties
- `duration-300` - 300ms duration
- `shadow-2xl` - large shadow
- `rounded-xl` - extra large border radius

## 🔥 Hot Tips

1. **Use opacity modifiers**: `bg-primary-500/20` adds 20% opacity
2. **Combine states**: `hover:scale-105 active:scale-95`
3. **Dark mode ready**: Tailwind makes dark mode easy with `dark:` prefix
4. **Custom animations**: Already configured `animate-pulse-slow`
5. **IntelliSense**: Install Tailwind CSS IntelliSense extension in VS Code

## 📖 Resources

- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Tailwind UI Components](https://tailwindui.com/)
- [Tailwind Colors](https://tailwindcss.com/docs/customizing-colors)
- [Tailwind Cheat Sheet](https://nerdcave.com/tailwind-cheat-sheet)

## 🎨 VS Code Extension

Install the **Tailwind CSS IntelliSense** extension for:
- Autocomplete for Tailwind classes
- Hover previews
- Syntax highlighting
- Linting

```bash
# Search for: "Tailwind CSS IntelliSense" in VS Code extensions
# or install via command line:
code --install-extension bradlc.vscode-tailwindcss
```

## 🚀 Start Developing

Your dev server with hot reload is ready:

```bash
npm run dev
```

Visit http://localhost:5173 to see your Tailwind-styled VoiceWise app!

---

**Pro Tip:** The updated `App.jsx` shows lots of Tailwind patterns you can copy and adapt for your own components!
