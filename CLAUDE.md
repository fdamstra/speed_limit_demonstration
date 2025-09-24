# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An interactive web-based demonstration that debunks the myth that "driving the speed limit guarantees hitting all green lights." The simulation shows two cars traveling in opposite directions at the speed limit, proving that traffic lights cannot be optimized for both directions simultaneously.

## Development Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

## Architecture

### Core Components
- **TrafficSimulation class** (`src/main.ts`): Main simulation engine that manages traffic lights, cars, and animation
- **Traffic Light System**: Lights are timed optimally for eastbound traffic at the speed limit
- **Car Physics**: Two cars travel at exactly the speed limit in opposite directions
- **Canvas Rendering**: 60 FPS animation showing real-time traffic light states and car positions

### Key Concepts
- Light timing is calculated to create "green waves" for eastbound traffic
- Westbound traffic experiences the inverse timing pattern, hitting red lights
- Interactive controls allow adjustment of speed limits, light spacing, and cycle times
- Visual feedback shows when each car hits a red light

### Technology Stack
- TypeScript with strict type checking
- HTML5 Canvas for 2D graphics
- Vite for development and building
- No external runtime dependencies

## Physics Calculations

The simulation converts real-world units:
- MPH to pixels per frame for car movement
- Feet to pixels for light spacing (0.8 pixels per foot)
- Real-time traffic light cycling with proper state transitions

Light states are calculated based on optimal timing for eastbound traffic, demonstrating why the same timing cannot work for westbound traffic.