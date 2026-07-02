# FitForge AI

> AI-Powered Fitness Transformation Platform

FitForge AI is a next-generation AI-powered fitness platform that helps users achieve their desired physique through personalized nutrition planning, workout generation, transformation roadmaps, progress tracking, and contextual AI coaching.

Unlike traditional calorie-counting applications, FitForge AI focuses on complete body transformation journeys by combining AI, nutrition science, workout programming, accountability systems, and progress analytics.

---

# Table of Contents

1. Overview
2. Key Features
3. Product Architecture
4. Technology Stack
5. System Architecture
6. Core Modules
7. AI Architecture
8. Database Architecture
9. Project Structure
10. Environment Setup
11. Installation
12. Running Locally
13. API Modules
14. Cloudflare R2 Setup
15. Redis & BullMQ
16. AI Integration
17. Deployment
18. Roadmap
19. MVP Scope
20. Future Enhancements

---

# Overview

FitForge AI enables users to answer:

* Where am I today?
* What physique can I realistically achieve?
* How long will it take?
* What should I eat?
* How should I train?
* Am I following my plan?
* Am I progressing correctly?

The platform continuously adapts recommendations based on:

* User Profile
* Fitness Goal
* Target Physique
* Food Preferences
* Allergies
* Budget Constraints
* Workout Experience
* Progress Tracking
* Daily Compliance
* AI Conversations

---

# Key Features

## User Personalization

Collect:

* Age
* Gender
* Height
* Weight
* Activity Level
* Workout Experience
* Fitness Goal
* Target Physique
* Diet Type
* Food Preferences
* Allergies
* Budget Preference

---

## Transformation Engine

Calculate:

* BMI
* BMR
* TDEE
* Calorie Targets
* Protein Targets

Generate:

* Transformation Timeline
* Weekly Milestones
* Estimated Completion Date

---

## AI Diet Planner

Generate personalized diet plans based on:

* Goal
* Diet Type
* Protein Targets
* Food Preferences
* Available Foods
* Allergies
* Budget

Features:

* Diet Versioning
* Diet Regeneration
* Historical Plans

---

## Meal Planning

Generate:

* Weekly Meal Plans
* Monthly Meal Plans

Track:

* Completed Meals
* Skipped Meals
* Replaced Meals

Generate:

* Grocery Lists

---

## AI Workout Planner

Generate personalized workout plans based on:

* Goal
* Experience Level
* Workout Days
* Equipment Availability

Supported Modes:

* Gym
* Home Workout
* Calisthenics

Features:

* Workout Versioning
* Workout Regeneration

---

## Progress Tracking

Track:

* Weight
* Waist
* Chest
* Arms
* Thighs
* Body Fat %

Analytics:

* Weight Trends
* Body Fat Trends
* Goal Completion %
* Transformation Progress

---

## Daily Accountability

Track:

* Calories Consumed
* Protein Consumed
* Water Intake
* Workout Completion
* Diet Compliance

---

## AI Fitness Coach

Powered by Gemini Flash.

The AI retrieves:

* User Profile
* Active Diet
* Active Meal Plan
* Active Workout Plan
* Progress Logs
* Daily Check-ins
* Chat History

before generating responses.

---

# Technology Stack

## Frontend

### Web

* Next.js
* TypeScript
* Tailwind CSS
* ShadCN UI
* TanStack Query

### Mobile

* React Native
* TypeScript
* React Navigation
* TanStack Query

---

## Backend

* NestJS
* TypeScript
* Prisma ORM

---

## Database

* PostgreSQL

---

## AI

Primary:

* Gemini Flash

Fallbacks:

* DeepSeek
* Qwen

---

## Storage

* Cloudflare R2

---

## Cache

* Redis

---

## Queue Processing

* BullMQ

---

## Monitoring

* Sentry

---

## Logging

* Pino

---

# System Architecture

```text
React Native App
        │
        │
Next.js Web App
        │
        │
     NestJS API
        │
 ┌──────┼───────────┬────────────┬───────────┐
 │      │           │            │           │
 │      │           │            │           │
Postgres Redis   Gemini AI   Cloudflare R2 BullMQ
 Prisma
```

---

# AI Architecture

```text
User Message
      │
      ▼
AI Controller
      │
      ▼
AI Context Service
      │
      ├── User Profile
      ├── Diet Plan
      ├── Meal Plan
      ├── Workout Plan
      ├── Progress Logs
      ├── Daily Checkins
      └── Chat History
      │
      ▼
Prompt Builder
      │
      ▼
Gemini Provider
      │
      ▼
Response Parser
      │
      ▼
Save AI Messages
      │
      ▼
Return Response
```

---

# AI Chat Sessions

Each user can have multiple AI sessions.

Examples:

* Diet Coaching
* Workout Coaching
* Transformation Coaching
* General Fitness Coaching

Session Structure:

```text
Chat Session
 ├── User Message
 ├── AI Response
 ├── User Message
 ├── AI Response
 └── ...
```

---

# Database Architecture

## Authentication

* User
* Session
* RefreshToken

---

## User Personalization

* UserFitnessProfile
* PhysiqueGoal
* UserFoodPreference

---

## Transformation

* TransformationTarget
* TransformationMilestone

---

## Nutrition

* FoodMaster
* DietPlan
* MealPlan
* MealPlanItem
* MealLog
* GroceryList

---

## Workout

* ExerciseMaster
* WorkoutPlan
* WorkoutDay
* WorkoutExercise

---

## Progress

* ProgressLog
* ProgressPhoto

---

## Accountability

* DailyCheckin

---

## AI

* AiChatSession
* AiMessage

---

## Storage

* Upload

---

# Project Structure

```text
src/

├── modules
│
├── auth
├── users
├── onboarding
│
├── fitness-profile
├── physique-goals
├── food-preferences
│
├── transformation
│
├── diet
├── meal-planning
├── grocery
│
├── workout
│
├── progress
├── daily-checkins
│
├── uploads
│
├── ai
│   ├── chat
│   ├── coach
│   ├── context
│   ├── prompt-builder
│   ├── providers
│   └── regeneration
│
├── analytics
├── admin
│
├── common
├── config
├── prisma
│
└── main.ts
```

---

# Environment Variables

```env
NODE_ENV=development

PORT=3000

DATABASE_URL=

JWT_SECRET=
JWT_REFRESH_SECRET=

REDIS_HOST=
REDIS_PORT=

GEMINI_API_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=

SENTRY_DSN=
```

---

# Installation

## Clone Repository

```bash
git clone <repository-url>

cd fitforge-ai
```

## Install Dependencies

```bash
npm install
```

---

# Prisma Setup

Generate Prisma Client

```bash
npx prisma generate
```

Run Migration

```bash
npx prisma migrate dev
```

Seed Database

```bash
npm run seed
```

---

# Running Application

Development

```bash
npm run start:dev
```

Production

```bash
npm run build

npm run start:prod
```

---

# Redis & BullMQ

Redis is used for:

* Active Profile Cache
* Active Diet Cache
* Active Workout Cache
* AI Context Cache

BullMQ Jobs:

* Weekly Reports
* Compliance Analysis
* Progress Analysis
* Plan Expiry
* AI Insight Generation

---

# Cloudflare R2

Used for:

* Profile Images
* Progress Photos
* Physique Goal Images
* Future Meal Images

Upload Flow

```text
Client
   │
Request Upload URL
   │
NestJS
   │
Generate Presigned URL
   │
Cloudflare R2
   │
Upload File
   │
Confirm Upload
   │
Save Metadata
```

---

# AI Provider Strategy

Provider Interface

```ts
interface AIProvider {
  generateTransformation()
  generateDiet()
  generateWorkout()
  regenerateDiet()
  regenerateWorkout()
  askCoach()
}
```

Providers:

* GeminiProvider
* DeepSeekProvider
* QwenProvider

Fallback Order:

```text
Gemini
  ↓
DeepSeek
  ↓
Qwen
```

---

# Security

Authentication

* JWT Access Tokens
* Refresh Tokens

Authorization

Roles:

* USER
* ADMIN

Security Features

* Rate Limiting
* Secure File Uploads
* Password Hashing
* Input Validation
* Request Logging

---

# Monitoring

## Sentry

Tracks:

* API Errors
* AI Failures
* Upload Failures
* Queue Failures

---

## Pino

Tracks:

* Requests
* Responses
* Processing Time
* Errors

---

# MVP Scope

## Release 1

* Authentication
* Fitness Profile
* Food Preferences
* Physique Goals
* Transformation Engine

## Release 2

* AI Diet Planner
* Meal Planning
* Grocery Lists
* Workout Planner

## Release 3

* Progress Tracking
* Daily Checkins
* Compliance Engine

## Release 4

* AI Chat Sessions
* AI Coach
* Diet Regeneration
* Workout Regeneration

## Release 5

* Progress Photos
* Upload Management
* Analytics Dashboard

---

# Future Enhancements

## AI Body Analysis

Analyze:

* Body Fat %
* Posture
* Muscle Development

Using:

* Front Photo
* Side Photo
* Back Photo

---

## Wearable Integrations

* Apple Health
* Google Fit
* Fitbit

---

## Notifications

* Push Notifications
* Email Notifications
* WhatsApp Reminders

---

## Subscription Platform

Plans:

* Free
* Premium

---

## Coach Marketplace

Connect users with certified fitness coaches.

---

# License

Private Proprietary Software

Copyright © FitForge AI

All Rights Reserved.
