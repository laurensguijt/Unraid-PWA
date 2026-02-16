# Unraid PWA Design System (MVP)

## Visual tokens
- Background: `#0a0811`
- Default accent: orange `#ea580c`
- Gradient accents: amber `#f59e0b`, purple `#7c3aed`
- Card glass: `#ffffff1a` with `backdrop-filter: blur(10px)`
- Radius: cards `20px`, pills/tabbar `999px`
- Border: `1px solid #ffffff24`

## Core components
- `FrostedCard`: glass card container with subtle border and blur
- `ProgressBar`: thin rounded bar with gradient fill
- `StatusPill`: running/stopped/warning badges
- `SearchField`: rounded input for container search
- `ConfirmDialog`: browser confirm fallback for destructive actions (replace with custom sheet)
- `Toast`: low-noise action feedback at bottom
- `BottomTabBar`: blurred floating tab navigator

## Motion guidelines
- Keep transitions short (`150-250ms`)
- Use opacity + translateY for sheet-like motions
- Avoid costly layout thrashing on poll updates
