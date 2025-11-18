# Beefmobile Frontend

React web application for the Beefmobile gaming platform. Built with Vite, React, and Radix UI components.

## Overview

This is the web client for Beefmobile, providing:
- User interface for game lobby and matchmaking
- Real-time game visualization
- Chat and social features
- User profile management
- Responsive design for desktop and mobile web

## Tech Stack

- **React 18**: Modern React with hooks
- **Vite**: Fast build tool and dev server
- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first styling (via shadcn/ui components)
- **TypeScript**: (To be added) Type safety
- **Socket.IO Client**: Real-time WebSocket communication

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── chat/           # Chat UI components
│   │   ├── game/           # Game-specific components
│   │   ├── navigation/     # Navigation and routing
│   │   ├── notifications/  # Toast and notification components
│   │   ├── onboarding/     # Onboarding flow
│   │   ├── tabs/           # Tab navigation
│   │   └── ui/             # Reusable UI components (Radix-based)
│   ├── guidelines/         # Design guidelines
│   ├── styles/             # Global styles
│   ├── App.tsx             # Main app component
│   ├── main.tsx            # Entry point
│   └── index.css           # Global CSS
├── index.html              # HTML template
├── package.json            # Dependencies
├── vite.config.ts          # Vite configuration
└── README.md               # This file
```

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

The app will start at `http://localhost:5173`

### Build

```bash
npm run build
```

Build output will be in the `dist/` directory.

## Integration with Backend

The frontend connects to backend services:

### Matchmaking Service
- **Endpoint**: `http://localhost:8080` (local) or ALB URL (AWS)
- **APIs**:
  - `POST /v1/matchmaking/queue/join` - Join matchmaking queue
  - `DELETE /v1/matchmaking/queue/leave` - Leave queue
  - `GET /v1/matchmaking/queue/status` - Get queue status

### Game Engine Service
- **Endpoint**: `http://localhost:8081` (local) or ALB URL (AWS)
- **WebSocket**: Socket.IO connection for real-time game updates
- **APIs**:
  - `GET /v1/game/session/:sessionId` - Get game session
  - `POST /v1/game/session/:sessionId/action` - Submit action (REST fallback)

### Environment Variables

Create a `.env.local` file:

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_GAME_ENGINE_URL=http://localhost:8081
VITE_WS_URL=ws://localhost:8081
```

For production:
```env
VITE_API_BASE_URL=https://api.beefmobile.com
VITE_GAME_ENGINE_URL=https://api.beefmobile.com
VITE_WS_URL=wss://api.beefmobile.com
```

## Features

### Current Features (From Figma Export)
- ✅ UI component library (Radix UI)
- ✅ Navigation structure
- ✅ Chat interface components
- ✅ Game UI components
- ✅ Notification system
- ✅ Onboarding flow

### Planned Integration Features
- [ ] Authentication flow (Cognito integration)
- [ ] Matchmaking queue UI with live updates
- [ ] Real-time game board with WebSocket sync
- [ ] Chat with backend message persistence
- [ ] User profile display
- [ ] Leaderboards
- [ ] Game history and replays
- [ ] Live streaming integration

## Development Roadmap

### Phase 1: Core Integration (Current)
- [ ] Set up API client with axios/fetch
- [ ] Configure Socket.IO client
- [ ] Connect matchmaking UI to backend
- [ ] Implement game session creation flow
- [ ] Add WebSocket event handlers

### Phase 2: State Management
- [ ] Add React Context or Zustand for global state
- [ ] User authentication state
- [ ] Game session state
- [ ] WebSocket connection management

### Phase 3: Enhanced Features
- [ ] TypeScript migration
- [ ] Error handling and loading states
- [ ] Offline support and reconnection
- [ ] Accessibility improvements
- [ ] Performance optimization

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## Component Library

The app uses shadcn/ui-style components built on Radix UI primitives:

**UI Components** (`src/components/ui/`):
- Accordion
- Alert Dialog
- Avatar
- Button
- Card
- Checkbox
- Dialog
- Dropdown Menu
- Input
- Label
- Popover
- Progress
- Radio Group
- Select
- Slider
- Switch
- Tabs
- Toast/Sonner
- Tooltip

All components are customizable with Tailwind classes.

## Styling

- **Tailwind CSS**: Utility-first CSS framework
- **CSS Variables**: Theme customization via CSS variables
- **Dark Mode**: Ready (via next-themes)
- **Responsive**: Mobile-first design

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Deployment

### Static Hosting
Build the app and deploy the `dist/` folder to:
- AWS S3 + CloudFront
- Vercel
- Netlify
- AWS Amplify

### Docker
```bash
# Build Docker image
docker build -t beefmobile-frontend .

# Run container
docker run -p 8080:80 beefmobile-frontend
```

(Dockerfile to be created)

## Testing

Testing setup coming soon:
- Unit tests: Vitest + React Testing Library
- E2E tests: Playwright or Cypress
- Component tests: Storybook

## Contributing

See main repository [CONTRIBUTING.md](../CONTRIBUTING.md)

## Troubleshooting

### Port Already in Use
Change the port in `vite.config.ts`:
```ts
export default defineConfig({
  server: {
    port: 3000, // Change this
  },
});
```

### CORS Issues
Ensure backend services have CORS enabled for your frontend origin.

### WebSocket Connection Failed
- Check if Game Engine service is running
- Verify WebSocket URL in environment variables
- Check browser console for connection errors

## Resources

- [Vite Documentation](https://vitejs.dev/)
- [React Documentation](https://react.dev/)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [Tailwind CSS Documentation](https://tailwindcss.com/)

## License

MIT - See main repository LICENSE file
