# 2024-boilerplate-react

Boilerplate for TypeScript React Projects that do **NOT** require SSR / Paired API Service (Backend4Frontend).
Operates with Mocked API when hosted locally (localhost) or in production (WAN) with a global flag.

## Use Cases

- MStack: Static Generated Site
- JMStack: Interactive Web Application
- J(TP)AMStack: Web Application Powered by 3rd Party or De-Coupled (Cloud) API services

# Scripts

| Script      | Description                               |
| ----------- | ----------------------------------------- |
| `build`     | Generates application assets to be hosted |
| `hostBuild` | starts web server hosting built assets    |
| `dev`       | Runs Local Development Server             |
| `lint`      | Runs static analysis on `/src`            |

# Project Tools

| JS/TS Aspect            | Utilized                                              |
| ----------------------- | ----------------------------------------------------- |
| Module Format           | EcmaScript                                            |
| Scaffolding             | Vite                                                  |
| Bundler                 | Rollup (via Vite)                                     |
| TS Compiler             | TSC                                                   |
| JS Transpiler           | SWC (via Vite)                                        |
| UI Platform             | React                                                 |
| UI Styling              | Tailwind CSS-in-JS                                    |
| Linters                 | ESLint/Prettier                                       |
| API Mock Tool           | MockServiceWorker                                     |
| TS/JS Unit Test Tool    | vitest/react-testing-library ([Details](#unit-tests)) |
| React Component Testing | Storybook                                             |
| Web App E2E             | Playwright                                            |
| CI/CD                   | Github                                                |
| Host                    | Github OR AWS S3                                      |

# Node + Version Manager

This repository uses NVM to manage and maintain a working node version.

It also uses Corepack/PNPM and associated lockfiles to indicate last working configuration in version control.

# Verification

## Mocked APIs

Mock Service Worker (MSW) [link]()

## Static Analysis (Linter)

The following are tools used to check code without transpiling or running tests for "correctness" & consistency.

### ESLint

tbd

### Prettier

tbd

## Unit Tests

React-Testing-Library [link](https://testing-library.com/docs/react-testing-library/intro)

## Integration tests

Storybook UI / Component Tests [link](https://storybook.js.org/docs/6/configure/integration/typescript#default-configuration)

# Build

`pnpm build` Outputs site & asset files (css,js,imgs) to `/dist`

# Deployment

Use `pulumi` to setup an AWS S3 Bucket and
