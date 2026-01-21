import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

// List of all expected pages
const pages = [
  { path: 'index.html', title: 'Terpedia - Functional Flavors Research' },
  { path: 'cinnamon-roll-tabs.html', title: 'Cinnamon Roll - Functional Flavors | Terpedia' },
  { path: 'compounds.html', title: 'All Compounds - Terpedia' },
];

// List of all compound pages
const compoundPages = [
  { path: 'compounds/cinnamaldehyde.html', name: 'Cinnamaldehyde' },
  { path: 'compounds/eugenol.html', name: 'Eugenol' },
  { path: 'compounds/linalool.html', name: 'Linalool' },
  { path: 'compounds/vanillin.html', name: 'Vanillin' },
  { path: 'compounds/coumarin.html', name: 'Coumarin' },
  { path: 'compounds/cinnamyl-acetate.html', name: 'Cinnamyl Acetate' },
];

// Expected compounds in CoA table
const coaCompounds = [
  'Cinnamaldehyde',
  'Eugenol',
  'Linalool',
  'Vanillin',
  'Cinnamyl Acetate',
  'Coumarin',
];

test.describe('Terpedia Site Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Set a longer timeout for file-based testing
    test.setTimeout(30000);
  });

  test('Home page loads correctly', async ({ page }) => {
    await page.goto('file://' + join(process.cwd(), 'index.html'));
    await expect(page).toHaveTitle(/Terpedia/);
    await expect(page.locator('h1')).toContainText('Terpedia');
    await expect(page.locator('h2')).toContainText('Functional Flavors');
  });

  test('Cinnamon Roll page loads and has tabs', async ({ page }) => {
    await page.goto('file://' + join(process.cwd(), 'cinnamon-roll-tabs.html'));
    await expect(page).toHaveTitle(/Cinnamon Roll/);
    
    // Check for tabs
    const tabButtons = page.locator('.tab-button');
    await expect(tabButtons).toHaveCount(4);
    await expect(page.locator('.tab-button:has-text("Overview")')).toBeVisible();
    await expect(page.locator('.tab-button:has-text("GCMS CoA")')).toBeVisible();
    await expect(page.locator('.tab-button:has-text("Ingredients")')).toBeVisible();
    await expect(page.locator('.tab-button:has-text("Compounds")')).toBeVisible();
    
    // Check that overview tab is active by default
    await expect(page.locator('#overview.tab-content.active')).toBeVisible();
    
    // Check for compound cards in overview tab (within active tab)
    const overviewTab = page.locator('#overview.tab-content.active');
    const compoundCards = overviewTab.locator('.compound-card');
    await expect(compoundCards).toHaveCount(6);
    
    // Check that all expected compounds are present
    for (const compound of ['Cinnamaldehyde', 'Eugenol', 'Linalool', 'Vanillin', 'Coumarin', 'Cinnamyl Acetate']) {
      await expect(overviewTab.getByText(compound).first()).toBeVisible();
    }
  });

  test('GCMS CoA tab has correct structure', async ({ page }) => {
    await page.goto('file://' + join(process.cwd(), 'cinnamon-roll-tabs.html'));
    
    // Click on GCMS CoA tab
    await page.locator('button:has-text("GCMS CoA")').click();
    await page.waitForTimeout(500); // Wait for tab switch animation
    
    // Verify CoA tab is now active
    await expect(page.locator('#coa.tab-content.active')).toBeVisible();
    
    // Get reference to active CoA tab
    const coaTab = page.locator('#coa.tab-content.active');
    
    // Check header elements (within active tab)
    await expect(coaTab.locator('.coa-logo h2')).toContainText('TERPEDIA');
    await expect(coaTab.locator('.coa-title h1')).toContainText('CERTIFICATE OF ANALYSIS');
    
    // Check certificate info table (within active tab)
    await expect(coaTab.locator('text=Certificate No.')).toBeVisible();
    await expect(coaTab.locator('text=TP-2024-001')).toBeVisible();
    await expect(coaTab.locator('text=Sample Name')).toBeVisible();
    await expect(coaTab.locator('text=Cinnamon Roll Flavor Profile')).toBeVisible();
    
    // Check results table exists
    const coaTable = coaTab.locator('.coa-table');
    await expect(coaTable).toBeVisible();
    
    // Check table headers (within active tab)
    await expect(coaTab.locator('th:has-text("Compound Name")')).toBeVisible();
    await expect(coaTab.locator('th:has-text("CAS Number")')).toBeVisible();
    await expect(coaTab.locator('th:has-text("RT (min)")')).toBeVisible();
    await expect(coaTab.locator('th:has-text("Area %")')).toBeVisible();
    await expect(coaTab.locator('th:has-text("Concentration")')).toBeVisible();
    await expect(coaTab.locator('th:has-text("Match Quality")')).toBeVisible();
    
    // Check that all expected compounds are in the table
    for (const compound of coaCompounds) {
      const row = coaTab.locator(`tr:has-text("${compound}")`);
      await expect(row).toBeVisible();
      
      // Check that compound has a link
      const link = row.locator('a.coa-link');
      await expect(link).toBeVisible();
      await expect(link).toHaveText(/View/);
    }
    
    // Check total row
    await expect(coaTab.locator('text=Total Identified')).toBeVisible();
    
    // Check notes section
    await expect(coaTab.locator('h3:has-text("Notes")')).toBeVisible();
    
    // Check signature section
    const signatureSection = coaTab.locator('.coa-signature');
    await expect(signatureSection.getByText('Analyst', { exact: true }).first()).toBeVisible();
    await expect(signatureSection.getByText('Approved By', { exact: true }).first()).toBeVisible();
  });

  test('CoA table has correct data structure', async ({ page }) => {
    await page.goto('file://' + join(process.cwd(), 'cinnamon-roll-tabs.html'));
    
    // Click on GCMS CoA tab
    await page.locator('.tab-button:has-text("GCMS CoA")').click();
    await page.waitForTimeout(500); // Wait for tab switch animation
    
    // Verify CoA tab is active
    await expect(page.locator('#coa.tab-content.active')).toBeVisible();
    
    const table = page.locator('.coa-table tbody');
    const rows = table.locator('tr');
    
    // Should have compound rows + 1 total row (updated count with new compounds)
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(15); // At least 14 compounds + 1 total row
    
    // Check first compound row (Cinnamaldehyde)
    const firstRow = rows.first();
    await expect(firstRow.locator('td').nth(0)).toHaveText('1');
    await expect(firstRow.locator('td').nth(1)).toContainText('Cinnamaldehyde');
    await expect(firstRow.locator('td').nth(2)).toContainText('104-55-2'); // CAS number
    await expect(firstRow.locator('td').nth(3)).toContainText('12.45'); // RT
    await expect(firstRow.locator('td').nth(4)).toContainText('68.5'); // Area %
    await expect(firstRow.locator('td').nth(5)).toContainText('245.3'); // Concentration
    await expect(firstRow.locator('td').nth(6)).toContainText('98.2'); // Match Quality
    
    // Check that link exists and points to correct compound
    const link = firstRow.locator('a.coa-link');
    await expect(link).toHaveAttribute('href', 'compounds/cinnamaldehyde.html');
  });

  test('Compounds listing page loads correctly', async ({ page }) => {
    await page.goto('file://' + join(process.cwd(), 'compounds.html'));
    await expect(page).toHaveTitle(/All Compounds/);
    
    // Check that all compounds are listed
    for (const compound of compoundPages) {
      await expect(page.locator(`text=${compound.name}`).first()).toBeVisible();
    }
  });

  test('All compound detail pages load correctly', async ({ page }) => {
    for (const compound of compoundPages) {
      await page.goto('file://' + join(process.cwd(), compound.path));
      await expect(page).toHaveTitle(new RegExp(compound.name));
      
      // Check compound header
      await expect(page.locator(`h2:has-text("${compound.name}")`)).toBeVisible();
      
      // Check for chemical properties section
      await expect(page.locator('h3:has-text("Chemical Properties")')).toBeVisible();
      
      // Check for function in human physiology section
      await expect(page.locator('h3:has-text("Function in Human Physiology")')).toBeVisible();
      
      // Check for references section
      await expect(page.locator('h3:has-text("References")')).toBeVisible();
      
      // Check navigation links back
      await expect(page.locator('nav a[href="../cinnamon-roll-tabs.html"]')).toBeVisible();
      await expect(page.locator('nav a[href="../compounds.html"]')).toBeVisible();
    }
  });

  test('Navigation links work correctly', async ({ page }) => {
    // Start at home page
    await page.goto('file://' + join(process.cwd(), 'index.html'));
    
    // Test navigation to Cinnamon Roll
    await page.click('a[href="cinnamon-roll-tabs.html"]');
    await expect(page).toHaveURL(/cinnamon-roll-tabs\.html/);
    
    // Test tab switching
    await page.locator('.tab-button:has-text("GCMS CoA")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#coa.tab-content.active')).toBeVisible();
    
    await page.locator('.tab-button:has-text("Ingredients")').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#ingredients.tab-content.active')).toBeVisible();
    
    // Test navigation to Compounds
    await page.click('a[href="compounds.html"]');
    await expect(page).toHaveURL(/compounds\.html/);
    
    // Test navigation back to Home
    await page.click('a[href="index.html"]');
    await expect(page).toHaveURL(/index\.html/);
  });

  test('CoA links to compound pages work', async ({ page }) => {
    await page.goto('file://' + join(process.cwd(), 'cinnamon-roll-tabs.html'));
    
    // Click on GCMS CoA tab
    await page.locator('.tab-button:has-text("GCMS CoA")').click();
    await page.waitForTimeout(500);
    
    // Verify CoA tab is active and get reference
    const coaTab = page.locator('#coa.tab-content.active');
    await expect(coaTab).toBeVisible();
    
    // Wait for table to be visible
    await expect(coaTab.locator('.coa-table')).toBeVisible();
    await page.waitForTimeout(300);
    
    // Click on Cinnamaldehyde link (within the active CoA tab)
    const cinnamaldehydeLink = coaTab.locator('a[href="compounds/cinnamaldehyde.html"]').first();
    await expect(cinnamaldehydeLink).toBeVisible({ timeout: 5000 });
    await cinnamaldehydeLink.click();
    await expect(page).toHaveURL(/cinnamaldehyde\.html/);
    await expect(page.locator('h2')).toContainText('Cinnamaldehyde');
    
    // Go back and test another link
    await page.goBack();
    await page.locator('.tab-button:has-text("GCMS CoA")').click();
    await page.waitForTimeout(500);
    const coaTab2 = page.locator('#coa.tab-content.active');
    await expect(coaTab2).toBeVisible();
    await expect(coaTab2.locator('.coa-table')).toBeVisible();
    await page.waitForTimeout(300);
    const eugenolLink = coaTab2.locator('a[href="compounds/eugenol.html"]').first();
    await expect(eugenolLink).toBeVisible({ timeout: 5000 });
    await eugenolLink.click();
    await expect(page).toHaveURL(/eugenol\.html/);
    await expect(page.locator('h2')).toContainText('Eugenol');
  });

  test('All CSS files exist and are valid', async ({ page }) => {
    const cssFiles = ['styles.css', 'coa-styles.css'];
    
    for (const cssFile of cssFiles) {
      const cssPath = join(process.cwd(), cssFile);
      const cssContent = readFileSync(cssPath, 'utf-8');
      
      // Basic validation - check it's not empty and contains CSS
      expect(cssContent.length).toBeGreaterThan(0);
      expect(cssContent).toMatch(/\{/); // Contains CSS rules
    }
  });

  test('All HTML files have proper structure', async ({ page }) => {
    const htmlFiles = [
      'index.html',
      'cinnamon-roll-tabs.html',
      'compounds.html',
      ...compoundPages.map(cp => cp.path),
    ];
    
    for (const htmlFile of htmlFiles) {
      await page.goto('file://' + join(process.cwd(), htmlFile));
      
      // Check for basic HTML structure
      await expect(page.locator('body')).toBeVisible();
      
      // Check head exists by checking for title element
      const pageTitle = await page.title();
      expect(pageTitle.length).toBeGreaterThan(0);
      
      // Check for header
      await expect(page.locator('header')).toBeVisible();
      
      // Check for h1 in header (some pages have different h1s in main content)
      const headerH1 = page.locator('header h1');
      if (await headerH1.count() > 0) {
        await expect(headerH1).toContainText('Terpedia');
      }
    }
  });

  test('CoA tab has current date script', async ({ page }) => {
    await page.goto('file://' + join(process.cwd(), 'cinnamon-roll-tabs.html'));
    
    // Click on GCMS CoA tab
    await page.locator('button:has-text("GCMS CoA")').click();
    await page.waitForTimeout(500);
    
    // Verify CoA tab is active
    await expect(page.locator('#coa.tab-content.active')).toBeVisible();
    
    // Check that date element has content
    const dateElement = page.locator('#current-date');
    await expect(dateElement).toBeVisible();
    const dateText = await dateElement.textContent();
    expect(dateText).toBeTruthy();
    expect(dateText?.length).toBeGreaterThan(0);
  });

  test('All compound pages have navigation to Cinnamon Roll', async ({ page }) => {
    for (const compound of compoundPages) {
      await page.goto('file://' + join(process.cwd(), compound.path));
      
      // Check for Cinnamon Roll link in navigation (should be first match in nav)
      const cinnamonRollLink = page.locator('nav a[href="../cinnamon-roll-tabs.html"]').first();
      await expect(cinnamonRollLink).toBeVisible();
    }
  });
});
