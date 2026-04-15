/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
  	extend: {
        colors: {
            border: "hsl(var(--border))",
            input: "hsl(var(--input))",
            ring: "hsl(var(--ring))",
            background: "hsl(var(--background))",
            foreground: "hsl(var(--foreground))",
            primary: {
                DEFAULT: "#011e4b",
                foreground: "#ffffff",
                '50': '#f0f5fa',
                '100': '#afcddd',
                '200': '#6496b0',
                '300': '#015a97',
                '400': '#00376a',
                '500': '#011e4b',
            },
            secondary: {
                DEFAULT: "#00376a",
                foreground: "#ffffff",
            },
            accent: {
                DEFAULT: "#015a97",
                foreground: "#ffffff",
            },
            muted: {
                DEFAULT: "#6496b0",
                foreground: "#ffffff",
            },
            pale: {
                DEFAULT: "#afcddd",
                foreground: "#011e4b",
            },
        },
        fontFamily: {
            sans: ['Poppins', 'sans-serif'],
        },
  		keyframes: {
  			'accordion-down': {
  				from: {
  					height: '0'
  				},
  				to: {
  					height: 'var(--radix-accordion-content-height)'
  				}
  			},
  			'accordion-up': {
  				from: {
  					height: 'var(--radix-accordion-content-height)'
  				},
  				to: {
  					height: '0'
  				}
  			}
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out'
  		}
  	}
  },
  plugins: [],
}