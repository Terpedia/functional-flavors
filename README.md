# Functional Flavors - Terpedia

A scientific repository for researching functional flavors and their biological effects in humans.

**Part of the [Terpedia Organization](https://github.com/terpedia)**

## Overview

Terpedia is a comprehensive database exploring the functional compounds found in natural flavors, their chemical properties, and their physiological effects on human health.

## Structure

- **Scientific Articles**: Research on functional flavors and their mechanisms
- **Flavor Profiles**: Detailed analysis of flavor compounds in foods
- **GCMS Certificate of Analysis**: Professional GCMS CoA page showing compounds in cinnamon roll
- **Compound Database**: Individual pages for each compound with scientific information

## Example: Cinnamon Roll

Explore the functional flavors in cinnamon rolls, including:
- Cinnamaldehyde
- Eugenol
- Linalool
- Vanillin
- Coumarin
- Cinnamyl Acetate

Each compound is linked to detailed information about its function in human physiology.

## GitHub Pages

This repository is configured for GitHub Pages. To enable:

1. Go to the repository settings on GitHub (in the Terpedia organization)
2. Navigate to "Pages" in the left sidebar
3. Under "Source", select "Deploy from a branch"
4. Choose "main" (or "master") branch and "/ (root)" folder
5. Click "Save"

The site will be available at: `https://terpedia.github.io/functional-flavors/`

**Note:** This repository should be part of the [Terpedia organization](https://github.com/terpedia) on GitHub.

The site includes:
- Main scientific article (`index.html`)
- Cinnamon roll example page (`cinnamon-roll.html`)
- **GCMS Certificate of Analysis** (`coa.html`) - Professional CoA format with compound table
- Individual compound pages with detailed functional information

## Getting Started

- **Local**: Open `index.html` in a web browser to begin exploring
- **GitHub Pages**: After enabling Pages, visit your GitHub Pages URL

## Testing

This project includes Playwright tests to validate the site structure and functionality:

```bash
# Run all tests
npm test

# Run tests with UI
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed
```

The test suite validates:
- All pages load correctly
- Navigation links work
- GCMS CoA page structure and data
- Compound detail pages
- CSS and HTML file validity
- Link integrity
