# FitForge AI

AI-Powered Fitness Transformation Platform

---

## Overview

FitForge AI is an AI-powered fitness transformation platform designed to help users achieve their ideal physique through personalized nutrition planning, workout generation, progress tracking, and contextual AI coaching.

Unlike traditional fitness applications that only focus on calorie counting, FitForge AI provides a complete transformation journey by combining:

* Personalized Diet Planning
* AI Workout Generation
* Progress Tracking
* Daily Accountability
* Transformation Roadmaps
* Context-Aware AI Coaching

The platform continuously adapts recommendations based on user progress, compliance, preferences, and goals.

---

# Tech Stack

## Frontend

### Web

* Next.js
* TypeScript
* Tailwind CSS
* ShadCN UI

### Mobile

* React Native

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

* Gemini Flash

---

## Storage

* Cloudflare R2

---

# Core Features

## User Personalization

Collect user information:

* Age
* Gender
* Height
* Weight
* Activity Level
* Workout Experience
* Fitness Goal
* Target Physique
* Diet Type
* Allergies
* Food Preferences
* Food Availability
* Budget Preference

---

## Transformation Engine

Generate:

* BMI
* BMR
* TDEE
* Daily Calorie Targets
* Protein Targets
* Estimated Transformation Duration
* Weekly Milestones

Example:

Current Weight: 85kg

Target Weight: 75kg

Target Body Fat: 12%

Estimated Duration: 20 Weeks

---

## AI Diet Planner

Generate personalized diet plans based on:

* Fitness Goal
* Calories
* Protein Targets
* Diet Type
* Favorite Foods
* Available Foods
* Allergies
* Restricted Foods
* Budget

Features:

* Diet Versioning
* Diet Regeneration
* Historical Diet Plans

---

## Meal Planning

Generate:

* Weekly Meal Plans
* Monthly Meal Plans
* Grocery Lists

Track:

* Completed Meals
* Skipped Meals
* Replaced Meals

Meal replacement examples:

Chicken → Paneer

Chicken → Tofu

Chicken → Soya Chunks

while maintaining calorie and protein goals.

---

## AI Workout Planner

Generate workout plans based on:

* Fitness Goal
* Experience Level
* Workout Days
* Workout Mode
* Equipment Availability

Supported Modes:

* Gym
* Home Workout
* Calisthenics

Generate:

* Exercises
* Sets
* Reps
* Rest Times

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
* Body Fat Percentage

Visualize:

* Weight Trends
* Body Fat Trends
* Transformation Timeline

---

## Daily Accountability

Track:

* Calories Consumed
* Protein Consumed
* Water Intake
* Workout Completion
* Diet Compliance

Metrics:

* Meals Assigned
* Meals Completed
* Meals Skipped
* Compliance Percentage

---

## AI Fitness Coach

FitForge AI Coach is a context-aware fitness assistant powered by Gemini Flash.

Unlike traditional chatbots, the AI uses:

* User Profile
* Active Diet Plan
* Active Meal Plan
* Active Workout Plan
* Progress Logs
* Daily Check-ins
* Food Preferences
* Chat History

before generating responses.

---

# AI Chat Sessions

Each user can have multiple coaching conversations.

Examples:

* General Fitness Coaching
* Diet Assistance
* Workout Assistance
* Transformation Guidance

The AI maintains conversation history and uses previous interactions to provide personalized responses.

---

# AI Coaching Examples

Diet Assistance:

* Can I replace chicken with paneer?
* Suggest a vegetarian breakfast.
* What can I eat outside today?

Workout Assistance:

* I missed today's workout.
* Suggest a home workout.
* Can I train chest tomorrow?

Transformation Guidance:

* Why am I not losing weight?
* Am I on track for visible abs?
* How long until I reach 12% body fat?

---

# AI Response Flow

```text
User Message
      ↓
Load User Profile
      ↓
Load Diet Plan
      ↓
Load Workout Plan
      ↓
Load Progress Data
      ↓
Load Chat History
      ↓
Build Prompt
      ↓
Gemini Flash
      ↓
Save Response
      ↓
Return Contextual Answer
```

# Database Modules

Authentication

* User
* Session
* RefreshToken

User Personalization

* UserFitnessProfile
* PhysiqueGoal
* UserFoodPreference

Transformation Engine

* TransformationTarget
* TransformationMilestone

Nutrition

* DietPlan
* MealPlan
* MealPlanItem
* MealLog
* GroceryList
* FoodMaster

Workout

* WorkoutPlan
* WorkoutDay
* WorkoutExercise
* ExerciseMaster

Progress

* ProgressLog
* ProgressPhoto

Accountability

* DailyCheckin

AI

* AiChatSession
* AiMessage

Storage

* Upload

---

# Storage Architecture

Cloudflare R2 is used for:

* Progress Photos
* Profile Pictures
* Future Meal Photos

Stored Metadata:

* File Name
* File Type
* File Size
* Category
* Upload Timestamp

---

# Project Structure

```text
src/
├── modules/
│   ├── auth/
│   ├── users/
│   ├── onboarding/
│   ├── transformation/
│   ├── diet/
│   ├── meals/
│   ├── grocery/
│   ├── workout/
│   ├── progress/
│   ├── checkin/
│   ├── uploads/
│   ├── ai/
│   └── analytics/
│
├── prisma/
│
├── common/
│
├── config/
│
└── main.ts
```

# Environment Variables

```env
DATABASE_URL=

JWT_SECRET=
JWT_REFRESH_SECRET=

GEMINI_API_KEY=

R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=
R2_PUBLIC_URL=
```

# MVP Scope

### Authentication

* User Registration
* Login
* JWT Authentication

### User Onboarding

* Fitness Profile
* Goal Selection
* Food Preferences

### Transformation

* BMI
* BMR
* TDEE
* Timeline Generation

### Nutrition

* Diet Generation
* Meal Plans
* Meal Tracking

### Workout

* Workout Generation
* Workout Tracking

### Progress

* Progress Logs
* Daily Check-ins

### AI

* AI Coach
* Chat Sessions
* Context-Aware Responses
* Diet Regeneration
* Workout Regeneration

---

# Future Roadmap

## Phase 10

AI Body Analysis

* Body Fat Estimation
* Physique Classification
* Posture Analysis
* Muscle Development Analysis

## Phase 11

Premium Features

* WhatsApp Reminders
* Grocery Planning
* Apple Health Integration
* Google Fit Integration
* Coach Marketplace
* Subscription Plans

---

# Success Metrics

Product Metrics

* Profile Completion Rate
* Diet Plan Generation Rate
* Workout Plan Generation Rate

Engagement Metrics

* Daily Active Users
* Weekly Active Users
* Meal Compliance Rate
* Workout Compliance Rate

AI Metrics

* AI Coach Usage
* Diet Regeneration Requests
* Workout Regeneration Requests

Business Metrics

* Retention Rate
* Subscription Conversion Rate
* Churn Rate

---

# License

Private Proprietary Software

Copyright © FitForge AI
